# GUI Operations Module for Software Manager
# Handles the operations tab and operation execution

function New-OperationsTab {
    <#
    .SYNOPSIS
        Creates the operations tab with all its controls
    #>
    param(
        [Parameter(Mandatory=$true)]
        [hashtable]$Config
    )
    
    $operationsTab = New-Object System.Windows.Forms.TabPage
    $operationsTab.Text = "Operations"
    
    $operationsPanel = New-Object System.Windows.Forms.Panel
    $operationsPanel.Dock = [System.Windows.Forms.DockStyle]::Fill
    $operationsPanel.Padding = New-Object System.Windows.Forms.Padding(20)
    
    # Operation buttons
    $exportBtn = New-Object System.Windows.Forms.Button
    $exportBtn.Text = "Export Packages"
    $exportBtn.Size = New-Object System.Drawing.Size(180, 60)
    $exportBtn.Location = New-Object System.Drawing.Point(20, 20)
    $exportBtn.Font = New-Object System.Drawing.Font("Segoe UI", 11, [System.Drawing.FontStyle]::Bold)
    $exportBtn.add_Click({ Start-ExportOperation -Config $Config })
    
    $backupBtn = New-Object System.Windows.Forms.Button
    $backupBtn.Text = "Backup Configs"
    $backupBtn.Size = New-Object System.Drawing.Size(180, 60)
    $backupBtn.Location = New-Object System.Drawing.Point(220, 20)
    $backupBtn.Font = New-Object System.Drawing.Font("Segoe UI", 11, [System.Drawing.FontStyle]::Bold)
    $backupBtn.add_Click({ Start-BackupOperation -Config $Config })
    
    $installBtn = New-Object System.Windows.Forms.Button
    $installBtn.Text = "Install & Restore"
    $installBtn.Size = New-Object System.Drawing.Size(180, 60)
    $installBtn.Location = New-Object System.Drawing.Point(420, 20)
    $installBtn.Font = New-Object System.Drawing.Font("Segoe UI", 11, [System.Drawing.FontStyle]::Bold)
    $installBtn.add_Click({ Start-InstallOperation -Config $Config })
    
    # Force install checkbox
    $script:ForceCheckBox = New-Object System.Windows.Forms.CheckBox
    $script:ForceCheckBox.Text = "Force reinstall all packages"
    $script:ForceCheckBox.Location = New-Object System.Drawing.Point(420, 90)
    $script:ForceCheckBox.Size = New-Object System.Drawing.Size(200, 25)
    
    # Logs button
    $logsBtn = New-Object System.Windows.Forms.Button
    $logsBtn.Text = "View Logs"
    $logsBtn.Location = New-Object System.Drawing.Point(20, 120)
    $logsBtn.Size = New-Object System.Drawing.Size(100, 35)
    $logsBtn.add_Click({ Show-LogsDialog -LogFilePath $Config.LogFile })
    
    $operationsPanel.Controls.Add($exportBtn)
    $operationsPanel.Controls.Add($backupBtn)
    $operationsPanel.Controls.Add($installBtn)
    $operationsPanel.Controls.Add($script:ForceCheckBox)
    $operationsPanel.Controls.Add($logsBtn)
    $operationsTab.Controls.Add($operationsPanel)
    
    return $operationsTab
}

function Start-ExportOperation {
    <#
    .SYNOPSIS
        Starts the export operation
    #>
    param(
        [Parameter(Mandatory=$true)]
        [hashtable]$Config
    )
    
    try {
        Update-StatusLabel -Text "Running Export operation..."
        [System.Windows.Forms.Application]::DoEvents()
        
        Start-ExportMode -Config $Config
        
        Update-StatusLabel -Text "Export operation completed"
        [System.Windows.Forms.MessageBox]::Show("Export operation completed successfully.", "Operation Complete", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Information)
        
        # Refresh data after export
        Refresh-AllData -Config $Config
    }
    catch {
        Update-StatusLabel -Text "Export operation failed"
        Write-SoftwareManagerLog -Config $Config -Message "Export operation failed: $_" -Level Error
        [System.Windows.Forms.MessageBox]::Show("Export operation failed: $_", "Operation Error", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Error)
    }
}

function Start-BackupOperation {
    <#
    .SYNOPSIS
        Starts the backup operation
    #>
    param(
        [Parameter(Mandatory=$true)]
        [hashtable]$Config
    )
    
    try {
        # Initialize config mappings
        Initialize-ConfigMappings -Config $Config
        
        Update-StatusLabel -Text "Running Backup operation..."
        [System.Windows.Forms.Application]::DoEvents()
        
        Start-BackupMode -Config $Config
        
        Update-StatusLabel -Text "Backup operation completed"
        [System.Windows.Forms.MessageBox]::Show("Backup operation completed successfully.", "Operation Complete", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Information)
    }
    catch {
        Update-StatusLabel -Text "Backup operation failed"
        Write-SoftwareManagerLog -Config $Config -Message "Backup operation failed: $_" -Level Error
        [System.Windows.Forms.MessageBox]::Show("Backup operation failed: $_", "Operation Error", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Error)
    }
}

function Start-InstallOperation {
    <#
    .SYNOPSIS
        Starts the install operation
    #>
    param(
        [Parameter(Mandatory=$true)]
        [hashtable]$Config
    )
    
    try {
        # Initialize config mappings
        Initialize-ConfigMappings -Config $Config
        
        $forceInstall = $script:ForceCheckBox.Checked
        
        Update-StatusLabel -Text "Running Install operation..."
        [System.Windows.Forms.Application]::DoEvents()
        
        Start-InstallMode -Config $Config -Force $forceInstall
        
        Update-StatusLabel -Text "Install operation completed"
        [System.Windows.Forms.MessageBox]::Show("Install operation completed successfully.", "Operation Complete", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Information)
        
        # Refresh data after install
        Refresh-AllData -Config $Config
    }
    catch {
        Update-StatusLabel -Text "Install operation failed"
        Write-SoftwareManagerLog -Config $Config -Message "Install operation failed: $_" -Level Error
        [System.Windows.Forms.MessageBox]::Show("Install operation failed: $_", "Operation Error", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Error)
    }
}

function Update-StatusLabel {
    <#
    .SYNOPSIS
        Updates the status label text
    #>
    param(
        [Parameter(Mandatory=$true)]
        [string]$Text
    )
    
    if ($script:StatusLabel) {
        $script:StatusLabel.Text = $Text
        [System.Windows.Forms.Application]::DoEvents()
    }
}

function Refresh-AllData {
    <#
    .SYNOPSIS
        Refreshes all GUI data
    #>
    param(
        [Parameter(Mandatory=$true)]
        [hashtable]$Config
    )
    
    try {
        Initialize-GUIData -Config $Config
        Refresh-PackagesGrid
        Refresh-ConfigList
    }
    catch {
        Write-SoftwareManagerLog -Config $Config -Message "Error refreshing GUI data: $_" -Level Error
    }
}

function Set-StatusLabel {
    <#
    .SYNOPSIS
        Sets the status label reference
    #>
    param(
        [Parameter(Mandatory=$true)]
        $StatusLabel
    )
    
    $script:StatusLabel = $StatusLabel
}

# Export functions
Export-ModuleMember -Function @(
    'New-OperationsTab',
    'Set-StatusLabel'
)
