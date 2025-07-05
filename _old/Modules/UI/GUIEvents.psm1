# GUI Events Module for Software Manager
# Contains event handlers and operation logic for GUI interactions

# Package Management Events
function Show-AddPackageDialog {
    <#
    .SYNOPSIS
        Shows dialog to add a new package
    #>
    
    $dialog = New-Object System.Windows.Forms.Form
    $dialog.Text = "Add Package"
    $dialog.Size = New-Object System.Drawing.Size(400, 200)
    $dialog.StartPosition = "CenterParent"
    $dialog.FormBorderStyle = [System.Windows.Forms.FormBorderStyle]::FixedDialog
    $dialog.MaximizeBox = $false
    $dialog.MinimizeBox = $false
    
    $packageLabel = New-Object System.Windows.Forms.Label
    $packageLabel.Text = "Package ID:"
    $packageLabel.Location = New-Object System.Drawing.Point(20, 20)
    $packageLabel.Size = New-Object System.Drawing.Size(80, 25)
    
    $packageTextBox = New-Object System.Windows.Forms.TextBox
    $packageTextBox.Location = New-Object System.Drawing.Point(110, 20)
    $packageTextBox.Size = New-Object System.Drawing.Size(250, 25)
    
    $configCheckBox = New-Object System.Windows.Forms.CheckBox
    $configCheckBox.Text = "Backup/Restore configuration"
    $configCheckBox.Location = New-Object System.Drawing.Point(110, 55)
    $configCheckBox.Size = New-Object System.Drawing.Size(250, 25)
    
    $searchButton = New-Object System.Windows.Forms.Button
    $searchButton.Text = "Search Winget"
    $searchButton.Location = New-Object System.Drawing.Point(110, 90)
    $searchButton.Size = New-Object System.Drawing.Size(100, 30)
    $searchButton.add_Click({
        Show-WingetSearchDialog -TargetTextBox $packageTextBox
    })
    
    $okButton = New-Object System.Windows.Forms.Button
    $okButton.Text = "OK"
    $okButton.Location = New-Object System.Drawing.Point(220, 90)
    $okButton.Size = New-Object System.Drawing.Size(70, 30)
    $okButton.DialogResult = [System.Windows.Forms.DialogResult]::OK
    
    $cancelButton = New-Object System.Windows.Forms.Button
    $cancelButton.Text = "Cancel"
    $cancelButton.Location = New-Object System.Drawing.Point(300, 90)
    $cancelButton.Size = New-Object System.Drawing.Size(70, 30)
    $cancelButton.DialogResult = [System.Windows.Forms.DialogResult]::Cancel
    
    $dialog.Controls.Add($packageLabel)
    $dialog.Controls.Add($packageTextBox)
    $dialog.Controls.Add($configCheckBox)
    $dialog.Controls.Add($searchButton)
    $dialog.Controls.Add($okButton)
    $dialog.Controls.Add($cancelButton)
    
    $dialog.AcceptButton = $okButton
    $dialog.CancelButton = $cancelButton
    
    if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
        $packageId = $packageTextBox.Text.Trim()
        if ($packageId) {
            $newPackage = [PSCustomObject]@{
                PackageId = $packageId
                HasConfig = $configCheckBox.Checked
                Status = "Unknown"
            }
            $script:PackageList += $newPackage
            Save-PackagesList
            Refresh-PackagesGrid
        }
    }
    
    $dialog.Dispose()
}

function Remove-SelectedPackage {
    <#
    .SYNOPSIS
        Removes the selected package from the list
    #>
    
    if ($script:PackagesGrid.SelectedRows.Count -gt 0) {
        $selectedIndex = $script:PackagesGrid.SelectedRows[0].Index
        $packageId = $script:PackageList[$selectedIndex].PackageId
        
        $result = [System.Windows.Forms.MessageBox]::Show(
            "Are you sure you want to remove package '$packageId'?",
            "Confirm Removal",
            [System.Windows.Forms.MessageBoxButtons]::YesNo,
            [System.Windows.Forms.MessageBoxIcon]::Question
        )
        
        if ($result -eq [System.Windows.Forms.DialogResult]::Yes) {
            $script:PackageList = $script:PackageList | Where-Object { $_ -ne $script:PackageList[$selectedIndex] }
            Save-PackagesList
            Refresh-PackagesGrid
        }
    }
}

function Import-CurrentPackages {
    <#
    .SYNOPSIS
        Imports packages from packages_current.txt
    #>
    
    $currentPackagesFile = Join-Path $script:CurrentConfig.ScriptPath "packages_current.txt"
    if (-not (Test-Path $currentPackagesFile)) {
        [System.Windows.Forms.MessageBox]::Show(
            "packages_current.txt not found. Run Export operation first.",
            "File Not Found",
            [System.Windows.Forms.MessageBoxButtons]::OK,
            [System.Windows.Forms.MessageBoxIcon]::Warning
        )
        return
    }
    
    try {
        $currentPackages = Get-Content $currentPackagesFile | Where-Object { $_.Trim() -ne "" }
        $importedCount = 0
        
        foreach ($packageId in $currentPackages) {
            $cleanPackageId = $packageId.TrimStart('+')
            $exists = $script:PackageList | Where-Object { $_.PackageId -eq $cleanPackageId }
            
            if (-not $exists) {
                $newPackage = [PSCustomObject]@{
                    PackageId = $cleanPackageId
                    HasConfig = $false
                    Status = "Unknown"
                }
                $script:PackageList += $newPackage
                $importedCount++
            }
        }
        
        if ($importedCount -gt 0) {
            Save-PackagesList
            Refresh-PackagesGrid
            [System.Windows.Forms.MessageBox]::Show(
                "Imported $importedCount new packages from packages_current.txt",
                "Import Complete",
                [System.Windows.Forms.MessageBoxButtons]::OK,
                [System.Windows.Forms.MessageBoxIcon]::Information
            )
        } else {
            [System.Windows.Forms.MessageBox]::Show(
                "No new packages found to import.",
                "Import Complete",
                [System.Windows.Forms.MessageBoxButtons]::OK,
                [System.Windows.Forms.MessageBoxIcon]::Information
            )
        }
    }
    catch {
        [System.Windows.Forms.MessageBox]::Show(
            "Error importing packages: $_",
            "Import Error",
            [System.Windows.Forms.MessageBoxButtons]::OK,
            [System.Windows.Forms.MessageBoxIcon]::Error
        )
    }
}

function Refresh-PackageStatus {
    <#
    .SYNOPSIS
        Refreshes the installation status of all packages
    #>
    
    Update-StatusBar -Text "Checking package status..." -ShowProgress $true
    
    try {
        for ($i = 0; $i -lt $script:PackageList.Count; $i++) {
            $package = $script:PackageList[$i]
            $progress = [int](($i / $script:PackageList.Count) * 100)
            Update-StatusBar -Text "Checking $($package.PackageId)..." -Progress $progress -ShowProgress $true
            
            $isInstalled = Test-PackageInstalled -Config $script:CurrentConfig -PackageName $package.PackageId
            $package.Status = if ($isInstalled) { "Installed" } else { "Not Installed" }
            
            [System.Windows.Forms.Application]::DoEvents()
        }
        
        Refresh-PackagesGrid
        Update-StatusBar -Text "Package status updated" -ShowProgress $false
    }
    catch {
        Update-StatusBar -Text "Error checking package status" -ShowProgress $false
        Write-SoftwareManagerLog -Config $script:CurrentConfig -Message "Error checking package status: $_" -Level Error
    }
}

function Save-PackagesList {
    <#
    .SYNOPSIS
        Saves the current packages list to packages.txt
    #>
    
    try {
        $packagesContent = @()
        foreach ($package in $script:PackageList) {
            $prefix = if ($package.HasConfig) { "+" } else { "" }
            $packagesContent += "$prefix$($package.PackageId)"
        }
        
        $packagesContent | Out-File -FilePath $script:CurrentConfig.PackagesFile -Encoding UTF8
        Write-SoftwareManagerLog -Config $script:CurrentConfig -Message "Packages list saved to $($script:CurrentConfig.PackagesFile)"
    }
    catch {
        Write-SoftwareManagerLog -Config $script:CurrentConfig -Message "Error saving packages list: $_" -Level Error
        [System.Windows.Forms.MessageBox]::Show(
            "Error saving packages list: $_",
            "Save Error",
            [System.Windows.Forms.MessageBoxButtons]::OK,
            [System.Windows.Forms.MessageBoxIcon]::Error
        )
    }
}

# Operation Events
function Start-ExportOperation {
    <#
    .SYNOPSIS
        Starts the export operation in background
    #>
    
    if ($script:CurrentOperation) {
        [System.Windows.Forms.MessageBox]::Show(
            "An operation is already running. Please wait for it to complete.",
            "Operation Running",
            [System.Windows.Forms.MessageBoxButtons]::OK,
            [System.Windows.Forms.MessageBoxIcon]::Warning
        )
        return
    }
    
    Start-BackgroundOperation -OperationType "Export" -ScriptBlock {
        param($Config)
        Start-ExportMode -Config $Config
    }
}

function Start-BackupOperation {
    <#
    .SYNOPSIS
        Starts the backup operation in background
    #>
    
    if ($script:CurrentOperation) {
        [System.Windows.Forms.MessageBox]::Show(
            "An operation is already running. Please wait for it to complete.",
            "Operation Running",
            [System.Windows.Forms.MessageBoxButtons]::OK,
            [System.Windows.Forms.MessageBoxIcon]::Warning
        )
        return
    }
    
    # Initialize config mappings
    Initialize-ConfigMappings -Config $script:CurrentConfig
    
    Start-BackgroundOperation -OperationType "Backup" -ScriptBlock {
        param($Config)
        Start-BackupMode -Config $Config
    }
}

function Start-InstallOperation {
    <#
    .SYNOPSIS
        Starts the install operation in background
    #>
    
    if ($script:CurrentOperation) {
        [System.Windows.Forms.MessageBox]::Show(
            "An operation is already running. Please wait for it to complete.",
            "Operation Running",
            [System.Windows.Forms.MessageBoxButtons]::OK,
            [System.Windows.Forms.MessageBoxIcon]::Warning
        )
        return
    }
    
    $forceInstall = $script:ForceInstallCheckbox.Checked
    
    # Initialize config mappings
    Initialize-ConfigMappings -Config $script:CurrentConfig
    
    Start-BackgroundOperation -OperationType "Install" -ScriptBlock {
        param($Config, $Force)
        Start-InstallMode -Config $Config -Force $Force
    } -Parameters @($script:CurrentConfig, $forceInstall)
}

function Start-BackgroundOperation {
    <#
    .SYNOPSIS
        Starts an operation in background using runspace
    #>
    param(
        [string]$OperationType,
        [scriptblock]$ScriptBlock,
        [array]$Parameters = @($script:CurrentConfig)
    )
    
    $script:CurrentOperation = $OperationType
    $script:CancelOperationButton.Enabled = $true
    Update-StatusBar -Text "Starting $OperationType operation..." -ShowProgress $true
    
    # Clear operation status
    $script:OperationStatusText.Text = "Starting $OperationType operation...`r`n"
    $script:OperationProgressBar.Value = 0
    
    # Create runspace for background operation
    $runspace = [runspacefactory]::CreateRunspace()
    $runspace.Open()
    
    # Create PowerShell instance
    $powershell = [powershell]::Create()
    $powershell.Runspace = $runspace
    
    # Add script block and parameters
    $powershell.AddScript($ScriptBlock)
    foreach ($param in $Parameters) {
        $powershell.AddArgument($param)
    }
    
    # Start operation asynchronously
    $script:OperationRunspace = $powershell.BeginInvoke()
    
    # Start timer to check operation status
    $timer = New-Object System.Windows.Forms.Timer
    $timer.Interval = 1000  # Check every second
    $timer.add_Tick({
        if ($script:OperationRunspace.IsCompleted) {
            try {
                $powershell.EndInvoke($script:OperationRunspace)
                $script:OperationStatusText.AppendText("$OperationType operation completed successfully.`r`n")
            }
            catch {
                $script:OperationStatusText.AppendText("$OperationType operation failed: $_`r`n")
                Write-SoftwareManagerLog -Config $script:CurrentConfig -Message "$OperationType operation failed: $_" -Level Error
            }
            finally {
                $powershell.Dispose()
                $runspace.Close()
                $script:CurrentOperation = $null
                $script:CancelOperationButton.Enabled = $false
                Update-StatusBar -Text "$OperationType operation completed" -ShowProgress $false
                $timer.Stop()
                $timer.Dispose()
                
                # Refresh data after operation
                Initialize-GUIData
            }
        }
    })
    $timer.Start()
}

function Stop-CurrentOperation {
    <#
    .SYNOPSIS
        Stops the current background operation
    #>
    
    if ($script:CurrentOperation -and $script:OperationRunspace) {
        try {
            # Note: PowerShell runspace cancellation is limited
            # This is more of a UI feedback mechanism
            $script:OperationStatusText.AppendText("Cancellation requested...`r`n")
            Update-StatusBar -Text "Cancelling operation..." -ShowProgress $false
        }
        catch {
            Write-SoftwareManagerLog -Config $script:CurrentConfig -Message "Error stopping operation: $_" -Level Error
        }
    }
}

# Helper Events
function Show-WingetSearchDialog {
    <#
    .SYNOPSIS
        Shows winget package search dialog
    #>
    param(
        [System.Windows.Forms.TextBox]$TargetTextBox = $null
    )
    
    $searchDialog = New-Object System.Windows.Forms.Form
    $searchDialog.Text = "Search Winget Packages"
    $searchDialog.Size = New-Object System.Drawing.Size(600, 400)
    $searchDialog.StartPosition = "CenterParent"
    
    $searchLabel = New-Object System.Windows.Forms.Label
    $searchLabel.Text = "Search term:"
    $searchLabel.Location = New-Object System.Drawing.Point(20, 20)
    $searchLabel.Size = New-Object System.Drawing.Size(80, 25)
    
    $searchTextBox = New-Object System.Windows.Forms.TextBox
    $searchTextBox.Location = New-Object System.Drawing.Point(110, 20)
    $searchTextBox.Size = New-Object System.Drawing.Size(350, 25)
    
    $searchButton = New-Object System.Windows.Forms.Button
    $searchButton.Text = "Search"
    $searchButton.Location = New-Object System.Drawing.Point(470, 20)
    $searchButton.Size = New-Object System.Drawing.Size(80, 25)
    
    $resultsListBox = New-Object System.Windows.Forms.ListBox
    $resultsListBox.Location = New-Object System.Drawing.Point(20, 60)
    $resultsListBox.Size = New-Object System.Drawing.Size(540, 250)
    
    $selectButton = New-Object System.Windows.Forms.Button
    $selectButton.Text = "Select"
    $selectButton.Location = New-Object System.Drawing.Point(400, 320)
    $selectButton.Size = New-Object System.Drawing.Size(70, 30)
    $selectButton.DialogResult = [System.Windows.Forms.DialogResult]::OK
    
    $cancelButton = New-Object System.Windows.Forms.Button
    $cancelButton.Text = "Cancel"
    $cancelButton.Location = New-Object System.Drawing.Point(480, 320)
    $cancelButton.Size = New-Object System.Drawing.Size(70, 30)
    $cancelButton.DialogResult = [System.Windows.Forms.DialogResult]::Cancel
    
    $searchButton.add_Click({
        $searchTerm = $searchTextBox.Text.Trim()
        if ($searchTerm) {
            $resultsListBox.Items.Clear()
            $resultsListBox.Items.Add("Searching...")
            [System.Windows.Forms.Application]::DoEvents()
            
            try {
                # Run winget search
                $results = winget search $searchTerm 2>$null | Select-Object -Skip 2
                $resultsListBox.Items.Clear()
                
                foreach ($result in $results) {
                    if ($result -and $result.Trim()) {
                        $parts = $result -split '\s+', 3
                        if ($parts.Count -ge 2) {
                            $packageId = $parts[1]
                            $resultsListBox.Items.Add($packageId)
                        }
                    }
                }
                
                if ($resultsListBox.Items.Count -eq 0) {
                    $resultsListBox.Items.Add("No packages found")
                }
            }
            catch {
                $resultsListBox.Items.Clear()
                $resultsListBox.Items.Add("Error searching: $_")
            }
        }
    })
    
    $searchDialog.Controls.Add($searchLabel)
    $searchDialog.Controls.Add($searchTextBox)
    $searchDialog.Controls.Add($searchButton)
    $searchDialog.Controls.Add($resultsListBox)
    $searchDialog.Controls.Add($selectButton)
    $searchDialog.Controls.Add($cancelButton)
    
    if ($searchDialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
        if ($resultsListBox.SelectedItem -and $TargetTextBox) {
            $TargetTextBox.Text = $resultsListBox.SelectedItem.ToString()
        }
    }
    
    $searchDialog.Dispose()
}

function Show-AboutDialog {
    <#
    .SYNOPSIS
        Shows the about dialog
    #>
    
    $aboutText = @"
Software Manager GUI v1.0

A graphical interface for the Software Manager application that automates backup and restore of applications and their configurations using Windows Package Manager (Winget).

Features:
- Package management with Winget integration
- Configuration backup and restore
- Export/Backup/Install operations
- Real-time progress tracking
- Comprehensive logging

Requires: PowerShell 5.1+, Administrator privileges, Windows Package Manager (Winget)

Author: GitHub Copilot
"@
    
    [System.Windows.Forms.MessageBox]::Show(
        $aboutText,
        "About Software Manager GUI",
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Information
    )
}

# Config Mappings Events
function Show-ConfigMappingDetails {
    <#
    .SYNOPSIS
        Shows configuration mapping details for selected package
    #>
    
    if ($script:ConfigPackagesList.SelectedItem) {
        $packageId = $script:ConfigPackagesList.SelectedItem.ToString()
        $mapping = $script:ConfigMappings[$packageId]
        
        # Clear existing controls
        $script:ConfigDetailsPanel.Controls.Clear()
        
        if ($mapping) {
            $y = 10
            
            # Folders section
            if ($mapping.Folders -and $mapping.Folders.Count -gt 0) {
                $foldersLabel = New-Object System.Windows.Forms.Label
                $foldersLabel.Text = "Folders:"
                $foldersLabel.Location = New-Object System.Drawing.Point(10, $y)
                $foldersLabel.Size = New-Object System.Drawing.Size(100, 20)
                $foldersLabel.Font = New-Object System.Drawing.Font("Segoe UI", 9, [System.Drawing.FontStyle]::Bold)
                $script:ConfigDetailsPanel.Controls.Add($foldersLabel)
                $y += 25
                
                foreach ($folder in $mapping.Folders) {
                    $folderLabel = New-Object System.Windows.Forms.Label
                    $folderLabel.Text = $folder
                    $folderLabel.Location = New-Object System.Drawing.Point(20, $y)
                    $folderLabel.Size = New-Object System.Drawing.Size(500, 20)
                    $script:ConfigDetailsPanel.Controls.Add($folderLabel)
                    $y += 25
                }
                $y += 10
            }
            
            # Files section
            if ($mapping.Files -and $mapping.Files.Count -gt 0) {
                $filesLabel = New-Object System.Windows.Forms.Label
                $filesLabel.Text = "Files:"
                $filesLabel.Location = New-Object System.Drawing.Point(10, $y)
                $filesLabel.Size = New-Object System.Drawing.Size(100, 20)
                $filesLabel.Font = New-Object System.Drawing.Font("Segoe UI", 9, [System.Drawing.FontStyle]::Bold)
                $script:ConfigDetailsPanel.Controls.Add($filesLabel)
                $y += 25
                
                foreach ($file in $mapping.Files) {
                    $fileLabel = New-Object System.Windows.Forms.Label
                    $fileLabel.Text = $file
                    $fileLabel.Location = New-Object System.Drawing.Point(20, $y)
                    $fileLabel.Size = New-Object System.Drawing.Size(500, 20)
                    $script:ConfigDetailsPanel.Controls.Add($fileLabel)
                    $y += 25
                }
                $y += 10
            }
            
            # Registry section
            if ($mapping.Registry -and $mapping.Registry.Count -gt 0) {
                $regLabel = New-Object System.Windows.Forms.Label
                $regLabel.Text = "Registry Keys:"
                $regLabel.Location = New-Object System.Drawing.Point(10, $y)
                $regLabel.Size = New-Object System.Drawing.Size(100, 20)
                $regLabel.Font = New-Object System.Drawing.Font("Segoe UI", 9, [System.Drawing.FontStyle]::Bold)
                $script:ConfigDetailsPanel.Controls.Add($regLabel)
                $y += 25
                
                foreach ($regKey in $mapping.Registry) {
                    $regKeyLabel = New-Object System.Windows.Forms.Label
                    $regKeyLabel.Text = $regKey
                    $regKeyLabel.Location = New-Object System.Drawing.Point(20, $y)
                    $regKeyLabel.Size = New-Object System.Drawing.Size(500, 20)
                    $script:ConfigDetailsPanel.Controls.Add($regKeyLabel)
                    $y += 25
                }
            }
        }
    }
}

# Logs Events
function Refresh-LogsDisplay {
    <#
    .SYNOPSIS
        Refreshes the logs display with filtering
    #>
    
    if (-not $script:LogsTextBox) { return }
    
    try {
        $logFile = $script:CurrentConfig.LogFile
        if (Test-Path $logFile) {
            $logContent = Get-Content $logFile | Where-Object { $_ -ne "" }
            $selectedLevel = $script:LogLevelCombo.SelectedItem
            
            if ($selectedLevel -and $selectedLevel -ne "All") {
                $logContent = $logContent | Where-Object { $_ -match "\[$selectedLevel\]" }
            }
            
            $script:LogsTextBox.Text = $logContent -join "`r`n"
            $script:LogsTextBox.SelectionStart = $script:LogsTextBox.Text.Length
            $script:LogsTextBox.ScrollToCaret()
        }
    }
    catch {
        $script:LogsTextBox.Text = "Error loading logs: $_"
    }
}

function Clear-LogsDisplay {
    <#
    .SYNOPSIS
        Clears the logs display and optionally the log file
    #>
    
    $result = [System.Windows.Forms.MessageBox]::Show(
        "Do you want to clear the log file as well?",
        "Clear Logs",
        [System.Windows.Forms.MessageBoxButtons]::YesNoCancel,
        [System.Windows.Forms.MessageBoxIcon]::Question
    )
    
    if ($result -eq [System.Windows.Forms.DialogResult]::Cancel) {
        return
    }
    
    $script:LogsTextBox.Text = ""
    
    if ($result -eq [System.Windows.Forms.DialogResult]::Yes) {
        try {
            Clear-Content $script:CurrentConfig.LogFile -ErrorAction SilentlyContinue
        }
        catch {
            [System.Windows.Forms.MessageBox]::Show(
                "Error clearing log file: $_",
                "Error",
                [System.Windows.Forms.MessageBoxButtons]::OK,
                [System.Windows.Forms.MessageBoxIcon]::Error
            )
        }
    }
}

function Export-LogsToFile {
    <#
    .SYNOPSIS
        Exports logs to a file
    #>
    
    $saveDialog = New-Object System.Windows.Forms.SaveFileDialog
    $saveDialog.Filter = "Text files (*.txt)|*.txt|All files (*.*)|*.*"
    $saveDialog.DefaultExt = "txt"
    $saveDialog.FileName = "SoftwareManager_Logs_$(Get-Date -Format 'yyyyMMdd_HHmmss').txt"
    
    if ($saveDialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
        try {
            $script:LogsTextBox.Text | Out-File -FilePath $saveDialog.FileName -Encoding UTF8
            [System.Windows.Forms.MessageBox]::Show(
                "Logs exported successfully to $($saveDialog.FileName)",
                "Export Complete",
                [System.Windows.Forms.MessageBoxButtons]::OK,
                [System.Windows.Forms.MessageBoxIcon]::Information
            )
        }
        catch {
            [System.Windows.Forms.MessageBox]::Show(
                "Error exporting logs: $_",
                "Export Error",
                [System.Windows.Forms.MessageBoxButtons]::OK,
                [System.Windows.Forms.MessageBoxIcon]::Error
            )
        }
    }
    
    $saveDialog.Dispose()
}

function Start-ConfigurationValidation {
    <#
    .SYNOPSIS
        Validates the current configuration
    #>
      $validationResults = @()
    
    # Check packages.txt
    if (Test-Path $script:CurrentConfig.PackagesFile) {
        $validationResults += "OK packages.txt found"
    } else {
        $validationResults += "ERROR packages.txt not found"
    }
    
    # Check ConfigMappings.ps1
    if (Test-Path $script:CurrentConfig.ConfigMappingsFile) {
        $validationResults += "OK ConfigMappings.ps1 found"
    } else {
        $validationResults += "ERROR ConfigMappings.ps1 not found"
    }
    
    # Check winget availability
    try {
        $wingetVersion = winget --version 2>$null
        if ($wingetVersion) {
            $validationResults += "OK Winget available (version: $wingetVersion)"
        } else {
            $validationResults += "ERROR Winget not available or not responding"
        }
    }
    catch {
        $validationResults += "ERROR Winget not available: $_"
    }
    
    # Check administrator privileges
    if (([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
        $validationResults += "OK Running with administrator privileges"
    } else {
        $validationResults += "ERROR Not running with administrator privileges"
    }
    
    $resultText = $validationResults -join "`r`n"
    
    [System.Windows.Forms.MessageBox]::Show(
        $resultText,
        "Configuration Validation",
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Information
    )
}

# Export functions
Export-ModuleMember -Function Show-AddPackageDialog, Remove-SelectedPackage, Import-CurrentPackages, Refresh-PackageStatus, Save-PackagesList, Start-ExportOperation, Start-BackupOperation, Start-InstallOperation, Stop-CurrentOperation, Show-WingetSearchDialog, Show-AboutDialog, Show-ConfigMappingDetails, Refresh-LogsDisplay, Clear-LogsDisplay, Export-LogsToFile, Start-ConfigurationValidation
