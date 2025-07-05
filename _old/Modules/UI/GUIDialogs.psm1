# GUI Dialogs Module for Software Manager
# Contains complex dialog implementations (package search, config editor, logs)

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
            $searchResults = Search-WingetPackages -SearchTerm $searchTextBox.Text.Trim()
            
            foreach ($package in $searchResults) {
                $row = $resultsGrid.Rows.Add()
                $resultsGrid.Rows[$row].Cells[0].Value = $package.Id
                $resultsGrid.Rows[$row].Cells[1].Value = $package.Name
                $resultsGrid.Rows[$row].Cells[2].Value = $package.Version
                $resultsGrid.Rows[$row].Cells[3].Value = $package.Source
            }
            
            if ($searchResults.Count -eq 0) {
                $statusLabel.Text = "No packages found matching '$($searchTextBox.Text.Trim())'"
            } else {
                $statusLabel.Text = "Found $($searchResults.Count) packages"
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

function Search-WingetPackages {
    <#
    .SYNOPSIS
        Searches for packages using winget and returns parsed results
    #>
    param(
        [Parameter(Mandatory=$true)]
        [string]$SearchTerm
    )
    
    $results = @()
    
    try {
        # Use different approach for running winget search
        $psi = New-Object System.Diagnostics.ProcessStartInfo
        $psi.FileName = "winget.exe"
        $psi.Arguments = "search `"$SearchTerm`" --accept-source-agreements"
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
            
            $inResults = $false
            $headerFound = $false
            
            foreach ($line in $lines) {
                # Look for the header line that indicates start of results
                if ($line -match "^Name\s+Id\s+Version" -or $line -match "Name.*Id.*Version") {
                    $inResults = $true
                    $headerFound = $true
                    continue
                }
                
                # Skip separator lines
                if ($line -match "^-+\s+-+\s+-+" -or $line.Trim() -match "^-+$") {
                    continue
                }
                
                if ($inResults -and $headerFound -and $line.Trim() -ne "") {
                    try {
                        # Parse the line to extract package information
                        $cleanLine = $line -replace '\s+', ' '
                        $parts = $cleanLine.Trim() -split ' '
                        
                        $packageId = ""
                        $packageName = ""
                        $packageVersion = ""
                        $packageSource = "winget"
                        
                        # Find the package ID (usually contains dots or is a well-formed identifier)
                        $idIndex = -1
                        for ($i = 0; $i -lt $parts.Count; $i++) {
                            $part = $parts[$i]
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
                                if ($nextPart -match '^[\d\.\-\w]+$' -and $nextPart -notmatch '^(Tag|Moniker|winget)$') {
                                    $packageVersion = $nextPart
                                }
                            }
                            
                            # Find source
                            for ($i = $parts.Count - 1; $i -ge 0; $i--) {
                                if ($parts[$i] -eq "winget" -or $parts[$i] -eq "msstore") {
                                    $packageSource = $parts[$i]
                                    break
                                }
                            }
                            
                            # Add to results if we have at least a valid ID
                            if ($packageId -ne "") {
                                $results += [PSCustomObject]@{
                                    Id = $packageId
                                    Name = if ($packageName) { $packageName } else { $packageId }
                                    Version = if ($packageVersion) { $packageVersion } else { "Unknown" }
                                    Source = $packageSource
                                }
                            }
                        }
                    }
                    catch {
                        Write-Host "Error parsing line: $($_.Message)" -ForegroundColor Red
                        continue
                    }
                }
            }
        }
    }
    catch {
        Write-Host "Search error: $_" -ForegroundColor Red
        throw $_
    }
    
    return $results
}

function Show-ConfigMappingEditor {
    <#
    .SYNOPSIS
        Shows a dialog to edit config mapping details
    #>
    param(
        [string]$PackageId,
        [bool]$IsNew = $false,
        [hashtable]$ExistingMapping = @{}
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
    if (-not $IsNew -and $ExistingMapping.Count -gt 0) {
        if ($ExistingMapping.Files) {
            $filesTextBox.Text = ($ExistingMapping.Files -join "`r`n")
        }
        if ($ExistingMapping.Folders) {
            $foldersTextBox.Text = ($ExistingMapping.Folders -join "`r`n")
        }
        if ($ExistingMapping.Registry) {
            $registryTextBox.Text = ($ExistingMapping.Registry -join "`r`n")
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
        
        $result = @{
            PackageId = $packageTextBox.Text
            Files = $files
            Folders = $folders
            Registry = $registry
        }
        
        $editorForm.Dispose()
        return $result
    }
    
    $editorForm.Dispose()
    return $null
}

function Show-LogsDialog {
    <#
    .SYNOPSIS
        Shows a dialog with current logs
    #>
    param(
        [Parameter(Mandatory=$true)]
        [string]$LogFilePath
    )
    
    $logForm = New-Object System.Windows.Forms.Form
    $logForm.Text = "Software Manager Logs"
    $logForm.Size = New-Object System.Drawing.Size(800, 600)
    $logForm.StartPosition = "CenterParent"
    
    $logTextBox = New-Object System.Windows.Forms.RichTextBox
    $logTextBox.Dock = [System.Windows.Forms.DockStyle]::Fill
    $logTextBox.ReadOnly = $true
    $logTextBox.Font = New-Object System.Drawing.Font("Consolas", 9)
    
    try {
        if (Test-Path $LogFilePath) {
            $logContent = Get-Content $LogFilePath -Raw
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

# Export functions
Export-ModuleMember -Function @(
    'Show-PackageSearchDialog',
    'Show-ConfigMappingEditor',
    'Show-LogsDialog'
)
