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
    'Discord.Discord' = @{
        'Files' = @(
        )
        'Folders' = @(
        )
        'Registry' = @(
        )
        'InstallUrl' = ''
    }

    'FileZilla.FileZilla' = @{
        'Files' = @(
            "C:\Users\Admin\AppData\Roaming\FileZilla\filezilla.xml",
            "C:\Users\Admin\AppData\Roaming\FileZilla\sitemanager.xml",
            "C:\Users\Admin\AppData\Roaming\FileZilla\recentservers.xml",
            "C:\Users\Admin\AppData\Roaming\FileZilla\queue.xml"
        )
        'Folders' = @(
        )
        'Registry' = @(
        )
        'InstallUrl' = ''
    }

    'Google.Chrome' = @{
        'Files' = @(
        )
        'Folders' = @(
            "C:\Users\Admin\AppData\Local\Google\Chrome\User Data\Default\Bookmarks",
            "C:\Users\Admin\AppData\Local\Google\Chrome\User Data\Default\Preferences"
        )
        'Registry' = @(
        )
        'InstallUrl' = ''
    }

    'HeidiSQL.HeidiSQL' = @{
        'Files' = @(
        )
        'Folders' = @(
        )
        'Registry' = @(
            "HKEY_CURRENT_USER\Software\HeidiSQL"
        )
        'InstallUrl' = ''
    }

    'PuTTY.PuTTY' = @{
        'Files' = @(
        )
        'Folders' = @(
        )
        'Registry' = @(
            "HKEY_CURRENT_USER\Software\SimonTatham\PuTTY"
        )
        'InstallUrl' = ''
    }
}

