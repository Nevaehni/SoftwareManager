# Core Common Module for Software Manager
# Contains shared functionality, logging, and configuration management

function New-SoftwareManagerConfig {
    <#
    .SYNOPSIS
        Creates a new configuration object for Software Manager
    #>
    param(
        [Parameter(Mandatory=$true)]
        [string]$ScriptPath
    )
      $config = @{
        ScriptPath = $ScriptPath
        PackagesFile = Join-Path $ScriptPath "packages.txt"
        CurrentPackagesFile = Join-Path $ScriptPath "packages_current.txt"
        ConfigsDir = Join-Path $ScriptPath "configs"
        ConfigsZip = Join-Path $ScriptPath "configs.zip"
        LogFile = Join-Path $ScriptPath "install-log.txt"
        ConfigMappingsFile = Join-Path $ScriptPath "ConfigMappings.ps1"
        ExitCode = 0
        WarningCount = 0
        ErrorCount = 0
        ConfigMappings = @{}
    }
    
    return $config
}

function Initialize-ConfigMappings {
    <#
    .SYNOPSIS
        Loads configuration mappings from external file
    #>
    param(
        [Parameter(Mandatory=$true)]
        [hashtable]$Config
    )
      try {
        if (Test-Path $Config.ConfigMappingsFile) {
            $Config.ConfigMappings = & $Config.ConfigMappingsFile
            Write-Verbose "Loaded configuration mappings from ConfigMappings.ps1"
        }
        else {
            Write-Warning "ConfigMappings.ps1 file not found. No application configurations will be backed up."
            $Config.ConfigMappings = @{}
        }
    }
    catch {
        Write-Error "Failed to load ConfigMappings.ps1: $_"
        $Config.ConfigMappings = @{}
    }
}

function Write-SoftwareManagerLog {
    <#
    .SYNOPSIS
        Writes log messages with timestamp and level
    #>
    param(
        [Parameter(Mandatory=$true)]
        [hashtable]$Config,
        
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
            $Config.WarningCount++
        }
        'Error' { 
            Write-Host $logEntry -ForegroundColor Red
            $Config.ErrorCount++
        }
    }
    
    # Write to log file
    try {
        Add-Content -Path $Config.LogFile -Value $logEntry -ErrorAction Stop
    }
    catch {
        Write-Host "Failed to write to log file: $_" -ForegroundColor Red
    }
}

function Get-PackageList {
    <#
    .SYNOPSIS
        Reads and returns the list of packages from packages.txt
    #>
    param(
        [Parameter(Mandatory=$true)]
        [hashtable]$Config
    )
    
    if (-not (Test-Path $Config.PackagesFile)) {
        Write-SoftwareManagerLog -Config $Config -Message "packages.txt file not found in script directory" -Level Error
        return $null
    }
    
    try {
        $packages = Get-Content $Config.PackagesFile | Where-Object { $_.Trim() -ne "" -and -not $_.StartsWith("#") }
        Write-SoftwareManagerLog -Config $Config -Message "Loaded $($packages.Count) packages from packages.txt"
        return $packages
    }
    catch {
        Write-SoftwareManagerLog -Config $Config -Message "Failed to read packages.txt: $_" -Level Error
        return $null
    }
}

function Set-FinalExitCode {
    <#
    .SYNOPSIS
        Sets the final exit code based on errors and warnings
    #>
    param(
        [Parameter(Mandatory=$true)]
        [hashtable]$Config
    )
    
    if ($Config.ErrorCount -gt 0) {
        $Config.ExitCode = 2
    }
    elseif ($Config.WarningCount -gt 0 -and $Config.ExitCode -eq 0) {
        $Config.ExitCode = 1
    }
    
    Write-SoftwareManagerLog -Config $Config -Message "Script completed with exit code: $($Config.ExitCode) (Errors: $($Config.ErrorCount), Warnings: $($Config.WarningCount))"
}

# Export functions
Export-ModuleMember -Function @(
    'New-SoftwareManagerConfig',
    'Initialize-ConfigMappings', 
    'Write-SoftwareManagerLog',
    'Get-PackageList',
    'Set-FinalExitCode'
)
