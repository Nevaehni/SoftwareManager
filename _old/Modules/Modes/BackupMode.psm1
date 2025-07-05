# Backup Mode Module for Software Manager
# Contains functionality for backing up application configurations

# Note: Imports handled by main script

function Start-BackupMode {
    <#
    .SYNOPSIS
        Backs up configurations for packages marked with '+' prefix
    #>
    param(
        [Parameter(Mandatory=$true)]
        [hashtable]$Config
    )
    
    Write-SoftwareManagerLog -Config $Config -Message "Starting backup mode"
    
    $packages = Get-PackageList -Config $Config
    if (-not $packages) {
        $Config.ExitCode = 2
        return
    }
    
    $configPackages = $packages | Where-Object { $_.StartsWith('+') }
    if ($configPackages.Count -eq 0) {
        Write-SoftwareManagerLog -Config $Config -Message "No packages marked for config backup (packages starting with '+')" -Level Warning
        $Config.ExitCode = 1
        return
    }
    
    # Create configs directory
    if (Test-Path $Config.ConfigsDir) {
        Remove-Item $Config.ConfigsDir -Recurse -Force
    }
    New-Item -Path $Config.ConfigsDir -ItemType Directory -Force | Out-Null
    
    $backedUpCount = 0
    foreach ($package in $configPackages) {
        $packageName = $package.Substring(1)  # Remove '+' prefix
        Write-Host "Processing $packageName..." -ForegroundColor Cyan
        
        if (Backup-PackageConfig -Config $Config -PackageName $packageName) {
            $backedUpCount++
        }
    }
    
    # Create configs.zip
    if ($backedUpCount -gt 0) {
        try {
            if (Test-Path $Config.ConfigsZip) {
                Remove-Item $Config.ConfigsZip -Force
            }
            Compress-Archive -Path "$($Config.ConfigsDir)\*" -DestinationPath $Config.ConfigsZip -Force
            Write-SoftwareManagerLog -Config $Config -Message "Created configs.zip with $backedUpCount package configurations"
            Write-Host "`nBackup complete! Backed up configurations for $backedUpCount packages." -ForegroundColor Green
        }
        catch {
            Write-SoftwareManagerLog -Config $Config -Message "Failed to create configs.zip: $_" -Level Error
            $Config.ExitCode = 2
        }
    }
    else {
        Write-SoftwareManagerLog -Config $Config -Message "No configurations were backed up" -Level Warning
        $Config.ExitCode = 1
    }
}

# Export functions
Export-ModuleMember -Function @(
    'Start-BackupMode'
)
