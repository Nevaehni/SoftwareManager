# UI Menu Module for Software Manager
# Contains user interface functions and menu system

function Show-SoftwareManagerMenu {
    <#
    .SYNOPSIS
        Displays the main menu for Software Manager
    #>    Write-Host ""
    Write-Host "Software Manager - Winget Package & Config Management" -ForegroundColor Cyan
    Write-Host "========================================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "[E] Export currently installed packages to packages_current.txt" -ForegroundColor Yellow
    Write-Host "[B] Backup configs from this PC (export only)" -ForegroundColor Yellow
    Write-Host "[I] Install packages on a new PC and restore configs" -ForegroundColor Yellow
    Write-Host "[F] Force install/reinstall all packages (bypass checks)" -ForegroundColor Yellow
    Write-Host ""
    Write-Host -NoNewline "Choose an option [E/B/I/F]: "
    
    $choice = Read-Host
    return $choice.ToUpper()
}

function Get-UserModeChoice {
    <#
    .SYNOPSIS
        Gets the operation mode from user input
    #>
    param(
        [Parameter(Mandatory=$false)]
        [string]$Mode,
        
        [Parameter(Mandatory=$false)]
        [ref]$Force
    )
    
    if (-not $Mode) {
        $choice = Show-SoftwareManagerMenu
        switch ($choice) {
            'E' { return 'Export' }
            'B' { return 'Backup' }
            'I' { return 'Install' }
            'F' { 
                $Force.Value = $true
                Write-Host "Force mode enabled - will reinstall all packages" -ForegroundColor Yellow
                return 'Install'
            }
            default {
                Write-Host "Invalid choice. Exiting." -ForegroundColor Red
                return $null
            }
        }
    }
    
    return $Mode
}

function Show-PausePrompt {
    <#
    .SYNOPSIS
        Shows a pause prompt in interactive mode
    #>
    param(
        [Parameter(Mandatory=$true)]
        [bool]$IsInteractive
    )
    
    if ($IsInteractive) {
        Write-Host "`nPress any key to exit..." -ForegroundColor Gray
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    }
}

function Get-UserConfirmation {
    <#
    .SYNOPSIS
        Gets user confirmation for continuing when configs are missing
    #>
    param(
        [Parameter(Mandatory=$true)]
        [string]$PackageName
    )
    
    Write-Host "Configs for $PackageName not found – continue? [Y/N]: " -ForegroundColor Yellow -NoNewline
    $response = Read-Host
    return ($response -match '^[Yy]')
}

# Export functions
Export-ModuleMember -Function @(
    'Show-SoftwareManagerMenu',
    'Get-UserModeChoice',
    'Show-PausePrompt',
    'Get-UserConfirmation'
)
