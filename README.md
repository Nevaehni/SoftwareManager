# Software Manager

A PowerShell script that automates backup and restore of applications and their configurations using Chocolatey.

> New in branch **`Electron`**: a cross-platform desktop GUI built with **Electron**, **React/TypeScript**, **Tailwind CSS**, and **shadcn/ui**. The application wraps the original PowerShell engine, offering a clean, minimal interface for backup and restore workflows while keeping the core logic unchanged.

---

## Features

- **Backup Mode**: Export application configurations from your current PC
- **Install + Restore Mode**: Install packages on a new PC and restore configurations
- **Automatic Config Detection**: Detects common configuration locations for popular applications
- **Registry Support**: Backs up and restores registry-based configurations
- **Comprehensive Logging**: All operations are logged with timestamps
- **Error Handling**: Graceful handling of missing configs and installation failures

## Requirements

- Windows PowerShell 7 or later
- Administrator privileges (required)
- Internet connection (for Chocolatey installation and package downloads)

**Note**: Chocolatey will be automatically installed if not present

## Setup

1. Place the script files in the same directory:
   - `SoftwareManager.ps1` (main script)
   - `packages.txt` (package list)
   - `ConfigMappings.ps1` (application configuration mappings)
   - `InstallAndLaunchPowerShell.cmd` (optional - PowerShell 7 installer and launcher)
2. Edit `packages.txt` to include your desired packages
3. Add "+" prefix to packages whose configurations you want to backup/restore
4. Customize `ConfigMappings.ps1` to add support for additional applications

### packages.txt Format

```
# Regular packages (install only)
7zip
googlechrome
vlc

# Packages with config backup/restore (prefix with +)
+vscode
+git
+discord
+steam
```

## Usage

### Quick Start (Recommended for New Systems)

For the easiest setup experience, especially on fresh Windows installations:

```cmd
InstallAndLaunchPowerShell.cmd
```

This batch script will:
1. Automatically install PowerShell 7.5.1 using Windows Package Manager (winget)
2. Launch the SoftwareManager.ps1 script in PowerShell 7 with Administrator privileges
3. Bypass execution policy restrictions automatically

### Interactive Mode

Run the script and choose from the menu:

```powershell
# Method 1: Direct execution (if execution policy allows)
.\SoftwareManager.ps1

# Method 2: Bypass execution policy (recommended for new systems)
PowerShell -ExecutionPolicy Bypass -File "SoftwareManager.ps1"

# Method 3: Using PowerShell 7 (if installed)
pwsh -ExecutionPolicy Bypass -File "SoftwareManager.ps1"
```

### Command Line Mode

**Backup configurations:**
```powershell
.\SoftwareManager.ps1 -Mode Backup
# or
PowerShell -ExecutionPolicy Bypass -File "SoftwareManager.ps1" -Mode Backup
```

**Install packages and restore configurations:**
```powershell
.\SoftwareManager.ps1 -Mode Install
# or
PowerShell -ExecutionPolicy Bypass -File "SoftwareManager.ps1" -Mode Install
```

## How It Works

### Backup Mode

1. Reads `packages.txt` and identifies packages marked with "+"
2. For each marked package:
   - Detects configuration locations (AppData, ProgramData, Registry)
   - Copies configurations to `.\configs\<package>\`
3. Creates `configs.zip` containing all backed up configurations
4. Logs all operations to `install-log.txt`

### Install + Restore Mode

1. Automatically installs Chocolatey if not present
2. Reads `packages.txt` and installs all packages via Chocolatey
3. For packages marked with "+":
   - Looks for configurations in `.\configs\<package>\` or extracts from `configs.zip`
   - Restores configurations to their original locations
   - Prompts user if configurations are missing
4. Handles already-installed packages gracefully
5. Logs all operations to `install-log.txt`

## Supported Applications

The script includes predefined configuration mappings for applications that store user settings:

- **FileZilla**: Site manager connections, transfer settings, recent servers (`%APPDATA%\FileZilla\*.xml`)
- **PuTTY**: Saved sessions, SSH keys, terminal settings (Windows Registry)
- **HeidiSQL**: Database connections, GUI preferences, export settings (Windows Registry)

For applications not in the predefined list, you'll need to add custom mappings to handle their specific configuration locations.

## Configuration Locations

The script handles different types of configuration storage:

### Configuration Files
- Application-specific settings files (XML, JSON, INI, etc.)
- User preference files in `%APPDATA%`, `%LOCALAPPDATA%`, or user profile

### Registry Settings
- Complete registry trees containing application settings
- Exported as `.reg` files for reliable backup/restore

## Files Created

- `configs/` - Directory containing individual package configurations
- `configs.zip` - Compressed archive of all configurations
- `install-log.txt` - Detailed log of all operations with timestamps

## Required Files

- `SoftwareManager.ps1` - Main PowerShell script
- `packages.txt` - List of packages to install/backup
- `ConfigMappings.ps1` - Application configuration location mappings
- `InstallAndLaunchPowerShell.cmd` - (Optional) PowerShell 7 installer and script launcher

## Exit Codes

- **0**: Success
- **1**: Warnings occurred (some configs missing/failed)
- **>1**: Errors occurred (critical failures)

## Example Workflow

### On Source PC (Backup)
1. Run `.\SoftwareManager.ps1 -Mode Backup`
2. Copy `configs.zip` and `packages.txt` to new PC

### On Target PC (Restore)
1. **Quick method**: Run `InstallAndLaunchPowerShell.cmd` as Administrator
   - This automatically installs PowerShell 7 and launches the script
2. **Manual method**: 
   - Install Chocolatey if not already installed
   - Place script, `packages.txt`, and `configs.zip` in same directory
   - Run `.\SoftwareManager.ps1 -Mode Install` as Administrator
3. All packages will be installed and configurations restored

## Troubleshooting

### Common Issues

**"Execution of scripts is disabled on this system"**
- **Recommended**: Use `InstallAndLaunchPowerShell.cmd` which automatically handles this
- The script automatically attempts to set execution policy to RemoteSigned
- If this fails, run with: `PowerShell -ExecutionPolicy Bypass -File "SoftwareManager.ps1"`
- Or manually set policy: `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force`

**"Script requires Administrator privileges"**
- **Recommended**: Use `InstallAndLaunchPowerShell.cmd` which automatically runs as Administrator
- Right-click PowerShell and select "Run as Administrator"
- Or use: `Start-Process PowerShell -Verb RunAs -ArgumentList "-ExecutionPolicy Bypass -File 'SoftwareManager.ps1'"`

**"PowerShell version too old"**
- **Recommended**: Use `InstallAndLaunchPowerShell.cmd` to automatically install PowerShell 7
- Or manually install PowerShell 7+ from: https://github.com/PowerShell/PowerShell/releases

**"Chocolatey is not installed"**
- The script automatically installs Chocolatey if not present
- Requires internet connection for download
- If automatic installation fails, install manually from https://chocolatey.org/install

**"packages.txt file not found" or "ConfigMappings.ps1 file not found"**
- Ensure all three files are in the same directory as the script

**Missing configurations for some packages**
- The script will prompt you to continue or abort
- You can manually add configurations later and re-run the script

### Adding Custom Applications

To add support for additional applications, edit the `ConfigMappings.ps1` file. Focus on actual user settings, not installation directories:

```powershell
'myapp' = @{
    'Folders' = @()  # Rarely needed for settings
    'Files' = @(
        "$env:APPDATA\MyApp\settings.xml",
        "$env:USERPROFILE\.myapprc"
    )
    'Registry' = @(
        "HKEY_CURRENT_USER\Software\MyApp"
    )
    'InstallUrl' = ''  # Optional: Custom download URL
}
```

### Custom Installation URLs

For packages not available in the Chocolatey repository, you can specify a custom download URL:

```powershell
'discord' = @{
    'Folders' = @()
    'Files' = @(
        "$env:APPDATA\discord\settings.json"
    )
    'Registry' = @()
    'InstallUrl' = 'https://discord.com/api/downloads/distributions/app/installers/latest?channel=stable&platform=win&arch=x64'
}
```

**Installation Methods**:
1. First attempts to use Chocolatey with the custom URL as source
2. If that fails, downloads the file directly and runs silent installation
3. Falls back to standard Chocolatey installation if no URL specified

**Important**: 
- Only specify actual configuration files and registry keys that contain user settings
- Use full `HKEY_CURRENT_USER` or `HKEY_LOCAL_MACHINE` paths for registry keys
- Custom URLs should point to installer files (typically .exe or .msi)
- The configuration file includes commented examples for common applications
- Restart the script after modifying `ConfigMappings.ps1`

## Security Notes

- The script requires Administrator privileges to access all configuration locations
- Registry modifications are logged for audit purposes
- Backup files may contain sensitive information - store securely
- Only run the script from trusted sources

## License

This script is provided as-is for educational and personal use.
