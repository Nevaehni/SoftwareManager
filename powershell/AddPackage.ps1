#Requires -Version 5.1
<#
.SYNOPSIS
    Add a package to the packages.txt file with optional configuration backup

.DESCRIPTION
    This script adds a new package to the packages.txt file, with support for
    automatic validation, duplicate checking, and configuration backup options.

.PARAMETER PackageName
    The name/ID of the package to add

.PARAMETER IncludeConfig
    Add the package with configuration backup (prefix with +)

.PARAMETER PackagesFile
    Path to the packages.txt file (default: packages.txt in script directory)

.PARAMETER ValidatePackage
    Validate that the package exists in Chocolatey before adding

.PARAMETER Force
    Force add the package even if it already exists in the list

.EXAMPLE
    .\AddPackage.ps1 -PackageName "googlechrome"
    
.EXAMPLE
    .\AddPackage.ps1 -PackageName "vscode" -IncludeConfig -ValidatePackage
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)]
    [string]$PackageName,
    
    [Parameter(Mandatory=$false)]
    [switch]$IncludeConfig,
    
    [Parameter(Mandatory=$false)]
    [string]$PackagesFile,
    
    [Parameter(Mandatory=$false)]
    [switch]$ValidatePackage,
    
    [Parameter(Mandatory=$false)]
    [switch]$Force
)

# Set error action preference
$ErrorActionPreference = 'Stop'

function Write-JsonOutput {
    param(
        [Parameter(Mandatory=$true)]
        [object]$Data
    )
    
    $json = $Data | ConvertTo-Json -Depth 2 -Compress
    Write-Output $json
}

function Test-PackageExists {
    param(
        [string]$Package
    )
    
    try {
        if (-not (Get-Command choco -ErrorAction SilentlyContinue)) {
            return @{
                Exists = $false
                Error = "Chocolatey is not installed"
            }
        }
        
        # Search for exact package match
        $searchResult = & choco search $Package --exact --limit-output 2>$null
        
        if ($LASTEXITCODE -eq 0 -and $searchResult) {
            $lines = $searchResult | Where-Object { $_.Trim() -ne "" }
            $found = $lines | Where-Object { ($_ -split '\|')[0].Trim() -eq $Package }
            
            return @{
                Exists = $found -ne $null
                Error = $null
            }
        }
        
        return @{
            Exists = $false
            Error = "Package search failed"
        }
    }
    catch {
        return @{
            Exists = $false
            Error = "Error validating package: $($_.Exception.Message)"
        }
    }
}

function Get-PackagesList {
    param(
        [string]$FilePath
    )
    
    if (-not (Test-Path $FilePath)) {
        return @{
            Success = $false
            Error = "Packages file not found: $FilePath"
            Packages = @()
        }
    }
    
    try {
        $content = Get-Content $FilePath -ErrorAction Stop
        $packages = @()
        
        foreach ($line in $content) {
            $trimmedLine = $line.Trim()
            if ($trimmedLine -and -not $trimmedLine.StartsWith('#')) {
                $hasConfig = $trimmedLine.StartsWith('+')
                $packageName = if ($hasConfig) { $trimmedLine.Substring(1) } else { $trimmedLine }
                
                $packages += @{
                    Name = $packageName
                    HasConfig = $hasConfig
                    OriginalLine = $line
                }
            }
        }
        
        return @{
            Success = $true
            Error = $null
            Packages = $packages
            RawContent = $content
        }
    }
    catch {
        return @{
            Success = $false
            Error = "Error reading packages file: $($_.Exception.Message)"
            Packages = @()
        }
    }
}

function Add-PackageToFile {
    param(
        [string]$Package,
        [bool]$WithConfig,
        [string]$FilePath,
        [bool]$ForceAdd,
        [bool]$Validate
    )
    
    try {
        # Validate package exists if requested
        if ($Validate) {
            $validation = Test-PackageExists -Package $Package
            if (-not $validation.Exists) {
                return @{
                    Success = $false
                    Error = if ($validation.Error) { $validation.Error } else { "Package '$Package' not found in Chocolatey" }
                    Added = $false
                }
            }
        }
        
        # Get current packages list
        $currentList = Get-PackagesList -FilePath $FilePath
        if (-not $currentList.Success) {
            return $currentList
        }
        
        # Check if package already exists
        $existingPackage = $currentList.Packages | Where-Object { $_.Name -eq $Package }
        
        if ($existingPackage -and -not $ForceAdd) {
            return @{
                Success = $false
                Error = "Package '$Package' already exists in the list"
                Added = $false
                ExistingConfig = $existingPackage.HasConfig
            }
        }
        
        # Create new package entry
        $prefix = if ($WithConfig) { "+" } else { "" }
        $newEntry = "$prefix$Package"
        
        # If forcing and package exists, update it
        if ($existingPackage -and $ForceAdd) {
            $newContent = @()
            foreach ($line in $currentList.RawContent) {
                $trimmedLine = $line.Trim()
                if ($trimmedLine -and -not $trimmedLine.StartsWith('#')) {
                    $hasConfig = $trimmedLine.StartsWith('+')
                    $packageName = if ($hasConfig) { $trimmedLine.Substring(1) } else { $trimmedLine }
                    
                    if ($packageName -eq $Package) {
                        $newContent += $newEntry
                    } else {
                        $newContent += $line
                    }
                } else {
                    $newContent += $line
                }
            }
        } else {
            # Add new entry to the end
            $newContent = $currentList.RawContent + $newEntry
        }
        
        # Write updated content to file
        $newContent | Out-File -FilePath $FilePath -Encoding UTF8
        
        return @{
            Success = $true
            Error = $null
            Added = $true
            PackageName = $Package
            WithConfig = $WithConfig
            Updated = $existingPackage -and $ForceAdd
        }
    }
    catch {
        return @{
            Success = $false
            Error = "Error adding package: $($_.Exception.Message)"
            Added = $false
        }
    }
}

# Main execution
try {
    # Determine packages file path
    if (-not $PackagesFile) {
        $scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
        $PackagesFile = Join-Path $scriptPath "packages.txt"
    }
    
    # Validate package name
    if ([string]::IsNullOrWhiteSpace($PackageName)) {
        $result = @{
            Success = $false
            Error = "Package name cannot be empty"
            Added = $false
        }
        Write-JsonOutput $result
        exit 1
    }
    
    # Clean package name
    $CleanPackageName = $PackageName.Trim()
    
    # Add package
    $addResult = Add-PackageToFile -Package $CleanPackageName -WithConfig $IncludeConfig.IsPresent -FilePath $PackagesFile -ForceAdd $Force.IsPresent -Validate $ValidatePackage.IsPresent
    
    # Output result
    Write-JsonOutput $addResult
    
    if ($addResult.Success) {
        exit 0
    } else {
        exit 1
    }
}
catch {
    $result = @{
        Success = $false
        Error = "Unexpected error: $($_.Exception.Message)"
        Added = $false
    }
    Write-JsonOutput $result
    exit 1
}
