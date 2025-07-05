# GUI Data Management Module for Software Manager
# Handles package lists, config mappings, and data persistence

# Global variables for GUI data
$script:PackageList = @()
$script:ConfigMappings = @{}
$script:Config = $null

function Initialize-GUIData {
    <#
    .SYNOPSIS
        Initializes GUI data by loading packages and config mappings
    #>
    param(
        [Parameter(Mandatory=$true)]
        [hashtable]$Config
    )
    
    $script:Config = $Config
    
    try {
        # Load packages from packages.txt
        $script:PackageList = @()
        if (Test-Path $script:Config.PackagesFile) {
            $packages = Get-Content $script:Config.PackagesFile | Where-Object { $_.Trim() -ne "" }
            foreach ($package in $packages) {
                $hasConfig = $package.StartsWith("+")
                $packageId = if ($hasConfig) { $package.Substring(1) } else { $package }
                $script:PackageList += [PSCustomObject]@{
                    PackageId = $packageId
                    HasConfig = $hasConfig
                    Status = "Unknown"
                }
            }
        }
        
        # Load config mappings
        if (Test-Path $script:Config.ConfigMappingsFile) {
            try {
                . $script:Config.ConfigMappingsFile
                $script:ConfigMappings = $ConfigMappings
            }
            catch {
                Write-SoftwareManagerLog -Config $script:Config -Message "Error loading config mappings: $_" -Level Error
            }
        }
        
        return $true
    }
    catch {
        Write-SoftwareManagerLog -Config $script:Config -Message "Error initializing GUI data: $_" -Level Error
        return $false
    }
}

function Get-PackageList {
    <#
    .SYNOPSIS
        Returns the current package list
    #>
    return $script:PackageList
}

function Get-ConfigMappings {
    <#
    .SYNOPSIS
        Returns the current config mappings
    #>
    return $script:ConfigMappings
}

function Add-Package {
    <#
    .SYNOPSIS
        Adds a new package to the list
    #>
    param(
        [Parameter(Mandatory=$true)]
        [string]$PackageId,
        
        [bool]$HasConfig = $false
    )
    
    # Check if package already exists
    $exists = $script:PackageList | Where-Object { $_.PackageId -eq $PackageId }
    if ($exists) {
        throw "Package '$PackageId' already exists."
    }
    
    $newPackage = [PSCustomObject]@{
        PackageId = $PackageId
        HasConfig = $HasConfig
        Status = "Unknown"
    }
    $script:PackageList += $newPackage
    Save-PackagesList
    return $newPackage
}

function Remove-Package {
    <#
    .SYNOPSIS
        Removes a package from the list
    #>
    param(
        [Parameter(Mandatory=$true)]
        [int]$Index
    )
    
    if ($Index -ge 0 -and $Index -lt $script:PackageList.Count) {
        $packageId = $script:PackageList[$Index].PackageId
        $script:PackageList = $script:PackageList | Where-Object { $_ -ne $script:PackageList[$Index] }
        Save-PackagesList
        return $packageId
    }
    throw "Invalid package index: $Index"
}

function Update-PackageConfig {
    <#
    .SYNOPSIS
        Updates the HasConfig status for a package
    #>
    param(
        [Parameter(Mandatory=$true)]
        [int]$Index,
        
        [Parameter(Mandatory=$true)]
        [bool]$HasConfig
    )
    
    if ($Index -ge 0 -and $Index -lt $script:PackageList.Count) {
        $script:PackageList[$Index].HasConfig = $HasConfig
        Save-PackagesList
    }
}

function Save-PackagesList {
    <#
    .SYNOPSIS
        Saves the current packages list to packages.txt
    #>
    
    if (-not $script:Config) {
        Write-Warning "Configuration not initialized"
        return
    }
    
    try {
        $packagesContent = @()
        foreach ($package in $script:PackageList) {
            $prefix = if ($package.HasConfig) { "+" } else { "" }
            $packagesContent += "$prefix$($package.PackageId)"
        }
        
        $packagesContent | Out-File -FilePath $script:Config.PackagesFile -Encoding UTF8
        Write-SoftwareManagerLog -Config $script:Config -Message "Packages list saved to $($script:Config.PackagesFile)"
    }
    catch {
        Write-SoftwareManagerLog -Config $script:Config -Message "Error saving packages list: $_" -Level Error
        throw $_
    }
}

function Add-ConfigMapping {
    <#
    .SYNOPSIS
        Adds or updates a config mapping
    #>
    param(
        [Parameter(Mandatory=$true)]
        [string]$PackageId,
        
        [string[]]$Files = @(),
        [string[]]$Folders = @(),
        [string[]]$Registry = @(),
        [string]$InstallUrl = ''
    )
    
    $script:ConfigMappings[$PackageId] = @{
        'Files' = $Files
        'Folders' = $Folders
        'Registry' = $Registry
        'InstallUrl' = $InstallUrl
    }
    
    Save-ConfigMappingsToFile
}

function Remove-ConfigMapping {
    <#
    .SYNOPSIS
        Removes a config mapping
    #>
    param(
        [Parameter(Mandatory=$true)]
        [string]$PackageId
    )
    
    if ($script:ConfigMappings.ContainsKey($PackageId)) {
        $script:ConfigMappings.Remove($PackageId)
        Save-ConfigMappingsToFile
    }
}

function Save-ConfigMappingsToFile {
    <#
    .SYNOPSIS
        Saves the current config mappings to ConfigMappings.ps1
    #>
    
    if (-not $script:Config) {
        Write-Warning "Configuration not initialized"
        return
    }
    
    try {
        $content = @"
# Configuration Mappings for Software Manager
# This file defines where each application stores its user settings and configurations
#
# IMPORTANT: Package names should match Winget package IDs when possible
# Use 'winget search <app-name>' to find the correct package ID
#
# Structure:
# 'package-id' = @{
#     'Folders' = @()     # Entire folders to backup (rarely needed for settings)
#     'Files' = @()       # Specific configuration files
#     'Registry' = @()    # Registry keys (use full HKEY_ paths)
#     'InstallUrl' = ''   # Custom download URL (optional - for packages not in Winget repo)
# }
#
# Focus on actual user settings, not installation directories!

`$ConfigMappings = @{
"@
        
        foreach ($packageId in ($script:ConfigMappings.Keys | Sort-Object)) {
            $mapping = $script:ConfigMappings[$packageId]
            $content += "`n    '$packageId' = @{`n"
            
            # Files
            $content += "        'Files' = @(`n"
            foreach ($file in $mapping.Files) {
                $content += "            `"$file`",`n"
            }
            $content = $content.TrimEnd(",`n") + "`n        )`n"
            
            # Folders
            $content += "        'Folders' = @(`n"
            foreach ($folder in $mapping.Folders) {
                $content += "            `"$folder`",`n"
            }
            $content = $content.TrimEnd(",`n") + "`n        )`n"
            
            # Registry
            $content += "        'Registry' = @(`n"
            foreach ($reg in $mapping.Registry) {
                $content += "            `"$reg`",`n"
            }
            $content = $content.TrimEnd(",`n") + "`n        )`n"
            
            $content += "        'InstallUrl' = '$($mapping.InstallUrl)'`n"
            $content += "    }`n"
        }
        
        $content += "}`n"
        
        $content | Out-File -FilePath $script:Config.ConfigMappingsFile -Encoding UTF8
        Write-SoftwareManagerLog -Config $script:Config -Message "Config mappings saved to $($script:Config.ConfigMappingsFile)"
    }
    catch {
        Write-SoftwareManagerLog -Config $script:Config -Message "Error saving config mappings: $_" -Level Error
        throw $_
    }
}

# Export functions
Export-ModuleMember -Function @(
    'Initialize-GUIData',
    'Get-PackageList',
    'Get-ConfigMappings',
    'Add-Package',
    'Remove-Package',
    'Update-PackageConfig',
    'Save-PackagesList',
    'Add-ConfigMapping',
    'Remove-ConfigMapping',
    'Save-ConfigMappingsToFile'
)
