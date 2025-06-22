# GUI Packages Module for Software Manager
# Handles package management UI components

function New-PackagesTab {
    <#
    .SYNOPSIS
        Creates the packages tab with all its controls
    #>
    
    $packagesTab = New-Object System.Windows.Forms.TabPage
    $packagesTab.Text = "Packages"

    $packagesPanel = New-Object System.Windows.Forms.Panel
    $packagesPanel.Dock = [System.Windows.Forms.DockStyle]::Fill
    $packagesPanel.Padding = New-Object System.Windows.Forms.Padding(16)
    $packagesPanel.BackColor = [System.Drawing.ColorTranslator]::FromHtml('#f7f9fa')

    # Packages toolbar (modern look)
    $packagesToolbar = New-Object System.Windows.Forms.Panel
    $packagesToolbar.Height = 44
    $packagesToolbar.Dock = [System.Windows.Forms.DockStyle]::Top
    $packagesToolbar.BackColor = [System.Drawing.ColorTranslator]::FromHtml('#e3eaf2')

    $addPackageBtn = New-Object System.Windows.Forms.Button
    $addPackageBtn.Text = "Search & Add Package"
    $addPackageBtn.Location = New-Object System.Drawing.Point(10, 7)
    $addPackageBtn.Size = New-Object System.Drawing.Size(150, 30)
    $addPackageBtn.Font = New-Object System.Drawing.Font("Segoe UI", 9)
    $addPackageBtn.BackColor = [System.Drawing.ColorTranslator]::FromHtml('#e3eaf2')
    $addPackageBtn.FlatStyle = 'Flat'
    $addPackageBtn.FlatAppearance.BorderColor = [System.Drawing.ColorTranslator]::FromHtml('#b6c6d7')
    $addPackageBtn.ForeColor = [System.Drawing.Color]::FromArgb(40, 40, 40)
    $addPackageBtn.add_Click({ 
        try {
            $selectedPackage = Show-PackageSearchDialog
            if ($selectedPackage -and $selectedPackage.Trim() -ne "") {
                Add-NewPackage -PackageId $selectedPackage.Trim()
                Refresh-PackagesGrid
            }
        }
        catch {
            [System.Windows.Forms.MessageBox]::Show("Error adding package: $_", "Error", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Error)
        }
    })

    $removePackageBtn = New-Object System.Windows.Forms.Button
    $removePackageBtn.Text = "Remove Package"
    $removePackageBtn.Location = New-Object System.Drawing.Point(170, 7)
    $removePackageBtn.Size = New-Object System.Drawing.Size(140, 30)
    $removePackageBtn.Font = New-Object System.Drawing.Font("Segoe UI", 9)
    $removePackageBtn.BackColor = [System.Drawing.ColorTranslator]::FromHtml('#e3eaf2')
    $removePackageBtn.FlatStyle = 'Flat'
    $removePackageBtn.FlatAppearance.BorderColor = [System.Drawing.ColorTranslator]::FromHtml('#b6c6d7')
    $removePackageBtn.ForeColor = [System.Drawing.Color]::FromArgb(40, 40, 40)
    $removePackageBtn.add_Click({ 
        try {
            Remove-SelectedPackage
            Refresh-PackagesGrid
        }
        catch {
            [System.Windows.Forms.MessageBox]::Show("Error removing package: $_", "Error", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Error)
        }
    })

    $packagesToolbar.Controls.Add($addPackageBtn)
    $packagesToolbar.Controls.Add($removePackageBtn)

    # Packages grid (modern look)
    $script:PackagesGrid = New-Object System.Windows.Forms.DataGridView
    $script:PackagesGrid.Dock = [System.Windows.Forms.DockStyle]::Fill
    $script:PackagesGrid.AllowUserToAddRows = $false
    $script:PackagesGrid.AllowUserToDeleteRows = $false
    $script:PackagesGrid.SelectionMode = [System.Windows.Forms.DataGridViewSelectionMode]::FullRowSelect
    $script:PackagesGrid.MultiSelect = $false
    $script:PackagesGrid.AutoSizeColumnsMode = [System.Windows.Forms.DataGridViewAutoSizeColumnsMode]::Fill
    $script:PackagesGrid.BackgroundColor = [System.Drawing.ColorTranslator]::FromHtml('#ffffff')
    $script:PackagesGrid.GridColor = [System.Drawing.ColorTranslator]::FromHtml('#d0d7de')
    $script:PackagesGrid.BorderStyle = [System.Windows.Forms.BorderStyle]::FixedSingle
    $script:PackagesGrid.ColumnHeadersDefaultCellStyle.BackColor = [System.Drawing.ColorTranslator]::FromHtml('#e3eaf2')
    $script:PackagesGrid.ColumnHeadersDefaultCellStyle.Font = New-Object System.Drawing.Font("Segoe UI", 10, [System.Drawing.FontStyle]::Bold)
    $script:PackagesGrid.ColumnHeadersDefaultCellStyle.ForeColor = [System.Drawing.Color]::FromArgb(30, 30, 30)
    $script:PackagesGrid.DefaultCellStyle.Font = New-Object System.Drawing.Font("Segoe UI", 10)
    $script:PackagesGrid.DefaultCellStyle.ForeColor = [System.Drawing.Color]::FromArgb(40, 40, 40)
    $script:PackagesGrid.DefaultCellStyle.SelectionBackColor = [System.Drawing.ColorTranslator]::FromHtml('#c7e0fa')
    $script:PackagesGrid.DefaultCellStyle.SelectionForeColor = [System.Drawing.Color]::FromArgb(30, 30, 30)
    $script:PackagesGrid.RowTemplate.Height = 28

    # Add columns
    $packageIdColumn = New-Object System.Windows.Forms.DataGridViewTextBoxColumn
    $packageIdColumn.Name = "PackageId"
    $packageIdColumn.HeaderText = "Package ID"
    $packageIdColumn.Width = 300

    $hasConfigColumn = New-Object System.Windows.Forms.DataGridViewCheckBoxColumn
    $hasConfigColumn.Name = "HasConfig"
    $hasConfigColumn.HeaderText = "Backup Config"
    $hasConfigColumn.Width = 120

    $statusColumn = New-Object System.Windows.Forms.DataGridViewTextBoxColumn
    $statusColumn.Name = "Status"
    $statusColumn.HeaderText = "Status"
    $statusColumn.Width = 150
    $statusColumn.ReadOnly = $true

    [void]$script:PackagesGrid.Columns.Add($packageIdColumn)
    [void]$script:PackagesGrid.Columns.Add($hasConfigColumn)
    [void]$script:PackagesGrid.Columns.Add($statusColumn)

    # Handle checkbox changes
    $script:PackagesGrid.add_CellValueChanged({
        param($sender, $e)
        if ($e.ColumnIndex -eq 1 -and $e.RowIndex -ge 0) {
            try {
                Update-PackageConfig -Index $e.RowIndex -HasConfig $sender.Rows[$e.RowIndex].Cells[1].Value
            }
            catch {
                [System.Windows.Forms.MessageBox]::Show("Error updating package config: $_", "Error", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Error)
            }
        }
    })

    $packagesPanel.Controls.Add($script:PackagesGrid)
    $packagesPanel.Controls.Add($packagesToolbar)
    $packagesTab.Controls.Add($packagesPanel)

    return $packagesTab
}

function Add-NewPackage {
    <#
    .SYNOPSIS
        Adds a new package to the list
    #>
    param(
        [Parameter(Mandatory=$true)]
        [string]$PackageId
    )
    
    try {
        $newPackage = Add-Package -PackageId $PackageId
        return $newPackage
    }
    catch {
        if ($_.Exception.Message -like "*already exists*") {
            [System.Windows.Forms.MessageBox]::Show("Package '$PackageId' already exists.", "Duplicate Package", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Warning)
        } else {
            throw $_
        }
    }
}

function Remove-SelectedPackage {
    <#
    .SYNOPSIS
        Removes the selected package from the list
    #>
    
    if ($script:PackagesGrid.SelectedRows.Count -gt 0) {
        $selectedIndex = $script:PackagesGrid.SelectedRows[0].Index
        $packageList = Get-PackageList
        
        if ($selectedIndex -ge 0 -and $selectedIndex -lt $packageList.Count) {
            $packageId = $packageList[$selectedIndex].PackageId
            
            $result = [System.Windows.Forms.MessageBox]::Show(
                "Are you sure you want to remove package '$packageId'?",
                "Confirm Removal",
                [System.Windows.Forms.MessageBoxButtons]::YesNo,
                [System.Windows.Forms.MessageBoxIcon]::Question
            )
            
            if ($result -eq [System.Windows.Forms.DialogResult]::Yes) {
                Remove-Package -Index $selectedIndex
            }
        }
    }
}

function Refresh-PackagesGrid {
    <#
    .SYNOPSIS
        Refreshes the packages grid with current data
    #>
    
    if ($script:PackagesGrid) {
        $script:PackagesGrid.Rows.Clear()
        $packageList = Get-PackageList
        
        foreach ($package in $packageList) {
            $row = $script:PackagesGrid.Rows.Add()
            $script:PackagesGrid.Rows[$row].Cells[0].Value = $package.PackageId
            $script:PackagesGrid.Rows[$row].Cells[1].Value = $package.HasConfig
            $script:PackagesGrid.Rows[$row].Cells[2].Value = $package.Status
        }
    }
}

function Get-PackagesGrid {
    <#
    .SYNOPSIS
        Returns the packages grid control
    #>
    return $script:PackagesGrid
}

# Export functions
Export-ModuleMember -Function @(
    'New-PackagesTab',
    'Refresh-PackagesGrid',
    'Get-PackagesGrid'
)
