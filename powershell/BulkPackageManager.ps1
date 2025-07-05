#Requires -Version 5.1
<#
.SYNOPSIS
    Perform bulk operations on packages - install, update, or remove multiple packages

.DESCRIPTION
    This script provides bulk package management capabilities including batch installation,
    updates, and removal of packages with progress tracking and error handling.

.PARAMETER Operation
    The operation to perform: Install, Update, Remove, Reinstall

.PARAMETER PackageList
    Array of package names to process

.PARAMETER PackagesFile
    Path to packages.txt file to read package list from

.PARAMETER Force
    Force operations even if packages are already installed

.PARAMETER SkipDependencies
    Skip dependency resolution during operations

.PARAMETER Timeout
    Timeout in seconds for each package operation (default: 300)

.EXAMPLE
    .\BulkPackageManager.ps1 -Operation "Install" -PackageList @("git", "vscode", "chrome")
    
.EXAMPLE
    .\BulkPackageManager.ps1 -Operation "Update" -PackagesFile "packages.txt"
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)]
    [ValidateSet('Install', 'Update', 'Remove', 'Reinstall')]
    [string]$Operation,
    
    [Parameter(Mandatory=$false, ParameterSetName='PackageArray')]
    [string[]]$PackageList,
    
    [Parameter(Mandatory=$false, ParameterSetName='PackageFile')]
    [string]$PackagesFile,
    
    [Parameter(Mandatory=$false)]
    [switch]$Force,
    
    [Parameter(Mandatory=$false)]
    [switch]$SkipDependencies,
    
    [Parameter(Mandatory=$false)]
    [int]$Timeout = 300
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

function Write-ProgressOutput {
    param(
        [string]$Message,
        [int]$PercentComplete,
        [string]$CurrentItem = ""
    )
    
    $progress = @{
        Type = "Progress"
        Message = $Message
        Percent = $PercentComplete
        CurrentItem = $CurrentItem
        Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    }
    
    Write-JsonOutput $progress
}

function Get-PackagesFromFile {
    param(
        [string]$FilePath
    )
    
    try {
        if (-not (Test-Path $FilePath)) {
            throw "Packages file not found: $FilePath"
        }
        
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
                }
            }
        }
        
        return $packages
    }
    catch {
        throw "Error reading packages file: $($_.Exception.Message)"
    }
}

function Test-ChocolateyAvailable {
    try {
        $null = Get-Command choco -ErrorAction Stop
        
        # Test if chocolatey is responsive
        $testResult = & choco --version 2>$null
        return $LASTEXITCODE -eq 0
    }
    catch {
        return $false
    }
}

function Install-SinglePackage {
    param(
        [string]$PackageName,
        [bool]$ForceInstall,
        [bool]$SkipDeps,
        [int]$TimeoutSeconds
    )
    
    try {
        $args = @('install', $PackageName, '-y', '--no-progress')
        
        if ($ForceInstall) {
            $args += '--force'
        }
        
        if ($SkipDeps) {
            $args += '--ignore-dependencies'
        }
        
        # Set timeout for the process
        $startTime = Get-Date
        $process = Start-Process -FilePath 'choco' -ArgumentList $args -Wait -PassThru -NoNewWindow -RedirectStandardOutput "$env:TEMP\choco_out.txt" -RedirectStandardError "$env:TEMP\choco_err.txt"
        
        $endTime = Get-Date
        $duration = ($endTime - $startTime).TotalSeconds
        
        if ($duration -gt $TimeoutSeconds) {
            return @{
                Success = $false
                ExitCode = -1
                Output = ""
                Error = "Operation timed out after $TimeoutSeconds seconds"
                Duration = $duration
            }
        }
        
        $output = if (Test-Path "$env:TEMP\choco_out.txt") { Get-Content "$env:TEMP\choco_out.txt" -Raw } else { "" }
        $error = if (Test-Path "$env:TEMP\choco_err.txt") { Get-Content "$env:TEMP\choco_err.txt" -Raw } else { "" }
        
        # Cleanup temp files
        Remove-Item "$env:TEMP\choco_out.txt" -Force -ErrorAction SilentlyContinue
        Remove-Item "$env:TEMP\choco_err.txt" -Force -ErrorAction SilentlyContinue
        
        return @{
            Success = $process.ExitCode -eq 0
            ExitCode = $process.ExitCode
            Output = $output
            Error = $error
            Duration = $duration
        }
    }
    catch {
        return @{
            Success = $false
            ExitCode = -1
            Output = ""
            Error = "Exception during installation: $($_.Exception.Message)"
            Duration = 0
        }
    }
}

function Update-SinglePackage {
    param(
        [string]$PackageName,
        [bool]$ForceUpdate,
        [int]$TimeoutSeconds
    )
    
    try {
        $args = @('upgrade', $PackageName, '-y', '--no-progress')
        
        if ($ForceUpdate) {
            $args += '--force'
        }
        
        $startTime = Get-Date
        $process = Start-Process -FilePath 'choco' -ArgumentList $args -Wait -PassThru -NoNewWindow -RedirectStandardOutput "$env:TEMP\choco_out.txt" -RedirectStandardError "$env:TEMP\choco_err.txt"
        
        $endTime = Get-Date
        $duration = ($endTime - $startTime).TotalSeconds
        
        if ($duration -gt $TimeoutSeconds) {
            return @{
                Success = $false
                ExitCode = -1
                Output = ""
                Error = "Operation timed out after $TimeoutSeconds seconds"
                Duration = $duration
            }
        }
        
        $output = if (Test-Path "$env:TEMP\choco_out.txt") { Get-Content "$env:TEMP\choco_out.txt" -Raw } else { "" }
        $error = if (Test-Path "$env:TEMP\choco_err.txt") { Get-Content "$env:TEMP\choco_err.txt" -Raw } else { "" }
        
        # Cleanup temp files
        Remove-Item "$env:TEMP\choco_out.txt" -Force -ErrorAction SilentlyContinue
        Remove-Item "$env:TEMP\choco_err.txt" -Force -ErrorAction SilentlyContinue
        
        return @{
            Success = $process.ExitCode -eq 0
            ExitCode = $process.ExitCode
            Output = $output
            Error = $error
            Duration = $duration
        }
    }
    catch {
        return @{
            Success = $false
            ExitCode = -1
            Output = ""
            Error = "Exception during update: $($_.Exception.Message)"
            Duration = 0
        }
    }
}

function Remove-SinglePackage {
    param(
        [string]$PackageName,
        [bool]$ForceRemove,
        [int]$TimeoutSeconds
    )
    
    try {
        $args = @('uninstall', $PackageName, '-y', '--no-progress')
        
        if ($ForceRemove) {
            $args += '--force'
        }
        
        $startTime = Get-Date
        $process = Start-Process -FilePath 'choco' -ArgumentList $args -Wait -PassThru -NoNewWindow -RedirectStandardOutput "$env:TEMP\choco_out.txt" -RedirectStandardError "$env:TEMP\choco_err.txt"
        
        $endTime = Get-Date
        $duration = ($endTime - $startTime).TotalSeconds
        
        if ($duration -gt $TimeoutSeconds) {
            return @{
                Success = $false
                ExitCode = -1
                Output = ""
                Error = "Operation timed out after $TimeoutSeconds seconds"
                Duration = $duration
            }
        }
        
        $output = if (Test-Path "$env:TEMP\choco_out.txt") { Get-Content "$env:TEMP\choco_out.txt" -Raw } else { "" }
        $error = if (Test-Path "$env:TEMP\choco_err.txt") { Get-Content "$env:TEMP\choco_err.txt" -Raw } else { "" }
        
        # Cleanup temp files
        Remove-Item "$env:TEMP\choco_out.txt" -Force -ErrorAction SilentlyContinue
        Remove-Item "$env:TEMP\choco_err.txt" -Force -ErrorAction SilentlyContinue
        
        return @{
            Success = $process.ExitCode -eq 0
            ExitCode = $process.ExitCode
            Output = $output
            Error = $error
            Duration = $duration
        }
    }
    catch {
        return @{
            Success = $false
            ExitCode = -1
            Output = ""
            Error = "Exception during removal: $($_.Exception.Message)"
            Duration = 0
        }
    }
}

function Process-PackageOperation {
    param(
        [array]$Packages,
        [string]$OperationType,
        [bool]$ForceOperation,
        [bool]$SkipDeps,
        [int]$TimeoutSeconds
    )
    
    $results = @{
        Operation = $OperationType
        StartTime = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        TotalPackages = $Packages.Count
        Successful = 0
        Failed = 0
        Skipped = 0
        PackageResults = @()
        Summary = @{}
    }
    
    Write-ProgressOutput -Message "Starting $OperationType operation" -PercentComplete 0
    
    for ($i = 0; $i -lt $Packages.Count; $i++) {
        $package = $Packages[$i]
        $packageName = if ($package -is [hashtable]) { $package.Name } else { $package }
        $percentComplete = [math]::Round(($i / $Packages.Count) * 100)
        
        Write-ProgressOutput -Message "Processing $packageName" -PercentComplete $percentComplete -CurrentItem $packageName
        
        $packageResult = @{
            PackageName = $packageName
            Operation = $OperationType
            Success = $false
            Message = ""
            Duration = 0
            ExitCode = 0
        }
        
        try {
            switch ($OperationType) {
                'Install' {
                    $result = Install-SinglePackage -PackageName $packageName -ForceInstall $ForceOperation -SkipDeps $SkipDeps -TimeoutSeconds $TimeoutSeconds
                }
                'Update' {
                    $result = Update-SinglePackage -PackageName $packageName -ForceUpdate $ForceOperation -TimeoutSeconds $TimeoutSeconds
                }
                'Remove' {
                    $result = Remove-SinglePackage -PackageName $packageName -ForceRemove $ForceOperation -TimeoutSeconds $TimeoutSeconds
                }
                'Reinstall' {
                    # First remove, then install
                    $removeResult = Remove-SinglePackage -PackageName $packageName -ForceRemove $true -TimeoutSeconds $TimeoutSeconds
                    if ($removeResult.Success -or $removeResult.ExitCode -eq 1615) { # 1615 = package not installed
                        $result = Install-SinglePackage -PackageName $packageName -ForceInstall $true -SkipDeps $SkipDeps -TimeoutSeconds $TimeoutSeconds
                    } else {
                        $result = $removeResult
                    }
                }
            }
            
            $packageResult.Success = $result.Success
            $packageResult.Duration = $result.Duration
            $packageResult.ExitCode = $result.ExitCode
            
            if ($result.Success) {
                $packageResult.Message = "$OperationType completed successfully"
                $results.Successful++
            } else {
                $packageResult.Message = $result.Error
                $results.Failed++
            }
        }
        catch {
            $packageResult.Message = "Exception: $($_.Exception.Message)"
            $results.Failed++
        }
        
        $results.PackageResults += $packageResult
    }
    
    Write-ProgressOutput -Message "Operation completed" -PercentComplete 100
    
    $results.EndTime = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $results.Summary = @{
        SuccessRate = if ($results.TotalPackages -gt 0) { [math]::Round(($results.Successful / $results.TotalPackages) * 100, 2) } else { 0 }
        TotalDuration = ($results.PackageResults | Measure-Object -Property Duration -Sum).Sum
        AverageDuration = if ($results.TotalPackages -gt 0) { [math]::Round(($results.PackageResults | Measure-Object -Property Duration -Average).Average, 2) } else { 0 }
    }
    
    return $results
}

# Main execution
try {
    # Check if Chocolatey is available
    if (-not (Test-ChocolateyAvailable)) {
        $result = @{
            Success = $false
            Error = "Chocolatey is not installed or not responding"
            Operation = $Operation
        }
        Write-JsonOutput $result
        exit 1
    }
    
    # Determine package list
    $packagesToProcess = @()
    
    if ($PackageList) {
        $packagesToProcess = $PackageList
    }
    elseif ($PackagesFile) {
        try {
            $filePackages = Get-PackagesFromFile -FilePath $PackagesFile
            $packagesToProcess = $filePackages | ForEach-Object { $_.Name }
        }
        catch {
            $result = @{
                Success = $false
                Error = $_.Exception.Message
                Operation = $Operation
            }
            Write-JsonOutput $result
            exit 1
        }
    }
    else {
        # Default to packages.txt in script directory
        $scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
        $defaultPackagesFile = Join-Path $scriptPath "packages.txt"
        
        if (Test-Path $defaultPackagesFile) {
            try {
                $filePackages = Get-PackagesFromFile -FilePath $defaultPackagesFile
                $packagesToProcess = $filePackages | ForEach-Object { $_.Name }
            }
            catch {
                $result = @{
                    Success = $false
                    Error = $_.Exception.Message
                    Operation = $Operation
                }
                Write-JsonOutput $result
                exit 1
            }
        }
        else {
            $result = @{
                Success = $false
                Error = "No package list provided and no default packages.txt found"
                Operation = $Operation
            }
            Write-JsonOutput $result
            exit 1
        }
    }
    
    if ($packagesToProcess.Count -eq 0) {
        $result = @{
            Success = $false
            Error = "No packages to process"
            Operation = $Operation
        }
        Write-JsonOutput $result
        exit 1
    }
    
    # Process packages
    $operationResults = Process-PackageOperation -Packages $packagesToProcess -OperationType $Operation -ForceOperation $Force.IsPresent -SkipDeps $SkipDependencies.IsPresent -TimeoutSeconds $Timeout
    
    # Output final results
    $finalResult = @{
        Success = $operationResults.Successful -gt 0
        Results = $operationResults
    }
    
    Write-JsonOutput $finalResult
    
    if ($operationResults.Failed -eq 0) {
        exit 0
    } elseif ($operationResults.Successful -gt 0) {
        exit 1  # Partial success
    } else {
        exit 2  # Complete failure
    }
}
catch {
    $result = @{
        Success = $false
        Error = "Unexpected error: $($_.Exception.Message)"
        Operation = $Operation
    }
    Write-JsonOutput $result
    exit 2
}
