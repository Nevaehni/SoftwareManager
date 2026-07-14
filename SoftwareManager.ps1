#Requires -Version 7.0
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

.PARAMETER Force
    In Install mode, skip the confirmation prompt when a package's config backup is missing
    (logs a warning and continues). Enables unattended runs.

.PARAMETER LoadOnly
    Load the script's functions without running Main. Used by SoftwareManagerGUI.ps1
    (dot-source with ". .\SoftwareManager.ps1 -LoadOnly") to reuse the backup/install engine.

.NOTES
    Version: 2.0
    Requires: PowerShell 7+, Administrator privileges, Chocolatey (for install mode)

.EXAMPLE
    .\SoftwareManager.ps1

.EXAMPLE
    PowerShell -ExecutionPolicy Bypass -File "SoftwareManager.ps1" -Mode Backup

.EXAMPLE
    pwsh -ExecutionPolicy Bypass -File "SoftwareManager.ps1" -Mode Install -Force
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory=$false)]
    [ValidateSet('Backup', 'Install')]
    [string]$Mode,

    [Parameter(Mandatory=$false)]
    [switch]$Force,

    [Parameter(Mandatory=$false)]
    [switch]$LoadOnly
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

# Env-var tokens used to make backed-up paths portable across machines/users.
# Checked longest-expanded-value first so e.g. %LOCALAPPDATA% wins over %USERPROFILE%.
$Script:PathTokens = @{
    '%LOCALAPPDATA%'      = $env:LOCALAPPDATA
    '%APPDATA%'           = $env:APPDATA
    '%PROGRAMDATA%'       = $env:ProgramData
    '%PROGRAMFILES(X86)%' = ${env:ProgramFiles(x86)}
    '%PROGRAMFILES%'      = $env:ProgramFiles
    '%USERPROFILE%'       = $env:USERPROFILE
}

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

    # Optional sink set by a GUI host to receive entries in addition to console/file
    if ($Script:LogSink) {
        try { & $Script:LogSink $logEntry $Level } catch { }
    }

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

function ConvertTo-PortablePath {
    param(
        [Parameter(Mandatory=$true)]
        [string]$Path
    )

    foreach ($token in ($Script:PathTokens.Keys | Sort-Object { $Script:PathTokens[$_].Length } -Descending)) {
        $prefix = $Script:PathTokens[$token]
        if ($prefix -and $Path.StartsWith($prefix, [System.StringComparison]::OrdinalIgnoreCase)) {
            return $token + $Path.Substring($prefix.Length)
        }
    }
    return $Path
}

function ConvertFrom-PortablePath {
    param(
        [Parameter(Mandatory=$true)]
        [string]$Path
    )

    return [System.Environment]::ExpandEnvironmentVariables($Path)
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
        Invoke-Expression ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))

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

# A URL that points straight at an installer file is downloaded and run; anything else is
# treated as a Chocolatey source feed (with a direct download as the fallback).
function Test-InstallerUrl {
    param(
        [Parameter(Mandatory=$true)]
        [string]$Url
    )

    return ($Url -match '(?i)\.(exe|msi)(\?|#|$)')
}

function Install-PackageFromUrl {
    param(
        [Parameter(Mandatory=$true)]
        [string]$PackageName,

        [Parameter(Mandatory=$true)]
        [string]$Url
    )

    Write-Log "Installing $PackageName from custom URL: $Url"

    # A direct link to an .exe/.msi is not a Chocolatey feed - don't waste a choco call on it
    if (Test-InstallerUrl -Url $Url) {
        return Install-PackageDirectly -PackageName $PackageName -Url $Url
    }

    if (-not (Test-Chocolatey)) {
        return Install-PackageDirectly -PackageName $PackageName -Url $Url
    }

    try {
        # Treat the URL as a Chocolatey source feed
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

    $tempDir = Join-Path $env:TEMP "SoftwareManager_$PackageName"

    try {
        Write-Log "Downloading $PackageName directly from $Url"

        # Create temp directory for download
        if (-not (Test-Path $tempDir)) {
            New-Item -Path $tempDir -ItemType Directory -Force | Out-Null
        }

        # Determine file extension from URL or use .exe as default
        $fileExtension = if ($Url -match '(?i)\.(exe|msi)(\?|#|$)') { ".$($Matches[1].ToLower())" } else { ".exe" }
        $downloadPath = Join-Path $tempDir "$PackageName$fileExtension"

        # Set TLS to 1.2 for secure downloads
        [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072

        # Download the file
        $webClient = New-Object System.Net.WebClient
        $webClient.DownloadFile($Url, $downloadPath)
        $webClient.Dispose()

        if (-not (Test-Path $downloadPath)) {
            Write-Log "Failed to download $PackageName from $Url" -Level Warning
            return $false
        }

        Write-Log "Downloaded $PackageName to $downloadPath"
        Write-Log "Installing $PackageName from downloaded file"

        # An .msi is not self-executing - it has to go through msiexec, with its own quiet
        # switches. An .exe gets the usual shotgun of silent flags, since which installer
        # framework it was built with is unknowable from here.
        if ($fileExtension -eq '.msi') {
            $installResult = Start-Process -FilePath 'msiexec.exe' `
                -ArgumentList '/i', "`"$downloadPath`"", '/qn', '/norestart' -Wait -PassThru
        }
        else {
            $installResult = Start-Process -FilePath $downloadPath `
                -ArgumentList '/S', '/SILENT', '/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART' -Wait -PassThru
        }

        # 3010 = success, reboot required
        if ($installResult.ExitCode -eq 0 -or $installResult.ExitCode -eq 3010) {
            Write-Log "Successfully installed $PackageName via direct download"
            return $true
        }

        Write-Log "Installation of $PackageName failed with exit code: $($installResult.ExitCode)" -Level Warning
        return $false
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

# A packages.txt line is: ['+'] ['winget:'|'url:'] <name> ['@' <version>]
#   '+'        - back up / restore this package's config
#   'winget:'  - install through winget instead of Chocolatey (for apps Chocolatey lacks)
#   'url:'     - install by downloading the MSI/EXE at the mapping's InstallUrl
#   '@1.2.3'   - pin a version; without it the latest is installed
function Get-PackageSpec {
    param(
        [Parameter(Mandatory=$true)]
        [string]$Line
    )

    $text = $Line.Trim()
    $isConfig = $text.StartsWith('+')
    if ($isConfig) { $text = $text.Substring(1).Trim() }

    $source = 'chocolatey'
    if ($text -match '^(?i)winget:\s*(.+)$') {
        $source = 'winget'
        $text = $Matches[1].Trim()
    }
    elseif ($text -match '^(?i)url:\s*(.+)$') {
        $source = 'url'
        $text = $Matches[1].Trim()
    }
    elseif ($text -match '^(?i)choco(?:latey)?:\s*(.+)$') {
        $text = $Matches[1].Trim()
    }

    # A trailing @<version> pins the package to that version. winget ids contain dots but
    # never '@', so this is unambiguous.
    $version = ''
    if ($text -match '^(.+?)@([^@]+)$') {
        $text = $Matches[1].Trim()
        $version = $Matches[2].Trim()
    }

    return [pscustomobject]@{
        Config  = $isConfig
        Source  = $source
        Name    = $text
        Version = $version
    }
}

# The URL a package's mapping installs from, or '' when it has none.
#
# A mapping may list one installer per version under 'InstallUrls' - a URL-installed app is
# invisible to both repositories, so pinning it to a version means naming its installer. When
# the line carries no '@version' (or that version has no entry), 'InstallUrl' is used.
function Get-PackageInstallUrl {
    param(
        [Parameter(Mandatory=$true)]
        [string]$PackageName,

        [string]$Version = ''
    )

    if (-not $Script:ConfigMappings.ContainsKey($PackageName)) { return '' }
    $mapping = $Script:ConfigMappings[$PackageName]

    if ($Version -and $mapping.ContainsKey('InstallUrls') -and $mapping['InstallUrls']) {
        foreach ($key in $mapping['InstallUrls'].Keys) {
            if ([string]$key -eq $Version -and -not [string]::IsNullOrWhiteSpace($mapping['InstallUrls'][$key])) {
                return [string]$mapping['InstallUrls'][$key]
            }
        }
    }

    if (-not $mapping.ContainsKey('InstallUrl')) { return '' }
    if ([string]::IsNullOrWhiteSpace($mapping['InstallUrl'])) { return '' }
    return [string]$mapping['InstallUrl']
}

# The name a URL-installed app registers in Add/Remove Programs ('DisplayName' in its
# mapping), which is the only reliable way to tell whether it is already installed.
function Get-PackageDisplayName {
    param(
        [Parameter(Mandatory=$true)]
        [string]$PackageName
    )

    if (-not $Script:ConfigMappings.ContainsKey($PackageName)) { return '' }
    $mapping = $Script:ConfigMappings[$PackageName]
    if (-not $mapping.ContainsKey('DisplayName')) { return '' }
    return [string]$mapping['DisplayName']
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

function Test-WingetPackageInstalled {
    param(
        [Parameter(Mandatory=$true)]
        [string]$PackageId
    )

    try {
        winget list --id $PackageId --exact --accept-source-agreements *>$null
        return ($LASTEXITCODE -eq 0)
    }
    catch {
        return $false
    }
}

function Install-WingetPackage {
    param(
        [Parameter(Mandatory=$true)]
        [string]$PackageId,

        [Parameter(Mandatory=$false)]
        [string]$Version = ''
    )

    Write-Log $(if ($Version) { "Installing $PackageId $Version via winget" } else { "Installing $PackageId via winget" })

    try {
        $versionArgs = if ($Version) { @('--version', $Version) } else { @() }
        winget install --id $PackageId --exact @versionArgs --silent --disable-interactivity `
            --accept-package-agreements --accept-source-agreements
        # -1978335189 = "already installed", which is a success for our purposes
        if ($LASTEXITCODE -eq 0 -or $LASTEXITCODE -eq -1978335189) {
            Write-Log "Successfully installed $PackageId via winget"
            return $true
        }
        Write-Log "Failed to install $PackageId via winget (exit code: $LASTEXITCODE)" -Level Warning
        return $false
    }
    catch {
        Write-Log "Failed to install $PackageId via winget`: $_" -Level Warning
        return $false
    }
}

function Test-PackageInstalled {
    param(
        [Parameter(Mandatory=$true)]
        [string]$PackageName,

        [Parameter(Mandatory=$false)]
        [ValidateSet('chocolatey', 'winget', 'url')]
        [string]$Source = 'chocolatey'
    )

    if ($Source -eq 'winget') {
        if (Test-WingetPackageInstalled -PackageId $PackageName) {
            Write-Log "$PackageName found in winget installed packages"
            return $true
        }
        Write-Log "$PackageName not detected as installed"
        return $false
    }

    # A URL-installed app is unknown to Chocolatey by definition - it can only be found under
    # the name it registers in Add/Remove Programs, so its mapping's DisplayName is the key.
    $lookupNames = @($PackageName)
    if ($Source -eq 'url') {
        $displayName = Get-PackageDisplayName -PackageName $PackageName
        if ($displayName) { $lookupNames = @($displayName) }
    }
    else {
        # First check Chocolatey installed packages (Chocolatey 2.x: 'list' is local-only)
        try {
            $chocoList = choco list --limit-output 2>$null
            $installedPackages = $chocoList | ForEach-Object { ($_ -split '\|')[0] }

            if ($PackageName -in $installedPackages) {
                Write-Log "$PackageName found in Chocolatey installed packages"
                return $true
            }
        }
        catch {
            Write-Log "Failed to get Chocolatey package list: $_" -Level Warning
        }
    }

    # For packages with custom URLs, check common installation locations
    switch ($PackageName.ToLower()) {
        'discord' {
            $paths = @(
                "$env:LOCALAPPDATA\Discord\Update.exe",
                "$env:ProgramFiles\Discord\Discord.exe",
                "${env:ProgramFiles(x86)}\Discord\Discord.exe"
            )
        }
        'googlechrome' {
            $paths = @(
                "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
                "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe"
            )
        }
        'firefox' {
            $paths = @(
                "$env:ProgramFiles\Mozilla Firefox\firefox.exe",
                "${env:ProgramFiles(x86)}\Mozilla Firefox\firefox.exe"
            )
        }
        'vlc' {
            $paths = @(
                "$env:ProgramFiles\VideoLAN\VLC\vlc.exe",
                "${env:ProgramFiles(x86)}\VideoLAN\VLC\vlc.exe"
            )
        }
        'notepadplusplus' {
            $paths = @(
                "$env:ProgramFiles\Notepad++\notepad++.exe",
                "${env:ProgramFiles(x86)}\Notepad++\notepad++.exe"
            )
        }
        default {
            # Generic check for common installation patterns
            $paths = @(
                "$env:ProgramFiles\$PackageName\$PackageName.exe",
                "${env:ProgramFiles(x86)}\$PackageName\$PackageName.exe",
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

    # Check Windows Programs and Features (Add/Remove Programs).
    # Exact/prefix match only - a substring match can false-positive and skip a needed install.
    try {
        $uninstallKeys = @(
            "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*",
            "HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*",
            "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*"
        )

        foreach ($key in $uninstallKeys) {
            foreach ($lookupName in $lookupNames) {
                $programs = Get-ItemProperty $key -ErrorAction SilentlyContinue |
                    Where-Object { $_.DisplayName -and ($_.DisplayName -eq $lookupName -or $_.DisplayName -like "$lookupName *") }

                if ($programs) {
                    Write-Log "$PackageName found in Windows Programs list: $($programs[0].DisplayName)"
                    return $true
                }
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
        $packages = Get-Content $Script:PackagesFile |
            ForEach-Object { $_.Trim() } |
            Where-Object { $_ -ne "" -and -not $_.StartsWith("#") }
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
    $manifestItems = @()
    $itemIndex = 0

    # Backup folders
    foreach ($folder in $locations.Folders) {
        try {
            $destDir = Join-Path $backupDir "folders"
            if (-not (Test-Path $destDir)) {
                New-Item -Path $destDir -ItemType Directory -Force | Out-Null
            }
            $backupRelPath = "folders\$($itemIndex)_$(Split-Path $folder -Leaf)"
            Copy-Item -Path $folder -Destination (Join-Path $backupDir $backupRelPath) -Recurse -Force
            $manifestItems += @{
                type       = 'folder'
                source     = ConvertTo-PortablePath -Path $folder
                backupPath = $backupRelPath
            }
            Write-Log "Backed up folder: $folder"
        }
        catch {
            Write-Log "Failed to backup folder $folder`: $_" -Level Warning
        }
        $itemIndex++
    }

    # Backup individual files
    foreach ($file in $locations.Files) {
        try {
            $destDir = Join-Path $backupDir "files"
            if (-not (Test-Path $destDir)) {
                New-Item -Path $destDir -ItemType Directory -Force | Out-Null
            }
            $backupRelPath = "files\$($itemIndex)_$(Split-Path $file -Leaf)"
            Copy-Item -Path $file -Destination (Join-Path $backupDir $backupRelPath) -Force
            $manifestItems += @{
                type       = 'file'
                source     = ConvertTo-PortablePath -Path $file
                backupPath = $backupRelPath
            }
            Write-Log "Backed up file: $file"
        }
        catch {
            Write-Log "Failed to backup file $file`: $_" -Level Warning
        }
        $itemIndex++
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
            $backupRelPath = "registry\$regName"
            $destPath = Join-Path $backupDir $backupRelPath

            # Use reg export to backup complete registry tree
            $result = reg export $regKey $destPath /y 2>&1
            if ($LASTEXITCODE -eq 0) {
                $manifestItems += @{
                    type       = 'registry'
                    source     = $regKey
                    backupPath = $backupRelPath
                }
                Write-Log "Backed up registry: $regKey"
            }
            else {
                Write-Log "Failed to backup registry $regKey`: $result" -Level Warning
            }
        }
        catch {
            Write-Log "Failed to backup registry $regKey`: $_" -Level Warning
        }
    }

    if ($manifestItems.Count -eq 0) {
        Write-Log "No configuration found for $PackageName" -Level Warning
        Remove-Item $backupDir -Recurse -Force -ErrorAction SilentlyContinue
        return $false
    }

    # Write the manifest - restore relies on it to know each item's original location
    try {
        $manifest = @{
            package    = $PackageName
            backedUpAt = Get-Date -Format "yyyy-MM-ddTHH:mm:ss"
            items      = $manifestItems
        }
        $manifest | ConvertTo-Json -Depth 4 | Set-Content -Path (Join-Path $backupDir "manifest.json") -Encoding UTF8
    }
    catch {
        Write-Log "Failed to write manifest for $PackageName`: $_" -Level Error
        Remove-Item $backupDir -Recurse -Force -ErrorAction SilentlyContinue
        return $false
    }

    return $true
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

    $manifestPath = Join-Path $backupDir "manifest.json"
    if (-not (Test-Path $manifestPath)) {
        Write-Log "No manifest.json in backup for $PackageName - the backup was created by an older version of this script. Re-run Backup mode on the source PC." -Level Error
        return $false
    }

    try {
        $manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
    }
    catch {
        Write-Log "Failed to read manifest for $PackageName`: $_" -Level Error
        return $false
    }

    $restored = $false

    foreach ($item in $manifest.items) {
        $sourcePath = Join-Path $backupDir $item.backupPath
        if (-not (Test-Path $sourcePath)) {
            Write-Log "Backup item missing on disk: $($item.backupPath)" -Level Warning
            continue
        }

        switch ($item.type) {
            'folder' {
                $targetPath = ConvertFrom-PortablePath -Path $item.source
                try {
                    if (Test-Path $targetPath) {
                        # Merge contents into the existing folder to avoid nesting a copy inside it
                        Copy-Item -Path (Join-Path $sourcePath '*') -Destination $targetPath -Recurse -Force
                    }
                    else {
                        $targetParent = Split-Path $targetPath -Parent
                        if (-not (Test-Path $targetParent)) {
                            New-Item -Path $targetParent -ItemType Directory -Force | Out-Null
                        }
                        Copy-Item -Path $sourcePath -Destination $targetPath -Recurse -Force
                    }
                    Write-Log "Restored folder to: $targetPath"
                    $restored = $true
                }
                catch {
                    Write-Log "Failed to restore folder to $targetPath`: $_" -Level Warning
                }
            }
            'file' {
                $targetPath = ConvertFrom-PortablePath -Path $item.source
                try {
                    $targetDir = Split-Path $targetPath -Parent
                    if (-not (Test-Path $targetDir)) {
                        New-Item -Path $targetDir -ItemType Directory -Force | Out-Null
                    }
                    Copy-Item -Path $sourcePath -Destination $targetPath -Force
                    Write-Log "Restored file to: $targetPath"
                    $restored = $true
                }
                catch {
                    Write-Log "Failed to restore file to $targetPath`: $_" -Level Warning
                }
            }
            'registry' {
                try {
                    # Use reg import to restore complete registry tree
                    $result = reg import $sourcePath 2>&1
                    if ($LASTEXITCODE -eq 0) {
                        Write-Log "Restored registry: $($item.source)"
                        $restored = $true
                    }
                    else {
                        Write-Log "Failed to restore registry $($item.source)`: $result" -Level Warning
                    }
                }
                catch {
                    Write-Log "Failed to restore registry $($item.source)`: $_" -Level Warning
                }
            }
            default {
                Write-Log "Unknown manifest item type '$($item.type)' for $PackageName" -Level Warning
            }
        }
    }

    return $restored
}

function Start-BackupMode {
    param(
        # Optional explicit package list in packages.txt syntax ('+' prefix marks config
        # packages); defaults to reading packages.txt. Used by the GUI.
        [Parameter(Mandatory=$false)]
        [string[]]$PackageList
    )

    Write-Log "Starting backup mode"

    $packages = if ($PackageList) { $PackageList } else { Get-PackageList }
    if (-not $packages) {
        $Script:ExitCode = 2
        return
    }

    $configPackages = @($packages | ForEach-Object { Get-PackageSpec -Line $_ } | Where-Object { $_.Config })
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
    $processed = 0
    foreach ($spec in $configPackages) {
        $packageName = $spec.Name
        $processed++
        if ($Script:ProgressSink) { & $Script:ProgressSink $processed $configPackages.Count $packageName }
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
    param(
        # Optional explicit package list in packages.txt syntax ('+' prefix marks config
        # packages); defaults to reading packages.txt. Used by the GUI.
        [Parameter(Mandatory=$false)]
        [string[]]$PackageList
    )

    Write-Log "Starting install and restore mode"

    $packages = if ($PackageList) { $PackageList } else { Get-PackageList }
    if (-not $packages) {
        $Script:ExitCode = 2
        return
    }

    $specs = @($packages | ForEach-Object { Get-PackageSpec -Line $_ })

    # A 'chocolatey' package still skips Chocolatey when its mapping installs it from a URL,
    # and a 'url:' package needs Chocolatey only if its URL is a feed rather than an installer.
    $needsChocolatey = @($specs | Where-Object {
        $url = Get-PackageInstallUrl -PackageName $_.Name -Version $_.Version
        if ($url) { -not (Test-InstallerUrl -Url $url) } else { $_.Source -eq 'chocolatey' }
    }).Count -gt 0
    $needsWinget = @($specs | Where-Object { $_.Source -eq 'winget' }).Count -gt 0

    # Check and install Chocolatey if needed (skipped when every package comes from winget)
    if ($needsChocolatey) {
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
    }

    # winget ships with Windows; it cannot be bootstrapped here, so its packages are skipped
    $wingetAvailable = if ($needsWinget) { Test-Winget } else { $false }
    if ($needsWinget -and -not $wingetAvailable) {
        Write-Log "winget is not available - packages marked 'winget:' cannot be installed. Install App Installer from the Microsoft Store." -Level Error
    }

    # Extract configs.zip if it exists and configs directory doesn't
    if ((Test-Path $Script:ConfigsZip) -and (-not (Test-Path $Script:ConfigsDir))) {
        try {
            Write-Log "Extracting configs.zip"
            Expand-Archive -Path $Script:ConfigsZip -DestinationPath $Script:ConfigsDir -Force
        }
        catch {
            Write-Log "Failed to extract configs.zip: $_" -Level Warning
        }
    }

    Write-Log "Checking package installation status individually"

    $installedCount = 0
    $restoredCount = 0
    $processed = 0

    foreach ($spec in $specs) {
        $isConfigPackage = $spec.Config
        $packageName = $spec.Name

        $processed++
        if ($Script:ProgressSink) { & $Script:ProgressSink $processed $specs.Count $packageName }
        Write-Host "Processing $packageName..." -ForegroundColor Cyan

        # Install package if not already installed
        if (-not (Test-PackageInstalled -PackageName $packageName -Source $spec.Source)) {
            $installSuccess = $false
            $customUrl = Get-PackageInstallUrl -PackageName $packageName -Version $spec.Version

            # A mapping with an InstallUrl wins over the source: it is the escape hatch for
            # apps neither repository carries.
            if ($customUrl) {
                if ($spec.Version) { Write-Log "$packageName pinned to $($spec.Version): installing from $customUrl" }
                $installSuccess = Install-PackageFromUrl -PackageName $packageName -Url $customUrl
            }
            elseif ($spec.Source -eq 'url') {
                Write-Log "$packageName is marked 'url:' but its ConfigMappings.ps1 entry has no InstallUrl - nothing to install from" -Level Error
            }
            elseif ($spec.Source -eq 'winget') {
                if ($wingetAvailable) {
                    $installSuccess = Install-WingetPackage -PackageId $packageName -Version $spec.Version
                }
                else {
                    Write-Log "Skipping $packageName - winget is not available" -Level Warning
                }
            }
            else {
                # Standard Chocolatey installation
                Write-Log $(if ($spec.Version) { "Installing $packageName $($spec.Version) via Chocolatey" } else { "Installing $packageName via Chocolatey" })
                try {
                    $versionArgs = if ($spec.Version) { @('--version', $spec.Version) } else { @() }
                    choco install $packageName @versionArgs -y
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
            elseif ($Force) {
                Write-Log "Configs for $packageName not found - continuing (-Force)" -Level Warning
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

    # Determine mode (remember whether we started interactively for the exit pause)
    $interactive = -not $Mode
    if ($interactive) {
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
    if ($interactive) {
        Write-Host "`nPress any key to exit..." -ForegroundColor Gray
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    }

    exit $Script:ExitCode
}

# Run main function unless the script was loaded for its functions only (see -LoadOnly)
if (-not $LoadOnly) {
    Main
}
