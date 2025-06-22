# System Prerequisites Module for Software Manager
# Contains system checks for Administrator privileges, Execution Policy, and Winget

# Note: Import of Common module handled by main script

function Test-Administrator {
    <#
    .SYNOPSIS
        Checks if the current user has Administrator privileges
    #>
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Set-ExecutionPolicyIfNeeded {
    <#
    .SYNOPSIS
        Sets PowerShell execution policy if needed for script execution
    #>
    param(
        [Parameter(Mandatory=$true)]
        [hashtable]$Config
    )
    
    try {
        $currentPolicy = Get-ExecutionPolicy -Scope CurrentUser
        Write-SoftwareManagerLog -Config $Config -Message "Current execution policy for CurrentUser: $currentPolicy"
        
        # Check if execution policy allows script execution
        if ($currentPolicy -in @('Restricted', 'AllSigned')) {
            Write-SoftwareManagerLog -Config $Config -Message "Execution policy is restrictive ($currentPolicy). Attempting to set to RemoteSigned for CurrentUser scope." -Level Warning
            
            try {
                Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force
                Write-SoftwareManagerLog -Config $Config -Message "Successfully set execution policy to RemoteSigned for CurrentUser"
                return $true
            }
            catch {
                Write-SoftwareManagerLog -Config $Config -Message "Failed to set execution policy: $_" -Level Error
                Write-Host "Failed to set PowerShell execution policy. Please run the following command manually as Administrator:" -ForegroundColor Red
                Write-Host "Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force" -ForegroundColor Yellow
                return $false
            }
        }
        else {
            Write-SoftwareManagerLog -Config $Config -Message "Execution policy ($currentPolicy) allows script execution"
            return $true
        }
    }
    catch {
        Write-SoftwareManagerLog -Config $Config -Message "Failed to check execution policy: $_" -Level Warning
        return $true  # Continue anyway
    }
}

function Test-Winget {
    <#
    .SYNOPSIS
        Tests if Windows Package Manager (Winget) is available
    #>
    try {
        $null = Get-Command winget -ErrorAction Stop
        return $true
    }
    catch {
        return $false
    }
}

function Install-Winget {
    <#
    .SYNOPSIS
        Attempts to install Windows Package Manager (Winget) if not present
    #>
    param(
        [Parameter(Mandatory=$true)]
        [hashtable]$Config
    )
    
    Write-SoftwareManagerLog -Config $Config -Message "Windows Package Manager (Winget) not found. Attempting to install..." -Level Warning
    
    try {
        # Winget is typically pre-installed on Windows 10 (1903+) and Windows 11
        # If missing, it can be installed via Microsoft Store or manual download
        Write-Host "Installing Windows Package Manager (Winget)..." -ForegroundColor Yellow
        
        # Try to install via PowerShell/Windows Package Manager itself
        try {
            # Method 1: Try installing via PowerShell Gallery
            Install-PackageProvider -Name NuGet -MinimumVersion 2.8.5.201 -Force -Scope CurrentUser
            Install-Module -Name Microsoft.WinGet.Client -Force -Scope CurrentUser
            Import-Module Microsoft.WinGet.Client
            
            if (Test-Winget) {
                Write-SoftwareManagerLog -Config $Config -Message "Winget installed successfully via PowerShell module"
                return $true
            }
        }
        catch {
            Write-SoftwareManagerLog -Config $Config -Message "PowerShell module installation failed, trying alternative method: $_" -Level Warning
        }
        
        # Method 2: Download from GitHub releases
        Write-SoftwareManagerLog -Config $Config -Message "Attempting to download Winget from GitHub releases"
        $latestRelease = Invoke-RestMethod -Uri "https://api.github.com/repos/microsoft/winget-cli/releases/latest"
        $downloadUrl = ($latestRelease.assets | Where-Object { $_.name -like "*.msixbundle" }).browser_download_url
        
        if ($downloadUrl) {
            $tempFile = Join-Path $env:TEMP "winget.msixbundle"
            Invoke-WebRequest -Uri $downloadUrl -OutFile $tempFile
            Add-AppxPackage -Path $tempFile
            Remove-Item $tempFile -Force -ErrorAction SilentlyContinue
            
            # Refresh environment
            $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
            
            if (Test-Winget) {
                Write-SoftwareManagerLog -Config $Config -Message "Winget installed successfully"
                return $true
            }
        }
        
        Write-SoftwareManagerLog -Config $Config -Message "Automatic Winget installation failed" -Level Error
        Write-Host "Please install Windows Package Manager manually:" -ForegroundColor Red
        Write-Host "1. Install from Microsoft Store: https://www.microsoft.com/store/productId/9NBLGGH4NNS1" -ForegroundColor Yellow
        Write-Host "2. Or download from GitHub: https://github.com/microsoft/winget-cli/releases" -ForegroundColor Yellow
        return $false
    }
    catch {
        Write-SoftwareManagerLog -Config $Config -Message "Failed to install Winget: $_" -Level Error
        Write-Host "Failed to install Windows Package Manager automatically." -ForegroundColor Red
        Write-Host "Please install Winget manually from Microsoft Store or GitHub releases." -ForegroundColor Yellow
        return $false
    }
}

function Test-SystemPrerequisites {
    <#
    .SYNOPSIS
        Tests all system prerequisites for Software Manager
    #>
    param(
        [Parameter(Mandatory=$true)]
        [hashtable]$Config
    )
    
    # Check administrator privileges
    if (-not (Test-Administrator)) {
        Write-Host "This script requires Administrator privileges. Please run as Administrator." -ForegroundColor Red
        Write-SoftwareManagerLog -Config $Config -Message "Script requires Administrator privileges but is not running as Administrator" -Level Error
        return $false
    }
    
    Write-SoftwareManagerLog -Config $Config -Message "Running with Administrator privileges"
    
    # Check and set execution policy if needed
    if (-not (Set-ExecutionPolicyIfNeeded -Config $Config)) {
        Write-SoftwareManagerLog -Config $Config -Message "Cannot proceed due to execution policy restrictions" -Level Error
        return $false
    }
    
    return $true
}

function Ensure-WingetAvailable {
    <#
    .SYNOPSIS
        Ensures Winget is available, installing it if necessary
    #>
    param(
        [Parameter(Mandatory=$true)]
        [hashtable]$Config
    )
    
    if (-not (Test-Winget)) {
        if (-not (Install-Winget -Config $Config)) {
            Write-SoftwareManagerLog -Config $Config -Message "Cannot proceed without Windows Package Manager (Winget)" -Level Error
            return $false
        }
    }
    else {
        Write-SoftwareManagerLog -Config $Config -Message "Windows Package Manager (Winget) is already available"
    }
    
    return $true
}

# Export functions
Export-ModuleMember -Function @(
    'Test-Administrator',
    'Set-ExecutionPolicyIfNeeded',
    'Test-Winget',
    'Install-Winget',
    'Test-SystemPrerequisites',
    'Ensure-WingetAvailable'
)
