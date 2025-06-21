# Configuration Mappings for Software Manager
# This file defines where each application stores its user settings and configurations
#
# IMPORTANT: Package names should match Winget package IDs when possible
# Use 'winget search <app-name>' to find the correct package ID
#
# Structure:
# 'package-id' = @{
#     'Folders' = @()     # Entire folders to backup (rarely needed for settings)
#     'Files' = @()       # Specific configuration files
#     'Registry' = @()    # Registry keys (use full HKEY_ paths)
#     'InstallUrl' = ''   # Custom download URL (optional - for packages not in Winget repo)
# }
#
# Focus on actual user settings, not installation directories!

$ConfigMappings = @{
    'FileZilla.FileZilla' = @{
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
    
    'PuTTY.PuTTY' = @{
        'Folders' = @()
        'Files' = @()
        'Registry' = @(
            "HKEY_CURRENT_USER\Software\SimonTatham\PuTTY"  # All PuTTY settings including sessions, SSH keys, colors, fonts
        )
        'InstallUrl' = ''
    }
    
    'HeidiSQL.HeidiSQL' = @{
        'Folders' = @()
        'Files' = @()
        'Registry' = @(
            "HKEY_CURRENT_USER\Software\HeidiSQL"  # Database connections, GUI preferences, export settings
        )
        'InstallUrl' = ''
    }    
    # Example entries for common applications (commented out - uncomment and modify as needed)
    
    'Discord.Discord' = @{
        'Folders' = @()
        'Files' = @()
        'Registry' = @()
        'InstallUrl' = ''  # Winget will handle Discord installation
    }
    
    # 'Microsoft.VisualStudioCode' = @{
    #     'Folders' = @()
    #     'Files' = @(
    #         "$env:APPDATA\Code\User\settings.json",
    #         "$env:APPDATA\Code\User\keybindings.json"
    #     )
    #     'Registry' = @()
    #     'InstallUrl' = ''
    # }
    
    # 'Git.Git' = @{
    #     'Folders' = @()
    #     'Files' = @(
    #         "$env:USERPROFILE\.gitconfig",
    #         "$env:USERPROFILE\.gitignore_global"
    #     )
    #     'Registry' = @()
    #     'InstallUrl' = ''
    # }
    
    'Google.Chrome' = @{
        'Folders' = @(
            "$env:LOCALAPPDATA\Google\Chrome\User Data\Default\Bookmarks",
            "$env:LOCALAPPDATA\Google\Chrome\User Data\Default\Preferences"
        )
        'Files' = @()
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
}

# Export the configuration mappings
return $ConfigMappings
