#Requires -Version 5.1
<#
.SYNOPSIS
    Validate and check package installation status

.DESCRIPTION
    This script validates whether packages exist in Chocolatey and checks their
    installation status on the local system.

.PARAMETER PackageName
    The name/ID of the package to validate

.PARAMETER PackageList
    Array of package names to validate (alternative to PackageName)

.PARAMETER CheckLocal
    Check if packages are installed locally

.PARAMETER CheckChocolatey
    Check if packages exist in Chocolatey repository

.PARAMETER OutputFormat
    Output format: JSON, Table, Simple (default: JSON)

.EXAMPLE
    .\ValidatePackages.ps1 -PackageName "googlechrome" -CheckLocal -CheckChocolatey
    
.EXAMPLE
    .\ValidatePackages.ps1 -PackageList @("vscode", "git", "chrome") -CheckLocal
#>

[CmdletBinding(DefaultParameterSetName='Single')]
param(
    [Parameter(Mandatory=$true, ParameterSetName='Single')]
    [string]$PackageName,
    
    [Parameter(Mandatory=$true, ParameterSetName='Multiple')]
    [string[]]$PackageList,
    
    [Parameter(Mandatory=$false)]
    [switch]$CheckLocal,
    
    [Parameter(Mandatory=$false)]
    [switch]$CheckChocolatey,
    
    [Parameter(Mandatory=$false)]
    [ValidateSet('JSON', 'Table', 'Simple')]
    [string]$OutputFormat = 'JSON'
)

# Set error action preference
$ErrorActionPreference = 'Continue'

function Write-JsonOutput {
    param(
        [Parameter(Mandatory=$true)]
        [object]$Data
    )
    
    $json = $Data | ConvertTo-Json -Depth 3 -Compress
    Write-Output $json
}

function Test-ChocolateyPackageExists {
    param(
        [string]$Package
    )
    
    try {
        if (-not (Get-Command choco -ErrorAction SilentlyContinue)) {
            return @{
                Exists = $false
                Error = "Chocolatey not available"
                Version = ""
                Details = @{}
            }
        }
        
        # Search for exact package match
        $searchResult = & choco search $Package --exact --limit-output 2>$null
        
        if ($LASTEXITCODE -eq 0 -and $searchResult) {
            $lines = $searchResult | Where-Object { $_.Trim() -ne "" }
            $found = $lines | Where-Object { ($_ -split '\|')[0].Trim() -eq $Package }
            
            if ($found) {
                $parts = $found -split '\|'
                return @{
                    Exists = $true
                    Error = $null
                    Version = if ($parts.Length -ge 2) { $parts[1].Trim() } else { "Unknown" }
                    Details = @{
                        PackageId = $parts[0].Trim()
                        LatestVersion = if ($parts.Length -ge 2) { $parts[1].Trim() } else { "Unknown" }
                    }
                }
            }
        }
        
        return @{
            Exists = $false
            Error = $null
            Version = ""
            Details = @{}
        }
    }
    catch {
        return @{
            Exists = $false
            Error = "Error checking Chocolatey: $($_.Exception.Message)"
            Version = ""
            Details = @{}
        }
    }
}

function Test-LocalPackageInstalled {
    param(
        [string]$Package
    )
    
    try {
        $result = @{
            Installed = $false
            Method = ""
            Version = ""
            Location = ""
            Details = @{}
        }
        
        # Check Chocolatey installed packages first
        if (Get-Command choco -ErrorAction SilentlyContinue) {
            try {
                $chocoList = & choco list --local-only --limit-output 2>$null
                if ($LASTEXITCODE -eq 0) {
                    $installed = $chocoList | Where-Object { ($_ -split '\|')[0].Trim() -eq $Package }
                    if ($installed) {
                        $parts = $installed -split '\|'
                        $result.Installed = $true
                        $result.Method = "Chocolatey"
                        $result.Version = if ($parts.Length -ge 2) { $parts[1].Trim() } else { "Unknown" }
                        return $result
                    }
                }
            }
            catch { }
        }
        
        # Check common installation paths
        $commonPaths = Get-CommonInstallPaths -Package $Package
        foreach ($path in $commonPaths) {
            if (Test-Path $path) {
                $result.Installed = $true
                $result.Method = "File System"
                $result.Location = $path
                
                # Try to get version from file
                try {
                    $fileInfo = Get-ItemProperty $path -ErrorAction SilentlyContinue
                    if ($fileInfo.VersionInfo.ProductVersion) {
                        $result.Version = $fileInfo.VersionInfo.ProductVersion
                    }
                }
                catch { }
                
                return $result
            }
        }
        
        # Check Windows Registry
        $registryResult = Test-RegistryInstallation -Package $Package
        if ($registryResult.Installed) {
            return $registryResult
        }
        
        return $result
    }
    catch {
        return @{
            Installed = $false
            Method = ""
            Version = ""
            Location = ""
            Error = "Error checking local installation: $($_.Exception.Message)"
        }
    }
}

function Get-CommonInstallPaths {
    param(
        [string]$Package
    )
    
    $packageLower = $Package.ToLower()
    $paths = @()
    
    # Handle special cases and common patterns
    switch ($packageLower) {
        'googlechrome' {
            $paths += @(
                "$env:PROGRAMFILES\Google\Chrome\Application\chrome.exe",
                "$env:PROGRAMFILES(X86)\Google\Chrome\Application\chrome.exe"
            )
        }
        'firefox' {
            $paths += @(
                "$env:PROGRAMFILES\Mozilla Firefox\firefox.exe",
                "$env:PROGRAMFILES(X86)\Mozilla Firefox\firefox.exe"
            )
        }
        'vscode' {
            $paths += @(
                "$env:PROGRAMFILES\Microsoft VS Code\Code.exe",
                "$env:PROGRAMFILES(X86)\Microsoft VS Code\Code.exe",
                "$env:LOCALAPPDATA\Programs\Microsoft VS Code\Code.exe"
            )
        }
        'git' {
            $paths += @(
                "$env:PROGRAMFILES\Git\bin\git.exe",
                "$env:PROGRAMFILES(X86)\Git\bin\git.exe"
            )
        }
        'vlc' {
            $paths += @(
                "$env:PROGRAMFILES\VideoLAN\VLC\vlc.exe",
                "$env:PROGRAMFILES(X86)\VideoLAN\VLC\vlc.exe"
            )
        }
        'notepadplusplus' {
            $paths += @(
                "$env:PROGRAMFILES\Notepad++\notepad++.exe",
                "$env:PROGRAMFILES(X86)\Notepad++\notepad++.exe"
            )
        }
        '7zip' {
            $paths += @(
                "$env:PROGRAMFILES\7-Zip\7z.exe",
                "$env:PROGRAMFILES(X86)\7-Zip\7z.exe"
            )
        }
        default {
            # Generic patterns
            $paths += @(
                "$env:PROGRAMFILES\$Package\$Package.exe",
                "$env:PROGRAMFILES(X86)\$Package\$Package.exe",
                "$env:LOCALAPPDATA\$Package\$Package.exe",
                "$env:LOCALAPPDATA\Programs\$Package\$Package.exe"
            )
        }
    }
    
    return $paths
}

function Test-RegistryInstallation {
    param(
        [string]$Package
    )
    
    try {
        $result = @{
            Installed = $false
            Method = "Registry"
            Version = ""
            Location = ""
            Details = @{}
        }
        
        $uninstallKeys = @(
            "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*",
            "HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*",
            "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*"
        )
        
        foreach ($keyPath in $uninstallKeys) {
            try {
                $programs = Get-ItemProperty $keyPath -ErrorAction SilentlyContinue | Where-Object {
                    $_.DisplayName -and (
                        $_.DisplayName -like "*$Package*" -or 
                        $_.DisplayName -eq $Package -or
                        $_.PSChildName -eq $Package
                    )
                }
                
                if ($programs) {
                    $program = $programs[0]  # Take first match
                    $result.Installed = $true
                    $result.Version = if ($program.DisplayVersion) { $program.DisplayVersion } else { "Unknown" }
                    $result.Location = if ($program.InstallLocation) { $program.InstallLocation } else { "Registry" }
                    $result.Details = @{
                        DisplayName = $program.DisplayName
                        Publisher = if ($program.Publisher) { $program.Publisher } else { "Unknown" }
                        InstallDate = if ($program.InstallDate) { $program.InstallDate } else { "Unknown" }
                        RegistryKey = $program.PSPath
                    }
                    return $result
                }
            }
            catch { }
        }
        
        return $result
    }
    catch {
        return @{
            Installed = $false
            Method = "Registry"
            Error = "Registry check failed: $($_.Exception.Message)"
        }
    }
}

function Validate-SinglePackage {
    param(
        [string]$Package,
        [bool]$CheckLocalInstall,
        [bool]$CheckChocoExists
    )
    
    $validation = @{
        Package = $Package
        Chocolatey = @{}
        Local = @{}
        Summary = @{
            ExistsInChocolatey = $false
            InstalledLocally = $false
            Status = "Unknown"
        }
    }
    
    # Check Chocolatey repository
    if ($CheckChocoExists) {
        $validation.Chocolatey = Test-ChocolateyPackageExists -Package $Package
        $validation.Summary.ExistsInChocolatey = $validation.Chocolatey.Exists
    }
    
    # Check local installation
    if ($CheckLocalInstall) {
        $validation.Local = Test-LocalPackageInstalled -Package $Package
        $validation.Summary.InstalledLocally = $validation.Local.Installed
    }
    
    # Determine overall status
    if ($CheckChocoExists -and $CheckLocalInstall) {
        if ($validation.Summary.ExistsInChocolatey -and $validation.Summary.InstalledLocally) {
            $validation.Summary.Status = "Available and Installed"
        }
        elseif ($validation.Summary.ExistsInChocolatey -and -not $validation.Summary.InstalledLocally) {
            $validation.Summary.Status = "Available but Not Installed"
        }
        elseif (-not $validation.Summary.ExistsInChocolatey -and $validation.Summary.InstalledLocally) {
            $validation.Summary.Status = "Not in Chocolatey but Installed"
        }
        else {
            $validation.Summary.Status = "Not Available and Not Installed"
        }
    }
    elseif ($CheckChocoExists) {
        $validation.Summary.Status = if ($validation.Summary.ExistsInChocolatey) { "Available in Chocolatey" } else { "Not in Chocolatey" }
    }
    elseif ($CheckLocalInstall) {
        $validation.Summary.Status = if ($validation.Summary.InstalledLocally) { "Installed Locally" } else { "Not Installed" }
    }
    
    return $validation
}

function Format-ValidationOutput {
    param(
        [array]$Validations,
        [string]$Format
    )
    
    switch ($Format) {
        'JSON' {
            $result = @{
                Success = $true
                Count = $Validations.Count
                Validations = $Validations
                GeneratedAt = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
            }
            Write-JsonOutput $result
        }
        'Table' {
            $Validations | Format-Table Package, @{Name="Status"; Expression={$_.Summary.Status}}, @{Name="Choco Version"; Expression={$_.Chocolatey.Version}}, @{Name="Local Version"; Expression={$_.Local.Version}} -AutoSize
        }
        'Simple' {
            foreach ($validation in $Validations) {
                Write-Output "$($validation.Package): $($validation.Summary.Status)"
            }
        }
    }
}

# Main execution
try {
    # Determine packages to validate
    $packagesToValidate = if ($PSCmdlet.ParameterSetName -eq 'Single') { @($PackageName) } else { $PackageList }
    
    # Set default checks if none specified
    if (-not $CheckLocal.IsPresent -and -not $CheckChocolatey.IsPresent) {
        $CheckLocal = $true
        $CheckChocolatey = $true
    }
    
    # Validate each package
    $validations = @()
    foreach ($package in $packagesToValidate) {
        if ($package.Trim()) {
            $validation = Validate-SinglePackage -Package $package.Trim() -CheckLocalInstall $CheckLocal.IsPresent -CheckChocoExists $CheckChocolatey.IsPresent
            $validations += $validation
        }
    }
    
    # Format and output results
    Format-ValidationOutput -Validations $validations -Format $OutputFormat
    
    exit 0
}
catch {
    $result = @{
        Success = $false
        Error = "Unexpected error: $($_.Exception.Message)"
        Count = 0
        Validations = @()
    }
    
    if ($OutputFormat -eq 'JSON') {
        Write-JsonOutput $result
    } else {
        Write-Error $result.Error
    }
    
    exit 1
}
