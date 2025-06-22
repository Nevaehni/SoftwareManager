#Requires -Version 5.1
#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Software Manager GUI - Simplified Working Version

.DESCRIPTION
    A simplified but fully functional GUI for the Software Manager application.
    This version provides all core functionality with a cleaner implementation.

.NOTES
    Author: GitHub Copilot
    Version: 1.0
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
    Import-Module "$ModulesPath\Core\Common.psm1" -Force
    Import-Module "$ModulesPath\System\Prerequisites.psm1" -Force
    Import-Module "$ModulesPath\Package\PackageManager.psm1" -Force
    Import-Module "$ModulesPath\Config\ConfigManager.psm1" -Force
    Import-Module "$ModulesPath\Modes\ExportMode.psm1" -Force
    Import-Module "$ModulesPath\Modes\BackupMode.psm1" -Force
    Import-Module "$ModulesPath\Modes\InstallMode.psm1" -Force
}
catch {
    Write-Host "Failed to import required modules: $_" -ForegroundColor Red
    Write-Host "Please ensure all module files are present in the Modules directory." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 2
}

# Global variables
$script:Config = $null
$script:PackageList = @()
$script:ConfigMappings = @{}

function Initialize-GUIData {
    <#
    .SYNOPSIS
        Initializes GUI data by loading packages and config mappings
    #>
    
    try {
        # Load packages from packages.txt
        $script:PackageList = @()
        if (Test-Path $script:Config.PackagesFile) {
            $packages = Get-Content $script:Config.PackagesFile | Where-Object { $_.Trim() -ne "" }
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
        if (Test-Path $script:Config.ConfigMappingsFile) {
            try {
                . $script:Config.ConfigMappingsFile
                $script:ConfigMappings = $ConfigMappings
            }
            catch {
                Write-SoftwareManagerLog -Config $script:Config -Message "Error loading config mappings: $_" -Level Error
            }
        }
        
        # Refresh GUI controls
        Refresh-PackagesGrid
        Refresh-ConfigList
    }
    catch {
        Write-SoftwareManagerLog -Config $script:Config -Message "Error initializing GUI data: $_" -Level Error
    }
}

function Refresh-PackagesGrid {
    <#
    .SYNOPSIS
        Refreshes the packages grid with current data
    #>
    
    if ($script:PackagesGrid) {
        $script:PackagesGrid.Rows.Clear()
        foreach ($package in $script:PackageList) {
            $row = $script:PackagesGrid.Rows.Add()
            $script:PackagesGrid.Rows[$row].Cells[0].Value = $package.PackageId
            $script:PackagesGrid.Rows[$row].Cells[1].Value = $package.HasConfig
            $script:PackagesGrid.Rows[$row].Cells[2].Value = $package.Status
        }
    }
}

function Refresh-ConfigList {
    <#
    .SYNOPSIS
        Refreshes the config mappings list
    #>
    
    if ($script:ConfigListBox) {
        $script:ConfigListBox.Items.Clear()
        foreach ($package in ($script:ConfigMappings.Keys | Sort-Object)) {
            [void]$script:ConfigListBox.Items.Add($package)
        }
    }
}

function Show-PackageSearchDialog {
    <#
    .SYNOPSIS
        Shows a dialog to search for and select packages from winget
    #>
    
    $searchForm = New-Object System.Windows.Forms.Form
    $searchForm.Text = "Search and Add Package"
    $searchForm.Size = New-Object System.Drawing.Size(700, 500)
    $searchForm.StartPosition = "CenterParent"
    $searchForm.MinimumSize = New-Object System.Drawing.Size(600, 400)
    
    # Search panel
    $searchPanel = New-Object System.Windows.Forms.Panel
    $searchPanel.Height = 60
    $searchPanel.Dock = [System.Windows.Forms.DockStyle]::Top
    $searchPanel.Padding = New-Object System.Windows.Forms.Padding(10)
    
    $searchLabel = New-Object System.Windows.Forms.Label
    $searchLabel.Text = "Search for packages:"
    $searchLabel.Location = New-Object System.Drawing.Point(10, 10)
    $searchLabel.Size = New-Object System.Drawing.Size(120, 20)
    
    $searchTextBox = New-Object System.Windows.Forms.TextBox
    $searchTextBox.Location = New-Object System.Drawing.Point(10, 35)
    $searchTextBox.Size = New-Object System.Drawing.Size(400, 20)
    
    $searchButton = New-Object System.Windows.Forms.Button
    $searchButton.Text = "Search"
    $searchButton.Location = New-Object System.Drawing.Point(420, 33)
    $searchButton.Size = New-Object System.Drawing.Size(80, 25)
    
    $clearButton = New-Object System.Windows.Forms.Button
    $clearButton.Text = "Clear"
    $clearButton.Location = New-Object System.Drawing.Point(510, 33)
    $clearButton.Size = New-Object System.Drawing.Size(60, 25)
    
    $searchPanel.Controls.AddRange(@($searchLabel, $searchTextBox, $searchButton, $clearButton))
    
    # Results grid
    $resultsGrid = New-Object System.Windows.Forms.DataGridView
    $resultsGrid.Dock = [System.Windows.Forms.DockStyle]::Fill
    $resultsGrid.AllowUserToAddRows = $false
    $resultsGrid.AllowUserToDeleteRows = $false
    $resultsGrid.SelectionMode = [System.Windows.Forms.DataGridViewSelectionMode]::FullRowSelect
    $resultsGrid.MultiSelect = $false
    $resultsGrid.AutoSizeColumnsMode = [System.Windows.Forms.DataGridViewAutoSizeColumnsMode]::Fill
    $resultsGrid.ReadOnly = $true
    
    # Add columns
    $idColumn = New-Object System.Windows.Forms.DataGridViewTextBoxColumn
    $idColumn.Name = "Id"
    $idColumn.HeaderText = "Package ID"
    $idColumn.Width = 250
    
    $nameColumn = New-Object System.Windows.Forms.DataGridViewTextBoxColumn
    $nameColumn.Name = "Name"
    $nameColumn.HeaderText = "Name"
    $nameColumn.Width = 200
    
    $versionColumn = New-Object System.Windows.Forms.DataGridViewTextBoxColumn
    $versionColumn.Name = "Version"
    $versionColumn.HeaderText = "Version"
    $versionColumn.Width = 100
    
    $sourceColumn = New-Object System.Windows.Forms.DataGridViewTextBoxColumn
    $sourceColumn.Name = "Source"
    $sourceColumn.HeaderText = "Source"
    $sourceColumn.Width = 80
    
    [void]$resultsGrid.Columns.Add($idColumn)
    [void]$resultsGrid.Columns.Add($nameColumn)
    [void]$resultsGrid.Columns.Add($versionColumn)
    [void]$resultsGrid.Columns.Add($sourceColumn)
    
    # Status label
    $statusLabel = New-Object System.Windows.Forms.Label
    $statusLabel.Text = "Enter a search term and click Search to find packages"
    $statusLabel.Dock = [System.Windows.Forms.DockStyle]::Bottom
    $statusLabel.Height = 25
    $statusLabel.Padding = New-Object System.Windows.Forms.Padding(10, 5, 10, 5)
    $statusLabel.BackColor = [System.Drawing.SystemColors]::Control
    
    # Buttons panel
    $buttonPanel = New-Object System.Windows.Forms.Panel
    $buttonPanel.Height = 50
    $buttonPanel.Dock = [System.Windows.Forms.DockStyle]::Bottom
    
    $selectButton = New-Object System.Windows.Forms.Button
    $selectButton.Text = "Add Selected Package"
    $selectButton.Location = New-Object System.Drawing.Point(400, 10)
    $selectButton.Size = New-Object System.Drawing.Size(140, 30)
    $selectButton.Enabled = $false
    $selectButton.DialogResult = [System.Windows.Forms.DialogResult]::OK
    
    $cancelButton = New-Object System.Windows.Forms.Button
    $cancelButton.Text = "Cancel"
    $cancelButton.Location = New-Object System.Drawing.Point(550, 10)
    $cancelButton.Size = New-Object System.Drawing.Size(80, 30)
    $cancelButton.DialogResult = [System.Windows.Forms.DialogResult]::Cancel
    
    $manualButton = New-Object System.Windows.Forms.Button
    $manualButton.Text = "Enter Manually"
    $manualButton.Location = New-Object System.Drawing.Point(10, 10)
    $manualButton.Size = New-Object System.Drawing.Size(100, 30)
    
    $buttonPanel.Controls.AddRange(@($selectButton, $cancelButton, $manualButton))
      # Search functionality
    $searchAction = {
        if ($searchTextBox.Text.Trim() -eq "") {
            $statusLabel.Text = "Please enter a search term"
            return
        }
        
        $statusLabel.Text = "Searching packages..."
        $searchButton.Enabled = $false
        $resultsGrid.Rows.Clear()
        [System.Windows.Forms.Application]::DoEvents()
        
        try {
            $searchTerm = $searchTextBox.Text.Trim()
            
            # Use different approach for running winget search
            $psi = New-Object System.Diagnostics.ProcessStartInfo
            $psi.FileName = "winget.exe"
            $psi.Arguments = "search `"$searchTerm`" --accept-source-agreements"
            $psi.UseShellExecute = $false
            $psi.RedirectStandardOutput = $true
            $psi.RedirectStandardError = $true
            $psi.CreateNoWindow = $true
            
            $process = New-Object System.Diagnostics.Process
            $process.StartInfo = $psi
            $process.Start() | Out-Null
            
            $output = $process.StandardOutput.ReadToEnd()
            $errorOutput = $process.StandardError.ReadToEnd()
            $process.WaitForExit()
              if ($process.ExitCode -eq 0 -and $output) {
                $lines = $output -split "`r?`n" | Where-Object { $_.Trim() -ne "" }
                
                # Debug: Write raw output to console for troubleshooting
                Write-Host "=== RAW WINGET OUTPUT ===" -ForegroundColor Yellow
                Write-Host $output -ForegroundColor Cyan
                Write-Host "=== END RAW OUTPUT ===" -ForegroundColor Yellow
                
                $foundPackages = 0
                $inResults = $false
                $headerFound = $false
                $namePos = 0
                $idPos = 0
                $versionPos = 0
                $sourcePos = 0
                
                foreach ($line in $lines) {
                    Write-Host "Processing line: '$line'" -ForegroundColor Gray
                    
                    # Look for the header line that indicates start of results
                    if ($line -match "^Name\s+Id\s+Version" -or $line -match "Name.*Id.*Version") {
                        Write-Host "Found header line" -ForegroundColor Green
                        
                        # Capture column positions from header
                        $namePos = $line.IndexOf("Name")
                        $idPos = $line.IndexOf("Id")
                        $versionPos = $line.IndexOf("Version") 
                        $sourcePos = $line.IndexOf("Source")
                        
                        Write-Host "Column positions - Name: $namePos, Id: $idPos, Version: $versionPos, Source: $sourcePos" -ForegroundColor Yellow
                        
                        $inResults = $true
                        $headerFound = $true
                        continue
                    }
                    
                    # Skip separator lines
                    if ($line -match "^-+\s+-+\s+-+" -or $line.Trim() -match "^-+$") {
                        Write-Host "Skipping separator line" -ForegroundColor Gray
                        continue
                    }
                      if ($inResults -and $headerFound -and $line.Trim() -ne "") {
                        Write-Host "Parsing data line: '$line'" -ForegroundColor White
                        
                        try {
                            # Use a more robust parsing approach
                            # Remove multiple spaces and split on single spaces, but be smarter about it
                            $cleanLine = $line -replace '\s+', ' '
                            $parts = $cleanLine.Trim() -split ' '
                            
                            # Winget output typically has: Name [multiple words] | Id | Version | [Match info] | Source
                            # Look for the pattern where we have something that looks like a package ID
                            $packageId = ""
                            $packageName = ""
                            $packageVersion = ""
                            $packageSource = "winget"
                            
                            # Find the package ID (usually contains dots or is a well-formed identifier)
                            $idIndex = -1
                            for ($i = 0; $i -lt $parts.Count; $i++) {
                                $part = $parts[$i]
                                # Package IDs typically have dots, are alphanumeric with dashes/underscores, and are not common words
                                if ($part -match '^[a-zA-Z0-9][a-zA-Z0-9\.\-_]+[a-zA-Z0-9]$' -and 
                                    $part.Length -gt 3 -and 
                                    $part -notmatch '^(Name|Id|Version|Match|Source|Tag|Moniker)$' -and
                                    ($part.Contains('.') -or $part.Length -gt 8)) {
                                    $packageId = $part
                                    $idIndex = $i
                                    break
                                }
                            }
                            
                            if ($packageId -ne "" -and $idIndex -ge 0) {
                                # Package name is everything before the ID
                                if ($idIndex -gt 0) {
                                    $packageName = ($parts[0..($idIndex-1)] -join ' ').Trim()
                                }
                                
                                # Version is typically the next part after ID
                                if ($idIndex + 1 -lt $parts.Count) {
                                    $nextPart = $parts[$idIndex + 1]
                                    # Check if it looks like a version (contains numbers/dots)
                                    if ($nextPart -match '^[\d\.\-\w]+$' -and $nextPart -notmatch '^(Tag|Moniker|winget)$') {
                                        $packageVersion = $nextPart
                                    }
                                }
                                
                                # Find source (usually "winget" at the end)
                                $sourceIndex = -1
                                for ($i = $parts.Count - 1; $i -ge 0; $i--) {
                                    if ($parts[$i] -eq "winget" -or $parts[$i] -eq "msstore") {
                                        $packageSource = $parts[$i]
                                        break
                                    }
                                }
                                
                                Write-Host "Parsed: Name='$packageName', Id='$packageId', Version='$packageVersion', Source='$packageSource'" -ForegroundColor Green
                                
                                # Add to grid if we have at least a valid ID
                                if ($packageId -ne "") {
                                    $row = $resultsGrid.Rows.Add()
                                    $resultsGrid.Rows[$row].Cells[0].Value = $packageId
                                    $resultsGrid.Rows[$row].Cells[1].Value = if ($packageName) { $packageName } else { $packageId }
                                    $resultsGrid.Rows[$row].Cells[2].Value = if ($packageVersion) { $packageVersion } else { "Unknown" }
                                    $resultsGrid.Rows[$row].Cells[3].Value = $packageSource
                                    $foundPackages++
                                }
                            } else {
                                Write-Host "Could not identify package ID in line: '$line'" -ForegroundColor Yellow
                            }
                        }
                        catch {
                            Write-Host "Error parsing line: $($_.Message)" -ForegroundColor Red
                            continue
                        }
                    }
                }
                
                if ($foundPackages -eq 0) {
                    $statusLabel.Text = "No packages found matching '$searchTerm'"
                } else {
                    $statusLabel.Text = "Found $foundPackages packages"
                }
            }
            else {
                $errorMessage = if ($errorOutput) { $errorOutput } else { "No results returned" }
                $statusLabel.Text = "Search failed: $errorMessage"
                
                # If winget is not found, show helpful message
                if ($process.ExitCode -eq -1 -or $errorOutput -like "*not recognized*") {
                    $statusLabel.Text = "Winget not found. Please install Windows Package Manager."
                }
            }
        }
        catch {
            $statusLabel.Text = "Error during search: $($_.Message)"
            Write-Host "Search error details: $_" -ForegroundColor Red
        }
        finally {
            $searchButton.Enabled = $true
        }
    }
    
    # Event handlers
    $searchButton.add_Click($searchAction)
    
    $searchTextBox.add_KeyDown({
        param($sender, $e)
        if ($e.KeyCode -eq [System.Windows.Forms.Keys]::Enter) {
            $searchAction.Invoke()
        }
    })
    
    $clearButton.add_Click({
        $searchTextBox.Text = ""
        $resultsGrid.Rows.Clear()
        $statusLabel.Text = "Enter a search term and click Search to find packages"
        $selectButton.Enabled = $false
    })
    
    $resultsGrid.add_SelectionChanged({
        $selectButton.Enabled = $resultsGrid.SelectedRows.Count -gt 0
    })
    
    $resultsGrid.add_DoubleClick({
        if ($resultsGrid.SelectedRows.Count -gt 0) {
            $searchForm.DialogResult = [System.Windows.Forms.DialogResult]::OK
            $searchForm.Close()
        }
    })
    
    $manualButton.add_Click({
        $packageId = [Microsoft.VisualBasic.Interaction]::InputBox("Enter Package ID manually:", "Manual Entry", "")
        if ($packageId -and $packageId.Trim() -ne "") {
            $searchForm.Tag = $packageId.Trim()
            $searchForm.DialogResult = [System.Windows.Forms.DialogResult]::OK
            $searchForm.Close()
        }
    })
    
    # Add controls to form
    $searchForm.Controls.Add($resultsGrid)
    $searchForm.Controls.Add($searchPanel)
    $searchForm.Controls.Add($statusLabel)
    $searchForm.Controls.Add($buttonPanel)
    
    $searchForm.AcceptButton = $selectButton
    $searchForm.CancelButton = $cancelButton
    
    # Show dialog and return result
    $result = $searchForm.ShowDialog()
    $selectedPackageId = $null
    
    if ($result -eq [System.Windows.Forms.DialogResult]::OK) {
        if ($searchForm.Tag) {
            # Manual entry
            $selectedPackageId = $searchForm.Tag
        }
        elseif ($resultsGrid.SelectedRows.Count -gt 0) {
            # Selected from grid
            $selectedPackageId = $resultsGrid.SelectedRows[0].Cells[0].Value
        }
    }
    
    $searchForm.Dispose()
    return $selectedPackageId
}

function Add-NewPackage {
    <#
    .SYNOPSIS
        Shows dialog to add a new package with search functionality
    #>
    
    $selectedPackage = Show-PackageSearchDialog
    
    if ($selectedPackage -and $selectedPackage.Trim() -ne "") {
        $packageId = $selectedPackage.Trim()
        
        # Check if package already exists
        $exists = $script:PackageList | Where-Object { $_.PackageId -eq $packageId }
        if ($exists) {
            [System.Windows.Forms.MessageBox]::Show("Package '$packageId' already exists.", "Duplicate Package", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Warning)
            return
        }
        
        $newPackage = [PSCustomObject]@{
            PackageId = $packageId
            HasConfig = $false
            Status = "Unknown"
        }
        $script:PackageList += $newPackage
        Save-PackagesList
        Refresh-PackagesGrid
    }
}

function Remove-SelectedPackage {
    <#
    .SYNOPSIS
        Removes the selected package from the list
    #>
    
    if ($script:PackagesGrid.SelectedRows.Count -gt 0) {
        $selectedIndex = $script:PackagesGrid.SelectedRows[0].Index
        if ($selectedIndex -ge 0 -and $selectedIndex -lt $script:PackageList.Count) {
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
        
        $packagesContent | Out-File -FilePath $script:Config.PackagesFile -Encoding UTF8
        Write-SoftwareManagerLog -Config $script:Config -Message "Packages list saved to $($script:Config.PackagesFile)"
    }
    catch {
        Write-SoftwareManagerLog -Config $script:Config -Message "Error saving packages list: $_" -Level Error
        [System.Windows.Forms.MessageBox]::Show("Error saving packages list: $_", "Save Error", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Error)
    }
}

function Start-ExportOperation {
    <#
    .SYNOPSIS
        Starts the export operation
    #>
    
    try {
        $script:StatusLabel.Text = "Running Export operation..."
        [System.Windows.Forms.Application]::DoEvents()
        
        Start-ExportMode -Config $script:Config
        
        $script:StatusLabel.Text = "Export operation completed"
        [System.Windows.Forms.MessageBox]::Show("Export operation completed successfully.", "Operation Complete", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Information)
        
        # Refresh data after export
        Initialize-GUIData
    }
    catch {
        $script:StatusLabel.Text = "Export operation failed"
        Write-SoftwareManagerLog -Config $script:Config -Message "Export operation failed: $_" -Level Error
        [System.Windows.Forms.MessageBox]::Show("Export operation failed: $_", "Operation Error", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Error)
    }
}

function Start-BackupOperation {
    <#
    .SYNOPSIS
        Starts the backup operation
    #>
    
    try {
        # Initialize config mappings
        Initialize-ConfigMappings -Config $script:Config
        
        $script:StatusLabel.Text = "Running Backup operation..."
        [System.Windows.Forms.Application]::DoEvents()
        
        Start-BackupMode -Config $script:Config
        
        $script:StatusLabel.Text = "Backup operation completed"
        [System.Windows.Forms.MessageBox]::Show("Backup operation completed successfully.", "Operation Complete", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Information)
    }
    catch {
        $script:StatusLabel.Text = "Backup operation failed"
        Write-SoftwareManagerLog -Config $script:Config -Message "Backup operation failed: $_" -Level Error
        [System.Windows.Forms.MessageBox]::Show("Backup operation failed: $_", "Operation Error", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Error)
    }
}

function Start-InstallOperation {
    <#
    .SYNOPSIS
        Starts the install operation
    #>
    
    try {
        # Initialize config mappings
        Initialize-ConfigMappings -Config $script:Config
        
        $forceInstall = $script:ForceCheckBox.Checked
        
        $script:StatusLabel.Text = "Running Install operation..."
        [System.Windows.Forms.Application]::DoEvents()
        
        Start-InstallMode -Config $script:Config -Force $forceInstall
        
        $script:StatusLabel.Text = "Install operation completed"
        [System.Windows.Forms.MessageBox]::Show("Install operation completed successfully.", "Operation Complete", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Information)
        
        # Refresh data after install
        Initialize-GUIData
    }
    catch {
        $script:StatusLabel.Text = "Install operation failed"
        Write-SoftwareManagerLog -Config $script:Config -Message "Install operation failed: $_" -Level Error
        [System.Windows.Forms.MessageBox]::Show("Install operation failed: $_", "Operation Error", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Error)
    }
}

function Show-LogsDialog {
    <#
    .SYNOPSIS
        Shows a dialog with current logs
    #>
    
    $logForm = New-Object System.Windows.Forms.Form
    $logForm.Text = "Software Manager Logs"
    $logForm.Size = New-Object System.Drawing.Size(800, 600)
    $logForm.StartPosition = "CenterParent"
    
    $logTextBox = New-Object System.Windows.Forms.RichTextBox
    $logTextBox.Dock = [System.Windows.Forms.DockStyle]::Fill
    $logTextBox.ReadOnly = $true
    $logTextBox.Font = New-Object System.Drawing.Font("Consolas", 9)
    
    try {
        if (Test-Path $script:Config.LogFile) {
            $logContent = Get-Content $script:Config.LogFile -Raw
            $logTextBox.Text = $logContent
        } else {
            $logTextBox.Text = "No log file found."
        }
    }
    catch {
        $logTextBox.Text = "Error loading logs: $_"
    }
    
    $logForm.Controls.Add($logTextBox)
    [void]$logForm.ShowDialog()
    $logForm.Dispose()
}

function Create-MainForm {
    <#
    .SYNOPSIS
        Creates the main GUI form
    #>
    
    # Create main form
    $form = New-Object System.Windows.Forms.Form
    $form.Text = "Software Manager v3.0 - GUI Edition"
    $form.Size = New-Object System.Drawing.Size(900, 700)
    $form.StartPosition = "CenterScreen"
    $form.MinimumSize = New-Object System.Drawing.Size(800, 600)
    
    # Create tab control
    $tabControl = New-Object System.Windows.Forms.TabControl
    $tabControl.Dock = [System.Windows.Forms.DockStyle]::Fill
    
    # Packages Tab
    $packagesTab = New-Object System.Windows.Forms.TabPage
    $packagesTab.Text = "Packages"
    
    $packagesPanel = New-Object System.Windows.Forms.Panel
    $packagesPanel.Dock = [System.Windows.Forms.DockStyle]::Fill
    $packagesPanel.Padding = New-Object System.Windows.Forms.Padding(10)
    
    # Packages toolbar
    $packagesToolbar = New-Object System.Windows.Forms.Panel
    $packagesToolbar.Height = 40
    $packagesToolbar.Dock = [System.Windows.Forms.DockStyle]::Top
      $addPackageBtn = New-Object System.Windows.Forms.Button
    $addPackageBtn.Text = "Search & Add Package"
    $addPackageBtn.Location = New-Object System.Drawing.Point(10, 5)
    $addPackageBtn.Size = New-Object System.Drawing.Size(140, 30)
    $addPackageBtn.add_Click({ Add-NewPackage })
      $removePackageBtn = New-Object System.Windows.Forms.Button
    $removePackageBtn.Text = "Remove Package"
    $removePackageBtn.Location = New-Object System.Drawing.Point(160, 5)
    $removePackageBtn.Size = New-Object System.Drawing.Size(120, 30)
    $removePackageBtn.add_Click({ Remove-SelectedPackage })
    
    $packagesToolbar.Controls.Add($addPackageBtn)
    $packagesToolbar.Controls.Add($removePackageBtn)
    
    # Packages grid
    $script:PackagesGrid = New-Object System.Windows.Forms.DataGridView
    $script:PackagesGrid.Dock = [System.Windows.Forms.DockStyle]::Fill
    $script:PackagesGrid.AllowUserToAddRows = $false
    $script:PackagesGrid.AllowUserToDeleteRows = $false
    $script:PackagesGrid.SelectionMode = [System.Windows.Forms.DataGridViewSelectionMode]::FullRowSelect
    $script:PackagesGrid.MultiSelect = $false
    $script:PackagesGrid.AutoSizeColumnsMode = [System.Windows.Forms.DataGridViewAutoSizeColumnsMode]::Fill
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
            $script:PackageList[$e.RowIndex].HasConfig = $sender.Rows[$e.RowIndex].Cells[1].Value
            Save-PackagesList
        }
    })
    
    $packagesPanel.Controls.Add($script:PackagesGrid)
    $packagesPanel.Controls.Add($packagesToolbar)
    $packagesTab.Controls.Add($packagesPanel)
    
    # Config Mappings Tab
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
    $addMappingBtn.add_Click({ Add-ConfigMapping })
    
    $refreshConfigBtn = New-Object System.Windows.Forms.Button
    $refreshConfigBtn.Text = "Refresh"
    $refreshConfigBtn.Location = New-Object System.Drawing.Point(205, 5)
    $refreshConfigBtn.Size = New-Object System.Drawing.Size(70, 30)
    $refreshConfigBtn.add_Click({ 
        Initialize-GUIData
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
    
    # Operations Tab
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
    $exportBtn.add_Click({ Start-ExportOperation })
    
    $backupBtn = New-Object System.Windows.Forms.Button
    $backupBtn.Text = "Backup Configs"
    $backupBtn.Size = New-Object System.Drawing.Size(180, 60)
    $backupBtn.Location = New-Object System.Drawing.Point(220, 20)
    $backupBtn.Font = New-Object System.Drawing.Font("Segoe UI", 11, [System.Drawing.FontStyle]::Bold)
    $backupBtn.add_Click({ Start-BackupOperation })
    
    $installBtn = New-Object System.Windows.Forms.Button
    $installBtn.Text = "Install & Restore"
    $installBtn.Size = New-Object System.Drawing.Size(180, 60)
    $installBtn.Location = New-Object System.Drawing.Point(420, 20)
    $installBtn.Font = New-Object System.Drawing.Font("Segoe UI", 11, [System.Drawing.FontStyle]::Bold)
    $installBtn.add_Click({ Start-InstallOperation })
    
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
    $logsBtn.add_Click({ Show-LogsDialog })
    
    $operationsPanel.Controls.Add($exportBtn)
    $operationsPanel.Controls.Add($backupBtn)
    $operationsPanel.Controls.Add($installBtn)
    $operationsPanel.Controls.Add($script:ForceCheckBox)
    $operationsPanel.Controls.Add($logsBtn)
    $operationsTab.Controls.Add($operationsPanel)
    
    # Add tabs to tab control
    $tabControl.TabPages.Add($packagesTab)
    $tabControl.TabPages.Add($configTab)
    $tabControl.TabPages.Add($operationsTab)
      # Status bar
    $statusStrip = New-Object System.Windows.Forms.StatusStrip
    $script:StatusLabel = New-Object System.Windows.Forms.ToolStripStatusLabel
    $script:StatusLabel.Text = "Ready"
    $script:StatusLabel.Spring = $true
    [void]$statusStrip.Items.Add($script:StatusLabel)
    
    # Add controls to form
    $form.Controls.Add($tabControl)
    $form.Controls.Add($statusStrip)
    
    return $form
}

function Start-SoftwareManagerGUI {
    <#
    .SYNOPSIS
        Main function to start the GUI
    #>
    
    try {
        # Initialize configuration
        $script:Config = New-SoftwareManagerConfig -ScriptPath $PSScriptRoot
        Write-SoftwareManagerLog -Config $script:Config -Message "Software Manager GUI started (Simple Version 1.0)"
        
        # Test system prerequisites
        if (-not (Test-SystemPrerequisites -Config $script:Config)) {
            [System.Windows.Forms.MessageBox]::Show("System prerequisites check failed. Please check the log for details.", "Software Manager GUI", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Error)
            return
        }        # Create and show the main form
        $mainForm = Create-MainForm
        
        # Load initial data
        Initialize-GUIData
        
        # Show the form
        $mainForm.add_Shown({ $mainForm.Activate() })
        [void]$mainForm.ShowDialog()
    }
    catch {
        Write-SoftwareManagerLog -Config $script:Config -Message "GUI Error: $_" -Level Error
        [System.Windows.Forms.MessageBox]::Show("An error occurred while running the GUI: $_", "Software Manager GUI", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Error)
    }
}

function Open-ConfigMappingsFile {
    <#
    .SYNOPSIS
        Opens the ConfigMappings.ps1 file in the default editor
    #>
    
    try {
        if (Test-Path $script:Config.ConfigMappingsFile) {
            Start-Process notepad.exe -ArgumentList $script:Config.ConfigMappingsFile
        } else {
            [System.Windows.Forms.MessageBox]::Show(
                "ConfigMappings.ps1 file not found at: $($script:Config.ConfigMappingsFile)",
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

function Add-ConfigMapping {
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
        
        if ($script:ConfigMappings.ContainsKey($packageId)) {
            [System.Windows.Forms.MessageBox]::Show(
                "Config mapping for '$packageId' already exists.",
                "Duplicate Mapping",
                [System.Windows.Forms.MessageBoxButtons]::OK,
                [System.Windows.Forms.MessageBoxIcon]::Warning
            )
            return
        }
        
        Show-ConfigMappingEditor -PackageId $packageId -IsNew $true
    }
}

function Edit-SelectedConfigMapping {
    <#
    .SYNOPSIS
        Edits the selected config mapping
    #>
    
    if ($script:ConfigListBox.SelectedItem) {
        $packageId = $script:ConfigListBox.SelectedItem.ToString()
        Show-ConfigMappingEditor -PackageId $packageId -IsNew $false
    }
}

function Show-ConfigMappingEditor {
    <#
    .SYNOPSIS
        Shows a dialog to edit config mapping details
    #>
    param(
        [string]$PackageId,
        [bool]$IsNew
    )
    
    $editorForm = New-Object System.Windows.Forms.Form
    $editorForm.Text = if ($IsNew) { "Add Config Mapping - $PackageId" } else { "Edit Config Mapping - $PackageId" }
    $editorForm.Size = New-Object System.Drawing.Size(600, 500)
    $editorForm.StartPosition = "CenterParent"
    $editorForm.FormBorderStyle = [System.Windows.Forms.FormBorderStyle]::Sizable
    
    # Package ID (read-only if editing existing)
    $packageLabel = New-Object System.Windows.Forms.Label
    $packageLabel.Text = "Package ID:"
    $packageLabel.Location = New-Object System.Drawing.Point(10, 15)
    $packageLabel.Size = New-Object System.Drawing.Size(80, 20)
    
    $packageTextBox = New-Object System.Windows.Forms.TextBox
    $packageTextBox.Text = $PackageId
    $packageTextBox.Location = New-Object System.Drawing.Point(100, 15)
    $packageTextBox.Size = New-Object System.Drawing.Size(250, 20)
    $packageTextBox.ReadOnly = -not $IsNew
    
    # Files section
    $filesLabel = New-Object System.Windows.Forms.Label
    $filesLabel.Text = "Configuration Files:"
    $filesLabel.Location = New-Object System.Drawing.Point(10, 50)
    $filesLabel.Size = New-Object System.Drawing.Size(150, 20)
    
    $filesTextBox = New-Object System.Windows.Forms.TextBox
    $filesTextBox.Location = New-Object System.Drawing.Point(10, 75)
    $filesTextBox.Size = New-Object System.Drawing.Size(560, 100)
    $filesTextBox.Multiline = $true
    $filesTextBox.ScrollBars = [System.Windows.Forms.ScrollBars]::Vertical
    
    # Folders section
    $foldersLabel = New-Object System.Windows.Forms.Label
    $foldersLabel.Text = "Configuration Folders:"
    $foldersLabel.Location = New-Object System.Drawing.Point(10, 185)
    $foldersLabel.Size = New-Object System.Drawing.Size(150, 20)
    
    $foldersTextBox = New-Object System.Windows.Forms.TextBox
    $foldersTextBox.Location = New-Object System.Drawing.Point(10, 210)
    $foldersTextBox.Size = New-Object System.Drawing.Size(560, 80)
    $foldersTextBox.Multiline = $true
    $foldersTextBox.ScrollBars = [System.Windows.Forms.ScrollBars]::Vertical
    
    # Registry section
    $registryLabel = New-Object System.Windows.Forms.Label
    $registryLabel.Text = "Registry Keys:"
    $registryLabel.Location = New-Object System.Drawing.Point(10, 300)
    $registryLabel.Size = New-Object System.Drawing.Size(150, 20)
    
    $registryTextBox = New-Object System.Windows.Forms.TextBox
    $registryTextBox.Location = New-Object System.Drawing.Point(10, 325)
    $registryTextBox.Size = New-Object System.Drawing.Size(560, 80)
    $registryTextBox.Multiline = $true
    $registryTextBox.ScrollBars = [System.Windows.Forms.ScrollBars]::Vertical
    
    # Load existing data if editing
    if (-not $IsNew -and $script:ConfigMappings.ContainsKey($PackageId)) {
        $mapping = $script:ConfigMappings[$PackageId]
        if ($mapping.Files) {
            $filesTextBox.Text = ($mapping.Files -join "`r`n")
        }
        if ($mapping.Folders) {
            $foldersTextBox.Text = ($mapping.Folders -join "`r`n")
        }
        if ($mapping.Registry) {
            $registryTextBox.Text = ($mapping.Registry -join "`r`n")
        }
    }
    
    # Buttons
    $saveButton = New-Object System.Windows.Forms.Button
    $saveButton.Text = "Save"
    $saveButton.Location = New-Object System.Drawing.Point(400, 420)
    $saveButton.Size = New-Object System.Drawing.Size(80, 30)
    $saveButton.DialogResult = [System.Windows.Forms.DialogResult]::OK
    
    $cancelButton = New-Object System.Windows.Forms.Button
    $cancelButton.Text = "Cancel"
    $cancelButton.Location = New-Object System.Drawing.Point(490, 420)
    $cancelButton.Size = New-Object System.Drawing.Size(80, 30)
    $cancelButton.DialogResult = [System.Windows.Forms.DialogResult]::Cancel
    
    # Help text
    $helpLabel = New-Object System.Windows.Forms.Label
    $helpLabel.Text = "Enter one path per line. Use environment variables like `$env:APPDATA"
    $helpLabel.Location = New-Object System.Drawing.Point(10, 420)
    $helpLabel.Size = New-Object System.Drawing.Size(380, 30)
    $helpLabel.ForeColor = [System.Drawing.Color]::Gray
    
    # Add controls
    $editorForm.Controls.AddRange(@(
        $packageLabel, $packageTextBox,
        $filesLabel, $filesTextBox,
        $foldersLabel, $foldersTextBox,
        $registryLabel, $registryTextBox,
        $helpLabel, $saveButton, $cancelButton
    ))
    
    $editorForm.AcceptButton = $saveButton
    $editorForm.CancelButton = $cancelButton
    
    if ($editorForm.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
        try {
            # Parse the input
            $files = @()
            $folders = @()
            $registry = @()
            
            if ($filesTextBox.Text.Trim()) {
                $files = $filesTextBox.Text.Split("`n") | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne "" }
            }
            if ($foldersTextBox.Text.Trim()) {
                $folders = $foldersTextBox.Text.Split("`n") | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne "" }
            }
            if ($registryTextBox.Text.Trim()) {
                $registry = $registryTextBox.Text.Split("`n") | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne "" }
            }
            
            # Create mapping structure
            $newMapping = @{
                'Files' = $files
                'Folders' = $folders
                'Registry' = $registry
                'InstallUrl' = ''
            }
            
            # Add or update the mapping
            $script:ConfigMappings[$packageTextBox.Text] = $newMapping
            
            # Save to file
            Save-ConfigMappingsToFile
            
            # Refresh the display
            Refresh-ConfigList
            
            [System.Windows.Forms.MessageBox]::Show(
                "Config mapping saved successfully. Remember to reload the GUI to see changes in operations.",
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
    
    $editorForm.Dispose()
}

function Save-ConfigMappingsToFile {
    <#
    .SYNOPSIS
        Saves the current config mappings to ConfigMappings.ps1
    #>
    
    try {
        $content = @"
# Configuration Mappings for Software Manager
# This file defines where each application stores its user settings and configurations
#
# IMPORTANT: Package names should match Winget package IDs when possible
# Use 'winget search <app-name>' to find the correct package ID
#
# Structure:
# 'package-id' = @{
#     'Folders' = @()     # Entire folders to backup (rarely needed for settings)
#     'Files' = @()       # Specific configuration files
#     'Registry' = @()    # Registry keys (use full HKEY_ paths)
#     'InstallUrl' = ''   # Custom download URL (optional - for packages not in Winget repo)
# }
#
# Focus on actual user settings, not installation directories!

`$ConfigMappings = @{
"@
        
        foreach ($packageId in ($script:ConfigMappings.Keys | Sort-Object)) {
            $mapping = $script:ConfigMappings[$packageId]
            $content += "`n    '$packageId' = @{`n"
            
            # Files
            $content += "        'Files' = @(`n"
            foreach ($file in $mapping.Files) {
                $content += "            `"$file`",`n"
            }
            $content = $content.TrimEnd(",`n") + "`n        )`n"
            
            # Folders
            $content += "        'Folders' = @(`n"
            foreach ($folder in $mapping.Folders) {
                $content += "            `"$folder`",`n"
            }
            $content = $content.TrimEnd(",`n") + "`n        )`n"
            
            # Registry
            $content += "        'Registry' = @(`n"
            foreach ($reg in $mapping.Registry) {
                $content += "            `"$reg`",`n"
            }
            $content = $content.TrimEnd(",`n") + "`n        )`n"
            
            $content += "        'InstallUrl' = '$($mapping.InstallUrl)'`n"
            $content += "    }`n"
        }
        
        $content += "}`n"
        
        $content | Out-File -FilePath $script:Config.ConfigMappingsFile -Encoding UTF8
        Write-SoftwareManagerLog -Config $script:Config -Message "Config mappings saved to $($script:Config.ConfigMappingsFile)"
    }
    catch {
        Write-SoftwareManagerLog -Config $script:Config -Message "Error saving config mappings: $_" -Level Error
        throw $_
    }
}

function Show-ConfigMappingDetails {
    <#
    .SYNOPSIS
        Shows details of the selected config mapping
    #>
    
    if ($script:ConfigListBox.SelectedItem -and $script:ConfigDetailsTextBox) {
        $packageId = $script:ConfigListBox.SelectedItem.ToString()
        
        if ($script:ConfigMappings.ContainsKey($packageId)) {
            $mapping = $script:ConfigMappings[$packageId]
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

# Start the application
Start-SoftwareManagerGUI
