#Requires -Version 5.1
<#
.SYNOPSIS
    Get detailed information about installed programs on the system

.DESCRIPTION
    This script retrieves comprehensive information about installed programs
    using multiple detection methods including Windows Registry, WMI, and package managers.

.PARAMETER IncludeSystemComponents
    Include Windows system components and updates in the results

.PARAMETER IncludeStore
    Include Microsoft Store applications in the results

.PARAMETER SortBy
    Sort results by: Name, Publisher, InstallDate, Size (default: Name)

.PARAMETER Format
    Output format: JSON, CSV, Table (default: JSON)

.EXAMPLE
    .\GetInstalledPrograms.ps1
    
.EXAMPLE
    .\GetInstalledPrograms.ps1 -IncludeStore -SortBy "InstallDate"
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory=$false)]
    [switch]$IncludeSystemComponents,
    
    [Parameter(Mandatory=$false)]
    [switch]$IncludeStore,
    
    [Parameter(Mandatory=$false)]
    [ValidateSet('Name', 'Publisher', 'InstallDate', 'Size')]
    [string]$SortBy = 'Name',
    
    [Parameter(Mandatory=$false)]
    [ValidateSet('JSON', 'CSV', 'Table')]
    [string]$Format = 'JSON'
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

function Get-RegistryPrograms {
    param(
        [bool]$IncludeSystem
    )
    
    $programs = @()
    
    # Registry paths to check
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
                (-not $_.SystemComponent -or $IncludeSystem) -and
                (-not $_.ParentKeyName)
            }
            
            foreach ($item in $items) {
                # Skip system updates and patches unless requested
                if (-not $IncludeSystem) {
                    if ($item.DisplayName -match "(Update|Hotfix|Service Pack|KB\d+)" -or
                        $item.Publisher -match "Microsoft Corporation" -and $item.DisplayName -match "^(Microsoft Visual C\+\+|Microsoft .NET)" -or
                        $item.DisplayName -match "^(Windows|Microsoft)" -and $item.DisplayName -match "(Feature|Component|Runtime|Redistributable)") {
                        continue
                    }
                }
                
                # Parse size if available
                $sizeInMB = 0
                if ($item.EstimatedSize) {
                    $sizeInMB = [math]::Round($item.EstimatedSize / 1024, 2)
                }
                
                # Parse install date
                $installDate = $null
                if ($item.InstallDate) {
                    try {
                        $installDate = [datetime]::ParseExact($item.InstallDate, "yyyyMMdd", $null)
                    }
                    catch {
                        $installDate = $null
                    }
                }
                
                $program = @{
                    Name = $item.DisplayName.Trim()
                    Version = if ($item.DisplayVersion) { $item.DisplayVersion.Trim() } else { "Unknown" }
                    Publisher = if ($item.Publisher) { $item.Publisher.Trim() } else { "Unknown" }
                    InstallDate = $installDate
                    InstallLocation = if ($item.InstallLocation) { $item.InstallLocation.Trim() } else { "" }
                    UninstallString = if ($item.UninstallString) { $item.UninstallString.Trim() } else { "" }
                    SizeMB = $sizeInMB
                    Source = "Registry"
                    Architecture = if ($keyPath -match "WOW6432Node") { "x86" } else { "x64" }
                    RegistryKey = $item.PSPath
                }
                
                $programs += $program
            }
        }
        catch {
            Write-Warning "Error reading registry path $keyPath : $($_.Exception.Message)"
        }
    }
    
    return $programs
}

function Get-StoreApps {
    try {
        $storeApps = @()
        
        # Get Windows Store apps
        $apps = Get-AppxPackage -AllUsers -ErrorAction SilentlyContinue | Where-Object {
            $_.Name -notmatch "^Microsoft\." -or
            $_.Name -match "Microsoft\.(Office|Teams|SkypeApp|WindowsTerminal|PowerBI)"
        }
        
        foreach ($app in $apps) {
            $storeApp = @{
                Name = if ($app.DisplayName) { $app.DisplayName } else { $app.Name }
                Version = if ($app.Version) { $app.Version.ToString() } else { "Unknown" }
                Publisher = if ($app.PublisherDisplayName) { $app.PublisherDisplayName } else { $app.Publisher }
                InstallDate = $app.InstallDate
                InstallLocation = $app.InstallLocation
                UninstallString = ""
                SizeMB = 0
                Source = "Microsoft Store"
                Architecture = $app.Architecture
                RegistryKey = ""
            }
            
            $storeApps += $storeApp
        }
        
        return $storeApps
    }
    catch {
        Write-Warning "Error getting Store apps: $($_.Exception.Message)"
        return @()
    }
}

function Get-ChocolateyPackages {
    try {
        $chocoPrograms = @()
        
        if (Get-Command choco -ErrorAction SilentlyContinue) {
            $chocoList = & choco list --local-only --limit-output 2>$null
            
            if ($LASTEXITCODE -eq 0) {
                foreach ($line in $chocoList) {
                    $parts = $line -split '\|'
                    if ($parts.Length -ge 2) {
                        $chocoProgram = @{
                            Name = $parts[0].Trim()
                            Version = $parts[1].Trim()
                            Publisher = "Chocolatey"
                            InstallDate = $null
                            InstallLocation = ""
                            UninstallString = "choco uninstall $($parts[0].Trim())"
                            SizeMB = 0
                            Source = "Chocolatey"
                            Architecture = "Unknown"
                            RegistryKey = ""
                        }
                        
                        $chocoPrograms += $chocoProgram
                    }
                }
            }
        }
        
        return $chocoPrograms
    }
    catch {
        Write-Warning "Error getting Chocolatey packages: $($_.Exception.Message)"
        return @()
    }
}

function Merge-ProgramLists {
    param(
        [array]$Lists
    )
    
    $mergedPrograms = @{}
    
    foreach ($programList in $Lists) {
        foreach ($program in $programList) {
            $key = "$($program.Name.ToLower())|$($program.Publisher.ToLower())"
            
            if (-not $mergedPrograms.ContainsKey($key)) {
                $mergedPrograms[$key] = $program
            }
            else {
                # Prefer registry information over others
                if ($program.Source -eq "Registry" -and $mergedPrograms[$key].Source -ne "Registry") {
                    $mergedPrograms[$key] = $program
                }
            }
        }
    }
    
    return $mergedPrograms.Values
}

function Format-Output {
    param(
        [array]$Programs,
        [string]$OutputFormat,
        [string]$SortProperty
    )
    
    # Sort programs
    $sortedPrograms = switch ($SortProperty) {
        'Name' { $Programs | Sort-Object Name }
        'Publisher' { $Programs | Sort-Object Publisher, Name }
        'InstallDate' { $Programs | Sort-Object InstallDate -Descending, Name }
        'Size' { $Programs | Sort-Object SizeMB -Descending, Name }
        default { $Programs | Sort-Object Name }
    }
    
    switch ($OutputFormat) {
        'JSON' {
            $result = @{
                Success = $true
                Count = $sortedPrograms.Count
                Programs = $sortedPrograms
                GeneratedAt = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
            }
            Write-JsonOutput $result
        }
        'CSV' {
            $sortedPrograms | Export-Csv -Path "InstalledPrograms.csv" -NoTypeInformation
            Write-Output "CSV file saved as InstalledPrograms.csv"
        }
        'Table' {
            $sortedPrograms | Format-Table Name, Version, Publisher, SizeMB, Source -AutoSize
        }
    }
}

# Main execution
try {
    Write-Progress -Activity "Scanning installed programs" -Status "Getting registry programs..." -PercentComplete 10
    
    # Get programs from registry
    $registryPrograms = Get-RegistryPrograms -IncludeSystem $IncludeSystemComponents.IsPresent
    
    Write-Progress -Activity "Scanning installed programs" -Status "Getting Chocolatey packages..." -PercentComplete 40
    
    # Get Chocolatey packages
    $chocoPrograms = Get-ChocolateyPackages
    
    $programLists = @($registryPrograms, $chocoPrograms)
    
    # Get Store apps if requested
    if ($IncludeStore.IsPresent) {
        Write-Progress -Activity "Scanning installed programs" -Status "Getting Store apps..." -PercentComplete 70
        $storeApps = Get-StoreApps
        $programLists += $storeApps
    }
    
    Write-Progress -Activity "Scanning installed programs" -Status "Merging and sorting results..." -PercentComplete 90
    
    # Merge and deduplicate programs
    $allPrograms = Merge-ProgramLists -Lists $programLists
    
    Write-Progress -Activity "Scanning installed programs" -Status "Completed" -PercentComplete 100 -Completed
    
    # Format and output results
    Format-Output -Programs $allPrograms -OutputFormat $Format -SortProperty $SortBy
    
    exit 0
}
catch {
    $result = @{
        Success = $false
        Error = "Unexpected error: $($_.Exception.Message)"
        Programs = @()
        Count = 0
    }
    
    if ($Format -eq 'JSON') {
        Write-JsonOutput $result
    } else {
        Write-Error $result.Error
    }
    
    exit 1
}
