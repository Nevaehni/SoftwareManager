# Configuration Manager Module for Software Manager
# Contains functions for backing up and restoring application configurations

# Note: Import of Common module handled by main script

function Get-ConfigLocations {
    <#
    .SYNOPSIS
        Gets configuration locations for a specific package
    #>
    param(
        [Parameter(Mandatory=$true)]
        [hashtable]$Config,
        
        [Parameter(Mandatory=$true)]
        [string]$PackageName
    )
    
    $locations = @{
        'Folders' = @()
        'Files' = @()
        'Registry' = @()
    }
    
    # Check predefined mappings for actual user settings/configs
    if ($Config.ConfigMappings.ContainsKey($PackageName)) {
        $mapping = $Config.ConfigMappings[$PackageName]
        $locations.Folders += $mapping.Folders | Where-Object { Test-Path $_ -PathType Container }
        $locations.Files += $mapping.Files | Where-Object { Test-Path $_ -PathType Leaf }
        $locations.Registry += $mapping.Registry | Where-Object { 
            # Convert HKEY_CURRENT_USER to HKCU: for Test-Path
            $testPath = $_ -replace '^HKEY_CURRENT_USER', 'HKCU:' -replace '^HKEY_LOCAL_MACHINE', 'HKLM:'
            Test-Path $testPath 
        }
    }
    else {
        Write-SoftwareManagerLog -Config $Config -Message "No configuration mapping found for $PackageName - skipping config detection" -Level Warning
    }
    
    return $locations
}

function Backup-PackageConfig {
    <#
    .SYNOPSIS
        Backs up configuration files and registry settings for a package
    #>
    param(
        [Parameter(Mandatory=$true)]
        [hashtable]$Config,
        
        [Parameter(Mandatory=$true)]
        [string]$PackageName
    )
    
    Write-SoftwareManagerLog -Config $Config -Message "Backing up configuration for $PackageName"
    
    $backupDir = Join-Path $Config.ConfigsDir $PackageName
    if (Test-Path $backupDir) {
        Remove-Item $backupDir -Recurse -Force
    }
    New-Item -Path $backupDir -ItemType Directory -Force | Out-Null
    
    $locations = Get-ConfigLocations -Config $Config -PackageName $PackageName
    $configFound = $false
    
    # Backup folders
    foreach ($folder in $locations.Folders) {
        try {
            $destPath = Join-Path $backupDir "folders\$(Split-Path $folder -Leaf)"
            Copy-Item -Path $folder -Destination $destPath -Recurse -Force
            Write-SoftwareManagerLog -Config $Config -Message "Backed up folder: $folder"
            $configFound = $true
        }
        catch {
            Write-SoftwareManagerLog -Config $Config -Message "Failed to backup folder $folder`: $_" -Level Warning
        }
    }
    
    # Backup individual files
    foreach ($file in $locations.Files) {
        try {
            $destDir = Join-Path $backupDir "files"
            if (-not (Test-Path $destDir)) {
                New-Item -Path $destDir -ItemType Directory -Force | Out-Null
            }
            $destPath = Join-Path $destDir (Split-Path $file -Leaf)
            Copy-Item -Path $file -Destination $destPath -Force
            Write-SoftwareManagerLog -Config $Config -Message "Backed up file: $file"
            $configFound = $true
        }
        catch {
            Write-SoftwareManagerLog -Config $Config -Message "Failed to backup file $file`: $_" -Level Warning
        }
    }
    
    # Backup registry keys using reg export for complete trees
    foreach ($regKey in $locations.Registry) {
        try {
            $destDir = Join-Path $backupDir "registry"
            if (-not (Test-Path $destDir)) {
                New-Item -Path $destDir -ItemType Directory -Force | Out-Null
            }
            
            # Create safe filename from registry path
            $regName = ($regKey -replace '\\', '_' -replace ':', '') + ".reg"
            $destPath = Join-Path $destDir $regName
            
            # Use reg export to backup complete registry tree
            $result = reg export $regKey $destPath /y 2>&1
            if ($LASTEXITCODE -eq 0) {
                Write-SoftwareManagerLog -Config $Config -Message "Backed up registry: $regKey"
                $configFound = $true
            }
            else {
                Write-SoftwareManagerLog -Config $Config -Message "Failed to backup registry $regKey`: $result" -Level Warning
            }
        }
        catch {
            Write-SoftwareManagerLog -Config $Config -Message "Failed to backup registry $regKey`: $_" -Level Warning
        }
    }
    
    if (-not $configFound) {
        Write-SoftwareManagerLog -Config $Config -Message "No configuration found for $PackageName" -Level Warning
        Remove-Item $backupDir -Recurse -Force -ErrorAction SilentlyContinue
    }
    
    return $configFound
}

function Restore-PackageConfig {
    <#
    .SYNOPSIS
        Restores configuration files and registry settings for a package
    #>
    param(
        [Parameter(Mandatory=$true)]
        [hashtable]$Config,
        
        [Parameter(Mandatory=$true)]
        [string]$PackageName
    )
    
    Write-SoftwareManagerLog -Config $Config -Message "Restoring configuration for $PackageName"
    
    $backupDir = Join-Path $Config.ConfigsDir $PackageName
    if (-not (Test-Path $backupDir)) {
        Write-SoftwareManagerLog -Config $Config -Message "No backup found for $PackageName" -Level Warning
        return $false
    }
    
    $restored = $false
    
    # Restore folders
    $foldersDir = Join-Path $backupDir "folders"
    if (Test-Path $foldersDir) {
        $locations = Get-ConfigLocations -Config $Config -PackageName $PackageName
        foreach ($sourceFolder in Get-ChildItem $foldersDir -Directory) {
            # Try to match with original locations
            $targetPath = $null
            foreach ($originalFolder in $locations.Folders) {
                if ((Split-Path $originalFolder -Leaf) -eq $sourceFolder.Name) {
                    $targetPath = $originalFolder
                    break
                }
            }
            
            if (-not $targetPath) {
                # Use generic path if no match found
                $targetPath = "$env:APPDATA\$PackageName"
            }
            
            try {
                $targetDir = Split-Path $targetPath -Parent
                if (-not (Test-Path $targetDir)) {
                    New-Item -Path $targetDir -ItemType Directory -Force | Out-Null
                }
                Copy-Item -Path $sourceFolder.FullName -Destination $targetPath -Recurse -Force
                Write-SoftwareManagerLog -Config $Config -Message "Restored folder to: $targetPath"
                $restored = $true
            }
            catch {
                Write-SoftwareManagerLog -Config $Config -Message "Failed to restore folder to $targetPath`: $_" -Level Warning
            }
        }
    }
    
    # Restore individual files
    $filesDir = Join-Path $backupDir "files"
    if (Test-Path $filesDir) {
        $locations = Get-ConfigLocations -Config $Config -PackageName $PackageName
        foreach ($sourceFile in Get-ChildItem $filesDir -File) {
            # Try to match with original locations
            $targetPath = $null
            foreach ($originalFile in $locations.Files) {
                if ((Split-Path $originalFile -Leaf) -eq $sourceFile.Name) {
                    $targetPath = $originalFile
                    break
                }
            }
            
            if ($targetPath) {
                try {
                    $targetDir = Split-Path $targetPath -Parent
                    if (-not (Test-Path $targetDir)) {
                        New-Item -Path $targetDir -ItemType Directory -Force | Out-Null
                    }
                    Copy-Item -Path $sourceFile.FullName -Destination $targetPath -Force
                    Write-SoftwareManagerLog -Config $Config -Message "Restored file to: $targetPath"
                    $restored = $true
                }
                catch {
                    Write-SoftwareManagerLog -Config $Config -Message "Failed to restore file to $targetPath`: $_" -Level Warning
                }
            }
        }
    }
    
    # Restore registry keys using reg import
    $registryDir = Join-Path $backupDir "registry"
    if (Test-Path $registryDir) {
        foreach ($regFile in Get-ChildItem $registryDir -Filter "*.reg") {
            try {
                # Use reg import to restore complete registry tree
                $result = reg import $regFile.FullName 2>&1
                if ($LASTEXITCODE -eq 0) {
                    Write-SoftwareManagerLog -Config $Config -Message "Restored registry from: $($regFile.Name)"
                    $restored = $true
                }
                else {
                    Write-SoftwareManagerLog -Config $Config -Message "Failed to restore registry from $($regFile.Name)`: $result" -Level Warning
                }
            }
            catch {
                Write-SoftwareManagerLog -Config $Config -Message "Failed to restore registry from $($regFile.Name)`: $_" -Level Warning
            }
        }
    }
    
    return $restored
}

# Export functions
Export-ModuleMember -Function @(
    'Get-ConfigLocations',
    'Backup-PackageConfig',
    'Restore-PackageConfig'
)
