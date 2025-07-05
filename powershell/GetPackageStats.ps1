#Requires -Version 5.1
<#
.SYNOPSIS
    Get comprehensive package management statistics and system information

.DESCRIPTION
    This script provides detailed statistics about package management including
    Chocolatey packages, installed programs, package sources, and system status.

.PARAMETER IncludeDetailed
    Include detailed package information in the output

.PARAMETER CheckUpdates
    Check for available package updates (slower)

.PARAMETER Format
    Output format: JSON, Summary (default: JSON)

.EXAMPLE
    .\GetPackageStats.ps1
    
.EXAMPLE
    .\GetPackageStats.ps1 -IncludeDetailed -CheckUpdates
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory=$false)]
    [switch]$IncludeDetailed,
    
    [Parameter(Mandatory=$false)]
    [switch]$CheckUpdates,
    
    [Parameter(Mandatory=$false)]
    [ValidateSet('JSON', 'Summary')]
    [string]$Format = 'JSON'
)

# Set error action preference
$ErrorActionPreference = 'Continue'

function Write-JsonOutput {
    param(
        [Parameter(Mandatory=$true)]
        [object]$Data
    )
    
    $json = $Data | ConvertTo-Json -Depth 4 -Compress
    Write-Output $json
}

function Get-ChocolateyStats {
    try {
        $stats = @{
            Available = $false
            Version = ""
            InstalledPackages = 0
            AvailableUpdates = 0
            Packages = @()
            UpdatesAvailable = @()
        }
        
        # Check if Chocolatey is available
        if (-not (Get-Command choco -ErrorAction SilentlyContinue)) {
            return $stats
        }
        
        $stats.Available = $true
        
        # Get Chocolatey version
        try {
            $versionOutput = & choco --version 2>$null
            if ($LASTEXITCODE -eq 0) {
                $stats.Version = $versionOutput.Trim()
            }
        }
        catch { }
        
        # Get installed packages
        try {
            $installedOutput = & choco list --local-only --limit-output 2>$null
            if ($LASTEXITCODE -eq 0) {
                $packages = @()
                foreach ($line in $installedOutput) {
                    if ($line.Trim()) {
                        $parts = $line -split '\|'
                        if ($parts.Length -ge 2) {
                            $package = @{
                                Name = $parts[0].Trim()
                                Version = $parts[1].Trim()
                                Source = "Chocolatey"
                            }
                            $packages += $package
                        }
                    }
                }
                $stats.InstalledPackages = $packages.Count
                if ($IncludeDetailed.IsPresent) {
                    $stats.Packages = $packages
                }
            }
        }
        catch { }
        
        # Check for updates if requested
        if ($CheckUpdates.IsPresent) {
            try {
                $updateOutput = & choco outdated --limit-output 2>$null
                if ($LASTEXITCODE -eq 0) {
                    $updates = @()
                    foreach ($line in $updateOutput) {
                        if ($line.Trim()) {
                            $parts = $line -split '\|'
                            if ($parts.Length -ge 3) {
                                $update = @{
                                    Name = $parts[0].Trim()
                                    CurrentVersion = $parts[1].Trim()
                                    AvailableVersion = $parts[2].Trim()
                                }
                                $updates += $update
                            }
                        }
                    }
                    $stats.AvailableUpdates = $updates.Count
                    if ($IncludeDetailed.IsPresent) {
                        $stats.UpdatesAvailable = $updates
                    }
                }
            }
            catch { }
        }
        
        return $stats
    }
    catch {
        return @{
            Available = $false
            Error = $_.Exception.Message
        }
    }
}

function Get-RegistryProgramsCount {
    try {
        $count = 0
        $uninstallKeys = @(
            "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*",
            "HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*",
            "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*"
        )
        
        foreach ($keyPath in $uninstallKeys) {
            try {
                $items = Get-ItemProperty $keyPath -ErrorAction SilentlyContinue | Where-Object {
                    $_.DisplayName -and 
                    $_.DisplayName.Trim() -ne "" -and
                    (-not $_.SystemComponent) -and
                    (-not $_.ParentKeyName) -and
                    $_.DisplayName -notmatch "(Update|Hotfix|Service Pack|KB\d+)"
                }
                $count += $items.Count
            }
            catch { }
        }
        
        return $count
    }
    catch {
        return 0
    }
}

function Get-StoreAppsCount {
    try {
        $apps = Get-AppxPackage -AllUsers -ErrorAction SilentlyContinue | Where-Object {
            $_.Name -notmatch "^Microsoft\." -or
            $_.Name -match "Microsoft\.(Office|Teams|SkypeApp|WindowsTerminal|PowerBI)"
        }
        return $apps.Count
    }
    catch {
        return 0
    }
}

function Get-PackagesFileStats {
    param(
        [string]$PackagesFile
    )
    
    try {
        $stats = @{
            Exists = $false
            TotalPackages = 0
            ConfigPackages = 0
            RegularPackages = 0
            Comments = 0
            EmptyLines = 0
            Packages = @()
        }
        
        if (-not (Test-Path $PackagesFile)) {
            return $stats
        }
        
        $stats.Exists = $true
        $content = Get-Content $PackagesFile -ErrorAction Stop
        
        foreach ($line in $content) {
            $trimmedLine = $line.Trim()
            if (-not $trimmedLine) {
                $stats.EmptyLines++
            }
            elseif ($trimmedLine.StartsWith('#')) {
                $stats.Comments++
            }
            else {
                $hasConfig = $trimmedLine.StartsWith('+')
                $packageName = if ($hasConfig) { $trimmedLine.Substring(1) } else { $trimmedLine }
                
                if ($hasConfig) {
                    $stats.ConfigPackages++
                } else {
                    $stats.RegularPackages++
                }
                
                $stats.TotalPackages++
                
                if ($IncludeDetailed.IsPresent) {
                    $stats.Packages += @{
                        Name = $packageName
                        HasConfig = $hasConfig
                    }
                }
            }
        }
        
        return $stats
    }
    catch {
        return @{
            Exists = $false
            Error = $_.Exception.Message
        }
    }
}

function Get-SystemInfo {
    try {
        $info = @{
            OS = ""
            PSVersion = ""
            IsAdmin = $false
            Architecture = ""
            TotalMemoryGB = 0
            FreeSpaceGB = 0
        }
        
        # Get OS info
        $os = Get-CimInstance -ClassName Win32_OperatingSystem -ErrorAction SilentlyContinue
        if ($os) {
            $info.OS = "$($os.Caption) $($os.Version)"
            $info.Architecture = $os.OSArchitecture
            $info.TotalMemoryGB = [math]::Round($os.TotalVisibleMemorySize / 1MB, 2)
        }
        
        # PowerShell version
        $info.PSVersion = $PSVersionTable.PSVersion.ToString()
        
        # Admin check
        $info.IsAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")
        
        # Free disk space on system drive
        $systemDrive = Get-CimInstance -ClassName Win32_LogicalDisk -Filter "DeviceID='C:'" -ErrorAction SilentlyContinue
        if ($systemDrive) {
            $info.FreeSpaceGB = [math]::Round($systemDrive.FreeSpace / 1GB, 2)
        }
        
        return $info
    }
    catch {
        return @{
            Error = $_.Exception.Message
        }
    }
}

# Main execution
try {
    # Determine packages file path
    $scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
    $packagesFile = Join-Path $scriptPath "packages.txt"
    
    # Collect all statistics
    $stats = @{
        GeneratedAt = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        System = Get-SystemInfo
        Chocolatey = Get-ChocolateyStats
        PackagesFile = Get-PackagesFileStats -PackagesFile $packagesFile
        InstalledPrograms = @{
            Registry = Get-RegistryProgramsCount
            Store = Get-StoreAppsCount
        }
        Summary = @{}
    }
    
    # Calculate summary statistics
    $stats.Summary = @{
        TotalManagedPackages = $stats.PackagesFile.TotalPackages
        PackagesWithConfig = $stats.PackagesFile.ConfigPackages
        ChocolateyPackages = $stats.Chocolatey.InstalledPackages
        RegistryPrograms = $stats.InstalledPrograms.Registry
        StoreApps = $stats.InstalledPrograms.Store
        UpdatesAvailable = $stats.Chocolatey.AvailableUpdates
        SystemReady = $stats.System.IsAdmin -and $stats.Chocolatey.Available
    }
    
    # Output results
    switch ($Format) {
        'JSON' {
            Write-JsonOutput $stats
        }
        'Summary' {
            Write-Host "Package Management Statistics" -ForegroundColor Cyan
            Write-Host "=============================" -ForegroundColor Cyan
            Write-Host ""
            Write-Host "System Information:" -ForegroundColor Yellow
            Write-Host "  OS: $($stats.System.OS)"
            Write-Host "  PowerShell: $($stats.System.PSVersion)"
            Write-Host "  Administrator: $($stats.System.IsAdmin)"
            Write-Host "  Free Space: $($stats.System.FreeSpaceGB) GB"
            Write-Host ""
            Write-Host "Package Management:" -ForegroundColor Yellow
            Write-Host "  Chocolatey Available: $($stats.Chocolatey.Available)"
            if ($stats.Chocolatey.Available) {
                Write-Host "  Chocolatey Version: $($stats.Chocolatey.Version)"
                Write-Host "  Chocolatey Packages: $($stats.Chocolatey.InstalledPackages)"
                if ($CheckUpdates.IsPresent) {
                    Write-Host "  Updates Available: $($stats.Chocolatey.AvailableUpdates)"
                }
            }
            Write-Host ""
            Write-Host "Packages File:" -ForegroundColor Yellow
            Write-Host "  File Exists: $($stats.PackagesFile.Exists)"
            if ($stats.PackagesFile.Exists) {
                Write-Host "  Total Packages: $($stats.PackagesFile.TotalPackages)"
                Write-Host "  With Config: $($stats.PackagesFile.ConfigPackages)"
                Write-Host "  Regular: $($stats.PackagesFile.RegularPackages)"
            }
            Write-Host ""
            Write-Host "Installed Programs:" -ForegroundColor Yellow
            Write-Host "  Registry Programs: $($stats.InstalledPrograms.Registry)"
            Write-Host "  Store Apps: $($stats.InstalledPrograms.Store)"
        }
    }
    
    exit 0
}
catch {
    $result = @{
        Success = $false
        Error = "Unexpected error: $($_.Exception.Message)"
        GeneratedAt = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    }
    
    if ($Format -eq 'JSON') {
        Write-JsonOutput $result
    } else {
        Write-Error $result.Error
    }
    
    exit 1
}
