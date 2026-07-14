# Software Manager

A PowerShell script that automates backup and restore of applications and their configurations using Chocolatey.

## Features

- **Graphical Interface**: `SoftwareManagerGUI.ps1` is the main way to use this — search and add packages, browse what is already installed, edit each app's config mapping, pin versions, switch install source, and run either mode with a live log and progress bar
- **Backup Mode**: Export application configurations from your current PC
- **Install + Restore Mode**: Install packages on a new PC and restore configurations
- **Three install sources**: Chocolatey, winget, or a direct MSI/EXE link for apps neither repository carries
- **Manifest-Based Restore**: Each backup records where every item came from, so restore puts files back exactly — even on a fresh machine with a different username
- **Registry Support**: Backs up and restores registry-based configurations
- **Comprehensive Logging**: All operations are logged with timestamps
- **Error Handling**: Graceful handling of missing configs and installation failures
- **Unattended Mode**: `-Force` skips confirmation prompts for automated runs

## Requirements

- PowerShell 7 or later (the script enforces this via `#Requires -Version 7.0`; use `InstallAndLaunchPowerShell.cmd` to install it)
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

# Apps Chocolatey does not carry: install through winget instead
winget:Balena.Etcher
+winget:Microsoft.PowerToys

# Apps neither carries: install from an MSI/EXE link (set InstallUrl in ConfigMappings.ps1)
url:mycorpvpn
+url:mycorptool

# Pin a version instead of installing the latest
notepadplusplus@8.6.9
```

Each line is `[+][winget:|url:]<package-id>[@<version>]`:

| Part | Meaning |
| --- | --- |
| *(no prefix)* | Install from Chocolatey (`choco:` says the same thing explicitly) |
| `winget:` | Install with winget; the id is then a winget id, e.g. `Balena.Etcher` |
| `url:` | Download and run the installer at the package's `InstallUrl` in `ConfigMappings.ps1` |
| `+` | Back up and restore this package's configuration (works with any source) |
| `@1.2.3` | Install exactly this version instead of the latest |

You do not have to write any of this by hand — the GUI does it for you.

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

### GUI Mode

```cmd
SoftwareManagerGUI.cmd
```

(or `pwsh -ExecutionPolicy Bypass -File "SoftwareManagerGUI.ps1"` — the `.cmd` launcher just avoids a stray console window)

The GUI self-elevates (UAC prompt). Every package in the list gets installed — the list *is* the selection, so there is no "install" checkbox. Each row shows its source, its version, and whether its config is backed up:

- **Config checkbox** — back up and restore this package's configuration (this is the `+` prefix in `packages.txt`)
- **Source** — click it to switch between **Chocolatey**, **winget** and **custom URL**. The two repositories name the same app differently, so switching also swaps the id (`putty` ↔ `PuTTY.PuTTY`); a source is only offered once it is confirmed to carry the app.
- **Version** — click it to pin a specific version, or go back to "Latest (no pin)"
- **Actions** (`⋯`) — more info, edit config, open `ConfigMappings.ps1`, change source, set version, remove
- **Search or add a package** — the id is verified before it is added (Chocolatey first, then winget). If it does not exist, you get a list of the closest matches to pick from rather than an error — and if nothing matches at all, the option to install it from a link instead.
- **Add from URL...** — for apps neither repository carries: give it a name and a link to its `.exe`/`.msi`, and it is installed from there (an `.msi` runs through `msiexec /qn`). This writes the `InstallUrl` into `ConfigMappings.ps1` for you.
- **Browse installed...** — lists software already installed on this PC (Chocolatey packages and Windows' Add/Remove Programs, minus Windows updates and other non-applications) and matches each one to a package id in the background, so you can see *before* you tick anything which apps can actually be installed. Ones that neither repository carries are greyed out and say so — select them anyway and you are offered the URL route rather than losing them. Results are cached in `catalog.json` with a "last synced" time: the first scan takes a while, later ones are instant. **Rescan PC** re-reads the machine; **Recheck all** throws the cache away and looks everything up again.
- **Edit config** — say where an app keeps its settings (files, folders, registry keys) without leaving the GUI. It rewrites just that entry in `ConfigMappings.ps1`, leaving your comments and other entries alone, and stores paths as `$env:APPDATA\...` so they still work under a different username.
- **Save list** — rewrites `packages.txt`, preserving your comments
- Live log, progress bar, and confirmation dialogs before anything is changed

Packages without config paths in `ConfigMappings.ps1` show a "no config mapping" badge — checking Config for them backs up nothing until you add one (use **Edit config**). In the GUI, missing config backups during Install are logged as warnings instead of prompting (same as `-Force`).

If Chocolatey is missing, the GUI says so in a banner with an **Install Chocolatey** button, and offers to install it at the moment you try to do something that needs it. The action you were doing resumes once the install finishes.

**A note on typos**: neither Chocolatey nor winget tolerates a misspelled id — `winget search chorme` finds nothing at all, in either. So if a search comes back empty, the spelling is worth a second look; the GUI will also offer to add the app from a URL instead.

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
pwsh -ExecutionPolicy Bypass -File "SoftwareManager.ps1" -Mode Install
```

**Unattended install** (no prompt when a package's config backup is missing):
```powershell
.\SoftwareManager.ps1 -Mode Install -Force
```

## How It Works

### Backup Mode

1. Reads `packages.txt` and identifies packages marked with "+"
2. For each marked package:
   - Detects configuration locations (AppData, ProgramData, Registry)
   - Copies configurations to `.\configs\<package>\`
   - Writes a `manifest.json` recording each item's original location (with environment-variable tokens like `%APPDATA%` so paths work across different usernames)
3. Creates `configs.zip` containing all backed up configurations
4. Logs all operations to `install-log.txt`

### Install + Restore Mode

1. Automatically installs Chocolatey if not present
2. Reads `packages.txt` and installs all packages via Chocolatey
3. For packages marked with "+":
   - Looks for configurations in `.\configs\<package>\` or extracts from `configs.zip`
   - Reads the backup's `manifest.json` and restores each item to its exact original location
   - Prompts user if configurations are missing (skipped with `-Force`)
4. Handles already-installed packages gracefully
5. Logs all operations to `install-log.txt`

**Note**: Backups created by versions before 2.0 have no `manifest.json` and cannot be restored — re-run Backup mode on the source PC with the current script.

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
- `catalog.json` - The GUI's cache of resolved package ids, versions and last-synced times. Safe to delete; it rebuilds itself (the next scan is just slower).

## Required Files

- `SoftwareManager.ps1` - Main PowerShell script
- `packages.txt` - List of packages to install/backup
- `ConfigMappings.ps1` - Application configuration location mappings
- `SoftwareManagerGUI.ps1` - (Optional) graphical front end for the script above
- `SoftwareManagerGUI.cmd` - (Optional) launcher for the GUI, without a console window
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
- The script will prompt you to continue or abort (pass `-Force` to continue automatically)
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

For apps neither Chocolatey nor winget carries, give the package an `InstallUrl` — easiest through **Add from URL...** in the GUI, which writes this for you:

```powershell
'balenaetcher' = @{
    'Folders'     = @()
    'Files'       = @()
    'Registry'    = @()
    'InstallUrl'  = 'https://github.com/balena-io/etcher/releases/download/v1.19.25/balenaEtcher.Setup.exe'
    'DisplayName' = 'balenaEtcher'
}
```

and mark its line in `packages.txt` with the `url:` prefix (`url:balenaetcher`, or `+url:balenaetcher` to keep its config too).

**Installation Methods**:
1. A link ending in `.exe` or `.msi` is downloaded and run silently — an `.msi` through `msiexec /i /qn /norestart`, an `.exe` with the usual silent flags
2. Any other URL is treated as a Chocolatey source feed, falling back to a direct download
3. Without an `InstallUrl`, the package comes from Chocolatey or winget as usual

**`DisplayName`** is worth setting on a URL-installed app: it is the name the app registers in Windows' **Apps & features**, and the only way Software Manager can tell it is already installed. Without it, the installer runs again on every Install.

**Important**: 
- Only specify actual configuration files and registry keys that contain user settings
- Use full `HKEY_CURRENT_USER` or `HKEY_LOCAL_MACHINE` paths for registry keys
- Write paths with `$env:` variables, never a hardcoded `C:\Users\<you>` — that is what lets a backup restore under a different username
- The configuration file includes commented examples for common applications
- The GUI rewrites single entries in place and leaves your comments alone; restart the CLI after editing `ConfigMappings.ps1` by hand

## Security Notes

- The script requires Administrator privileges to access all configuration locations
- Registry modifications are logged for audit purposes
- Backup files may contain sensitive information - store securely
- Only run the script from trusted sources

## License

This script is provided as-is for educational and personal use.
