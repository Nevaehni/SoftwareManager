# Configuration Mappings for Software Manager
# This file defines where each application stores its user settings and configurations.
#
# The key must match the package name in packages.txt exactly (without the '+', 'winget:'
# or 'url:' prefix). Software Manager edits this file for you - "Edit config" in the GUI
# rewrites a single entry and leaves everything else, including these comments, untouched.
#
# Structure:
# 'package-name' = @{
#     'Folders'     = @()   # Entire folders to back up (rarely needed for settings)
#     'Files'       = @()   # Specific configuration files
#     'Registry'    = @()   # Registry keys (full HKEY_ paths, not HKCU:)
#     'InstallUrl'  = ''    # Optional: install from this URL instead of Chocolatey/winget
#     'InstallUrls' = [ordered]@{}  # Optional: one installer URL per version, newest first
#     'DisplayName' = ''    # Optional: the name the app registers in Add/Remove Programs
# }
#
# Focus on actual user settings, not installation directories!
#
# Paths: write them with $env: variables ("$env:APPDATA\App\settings.xml"), never with a
# hardcoded C:\Users\<you>. Backups are stored with the variable form so they restore under
# a different username on the target PC.
#
# InstallUrl: use it for apps neither Chocolatey nor winget carries. A link straight to an
# .exe or .msi is downloaded and run silently (.msi goes through msiexec /qn); anything else
# is treated as a Chocolatey source feed. Pair it with a 'url:' line in packages.txt.
#
# InstallUrls: a URL-installed app has no repository to list its versions, so pinning one
# means naming its installer. Give a URL per version here and 'app@1.2.3' in packages.txt
# installs that one; InstallUrl stays the fallback for a line with no version pin.
#
#     'InstallUrls' = [ordered]@{
#         '1.19.0' = "https://example.com/app-1.19.0.exe"
#         '1.18.4' = "https://example.com/app-1.18.4.exe"
#     }
#
# DisplayName: only matters alongside InstallUrl. A URL-installed app is invisible to
# Chocolatey, so this is how Software Manager tells whether it is already installed - copy
# the name exactly as it appears in Windows' Apps & features list.

$ConfigMappings = @{
    'filezilla' = @{
        'Folders' = @()
        'Files' = @(
            "$env:APPDATA\FileZilla\filezilla.xml",      # Main settings
            "$env:APPDATA\FileZilla\sitemanager.xml",    # Saved FTP/SFTP connections
            "$env:APPDATA\FileZilla\recentservers.xml",  # Recent server list
            "$env:APPDATA\FileZilla\queue.xml"           # Transfer queue settings
        )
        'Registry' = @()
        'InstallUrl' = ''
    }
    
    'putty' = @{
        'Folders' = @()
        'Files' = @()
        'Registry' = @(
            "HKEY_CURRENT_USER\Software\SimonTatham\PuTTY"  # All PuTTY settings including sessions, SSH keys, colors, fonts
        )
        'InstallUrl' = ''
    }
    
    'heidisql' = @{
        'Folders' = @()
        'Files' = @()
        'Registry' = @(
            "HKEY_CURRENT_USER\Software\HeidiSQL"  # Database connections, GUI preferences, export settings
        )
        'InstallUrl' = ''
    }
    
    # Example entries for common applications (commented out - uncomment and modify as needed)

    # An app neither Chocolatey nor winget has: installed straight from its .exe/.msi.
    # Its packages.txt line is "url:balenaetcher" (or "+url:balenaetcher" to keep its config).
    # 'balenaetcher' = @{
    #     'Folders'     = @()
    #     'Files'       = @()
    #     'Registry'    = @()
    #     'InstallUrl'  = 'https://github.com/balena-io/etcher/releases/download/v1.19.25/balenaEtcher-1.19.25.Setup.exe'
    #     'DisplayName' = 'balenaEtcher'
    # }

    'discord' = @{
        'Folders' = @()
        'Files' = @()
        'Registry' = @()
        'InstallUrl' = 'https://discord.com/api/downloads/distributions/app/installers/latest?channel=stable&platform=win&arch=x64'
    }
    
    # 'vscode' = @{
    #     'Folders' = @()
    #     'Files' = @(
    #         "$env:APPDATA\Code\User\settings.json",
    #         "$env:APPDATA\Code\User\keybindings.json"
    #     )
    #     'Registry' = @()
    #     'InstallUrl' = ''
    # }
    
    # 'git' = @{
    #     'Folders' = @()
    #     'Files' = @(
    #         "$env:USERPROFILE\.gitconfig",
    #         "$env:USERPROFILE\.gitignore_global"
    #     )
    #     'Registry' = @()
    #     'InstallUrl' = ''
    # }
    
    'googlechrome' = @{
        'Folders' = @()
        'Files' = @(
            "$env:LOCALAPPDATA\Google\Chrome\User Data\Default\Bookmarks",
            "$env:LOCALAPPDATA\Google\Chrome\User Data\Default\Preferences"
        )
        'Registry' = @()
        'InstallUrl' = 'https://dl.google.com/tag/s/lang%3Dro%26browser%3D4%26usagestats%3D1%26appname%3DGoogle%2520Chrome%26needsadmin%3Dprefers%26ap%3Dx64-stable-statsdef_1%26installdataindex%3Ddefaultbrowser/chrome/install/ChromeStandaloneSetup64.exe'
    }
    
    # 'steam' = @{
    #     'Folders' = @()
    #     'Files' = @()
    #     'Registry' = @(
    #         "HKEY_CURRENT_USER\Software\Valve\Steam"
    #     )
    #     'InstallUrl' = ''
    # }
    
    # 'nodejs-lts' = @{
    #     'Folders' = @()
    #     'Files' = @(
    #         "$env:USERPROFILE\.npmrc"
    #     )
    #     'Registry' = @()
    #     'InstallUrl' = ''
    # }

    'noscribe' = @{
        'Folders' = @()
        'Files' = @()
        'Registry' = @()
        'InstallUrl' = "https://drive.switch.ch/index.php/s/EIVup04qkSHb54j/download?path=%2FnoScribe%20vers.%200.7%2FWindows%2Fnormal&files=noScribe_setup_0_7_2%20normal.exe"
        'InstallUrls' = [ordered]@{
            '0.7.2' = "https://drive.switch.ch/index.php/s/EIVup04qkSHb54j/download?path=%2FnoScribe%20vers.%200.7%2FWindows%2Fnormal&files=noScribe_setup_0_7_2%20normal.exe"
        }
        'DisplayName' = "noScribe"
    }
}

# Export the configuration mappings
return $ConfigMappings
