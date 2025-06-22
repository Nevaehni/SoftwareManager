# GUI Module for Software Manager
# Contains Windows Forms-based user interface components

# Add required assemblies
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# Import additional GUI modules
Import-Module "$PSScriptRoot\GUIControls.psm1" -Force
Import-Module "$PSScriptRoot\GUIEvents.psm1" -Force

# Global variables for GUI state
$script:CurrentConfig = $null
$script:PackageList = @()
$script:ConfigMappings = @{}
$script:CurrentOperation = $null
$script:OperationRunspace = $null

function New-SoftwareManagerMainForm {
    <#
    .SYNOPSIS
        Creates the main form for Software Manager GUI
    #>
    param(
        [Parameter(Mandatory=$true)]
        [hashtable]$Config
    )
    
    $script:CurrentConfig = $Config
    
    # Create main form
    $form = New-Object System.Windows.Forms.Form
    $form.Text = "Software Manager v3.0 - GUI Edition"
    $form.Size = New-Object System.Drawing.Size(1000, 700)
    $form.StartPosition = "CenterScreen"
    $form.MinimumSize = New-Object System.Drawing.Size(800, 600)
    $form.Icon = [System.Drawing.SystemIcons]::Application
      # Create menu bar
    $menuStrip = New-SoftwareManagerMenuStrip
    $form.Controls.Add($menuStrip)
    $form.MainMenuStrip = $menuStrip
    
    # Create status bar
    $statusBar = New-SoftwareManagerStatusBar
    $form.Controls.Add($statusBar)
    
    # Create main tab control
    $tabControl = New-SoftwareManagerTabControl
    $tabControl.Dock = [System.Windows.Forms.DockStyle]::Fill
    $form.Controls.Add($tabControl)
    
    # Load initial data
    Initialize-GUIData
    
    # Set up form event handlers
    $form.add_FormClosing({
        param($sender, $e)
        if ($script:CurrentOperation) {
            $result = [System.Windows.Forms.MessageBox]::Show(
                "An operation is currently running. Do you want to cancel it and exit?",
                "Software Manager",
                [System.Windows.Forms.MessageBoxButtons]::YesNo,
                [System.Windows.Forms.MessageBoxIcon]::Question
            )
            if ($result -eq [System.Windows.Forms.DialogResult]::No) {
                $e.Cancel = $true
                return
            }
            Stop-CurrentOperation
        }
    })
    
    return $form
}

function New-SoftwareManagerMenuStrip {
    <#
    .SYNOPSIS
        Creates the menu strip for the main form
    #>
    
    $menuStrip = New-Object System.Windows.Forms.MenuStrip
    
    # File menu
    $fileMenu = New-Object System.Windows.Forms.ToolStripMenuItem
    $fileMenu.Text = "&File"
    
    $refreshItem = New-Object System.Windows.Forms.ToolStripMenuItem
    $refreshItem.Text = "&Refresh Data"
    $refreshItem.ShortcutKeys = [System.Windows.Forms.Keys]::F5
    $refreshItem.add_Click({ Initialize-GUIData })
    $fileMenu.DropDownItems.Add($refreshItem)
    
    $fileMenu.DropDownItems.Add((New-Object System.Windows.Forms.ToolStripSeparator))
      $exitItem = New-Object System.Windows.Forms.ToolStripMenuItem
    $exitItem.Text = "E&xit"
    $exitItem.add_Click({ 
        $parentForm = $menuStrip.FindForm()
        if ($parentForm) { $parentForm.Close() }
    })
    $fileMenu.DropDownItems.Add($exitItem)
    
    # Tools menu
    $toolsMenu = New-Object System.Windows.Forms.ToolStripMenuItem
    $toolsMenu.Text = "&Tools"
    
    $validateItem = New-Object System.Windows.Forms.ToolStripMenuItem
    $validateItem.Text = "&Validate Configuration"
    $validateItem.add_Click({ Start-ConfigurationValidation })
    $toolsMenu.DropDownItems.Add($validateItem)
    
    $wingetSearchItem = New-Object System.Windows.Forms.ToolStripMenuItem
    $wingetSearchItem.Text = "&Search Winget Packages"
    $wingetSearchItem.add_Click({ Show-WingetSearchDialog })
    $toolsMenu.DropDownItems.Add($wingetSearchItem)
    
    # Help menu
    $helpMenu = New-Object System.Windows.Forms.ToolStripMenuItem
    $helpMenu.Text = "&Help"
    
    $aboutItem = New-Object System.Windows.Forms.ToolStripMenuItem
    $aboutItem.Text = "&About"
    $aboutItem.add_Click({ Show-AboutDialog })
    $helpMenu.DropDownItems.Add($aboutItem)
    
    $menuStrip.Items.Add($fileMenu)
    $menuStrip.Items.Add($toolsMenu)
    $menuStrip.Items.Add($helpMenu)
    
    return $menuStrip
}

function New-SoftwareManagerStatusBar {
    <#
    .SYNOPSIS
        Creates the status bar for the main form
    #>
    
    $statusStrip = New-Object System.Windows.Forms.StatusStrip
    
    $script:StatusLabel = New-Object System.Windows.Forms.ToolStripStatusLabel
    $script:StatusLabel.Text = "Ready"
    $script:StatusLabel.Spring = $true
    $script:StatusLabel.TextAlign = [System.Drawing.ContentAlignment]::MiddleLeft
    
    $script:ProgressBar = New-Object System.Windows.Forms.ToolStripProgressBar
    $script:ProgressBar.Visible = $false
    
    $statusStrip.Items.Add($script:StatusLabel)
    $statusStrip.Items.Add($script:ProgressBar)
    
    return $statusStrip
}

function New-SoftwareManagerTabControl {
    <#
    .SYNOPSIS
        Creates the main tab control with all application tabs
    #>
    
    $tabControl = New-Object System.Windows.Forms.TabControl
    $tabControl.Multiline = $false
    
    # Packages tab
    $packagesTab = New-Object System.Windows.Forms.TabPage
    $packagesTab.Text = "Packages"
    $packagesTab.Controls.Add((New-PackagesTabContent))
    $tabControl.TabPages.Add($packagesTab)
    
    # Config Mappings tab
    $configTab = New-Object System.Windows.Forms.TabPage
    $configTab.Text = "Config Mappings"
    $configTab.Controls.Add((New-ConfigMappingsTabContent))
    $tabControl.TabPages.Add($configTab)
    
    # Operations tab
    $operationsTab = New-Object System.Windows.Forms.TabPage
    $operationsTab.Text = "Operations"
    $operationsTab.Controls.Add((New-OperationsTabContent))
    $tabControl.TabPages.Add($operationsTab)
    
    # Logs tab
    $logsTab = New-Object System.Windows.Forms.TabPage
    $logsTab.Text = "Logs"
    $logsTab.Controls.Add((New-LogsTabContent))
    $tabControl.TabPages.Add($logsTab)
    
    return $tabControl
}

function Initialize-GUIData {
    <#
    .SYNOPSIS
        Initializes GUI data by loading packages and config mappings
    #>
    
    Update-StatusBar -Text "Loading data..."
    
    try {
        # Load packages from packages.txt
        $script:PackageList = @()
        if (Test-Path $script:CurrentConfig.PackagesFile) {
            $packages = Get-Content $script:CurrentConfig.PackagesFile | Where-Object { $_.Trim() -ne "" }
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
        if (Test-Path $script:CurrentConfig.ConfigMappingsFile) {
            try {
                . $script:CurrentConfig.ConfigMappingsFile
                $script:ConfigMappings = $ConfigMappings
            }
            catch {
                Write-SoftwareManagerLog -Config $script:CurrentConfig -Message "Error loading config mappings: $_" -Level Error
            }
        }
        
        # Refresh all GUI controls
        Refresh-PackagesGrid
        Refresh-ConfigMappingsTree
        
        Update-StatusBar -Text "Ready"
    }
    catch {
        Write-SoftwareManagerLog -Config $script:CurrentConfig -Message "Error initializing GUI data: $_" -Level Error
        Update-StatusBar -Text "Error loading data"
    }
}

function Update-StatusBar {
    <#
    .SYNOPSIS
        Updates the status bar text and progress
    #>
    param(
        [string]$Text,
        [int]$Progress = -1,
        [bool]$ShowProgress = $false
    )
    
    if ($script:StatusLabel) {
        $script:StatusLabel.Text = $Text
    }
    
    if ($script:ProgressBar) {
        $script:ProgressBar.Visible = $ShowProgress
        if ($Progress -ge 0) {
            $script:ProgressBar.Value = [Math]::Min($Progress, 100)
        }
    }
    
    [System.Windows.Forms.Application]::DoEvents()
}

# Export functions
Export-ModuleMember -Function New-SoftwareManagerMainForm, Update-StatusBar, Initialize-GUIData
