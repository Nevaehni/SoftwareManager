# GUI Config Module for Software Manager
# Handles config mapping UI components

function New-ConfigTab {
    <#
    .SYNOPSIS
        Creates the config mappings tab with all its controls
    #>
      $configTab = New-Object System.Windows.Forms.TabPage
    $configTab.Text = "Config Mappings"

    $configPanel = New-Object System.Windows.Forms.Panel
    $configPanel.Dock = [System.Windows.Forms.DockStyle]::Fill
    $configPanel.Padding = New-Object System.Windows.Forms.Padding(20)
    $configPanel.BackColor = [System.Drawing.ColorTranslator]::FromHtml('#f7f9fa')

    # Create header panel with gradient-like effect
    $headerPanel = New-Object System.Windows.Forms.Panel
    $headerPanel.Height = 50
    $headerPanel.Dock = [System.Windows.Forms.DockStyle]::Top
    $headerPanel.BackColor = [System.Drawing.ColorTranslator]::FromHtml('#e8f2ff')
    $headerPanel.Padding = New-Object System.Windows.Forms.Padding(15, 10, 15, 10)

    $configLabel = New-Object System.Windows.Forms.Label
    $configLabel.Text = "📋 Configuration Mappings"
    $configLabel.Dock = [System.Windows.Forms.DockStyle]::Fill
    $configLabel.Font = New-Object System.Drawing.Font("Segoe UI", 12, [System.Drawing.FontStyle]::Bold)
    $configLabel.ForeColor = [System.Drawing.Color]::FromArgb(25, 60, 115)
    $configLabel.TextAlign = [System.Drawing.ContentAlignment]::MiddleLeft

    $headerPanel.Controls.Add($configLabel)

    # Create splitter for config mappings with improved styling
    $configSplitter = New-Object System.Windows.Forms.SplitContainer
    $configSplitter.Dock = [System.Windows.Forms.DockStyle]::Fill
    $configSplitter.SplitterDistance = 350
    $configSplitter.SplitterWidth = 8
    $configSplitter.BackColor = [System.Drawing.ColorTranslator]::FromHtml('#d0d7de')

    # Left panel - Package list with enhanced design
    $leftConfigPanel = New-Object System.Windows.Forms.Panel
    $leftConfigPanel.Dock = [System.Windows.Forms.DockStyle]::Fill
    $leftConfigPanel.BackColor = [System.Drawing.ColorTranslator]::FromHtml('#ffffff')
    $leftConfigPanel.Padding = New-Object System.Windows.Forms.Padding(1)

    # Left panel inner container for border effect
    $leftInnerPanel = New-Object System.Windows.Forms.Panel
    $leftInnerPanel.Dock = [System.Windows.Forms.DockStyle]::Fill
    $leftInnerPanel.BackColor = [System.Drawing.ColorTranslator]::FromHtml('#f8fafc')

    # Enhanced button panel with better styling
    $configButtonPanel = New-Object System.Windows.Forms.Panel
    $configButtonPanel.Height = 50
    $configButtonPanel.Dock = [System.Windows.Forms.DockStyle]::Top
    $configButtonPanel.BackColor = [System.Drawing.ColorTranslator]::FromHtml('#e8f2ff')
    $configButtonPanel.Padding = New-Object System.Windows.Forms.Padding(10, 10, 10, 10)

    # Modern styled buttons with improved appearance
    $editConfigBtn = New-Object System.Windows.Forms.Button
    $editConfigBtn.Text = "📝 Edit Config File"
    $editConfigBtn.Location = New-Object System.Drawing.Point(0, 0)
    $editConfigBtn.Size = New-Object System.Drawing.Size(115, 32)
    $editConfigBtn.Font = New-Object System.Drawing.Font("Segoe UI", 9)
    $editConfigBtn.BackColor = [System.Drawing.ColorTranslator]::FromHtml('#ffffff')
    $editConfigBtn.FlatStyle = 'Flat'
    $editConfigBtn.FlatAppearance.BorderSize = 1
    $editConfigBtn.FlatAppearance.BorderColor = [System.Drawing.ColorTranslator]::FromHtml('#d1d9e0')
    $editConfigBtn.ForeColor = [System.Drawing.Color]::FromArgb(45, 55, 72)
    $editConfigBtn.Cursor = [System.Windows.Forms.Cursors]::Hand
    $editConfigBtn.add_Click({ Open-ConfigMappingsFile })

    $addMappingBtn = New-Object System.Windows.Forms.Button
    $addMappingBtn.Text = "➕ Add Mapping"
    $addMappingBtn.Location = New-Object System.Drawing.Point(120, 0)
    $addMappingBtn.Size = New-Object System.Drawing.Size(115, 32)
    $addMappingBtn.Font = New-Object System.Drawing.Font("Segoe UI", 9)
    $addMappingBtn.BackColor = [System.Drawing.ColorTranslator]::FromHtml('#ffffff')
    $addMappingBtn.FlatStyle = 'Flat'
    $addMappingBtn.FlatAppearance.BorderSize = 1
    $addMappingBtn.FlatAppearance.BorderColor = [System.Drawing.ColorTranslator]::FromHtml('#d1d9e0')
    $addMappingBtn.ForeColor = [System.Drawing.Color]::FromArgb(45, 55, 72)
    $addMappingBtn.Cursor = [System.Windows.Forms.Cursors]::Hand
    $addMappingBtn.add_Click({ Add-NewConfigMapping })

    $refreshConfigBtn = New-Object System.Windows.Forms.Button
    $refreshConfigBtn.Text = "🔄 Refresh"
    $refreshConfigBtn.Location = New-Object System.Drawing.Point(240, 0)
    $refreshConfigBtn.Size = New-Object System.Drawing.Size(95, 32)
    $refreshConfigBtn.Font = New-Object System.Drawing.Font("Segoe UI", 9)
    $refreshConfigBtn.BackColor = [System.Drawing.ColorTranslator]::FromHtml('#ffffff')
    $refreshConfigBtn.FlatStyle = 'Flat'
    $refreshConfigBtn.FlatAppearance.BorderSize = 1
    $refreshConfigBtn.FlatAppearance.BorderColor = [System.Drawing.ColorTranslator]::FromHtml('#d1d9e0')
    $refreshConfigBtn.ForeColor = [System.Drawing.Color]::FromArgb(45, 55, 72)
    $refreshConfigBtn.Cursor = [System.Windows.Forms.Cursors]::Hand
    $refreshConfigBtn.add_Click({ 
        Refresh-ConfigData
        [System.Windows.Forms.MessageBox]::Show(
            "Configuration mappings refreshed from file.",
            "Refresh Complete",
            [System.Windows.Forms.MessageBoxButtons]::OK,
            [System.Windows.Forms.MessageBoxIcon]::Information        )
    })

    $configButtonPanel.Controls.Add($editConfigBtn)
    $configButtonPanel.Controls.Add($addMappingBtn)
    $configButtonPanel.Controls.Add($refreshConfigBtn)

    # Add hover effects for buttons
    $editConfigBtn.add_MouseEnter({
        $this.BackColor = [System.Drawing.ColorTranslator]::FromHtml('#f0f9ff')
        $this.FlatAppearance.BorderColor = [System.Drawing.ColorTranslator]::FromHtml('#0ea5e9')
    })
    $editConfigBtn.add_MouseLeave({
        $this.BackColor = [System.Drawing.ColorTranslator]::FromHtml('#ffffff')
        $this.FlatAppearance.BorderColor = [System.Drawing.ColorTranslator]::FromHtml('#d1d9e0')
    })

    $addMappingBtn.add_MouseEnter({
        $this.BackColor = [System.Drawing.ColorTranslator]::FromHtml('#f0f9ff')
        $this.FlatAppearance.BorderColor = [System.Drawing.ColorTranslator]::FromHtml('#0ea5e9')
    })
    $addMappingBtn.add_MouseLeave({
        $this.BackColor = [System.Drawing.ColorTranslator]::FromHtml('#ffffff')
        $this.FlatAppearance.BorderColor = [System.Drawing.ColorTranslator]::FromHtml('#d1d9e0')
    })

    $refreshConfigBtn.add_MouseEnter({
        $this.BackColor = [System.Drawing.ColorTranslator]::FromHtml('#f0f9ff')
        $this.FlatAppearance.BorderColor = [System.Drawing.ColorTranslator]::FromHtml('#0ea5e9')
    })
    $refreshConfigBtn.add_MouseLeave({
        $this.BackColor = [System.Drawing.ColorTranslator]::FromHtml('#ffffff')
        $this.FlatAppearance.BorderColor = [System.Drawing.ColorTranslator]::FromHtml('#d1d9e0')    })

    # Enhanced list header
    $listHeaderPanel = New-Object System.Windows.Forms.Panel
    $listHeaderPanel.Height = 30
    $listHeaderPanel.Dock = [System.Windows.Forms.DockStyle]::Top
    $listHeaderPanel.BackColor = [System.Drawing.ColorTranslator]::FromHtml('#f1f5f9')

    $listHeaderLabel = New-Object System.Windows.Forms.Label
    $listHeaderLabel.Text = "📦 Package Configurations"
    $listHeaderLabel.Dock = [System.Windows.Forms.DockStyle]::Fill
    $listHeaderLabel.Font = New-Object System.Drawing.Font("Segoe UI", 9, [System.Drawing.FontStyle]::Bold)
    $listHeaderLabel.ForeColor = [System.Drawing.Color]::FromArgb(55, 65, 81)
    $listHeaderLabel.TextAlign = [System.Drawing.ContentAlignment]::MiddleLeft
    $listHeaderLabel.Padding = New-Object System.Windows.Forms.Padding(10, 0, 0, 0)

    $listHeaderPanel.Controls.Add($listHeaderLabel)

    # Enhanced list box with modern styling
    $script:ConfigListBox = New-Object System.Windows.Forms.ListBox
    $script:ConfigListBox.Dock = [System.Windows.Forms.DockStyle]::Fill
    $script:ConfigListBox.Font = New-Object System.Drawing.Font("Segoe UI", 10)
    $script:ConfigListBox.BackColor = [System.Drawing.ColorTranslator]::FromHtml('#ffffff')
    $script:ConfigListBox.ForeColor = [System.Drawing.Color]::FromArgb(45, 55, 72)
    $script:ConfigListBox.BorderStyle = [System.Windows.Forms.BorderStyle]::None
    $script:ConfigListBox.ItemHeight = 24
    $script:ConfigListBox.add_SelectedIndexChanged({ Show-ConfigMappingDetails })
    $script:ConfigListBox.add_DoubleClick({ Edit-SelectedConfigMapping })

    $leftInnerPanel.Controls.Add($script:ConfigListBox)
    $leftInnerPanel.Controls.Add($listHeaderPanel)
    $leftInnerPanel.Controls.Add($configButtonPanel)
    
    $leftConfigPanel.Controls.Add($leftInnerPanel)

    # Right panel - Enhanced config details
    $rightConfigPanel = New-Object System.Windows.Forms.Panel
    $rightConfigPanel.Dock = [System.Windows.Forms.DockStyle]::Fill
    $rightConfigPanel.BackColor = [System.Drawing.ColorTranslator]::FromHtml('#ffffff')
    $rightConfigPanel.Padding = New-Object System.Windows.Forms.Padding(1)

    # Right panel inner container for border effect
    $rightInnerPanel = New-Object System.Windows.Forms.Panel
    $rightInnerPanel.Dock = [System.Windows.Forms.DockStyle]::Fill
    $rightInnerPanel.BackColor = [System.Drawing.ColorTranslator]::FromHtml('#f8fafc')

    # Enhanced details header
    $detailsHeaderPanel = New-Object System.Windows.Forms.Panel
    $detailsHeaderPanel.Height = 50
    $detailsHeaderPanel.Dock = [System.Windows.Forms.DockStyle]::Top
    $detailsHeaderPanel.BackColor = [System.Drawing.ColorTranslator]::FromHtml('#e8f2ff')
    $detailsHeaderPanel.Padding = New-Object System.Windows.Forms.Padding(15, 10, 15, 10)

    $detailsLabel = New-Object System.Windows.Forms.Label
    $detailsLabel.Text = "⚙️ Configuration Details"
    $detailsLabel.Dock = [System.Windows.Forms.DockStyle]::Top
    $detailsLabel.Height = 20
    $detailsLabel.Font = New-Object System.Drawing.Font("Segoe UI", 11, [System.Drawing.FontStyle]::Bold)
    $detailsLabel.ForeColor = [System.Drawing.Color]::FromArgb(25, 60, 115)

    $detailsSubLabel = New-Object System.Windows.Forms.Label
    $detailsSubLabel.Dock = [System.Windows.Forms.DockStyle]::Fill
    $detailsSubLabel.Font = New-Object System.Drawing.Font("Segoe UI", 8)
    $detailsSubLabel.ForeColor = [System.Drawing.Color]::FromArgb(100, 116, 139)

    $detailsHeaderPanel.Controls.Add($detailsSubLabel)
    $detailsHeaderPanel.Controls.Add($detailsLabel)

    # Enhanced text box with better styling
    $script:ConfigDetailsTextBox = New-Object System.Windows.Forms.RichTextBox
    $script:ConfigDetailsTextBox.Dock = [System.Windows.Forms.DockStyle]::Fill
    $script:ConfigDetailsTextBox.ReadOnly = $true
    $script:ConfigDetailsTextBox.Font = New-Object System.Drawing.Font("Consolas", 10)
    $script:ConfigDetailsTextBox.BackColor = [System.Drawing.ColorTranslator]::FromHtml('#ffffff')
    $script:ConfigDetailsTextBox.ForeColor = [System.Drawing.Color]::FromArgb(45, 55, 72)
    $script:ConfigDetailsTextBox.BorderStyle = [System.Windows.Forms.BorderStyle]::None
    $script:ConfigDetailsTextBox.Padding = New-Object System.Windows.Forms.Padding(15)

    $rightInnerPanel.Controls.Add($script:ConfigDetailsTextBox)
    $rightInnerPanel.Controls.Add($detailsHeaderPanel)

    $rightConfigPanel.Controls.Add($rightInnerPanel)

    $configSplitter.Panel1.Controls.Add($leftConfigPanel)
    $configSplitter.Panel2.Controls.Add($rightConfigPanel)

    $configPanel.Controls.Add($configSplitter)
    $configPanel.Controls.Add($headerPanel)
    $configTab.Controls.Add($configPanel)

    return $configTab
}

function Add-NewConfigMapping {
    <#
    .SYNOPSIS
        Shows dialog to add a new config mapping
    #>
    
    $packageId = [Microsoft.VisualBasic.Interaction]::InputBox(
        "Enter Package ID for new config mapping:",
        "Add Config Mapping",
        ""
    )
    
    if ($packageId -and $packageId.Trim() -ne "") {
        $packageId = $packageId.Trim()
        
        $configMappings = Get-ConfigMappings
        if ($configMappings.ContainsKey($packageId)) {
            [System.Windows.Forms.MessageBox]::Show(
                "Config mapping for '$packageId' already exists.",
                "Duplicate Mapping",
                [System.Windows.Forms.MessageBoxButtons]::OK,
                [System.Windows.Forms.MessageBoxIcon]::Warning
            )
            return
        }
        
        Edit-ConfigMapping -PackageId $packageId -IsNew $true
    }
}

function Edit-SelectedConfigMapping {
    <#
    .SYNOPSIS
        Edits the selected config mapping
    #>
    
    if ($script:ConfigListBox.SelectedItem) {
        $packageId = $script:ConfigListBox.SelectedItem.ToString()
        Edit-ConfigMapping -PackageId $packageId -IsNew $false
    }
}

function Edit-ConfigMapping {
    <#
    .SYNOPSIS
        Shows editor for a config mapping
    #>
    param(
        [Parameter(Mandatory=$true)]
        [string]$PackageId,
        [bool]$IsNew = $false
    )
    
    $configMappings = Get-ConfigMappings
    $existingMapping = if (-not $IsNew -and $configMappings.ContainsKey($PackageId)) { 
        $configMappings[$PackageId] 
    } else { 
        @{} 
    }
    
    $result = Show-ConfigMappingEditor -PackageId $PackageId -IsNew $IsNew -ExistingMapping $existingMapping
    
    if ($result) {
        try {
            Add-ConfigMapping -PackageId $result.PackageId -Files $result.Files -Folders $result.Folders -Registry $result.Registry
            Refresh-ConfigList
            
            [System.Windows.Forms.MessageBox]::Show(
                "Config mapping saved successfully.",
                "Success",
                [System.Windows.Forms.MessageBoxButtons]::OK,
                [System.Windows.Forms.MessageBoxIcon]::Information
            )
        }
        catch {
            [System.Windows.Forms.MessageBox]::Show(
                "Error saving config mapping: $_",
                "Error",
                [System.Windows.Forms.MessageBoxButtons]::OK,
                [System.Windows.Forms.MessageBoxIcon]::Error
            )
        }
    }
}

function Open-ConfigMappingsFile {
    <#
    .SYNOPSIS
        Opens the ConfigMappings.ps1 file in the default editor
    #>
    
    try {
        $configFile = (Get-Module GUIData).ModuleBase + "\..\..\ConfigMappings.ps1"
        if (Test-Path $configFile) {
            Start-Process notepad.exe -ArgumentList $configFile
        } else {
            [System.Windows.Forms.MessageBox]::Show(
                "ConfigMappings.ps1 file not found at: $configFile",
                "File Not Found",
                [System.Windows.Forms.MessageBoxButtons]::OK,
                [System.Windows.Forms.MessageBoxIcon]::Warning
            )
        }
    }
    catch {
        [System.Windows.Forms.MessageBox]::Show(
            "Error opening ConfigMappings.ps1: $_",
            "Error",
            [System.Windows.Forms.MessageBoxButtons]::OK,
            [System.Windows.Forms.MessageBoxIcon]::Error
        )
    }
}

function Refresh-ConfigList {
    <#
    .SYNOPSIS
        Refreshes the config mappings list
    #>
    
    if ($script:ConfigListBox) {
        $script:ConfigListBox.Items.Clear()
        $configMappings = Get-ConfigMappings
        foreach ($package in ($configMappings.Keys | Sort-Object)) {
            [void]$script:ConfigListBox.Items.Add($package)
        }
    }
}

function Refresh-ConfigData {
    <#
    .SYNOPSIS
        Refreshes config data from files and updates UI
    #>
    
    # This would trigger a reload of the config mappings
    # Since we can't directly access the config here, we'll refresh the UI
    Refresh-ConfigList
}

function Show-ConfigMappingDetails {
    <#
    .SYNOPSIS
        Shows details of the selected config mapping
    #>
    
    if ($script:ConfigListBox.SelectedItem -and $script:ConfigDetailsTextBox) {
        $packageId = $script:ConfigListBox.SelectedItem.ToString()
        $configMappings = Get-ConfigMappings
          if ($configMappings.ContainsKey($packageId)) {
            $mapping = $configMappings[$packageId]
            $details = @"
📦 Package: $packageId

📁 Configuration Files:
$($mapping.Files | ForEach-Object { "   • $_" } | Out-String)
📂 Configuration Folders:
$($mapping.Folders | ForEach-Object { "   • $_" } | Out-String)
🔧 Registry Keys:
$($mapping.Registry | ForEach-Object { "   • $_" } | Out-String)
🔗 Install URL: $($mapping.InstallUrl)

💡 Tip: Double-click the package name in the list to edit this mapping.
"@
            $script:ConfigDetailsTextBox.Text = $details
        }
    }
}

function Get-ConfigListBox {
    <#
    .SYNOPSIS
        Returns the config list box control
    #>
    return $script:ConfigListBox
}

function Get-ConfigDetailsTextBox {
    <#
    .SYNOPSIS
        Returns the config details text box control
    #>
    return $script:ConfigDetailsTextBox
}

# Export functions
Export-ModuleMember -Function @(
    'New-ConfigTab',
    'Refresh-ConfigList',
    'Get-ConfigListBox',
    'Get-ConfigDetailsTextBox'
)
