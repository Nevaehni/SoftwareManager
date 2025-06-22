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
    $configPanel.Padding = New-Object System.Windows.Forms.Padding(10)
    
    $configLabel = New-Object System.Windows.Forms.Label
    $configLabel.Text = "Packages with Configuration Mappings:"
    $configLabel.Dock = [System.Windows.Forms.DockStyle]::Top
    $configLabel.Height = 25
    
    # Create splitter for config mappings
    $configSplitter = New-Object System.Windows.Forms.SplitContainer
    $configSplitter.Dock = [System.Windows.Forms.DockStyle]::Fill
    $configSplitter.SplitterDistance = 250
    
    # Left panel - Package list with buttons
    $leftConfigPanel = New-Object System.Windows.Forms.Panel
    $leftConfigPanel.Dock = [System.Windows.Forms.DockStyle]::Fill
    
    $configButtonPanel = New-Object System.Windows.Forms.Panel
    $configButtonPanel.Height = 40
    $configButtonPanel.Dock = [System.Windows.Forms.DockStyle]::Top
    
    $editConfigBtn = New-Object System.Windows.Forms.Button
    $editConfigBtn.Text = "Edit Config File"
    $editConfigBtn.Location = New-Object System.Drawing.Point(5, 5)
    $editConfigBtn.Size = New-Object System.Drawing.Size(100, 30)
    $editConfigBtn.add_Click({ Open-ConfigMappingsFile })
    
    $addMappingBtn = New-Object System.Windows.Forms.Button
    $addMappingBtn.Text = "Add Mapping"
    $addMappingBtn.Location = New-Object System.Drawing.Point(110, 5)
    $addMappingBtn.Size = New-Object System.Drawing.Size(90, 30)
    $addMappingBtn.add_Click({ Add-NewConfigMapping })
    
    $refreshConfigBtn = New-Object System.Windows.Forms.Button
    $refreshConfigBtn.Text = "Refresh"
    $refreshConfigBtn.Location = New-Object System.Drawing.Point(205, 5)
    $refreshConfigBtn.Size = New-Object System.Drawing.Size(70, 30)
    $refreshConfigBtn.add_Click({ 
        Refresh-ConfigData
        [System.Windows.Forms.MessageBox]::Show(
            "Configuration mappings refreshed from file.",
            "Refresh Complete",
            [System.Windows.Forms.MessageBoxButtons]::OK,
            [System.Windows.Forms.MessageBoxIcon]::Information
        )
    })
    
    $configButtonPanel.Controls.Add($editConfigBtn)
    $configButtonPanel.Controls.Add($addMappingBtn)
    $configButtonPanel.Controls.Add($refreshConfigBtn)
    
    $script:ConfigListBox = New-Object System.Windows.Forms.ListBox
    $script:ConfigListBox.Dock = [System.Windows.Forms.DockStyle]::Fill
    $script:ConfigListBox.add_SelectedIndexChanged({ Show-ConfigMappingDetails })
    $script:ConfigListBox.add_DoubleClick({ Edit-SelectedConfigMapping })
    
    $leftConfigPanel.Controls.Add($script:ConfigListBox)
    $leftConfigPanel.Controls.Add($configButtonPanel)
    
    # Right panel - Config details
    $rightConfigPanel = New-Object System.Windows.Forms.Panel
    $rightConfigPanel.Dock = [System.Windows.Forms.DockStyle]::Fill
    
    $detailsLabel = New-Object System.Windows.Forms.Label
    $detailsLabel.Text = "Configuration Details (Double-click package to edit):"
    $detailsLabel.Dock = [System.Windows.Forms.DockStyle]::Top
    $detailsLabel.Height = 25
    
    $script:ConfigDetailsTextBox = New-Object System.Windows.Forms.RichTextBox
    $script:ConfigDetailsTextBox.Dock = [System.Windows.Forms.DockStyle]::Fill
    $script:ConfigDetailsTextBox.ReadOnly = $true
    $script:ConfigDetailsTextBox.Font = New-Object System.Drawing.Font("Consolas", 9)
    
    $rightConfigPanel.Controls.Add($script:ConfigDetailsTextBox)
    $rightConfigPanel.Controls.Add($detailsLabel)
    
    $configSplitter.Panel1.Controls.Add($leftConfigPanel)
    $configSplitter.Panel2.Controls.Add($rightConfigPanel)
    
    $configPanel.Controls.Add($configSplitter)
    $configPanel.Controls.Add($configLabel)
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
Package: $packageId

Configuration Files:
$($mapping.Files | ForEach-Object { "  • $_" } | Out-String)

Configuration Folders:
$($mapping.Folders | ForEach-Object { "  • $_" } | Out-String)

Registry Keys:
$($mapping.Registry | ForEach-Object { "  • $_" } | Out-String)

Install URL: $($mapping.InstallUrl)

Note: Double-click the package name to edit this mapping.
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
