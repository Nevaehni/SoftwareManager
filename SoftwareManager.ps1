#Requires -Version 5.1
#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Software Manager - Automates backup and restore of applications and their configs using Chocolatey

.DESCRIPTION
    This script automates the backup and restore of applications and their configurations using Chocolatey.
    It reads from a packages.txt file where lines starting with "+" indicate packages whose configs should be backed up/restored.
    
    If you encounter execution policy errors, run with:
    PowerShell -ExecutionPolicy Bypass -File "SoftwareManager.ps1"

.PARAMETER Mode
    Operation mode: 'Backup' or 'Install'

.NOTES
    Author: GitHub Copilot
    Version: 1.1
    Requires: PowerShell 5.1+, Administrator privileges, Chocolatey (for install mode)
    
.EXAMPLE
    .\SoftwareManager.ps1
    
.EXAMPLE
    PowerShell -ExecutionPolicy Bypass -File "SoftwareManager.ps1" -Mode Backup
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory=$false)]
    [ValidateSet('Backup', 'Install')]
    [string]$Mode
)

# Global variables
$Script:ScriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$Script:PackagesFile = Join-Path $ScriptPath "packages.txt"
$Script:ConfigsDir = Join-Path $ScriptPath "configs"
$Script:ConfigsZip = Join-Path $ScriptPath "configs.zip"
$Script:LogFile = Join-Path $ScriptPath "install-log.txt"
$Script:ConfigMappingsFile = Join-Path $ScriptPath "ConfigMappings.ps1"
$Script:ExitCode = 0
$Script:WarningCount = 0
$Script:ErrorCount = 0

# Load configuration mappings from external file
try {
    if (Test-Path $Script:ConfigMappingsFile) {
        $Script:ConfigMappings = & $Script:ConfigMappingsFile
        Write-Verbose "Loaded configuration mappings from ConfigMappings.ps1"
    }
    else {
        Write-Warning "ConfigMappings.ps1 file not found. No application configurations will be backed up."
        $Script:ConfigMappings = @{}
    }
}
catch {
    Write-Error "Failed to load ConfigMappings.ps1: $_"
    $Script:ConfigMappings = @{}
}

function Write-Log {
    param(
        [Parameter(Mandatory=$true)]
        [string]$Message,
        
        [Parameter(Mandatory=$false)]
        [ValidateSet('Info', 'Warning', 'Error')]
        [string]$Level = 'Info'
    )
    
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logEntry = "[$timestamp] [$Level] $Message"
    
    # Write to console with colors
    switch ($Level) {
        'Info' { Write-Host $logEntry -ForegroundColor Green }
        'Warning' { 
            Write-Host $logEntry -ForegroundColor Yellow
            $Script:WarningCount++
        }
        'Error' { 
            Write-Host $logEntry -ForegroundColor Red
            $Script:ErrorCount++
        }
    }
    
    # Write to log file
    try {
        Add-Content -Path $Script:LogFile -Value $logEntry -ErrorAction Stop
    }
    catch {
        Write-Host "Failed to write to log file: $_" -ForegroundColor Red
    }
}

function Test-Administrator {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Set-ExecutionPolicyIfNeeded {
    try {
        $currentPolicy = Get-ExecutionPolicy -Scope CurrentUser
        Write-Log "Current execution policy for CurrentUser: $currentPolicy"
        
        # Check if execution policy allows script execution
        if ($currentPolicy -in @('Restricted', 'AllSigned')) {
            Write-Log "Execution policy is restrictive ($currentPolicy). Attempting to set to RemoteSigned for CurrentUser scope." -Level Warning
            
            try {
                Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force
                Write-Log "Successfully set execution policy to RemoteSigned for CurrentUser"
                return $true
            }
            catch {
                Write-Log "Failed to set execution policy: $_" -Level Error
                Write-Host "Failed to set PowerShell execution policy. Please run the following command manually as Administrator:" -ForegroundColor Red
                Write-Host "Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force" -ForegroundColor Yellow
                return $false
            }
        }
        else {
            Write-Log "Execution policy ($currentPolicy) allows script execution"
            return $true
        }
    }
    catch {
        Write-Log "Failed to check execution policy: $_" -Level Warning
        return $true  # Continue anyway
    }
}

function Test-Chocolatey {
    try {
        $null = Get-Command choco -ErrorAction Stop
        return $true
    }
    catch {
        return $false
    }
}

function Install-Chocolatey {
    Write-Log "Chocolatey not found. Installing Chocolatey..." -Level Warning
    
    try {
        # Use the official Chocolatey installation script
        Write-Host "Installing Chocolatey - this may take a few minutes..." -ForegroundColor Yellow
        
        # Set TLS to 1.2 for secure downloads
        [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
        
        # Download and execute Chocolatey install script
        $installScript = Invoke-Expression ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
        
        # Refresh environment variables
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
        
        # Verify installation
        if (Test-Chocolatey) {
            Write-Log "Chocolatey installed successfully"
            
            # Update Chocolatey to latest version
            Write-Log "Updating Chocolatey to latest version"
            choco upgrade chocolatey -y
            
            return $true
        }
        else {
            Write-Log "Chocolatey installation verification failed" -Level Error
            return $false
        }
    }
    catch {
        Write-Log "Failed to install Chocolatey: $_" -Level Error
        Write-Host "Failed to install Chocolatey automatically." -ForegroundColor Red
        Write-Host "Please install Chocolatey manually from: https://chocolatey.org/install" -ForegroundColor Yellow
        return $false
    }
}

function Install-PackageFromUrl {
    param(
        [Parameter(Mandatory=$true)]
        [string]$PackageName,
        
        [Parameter(Mandatory=$true)]
        [string]$Url
    )
    
    Write-Log "Installing $PackageName from custom URL: $Url"
    
    try {
        # Use chocolatey to install from URL
        $result = choco install $PackageName --source $Url -y 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Log "Successfully installed $PackageName from URL"
            return $true
        }
        else {
            Write-Log "Failed to install $PackageName from URL (exit code: $LASTEXITCODE). Output: $result" -Level Warning
            
            # Try alternative method: download and install directly
            Write-Log "Attempting direct download and install for $PackageName" -Level Warning
            return Install-PackageDirectly -PackageName $PackageName -Url $Url
        }
    }
    catch {
        Write-Log "Exception during URL installation of $PackageName`: $_" -Level Warning
        
        # Try alternative method: download and install directly
        Write-Log "Attempting direct download and install for $PackageName" -Level Warning
        return Install-PackageDirectly -PackageName $PackageName -Url $Url
    }
}

function Install-PackageDirectly {
    param(
        [Parameter(Mandatory=$true)]
        [string]$PackageName,
        
        [Parameter(Mandatory=$true)]
        [string]$Url
    )
    
    try {
        Write-Log "Downloading $PackageName directly from $Url"
        
        # Create temp directory for download
        $tempDir = Join-Path $env:TEMP "SoftwareManager_$PackageName"
        if (-not (Test-Path $tempDir)) {
            New-Item -Path $tempDir -ItemType Directory -Force | Out-Null
        }
        
        # Determine file extension from URL or use .exe as default
        $fileExtension = if ($Url -match '\.([a-zA-Z0-9]+)(\?|$)') { ".$($matches[1])" } else { ".exe" }
        $downloadPath = Join-Path $tempDir "$PackageName$fileExtension"
        
        # Set TLS to 1.2 for secure downloads
        [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
        
        # Download the file
        $webClient = New-Object System.Net.WebClient
        $webClient.DownloadFile($Url, $downloadPath)
        $webClient.Dispose()
        
        if (Test-Path $downloadPath) {
            Write-Log "Downloaded $PackageName to $downloadPath"
            
            # Install the downloaded file
            Write-Log "Installing $PackageName from downloaded file"
            $installResult = Start-Process -FilePath $downloadPath -ArgumentList "/S", "/SILENT", "/VERYSILENT", "/SUPPRESSMSGBOXES", "/NORESTART" -Wait -PassThru
            
            if ($installResult.ExitCode -eq 0) {
                Write-Log "Successfully installed $PackageName via direct download"
                return $true
            }
            else {
                Write-Log "Installation of $PackageName failed with exit code: $($installResult.ExitCode)" -Level Warning
                return $false
            }
        }
        else {
            Write-Log "Failed to download $PackageName from $Url" -Level Warning
            return $false
        }
    }
    catch {
        Write-Log "Failed to download/install $PackageName directly: $_" -Level Warning
        return $false
    }
    finally {
        # Cleanup temp directory
        if (Test-Path $tempDir) {
            Remove-Item $tempDir -Recurse -Force -ErrorAction SilentlyContinue
        }
    }
}

function Test-PackageInstalled {
    param(
        [Parameter(Mandatory=$true)]
        [string]$PackageName
    )
    
    # First check Chocolatey installed packages
    $installedPackages = @()
    try {
        $chocoList = choco list --local-only --limit-output 2>$null
        $installedPackages = $chocoList | ForEach-Object { ($_ -split '\|')[0] }
        
        if ($PackageName -in $installedPackages) {
            Write-Log "$PackageName found in Chocolatey installed packages"
            return $true
        }
    }
    catch {
        Write-Log "Failed to get Chocolatey package list: $_" -Level Warning
    }
    
    # For packages with custom URLs, check common installation locations
    switch ($PackageName.ToLower()) {
        'discord' {
            $paths = @(
                "$env:LOCALAPPDATA\Discord\Update.exe",
                "$env:PROGRAMFILES\Discord\Discord.exe",
                "$env:PROGRAMFILES(X86)\Discord\Discord.exe"
            )
        }
        'googlechrome' {
            $paths = @(
                "$env:PROGRAMFILES\Google\Chrome\Application\chrome.exe",
                "$env:PROGRAMFILES(X86)\Google\Chrome\Application\chrome.exe"
            )
        }
        'firefox' {
            $paths = @(
                "$env:PROGRAMFILES\Mozilla Firefox\firefox.exe",
                "$env:PROGRAMFILES(X86)\Mozilla Firefox\firefox.exe"
            )
        }
        'vlc' {
            $paths = @(
                "$env:PROGRAMFILES\VideoLAN\VLC\vlc.exe",
                "$env:PROGRAMFILES(X86)\VideoLAN\VLC\vlc.exe"
            )
        }
        'notepadplusplus' {
            $paths = @(
                "$env:PROGRAMFILES\Notepad++\notepad++.exe",
                "$env:PROGRAMFILES(X86)\Notepad++\notepad++.exe"
            )
        }
        default {
            # Generic check for common installation patterns
            $paths = @(
                "$env:PROGRAMFILES\$PackageName\$PackageName.exe",
                "$env:PROGRAMFILES(X86)\$PackageName\$PackageName.exe",
                "$env:LOCALAPPDATA\$PackageName\$PackageName.exe"
            )
        }
    }
    
    # Check if any of the expected paths exist
    foreach ($path in $paths) {
        if (Test-Path $path) {
            Write-Log "$PackageName detected at: $path"
            return $true
        }
    }
    
    # Check Windows Programs and Features (Add/Remove Programs)
    try {
        $uninstallKeys = @(
            "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*",
            "HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*",
            "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*"
        )
        
        foreach ($key in $uninstallKeys) {
            $programs = Get-ItemProperty $key -ErrorAction SilentlyContinue | 
                Where-Object { $_.DisplayName -like "*$PackageName*" -or $_.DisplayName -eq $PackageName }
            
            if ($programs) {
                Write-Log "$PackageName found in Windows Programs list: $($programs[0].DisplayName)"
                return $true
            }
        }
    }
    catch {
        Write-Log "Failed to check Windows Programs list for $PackageName`: $_" -Level Warning
    }
      Write-Log "$PackageName not detected as installed"
    return $false
}

function Get-PackageList {
    if (-not (Test-Path $Script:PackagesFile)) {
        Write-Log "packages.txt file not found in script directory" -Level Error
        return $null
    }
    
    try {
        $packages = Get-Content $Script:PackagesFile | Where-Object { $_.Trim() -ne "" -and -not $_.StartsWith("#") }
        Write-Log "Loaded $($packages.Count) packages from packages.txt"
        return $packages
    }
    catch {
        Write-Log "Failed to read packages.txt: $_" -Level Error
        return $null
    }
}

function Get-ConfigLocations {
    param(
        [Parameter(Mandatory=$true)]
        [string]$PackageName
    )
    
    $locations = @{
        'Folders' = @()
        'Files' = @()
        'Registry' = @()
    }
    
    # Check predefined mappings for actual user settings/configs
    if ($Script:ConfigMappings.ContainsKey($PackageName)) {
        $mapping = $Script:ConfigMappings[$PackageName]
        $locations.Folders += $mapping.Folders | Where-Object { Test-Path $_ -PathType Container }
        $locations.Files += $mapping.Files | Where-Object { Test-Path $_ -PathType Leaf }
        $locations.Registry += $mapping.Registry | Where-Object { 
            # Convert HKEY_CURRENT_USER to HKCU: for Test-Path
            $testPath = $_ -replace '^HKEY_CURRENT_USER', 'HKCU:' -replace '^HKEY_LOCAL_MACHINE', 'HKLM:'
            Test-Path $testPath 
        }
    }
    else {
        Write-Log "No configuration mapping found for $PackageName - skipping config detection" -Level Warning
    }
    
    return $locations
}

function Backup-PackageConfig {
    param(
        [Parameter(Mandatory=$true)]
        [string]$PackageName
    )
    
    Write-Log "Backing up configuration for $PackageName"
    
    $backupDir = Join-Path $Script:ConfigsDir $PackageName
    if (Test-Path $backupDir) {
        Remove-Item $backupDir -Recurse -Force
    }
    New-Item -Path $backupDir -ItemType Directory -Force | Out-Null
    
    $locations = Get-ConfigLocations -PackageName $PackageName
    $configFound = $false
    
    # Backup folders
    foreach ($folder in $locations.Folders) {
        try {
            $destPath = Join-Path $backupDir "folders\$(Split-Path $folder -Leaf)"
            Copy-Item -Path $folder -Destination $destPath -Recurse -Force
            Write-Log "Backed up folder: $folder"
            $configFound = $true
        }
        catch {
            Write-Log "Failed to backup folder $folder`: $_" -Level Warning
        }
    }
    
    # Backup individual files
    foreach ($file in $locations.Files) {
        try {
            $destDir = Join-Path $backupDir "files"
            if (-not (Test-Path $destDir)) {
                New-Item -Path $destDir -ItemType Directory -Force | Out-Null
            }
            $destPath = Join-Path $destDir (Split-Path $file -Leaf)
            Copy-Item -Path $file -Destination $destPath -Force
            Write-Log "Backed up file: $file"
            $configFound = $true
        }
        catch {
            Write-Log "Failed to backup file $file`: $_" -Level Warning
        }
    }
      # Backup registry keys using reg export for complete trees
    foreach ($regKey in $locations.Registry) {
        try {
            $destDir = Join-Path $backupDir "registry"
            if (-not (Test-Path $destDir)) {
                New-Item -Path $destDir -ItemType Directory -Force | Out-Null
            }
            
            # Create safe filename from registry path
            $regName = ($regKey -replace '\\', '_' -replace ':', '') + ".reg"
            $destPath = Join-Path $destDir $regName
            
            # Use reg export to backup complete registry tree
            $result = reg export $regKey $destPath /y 2>&1
            if ($LASTEXITCODE -eq 0) {
                Write-Log "Backed up registry: $regKey"
                $configFound = $true
            }
            else {
                Write-Log "Failed to backup registry $regKey`: $result" -Level Warning
            }
        }
        catch {
            Write-Log "Failed to backup registry $regKey`: $_" -Level Warning
        }
    }
    
    if (-not $configFound) {
        Write-Log "No configuration found for $PackageName" -Level Warning
        Remove-Item $backupDir -Recurse -Force -ErrorAction SilentlyContinue
    }
    
    return $configFound
}

function Restore-PackageConfig {
    param(
        [Parameter(Mandatory=$true)]
        [string]$PackageName
    )
    
    Write-Log "Restoring configuration for $PackageName"
    
    $backupDir = Join-Path $Script:ConfigsDir $PackageName
    if (-not (Test-Path $backupDir)) {
        Write-Log "No backup found for $PackageName" -Level Warning
        return $false
    }
    
    $restored = $false
    
    # Restore folders
    $foldersDir = Join-Path $backupDir "folders"
    if (Test-Path $foldersDir) {
        $locations = Get-ConfigLocations -PackageName $PackageName
        foreach ($sourceFolder in Get-ChildItem $foldersDir -Directory) {
            # Try to match with original locations
            $targetPath = $null
            foreach ($originalFolder in $locations.Folders) {
                if ((Split-Path $originalFolder -Leaf) -eq $sourceFolder.Name) {
                    $targetPath = $originalFolder
                    break
                }
            }
            
            if (-not $targetPath) {
                # Use generic path if no match found
                $targetPath = "$env:APPDATA\$PackageName"
            }
            
            try {
                $targetDir = Split-Path $targetPath -Parent
                if (-not (Test-Path $targetDir)) {
                    New-Item -Path $targetDir -ItemType Directory -Force | Out-Null
                }
                Copy-Item -Path $sourceFolder.FullName -Destination $targetPath -Recurse -Force
                Write-Log "Restored folder to: $targetPath"
                $restored = $true
            }
            catch {
                Write-Log "Failed to restore folder to $targetPath`: $_" -Level Warning
            }
        }
    }
    
    # Restore individual files
    $filesDir = Join-Path $backupDir "files"
    if (Test-Path $filesDir) {
        $locations = Get-ConfigLocations -PackageName $PackageName
        foreach ($sourceFile in Get-ChildItem $filesDir -File) {
            # Try to match with original locations
            $targetPath = $null
            foreach ($originalFile in $locations.Files) {
                if ((Split-Path $originalFile -Leaf) -eq $sourceFile.Name) {
                    $targetPath = $originalFile
                    break
                }
            }
            
            if ($targetPath) {
                try {
                    $targetDir = Split-Path $targetPath -Parent
                    if (-not (Test-Path $targetDir)) {
                        New-Item -Path $targetDir -ItemType Directory -Force | Out-Null
                    }
                    Copy-Item -Path $sourceFile.FullName -Destination $targetPath -Force
                    Write-Log "Restored file to: $targetPath"
                    $restored = $true
                }
                catch {
                    Write-Log "Failed to restore file to $targetPath`: $_" -Level Warning
                }
            }
        }
    }
      # Restore registry keys using reg import
    $registryDir = Join-Path $backupDir "registry"
    if (Test-Path $registryDir) {
        foreach ($regFile in Get-ChildItem $registryDir -Filter "*.reg") {
            try {
                # Use reg import to restore complete registry tree
                $result = reg import $regFile.FullName 2>&1
                if ($LASTEXITCODE -eq 0) {
                    Write-Log "Restored registry from: $($regFile.Name)"
                    $restored = $true
                }
                else {
                    Write-Log "Failed to restore registry from $($regFile.Name)`: $result" -Level Warning
                }
            }
            catch {
                Write-Log "Failed to restore registry from $($regFile.Name)`: $_" -Level Warning
            }
        }
    }
    
    return $restored
}

function Start-BackupMode {
    Write-Log "Starting backup mode"
    
    $packages = Get-PackageList
    if (-not $packages) {
        $Script:ExitCode = 2
        return
    }
    
    $configPackages = $packages | Where-Object { $_.StartsWith('+') }
    if ($configPackages.Count -eq 0) {
        Write-Log "No packages marked for config backup (packages starting with '+')" -Level Warning
        $Script:ExitCode = 1
        return
    }
    
    # Create configs directory
    if (Test-Path $Script:ConfigsDir) {
        Remove-Item $Script:ConfigsDir -Recurse -Force
    }
    New-Item -Path $Script:ConfigsDir -ItemType Directory -Force | Out-Null
    
    $backedUpCount = 0
    foreach ($package in $configPackages) {
        $packageName = $package.Substring(1)  # Remove '+' prefix
        Write-Host "Processing $packageName..." -ForegroundColor Cyan
        
        if (Backup-PackageConfig -PackageName $packageName) {
            $backedUpCount++
        }
    }
    
    # Create configs.zip
    if ($backedUpCount -gt 0) {
        try {
            if (Test-Path $Script:ConfigsZip) {
                Remove-Item $Script:ConfigsZip -Force
            }
            Compress-Archive -Path "$Script:ConfigsDir\*" -DestinationPath $Script:ConfigsZip -Force
            Write-Log "Created configs.zip with $backedUpCount package configurations"
            Write-Host "`nBackup complete! Backed up configurations for $backedUpCount packages." -ForegroundColor Green
        }
        catch {
            Write-Log "Failed to create configs.zip: $_" -Level Error
            $Script:ExitCode = 2
        }
    }
    else {
        Write-Log "No configurations were backed up" -Level Warning
        $Script:ExitCode = 1
    }
}

function Start-InstallMode {
    Write-Log "Starting install and restore mode"
    
    # Check and install Chocolatey if needed
    if (-not (Test-Chocolatey)) {
        if (-not (Install-Chocolatey)) {
            Write-Log "Cannot proceed without Chocolatey" -Level Error
            $Script:ExitCode = 2
            return
        }
    }
    else {
        Write-Log "Chocolatey is already installed"
    }
    
    $packages = Get-PackageList
    if (-not $packages) {
        $Script:ExitCode = 2
        return
    }
    
    # Extract configs.zip if it exists and configs directory doesn't
    if ((Test-Path $Script:ConfigsZip) -and (-not (Test-Path $Script:ConfigsDir))) {
        try {
            Write-Log "Extracting configs.zip"
            Expand-Archive -Path $Script:ConfigsZip -DestinationPath $Script:ScriptPath -Force
        }
        catch {
            Write-Log "Failed to extract configs.zip: $_" -Level Warning
        }
    }
      # Get currently installed packages - no longer needed as we'll check individually
    Write-Log "Checking package installation status individually"
    
    $installedCount = 0
    $restoredCount = 0
    
    foreach ($package in $packages) {
        $isConfigPackage = $package.StartsWith('+')
        $packageName = if ($isConfigPackage) { $package.Substring(1) } else { $package }
        
        Write-Host "Processing $packageName..." -ForegroundColor Cyan        # Install package if not already installed
        if (-not (Test-PackageInstalled -PackageName $packageName)) {
            $installSuccess = $false
            
            # Check if custom URL is specified in config mappings
            if ($Script:ConfigMappings.ContainsKey($packageName) -and 
                $Script:ConfigMappings[$packageName].ContainsKey('InstallUrl') -and 
                -not [string]::IsNullOrWhiteSpace($Script:ConfigMappings[$packageName]['InstallUrl'])) {
                
                $customUrl = $Script:ConfigMappings[$packageName]['InstallUrl']
                Write-Log "Installing $packageName from custom URL"
                $installSuccess = Install-PackageFromUrl -PackageName $packageName -Url $customUrl
            }
            else {
                # Standard Chocolatey installation
                Write-Log "Installing $packageName via Chocolatey"
                try {
                    $result = choco install $packageName -y
                    if ($LASTEXITCODE -eq 0) {
                        Write-Log "Successfully installed $packageName"
                        $installSuccess = $true
                    }
                    else {
                        Write-Log "Failed to install $packageName (exit code: $LASTEXITCODE)" -Level Warning
                    }
                }
                catch {
                    Write-Log "Failed to install $packageName`: $_" -Level Warning
                }
            }
            
            if ($installSuccess) {
                $installedCount++
            }
        }
        else {
            Write-Log "$packageName is already installed"
        }
        
        # Restore configuration if this is a config package
        if ($isConfigPackage) {
            $configBackupExists = Test-Path (Join-Path $Script:ConfigsDir $packageName)
            
            if ($configBackupExists) {
                if (Restore-PackageConfig -PackageName $packageName) {
                    $restoredCount++
                }
            }
            else {
                Write-Host "Configs for $packageName not found – continue? [Y/N]: " -ForegroundColor Yellow -NoNewline
                $response = Read-Host
                if ($response -notmatch '^[Yy]') {
                    Write-Log "User chose to abort due to missing configs for $packageName" -Level Warning
                    $Script:ExitCode = 1
                    return
                }
            }
        }
    }
    
    Write-Log "Installation complete. Installed: $installedCount packages, Restored configs: $restoredCount packages"
    Write-Host "`nInstallation complete!" -ForegroundColor Green
    Write-Host "Installed: $installedCount packages" -ForegroundColor Green
    Write-Host "Restored configs: $restoredCount packages" -ForegroundColor Green
}

function Show-Menu {
    Write-Host ""
    Write-Host "Software Manager - Chocolatey Package & Config Management" -ForegroundColor Cyan
    Write-Host "========================================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "[B] Backup configs from this PC (export only)" -ForegroundColor Yellow
    Write-Host "[I] Install packages on a new PC and restore configs" -ForegroundColor Yellow
    Write-Host ""
    Write-Host -NoNewline "Choose an option [B/I]: "
    
    $choice = Read-Host
    return $choice.ToUpper()
}

# Main execution
function Main {
    # Initialize log file
    Write-Log "Software Manager started"
    Write-Log "Script path: $Script:ScriptPath"
      # Check administrator privileges
    if (-not (Test-Administrator)) {
        Write-Host "This script requires Administrator privileges. Please run as Administrator." -ForegroundColor Red
        Write-Log "Script requires Administrator privileges but is not running as Administrator" -Level Error
        exit 2
    }
    
    Write-Log "Running with Administrator privileges"
    
    # Check and set execution policy if needed
    if (-not (Set-ExecutionPolicyIfNeeded)) {
        Write-Log "Cannot proceed due to execution policy restrictions" -Level Error
        exit 2
    }
      # Check if required files exist
    if (-not (Test-Path $Script:PackagesFile)) {
        Write-Host "packages.txt file not found in script directory: $Script:ScriptPath" -ForegroundColor Red
        Write-Log "packages.txt file not found" -Level Error
        exit 2
    }
    
    if (-not (Test-Path $Script:ConfigMappingsFile)) {
        Write-Host "ConfigMappings.ps1 file not found in script directory: $Script:ScriptPath" -ForegroundColor Red
        Write-Log "ConfigMappings.ps1 file not found" -Level Error
        exit 2
    }
    
    # Determine mode
    if (-not $Mode) {
        $choice = Show-Menu
        switch ($choice) {
            'B' { $Mode = 'Backup' }
            'I' { $Mode = 'Install' }
            default {
                Write-Host "Invalid choice. Exiting." -ForegroundColor Red
                Write-Log "Invalid menu choice: $choice" -Level Error
                exit 2
            }
        }
    }
    
    # Execute selected mode
    switch ($Mode) {
        'Backup' { Start-BackupMode }
        'Install' { Start-InstallMode }
    }
    
    # Set final exit code based on errors and warnings
    if ($Script:ErrorCount -gt 0) {
        $Script:ExitCode = 2
    }
    elseif ($Script:WarningCount -gt 0 -and $Script:ExitCode -eq 0) {
        $Script:ExitCode = 1
    }
    
    Write-Log "Script completed with exit code: $Script:ExitCode (Errors: $Script:ErrorCount, Warnings: $Script:WarningCount)"
    
    # Pause before exit in interactive mode
    if (-not $Mode) {
        Write-Host "`nPress any key to exit..." -ForegroundColor Gray
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    }
    
    exit $Script:ExitCode
}

# Run main function
Main
