# GUI Controls Module for Software Manager
# Contains specific GUI control implementations for each tab

# Packages Tab Controls and Functions
function New-PackagesTabContent {
    <#
    .SYNOPSIS
        Creates the content for the Packages tab
    #>
    
    $panel = New-Object System.Windows.Forms.Panel
    $panel.Dock = [System.Windows.Forms.DockStyle]::Fill
    $panel.Padding = New-Object System.Windows.Forms.Padding(10)
    
    # Create toolbar
    $toolbar = New-Object System.Windows.Forms.ToolStrip
    $toolbar.Dock = [System.Windows.Forms.DockStyle]::Top
    
    $addButton = New-Object System.Windows.Forms.ToolStripButton
    $addButton.Text = "Add Package"
    $addButton.Image = [System.Drawing.SystemIcons]::Information.ToBitmap()
    $addButton.add_Click({ Show-AddPackageDialog })
    
    $removeButton = New-Object System.Windows.Forms.ToolStripButton
    $removeButton.Text = "Remove Package"
    $removeButton.add_Click({ Remove-SelectedPackage })
    
    $importButton = New-Object System.Windows.Forms.ToolStripButton
    $importButton.Text = "Import Current"
    $importButton.add_Click({ Import-CurrentPackages })
    
    $refreshButton = New-Object System.Windows.Forms.ToolStripButton
    $refreshButton.Text = "Refresh Status"
    $refreshButton.add_Click({ Refresh-PackageStatus })
    
    $toolbar.Items.Add($addButton)
    $toolbar.Items.Add($removeButton)
    $toolbar.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator))
    $toolbar.Items.Add($importButton)
    $toolbar.Items.Add($refreshButton)
    
    # Create packages grid
    $script:PackagesGrid = New-Object System.Windows.Forms.DataGridView
    $script:PackagesGrid.Dock = [System.Windows.Forms.DockStyle]::Fill
    $script:PackagesGrid.AutoGenerateColumns = $false
    $script:PackagesGrid.AllowUserToAddRows = $false
    $script:PackagesGrid.AllowUserToDeleteRows = $false
    $script:PackagesGrid.SelectionMode = [System.Windows.Forms.DataGridViewSelectionMode]::FullRowSelect
    $script:PackagesGrid.MultiSelect = $false
    
    # Define columns
    $packageIdColumn = New-Object System.Windows.Forms.DataGridViewTextBoxColumn
    $packageIdColumn.Name = "PackageId"
    $packageIdColumn.HeaderText = "Package ID"
    $packageIdColumn.DataPropertyName = "PackageId"
    $packageIdColumn.Width = 300
    
    $hasConfigColumn = New-Object System.Windows.Forms.DataGridViewCheckBoxColumn
    $hasConfigColumn.Name = "HasConfig"
    $hasConfigColumn.HeaderText = "Backup Config"
    $hasConfigColumn.DataPropertyName = "HasConfig"
    $hasConfigColumn.Width = 100
    
    $statusColumn = New-Object System.Windows.Forms.DataGridViewTextBoxColumn
    $statusColumn.Name = "Status"
    $statusColumn.HeaderText = "Status"
    $statusColumn.DataPropertyName = "Status"
    $statusColumn.Width = 150
    $statusColumn.ReadOnly = $true
    
    $script:PackagesGrid.Columns.Add($packageIdColumn)
    $script:PackagesGrid.Columns.Add($hasConfigColumn)
    $script:PackagesGrid.Columns.Add($statusColumn)
    
    # Add event handlers
    $script:PackagesGrid.add_CellValueChanged({
        param($sender, $e)
        if ($e.ColumnIndex -eq 1) { # HasConfig column
            Save-PackagesList
        }
    })
    
    $panel.Controls.Add($script:PackagesGrid)
    $panel.Controls.Add($toolbar)
    
    return $panel
}

function New-ConfigMappingsTabContent {
    <#
    .SYNOPSIS
        Creates the content for the Config Mappings tab
    #>
    
    $splitter = New-Object System.Windows.Forms.SplitContainer
    $splitter.Dock = [System.Windows.Forms.DockStyle]::Fill
    $splitter.SplitterDistance = 300
    
    # Left panel - Package list
    $leftPanel = New-Object System.Windows.Forms.Panel
    $leftPanel.Dock = [System.Windows.Forms.DockStyle]::Fill
    
    $leftLabel = New-Object System.Windows.Forms.Label
    $leftLabel.Text = "Packages with Config Mappings:"
    $leftLabel.Dock = [System.Windows.Forms.DockStyle]::Top
    $leftLabel.Height = 25
    
    $script:ConfigPackagesList = New-Object System.Windows.Forms.ListBox
    $script:ConfigPackagesList.Dock = [System.Windows.Forms.DockStyle]::Fill
    $script:ConfigPackagesList.add_SelectedIndexChanged({ Show-ConfigMappingDetails })
    
    $leftPanel.Controls.Add($script:ConfigPackagesList)
    $leftPanel.Controls.Add($leftLabel)
    
    # Right panel - Config details
    $rightPanel = New-Object System.Windows.Forms.Panel
    $rightPanel.Dock = [System.Windows.Forms.DockStyle]::Fill
    
    $rightLabel = New-Object System.Windows.Forms.Label
    $rightLabel.Text = "Configuration Details:"
    $rightLabel.Dock = [System.Windows.Forms.DockStyle]::Top
    $rightLabel.Height = 25
    
    $script:ConfigDetailsPanel = New-Object System.Windows.Forms.Panel
    $script:ConfigDetailsPanel.Dock = [System.Windows.Forms.DockStyle]::Fill
    $script:ConfigDetailsPanel.AutoScroll = $true
    
    $rightPanel.Controls.Add($script:ConfigDetailsPanel)
    $rightPanel.Controls.Add($rightLabel)
    
    $splitter.Panel1.Controls.Add($leftPanel)
    $splitter.Panel2.Controls.Add($rightPanel)
    
    return $splitter
}

function New-OperationsTabContent {
    <#
    .SYNOPSIS
        Creates the content for the Operations tab
    #>
    
    $panel = New-Object System.Windows.Forms.Panel
    $panel.Dock = [System.Windows.Forms.DockStyle]::Fill
    $panel.Padding = New-Object System.Windows.Forms.Padding(20)
    
    # Create operation buttons
    $exportButton = New-Object System.Windows.Forms.Button
    $exportButton.Text = "Export Packages"
    $exportButton.Size = New-Object System.Drawing.Size(200, 60)
    $exportButton.Location = New-Object System.Drawing.Point(20, 20)
    $exportButton.Font = New-Object System.Drawing.Font("Segoe UI", 12, [System.Drawing.FontStyle]::Bold)
    $exportButton.add_Click({ Start-ExportOperation })
    
    $backupButton = New-Object System.Windows.Forms.Button
    $backupButton.Text = "Backup Configs"
    $backupButton.Size = New-Object System.Drawing.Size(200, 60)
    $backupButton.Location = New-Object System.Drawing.Point(240, 20)
    $backupButton.Font = New-Object System.Drawing.Font("Segoe UI", 12, [System.Drawing.FontStyle]::Bold)
    $backupButton.add_Click({ Start-BackupOperation })
    
    $installButton = New-Object System.Windows.Forms.Button
    $installButton.Text = "Install & Restore"
    $installButton.Size = New-Object System.Drawing.Size(200, 60)
    $installButton.Location = New-Object System.Drawing.Point(460, 20)
    $installButton.Font = New-Object System.Drawing.Font("Segoe UI", 12, [System.Drawing.FontStyle]::Bold)
    $installButton.add_Click({ Start-InstallOperation })
    
    # Force install checkbox
    $script:ForceInstallCheckbox = New-Object System.Windows.Forms.CheckBox
    $script:ForceInstallCheckbox.Text = "Force reinstall all packages"
    $script:ForceInstallCheckbox.Location = New-Object System.Drawing.Point(460, 90)
    $script:ForceInstallCheckbox.Size = New-Object System.Drawing.Size(200, 25)
    
    # Progress area
    $progressLabel = New-Object System.Windows.Forms.Label
    $progressLabel.Text = "Operation Progress:"
    $progressLabel.Location = New-Object System.Drawing.Point(20, 140)
    $progressLabel.Size = New-Object System.Drawing.Size(150, 25)
    
    $script:OperationProgressBar = New-Object System.Windows.Forms.ProgressBar
    $script:OperationProgressBar.Location = New-Object System.Drawing.Point(20, 170)
    $script:OperationProgressBar.Size = New-Object System.Drawing.Size(640, 25)
    
    $script:OperationStatusText = New-Object System.Windows.Forms.TextBox
    $script:OperationStatusText.Location = New-Object System.Drawing.Point(20, 210)
    $script:OperationStatusText.Size = New-Object System.Drawing.Size(640, 200)
    $script:OperationStatusText.Multiline = $true
    $script:OperationStatusText.ScrollBars = [System.Windows.Forms.ScrollBars]::Vertical
    $script:OperationStatusText.ReadOnly = $true
    
    # Cancel button
    $script:CancelOperationButton = New-Object System.Windows.Forms.Button
    $script:CancelOperationButton.Text = "Cancel Operation"
    $script:CancelOperationButton.Location = New-Object System.Drawing.Point(20, 430)
    $script:CancelOperationButton.Size = New-Object System.Drawing.Size(150, 35)
    $script:CancelOperationButton.Enabled = $false
    $script:CancelOperationButton.add_Click({ Stop-CurrentOperation })
    
    $panel.Controls.Add($exportButton)
    $panel.Controls.Add($backupButton)
    $panel.Controls.Add($installButton)
    $panel.Controls.Add($script:ForceInstallCheckbox)
    $panel.Controls.Add($progressLabel)
    $panel.Controls.Add($script:OperationProgressBar)
    $panel.Controls.Add($script:OperationStatusText)
    $panel.Controls.Add($script:CancelOperationButton)
    
    return $panel
}

function New-LogsTabContent {
    <#
    .SYNOPSIS
        Creates the content for the Logs tab
    #>
    
    $panel = New-Object System.Windows.Forms.Panel
    $panel.Dock = [System.Windows.Forms.DockStyle]::Fill
    $panel.Padding = New-Object System.Windows.Forms.Padding(10)
    
    # Create toolbar
    $toolbar = New-Object System.Windows.Forms.ToolStrip
    $toolbar.Dock = [System.Windows.Forms.DockStyle]::Top
    
    $refreshLogsButton = New-Object System.Windows.Forms.ToolStripButton
    $refreshLogsButton.Text = "Refresh"
    $refreshLogsButton.add_Click({ Refresh-LogsDisplay })
    
    $clearLogsButton = New-Object System.Windows.Forms.ToolStripButton
    $clearLogsButton.Text = "Clear"
    $clearLogsButton.add_Click({ Clear-LogsDisplay })
    
    $exportLogsButton = New-Object System.Windows.Forms.ToolStripButton
    $exportLogsButton.Text = "Export"
    $exportLogsButton.add_Click({ Export-LogsToFile })
    
    # Log level filter
    $logLevelLabel = New-Object System.Windows.Forms.ToolStripLabel
    $logLevelLabel.Text = "Level:"
    
    $script:LogLevelCombo = New-Object System.Windows.Forms.ToolStripComboBox
    $script:LogLevelCombo.Items.AddRange(@("All", "Info", "Warning", "Error"))
    $script:LogLevelCombo.SelectedIndex = 0
    $script:LogLevelCombo.add_SelectedIndexChanged({ Refresh-LogsDisplay })
    
    $toolbar.Items.Add($refreshLogsButton)
    $toolbar.Items.Add($clearLogsButton)
    $toolbar.Items.Add($exportLogsButton)
    $toolbar.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator))
    $toolbar.Items.Add($logLevelLabel)
    $toolbar.Items.Add($script:LogLevelCombo)
    
    # Create logs display
    $script:LogsTextBox = New-Object System.Windows.Forms.RichTextBox
    $script:LogsTextBox.Dock = [System.Windows.Forms.DockStyle]::Fill
    $script:LogsTextBox.ReadOnly = $true
    $script:LogsTextBox.Font = New-Object System.Drawing.Font("Consolas", 9)
    
    $panel.Controls.Add($script:LogsTextBox)
    $panel.Controls.Add($toolbar)
    
    return $panel
}

# Data refresh functions
function Refresh-PackagesGrid {
    <#
    .SYNOPSIS
        Refreshes the packages grid with current data
    #>
    
    if ($script:PackagesGrid) {
        $script:PackagesGrid.DataSource = $null
        $script:PackagesGrid.DataSource = $script:PackageList
        $script:PackagesGrid.Refresh()
    }
}

function Refresh-ConfigMappingsTree {
    <#
    .SYNOPSIS
        Refreshes the config mappings display
    #>
    
    if ($script:ConfigPackagesList) {
        $script:ConfigPackagesList.Items.Clear()
        foreach ($package in $script:ConfigMappings.Keys | Sort-Object) {
            $script:ConfigPackagesList.Items.Add($package)
        }
    }
}

# Export functions
Export-ModuleMember -Function New-PackagesTabContent, New-ConfigMappingsTabContent, New-OperationsTabContent, New-LogsTabContent, Refresh-PackagesGrid, Refresh-ConfigMappingsTree
