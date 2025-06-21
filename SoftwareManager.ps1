#Requires -Version 5.1
#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Software Manager - Automates backup and restore of applications and their configs using Winget

.DESCRIPTION
    This script automates the backup and restore of applications and their configurations using Windows Package Manager (Winget).
    It reads from a packages.txt file where lines starting with "+" indicate packages whose configs should be backed up/restored.
    
    If you encounter execution policy errors, run with:
    PowerShell -ExecutionPolicy Bypass -File "SoftwareManager.ps1"

.PARAMETER Mode
    Operation mode: 'Export', 'Backup' or 'Install'
    - Export: Generate current_packages.txt from currently installed packages
    - Backup: Export application configurations from current PC  
    - Install: Install packages on new PC and restore configurations

.PARAMETER Force
    Force reinstallation of packages even if they are already installed

.NOTES
    Author: GitHub Copilot
    Version: 2.0
    Requires: PowerShell 5.1+, Administrator privileges, Windows Package Manager (Winget)
    
.EXAMPLE
    .\SoftwareManager.ps1
    
.EXAMPLE
    PowerShell -ExecutionPolicy Bypass -File "SoftwareManager.ps1" -Mode Export

.EXAMPLE
    PowerShell -ExecutionPolicy Bypass -File "SoftwareManager.ps1" -Mode Backup

.EXAMPLE
    .\SoftwareManager.ps1 -Mode Install -Force
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory=$false)]
    [ValidateSet('Backup', 'Install', 'Export')]
    [string]$Mode,
    
    [Parameter(Mandatory=$false)]
    [switch]$Force
)

# Global variables
$Script:ScriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$Script:PackagesFile = Join-Path $ScriptPath "packages.txt"
$Script:CurrentPackagesFile = Join-Path $ScriptPath "current_packages.txt"
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

function Test-Winget {
    try {
        $null = Get-Command winget -ErrorAction Stop
        return $true
    }
    catch {
        return $false
    }
}

function Install-Winget {
    Write-Log "Windows Package Manager (Winget) not found. Attempting to install..." -Level Warning
    
    try {
        # Winget is typically pre-installed on Windows 10 (1903+) and Windows 11
        # If missing, it can be installed via Microsoft Store or manual download
        Write-Host "Installing Windows Package Manager (Winget)..." -ForegroundColor Yellow
        
        # Try to install via PowerShell/Windows Package Manager itself
        try {
            # Method 1: Try installing via PowerShell Gallery
            Install-PackageProvider -Name NuGet -MinimumVersion 2.8.5.201 -Force -Scope CurrentUser
            Install-Module -Name Microsoft.WinGet.Client -Force -Scope CurrentUser
            Import-Module Microsoft.WinGet.Client
            
            if (Test-Winget) {
                Write-Log "Winget installed successfully via PowerShell module"
                return $true
            }
        }
        catch {
            Write-Log "PowerShell module installation failed, trying alternative method: $_" -Level Warning
        }
        
        # Method 2: Download from GitHub releases
        Write-Log "Attempting to download Winget from GitHub releases"
        $latestRelease = Invoke-RestMethod -Uri "https://api.github.com/repos/microsoft/winget-cli/releases/latest"
        $downloadUrl = ($latestRelease.assets | Where-Object { $_.name -like "*.msixbundle" }).browser_download_url
        
        if ($downloadUrl) {
            $tempFile = Join-Path $env:TEMP "winget.msixbundle"
            Invoke-WebRequest -Uri $downloadUrl -OutFile $tempFile
            Add-AppxPackage -Path $tempFile
            Remove-Item $tempFile -Force -ErrorAction SilentlyContinue
            
            # Refresh environment
            $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
            
            if (Test-Winget) {
                Write-Log "Winget installed successfully"
                return $true
            }
        }
        
        Write-Log "Automatic Winget installation failed" -Level Error
        Write-Host "Please install Windows Package Manager manually:" -ForegroundColor Red
        Write-Host "1. Install from Microsoft Store: https://www.microsoft.com/store/productId/9NBLGGH4NNS1" -ForegroundColor Yellow
        Write-Host "2. Or download from GitHub: https://github.com/microsoft/winget-cli/releases" -ForegroundColor Yellow
        return $false
    }
    catch {
        Write-Log "Failed to install Winget: $_" -Level Error
        Write-Host "Failed to install Windows Package Manager automatically." -ForegroundColor Red
        Write-Host "Please install Winget manually from Microsoft Store or GitHub releases." -ForegroundColor Yellow
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
        # For Winget, we can try installing from a manifest URL or direct download
        if ($Url -like "*.yaml" -or $Url -like "*.yml") {
            # Winget manifest file
            $result = winget install --manifest $Url --accept-package-agreements --accept-source-agreements 2>&1
        }
        else {
            # Direct download and install
            Write-Log "Attempting direct download and installation for $PackageName"
            return Install-PackageDirectDownload -PackageName $PackageName -Url $Url
        }
        
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
    
    # First check local installations (faster than Winget queries)
    # Updated to handle Winget package ID format (Publisher.Product)
    $packageNameLower = $PackageName.ToLower()
    $packageShortName = if ($PackageName -match '\.') { 
        ($PackageName -split '\.')[1].ToLower() 
    } else { 
        $PackageName.ToLower() 
    }
      # Generic check for common installation patterns (faster than registry/Winget queries)
    # Try both full package name and short name in common installation locations
    $pathsToCheck = @(
        # Try with full package name
        "$env:PROGRAMFILES\$PackageName\$PackageName.exe",
        "$env:PROGRAMFILES(X86)\$PackageName\$PackageName.exe",
        "$env:LOCALAPPDATA\$PackageName\$PackageName.exe",
        # Try with short name (part after the dot)
        "$env:PROGRAMFILES\$packageShortName\$packageShortName.exe",
        "$env:PROGRAMFILES(X86)\$packageShortName\$packageShortName.exe",
        "$env:LOCALAPPDATA\$packageShortName\$packageShortName.exe",
        # Try with publisher name (part before the dot)
        "$env:PROGRAMFILES\$($PackageName.Split('.')[0])\$packageShortName.exe",
        "$env:PROGRAMFILES(X86)\$($PackageName.Split('.')[0])\$packageShortName.exe"
    )
    
    # Check if any of the expected paths exist
    foreach ($path in $pathsToCheck) {
        if (Test-Path $path) {
            Write-Log "$PackageName detected locally at: $path"
            return $true
        }
    }    # Check Windows Programs and Features (Add/Remove Programs) for faster local detection
    try {
        $uninstallKeys = @(
            "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*",
            "HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*",
            "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*"
        )
        
        # Create more specific search terms from package name
        $searchTerms = @()
        if ($PackageName -match '\.') {
            $publisher = $PackageName.Split('.')[0].ToLower()
            $product = $PackageName.Split('.')[1].ToLower()
            
            # For better matching, we need both parts or a very specific match
            # e.g., "Google.Chrome" should match "Google Chrome" but not "Google Drive"
            $searchTerms += "$publisher $product"  # "google chrome"
            $searchTerms += $product              # "chrome"
        } else {
            $searchTerms += $packageShortName
        }
        
        foreach ($key in $uninstallKeys) {
            try {
                $items = Get-ItemProperty $key -ErrorAction SilentlyContinue
                foreach ($item in $items) {
                    if ($item.DisplayName) {
                        $displayName = $item.DisplayName.ToLower()
                          # Check for more precise matches
                        foreach ($term in $searchTerms) {
                            # For compound terms like "google chrome", check if both words are present
                            if ($term -match ' ') {
                                $words = $term -split ' '
                                $allWordsFound = $true
                                foreach ($word in $words) {
                                    if ($displayName -notlike "*$word*") {
                                        $allWordsFound = $false
                                        break
                                    }
                                }
                                if ($allWordsFound) {
                                    Write-Log "$PackageName found in Windows Programs list as: $($item.DisplayName)"
                                    return $true
                                }
                            }
                            # For single terms, be more restrictive - must be exact word match
                            elseif ($displayName -eq $term -or $displayName -like "$term *" -or $displayName -like "* $term" -or $displayName -like "* $term *") {
                                Write-Log "$PackageName found in Windows Programs list as: $($item.DisplayName)"
                                return $true
                            }
                        }
                    }
                }
            }
            catch {
                # Continue to next registry key if this one fails
                continue
            }
        }
    }
    catch {
        Write-Log "Failed to check Windows Programs list: $_" -Level Warning
    }
    
    # Only check Winget if local detection failed (slower but more comprehensive)
    try {
        Write-Log "Local detection failed for $PackageName, checking via Winget..."
        
        # Use winget list with specific package name for more accurate results
        $wingetResult = winget list $PackageName --accept-source-agreements 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Log "$PackageName found via direct winget list query"
            return $true
        }
        
        # If direct query fails, try searching in the full list (last resort)
        $wingetList = winget list --accept-source-agreements 2>$null
        if ($LASTEXITCODE -eq 0 -and $wingetList) {
            # Parse winget list output - look for package ID or name matches
            foreach ($line in $wingetList) {
                # Skip header lines and empty lines
                if ($line -match "^\s*Name\s+" -or $line -match "^-+\s*$" -or [string]::IsNullOrWhiteSpace($line)) {
                    continue
                }
                
                # Extract package name/ID from the line
                if ($line -match "^\s*(.+?)\s+(.+?)\s+(.+?)(\s|$)") {
                    $displayName = $matches[1].Trim()
                    $packageId = $matches[2].Trim()
                    
                    # Check for exact package ID match or partial name match
                    if ($packageId -eq $PackageName -or 
                        $displayName -like "*$PackageName*" -or 
                        $PackageName -like "*$displayName*" -or
                        ($PackageName -match '\.') -and ($packageId -like "*$($PackageName.Split('.')[1])*")) {
                        Write-Log "$PackageName found in Winget installed packages (ID: $packageId, Name: $displayName)"
                        return $true
                    }
                }
            }
        }
    }
    catch {
        Write-Log "Failed to get Winget package list: $_" -Level Warning
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
    
    # Check and install Winget if needed
    if (-not (Test-Winget)) {
        if (-not (Install-Winget)) {
            Write-Log "Cannot proceed without Windows Package Manager (Winget)" -Level Error
            $Script:ExitCode = 2
            return
        }
    }
    else {
        Write-Log "Windows Package Manager (Winget) is already available"
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
    }    # Get currently installed packages - no longer needed as we'll check individually
    if ($Force) {
        Write-Log "Force installation mode enabled - will install/reinstall all packages"
    } else {
        Write-Log "Checking package installation status individually"
    }
    
    $installedCount = 0
    $restoredCount = 0
    
    foreach ($package in $packages) {
        $isConfigPackage = $package.StartsWith('+')
        $packageName = if ($isConfigPackage) { $package.Substring(1) } else { $package }
        
        Write-Host "Processing $packageName..." -ForegroundColor Cyan
        
        # Install package if not already installed (or if Force is specified)
        $shouldInstall = $Force -or (-not (Test-PackageInstalled -PackageName $packageName))
        
        if ($shouldInstall) {
            if ($Force) {
                Write-Log "Force installing $packageName (bypassing installation check)"
            }
            
            $installSuccess = $false
            
            # Check if custom URL is specified in config mappings
            if ($Script:ConfigMappings.ContainsKey($packageName) -and 
                $Script:ConfigMappings[$packageName].ContainsKey('InstallUrl') -and 
                -not [string]::IsNullOrWhiteSpace($Script:ConfigMappings[$packageName]['InstallUrl'])) {
                
                $customUrl = $Script:ConfigMappings[$packageName]['InstallUrl']
                Write-Log "Installing $packageName from custom URL"
                $installSuccess = Install-PackageFromUrl -PackageName $packageName -Url $customUrl
            }            else {
                # Standard Winget installation
                Write-Log "Installing $packageName via Windows Package Manager (Winget)"
                try {
                    $result = winget install $packageName --accept-package-agreements --accept-source-agreements --silent 2>&1
                    if ($LASTEXITCODE -eq 0) {
                        Write-Log "Successfully installed $packageName"
                        $installSuccess = $true
                    }
                    else {
                        Write-Log "Failed to install $packageName (exit code: $LASTEXITCODE). Output: $result" -Level Warning
                        
                        # Try with exact ID match
                        Write-Log "Retrying $packageName installation with exact ID search"
                        $searchResult = winget search $packageName --exact --accept-source-agreements 2>$null
                        if ($LASTEXITCODE -eq 0 -and $searchResult) {
                            $result = winget install $packageName --exact --accept-package-agreements --accept-source-agreements --silent 2>&1
                            if ($LASTEXITCODE -eq 0) {
                                Write-Log "Successfully installed $packageName with exact match"
                                $installSuccess = $true
                            }
                        }
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

function Start-ExportMode {
    Write-Log "Starting export mode - generating current_packages.txt"
    
    # Check and install Winget if needed
    if (-not (Test-Winget)) {
        if (-not (Install-Winget)) {
            Write-Log "Cannot proceed without Windows Package Manager (Winget)" -Level Error
            $Script:ExitCode = 2
            return
        }
    }
    else {
        Write-Log "Windows Package Manager (Winget) is available"
    }
    
    try {
        Write-Host "Scanning installed packages..." -ForegroundColor Cyan
        
        $packages = @()
        $packageDict = @{}  # To avoid duplicates
        
        # First, get packages from Winget
        Write-Host "  - Scanning Winget packages..." -ForegroundColor Gray
        try {
            $wingetOutput = & winget list --accept-source-agreements 2>$null
            
            if ($LASTEXITCODE -eq 0) {
                $lines = $wingetOutput -split "`n"
                
                # Skip header lines and parse package IDs
                $startParsing = $false
                foreach ($line in $lines) {
                    # Look for the header separator line
                    if ($line -match '^-+\s+-+\s+-+') {
                        $startParsing = $true
                        continue
                    }
                    
                    if ($startParsing -and $line.Trim() -ne '') {
                        # Split the line into columns (Name, ID, Version, Available, Source)
                        $parts = $line -split '\s{2,}' # Split on 2 or more spaces
                        
                        if ($parts.Length -ge 2 -and $parts[1].Trim() -ne '') {
                            $packageId = $parts[1].Trim()
                            
                            # Skip packages without proper IDs or from certain sources
                            if ($packageId -notmatch '^[A-Za-z0-9._-]+\.[A-Za-z0-9._-]+$' -and 
                                $packageId -notmatch '^[A-Za-z0-9._-]+$') {
                                continue
                            }
                            
                            # Skip system packages and store packages
                            if ($packageId -match '^Microsoft\.VCRedist\.' -or 
                                $packageId -match '^Microsoft\.WindowsTerminal' -or
                                $packageId -match '^Microsoft\.Edge' -or
                                $packageId -match '\.msixbundle$' -or
                                $packageId -match '^msstore:') {
                                continue
                            }
                            
                            $packageDict[$packageId] = "winget"
                        }
                    }
                }
                Write-Log "Found $($packageDict.Count) packages from Winget"
            }
            else {
                Write-Log "Failed to get Winget package list" -Level Warning
            }
        }
        catch {
            Write-Log "Error scanning Winget packages: $_" -Level Warning
        }
        
        # Second, scan Windows registry for all installed programs
        Write-Host "  - Scanning Windows Programs and Features..." -ForegroundColor Gray
        try {
            $uninstallKeys = @(
                "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*",
                "HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*",
                "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*"
            )
            
            $registryPackages = @()
            foreach ($key in $uninstallKeys) {
                try {
                    $items = Get-ItemProperty $key -ErrorAction SilentlyContinue
                    foreach ($item in $items) {
                        if ($item.DisplayName -and $item.DisplayName.Trim() -ne '') {
                            $displayName = $item.DisplayName.Trim()
                            $publisher = if ($item.Publisher) { $item.Publisher.Trim() } else { "" }
                            
                            # Skip Windows system components, updates, and redistributables
                            if ($displayName -match '^(Microsoft Visual C\+\+|Microsoft \.NET|Windows|Security Update|Update for|Hotfix|KB\d+)' -or
                                $displayName -match '^(Intel\(R\)|AMD|NVIDIA)' -or
                                $displayName -match '^(DirectX|Microsoft Edge)' -or
                                $displayName -match '(Redistributable|Runtime|Framework)$' -or
                                $displayName -match '^Microsoft Office' -or
                                $displayName -match '^\{[A-F0-9-]+\}$' -or  # GUID names
                                $publisher -match '^Microsoft Corporation$' -and $displayName -match '^(Microsoft|Windows)') {
                                continue
                            }
                            
                            # Try to create a package-like ID
                            $packageId = ""
                            if ($publisher -and $publisher -ne "") {
                                # Clean publisher name
                                $cleanPublisher = $publisher -replace '[^A-Za-z0-9]', ''
                                $cleanProduct = $displayName -replace '[^A-Za-z0-9]', ''
                                
                                # Create Publisher.Product format
                                if ($cleanPublisher -and $cleanProduct) {
                                    $packageId = "$cleanPublisher.$cleanProduct"
                                }
                            }
                            
                            # If we couldn't create a proper ID, use the display name
                            if (-not $packageId) {
                                $packageId = $displayName -replace '[^A-Za-z0-9.\-_]', ''
                            }
                            
                            # Only add if not already found via Winget and not a duplicate
                            if ($packageId -and -not $packageDict.ContainsKey($packageId)) {
                                $registryPackages += @{
                                    Id = $packageId
                                    Name = $displayName
                                    Publisher = $publisher
                                }
                            }
                        }
                    }
                }
                catch {
                    Write-Log "Error scanning registry key $key`: $_" -Level Warning
                    continue
                }
            }
            
            # Add registry packages to our dictionary
            foreach ($regPkg in $registryPackages) {
                $packageDict[$regPkg.Id] = "registry"
            }
            
            Write-Log "Found $($registryPackages.Count) additional packages from Windows registry"
        }
        catch {
            Write-Log "Error scanning Windows registry: $_" -Level Warning
        }
        
        if ($packageDict.Count -eq 0) {
            Write-Log "No packages found to export" -Level Warning
            $Script:ExitCode = 1
            return
        }
        
        # Sort packages alphabetically
        $packages = $packages | Sort-Object
        
        # Write to current_packages.txt
        $header = @(
            "# Current Packages - Generated $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')",
            "# This file contains packages currently installed on this system",
            "# Prefix packages with '+' to include their configurations in backup/restore",
            "#",
            "# To use this file:",
            "# 1. Review the list and add '+' prefix to packages whose configs you want to backup",
            "# 2. Rename this file to 'packages.txt'",
            "# 3. Run backup mode to export configurations",
            "#",
            ""
        )
        
        $content = $header + $packages
        
        Set-Content -Path $Script:CurrentPackagesFile -Value $content -Encoding UTF8
        
        Write-Host "Successfully exported $($packages.Count) packages to current_packages.txt" -ForegroundColor Green
        Write-Log "Exported $($packages.Count) packages to current_packages.txt"
        
        Write-Host "`nTo backup configurations:" -ForegroundColor Yellow
        Write-Host "1. Edit current_packages.txt and add '+' prefix to packages whose configs you want to backup" -ForegroundColor Gray
        Write-Host "2. Rename current_packages.txt to packages.txt" -ForegroundColor Gray
        Write-Host "3. Run: .\SoftwareManager.ps1 -Mode Backup" -ForegroundColor Gray
        
    }
    catch {
        Write-Log "Failed to export packages: $_" -Level Error
        $Script:ExitCode = 2
    }
}

function Show-Menu {
    Write-Host ""
    Write-Host "Software Manager - Winget Package & Config Management" -ForegroundColor Cyan
    Write-Host "========================================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "[E] Export currently installed packages to current_packages.txt" -ForegroundColor Yellow
    Write-Host "[B] Backup configs from this PC (export only)" -ForegroundColor Yellow
    Write-Host "[I] Install packages on a new PC and restore configs" -ForegroundColor Yellow
    Write-Host "[F] Force install/reinstall all packages (bypass checks)" -ForegroundColor Yellow
    Write-Host ""
    Write-Host -NoNewline "Choose an option [E/B/I/F]: "
    
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
    }      # Check if required files exist (packages.txt not required for Export mode)
    if ($Mode -ne 'Export' -and -not (Test-Path $Script:PackagesFile)) {
        Write-Host "packages.txt file not found in script directory: $Script:ScriptPath" -ForegroundColor Red
        Write-Log "packages.txt file not found" -Level Error
        exit 2    }
      # Determine mode
    if (-not $Mode) {
        $choice = Show-Menu
        switch ($choice) {
            'E' { $Mode = 'Export' }
            'B' { $Mode = 'Backup' }
            'I' { $Mode = 'Install' }
            'F' { 
                $Mode = 'Install'
                $Force = $true
                Write-Host "Force mode enabled - will reinstall all packages" -ForegroundColor Yellow
            }
            default {
                Write-Host "Invalid choice. Exiting." -ForegroundColor Red
                Write-Log "Invalid menu choice: $choice" -Level Error
                exit 2
            }
        }
    }
    
    # Check if required files exist (packages.txt not required for Export mode)
    if ($Mode -ne 'Export' -and -not (Test-Path $Script:PackagesFile)) {
        Write-Host "packages.txt file not found in script directory: $Script:ScriptPath" -ForegroundColor Red
        Write-Log "packages.txt file not found" -Level Error
        exit 2
    }
    
    if ($Mode -ne 'Export' -and -not (Test-Path $Script:ConfigMappingsFile)) {
        Write-Host "ConfigMappings.ps1 file not found in script directory: $Script:ScriptPath" -ForegroundColor Red
        Write-Log "ConfigMappings.ps1 file not found" -Level Error
        exit 2
    }
      # Execute selected mode
    switch ($Mode) {
        'Export' { Start-ExportMode }
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
