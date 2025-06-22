#Requires -Version 5.1
#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Software Manager GUI - Modular Version

.DESCRIPTION
    A modular GUI for the Software Manager application.
    This version uses a clean modular architecture for better maintainability.

.NOTES
    Author: GitHub Copilot
    Version: 2.0
    Requires: PowerShell 5.1+, Administrator privileges, Windows Package Manager (Winget)
#>

[CmdletBinding()]
param()

# Add required assemblies for Windows Forms
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName Microsoft.VisualBasic

# Initialize Windows Forms settings before any forms are created
[System.Windows.Forms.Application]::EnableVisualStyles()
[System.Windows.Forms.Application]::SetCompatibleTextRenderingDefault($false)

# Import all required modules
$ModulesPath = Join-Path $PSScriptRoot "Modules"

try {
    # Core modules
    Import-Module "$ModulesPath\Core\Common.psm1" -Force
    Import-Module "$ModulesPath\System\Prerequisites.psm1" -Force
    Import-Module "$ModulesPath\Package\PackageManager.psm1" -Force
    Import-Module "$ModulesPath\Config\ConfigManager.psm1" -Force
    Import-Module "$ModulesPath\Modes\ExportMode.psm1" -Force
    Import-Module "$ModulesPath\Modes\BackupMode.psm1" -Force
    Import-Module "$ModulesPath\Modes\InstallMode.psm1" -Force
    
    # UI modules
    Import-Module "$ModulesPath\UI\GUIData.psm1" -Force
    Import-Module "$ModulesPath\UI\GUIDialogs.psm1" -Force
    Import-Module "$ModulesPath\UI\GUIPackages.psm1" -Force
    Import-Module "$ModulesPath\UI\GUIConfig.psm1" -Force
    Import-Module "$ModulesPath\UI\GUIOperations.psm1" -Force
}
catch {
    Write-Host "Failed to import required modules: $_" -ForegroundColor Red
    Write-Host "Please ensure all module files are present in the Modules directory." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 2
}

# Global variables
$script:Config = $null

function Create-MainForm {
    <#
    .SYNOPSIS
        Creates the main GUI form using modular components
    #>
    
    # Create main form
    $form = New-Object System.Windows.Forms.Form
    $form.Text = "Software Manager v3.0 - Modular GUI Edition"
    $form.Size = New-Object System.Drawing.Size(900, 700)
    $form.StartPosition = "CenterScreen"
    $form.MinimumSize = New-Object System.Drawing.Size(800, 600)
    
    # Create tab control
    $tabControl = New-Object System.Windows.Forms.TabControl
    $tabControl.Dock = [System.Windows.Forms.DockStyle]::Fill
    
    # Create tabs using modules
    $packagesTab = New-PackagesTab
    $configTab = New-ConfigTab
    $operationsTab = New-OperationsTab -Config $script:Config
    
    # Add tabs to tab control
    $tabControl.TabPages.Add($packagesTab)
    $tabControl.TabPages.Add($configTab)
    $tabControl.TabPages.Add($operationsTab)
    
    # Status bar
    $statusStrip = New-Object System.Windows.Forms.StatusStrip
    $statusLabel = New-Object System.Windows.Forms.ToolStripStatusLabel
    $statusLabel.Text = "Ready"
    $statusLabel.Spring = $true
    [void]$statusStrip.Items.Add($statusLabel)
    
    # Set status label reference for operations module
    Set-StatusLabel -StatusLabel $statusLabel
    
    # Add controls to form
    $form.Controls.Add($tabControl)
    $form.Controls.Add($statusStrip)
    
    return $form
}

function Start-SoftwareManagerGUI {
    <#
    .SYNOPSIS
        Main function to start the modular GUI
    #>
    
    try {
        # Initialize configuration
        $script:Config = New-SoftwareManagerConfig -ScriptPath $PSScriptRoot
        Write-SoftwareManagerLog -Config $script:Config -Message "Software Manager GUI started (Modular Version 2.0)"
        
        # Test system prerequisites
        if (-not (Test-SystemPrerequisites -Config $script:Config)) {
            [System.Windows.Forms.MessageBox]::Show("System prerequisites check failed. Please check the log for details.", "Software Manager GUI", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Error)
            return
        }
        
        # Initialize GUI data
        if (-not (Initialize-GUIData -Config $script:Config)) {
            [System.Windows.Forms.MessageBox]::Show("Failed to initialize GUI data. Please check the log for details.", "Software Manager GUI", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Error)
            return
        }
        
        # Create and show the main form
        $mainForm = Create-MainForm
        
        # Load initial data into UI components
        Refresh-PackagesGrid
        Refresh-ConfigList
        
        # Show the form
        $mainForm.add_Shown({ $mainForm.Activate() })
        [void]$mainForm.ShowDialog()
    }
    catch {
        Write-SoftwareManagerLog -Config $script:Config -Message "GUI Error: $_" -Level Error
        [System.Windows.Forms.MessageBox]::Show("An error occurred while running the GUI: $_", "Software Manager GUI", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Error)
    }
}

# Start the application
Start-SoftwareManagerGUI
