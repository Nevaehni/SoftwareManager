# Install Mode Module for Software Manager
# Contains functionality for installing packages and restoring configurations

# Note: Imports handled by main script

function Start-InstallMode {
    <#
    .SYNOPSIS
        Installs packages and restores configurations
    #>
    param(
        [Parameter(Mandatory=$true)]
        [hashtable]$Config,
        
        [Parameter(Mandatory=$false)]
        [bool]$Force = $false
    )
    
    Write-SoftwareManagerLog -Config $Config -Message "Starting install and restore mode"
    
    # Ensure Winget is available
    if (-not (Ensure-WingetAvailable -Config $Config)) {
        $Config.ExitCode = 2
        return
    }
    
    $packages = Get-PackageList -Config $Config
    if (-not $packages) {
        $Config.ExitCode = 2
        return
    }
    
    # Extract configs.zip if it exists and configs directory doesn't
    if ((Test-Path $Config.ConfigsZip) -and (-not (Test-Path $Config.ConfigsDir))) {
        try {
            Write-SoftwareManagerLog -Config $Config -Message "Extracting configs.zip"
            Expand-Archive -Path $Config.ConfigsZip -DestinationPath $Config.ScriptPath -Force
        }
        catch {
            Write-SoftwareManagerLog -Config $Config -Message "Failed to extract configs.zip: $_" -Level Warning
        }
    }
    
    # Log installation mode
    if ($Force) {
        Write-SoftwareManagerLog -Config $Config -Message "Force installation mode enabled - will install/reinstall all packages"
    } else {
        Write-SoftwareManagerLog -Config $Config -Message "Checking package installation status individually"
    }
    
    $installedCount = 0
    $restoredCount = 0
    
    foreach ($package in $packages) {
        $isConfigPackage = $package.StartsWith('+')
        $packageName = if ($isConfigPackage) { $package.Substring(1) } else { $package }
        
        Write-Host "Processing $packageName..." -ForegroundColor Cyan
        
        # Install package if not already installed (or if Force is specified)
        $shouldInstall = $Force -or (-not (Test-PackageInstalled -Config $Config -PackageName $packageName))
        
        if ($shouldInstall) {
            if ($Force) {
                Write-SoftwareManagerLog -Config $Config -Message "Force installing $packageName (bypassing installation check)"
            }
            
            if (Install-Package -Config $Config -PackageName $packageName) {
                $installedCount++
            }
        }
        else {
            Write-SoftwareManagerLog -Config $Config -Message "$packageName is already installed"
        }
        
        # Restore configuration if this is a config package
        if ($isConfigPackage) {
            $configBackupExists = Test-Path (Join-Path $Config.ConfigsDir $packageName)
            
            if ($configBackupExists) {
                if (Restore-PackageConfig -Config $Config -PackageName $packageName) {
                    $restoredCount++
                }
            }
            else {
                if (-not (Get-UserConfirmation -PackageName $packageName)) {
                    Write-SoftwareManagerLog -Config $Config -Message "User chose to abort due to missing configs for $packageName" -Level Warning
                    $Config.ExitCode = 1
                    return
                }
            }
        }
    }
    
    Write-SoftwareManagerLog -Config $Config -Message "Installation complete. Installed: $installedCount packages, Restored configs: $restoredCount packages"
    Write-Host "`nInstallation complete!" -ForegroundColor Green
    Write-Host "Installed: $installedCount packages" -ForegroundColor Green
    Write-Host "Restored configs: $restoredCount packages" -ForegroundColor Green
}

# Export functions
Export-ModuleMember -Function @(
    'Start-InstallMode'
)
