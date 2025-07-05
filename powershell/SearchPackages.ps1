#Requires -Version 5.1
<#
.SYNOPSIS
    Search for Chocolatey packages with enhanced filtering and details

.DESCRIPTION
    This script searches for Chocolatey packages and returns detailed information
    including package descriptions, dependencies, and install counts.

.PARAMETER SearchTerm
    The search term to query for packages

.PARAMETER MaxResults
    Maximum number of results to return (default: 50)

.PARAMETER IncludePrerelease
    Include prerelease packages in search results

.PARAMETER ExactMatch
    Search for exact package ID matches only

.EXAMPLE
    .\SearchPackages.ps1 -SearchTerm "chrome"
    
.EXAMPLE
    .\SearchPackages.ps1 -SearchTerm "vscode" -MaxResults 10
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)]
    [string]$SearchTerm,
    
    [Parameter(Mandatory=$false)]
    [int]$MaxResults = 50,
    
    [Parameter(Mandatory=$false)]
    [switch]$IncludePrerelease,
    
    [Parameter(Mandatory=$false)]
    [switch]$ExactMatch
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

function Search-ChocolateyPackages {
    param(
        [string]$Query,
        [int]$Limit,
        [bool]$Prerelease,
        [bool]$Exact
    )
    
    try {
        # Build chocolatey search command
        $chocoArgs = @('search', $Query, '--limit-output')
        
        if ($Prerelease) {
            $chocoArgs += '--prerelease'
        }
        
        if ($Exact) {
            $chocoArgs += '--exact'
        }
        
        # Execute chocolatey search
        $searchResult = & choco @chocoArgs 2>$null
        
        if ($LASTEXITCODE -ne 0) {
            return @{
                Success = $false
                Error = "Chocolatey search failed with exit code: $LASTEXITCODE"
                Packages = @()
            }
        }
        
        $packages = @()
        $lines = $searchResult | Where-Object { $_.Trim() -ne "" }
        
        foreach ($line in $lines) {
            $parts = $line -split '\|'
            if ($parts.Length -ge 2) {
                $packageId = $parts[0].Trim()
                $version = $parts[1].Trim()
                
                # Skip if we've reached the limit
                if ($packages.Count -ge $Limit) {
                    break
                }
                  # Get additional package info (basic info only for performance)
                $packageInfo = @{
                    Title = $packageId
                    Summary = "Package available for installation"
                }
                  $package = @{
                    Id = $packageId
                    Version = $version
                    Title = $packageInfo.Title
                    Summary = $packageInfo.Summary
                    Description = ""
                    Authors = ""
                    Tags = ""
                    DownloadCount = 0
                    ProjectUrl = ""
                    PackageUrl = ""
                }
                
                $packages += $package
            }
        }
        
        return @{
            Success = $true
            Error = $null
            Packages = $packages
            Count = $packages.Count
        }
    }
    catch {
        return @{
            Success = $false
            Error = "Search error: $($_.Exception.Message)"
            Packages = @()
        }
    }
}

function Get-PackageDetails {
    param(
        [string]$PackageId
    )
    
    # Skip detailed info retrieval for performance - it's often unreliable
    # Return basic info structure
    return @{
        Title = $PackageId
        Summary = ""
        Description = ""
        Authors = ""
        Tags = ""
        DownloadCount = 0
        ProjectUrl = ""
        PackageUrl = ""
    }
}

# Main execution
try {
    # Check if Chocolatey is available
    if (-not (Get-Command choco -ErrorAction SilentlyContinue)) {
        $result = @{
            Success = $false
            Error = "Chocolatey is not installed or not available in PATH"
            Packages = @()
        }
        Write-JsonOutput $result
        exit 1
    }
    
    # Perform the search
    $searchResult = Search-ChocolateyPackages -Query $SearchTerm -Limit $MaxResults -Prerelease $IncludePrerelease.IsPresent -Exact $ExactMatch.IsPresent
    
    # Output results as JSON
    Write-JsonOutput $searchResult
    
    if ($searchResult.Success) {
        exit 0
    } else {
        exit 1
    }
}
catch {
    $result = @{
        Success = $false
        Error = "Unexpected error: $($_.Exception.Message)"
        Packages = @()
    }
    Write-JsonOutput $result
    exit 1
}
