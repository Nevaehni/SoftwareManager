# Export Mode Module for Software Manager
# Contains functionality for exporting currently installed packages

# Note: Imports handled by main script

function Start-ExportMode {
    <#
    .SYNOPSIS
        Exports currently installed packages to packages_current.txt
    #>
    param(
        [Parameter(Mandatory=$true)]
        [hashtable]$Config
    )
    
    Write-SoftwareManagerLog -Config $Config -Message "Starting export mode - generating packages_current.txt"
    
    # Ensure Winget is available
    if (-not (Ensure-WingetAvailable -Config $Config)) {
        $Config.ExitCode = 2
        return
    }
    
    try {
        Write-Host "Scanning installed packages..." -ForegroundColor Cyan
        
        $packages = @()
        $packageDict = @{}  # To avoid duplicates
        
        # First, get packages from Winget
        Write-Host "  - Scanning Winget packages..." -ForegroundColor Gray
        try {
            $wingetOutput = & winget list --accept-source-agreements 2>$null
            
            if ($LASTEXITCODE -eq 0) {
                $lines = $wingetOutput -split "`n"
                
                # Skip header lines and parse package IDs
                $startParsing = $false
                foreach ($line in $lines) {
                    # Look for the header separator line
                    if ($line -match '^-+\s+-+\s+-+') {
                        $startParsing = $true
                        continue
                    }
                    
                    if ($startParsing -and $line.Trim() -ne '') {
                        # Split the line into columns (Name, ID, Version, Available, Source)
                        $parts = $line -split '\s{2,}' # Split on 2 or more spaces
                        
                        if ($parts.Length -ge 2 -and $parts[1].Trim() -ne '') {
                            $packageId = $parts[1].Trim()
                            
                            # Skip packages without proper IDs or from certain sources
                            if ($packageId -notmatch '^[A-Za-z0-9._-]+\.[A-Za-z0-9._-]+$' -and 
                                $packageId -notmatch '^[A-Za-z0-9._-]+$') {
                                continue
                            }
                            
                            # Skip system packages and store packages
                            if ($packageId -match '^Microsoft\.VCRedist\.' -or 
                                $packageId -match '^Microsoft\.WindowsTerminal' -or
                                $packageId -match '^Microsoft\.Edge' -or
                                $packageId -match '\.msixbundle$' -or
                                $packageId -match '^msstore:') {
                                continue
                            }
                            
                            $packageDict[$packageId] = "winget"
                        }
                    }
                }
                Write-SoftwareManagerLog -Config $Config -Message "Found $($packageDict.Count) packages from Winget"
            }
            else {
                Write-SoftwareManagerLog -Config $Config -Message "Failed to get Winget package list" -Level Warning
            }
        }
        catch {
            Write-SoftwareManagerLog -Config $Config -Message "Error scanning Winget packages: $_" -Level Warning
        }
        
        # Second, scan Windows registry for all installed programs
        Write-Host "  - Scanning Windows Programs and Features..." -ForegroundColor Gray
        try {
            $uninstallKeys = @(
                "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*",
                "HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*",
                "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*"
            )
            
            $registryPackages = @()
            foreach ($key in $uninstallKeys) {
                try {
                    $items = Get-ItemProperty $key -ErrorAction SilentlyContinue
                    foreach ($item in $items) {
                        if ($item.DisplayName -and $item.DisplayName.Trim() -ne '') {
                            $displayName = $item.DisplayName.Trim()
                            $publisher = if ($item.Publisher) { $item.Publisher.Trim() } else { "" }
                            
                            # Skip Windows system components, updates, and redistributables
                            if ($displayName -match '^(Microsoft Visual C\+\+|Microsoft \.NET|Windows|Security Update|Update for|Hotfix|KB\d+)' -or
                                $displayName -match '^(Intel\(R\)|AMD|NVIDIA)' -or
                                $displayName -match '^(DirectX|Microsoft Edge)' -or
                                $displayName -match '(Redistributable|Runtime|Framework)$' -or
                                $displayName -match '^Microsoft Office' -or
                                $displayName -match '^\{[A-F0-9-]+\}$' -or  # GUID names
                                $publisher -match '^Microsoft Corporation$' -and $displayName -match '^(Microsoft|Windows)') {
                                continue
                            }
                            
                            # Try to create a package-like ID
                            $packageId = ""
                            if ($publisher -and $publisher -ne "") {
                                # Clean publisher name
                                $cleanPublisher = $publisher -replace '[^A-Za-z0-9]', ''
                                $cleanProduct = $displayName -replace '[^A-Za-z0-9]', ''
                                
                                # Create Publisher.Product format
                                if ($cleanPublisher -and $cleanProduct) {
                                    $packageId = "$cleanPublisher.$cleanProduct"
                                }
                            }
                            
                            # If we couldn't create a proper ID, use the display name
                            if (-not $packageId) {
                                $packageId = $displayName -replace '[^A-Za-z0-9.\-_]', ''
                            }
                            
                            # Only add if not already found via Winget and not a duplicate
                            if ($packageId -and -not $packageDict.ContainsKey($packageId)) {
                                $registryPackages += @{
                                    Id = $packageId
                                    Name = $displayName
                                    Publisher = $publisher
                                }
                            }
                        }
                    }
                }
                catch {
                    Write-SoftwareManagerLog -Config $Config -Message "Error scanning registry key $key`: $_" -Level Warning
                    continue
                }
            }
            
            # Add registry packages to our dictionary
            foreach ($regPkg in $registryPackages) {
                $packageDict[$regPkg.Id] = "registry"
            }
            
            Write-SoftwareManagerLog -Config $Config -Message "Found $($registryPackages.Count) additional packages from Windows registry"
        }
        catch {
            Write-SoftwareManagerLog -Config $Config -Message "Error scanning Windows registry: $_" -Level Warning
        }
          if ($packageDict.Count -eq 0) {
            Write-SoftwareManagerLog -Config $Config -Message "No packages found to export" -Level Warning
            $Config.ExitCode = 1
            return
        }
        
        # Sort packages alphabetically
        $packages = $packageDict.Keys | Sort-Object
        
        # Write to packages_current.txt
        $header = @(
            "# Current Packages - Generated $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')",
            "# This file contains packages currently installed on this system",
            "# Prefix packages with '+' to include their configurations in backup/restore",
            "#",
            "# To use this file:",
            "# 1. Review the list and add '+' prefix to packages whose configs you want to backup",
            "# 2. Rename this file to 'packages.txt'",
            "# 3. Run backup mode to export configurations",
            "#",
            ""
        )
        
        $content = $header + $packages
        
        Set-Content -Path $Config.CurrentPackagesFile -Value $content -Encoding UTF8
        
        Write-Host "Successfully exported $($packages.Count) packages to packages_current.txt" -ForegroundColor Green
        Write-SoftwareManagerLog -Config $Config -Message "Exported $($packages.Count) packages to packages_current.txt"
          Write-Host "`nTo backup configurations:" -ForegroundColor Yellow
        Write-Host "1. Edit packages_current.txt and add '+' prefix to packages whose configs you want to backup" -ForegroundColor Gray
        Write-Host "2. Rename packages_current.txt to packages.txt" -ForegroundColor Gray
        Write-Host "3. Run: .\SoftwareManager.ps1 -Mode Backup" -ForegroundColor Gray
        
    }
    catch {
        Write-SoftwareManagerLog -Config $Config -Message "Failed to export packages: $_" -Level Error
        $Config.ExitCode = 2
    }
}

# Export functions
Export-ModuleMember -Function @(
    'Start-ExportMode'
)
