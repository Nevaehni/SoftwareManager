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
    Version: 3.0 (Modular Architecture)
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

# Import all required modules
$ModulesPath = Join-Path $PSScriptRoot "Modules"

try {
    Import-Module "$ModulesPath\Core\Common.psm1" -Force
    Import-Module "$ModulesPath\System\Prerequisites.psm1" -Force
    Import-Module "$ModulesPath\Package\PackageManager.psm1" -Force
    Import-Module "$ModulesPath\Config\ConfigManager.psm1" -Force
    Import-Module "$ModulesPath\UI\Menu.psm1" -Force
    Import-Module "$ModulesPath\Modes\ExportMode.psm1" -Force
    Import-Module "$ModulesPath\Modes\BackupMode.psm1" -Force
    Import-Module "$ModulesPath\Modes\InstallMode.psm1" -Force
}
catch {
    Write-Host "Failed to import required modules: $_" -ForegroundColor Red
    Write-Host "Please ensure all module files are present in the Modules directory." -ForegroundColor Yellow
    exit 2
}

function Test-RequiredFiles {
    <#
    .SYNOPSIS
        Tests if required files exist for the specified mode
    #>
    param(
        [Parameter(Mandatory=$true)]
        [hashtable]$Config,
        
        [Parameter(Mandatory=$true)]
        [string]$Mode
    )
    
    # Check if required files exist (packages.txt not required for Export mode)
    if ($Mode -ne 'Export' -and -not (Test-Path $Config.PackagesFile)) {
        Write-Host "packages.txt file not found in script directory: $($Config.ScriptPath)" -ForegroundColor Red
        Write-SoftwareManagerLog -Config $Config -Message "packages.txt file not found" -Level Error
        return $false
    }
    
    if ($Mode -ne 'Export' -and -not (Test-Path $Config.ConfigMappingsFile)) {
        Write-Host "ConfigMappings.ps1 file not found in script directory: $($Config.ScriptPath)" -ForegroundColor Red
        Write-SoftwareManagerLog -Config $Config -Message "ConfigMappings.ps1 file not found" -Level Error
        return $false
    }
    
    return $true
}

function Main {
    <#
    .SYNOPSIS
        Main execution function for Software Manager
    #>
    
    # Initialize configuration - use script root instead of MyInvocation
    $Config = New-SoftwareManagerConfig -ScriptPath $PSScriptRoot
      # Initialize log file
    Write-SoftwareManagerLog -Config $Config -Message "Software Manager started (Modular Version 3.0)"
    Write-SoftwareManagerLog -Config $Config -Message "Script path: $($Config.ScriptPath)"
    
    # Test system prerequisites
    if (-not (Test-SystemPrerequisites -Config $Config)) {
        exit 2
    }
    
    # Determine mode from user input or menu
    $IsInteractive = -not $Mode
    $ForceValue = $Force.IsPresent
    $Mode = Get-UserModeChoice -Mode $Mode -Force ([ref]$ForceValue)
    
    if (-not $Mode) {
        Write-SoftwareManagerLog -Config $Config -Message "Invalid menu choice or no mode specified" -Level Error
        exit 2
    }
    
    # Test required files
    if (-not (Test-RequiredFiles -Config $Config -Mode $Mode)) {
        exit 2
    }
    
    # Load configuration mappings (only needed for non-Export modes)
    if ($Mode -ne 'Export') {
        Initialize-ConfigMappings -Config $Config
    }
    
    # Execute selected mode
    switch ($Mode) {
        'Export' { 
            Start-ExportMode -Config $Config
        }
        'Backup' { 
            Start-BackupMode -Config $Config
        }
        'Install' { 
            Start-InstallMode -Config $Config -Force $ForceValue
        }
    }
    
    # Set final exit code
    Set-FinalExitCode -Config $Config
    
    # Show pause prompt in interactive mode
    Show-PausePrompt -IsInteractive $IsInteractive
    
    exit $Config.ExitCode
}

# Run main function
Main
