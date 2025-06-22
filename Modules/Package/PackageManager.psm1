# Package Manager Module for Software Manager
# Contains functions for package detection, installation, and management

# Note: Import of Common module handled by main script

function Test-PackageInstalled {
    <#
    .SYNOPSIS
        Tests if a package is already installed using multiple detection methods
    #>
    param(
        [Parameter(Mandatory=$true)]
        [hashtable]$Config,
        
        [Parameter(Mandatory=$true)]
        [string]$PackageName
    )
    
    # First check local installations (faster than Winget queries)
    # Updated to handle Winget package ID format (Publisher.Product)
    $packageNameLower = $PackageName.ToLower()
    $packageShortName = if ($PackageName -match '\.') { 
        ($PackageName -split '\.')[1].ToLower() 
    } else { 
        $PackageName.ToLower() 
    }
    
    # Generic check for common installation patterns (faster than registry/Winget queries)
    # Try both full package name and short name in common installation locations
    $pathsToCheck = @(
        # Try with full package name
        "$env:PROGRAMFILES\$PackageName\$PackageName.exe",
        "$env:PROGRAMFILES(X86)\$PackageName\$PackageName.exe",
        "$env:LOCALAPPDATA\$PackageName\$PackageName.exe",
        # Try with short name (part after the dot)
        "$env:PROGRAMFILES\$packageShortName\$packageShortName.exe",
        "$env:PROGRAMFILES(X86)\$packageShortName\$packageShortName.exe",
        "$env:LOCALAPPDATA\$packageShortName\$packageShortName.exe",
        # Try with publisher name (part before the dot)
        "$env:PROGRAMFILES\$($PackageName.Split('.')[0])\$packageShortName.exe",
        "$env:PROGRAMFILES(X86)\$($PackageName.Split('.')[0])\$packageShortName.exe"
    )
    
    # Check if any of the expected paths exist
    foreach ($path in $pathsToCheck) {
        if (Test-Path $path) {
            Write-SoftwareManagerLog -Config $Config -Message "$PackageName detected locally at: $path"
            return $true
        }
    }
    
    # Check Windows Programs and Features (Add/Remove Programs) for faster local detection
    try {
        $uninstallKeys = @(
            "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*",
            "HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*",
            "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*"
        )
        
        # Create more specific search terms from package name
        $searchTerms = @()
        if ($PackageName -match '\.') {
            $publisher = $PackageName.Split('.')[0].ToLower()
            $product = $PackageName.Split('.')[1].ToLower()
            
            # For better matching, we need both parts or a very specific match
            # e.g., "Google.Chrome" should match "Google Chrome" but not "Google Drive"
            $searchTerms += "$publisher $product"  # "google chrome"
            $searchTerms += $product              # "chrome"
        } else {
            $searchTerms += $packageShortName
        }
        
        foreach ($key in $uninstallKeys) {
            try {
                $items = Get-ItemProperty $key -ErrorAction SilentlyContinue
                foreach ($item in $items) {
                    if ($item.DisplayName) {
                        $displayName = $item.DisplayName.ToLower()
                        
                        # Check for more precise matches
                        foreach ($term in $searchTerms) {
                            # For compound terms like "google chrome", check if both words are present
                            if ($term -match ' ') {
                                $words = $term -split ' '
                                $allWordsFound = $true
                                foreach ($word in $words) {
                                    if ($displayName -notlike "*$word*") {
                                        $allWordsFound = $false
                                        break
                                    }
                                }
                                if ($allWordsFound) {
                                    Write-SoftwareManagerLog -Config $Config -Message "$PackageName found in Windows Programs list as: $($item.DisplayName)"
                                    return $true
                                }
                            }
                            # For single terms, be more restrictive - must be exact word match
                            elseif ($displayName -eq $term -or $displayName -like "$term *" -or $displayName -like "* $term" -or $displayName -like "* $term *") {
                                Write-SoftwareManagerLog -Config $Config -Message "$PackageName found in Windows Programs list as: $($item.DisplayName)"
                                return $true
                            }
                        }
                    }
                }
            }
            catch {
                # Continue to next registry key if this one fails
                continue
            }
        }
    }
    catch {
        Write-SoftwareManagerLog -Config $Config -Message "Failed to check Windows Programs list: $_" -Level Warning
    }
    
    # Only check Winget if local detection failed (slower but more comprehensive)
    try {
        Write-SoftwareManagerLog -Config $Config -Message "Local detection failed for $PackageName, checking via Winget..."
        
        # Use winget list with specific package name for more accurate results
        $wingetResult = winget list $PackageName --accept-source-agreements 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-SoftwareManagerLog -Config $Config -Message "$PackageName found via direct winget list query"
            return $true
        }
        
        # If direct query fails, try searching in the full list (last resort)
        $wingetList = winget list --accept-source-agreements 2>$null
        if ($LASTEXITCODE -eq 0 -and $wingetList) {
            # Parse winget list output - look for package ID or name matches
            foreach ($line in $wingetList) {
                # Skip header lines and empty lines
                if ($line -match "^\s*Name\s+" -or $line -match "^-+\s*$" -or [string]::IsNullOrWhiteSpace($line)) {
                    continue
                }
                
                # Extract package name/ID from the line
                if ($line -match "^\s*(.+?)\s+(.+?)\s+(.+?)(\s|$)") {
                    $displayName = $matches[1].Trim()
                    $packageId = $matches[2].Trim()
                    
                    # Check for exact package ID match or partial name match
                    if ($packageId -eq $PackageName -or 
                        $displayName -like "*$PackageName*" -or 
                        $PackageName -like "*$displayName*" -or
                        ($PackageName -match '\.') -and ($packageId -like "*$($PackageName.Split('.')[1])*")) {
                        Write-SoftwareManagerLog -Config $Config -Message "$PackageName found in Winget installed packages (ID: $packageId, Name: $displayName)"
                        return $true
                    }
                }
            }
        }
    }
    catch {
        Write-SoftwareManagerLog -Config $Config -Message "Failed to get Winget package list: $_" -Level Warning
    }
    
    Write-SoftwareManagerLog -Config $Config -Message "$PackageName not detected as installed"
    return $false
}

function Install-PackageFromUrl {
    <#
    .SYNOPSIS
        Installs a package from a custom URL
    #>
    param(
        [Parameter(Mandatory=$true)]
        [hashtable]$Config,
        
        [Parameter(Mandatory=$true)]
        [string]$PackageName,
        
        [Parameter(Mandatory=$true)]
        [string]$Url
    )
    
    Write-SoftwareManagerLog -Config $Config -Message "Installing $PackageName from custom URL: $Url"
    
    try {
        # For Winget, we can try installing from a manifest URL or direct download
        if ($Url -like "*.yaml" -or $Url -like "*.yml") {
            # Winget manifest file
            $result = winget install --manifest $Url --accept-package-agreements --accept-source-agreements 2>&1
        }
        else {
            # Direct download and install
            Write-SoftwareManagerLog -Config $Config -Message "Attempting direct download and installation for $PackageName"
            return Install-PackageDirectly -Config $Config -PackageName $PackageName -Url $Url
        }
        
        if ($LASTEXITCODE -eq 0) {
            Write-SoftwareManagerLog -Config $Config -Message "Successfully installed $PackageName from URL"
            return $true
        }
        else {
            Write-SoftwareManagerLog -Config $Config -Message "Failed to install $PackageName from URL (exit code: $LASTEXITCODE). Output: $result" -Level Warning
            
            # Try alternative method: download and install directly
            Write-SoftwareManagerLog -Config $Config -Message "Attempting direct download and install for $PackageName" -Level Warning
            return Install-PackageDirectly -Config $Config -PackageName $PackageName -Url $Url
        }
    }
    catch {
        Write-SoftwareManagerLog -Config $Config -Message "Exception during URL installation of $PackageName`: $_" -Level Warning
        
        # Try alternative method: download and install directly
        Write-SoftwareManagerLog -Config $Config -Message "Attempting direct download and install for $PackageName" -Level Warning
        return Install-PackageDirectly -Config $Config -PackageName $PackageName -Url $Url
    }
}

function Install-PackageDirectly {
    <#
    .SYNOPSIS
        Downloads and installs a package directly from a URL
    #>
    param(
        [Parameter(Mandatory=$true)]
        [hashtable]$Config,
        
        [Parameter(Mandatory=$true)]
        [string]$PackageName,
        
        [Parameter(Mandatory=$true)]
        [string]$Url
    )
    
    try {
        Write-SoftwareManagerLog -Config $Config -Message "Downloading $PackageName directly from $Url"
        
        # Create temp directory for download
        $tempDir = Join-Path $env:TEMP "SoftwareManager_$PackageName"
        if (-not (Test-Path $tempDir)) {
            New-Item -Path $tempDir -ItemType Directory -Force | Out-Null
        }
        
        # Determine file extension from URL or use .exe as default
        $fileExtension = if ($Url -match '\.([a-zA-Z0-9]+)(\?|$)') { ".$($matches[1])" } else { ".exe" }
        $downloadPath = Join-Path $tempDir "$PackageName$fileExtension"
        
        # Set TLS to 1.2 for secure downloads
        [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
        
        # Download the file
        $webClient = New-Object System.Net.WebClient
        $webClient.DownloadFile($Url, $downloadPath)
        $webClient.Dispose()
        
        if (Test-Path $downloadPath) {
            Write-SoftwareManagerLog -Config $Config -Message "Downloaded $PackageName to $downloadPath"
            
            # Install the downloaded file
            Write-SoftwareManagerLog -Config $Config -Message "Installing $PackageName from downloaded file"
            $installResult = Start-Process -FilePath $downloadPath -ArgumentList "/S", "/SILENT", "/VERYSILENT", "/SUPPRESSMSGBOXES", "/NORESTART" -Wait -PassThru
            
            if ($installResult.ExitCode -eq 0) {
                Write-SoftwareManagerLog -Config $Config -Message "Successfully installed $PackageName via direct download"
                return $true
            }
            else {
                Write-SoftwareManagerLog -Config $Config -Message "Installation of $PackageName failed with exit code: $($installResult.ExitCode)" -Level Warning
                return $false
            }
        }
        else {
            Write-SoftwareManagerLog -Config $Config -Message "Failed to download $PackageName from $Url" -Level Warning
            return $false
        }
    }
    catch {
        Write-SoftwareManagerLog -Config $Config -Message "Failed to download/install $PackageName directly: $_" -Level Warning
        return $false
    }
    finally {
        # Cleanup temp directory
        if (Test-Path $tempDir) {
            Remove-Item $tempDir -Recurse -Force -ErrorAction SilentlyContinue
        }
    }
}

function Install-Package {
    <#
    .SYNOPSIS
        Installs a package using Winget or custom URL
    #>
    param(
        [Parameter(Mandatory=$true)]
        [hashtable]$Config,
        
        [Parameter(Mandatory=$true)]
        [string]$PackageName
    )
    
    $installSuccess = $false
    
    # Check if custom URL is specified in config mappings
    if ($Config.ConfigMappings.ContainsKey($PackageName) -and 
        $Config.ConfigMappings[$PackageName].ContainsKey('InstallUrl') -and 
        -not [string]::IsNullOrWhiteSpace($Config.ConfigMappings[$PackageName]['InstallUrl'])) {
        
        $customUrl = $Config.ConfigMappings[$PackageName]['InstallUrl']
        Write-SoftwareManagerLog -Config $Config -Message "Installing $PackageName from custom URL"
        $installSuccess = Install-PackageFromUrl -Config $Config -PackageName $PackageName -Url $customUrl
    }
    else {
        # Standard Winget installation
        Write-SoftwareManagerLog -Config $Config -Message "Installing $PackageName via Windows Package Manager (Winget)"
        try {
            $result = winget install $PackageName --accept-package-agreements --accept-source-agreements --silent 2>&1
            if ($LASTEXITCODE -eq 0) {
                Write-SoftwareManagerLog -Config $Config -Message "Successfully installed $PackageName"
                $installSuccess = $true
            }
            else {
                Write-SoftwareManagerLog -Config $Config -Message "Failed to install $PackageName (exit code: $LASTEXITCODE). Output: $result" -Level Warning
                
                # Try with exact ID match
                Write-SoftwareManagerLog -Config $Config -Message "Retrying $PackageName installation with exact ID search"
                $searchResult = winget search $PackageName --exact --accept-source-agreements 2>$null
                if ($LASTEXITCODE -eq 0 -and $searchResult) {
                    $result = winget install $PackageName --exact --accept-package-agreements --accept-source-agreements --silent 2>&1
                    if ($LASTEXITCODE -eq 0) {
                        Write-SoftwareManagerLog -Config $Config -Message "Successfully installed $PackageName with exact match"
                        $installSuccess = $true
                    }
                }
            }
        }
        catch {
            Write-SoftwareManagerLog -Config $Config -Message "Failed to install $PackageName`: $_" -Level Warning
        }
    }
    
    return $installSuccess
}

# Export functions
Export-ModuleMember -Function @(
    'Test-PackageInstalled',
    'Install-PackageFromUrl',
    'Install-PackageDirectly', 
    'Install-Package'
)
