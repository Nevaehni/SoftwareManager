#Requires -Version 7.0
<#
.SYNOPSIS
    Software Manager GUI - graphical front end for SoftwareManager.ps1

.DESCRIPTION
    WPF interface for the Software Manager engine. Lets you pick which packages to install,
    which configs to back up / restore, add packages (verified against Chocolatey or winget,
    with search results when the id is wrong), add apps that neither repository carries by
    MSI/EXE URL, import software already installed on this PC, edit each package's config
    mapping, pin versions, switch install source, and run Backup or Install with a live log.

    All backup/install logic lives in SoftwareManager.ps1, which this script dot-sources
    with -LoadOnly inside a background runspace. The CLI keeps working exactly as before.

    Resolved package ids are cached in catalog.json so repeat scans are fast.

.NOTES
    Requires: PowerShell 7+, Windows, Administrator privileges (self-elevates)

.EXAMPLE
    pwsh -ExecutionPolicy Bypass -File "SoftwareManagerGUI.ps1"

.EXAMPLE
    SoftwareManagerGUI.cmd
#>

[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

# pwsh.exe is a console application, so Windows gives us a console window before the
# GUI exists. Hide it - but only when this process is the sole owner of the console,
# otherwise we would hide the user's own terminal when launched from one.
Add-Type -Namespace SmGui -Name Native -MemberDefinition @'
    [DllImport("kernel32.dll")] private static extern IntPtr GetConsoleWindow();
    [DllImport("kernel32.dll")] private static extern uint GetConsoleProcessList(uint[] processList, uint count);
    [DllImport("user32.dll")] private static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

    public static void HideOwnConsole() {
        IntPtr handle = GetConsoleWindow();
        if (handle == IntPtr.Zero) { return; }
        uint[] pids = new uint[4];
        if (GetConsoleProcessList(pids, 4) == 1) { ShowWindow(handle, 0); }
    }
'@
[SmGui.Native]::HideOwnConsole()

Add-Type -AssemblyName PresentationFramework, PresentationCore, WindowsBase

$Script:ScriptPath   = Split-Path -Parent $MyInvocation.MyCommand.Path
$Script:EnginePath   = Join-Path $Script:ScriptPath "SoftwareManager.ps1"
$Script:PackagesFile = Join-Path $Script:ScriptPath "packages.txt"
$Script:MappingsFile = Join-Path $Script:ScriptPath "ConfigMappings.ps1"
$Script:CatalogFile  = Join-Path $Script:ScriptPath "catalog.json"

function Show-StartupError {
    param([string]$Message)
    $null = [System.Windows.MessageBox]::Show($Message, 'Software Manager', 'OK', 'Error')
    exit 2
}

# The engine needs Administrator (choco installs, HKLM registry export/import) - self-elevate
$principal = [Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    try {
        Start-Process (Get-Process -Id $PID).Path -Verb RunAs -WindowStyle Hidden `
            -ArgumentList '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$PSCommandPath`""
        exit 0
    }
    catch {
        Show-StartupError "Administrator privileges are required. Please run as Administrator."
    }
}

foreach ($required in $Script:EnginePath, $Script:PackagesFile, $Script:MappingsFile) {
    if (-not (Test-Path $required)) {
        Show-StartupError "Required file not found: $required"
    }
}

# Chocolatey puts itself on the machine PATH, but a process started before that (or elevated
# from a stale environment) won't see it - so rebuild PATH from the registry before looking.
function Update-ProcessPath {
    $machine = [System.Environment]::GetEnvironmentVariable('Path', 'Machine')
    $user    = [System.Environment]::GetEnvironmentVariable('Path', 'User')
    $env:Path = (@($machine, $user) | Where-Object { $_ }) -join ';'
}

function Test-ChocoInstalled {
    if (Get-Command choco -ErrorAction SilentlyContinue) { return $true }

    # Installed but not on PATH (a stale environment, or PATH not refreshed after install):
    # put its bin directory on the process PATH so background runspaces can call it too.
    $chocoBin = Join-Path ($env:ChocolateyInstall ?? (Join-Path $env:ProgramData 'chocolatey')) 'bin'
    if (Test-Path (Join-Path $chocoBin 'choco.exe')) {
        $env:Path = "$env:Path;$chocoBin"
        return $true
    }
    return $false
}

Update-ProcessPath
$Script:ChocoAvailable  = Test-ChocoInstalled
$Script:WingetAvailable = [bool](Get-Command winget -ErrorAction SilentlyContinue)

# --- Config mappings (read) ---

# ConfigMappings.ps1 is a script that returns a hashtable; it is invoked, not dot-sourced.
function Import-Mappings {
    try { $Script:Mappings = & $Script:MappingsFile }
    catch {
        $Script:Mappings = @{}
        Add-LogLine "Failed to load ConfigMappings.ps1: $_" 'Error'
    }
    if ($Script:Mappings -isnot [hashtable]) { $Script:Mappings = @{} }
}

function Get-Mapping {
    param([string]$Name)
    if ($Script:Mappings.ContainsKey($Name)) { return $Script:Mappings[$Name] }
    return $null
}

function Get-MappingValue {
    param([string]$Name, [string]$Key)
    $mapping = Get-Mapping $Name
    if (-not $mapping -or -not $mapping.ContainsKey($Key)) { return '' }
    return [string]$mapping[$Key]
}

# A URL-installed app has no repository to list its versions, so its mapping may name one
# installer per version under 'InstallUrls'. Returns them in file order, empty when it has none.
function Get-MappingUrls {
    param([string]$Name)

    $urls = [ordered]@{}
    $mapping = Get-Mapping $Name
    if ($mapping -and $mapping.ContainsKey('InstallUrls') -and $mapping['InstallUrls']) {
        foreach ($version in $mapping['InstallUrls'].Keys) {
            $urls[[string]$version] = [string]$mapping['InstallUrls'][$version]
        }
    }
    return $urls
}

function Test-MappingHasConfig {
    param([string]$Name)
    $mapping = Get-Mapping $Name
    if (-not $mapping) { return $false }
    foreach ($key in 'Folders', 'Files', 'Registry') {
        if ($mapping.ContainsKey($key) -and @($mapping[$key]).Count -gt 0) { return $true }
    }
    return $false
}

Import-Mappings

# --- Config mappings (write) ---
#
# The mappings file is hand-editable and full of comments, so entries are rewritten in place
# through the PowerShell AST: find the package's key/value pair, replace exactly that span of
# text, and leave every other byte of the file alone. A package with no entry yet is inserted
# just before the hashtable's closing brace.

# Paths are stored with $env: variables so a backup restores under a different username.
# Longest expansion first, so %LOCALAPPDATA% wins over %USERPROFILE%.
$Script:EnvTokens = [ordered]@{}
foreach ($pair in @(
    @{ Var = '$env:LOCALAPPDATA';        Value = $env:LOCALAPPDATA },
    @{ Var = '$env:APPDATA';             Value = $env:APPDATA },
    @{ Var = '$env:ProgramData';         Value = $env:ProgramData },
    @{ Var = '${env:ProgramFiles(x86)}'; Value = ${env:ProgramFiles(x86)} },
    @{ Var = '$env:ProgramFiles';        Value = $env:ProgramFiles },
    @{ Var = '$env:USERPROFILE';         Value = $env:USERPROFILE }
) | Sort-Object { [string]$_.Value } -Descending | Sort-Object { ([string]$_.Value).Length } -Descending) {
    if ($pair.Value) { $Script:EnvTokens[$pair.Var] = [string]$pair.Value }
}

function ConvertTo-TokenPath {
    param([string]$Path)

    foreach ($var in $Script:EnvTokens.Keys) {
        $prefix = $Script:EnvTokens[$var]
        if ($Path.StartsWith($prefix, [System.StringComparison]::OrdinalIgnoreCase)) {
            return $var + $Path.Substring($prefix.Length)
        }
    }
    return $Path
}

function Format-MappingString {
    param([string]$Value)
    # Written into a double-quoted PowerShell string, so $env: stays live; a literal quote or
    # backtick in a path would otherwise break the file.
    $escaped = $Value -replace '`', '``' -replace '"', '`"'
    return '"' + $escaped + '"'
}

function Format-MappingEntry {
    param(
        [string]$Name,
        [string[]]$Folders,
        [string[]]$Files,
        [string[]]$Registry,
        [string]$InstallUrl,
        [string]$DisplayName,
        $InstallUrls
    )

    $sb = [System.Text.StringBuilder]::new()
    $null = $sb.AppendLine("'$($Name -replace "'", "''")' = @{")

    foreach ($key in 'Folders', 'Files', 'Registry') {
        $values = @(Get-Variable -Name $key -ValueOnly | Where-Object { $_ -and $_.Trim() })
        if ($values.Count -eq 0) {
            $null = $sb.AppendLine("        '$key' = @()".PadRight(0))
            continue
        }
        $null = $sb.AppendLine("        '$key' = @(")
        for ($i = 0; $i -lt $values.Count; $i++) {
            $raw = if ($key -eq 'Registry') { $values[$i].Trim() } else { ConvertTo-TokenPath $values[$i].Trim() }
            $comma = if ($i -lt $values.Count - 1) { ',' } else { '' }
            $null = $sb.AppendLine("            $(Format-MappingString $raw)$comma")
        }
        $null = $sb.AppendLine("        )")
    }

    $null = $sb.AppendLine("        'InstallUrl' = $(Format-MappingString $InstallUrl.Trim())")

    # [ordered] so the version list keeps the order it was written in - the picker shows it as-is
    if ($InstallUrls -and $InstallUrls.Count -gt 0) {
        $null = $sb.AppendLine("        'InstallUrls' = [ordered]@{")
        foreach ($version in $InstallUrls.Keys) {
            $null = $sb.AppendLine("            '$([string]$version -replace "'", "''")' = $(Format-MappingString ([string]$InstallUrls[$version]).Trim())")
        }
        $null = $sb.AppendLine("        }")
    }

    if ($DisplayName.Trim()) {
        $null = $sb.AppendLine("        'DisplayName' = $(Format-MappingString $DisplayName.Trim())")
    }
    $null = $sb.Append("    }")

    return $sb.ToString()
}

function Set-ConfigMapping {
    param(
        [string]$Name,
        [string[]]$Folders = @(),
        [string[]]$Files = @(),
        [string[]]$Registry = @(),
        [string]$InstallUrl = '',
        [string]$DisplayName = '',
        $InstallUrls = $null
    )

    $text = Get-Content $Script:MappingsFile -Raw
    $errors = $null
    $ast = [System.Management.Automation.Language.Parser]::ParseInput($text, [ref]$null, [ref]$errors)
    if ($errors -and $errors.Count -gt 0) {
        throw "ConfigMappings.ps1 has a syntax error on line $($errors[0].Extent.StartLineNumber) - fix it before saving from here."
    }

    # The first hashtable in the file is the one assigned to $ConfigMappings
    $table = $ast.Find({ param($node)
        $node -is [System.Management.Automation.Language.HashtableAst]
    }, $true)
    if (-not $table) { throw "Could not find the `$ConfigMappings hashtable in ConfigMappings.ps1" }

    $entry = Format-MappingEntry -Name $Name -Folders $Folders -Files $Files -Registry $Registry `
        -InstallUrl $InstallUrl -DisplayName $DisplayName -InstallUrls $InstallUrls

    $existing = $table.KeyValuePairs | Where-Object {
        $_.Item1.Extent.Text.Trim().Trim("'", '"') -ieq $Name
    } | Select-Object -First 1

    if ($existing) {
        $start = $existing.Item1.Extent.StartOffset
        $end   = $existing.Item2.Extent.EndOffset
        $updated = $text.Substring(0, $start) + $entry + $text.Substring($end)
    }
    else {
        # Insert before the hashtable's closing brace
        $close = $table.Extent.EndOffset - 1
        $updated = $text.Substring(0, $close).TrimEnd() + "`r`n`r`n    " + $entry + "`r`n" + $text.Substring($close)
    }

    Set-Content -Path $Script:MappingsFile -Value $updated -NoNewline
    Import-Mappings
}

function Remove-ConfigMapping {
    param([string]$Name)

    $text = Get-Content $Script:MappingsFile -Raw
    $errors = $null
    $ast = [System.Management.Automation.Language.Parser]::ParseInput($text, [ref]$null, [ref]$errors)
    if ($errors -and $errors.Count -gt 0) { return $false }

    $table = $ast.Find({ param($node)
        $node -is [System.Management.Automation.Language.HashtableAst]
    }, $true)
    if (-not $table) { return $false }

    $existing = $table.KeyValuePairs | Where-Object {
        $_.Item1.Extent.Text.Trim().Trim("'", '"') -ieq $Name
    } | Select-Object -First 1
    if (-not $existing) { return $false }

    $start = $existing.Item1.Extent.StartOffset
    $end   = $existing.Item2.Extent.EndOffset
    $head = $text.Substring(0, $start).TrimEnd()
    $tail = $text.Substring($end)
    Set-Content -Path $Script:MappingsFile -Value ($head + "`r`n`r`n    " + $tail.TrimStart()) -NoNewline
    Import-Mappings
    return $true
}

# --- Catalog (catalog.json) ---
#
# Resolving a Windows display name ("Notepad++ (64-bit x64)") to a package id costs one
# `choco search` per candidate, so every answer - including "no package exists" - is cached
# with the time it was checked. The first scan is slow; every later one is instant.

# Bump this whenever a bad answer could have been cached by an older version, so the stale
# file is dropped instead of trusted. Schema 1 searched winget without --source winget, which
# let Microsoft Store product ids (XPFNZKSKLBP7RJ) in as if they were winget packages.
$Script:CatalogSchema = 2

function Import-Catalog {
    $empty = @{ schema = $Script:CatalogSchema; apps = @{}; packages = @{}; installed = @(); scannedAt = '' }
    if (-not (Test-Path $Script:CatalogFile)) { return $empty }

    try {
        $raw = Get-Content $Script:CatalogFile -Raw
        if ([string]::IsNullOrWhiteSpace($raw)) { return $empty }
        $data = $raw | ConvertFrom-Json -AsHashtable
        if ($data -isnot [hashtable]) { return $empty }
        if ([int]$data['schema'] -ne $Script:CatalogSchema) { return $empty }
        foreach ($key in 'apps', 'packages') {
            if (-not $data.ContainsKey($key) -or $data[$key] -isnot [hashtable]) { $data[$key] = @{} }
        }
        # The machine scan itself is cached too, so a relaunch reuses it instead of re-reading
        # the registry and re-resolving every id. "Rescan PC" is the way to force a fresh read.
        if (-not $data.ContainsKey('installed') -or $data['installed'] -isnot [array]) { $data['installed'] = @() }
        if (-not $data.ContainsKey('scannedAt')) { $data['scannedAt'] = '' }
        return $data
    }
    catch {
        return $empty
    }
}

# Store the machine scan (the installed-program list) so the next launch can skip re-reading it
function Set-CatalogInstalled {
    param($Items)
    $Script:Catalog.installed = @($Items | ForEach-Object {
        @{ Display = [string]$_.Display; Id = [string]$_.Id; Source = [string]$_.Source; Version = [string]$_.Version }
    })
    $Script:Catalog.scannedAt = (Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
}

function Export-Catalog {
    try {
        $Script:Catalog | ConvertTo-Json -Depth 6 | Set-Content -Path $Script:CatalogFile -Encoding UTF8
    }
    catch {
        Add-LogLine "Failed to write catalog.json: $_" 'Warning'
    }
}

function Get-CatalogApp {
    param([string]$Display)
    $key = $Display.ToLower()
    if ($Script:Catalog.apps.ContainsKey($key)) { return $Script:Catalog.apps[$key] }
    return $null
}

function Set-CatalogApp {
    param([string]$Display, [string]$Id, [string]$Source, [string]$Version = '')
    $Script:Catalog.apps[$Display.ToLower()] = @{
        display   = $Display
        id        = $Id
        source    = $Source
        version   = $Version
        checkedAt = (Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
    }
}

function Get-CatalogPackage {
    param([string]$Source, [string]$Id)
    $key = "$Source|$($Id.ToLower())"
    if ($Script:Catalog.packages.ContainsKey($key)) { return $Script:Catalog.packages[$key] }
    return $null
}

function Set-CatalogPackage {
    param([string]$Source, [string]$Id, [string]$Version = '', [string]$Moniker = '',
          [string]$AltSource = '', [string]$AltId = '')
    $Script:Catalog.packages["$Source|$($Id.ToLower())"] = @{
        id        = $Id
        source    = $Source
        version   = $Version
        moniker   = $Moniker
        altSource = $AltSource
        altId     = $AltId
        checkedAt = (Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
    }
}

$Script:Catalog = Import-Catalog

# --- Data model ---

class PackageRow {
    [string]$Name
    [string]$Source          # chocolatey | winget | url - matches the packages.txt prefix
    [string]$Version         # pinned version; '' = install the latest
    [string]$Latest          # newest version in the repo; '' = not looked up yet
    [string]$Moniker
    [bool]$Config            # back up / restore this package's config (the '+' prefix)
    [bool]$HasMapping        # has an entry in ConfigMappings.ps1 with something to back up
    [bool]$HasUrl            # installs from a custom MSI/EXE URL
    [string]$AltSource       # the other repository that also carries this app, if any
    [string]$AltId

    # A row added straight from "Browse installed" before its package id was known: Name is
    # still the Windows display name and the id is being looked up in the background. It is
    # not a real package yet, so it is not saved to packages.txt and cannot be installed.
    [bool]$Resolving

    # The Windows display name a url row came from, kept so the URL editor can pre-fill its
    # title when the mapping does not exist yet (a url row still waiting for its installer link).
    [string]$Title

    # Bindable display state. WPF binds to properties, not methods, and a PowerShell class
    # cannot raise PropertyChanged - so these are recomputed by Sync() and the list is
    # refreshed after any background update.
    [string]$SourceLabel = 'Chocolatey'
    [string]$VersionLabel = '-'
    [bool]$IsPinned
    [bool]$IsWinget
    [bool]$IsUrl
    [bool]$ShowNoMapping     # a row still being looked up has nothing useful to say about its config
    [bool]$NeedsUrl          # a url row with no installer link yet - click it to add one

    [void] Sync() {
        $this.IsWinget = ($this.Source -eq 'winget')
        $this.IsUrl    = ($this.Source -eq 'url')
        # A url package with no InstallUrl in its mapping is unfinished - it was added from
        # "Browse installed" for a program neither repository carries, and needs a link.
        $this.NeedsUrl = $this.IsUrl -and (-not $this.HasUrl) -and (-not $this.Resolving)
        $this.ShowNoMapping = (-not $this.HasMapping) -and (-not $this.Resolving) -and (-not $this.NeedsUrl)
        $this.SourceLabel = switch ($this.Source) {
            'winget' { 'winget' }
            'url'    { 'custom URL' }
            default  { 'Chocolatey' }
        }
        $this.IsPinned = [bool]$this.Version
        $this.VersionLabel = if ($this.Resolving) { '...' }
                             elseif ($this.NeedsUrl) { 'set URL' }
                             elseif ($this.Version) { $this.Version }
                             elseif ($this.Latest) { $this.Latest }
                             else { '-' }
    }
}

class InstalledRow {
    [string]$Display     # what Windows calls it
    [string]$Id          # package id; '' until resolved, stays '' when nothing carries it
    [string]$Source      # chocolatey | winget | ''
    [string]$State       # known | cached | pending | checking | notfound
    [string]$Status      # the text shown in the row
    [bool]$Selected
    [bool]$Resolved      # has an id - an unresolved row is greyed out
}

# --- packages.txt ---

# ['+'] ['winget:'|'url:'] <name> ['@' <version>] - the grammar the engine's Get-PackageSpec parses
function ConvertFrom-PackageLine {
    param([string]$Line)

    $text = $Line.Trim()
    $isConfig = $text.StartsWith('+')
    if ($isConfig) { $text = $text.Substring(1).Trim() }

    $source = 'chocolatey'
    if ($text -match '^(?i)winget:\s*(.+)$') {
        $source = 'winget'
        $text = $Matches[1].Trim()
    }
    elseif ($text -match '^(?i)url:\s*(.+)$') {
        $source = 'url'
        $text = $Matches[1].Trim()
    }
    elseif ($text -match '^(?i)choco(?:latey)?:\s*(.+)$') {
        $text = $Matches[1].Trim()
    }

    $version = ''
    if ($text -match '^(.+?)@([^@]+)$') {
        $text = $Matches[1].Trim()
        $version = $Matches[2].Trim()
    }

    return [pscustomobject]@{ Config = $isConfig; Source = $source; Name = $text; Version = $version }
}

function ConvertTo-PackageLine {
    param([PackageRow]$Row)

    $prefix = switch ($Row.Source) {
        'winget' { 'winget:' }
        'url'    { 'url:' }
        default  { '' }
    }
    $line = "$prefix$($Row.Name)"
    if ($Row.Version) { $line += "@$($Row.Version)" }
    if ($Row.Config)  { $line = "+$line" }
    return $line
}

function Update-RowMapping {
    param([PackageRow]$Row)

    $Row.HasMapping = Test-MappingHasConfig $Row.Name
    $Row.HasUrl     = [bool](Get-MappingValue $Row.Name 'InstallUrl')
}

function New-PackageRow {
    param(
        [string]$Name,
        [string]$Source = 'chocolatey',
        [string]$Version = '',
        [bool]$Config = $false
    )

    $row = [PackageRow]::new()
    $row.Name    = $Name
    $row.Source  = $Source
    $row.Version = $Version
    $row.Config  = $Config
    Update-RowMapping $row

    # Everything already known about this package comes back for free from the catalog
    $cached = Get-CatalogPackage -Source $Source -Id $Name
    if ($cached) {
        $row.Latest    = [string]$cached.version
        $row.Moniker   = [string]$cached.moniker
        $row.AltSource = [string]$cached.altSource
        $row.AltId     = [string]$cached.altId
    }
    $row.Sync()
    return $row
}

$Script:OriginalLines = @(Get-Content $Script:PackagesFile)
$Script:Rows = [System.Collections.ObjectModel.ObservableCollection[PackageRow]]::new()

foreach ($line in $Script:OriginalLines) {
    $trimmed = $line.Trim()
    if ($trimmed -eq '' -or $trimmed.StartsWith('#')) { continue }
    $spec = ConvertFrom-PackageLine $trimmed
    $Script:Rows.Add((New-PackageRow -Name $spec.Name -Source $spec.Source -Version $spec.Version -Config $spec.Config))
}

# --- Shared XAML resources (light, high-contrast theme) ---

$sharedResources = @'
    <SolidColorBrush x:Key="Accent"      Color="#2F6BFF"/>
    <SolidColorBrush x:Key="AccentHover" Color="#1F5BF0"/>
    <SolidColorBrush x:Key="Card"        Color="#FFFFFF"/>
    <SolidColorBrush x:Key="Border"      Color="#D5DAE3"/>
    <SolidColorBrush x:Key="Text"        Color="#1A1E27"/>
    <SolidColorBrush x:Key="Muted"       Color="#5C6577"/>

    <Style TargetType="TextBlock">
      <Setter Property="Foreground" Value="{StaticResource Text}"/>
    </Style>

    <Style TargetType="ScrollBar">
      <Setter Property="Width" Value="9"/>
      <Setter Property="Background" Value="Transparent"/>
      <Setter Property="Template">
        <Setter.Value>
          <ControlTemplate TargetType="ScrollBar">
            <Grid Background="Transparent">
              <Track x:Name="PART_Track" IsDirectionReversed="True">
                <Track.Thumb>
                  <Thumb>
                    <Thumb.Template>
                      <ControlTemplate TargetType="Thumb">
                        <Border Background="#B4BCCA" CornerRadius="4" Margin="1"/>
                      </ControlTemplate>
                    </Thumb.Template>
                  </Thumb>
                </Track.Thumb>
              </Track>
            </Grid>
          </ControlTemplate>
        </Setter.Value>
      </Setter>
      <Style.Triggers>
        <Trigger Property="Orientation" Value="Horizontal">
          <Setter Property="Width" Value="Auto"/>
          <Setter Property="Height" Value="9"/>
        </Trigger>
      </Style.Triggers>
    </Style>

    <Style TargetType="CheckBox">
      <Setter Property="Foreground" Value="{StaticResource Text}"/>
      <Setter Property="Cursor" Value="Hand"/>
      <Setter Property="VerticalContentAlignment" Value="Center"/>
      <Setter Property="Template">
        <Setter.Value>
          <ControlTemplate TargetType="CheckBox">
            <StackPanel Orientation="Horizontal" Background="Transparent">
              <Border x:Name="box" Width="18" Height="18" CornerRadius="4"
                      BorderThickness="1.5" BorderBrush="#A9B2C1" Background="#FFFFFF"
                      VerticalAlignment="Center">
                <Path x:Name="check" Data="M3.5,9 L7,12.5 L14,4.5" Stroke="#FFFFFF"
                      StrokeThickness="2" StrokeStartLineCap="Round" StrokeEndLineCap="Round"
                      Visibility="Collapsed"/>
              </Border>
              <ContentPresenter x:Name="content" Margin="7,0,0,0" VerticalAlignment="Center"
                                RecognizesAccessKey="True"/>
            </StackPanel>
            <ControlTemplate.Triggers>
              <Trigger Property="IsChecked" Value="True">
                <Setter TargetName="box" Property="Background" Value="{StaticResource Accent}"/>
                <Setter TargetName="box" Property="BorderBrush" Value="{StaticResource Accent}"/>
                <Setter TargetName="check" Property="Visibility" Value="Visible"/>
              </Trigger>
              <Trigger Property="IsMouseOver" Value="True">
                <Setter TargetName="box" Property="BorderBrush" Value="{StaticResource Accent}"/>
              </Trigger>
              <Trigger Property="IsEnabled" Value="False">
                <Setter Property="Opacity" Value="0.45"/>
              </Trigger>
              <Trigger Property="Content" Value="{x:Null}">
                <Setter TargetName="content" Property="Margin" Value="0"/>
              </Trigger>
            </ControlTemplate.Triggers>
          </ControlTemplate>
        </Setter.Value>
      </Setter>
    </Style>

    <Style x:Key="PrimaryButton" TargetType="Button">
      <Setter Property="Background" Value="{StaticResource Accent}"/>
      <Setter Property="Foreground" Value="#FFFFFF"/>
      <Setter Property="FontWeight" Value="SemiBold"/>
      <Setter Property="Padding" Value="18,9"/>
      <Setter Property="Cursor" Value="Hand"/>
      <Setter Property="Template">
        <Setter.Value>
          <ControlTemplate TargetType="Button">
            <Border x:Name="bd" Background="{TemplateBinding Background}" CornerRadius="7"
                    Padding="{TemplateBinding Padding}">
              <ContentPresenter HorizontalAlignment="Center" VerticalAlignment="Center"/>
            </Border>
            <ControlTemplate.Triggers>
              <Trigger Property="IsMouseOver" Value="True">
                <Setter TargetName="bd" Property="Background" Value="{StaticResource AccentHover}"/>
              </Trigger>
              <Trigger Property="IsPressed" Value="True">
                <Setter TargetName="bd" Property="Background" Value="#1A4FD6"/>
              </Trigger>
              <Trigger Property="IsEnabled" Value="False">
                <Setter TargetName="bd" Property="Background" Value="#DCE1E9"/>
                <Setter Property="Foreground" Value="#959DAC"/>
              </Trigger>
            </ControlTemplate.Triggers>
          </ControlTemplate>
        </Setter.Value>
      </Setter>
    </Style>

    <Style x:Key="SecondaryButton" TargetType="Button">
      <Setter Property="Background" Value="#FFFFFF"/>
      <Setter Property="Foreground" Value="#2C3444"/>
      <Setter Property="FontWeight" Value="SemiBold"/>
      <Setter Property="Padding" Value="16,9"/>
      <Setter Property="Cursor" Value="Hand"/>
      <Setter Property="Template">
        <Setter.Value>
          <ControlTemplate TargetType="Button">
            <Border x:Name="bd" Background="{TemplateBinding Background}" CornerRadius="7"
                    BorderBrush="#C2CAD6" BorderThickness="1" Padding="{TemplateBinding Padding}">
              <ContentPresenter HorizontalAlignment="Center" VerticalAlignment="Center"/>
            </Border>
            <ControlTemplate.Triggers>
              <Trigger Property="IsMouseOver" Value="True">
                <Setter TargetName="bd" Property="Background" Value="#F0F4FB"/>
                <Setter TargetName="bd" Property="BorderBrush" Value="{StaticResource Accent}"/>
              </Trigger>
              <Trigger Property="IsEnabled" Value="False">
                <Setter TargetName="bd" Property="Background" Value="#EEF1F5"/>
                <Setter Property="Foreground" Value="#9AA3B2"/>
              </Trigger>
            </ControlTemplate.Triggers>
          </ControlTemplate>
        </Setter.Value>
      </Setter>
    </Style>

    <Style TargetType="TextBox">
      <Setter Property="Foreground" Value="{StaticResource Text}"/>
      <Setter Property="CaretBrush" Value="{StaticResource Text}"/>
      <Setter Property="Background" Value="#FFFFFF"/>
      <Setter Property="BorderBrush" Value="{StaticResource Border}"/>
      <Setter Property="Padding" Value="10,9"/>
      <Setter Property="Template">
        <Setter.Value>
          <ControlTemplate TargetType="TextBox">
            <Border x:Name="bd" Background="{TemplateBinding Background}"
                    BorderBrush="{TemplateBinding BorderBrush}" BorderThickness="1" CornerRadius="7">
              <ScrollViewer x:Name="PART_ContentHost" Margin="{TemplateBinding Padding}"
                            VerticalAlignment="Center"/>
            </Border>
            <ControlTemplate.Triggers>
              <Trigger Property="IsKeyboardFocused" Value="True">
                <Setter TargetName="bd" Property="BorderBrush" Value="{StaticResource Accent}"/>
              </Trigger>
              <Trigger Property="IsEnabled" Value="False">
                <Setter TargetName="bd" Property="Background" Value="#EEF1F5"/>
              </Trigger>
            </ControlTemplate.Triggers>
          </ControlTemplate>
        </Setter.Value>
      </Setter>
    </Style>

    <!-- A multi-line box: the single-line template centres its content, which looks wrong here -->
    <Style x:Key="MultiLineBox" TargetType="TextBox">
      <Setter Property="Foreground" Value="{StaticResource Text}"/>
      <Setter Property="CaretBrush" Value="{StaticResource Text}"/>
      <Setter Property="Background" Value="#FFFFFF"/>
      <Setter Property="BorderBrush" Value="{StaticResource Border}"/>
      <Setter Property="BorderThickness" Value="1"/>
      <Setter Property="Padding" Value="9,7"/>
      <Setter Property="AcceptsReturn" Value="True"/>
      <Setter Property="TextWrapping" Value="NoWrap"/>
      <Setter Property="VerticalScrollBarVisibility" Value="Auto"/>
      <Setter Property="HorizontalScrollBarVisibility" Value="Auto"/>
      <Setter Property="FontFamily" Value="Cascadia Mono, Consolas"/>
      <Setter Property="FontSize" Value="12"/>
      <Setter Property="Template">
        <Setter.Value>
          <ControlTemplate TargetType="TextBox">
            <Border x:Name="bd" Background="{TemplateBinding Background}"
                    BorderBrush="{TemplateBinding BorderBrush}" BorderThickness="1" CornerRadius="7">
              <ScrollViewer x:Name="PART_ContentHost" Margin="{TemplateBinding Padding}"/>
            </Border>
            <ControlTemplate.Triggers>
              <Trigger Property="IsKeyboardFocused" Value="True">
                <Setter TargetName="bd" Property="BorderBrush" Value="{StaticResource Accent}"/>
              </Trigger>
            </ControlTemplate.Triggers>
          </ControlTemplate>
        </Setter.Value>
      </Setter>
    </Style>

    <!-- A cell that behaves like a dropdown: current value plus a chevron -->
    <Style x:Key="CellButton" TargetType="Button">
      <Setter Property="Background" Value="Transparent"/>
      <Setter Property="Foreground" Value="#2C3444"/>
      <Setter Property="Cursor" Value="Hand"/>
      <Setter Property="HorizontalAlignment" Value="Center"/>
      <Setter Property="Padding" Value="8,3"/>
      <Setter Property="Template">
        <Setter.Value>
          <ControlTemplate TargetType="Button">
            <Border x:Name="bd" Background="{TemplateBinding Background}" CornerRadius="5"
                    BorderBrush="Transparent" BorderThickness="1" Padding="{TemplateBinding Padding}">
              <ContentPresenter HorizontalAlignment="Center" VerticalAlignment="Center"/>
            </Border>
            <ControlTemplate.Triggers>
              <Trigger Property="IsMouseOver" Value="True">
                <Setter TargetName="bd" Property="Background" Value="#FFFFFF"/>
                <Setter TargetName="bd" Property="BorderBrush" Value="#C2CAD6"/>
              </Trigger>
            </ControlTemplate.Triggers>
          </ControlTemplate>
        </Setter.Value>
      </Setter>
    </Style>

    <Style x:Key="IconButton" TargetType="Button">
      <Setter Property="Foreground" Value="#98A1B0"/>
      <Setter Property="Background" Value="Transparent"/>
      <Setter Property="Width" Value="26"/>
      <Setter Property="Height" Value="26"/>
      <Setter Property="FontSize" Value="13"/>
      <Setter Property="Cursor" Value="Hand"/>
      <Setter Property="Template">
        <Setter.Value>
          <ControlTemplate TargetType="Button">
            <Border x:Name="bd" Background="{TemplateBinding Background}" CornerRadius="6">
              <ContentPresenter HorizontalAlignment="Center" VerticalAlignment="Center"/>
            </Border>
            <ControlTemplate.Triggers>
              <Trigger Property="IsMouseOver" Value="True">
                <Setter TargetName="bd" Property="Background" Value="#E7EDF9"/>
                <Setter Property="Foreground" Value="#2F6BFF"/>
              </Trigger>
            </ControlTemplate.Triggers>
          </ControlTemplate>
        </Setter.Value>
      </Setter>
    </Style>

    <Style x:Key="RemoveButton" TargetType="Button" BasedOn="{StaticResource IconButton}">
      <Setter Property="FontSize" Value="12"/>
      <Setter Property="Template">
        <Setter.Value>
          <ControlTemplate TargetType="Button">
            <Border x:Name="bd" Background="{TemplateBinding Background}" CornerRadius="6">
              <ContentPresenter HorizontalAlignment="Center" VerticalAlignment="Center"/>
            </Border>
            <ControlTemplate.Triggers>
              <Trigger Property="IsMouseOver" Value="True">
                <Setter TargetName="bd" Property="Background" Value="#FDE7E6"/>
                <Setter Property="Foreground" Value="#C0392B"/>
              </Trigger>
            </ControlTemplate.Triggers>
          </ControlTemplate>
        </Setter.Value>
      </Setter>
    </Style>
'@

# --- Main window ---

$xaml = @"
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Software Manager" Width="1080" Height="800"
        MinWidth="900" MinHeight="640"
        WindowStartupLocation="CenterScreen"
        Background="#F2F4F7" FontFamily="Segoe UI" FontSize="13"
        TextOptions.TextFormattingMode="Display" UseLayoutRounding="True">
  <Window.Resources>
$sharedResources

    <Style TargetType="ProgressBar">
      <Setter Property="Height" Value="6"/>
      <Setter Property="Template">
        <Setter.Value>
          <ControlTemplate TargetType="ProgressBar">
            <Grid>
              <Border x:Name="PART_Track" Background="#DFE4EC" CornerRadius="3"/>
              <Border x:Name="PART_Indicator" Background="{StaticResource Accent}"
                      CornerRadius="3" HorizontalAlignment="Left"/>
            </Grid>
          </ControlTemplate>
        </Setter.Value>
      </Setter>
    </Style>
  </Window.Resources>

  <Grid Margin="24,20,24,20">
    <Grid.RowDefinitions>
      <RowDefinition Height="Auto"/>
      <RowDefinition Height="Auto"/>
      <RowDefinition Height="Auto"/>
      <RowDefinition Height="Auto"/>
      <RowDefinition Height="*" MinHeight="140"/>
      <RowDefinition Height="Auto"/>
      <RowDefinition Height="Auto"/>
      <RowDefinition Height="Auto"/>
      <RowDefinition Height="190"/>
    </Grid.RowDefinitions>

    <StackPanel Grid.Row="0" Margin="0,0,0,16">
      <TextBlock Text="Software Manager" FontSize="22" FontWeight="SemiBold"/>
      <TextBlock Text="Back up app configs from this PC, or install every package below and restore their configs on a new one."
                 Foreground="{StaticResource Muted}" Margin="0,3,0,0"/>
    </StackPanel>

    <Border x:Name="ChocoBanner" Grid.Row="1" Background="#FFF3D9" BorderBrush="#E8C583"
            BorderThickness="1" CornerRadius="8" Padding="14,11" Margin="0,0,0,12"
            Visibility="Collapsed">
      <Grid>
        <StackPanel VerticalAlignment="Center" Margin="0,0,16,0">
          <TextBlock Text="Chocolatey is not installed" FontWeight="SemiBold" Foreground="#7A5600"/>
          <TextBlock Text="It is needed to install packages, verify package ids, and match software already on this PC."
                     Foreground="#8A6100" TextWrapping="Wrap" Margin="0,2,0,0"/>
        </StackPanel>
        <Button x:Name="InstallChocoBtn" Content="Install Chocolatey" Style="{StaticResource PrimaryButton}"
                HorizontalAlignment="Right" VerticalAlignment="Center"/>
      </Grid>
    </Border>

    <Grid Grid.Row="2" Margin="0,0,0,10">
      <Grid.ColumnDefinitions>
        <ColumnDefinition Width="*"/>
        <ColumnDefinition Width="Auto"/>
        <ColumnDefinition Width="Auto"/>
        <ColumnDefinition Width="Auto"/>
      </Grid.ColumnDefinitions>
      <Grid Grid.Column="0">
        <TextBox x:Name="AddBox"/>
        <!-- Margin matches the TextBox's 1px border + 10px padding, so the hint sits exactly
             where the caret does -->
        <TextBlock x:Name="AddHint" Text="Search or add a package, e.g. notepadplusplus"
                   Foreground="#98A1B0" Margin="11,0,0,0" VerticalAlignment="Center"
                   IsHitTestVisible="False"/>
      </Grid>
      <Button x:Name="AddBtn" Grid.Column="1" Content="Add package"
              Style="{StaticResource SecondaryButton}" Margin="10,0,0,0"/>
      <Button x:Name="UrlBtn" Grid.Column="2" Content="Add from URL..."
              Style="{StaticResource SecondaryButton}" Margin="8,0,0,0"
              ToolTip="Install an app from an MSI/EXE link, for apps Chocolatey and winget do not carry"/>
      <Button x:Name="BrowseBtn" Grid.Column="3" Content="Browse installed..."
              Style="{StaticResource SecondaryButton}" Margin="8,0,0,0"
              ToolTip="Pick from software already installed on this PC"/>
    </Grid>

    <Border Grid.Row="3" Background="#EBEEF4" CornerRadius="8,8,0,0"
            BorderBrush="{StaticResource Border}" BorderThickness="1,1,1,0" Padding="14,9">
      <Grid>
        <Grid.ColumnDefinitions>
          <ColumnDefinition Width="*"/>
          <ColumnDefinition Width="130"/>
          <ColumnDefinition Width="110"/>
          <ColumnDefinition Width="130"/>
          <ColumnDefinition Width="36"/>
          <ColumnDefinition Width="32"/>
        </Grid.ColumnDefinitions>
        <TextBlock Text="PACKAGE" Foreground="{StaticResource Muted}" FontSize="11"
                   FontWeight="Bold" VerticalAlignment="Center"/>
        <TextBlock Grid.Column="1" Text="SOURCE" Foreground="{StaticResource Muted}" FontSize="11"
                   FontWeight="Bold" HorizontalAlignment="Center" VerticalAlignment="Center"/>
        <TextBlock Grid.Column="2" Text="VERSION" Foreground="{StaticResource Muted}" FontSize="11"
                   FontWeight="Bold" HorizontalAlignment="Center" VerticalAlignment="Center"/>
        <TextBlock Grid.Column="3" Text="CONFIG" Foreground="{StaticResource Muted}" FontSize="11"
                   FontWeight="Bold" HorizontalAlignment="Left" VerticalAlignment="Center"/>
        <!-- Centred in its column, so it lines up exactly with the checkboxes in the rows -->
        <CheckBox x:Name="HdrConfig" Grid.Column="3" HorizontalAlignment="Center"
                  VerticalAlignment="Center"
                  ToolTip="Back up / restore configs for every package"/>
      </Grid>
    </Border>

    <Border Grid.Row="4" Background="{StaticResource Card}" CornerRadius="0,0,8,8"
            BorderBrush="{StaticResource Border}" BorderThickness="1,0,1,1">
      <ListBox x:Name="PkgList" Background="Transparent" BorderThickness="0" Padding="6"
               ScrollViewer.HorizontalScrollBarVisibility="Disabled"
               HorizontalContentAlignment="Stretch">
        <ListBox.ItemContainerStyle>
          <Style TargetType="ListBoxItem">
            <Setter Property="HorizontalContentAlignment" Value="Stretch"/>
            <Setter Property="Template">
              <Setter.Value>
                <ControlTemplate TargetType="ListBoxItem">
                  <Border x:Name="bd" Background="Transparent" CornerRadius="6" Padding="8,7"
                          BorderBrush="Transparent" BorderThickness="1">
                    <ContentPresenter/>
                  </Border>
                  <ControlTemplate.Triggers>
                    <Trigger Property="IsMouseOver" Value="True">
                      <Setter TargetName="bd" Property="Background" Value="#EEF3FF"/>
                    </Trigger>
                    <Trigger Property="IsSelected" Value="True">
                      <Setter TargetName="bd" Property="Background" Value="#E7EEFF"/>
                      <Setter TargetName="bd" Property="BorderBrush" Value="#B9CBFF"/>
                    </Trigger>
                  </ControlTemplate.Triggers>
                </ControlTemplate>
              </Setter.Value>
            </Setter>
          </Style>
        </ListBox.ItemContainerStyle>
        <ListBox.ItemTemplate>
          <DataTemplate>
            <Grid>
              <Grid.ColumnDefinitions>
                <ColumnDefinition Width="*"/>
                <ColumnDefinition Width="130"/>
                <ColumnDefinition Width="110"/>
                <ColumnDefinition Width="130"/>
                <ColumnDefinition Width="36"/>
                <ColumnDefinition Width="32"/>
              </Grid.ColumnDefinitions>

              <StackPanel Orientation="Horizontal" VerticalAlignment="Center">
                <TextBlock Text="{Binding Name}" FontSize="14" VerticalAlignment="Center"/>
                <!-- Added from "Browse installed" before its package id was known -->
                <Border Background="#E6EDFF" BorderBrush="#B9CBFF" BorderThickness="1"
                        CornerRadius="4" Padding="6,1" Margin="10,0,0,0" VerticalAlignment="Center"
                        ToolTip="Looking this program up in Chocolatey and winget...">
                  <Border.Style>
                    <Style TargetType="Border">
                      <Setter Property="Visibility" Value="Collapsed"/>
                      <Style.Triggers>
                        <DataTrigger Binding="{Binding Resolving}" Value="True">
                          <Setter Property="Visibility" Value="Visible"/>
                        </DataTrigger>
                      </Style.Triggers>
                    </Style>
                  </Border.Style>
                  <TextBlock Text="checking..." FontSize="10.5" Foreground="#2F4C9E"/>
                </Border>
                <!-- A custom-installer package that still needs its download link. Neither
                     repository carries it, so click the row's source or version cell to add one. -->
                <Border Background="#FDE7E6" BorderBrush="#F0B4AE" BorderThickness="1"
                        CornerRadius="4" Padding="6,1" Margin="10,0,0,0" VerticalAlignment="Center"
                        ToolTip="Neither Chocolatey nor winget has this - click the source or version cell to add an installer URL.">
                  <Border.Style>
                    <Style TargetType="Border">
                      <Setter Property="Visibility" Value="Collapsed"/>
                      <Style.Triggers>
                        <DataTrigger Binding="{Binding NeedsUrl}" Value="True">
                          <Setter Property="Visibility" Value="Visible"/>
                        </DataTrigger>
                      </Style.Triggers>
                    </Style>
                  </Border.Style>
                  <TextBlock Text="needs URL" FontSize="10.5" Foreground="#B0553F"/>
                </Border>
                <Border Background="#FFF3D9" BorderBrush="#E8C583" BorderThickness="1"
                        CornerRadius="4" Padding="6,1" Margin="10,0,0,0" VerticalAlignment="Center"
                        ToolTip="Nothing to back up: no config paths in ConfigMappings.ps1. Use the actions menu to add some.">
                  <Border.Style>
                    <Style TargetType="Border">
                      <Setter Property="Visibility" Value="Collapsed"/>
                      <Style.Triggers>
                        <DataTrigger Binding="{Binding ShowNoMapping}" Value="True">
                          <Setter Property="Visibility" Value="Visible"/>
                        </DataTrigger>
                      </Style.Triggers>
                    </Style>
                  </Border.Style>
                  <TextBlock Text="no config mapping" FontSize="10.5" Foreground="#8A6100"/>
                </Border>
                <Border Background="#F3ECFF" BorderBrush="#CDB8FF" BorderThickness="1"
                        CornerRadius="4" Padding="6,1" Margin="8,0,0,0" VerticalAlignment="Center"
                        ToolTip="Pinned to a specific version">
                  <Border.Style>
                    <Style TargetType="Border">
                      <Setter Property="Visibility" Value="Collapsed"/>
                      <Style.Triggers>
                        <DataTrigger Binding="{Binding IsPinned}" Value="True">
                          <Setter Property="Visibility" Value="Visible"/>
                        </DataTrigger>
                      </Style.Triggers>
                    </Style>
                  </Border.Style>
                  <TextBlock Text="pinned" FontSize="10.5" Foreground="#5B32A8"/>
                </Border>
                <TextBlock Text="{Binding Moniker}" FontSize="11.5" Foreground="{StaticResource Muted}"
                           Margin="10,0,0,0" VerticalAlignment="Center"/>
              </StackPanel>

              <Button Grid.Column="1" Tag="source" Style="{StaticResource CellButton}"
                      ToolTip="Change where this package is installed from">
                <StackPanel Orientation="Horizontal">
                  <Border CornerRadius="4" Padding="6,1" VerticalAlignment="Center">
                    <Border.Style>
                      <Style TargetType="Border">
                        <Setter Property="Background" Value="#F1E4D4"/>
                        <Setter Property="BorderBrush" Value="#DDC3A5"/>
                        <Setter Property="BorderThickness" Value="1"/>
                        <Style.Triggers>
                          <DataTrigger Binding="{Binding IsWinget}" Value="True">
                            <Setter Property="Background" Value="#E6EDFF"/>
                            <Setter Property="BorderBrush" Value="#B9CBFF"/>
                          </DataTrigger>
                          <DataTrigger Binding="{Binding IsUrl}" Value="True">
                            <Setter Property="Background" Value="#F3ECFF"/>
                            <Setter Property="BorderBrush" Value="#CDB8FF"/>
                          </DataTrigger>
                        </Style.Triggers>
                      </Style>
                    </Border.Style>
                    <TextBlock Text="{Binding SourceLabel}" FontSize="10.5">
                      <TextBlock.Style>
                        <Style TargetType="TextBlock">
                          <Setter Property="Foreground" Value="#7A4B16"/>
                          <Style.Triggers>
                            <DataTrigger Binding="{Binding IsWinget}" Value="True">
                              <Setter Property="Foreground" Value="#2F4C9E"/>
                            </DataTrigger>
                            <DataTrigger Binding="{Binding IsUrl}" Value="True">
                              <Setter Property="Foreground" Value="#5B32A8"/>
                            </DataTrigger>
                          </Style.Triggers>
                        </Style>
                      </TextBlock.Style>
                    </TextBlock>
                  </Border>
                  <TextBlock Text="&#x25BE;" FontSize="10" Foreground="#98A1B0" Margin="4,0,0,0"
                             VerticalAlignment="Center"/>
                </StackPanel>
              </Button>

              <Button Grid.Column="2" Tag="version" Style="{StaticResource CellButton}"
                      ToolTip="Pin this package to a specific version">
                <StackPanel Orientation="Horizontal">
                  <TextBlock Text="{Binding VersionLabel}" FontSize="12" VerticalAlignment="Center">
                    <TextBlock.Style>
                      <Style TargetType="TextBlock">
                        <Setter Property="Foreground" Value="{StaticResource Muted}"/>
                        <Style.Triggers>
                          <DataTrigger Binding="{Binding IsPinned}" Value="True">
                            <Setter Property="Foreground" Value="#5B32A8"/>
                            <Setter Property="FontWeight" Value="SemiBold"/>
                          </DataTrigger>
                        </Style.Triggers>
                      </Style>
                    </TextBlock.Style>
                  </TextBlock>
                  <TextBlock Text="&#x25BE;" FontSize="10" Foreground="#98A1B0" Margin="4,0,0,0"
                             VerticalAlignment="Center"/>
                </StackPanel>
              </Button>

              <CheckBox Grid.Column="3" Tag="config" HorizontalAlignment="Center" VerticalAlignment="Center"
                        IsChecked="{Binding Config, Mode=TwoWay, UpdateSourceTrigger=PropertyChanged}"
                        ToolTip="Back up and restore this package's config"/>

              <Button Grid.Column="4" Content="&#x22EF;" Tag="menu" Style="{StaticResource IconButton}"
                      HorizontalAlignment="Center" VerticalAlignment="Center" ToolTip="Actions"/>
              <Button Grid.Column="5" Content="&#x2715;" Tag="remove" Style="{StaticResource RemoveButton}"
                      HorizontalAlignment="Center" VerticalAlignment="Center" ToolTip="Remove from list"/>
            </Grid>
          </DataTemplate>
        </ListBox.ItemTemplate>
      </ListBox>
    </Border>

    <!-- Details for the selected package -->
    <Border x:Name="DetailPane" Grid.Row="5" Background="{StaticResource Card}" CornerRadius="8"
            BorderBrush="{StaticResource Border}" BorderThickness="1" Padding="14,12"
            Margin="0,10,0,0" Visibility="Collapsed">
      <Grid>
        <Grid.ColumnDefinitions>
          <ColumnDefinition Width="*"/>
          <ColumnDefinition Width="Auto"/>
        </Grid.ColumnDefinitions>
        <StackPanel Grid.Column="0" Margin="0,0,16,0">
          <TextBlock x:Name="DetailTitle" FontSize="15" FontWeight="SemiBold"/>
          <TextBlock x:Name="DetailMeta" Foreground="{StaticResource Muted}" TextWrapping="Wrap"
                     Margin="0,3,0,0"/>
          <TextBlock x:Name="DetailConfig" Foreground="{StaticResource Muted}" TextWrapping="Wrap"
                     Margin="0,3,0,0"/>
        </StackPanel>
        <StackPanel Grid.Column="1" Orientation="Horizontal" VerticalAlignment="Center">
          <Button x:Name="DetailConfigBtn" Content="Edit config" Style="{StaticResource SecondaryButton}"/>
          <Button x:Name="DetailActionsBtn" Content="Actions" Style="{StaticResource SecondaryButton}"
                  Margin="8,0,0,0"/>
        </StackPanel>
      </Grid>
    </Border>

    <Grid Grid.Row="6" Margin="0,14,0,0">
      <StackPanel Orientation="Horizontal">
        <Button x:Name="BackupBtn" Content="Back up configs" Style="{StaticResource PrimaryButton}"/>
        <Button x:Name="InstallBtn" Content="Install &amp; restore" Style="{StaticResource PrimaryButton}" Margin="10,0,0,0"/>
      </StackPanel>
      <StackPanel Orientation="Horizontal" HorizontalAlignment="Right">
        <TextBlock x:Name="StatusText" Foreground="{StaticResource Muted}" VerticalAlignment="Center" Margin="0,0,14,0"/>
        <Button x:Name="SaveBtn" Content="Save list" Style="{StaticResource SecondaryButton}"/>
      </StackPanel>
    </Grid>

    <Grid Grid.Row="7" Margin="0,12,0,12">
      <Grid.ColumnDefinitions>
        <ColumnDefinition Width="*"/>
        <ColumnDefinition Width="Auto"/>
      </Grid.ColumnDefinitions>
      <ProgressBar x:Name="Progress" VerticalAlignment="Center"/>
      <TextBlock x:Name="ProgressText" Grid.Column="1" Foreground="{StaticResource Muted}"
                 FontSize="11.5" Margin="12,0,0,0" VerticalAlignment="Center"/>
    </Grid>

    <Border Grid.Row="8" Background="{StaticResource Card}" CornerRadius="8"
            BorderBrush="{StaticResource Border}" BorderThickness="1" Padding="10,6,10,10">
      <Grid>
        <Grid.RowDefinitions>
          <RowDefinition Height="Auto"/>
          <RowDefinition Height="*"/>
        </Grid.RowDefinitions>

        <Grid Grid.Row="0" Margin="2,0,0,4">
          <TextBlock Text="LOG" Foreground="{StaticResource Muted}" FontSize="11" FontWeight="Bold"
                     VerticalAlignment="Center"/>
          <StackPanel Orientation="Horizontal" HorizontalAlignment="Right">
            <Button x:Name="CopyLogBtn" Style="{StaticResource IconButton}"
                    FontFamily="Segoe MDL2 Assets" Content="&#xE8C8;"
                    ToolTip="Copy the log to the clipboard"/>
            <Button x:Name="ClearLogBtn" Style="{StaticResource RemoveButton}"
                    FontFamily="Segoe MDL2 Assets" Content="&#xE74D;" Margin="2,0,0,0"
                    ToolTip="Clear the log shown here (install-log.txt is untouched)"/>
          </StackPanel>
        </Grid>

        <ListBox x:Name="LogList" Grid.Row="1" Background="Transparent" BorderThickness="0"
                 FontFamily="Cascadia Mono, Consolas" FontSize="12"
                 ScrollViewer.HorizontalScrollBarVisibility="Auto">
          <ListBox.ItemContainerStyle>
            <Style TargetType="ListBoxItem">
              <Setter Property="Focusable" Value="False"/>
              <Setter Property="Padding" Value="2,1"/>
              <Setter Property="Template">
                <Setter.Value>
                  <ControlTemplate TargetType="ListBoxItem">
                    <ContentPresenter Margin="{TemplateBinding Padding}"/>
                  </ControlTemplate>
                </Setter.Value>
              </Setter>
            </Style>
          </ListBox.ItemContainerStyle>
        </ListBox>
      </Grid>
    </Border>
  </Grid>
</Window>
"@

$Script:Window = [System.Windows.Markup.XamlReader]::Parse($xaml)

$Script:Ui = @{}
foreach ($name in 'AddBox', 'AddHint', 'AddBtn', 'UrlBtn', 'BrowseBtn', 'HdrConfig', 'PkgList',
                  'DetailPane', 'DetailTitle', 'DetailMeta', 'DetailConfig', 'DetailConfigBtn', 'DetailActionsBtn',
                  'BackupBtn', 'InstallBtn', 'SaveBtn', 'StatusText', 'Progress', 'ProgressText', 'LogList',
                  'CopyLogBtn', 'ClearLogBtn', 'ChocoBanner', 'InstallChocoBtn') {
    $Script:Ui[$name] = $Script:Window.FindName($name)
}

$Script:Ui.PkgList.ItemsSource = $Script:Rows
$Script:Dirty = $false
$Script:Running = $false
$Script:RunControls = 'AddBox', 'AddBtn', 'UrlBtn', 'BrowseBtn', 'PkgList', 'BackupBtn', 'InstallBtn',
                      'SaveBtn', 'HdrConfig', 'InstallChocoBtn', 'DetailConfigBtn', 'DetailActionsBtn'

$Script:BrushConverter = [System.Windows.Media.BrushConverter]::new()
function Get-Brush {
    param([string]$Hex)
    return $Script:BrushConverter.ConvertFromString($Hex)
}

$Script:LevelColors = @{
    Info    = '#1F7A3D'
    Warning = '#8A6100'
    Error   = '#C0392B'
    Detail  = '#5C6577'
}

function Set-Status {
    param([string]$Message, [string]$Color = '#5C6577')
    $Script:Ui.StatusText.Text = $Message
    $Script:Ui.StatusText.Foreground = Get-Brush $Color
}

function Add-LogLine {
    param([string]$Text, [string]$Level = 'Info')

    # Startup errors can arrive before the window is parsed - keep them until it is
    if (-not $Script:Ui -or -not $Script:Ui.LogList) {
        if (-not $Script:PendingLog) { $Script:PendingLog = [System.Collections.Generic.List[object]]::new() }
        $Script:PendingLog.Add(@{ Text = $Text; Level = $Level })
        return
    }

    $tb = [System.Windows.Controls.TextBlock]::new()
    $tb.Text = "[$(Get-Date -Format 'HH:mm:ss')] $Text"
    $tb.Foreground = Get-Brush $Script:LevelColors[$Level]
    $null = $Script:Ui.LogList.Items.Add($tb)
    while ($Script:Ui.LogList.Items.Count -gt 500) { $Script:Ui.LogList.Items.RemoveAt(0) }
    $Script:Ui.LogList.ScrollIntoView($Script:Ui.LogList.Items[$Script:Ui.LogList.Items.Count - 1])
}

function Copy-LogToClipboard {
    $lines = @($Script:Ui.LogList.Items | ForEach-Object { $_.Text })
    if ($lines.Count -eq 0) {
        Set-Status 'The log is empty - nothing to copy' '#8A6100'
        return
    }
    try {
        [System.Windows.Clipboard]::SetText($lines -join "`r`n")
        Set-Status "Copied $($lines.Count) log line(s) to the clipboard" '#1F7A3D'
    }
    catch {
        # The clipboard is a shared resource; another process can hold it open
        Set-Status "Could not copy to the clipboard: $_" '#C0392B'
    }
}

function Clear-LogPane {
    $Script:Ui.LogList.Items.Clear()
    Set-Status 'Cleared the log (install-log.txt still has everything)'
}

foreach ($pending in @($Script:PendingLog)) {
    if ($pending) { Add-LogLine $pending.Text $pending.Level }
}
$Script:PendingLog = $null

function Set-Dirty {
    $Script:Dirty = $true
    Set-Status 'Unsaved changes - click "Save list" to update packages.txt'
}

function Update-PackageList {
    # PowerShell classes cannot raise PropertyChanged, so a row edited in the background is
    # shown by refreshing the list rather than through a binding notification.
    $selected = $Script:Ui.PkgList.SelectedItem
    $Script:Ui.PkgList.Items.Refresh()
    $Script:Ui.PkgList.SelectedItem = $selected
    Show-PackageDetail
}

# --- Background work ---

# Runs a scriptblock in a background runspace and calls OnComplete on the UI thread with its
# output. Every choco/winget call goes through this so the window never freezes. Work that
# reports progress enqueues strings into the queue it is handed, drained on each tick.
#
# Returns a handle whose Cancelled flag can be set to abandon the job: the next tick tears the
# runspace down and OnComplete is never called. Whatever the work already reported through the
# progress queue has been applied, and stays applied - cancelling stops it, it does not undo it.
function Start-BackgroundJob {
    param(
        [scriptblock]$Work,
        [object[]]$Arguments = @(),
        [scriptblock]$OnComplete,
        [scriptblock]$OnProgress
    )

    $progressQueue = [System.Collections.Concurrent.ConcurrentQueue[string]]::new()

    $runspace = [runspacefactory]::CreateRunspace()
    $runspace.Open()
    $ps = [powershell]::Create()
    $ps.Runspace = $runspace
    $null = $ps.AddScript($Work.ToString())
    foreach ($arg in $Arguments) { $null = $ps.AddArgument($arg) }
    $null = $ps.AddArgument($progressQueue)
    $async = $ps.BeginInvoke()

    $job = [pscustomobject]@{ Cancelled = $false }

    $timer = [System.Windows.Threading.DispatcherTimer]::new()
    $timer.Interval = [timespan]::FromMilliseconds(120)
    # A closure, but it captures only its own locals and calls nothing but script functions -
    # see the note in Add-Package about why a closure must never touch $Script: inline.
    $timer.Add_Tick({
        if ($job.Cancelled) {
            $timer.Stop()
            # BeginStop, not Stop: the work is mid-`choco search` and Stop() would block the UI
            # thread until it returns. Dispose from the callback once it has actually wound down.
            $done = [AsyncCallback]{
                param($result)
                try { $ps.EndStop($result) } catch { }
                $ps.Dispose()
                $runspace.Dispose()
            }
            try { $null = $ps.BeginStop($done, $null) } catch { }
            return
        }

        $update = $null
        while ($progressQueue.TryDequeue([ref]$update)) {
            if ($OnProgress) {
                try { & $OnProgress $update } catch { Add-LogLine "Progress handler failed: $_" 'Error' }
            }
        }
        if (-not $async.IsCompleted) { return }
        $timer.Stop()
        $output = $null
        try { $output = $ps.EndInvoke($async) }
        catch { Add-LogLine "Background task failed: $_" 'Error' }
        $ps.Dispose()
        $runspace.Dispose()
        try { & $OnComplete $output }
        catch { Add-LogLine "Background task result could not be applied: $_" 'Error' }
    }.GetNewClosure())
    $timer.Start()

    return $job
}

# All repository lookups live in one scriptblock so the id-guessing logic is written once. It
# runs in a bare runspace (no access to this script's functions), hence the local helpers.
#
# Windows names software for humans ("Notepad++ (64-bit)"), which is never a Chocolatey id.
# `choco search` returns matches alphabetically, not by relevance, so picking its top hit gives
# nonsense (searching "Notepad++" suggests "crypto-notepad"). Instead we derive plausible ids
# from the name and confirm each with an *exact* lookup - a candidate is only accepted if a
# package with precisely that id exists.
$Script:PkgWork = {
    param($Action, $Payload, $Queue)

    $stopwords = @('microsoft', 'windows', 'update', 'redistributable', 'runtime', 'edition',
                   'release', 'version', 'media', 'player', 'tools', 'driver', 'the', 'for')

    function Get-Normalized {
        param([string]$Text)
        return ($Text -replace '\+\+', 'plusplus' -replace '[^A-Za-z0-9]', '').ToLower()
    }

    # How many single-character edits apart two ids are. This is what turns "notpadplusplus"
    # into a suggestion of "notepadplusplus" instead of a dead end.
    function Get-EditDistance {
        param([string]$A, [string]$B)

        if (-not $A) { return $B.Length }
        if (-not $B) { return $A.Length }

        $previous = 0..$B.Length
        for ($i = 1; $i -le $A.Length; $i++) {
            $current = @($i) + (1..$B.Length | ForEach-Object { 0 })
            for ($j = 1; $j -le $B.Length; $j++) {
                $cost = if ($A[$i - 1] -eq $B[$j - 1]) { 0 } else { 1 }
                $current[$j] = [Math]::Min(
                    [Math]::Min($current[$j - 1] + 1, $previous[$j] + 1),
                    $previous[$j - 1] + $cost)
            }
            $previous = $current
        }
        return $previous[$B.Length]
    }

    # Both repositories match on whole tokens, not substrings, and neither tolerates a typo:
    # `choco search notpad` and `winget search chorme` each return nothing at all. So a
    # misspelled *id* cannot be repaired here - there is no candidate list to rank. What edit
    # distance is good for is ordering the hits a search does return, so the closest one to
    # what was typed comes first.

    function Get-CandidateIds {
        param([string]$Name)

        # Strip the parenthesised noise Windows names carry ("(64-bit x64)"), version numbers,
        # and the trademark marks. NOT with a character class: -replace is case-insensitive, so
        # '[(R)(TM)]' deletes every r, t and m in the name - "Notepad++" became "No epad++" and
        # matched nothing at all.
        $clean = $Name -replace '\(.*?\)', ' ' -replace '\d+(\.\d+)+', ' ' -replace '[®™]', ' '
        $clean = $clean -replace '\+\+', 'plusplus'   # Notepad++ -> notepadplusplus
        $words = @($clean -split '[^A-Za-z0-9]+' | ForEach-Object { $_.ToLower() } | Where-Object { $_ })
        if ($words.Count -eq 0) { return @() }

        $candidates = [System.Collections.Generic.List[string]]::new()
        $candidates.Add(($words -join ''))
        $candidates.Add(($words -join '-'))
        for ($i = 0; $i -lt $words.Count - 1; $i++) {
            $candidates.Add($words[$i] + $words[$i + 1])
            $candidates.Add($words[$i] + '-' + $words[$i + 1])
        }
        foreach ($word in $words) {
            if ($word.Length -ge 3 -and $word -notin $stopwords -and $word -notmatch '^\d+$') {
                $candidates.Add($word)
            }
        }
        return @($candidates | Select-Object -Unique | Select-Object -First 8)
    }

    # Returns the package's version when the id exists exactly, '' otherwise
    function Get-ChocoVersion {
        param([string]$Id)
        try {
            foreach ($line in (& choco search $Id --exact --limit-output 2>$null)) {
                $parts = $line -split '\|'
                if ($parts[0] -ieq $Id) { return $(if ($parts.Count -gt 1) { $parts[1] } else { 'unknown' }) }
            }
        }
        catch { }
        return ''
    }

    function Test-ChocoId {
        param([string]$Id)
        return [bool](Get-ChocoVersion $Id)
    }

    # Every winget call is pinned to --source winget. Without it the Microsoft Store answers
    # too, and its ids (XPFNZKSKLBP7RJ) are not packages this tool can meaningfully install -
    # a search for "putty" happily returns a Store listing that is not PuTTY.
    #
    # winget show prints "Version: x", "Moniker: y" - the fields we surface in the details pane
    function Get-WingetInfo {
        param([string]$Id)
        try {
            $lines = @(& winget show --id $Id --exact --source winget --accept-source-agreements 2>$null)
            if ($LASTEXITCODE -ne 0) { return $null }
            $info = @{ Version = ''; Moniker = ''; Publisher = '' }
            foreach ($line in $lines) {
                if ($line -match '^\s*Version:\s*(.+)$'   -and -not $info.Version)   { $info.Version   = $Matches[1].Trim() }
                if ($line -match '^\s*Moniker:\s*(.+)$'   -and -not $info.Moniker)   { $info.Moniker   = $Matches[1].Trim() }
                if ($line -match '^\s*Publisher:\s*(.+)$' -and -not $info.Publisher) { $info.Publisher = $Matches[1].Trim() }
            }
            return $info
        }
        catch { }
        return $null
    }

    function Test-WingetId {
        param([string]$Id)
        return [bool](Get-WingetInfo $Id)
    }

    # winget prints fixed-width tables; column offsets are read from the header row
    function Read-WingetTable {
        param([string[]]$Lines)

        $rows = [System.Collections.Generic.List[hashtable]]::new()
        $header = $Lines | Where-Object { $_ -match '^Name\s+Id\s' } | Select-Object -First 1
        if (-not $header) { return $rows }

        $idStart = $header.IndexOf('Id')
        $versionStart = $header.IndexOf('Version')
        if ($idStart -lt 1 -or $versionStart -le $idStart) { return $rows }

        foreach ($line in $Lines) {
            if ($line.Length -le $idStart -or $line -match '^[-\s]+$' -or $line -eq $header) { continue }
            $name = $line.Substring(0, $idStart).Trim()
            $idEnd = [Math]::Min($versionStart, $line.Length)
            $id = $line.Substring($idStart, $idEnd - $idStart).Trim()
            $version = if ($line.Length -gt $versionStart) { $line.Substring($versionStart).Trim() } else { '' }
            if ($version -match '^(\S+)') { $version = $Matches[1] }
            # Apps winget knows only from Add/Remove Programs get a synthetic ARP\... id
            if (-not $name -or -not $id -or $id -like 'ARP\*' -or $id -like 'MSIX\*') { continue }
            $rows.Add(@{ Name = $name; Id = $id; Version = $version })
        }
        return $rows
    }

    # `winget list --source winget` reports installed apps together with their winget id - the
    # display-name -> id mapping we need, straight from the machine, with no guessing at all.
    function Get-WingetInstalledMap {
        $map = @{}
        try {
            $lines = @(& winget list --source winget --accept-source-agreements 2>$null)
            foreach ($row in (Read-WingetTable $lines)) {
                if (-not $map.ContainsKey($row.Name)) { $map[$row.Name] = $row }
            }
        }
        catch { }
        return $map
    }

    function Find-WingetId {
        param([string]$Query)
        try {
            $lines = @(& winget search $Query --source winget --accept-source-agreements 2>$null)
            return Read-WingetTable $lines
        }
        catch { }
        return @()
    }

    # The same app in the other repository, but only when the match is unambiguous: a guessed
    # id that turns out to exist, or a winget entry whose moniker/name normalises to the id.
    function Get-AlternateSource {
        param([string]$Source, [string]$Id, [string]$Moniker)

        if ($Source -eq 'chocolatey') {
            $needle = Get-Normalized $Id
            foreach ($row in (Find-WingetId $Id)) {
                $idTail = ($row.Id -split '\.')[-1]
                if ((Get-Normalized $row.Name) -eq $needle -or (Get-Normalized $idTail) -eq $needle) {
                    return @{ Source = 'winget'; Id = $row.Id }
                }
            }
        }
        elseif ($Source -eq 'winget') {
            $names = @($Moniker, ($Id -split '\.')[-1], ($Id -replace '\.', ' '))
            foreach ($name in ($names | Where-Object { $_ } | Select-Object -Unique)) {
                foreach ($candidate in (Get-CandidateIds $name)) {
                    if (Test-ChocoId $candidate) {
                        return @{ Source = 'chocolatey'; Id = $candidate }
                    }
                }
            }
        }
        return $null
    }

    switch ($Action) {
        'verify' {
            # Payload: the package id the user typed. Chocolatey first, then winget.
            $version = Get-ChocoVersion $Payload
            if ($version) {
                return [pscustomobject]@{ Found = $true; Source = 'chocolatey'; Version = $version }
            }
            $info = Get-WingetInfo $Payload
            if ($info) {
                return [pscustomobject]@{ Found = $true; Source = 'winget'; Version = $info.Version }
            }
            return [pscustomobject]@{ Found = $false; Source = ''; Version = '' }
        }

        'search' {
            # Payload: whatever the user typed. Never throws - a search that finds nothing
            # returns an empty list, which the caller turns into an offer to add a URL instead.
            $needle = Get-Normalized $Payload
            $results = [System.Collections.Generic.List[hashtable]]::new()

            # Guessed ids that really exist rank above anything a text search turns up
            foreach ($candidate in (Get-CandidateIds $Payload)) {
                $version = Get-ChocoVersion $candidate
                if ($version) {
                    $results.Add(@{ Id = $candidate; Source = 'chocolatey'; Version = $version; Rank = 0 })
                }
            }

            # Chocolatey returns matches alphabetically, not by relevance, so a small page cuts
            # off before the package you actually want ("chrom" never reaches googlechrome in
            # 30 rows). Take a big page and let the ranking below sort it out.
            try {
                foreach ($line in (& choco search $Payload --limit-output --page-size 100 2>$null)) {
                    $parts = $line -split '\|'
                    $id = $parts[0]
                    if (-not $id) { continue }
                    if ($results | Where-Object { $_.Id -ieq $id -and $_.Source -eq 'chocolatey' }) { continue }
                    $normalized = Get-Normalized $id
                    $rank = if ($normalized -eq $needle) { 0 }
                            elseif ($normalized.StartsWith($needle)) { 1 }
                            elseif ($normalized.Contains($needle)) { 2 }
                            else { 3 }
                    $results.Add(@{
                        Id      = $id
                        Source  = 'chocolatey'
                        Version = $(if ($parts.Count -gt 1) { $parts[1] } else { '' })
                        Rank    = $rank
                    })
                }
            }
            catch { }

            foreach ($row in (Find-WingetId $Payload)) {
                $normalized = Get-Normalized $row.Name
                $idTail = Get-Normalized (($row.Id -split '\.')[-1])
                $rank = if ($normalized -eq $needle -or $idTail -eq $needle) { 0 }
                        elseif ($normalized.StartsWith($needle) -or $idTail.StartsWith($needle)) { 1 }
                        elseif ($normalized.Contains($needle)) { 2 }
                        else { 3 }
                $results.Add(@{ Id = $row.Id; Source = 'winget'; Version = $row.Version; Rank = $rank; Title = $row.Name })
            }

            # A loose hit is still worth showing - it is the whole point of searching after a
            # failed add - so nothing is thrown away. Closest to what was typed comes first.
            foreach ($result in $results) {
                $result.Distance = Get-EditDistance $needle (Get-Normalized $result.Id)
            }
            return @($results | Sort-Object Rank, Distance | Select-Object -First 15)
        }

        'meta' {
            # Payload: @(@{ Source; Id }, ...) - the latest version, moniker and the other
            # repository that also carries each package.
            $results = [System.Collections.Generic.List[hashtable]]::new()
            $index = 0
            foreach ($item in $Payload) {
                $index++
                $Queue.Enqueue("Looking up $index/$($Payload.Count): $($item.Id)")

                $version = ''
                $moniker = ''
                if ($item.Source -eq 'chocolatey') {
                    $version = Get-ChocoVersion $item.Id
                }
                elseif ($item.Source -eq 'winget') {
                    $info = Get-WingetInfo $item.Id
                    if ($info) {
                        $version = $info.Version
                        $moniker = $info.Moniker
                    }
                }

                $alt = $null
                if ($item.Source -ne 'url') {
                    $alt = Get-AlternateSource -Source $item.Source -Id $item.Id -Moniker $moniker
                }

                $results.Add(@{
                    Id        = $item.Id
                    Source    = $item.Source
                    Version   = $version
                    Moniker   = $moniker
                    AltSource = $(if ($alt) { $alt.Source } else { '' })
                    AltId     = $(if ($alt) { $alt.Id } else { '' })
                })
            }
            return @($results)
        }

        'versions' {
            # Payload: @{ Source; Id } - every version the repository offers, newest first
            $versions = [System.Collections.Generic.List[string]]::new()
            try {
                if ($Payload.Source -eq 'chocolatey') {
                    foreach ($line in (& choco search $Payload.Id --exact --all-versions --limit-output 2>$null)) {
                        $parts = $line -split '\|'
                        if ($parts[0] -ieq $Payload.Id -and $parts.Count -gt 1) { $versions.Add($parts[1]) }
                    }
                }
                elseif ($Payload.Source -eq 'winget') {
                    $seen = $false
                    foreach ($line in (& winget show --id $Payload.Id --exact --versions --accept-source-agreements 2>$null)) {
                        if ($line -match '^[-\s]+$') { $seen = $true; continue }
                        if ($seen -and $line.Trim()) { $versions.Add($line.Trim()) }
                    }
                }
            }
            catch { }
            return @($versions)
        }

        'resolve' {
            # Payload: display names of installed programs needing a package id. Chocolatey is
            # tried first (it is what this tool installs by default); anything it does not have
            # falls back to winget, which knows the id of the very app that is installed.
            # Results stream back one at a time so the dialog can fill in as they arrive.
            $wingetMap = Get-WingetInstalledMap

            $index = 0
            foreach ($name in $Payload) {
                $index++
                $Queue.Enqueue("PROGRESS`t$index`t$($Payload.Count)`t$name")

                $match = ''
                $source = ''
                $version = ''
                foreach ($candidate in (Get-CandidateIds $name)) {
                    $found = Get-ChocoVersion $candidate
                    if ($found) {
                        $match = $candidate
                        $source = 'chocolatey'
                        $version = $found
                        break
                    }
                }

                if (-not $match -and $wingetMap.ContainsKey($name)) {
                    $match = $wingetMap[$name].Id
                    $source = 'winget'
                    $version = $wingetMap[$name].Version
                }

                $Queue.Enqueue("RESULT`t$name`t$match`t$source`t$version")
            }
            return @()
        }

        'scan' {
            $items = [System.Collections.Generic.List[hashtable]]::new()
            $seen = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)

            # Neither list is a list of applications. Both carry Windows servicing entries
            # (KB2919355 and friends - Chocolatey installs those as dependencies too), driver
            # bundles, and Chocolatey's own bookkeeping packages. None belong in packages.txt,
            # so they are filtered out of both sources.
            $noiseNames = '(?i)^(KB\d+|Update for |Security Update for |Hotfix for |Definition Update|Service Pack|Windows (Software Development Kit|Driver|SDK))'
            $noiseReleaseTypes = @('Security Update', 'Update', 'Hotfix', 'ServicePack')
            $chocoInternals = '(?i)^(chocolatey(\..+|-.+)?|KB\d+)$'

            try {
                foreach ($line in (& choco list --limit-output 2>$null)) {
                    $parts = $line -split '\|'
                    $id = $parts[0]
                    if (-not $id) { continue }
                    if ($id -match $chocoInternals -or $id -match $noiseNames) { continue }
                    if ($seen.Add($id)) {
                        $items.Add(@{
                            Display = $id
                            Id      = $id
                            Source  = 'chocolatey'
                            Version = $(if ($parts.Count -gt 1) { $parts[1] } else { '' })
                        })
                    }
                }
            }
            catch { }

            $uninstallKeys = @(
                'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*',
                'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*',
                'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*'
            )
            foreach ($key in $uninstallKeys) {
                foreach ($entry in (Get-ItemProperty $key -ErrorAction SilentlyContinue)) {
                    if (-not $entry.DisplayName -or -not $entry.UninstallString) { continue }
                    if ($entry.SystemComponent -eq 1) { continue }
                    if ($entry.ParentKeyName -or $entry.ParentDisplayName) { continue }
                    if ($entry.ReleaseType -and $entry.ReleaseType -in $noiseReleaseTypes) { continue }

                    $name = $entry.DisplayName.Trim()
                    if ($name -match $noiseNames) { continue }
                    if ($name -match '\(KB\d{6,}\)') { continue }

                    if ($seen.Add($name)) {
                        $items.Add(@{ Display = $name; Id = ''; Source = ''; Version = [string]$entry.DisplayVersion })
                    }
                }
            }

            return @($items | Sort-Object { $_.Display })
        }
    }
}

# Installs Chocolatey using the engine's own Install-Chocolatey, streaming its log lines into
# the log pane.
$Script:InstallChocoWork = {
    param($EnginePath, $Queue)
    try {
        . $EnginePath -LoadOnly
        $Script:LogSink = {
            param($Entry, $Level)
            $Queue.Enqueue("$Level|$Entry")
        }.GetNewClosure()
        $installed = Install-Chocolatey
        return [pscustomobject]@{ Installed = [bool]$installed }
    }
    catch {
        $Queue.Enqueue("Error|Failed to install Chocolatey: $_")
        return [pscustomobject]@{ Installed = $false }
    }
}

function Install-ChocolateyFromGui {
    param([scriptblock]$OnSuccess)

    if ($Script:Running) { return }

    $confirm = [System.Windows.MessageBox]::Show($Script:Window,
        "Install Chocolatey on this PC?`n`nThe official install script is downloaded from community.chocolatey.org and run. This can take a few minutes.",
        'Software Manager', 'YesNo', 'Question')
    if ($confirm -ne 'Yes') { return }

    $Script:Running = $true
    foreach ($name in $Script:RunControls) { $Script:Ui[$name].IsEnabled = $false }
    $Script:Ui.Progress.IsIndeterminate = $true
    $Script:Ui.ProgressText.Text = 'Installing Chocolatey...'
    Set-Status 'Installing Chocolatey - this can take a few minutes...'
    Add-LogLine '=== Installing Chocolatey ===' 'Detail'

    # Plain scriptblocks, not closures - see the note in Add-Package
    $Script:ChocoCtx = @{ OnSuccess = $OnSuccess }

    $null = Start-BackgroundJob -Work $Script:InstallChocoWork -Arguments @($Script:EnginePath) -OnProgress {
        param($Update)
        $parts = $Update -split '\|', 2
        Add-LogLine $parts[1] $parts[0]
    } -OnComplete {
        param($Output)

        $Script:Running = $false
        foreach ($name in $Script:RunControls) { $Script:Ui[$name].IsEnabled = $true }
        $Script:Ui.Progress.IsIndeterminate = $false
        $Script:Ui.Progress.Value = 0
        $Script:Ui.ProgressText.Text = ''

        # The install added Chocolatey to the machine PATH; pick it up in this process too
        Update-ProcessPath
        $Script:ChocoAvailable = Test-ChocoInstalled

        if ($Script:ChocoAvailable) {
            $Script:Ui.ChocoBanner.Visibility = 'Collapsed'
            Add-LogLine 'Chocolatey is ready - package ids can now be verified.' 'Info'
            Set-Status 'Chocolatey installed' '#1F7A3D'
            $resume = $Script:ChocoCtx.OnSuccess
            if ($resume) { & $resume }
        }
        else {
            Set-Status 'Chocolatey installation failed - see install-log.txt' '#C0392B'
            Add-LogLine 'Chocolatey installation failed. Install it manually from https://chocolatey.org/install' 'Error'
        }
    }
}

# Asks to install Chocolatey when an action needs it. Returns $true if it is already there.
function Confirm-ChocoNeeded {
    param([string]$Because, [scriptblock]$Retry)

    if ($Script:ChocoAvailable) { return $true }

    $answer = [System.Windows.MessageBox]::Show($Script:Window,
        "$Because`n`nChocolatey is not installed on this PC. Install it now?",
        'Software Manager', 'YesNo', 'Question')
    if ($answer -eq 'Yes') {
        Install-ChocolateyFromGui -OnSuccess $Retry
    }
    return $false
}

# --- Adding packages ---

function Test-DuplicatePackage {
    param([string]$Name)
    return [bool]($Script:Rows | Where-Object { $_.Name -ieq $Name })
}

function Add-PackageRow {
    param(
        [string]$Name,
        [ValidateSet('chocolatey', 'winget', 'url')]
        [string]$Source = 'chocolatey',
        [string]$Version = '',
        [string]$Latest = ''
    )

    $row = New-PackageRow -Name $Name -Source $Source -Version $Version
    # A package whose config paths are known is worth backing up by default
    $row.Config = $row.HasMapping
    if ($Latest) { $row.Latest = $Latest }
    $row.Sync()
    $Script:Rows.Add($row)
    $Script:Ui.PkgList.ScrollIntoView($row)
    return $row
}

# Turns a Windows display name into a package id: "balenaEtcher 1.19 (x64)" -> "balenaetcher"
function ConvertTo-PackageId {
    param([string]$Display)
    return (($Display -replace '\(.*?\)', ' ' -replace '\d+(\.\d+)+', ' ' -replace '\+\+', 'plusplus') -replace '[^A-Za-z0-9]', '').ToLower()
}

# A program neither repository carries becomes a custom-installer row with no link yet, so the
# user can add its URL from the list instead of being interrupted by a dialog. The Windows
# display name is kept in Title so the URL editor can pre-fill it. Returns the row, or $null
# when the derived id collides with a package already on the list.
function Add-UrlPlaceholderRow {
    param([string]$Display)

    $name = ConvertTo-PackageId $Display
    if (-not $name) { $name = 'app' }
    if (Test-DuplicatePackage $name) {
        Add-LogLine "'$Display' resolves to id '$name', which is already in the list" 'Detail'
        return $null
    }

    $row = New-PackageRow -Name $name -Source 'url'
    $row.Title = $Display
    $row.Config = $false
    $row.Sync()
    $Script:Rows.Add($row)
    $Script:Ui.PkgList.ScrollIntoView($row)
    Add-LogLine "Added '$Display' as a custom installer ($name) - it needs a download URL" 'Info'
    return $row
}

function Add-Package {
    if (-not $Script:Ui.AddBtn.IsEnabled) { return }

    $name = $Script:Ui.AddBox.Text.Trim().TrimStart('+')
    if ($name -eq '') { return }

    if (Test-DuplicatePackage $name) {
        Set-Status "'$name' is already in the list" '#8A6100'
        return
    }

    # An app installed from a custom URL is in neither repository - nothing to verify
    if (Get-MappingValue $name 'InstallUrl') {
        $null = Add-PackageRow -Name $name -Source 'url'
        $Script:Ui.AddBox.Clear()
        Add-LogLine "Added $name (installs from the custom URL in its config mapping)" 'Info'
        Set-Dirty
        return
    }

    if (-not (Confirm-ChocoNeeded -Because "'$name' cannot be looked up without Chocolatey." -Retry { Add-Package })) {
        return
    }

    $Script:Ui.AddBtn.IsEnabled = $false
    $Script:Ui.AddBtn.Content = 'Checking...'
    Set-Status "Looking up '$name'..."

    # Anything that is not a bare id cannot be a package id, so go straight to a search
    if ($name -notmatch '^[A-Za-z0-9._+-]+$') {
        Find-Package -Term $name
        return
    }

    # The callback must NOT be a GetNewClosure scriptblock: a closure runs in its own module
    # scope, where every $Script: variable reads back as $null - touching $Script:Ui there
    # throws, and an exception on the UI thread takes the whole window down. Locals it needs
    # travel through script scope instead.
    $Script:AddCtx = @{ Name = $name }

    $null = Start-BackgroundJob -Work $Script:PkgWork -Arguments @('verify', $name) -OnComplete {
        param($Output)

        $name = $Script:AddCtx.Name
        $result = @($Output) | Where-Object { $_ -and $_.PSObject.Properties['Found'] } | Select-Object -Last 1

        if ($result -and $result.Found) {
            $Script:Ui.AddBtn.IsEnabled = $true
            $Script:Ui.AddBtn.Content = 'Add package'
            $null = Add-PackageRow -Name $name -Source $result.Source -Latest $result.Version
            $Script:Ui.AddBox.Clear()
            $where = if ($result.Source -eq 'winget') { 'winget' } else { 'the Chocolatey repository' }
            Add-LogLine "Added $name $($result.Version) (found in $where)" 'Info'
            Set-Dirty
            return
        }

        # No package with that exact id - show what the user probably meant instead of failing
        Set-Status "No package called '$name' - searching..."
        Find-Package -Term $name
    }
}

# Searches both repositories and shows what came back. An empty result is not an error: it is
# an offer to install the app from an MSI/EXE URL instead.
function Find-Package {
    param([string]$Term)

    $Script:Ui.AddBtn.IsEnabled = $false
    $Script:Ui.AddBtn.Content = 'Searching...'
    $Script:FindCtx = @{ Term = $Term }

    $null = Start-BackgroundJob -Work $Script:PkgWork -Arguments @('search', $Term) -OnComplete {
        param($Output)

        $term = $Script:FindCtx.Term
        $Script:Ui.AddBtn.IsEnabled = $true
        $Script:Ui.AddBtn.Content = 'Add package'

        $found = @($Output | Where-Object { $_ -is [hashtable] })
        if ($found.Count -eq 0) {
            # Neither repository matches on anything but whole tokens, so a mistyped id finds
            # nothing at all - there is no candidate list to suggest from. Offer the way out.
            Add-LogLine "Nothing in Chocolatey or winget matches '$term'." 'Warning'
            Set-Status "No package matches '$term'" '#8A6100'
            $answer = [System.Windows.MessageBox]::Show($Script:Window,
                "Neither Chocolatey nor winget has anything matching '$term'.`n`nCheck the spelling and try again, or add the app as a custom installer - you will need a link to its .exe or .msi.`n`nAdd it as a custom installer now?",
                'Software Manager', 'YesNo', 'Question')
            if ($answer -eq 'Yes') { Show-UrlDialog -Title $term }
            return
        }

        Add-LogLine "$($found.Count) match(es) for '$term'" 'Detail'
        Set-Status "$($found.Count) match(es) for '$term'"
        Show-SearchDialog -Term $term -Results $found
    }
}

class SearchRow {
    [string]$Id
    [string]$Source
    [string]$Version
    [string]$Title
    [string]$Summary
}

function Show-SearchDialog {
    param([string]$Term, $Results)

    $dialogXaml = @"
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Search results" Width="560" Height="520"
        WindowStartupLocation="CenterOwner" ShowInTaskbar="False"
        Background="#F2F4F7" FontFamily="Segoe UI" FontSize="13"
        TextOptions.TextFormattingMode="Display" UseLayoutRounding="True">
  <Window.Resources>
$sharedResources
  </Window.Resources>
  <Grid Margin="20">
    <Grid.RowDefinitions>
      <RowDefinition Height="Auto"/>
      <RowDefinition Height="*"/>
      <RowDefinition Height="Auto"/>
    </Grid.RowDefinitions>

    <StackPanel Grid.Row="0" Margin="0,0,0,12">
      <TextBlock x:Name="Heading" FontSize="17" FontWeight="SemiBold"/>
      <TextBlock Text="Pick the package you meant. Nothing here? Add the app from an MSI/EXE link instead."
                 Foreground="{StaticResource Muted}" TextWrapping="Wrap" Margin="0,3,0,0"/>
    </StackPanel>

    <Border Grid.Row="1" Background="{StaticResource Card}" CornerRadius="8"
            BorderBrush="{StaticResource Border}" BorderThickness="1">
      <ListBox x:Name="Results" Background="Transparent" BorderThickness="0" Padding="6"
               ScrollViewer.HorizontalScrollBarVisibility="Disabled" HorizontalContentAlignment="Stretch">
        <ListBox.ItemContainerStyle>
          <Style TargetType="ListBoxItem">
            <Setter Property="HorizontalContentAlignment" Value="Stretch"/>
            <Setter Property="Template">
              <Setter.Value>
                <ControlTemplate TargetType="ListBoxItem">
                  <Border x:Name="bd" Background="Transparent" CornerRadius="6" Padding="9,7">
                    <ContentPresenter/>
                  </Border>
                  <ControlTemplate.Triggers>
                    <Trigger Property="IsMouseOver" Value="True">
                      <Setter TargetName="bd" Property="Background" Value="#EEF3FF"/>
                    </Trigger>
                    <Trigger Property="IsSelected" Value="True">
                      <Setter TargetName="bd" Property="Background" Value="#E7EEFF"/>
                    </Trigger>
                  </ControlTemplate.Triggers>
                </ControlTemplate>
              </Setter.Value>
            </Setter>
          </Style>
        </ListBox.ItemContainerStyle>
        <ListBox.ItemTemplate>
          <DataTemplate>
            <StackPanel>
              <TextBlock Text="{Binding Id}" FontSize="14"/>
              <TextBlock Text="{Binding Summary}" Foreground="{StaticResource Muted}" FontSize="11.5"
                         Margin="0,2,0,0"/>
            </StackPanel>
          </DataTemplate>
        </ListBox.ItemTemplate>
      </ListBox>
    </Border>

    <Grid Grid.Row="2" Margin="0,14,0,0">
      <Button x:Name="UrlInstead" Content="Add from URL instead..." Style="{StaticResource SecondaryButton}"
              HorizontalAlignment="Left"/>
      <StackPanel Orientation="Horizontal" HorizontalAlignment="Right">
        <Button x:Name="CancelBtn" Content="Cancel" Style="{StaticResource SecondaryButton}"/>
        <Button x:Name="AddBtn" Content="Add package" Style="{StaticResource PrimaryButton}" Margin="10,0,0,0"/>
      </StackPanel>
    </Grid>
  </Grid>
</Window>
"@

    $dialog = [System.Windows.Markup.XamlReader]::Parse($dialogXaml)
    $dialog.Owner = $Script:Window
    $dialog.FindName('Heading').Text = "Matches for `"$Term`""

    $rows = [System.Collections.ObjectModel.ObservableCollection[SearchRow]]::new()
    foreach ($match in $Results) {
        $row = [SearchRow]::new()
        $row.Id      = [string]$match.Id
        $row.Source  = [string]$match.Source
        $row.Version = [string]$match.Version
        $row.Title   = [string]$match.Title
        $where = if ($row.Source -eq 'winget') { 'winget' } else { 'Chocolatey' }
        $row.Summary = @($where, $row.Version, $row.Title | Where-Object { $_ }) -join '  |  '
        $rows.Add($row)
    }

    # The dialog's controls live in script scope so the handlers below can reach them
    $Script:Search = @{
        Dialog  = $dialog
        Results = $dialog.FindName('Results')
        AddBtn  = $dialog.FindName('AddBtn')
        Term    = $Term
    }
    $Script:Search.Results.ItemsSource = $rows
    $Script:Search.Results.SelectedIndex = 0

    $Script:Search.Results.Add_MouseDoubleClick({ Add-SearchSelection })
    $Script:Search.AddBtn.Add_Click({ Add-SearchSelection })
    $dialog.FindName('CancelBtn').Add_Click({ $Script:Search.Dialog.Close() })
    $dialog.FindName('UrlInstead').Add_Click({
        $term = $Script:Search.Term
        $Script:Search.Dialog.Close()
        Show-UrlDialog -Title $term
    })

    $null = $dialog.ShowDialog()
    $Script:Search = $null
}

function Add-SearchSelection {
    $selected = $Script:Search.Results.SelectedItem
    if (-not $selected) { return }

    if (Test-DuplicatePackage $selected.Id) {
        Set-Status "'$($selected.Id)' is already in the list" '#8A6100'
        $Script:Search.Dialog.Close()
        return
    }

    $Script:Search.Dialog.Close()
    $null = Add-PackageRow -Name $selected.Id -Source $selected.Source -Latest $selected.Version
    $Script:Ui.AddBox.Clear()
    Add-LogLine "Added $($selected.Id) $($selected.Version) from $($selected.Source)" 'Info'
    Set-Dirty
    Set-Status "Added $($selected.Id)" '#1F7A3D'
}

# --- Custom MSI/EXE installers ---

# An app neither repository carries: the user gives it a title and a link to its installer.
# The URL is stored as the package's InstallUrl in ConfigMappings.ps1, which the engine
# already knows how to install from; the packages.txt line gets the 'url:' prefix.
function Show-UrlDialog {
    param(
        [string]$Title = '',
        [string]$Name = '',
        [string]$Url = '',
        [PackageRow]$Row = $null      # set when editing an existing package
    )

    $dialogXaml = @"
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Install from URL" Width="560" SizeToContent="Height"
        WindowStartupLocation="CenterOwner" ShowInTaskbar="False" ResizeMode="NoResize"
        Background="#F2F4F7" FontFamily="Segoe UI" FontSize="13"
        TextOptions.TextFormattingMode="Display" UseLayoutRounding="True">
  <Window.Resources>
$sharedResources
  </Window.Resources>
  <StackPanel Margin="20">
    <TextBlock Text="Install from an MSI or EXE link" FontSize="17" FontWeight="SemiBold"/>
    <TextBlock Text="For apps Chocolatey and winget do not carry. The installer is downloaded and run silently; an .msi goes through msiexec."
               Foreground="{StaticResource Muted}" TextWrapping="Wrap" Margin="0,3,0,14"/>

    <TextBlock Text="App name" FontWeight="SemiBold"/>
    <TextBlock Text="Exactly as it appears in Windows' Apps &amp; features list - it is how Software Manager tells whether the app is already installed."
               Foreground="{StaticResource Muted}" FontSize="11.5" TextWrapping="Wrap" Margin="0,2,0,4"/>
    <TextBox x:Name="TitleBox"/>

    <TextBlock Text="Package id" FontWeight="SemiBold" Margin="0,12,0,0"/>
    <TextBlock Text="The short name used in packages.txt and ConfigMappings.ps1 - letters, digits, dot, dash."
               Foreground="{StaticResource Muted}" FontSize="11.5" TextWrapping="Wrap" Margin="0,2,0,4"/>
    <TextBox x:Name="NameBox"/>

    <TextBlock Text="Installer URL" FontWeight="SemiBold" Margin="0,12,0,0"/>
    <TextBlock Text="A direct link ending in .exe or .msi, used when no version is pinned. A link to a Chocolatey feed works too. Leave it blank to reuse the newest version installer below."
               Foreground="{StaticResource Muted}" FontSize="11.5" TextWrapping="Wrap" Margin="0,2,0,4"/>
    <TextBox x:Name="UrlBox"/>

    <TextBlock Text="Version installers (optional)" FontWeight="SemiBold" Margin="0,12,0,0"/>
    <TextBlock Text="No repository lists this app's versions, so pinning one means naming its installer. One per line, newest first: 1.19.0 = https://example.com/app-1.19.0.exe"
               Foreground="{StaticResource Muted}" FontSize="11.5" TextWrapping="Wrap" Margin="0,2,0,4"/>
    <TextBox x:Name="VersionsBox" Style="{StaticResource MultiLineBox}" Height="80"/>

    <CheckBox x:Name="ConfigBox" Content="Back up and restore this app's config" Margin="0,14,0,0"/>

    <TextBlock x:Name="ErrorText" Foreground="#C0392B" TextWrapping="Wrap" Margin="0,10,0,0"
               Visibility="Collapsed"/>

    <StackPanel Orientation="Horizontal" HorizontalAlignment="Right" Margin="0,18,0,0">
      <Button x:Name="CancelBtn" Content="Cancel" Style="{StaticResource SecondaryButton}"/>
      <Button x:Name="SaveBtn" Content="Save" Style="{StaticResource PrimaryButton}" Margin="10,0,0,0"/>
    </StackPanel>
  </StackPanel>
</Window>
"@

    $dialog = [System.Windows.Markup.XamlReader]::Parse($dialogXaml)
    $dialog.Owner = $Script:Window

    # Suggest a package id from the title: "balenaEtcher 1.19" -> "balenaetcher"
    if (-not $Name -and $Title) {
        $Name = (($Title -replace '\(.*?\)', ' ' -replace '\d+(\.\d+)+', ' ' -replace '\+\+', 'plusplus') -replace '[^A-Za-z0-9]', '').ToLower()
    }

    $Script:Url = @{
        Dialog      = $dialog
        TitleBox    = $dialog.FindName('TitleBox')
        NameBox     = $dialog.FindName('NameBox')
        UrlBox      = $dialog.FindName('UrlBox')
        VersionsBox = $dialog.FindName('VersionsBox')
        ConfigBox   = $dialog.FindName('ConfigBox')
        ErrorText   = $dialog.FindName('ErrorText')
        Row         = $Row
    }
    $Script:Url.TitleBox.Text = $Title
    $Script:Url.NameBox.Text  = $Name
    $Script:Url.UrlBox.Text   = $Url

    $existingUrls = if ($Name) { Get-MappingUrls $Name } else { [ordered]@{} }
    $Script:Url.VersionsBox.Text = (@($existingUrls.Keys | ForEach-Object { "$_ = $($existingUrls[$_])" })) -join "`r`n"

    if ($Row) {
        $Script:Url.ConfigBox.IsChecked = $Row.Config
        $Script:Url.NameBox.IsEnabled = $false     # renaming would orphan its mapping
    }

    $dialog.FindName('CancelBtn').Add_Click({ $Script:Url.Dialog.Close() })
    $dialog.FindName('SaveBtn').Add_Click({ Save-UrlPackage })

    $null = $dialog.ShowDialog()
    $Script:Url = $null
}

function Save-UrlPackage {
    $dlg = $Script:Url
    $title = $dlg.TitleBox.Text.Trim()
    $name  = $dlg.NameBox.Text.Trim()
    $url   = $dlg.UrlBox.Text.Trim()

    function Show-UrlError {
        param([string]$Message)
        $Script:Url.ErrorText.Text = $Message
        $Script:Url.ErrorText.Visibility = 'Visible'
    }

    if (-not $title) { Show-UrlError 'Give the app a name.'; return }
    if ($name -notmatch '^[A-Za-z0-9._-]+$') { Show-UrlError 'The package id may only contain letters, digits, dot, dash and underscore.'; return }
    if (-not $dlg.Row -and (Test-DuplicatePackage $name)) { Show-UrlError "'$name' is already in the list."; return }

    # One installer per version: "1.19.0 = https://example.com/app-1.19.0.exe". Order is kept,
    # so the version picker lists them exactly as they are written here.
    $versionUrls = [ordered]@{}
    foreach ($line in ($dlg.VersionsBox.Text -split "`r?`n")) {
        $entry = $line.Trim()
        if (-not $entry) { continue }
        if ($entry -notmatch '^(.+?)\s*=\s*(\S+)$') {
            Show-UrlError "Each version line must read '<version> = <url>'. Fix: $entry"
            return
        }
        $version = $Matches[1].Trim()
        $link    = $Matches[2].Trim()
        if ($link -notmatch '^(?i)https?://') {
            Show-UrlError "The installer URL for $version must start with http:// or https://"
            return
        }
        if ($versionUrls.Contains($version)) {
            Show-UrlError "Version $version is listed twice."
            return
        }
        $versionUrls[$version] = $link
    }

    # The plain URL is what installs when no version is pinned. When it is left blank but the
    # version list has entries, the newest (first) one stands in for it - the user should not
    # have to type the latest installer twice.
    if (-not $url -and $versionUrls.Count -gt 0) {
        $url = [string]$versionUrls[@($versionUrls.Keys)[0]]
    }

    if (-not $url) {
        Show-UrlError 'Give an installer URL, or at least one version installer to take the latest from.'
        return
    }
    if ($url -notmatch '^(?i)https?://') { Show-UrlError 'The installer URL must start with http:// or https://'; return }

    if ($url -notmatch '(?i)\.(exe|msi)(\?|#|$)') {
        $answer = [System.Windows.MessageBox]::Show($dlg.Dialog,
            "That link does not end in .exe or .msi.`n`nSoftware Manager will treat it as a Chocolatey source feed. Save anyway?",
            'Software Manager', 'YesNo', 'Question')
        if ($answer -ne 'Yes') { return }
    }

    # Keep whatever config paths the package already has - only the install details change
    $existing = Get-Mapping $name
    try {
        Set-ConfigMapping -Name $name `
            -Folders  @(if ($existing) { $existing['Folders'] }) `
            -Files    @(if ($existing) { $existing['Files'] }) `
            -Registry @(if ($existing) { $existing['Registry'] }) `
            -InstallUrl $url -DisplayName $title -InstallUrls $versionUrls
    }
    catch {
        Show-UrlError "Could not write ConfigMappings.ps1: $_"
        return
    }

    if ($dlg.Row) {
        $dlg.Row.Source = 'url'
        $dlg.Row.Config = [bool]$dlg.ConfigBox.IsChecked
        # A pin to a version that no longer has an installer would silently fall back to the
        # plain InstallUrl, so drop it
        if ($dlg.Row.Version -and -not $versionUrls.Contains($dlg.Row.Version)) {
            Add-LogLine "$name is no longer pinned to $($dlg.Row.Version) - that version has no installer URL." 'Warning'
            $dlg.Row.Version = ''
        }
        Update-RowMapping $dlg.Row
        $dlg.Row.Sync()
        Add-LogLine "Updated the custom installer for $name" 'Info'
    }
    else {
        $row = Add-PackageRow -Name $name -Source 'url'
        $row.Config = [bool]$dlg.ConfigBox.IsChecked
        $row.Sync()
        Add-LogLine "Added $name as a custom installer ($title)" 'Info'
        $Script:Ui.AddBox.Clear()
    }

    $dlg.Dialog.Close()
    Update-PackageList
    Set-Dirty
}

# --- Details for the selected package ---

function Show-PackageDetail {
    $row = $Script:Ui.PkgList.SelectedItem
    if (-not $row) {
        $Script:Ui.DetailPane.Visibility = 'Collapsed'
        return
    }

    $Script:Ui.DetailPane.Visibility = 'Visible'
    $Script:Ui.DetailTitle.Text = $row.Name

    $meta = [System.Collections.Generic.List[string]]::new()
    $meta.Add("Installed with $($row.SourceLabel)")
    if ($row.Version) { $meta.Add("pinned to $($row.Version)") }
    elseif ($row.Latest) { $meta.Add("latest $($row.Latest)") }
    else { $meta.Add('version not looked up yet') }
    if ($row.Moniker) { $meta.Add("moniker $($row.Moniker)") }
    if ($row.AltId) { $meta.Add("also on $($row.AltSource) as $($row.AltId)") }
    $url = Get-MappingValue $row.Name 'InstallUrl'
    if ($url) { $meta.Add("from $url") }
    $Script:Ui.DetailMeta.Text = $meta -join '  |  '

    $mapping = Get-Mapping $row.Name
    if (-not $mapping) {
        $Script:Ui.DetailConfig.Text = 'No entry in ConfigMappings.ps1 - nothing will be backed up. Use "Edit config" to say where this app keeps its settings.'
        return
    }

    $parts = [System.Collections.Generic.List[string]]::new()
    foreach ($key in 'Folders', 'Files', 'Registry') {
        $count = @($mapping[$key]).Where({ $_ }).Count
        if ($count -gt 0) { $parts.Add("$count $($key.ToLower())") }
    }
    $Script:Ui.DetailConfig.Text = if ($parts.Count -gt 0) {
        "Config: $($parts -join ', ')"
    }
    else {
        'Config: no paths defined yet - nothing will be backed up.'
    }
}

# --- Row actions ---

# A context menu built in code, so its items can call this script's functions directly. Each
# item carries its action and its row in Tag; a shared handler dispatches on that. (A
# GetNewClosure() handler would run in its own module scope and could not resolve these
# functions at all.)
$Script:MenuHandler = {
    param($Sender, $EventArgs)
    Invoke-RowAction -Action $Sender.Tag.Action -Row $Sender.Tag.Row
}

function New-MenuItem {
    param([string]$Header, [string]$Action, [PackageRow]$Row, [bool]$Enabled = $true)

    $item = [System.Windows.Controls.MenuItem]::new()
    $item.Header = $Header
    $item.Tag = @{ Action = $Action; Row = $Row }
    $item.IsEnabled = $Enabled
    $item.Add_Click($Script:MenuHandler)
    return $item
}

function Show-RowMenu {
    param($Target, [PackageRow]$Row)

    $menu = [System.Windows.Controls.ContextMenu]::new()
    $null = $menu.Items.Add((New-MenuItem -Header 'More info' -Action 'info' -Row $Row))
    $null = $menu.Items.Add((New-MenuItem -Header 'Edit config...' -Action 'config' -Row $Row))
    $null = $menu.Items.Add((New-MenuItem -Header 'Open ConfigMappings.ps1' -Action 'open-mappings' -Row $Row))
    $null = $menu.Items.Add([System.Windows.Controls.Separator]::new())
    $null = $menu.Items.Add((New-MenuItem -Header 'Change source...' -Action 'source' -Row $Row))
    $null = $menu.Items.Add((New-MenuItem -Header 'Set version...' -Action 'version' -Row $Row))
    if ($Row.Source -eq 'url') {
        $null = $menu.Items.Add((New-MenuItem -Header 'Edit installer URL...' -Action 'url' -Row $Row))
    }
    $null = $menu.Items.Add([System.Windows.Controls.Separator]::new())
    $null = $menu.Items.Add((New-MenuItem -Header 'Remove from list' -Action 'remove' -Row $Row))

    $menu.PlacementTarget = $Target
    $menu.Placement = 'Bottom'
    $menu.IsOpen = $true
}

function Show-SourceMenu {
    param($Target, [PackageRow]$Row)

    $menu = [System.Windows.Controls.ContextMenu]::new()

    foreach ($source in 'chocolatey', 'winget') {
        if ($Row.Source -eq $source) {
            $item = New-MenuItem -Header "$source (current)" -Action 'noop' -Row $Row -Enabled $false
            $null = $menu.Items.Add($item)
            continue
        }
        # Only offer a source we know actually carries this app, under a known id
        if ($Row.AltSource -eq $source -and $Row.AltId) {
            $null = $menu.Items.Add((New-MenuItem -Header "$source ($($Row.AltId))" -Action "switch-$source" -Row $Row))
        }
        else {
            $null = $menu.Items.Add((New-MenuItem -Header "$source - look up..." -Action 'lookup-alt' -Row $Row))
        }
    }

    $null = $menu.Items.Add([System.Windows.Controls.Separator]::new())
    if ($Row.Source -eq 'url') {
        $null = $menu.Items.Add((New-MenuItem -Header 'custom URL (current)' -Action 'noop' -Row $Row -Enabled $false))
    }
    else {
        $null = $menu.Items.Add((New-MenuItem -Header 'custom URL...' -Action 'url' -Row $Row))
    }

    $menu.PlacementTarget = $Target
    $menu.Placement = 'Bottom'
    $menu.IsOpen = $true
}

function Invoke-RowAction {
    param([string]$Action, [PackageRow]$Row)

    switch ($Action) {
        'noop' { }
        'info' {
            $Script:Ui.PkgList.SelectedItem = $Row
            Show-PackageDetail
        }
        'config' { Show-ConfigDialog -Row $Row }
        'open-mappings' {
            try { Start-Process $Script:MappingsFile }
            catch { Add-LogLine "Could not open ConfigMappings.ps1: $_" 'Warning' }
        }
        'source'  { Show-SourceMenu -Target $Script:Ui.DetailActionsBtn -Row $Row }
        'version' { Show-VersionDialog -Row $Row }
        'url' {
            # A placeholder row has no mapping yet, so fall back to the Windows name kept in Title
            $title = Get-MappingValue $Row.Name 'DisplayName'
            if (-not $title) { $title = $Row.Title }
            Show-UrlDialog -Name $Row.Name -Title $title `
                -Url (Get-MappingValue $Row.Name 'InstallUrl') -Row $Row
        }
        'remove' {
            $null = $Script:Rows.Remove($Row)
            Show-PackageDetail
            Set-Dirty
        }
        'lookup-alt'        { Find-AlternateSource -Row $Row }
        'switch-chocolatey' { Switch-RowSource -Row $Row -Source 'chocolatey' -Id $Row.AltId }
        'switch-winget'     { Switch-RowSource -Row $Row -Source 'winget' -Id $Row.AltId }
    }
}

function Switch-RowSource {
    param([PackageRow]$Row, [string]$Source, [string]$Id)

    if (-not $Id) { return }
    if ($Id -ine $Row.Name -and (Test-DuplicatePackage $Id)) {
        Set-Status "'$Id' is already in the list" '#8A6100'
        return
    }

    # The two repositories name the same app differently, so switching source swaps the id too
    $oldName = $Row.Name
    $oldSource = $Row.Source
    $Row.AltSource = $oldSource
    $Row.AltId     = $oldName
    $Row.Name      = $Id
    $Row.Source    = $Source
    $Row.Version   = ''      # a version pin from the other repository means nothing here
    $Row.Latest    = ''
    $Row.Moniker   = ''
    Update-RowMapping $Row
    $Row.Sync()

    Update-PackageList
    Set-Dirty
    Add-LogLine "$oldName now installs from $Source as $Id" 'Info'
    Update-PackageMeta -Rows @($Row)
}

function Find-AlternateSource {
    param([PackageRow]$Row)

    Set-Status "Looking for $($Row.Name) in the other repository..."

    # This one *is* a closure - it needs $Row, and it only calls functions. That is safe: a
    # function invoked from a closure still runs in the script's own session state, so its
    # $Script: access works. Only $Script: touched *inline* in a closure body reads back null.
    Update-PackageMeta -Rows @($Row) -OnDone {
        if ($Row.AltId) {
            Set-Status "$($Row.Name) is also on $($Row.AltSource) as $($Row.AltId) - open the source menu again to switch" '#1F7A3D'
            Add-LogLine "$($Row.Name) is also available on $($Row.AltSource) as $($Row.AltId)" 'Info'
        }
        else {
            Set-Status "$($Row.Name) is only on $($Row.SourceLabel)" '#8A6100'
            Add-LogLine "No equivalent package for $($Row.Name) in the other repository." 'Warning'
        }
    }.GetNewClosure()
}

# Fills in latest version, moniker and the alternate source for rows that have never been
# looked up. Answers are cached in catalog.json, so this is a one-off cost per package.
function Update-PackageMeta {
    param($Rows, [scriptblock]$OnDone)

    $pending = @($Rows | Where-Object { $_.Source -ne 'url' -and -not $_.Resolving })
    if ($pending.Count -eq 0) {
        if ($OnDone) { & $OnDone }
        return
    }
    if (-not $Script:ChocoAvailable -and -not $Script:WingetAvailable) { return }

    $payload = @($pending | ForEach-Object { @{ Source = $_.Source; Id = $_.Name } })
    $Script:MetaCtx = @{ OnDone = $OnDone }

    $null = Start-BackgroundJob -Work $Script:PkgWork -Arguments @('meta', $payload) -OnComplete {
        param($Output)

        $changed = $false
        foreach ($result in @($Output | Where-Object { $_ -is [hashtable] })) {
            $row = $Script:Rows | Where-Object { $_.Name -ieq $result.Id -and $_.Source -eq $result.Source } | Select-Object -First 1
            if (-not $row) { continue }
            $row.Latest    = [string]$result.Version
            $row.Moniker   = [string]$result.Moniker
            $row.AltSource = [string]$result.AltSource
            $row.AltId     = [string]$result.AltId
            $row.Sync()
            $changed = $true

            Set-CatalogPackage -Source $result.Source -Id $result.Id -Version $result.Version `
                -Moniker $result.Moniker -AltSource $result.AltSource -AltId $result.AltId
        }

        if ($changed) {
            Export-Catalog
            Update-PackageList
        }
        $done = $Script:MetaCtx.OnDone
        if ($done) { & $done }
    }
}

# --- Version picker ---

class VersionRow {
    [string]$Version
    [string]$Label
}

function Show-VersionDialog {
    param([PackageRow]$Row)

    # A URL-installed app has no repository to ask, so its versions are the ones its mapping
    # names an installer for. Without any, there is nothing to pin to.
    $urlVersions = @()
    if ($Row.Source -eq 'url') {
        $urlVersions = @((Get-MappingUrls $Row.Name).Keys)
        if ($urlVersions.Count -eq 0) {
            $null = [System.Windows.MessageBox]::Show($Script:Window,
                "$($Row.Name) installs from a single fixed URL, so there is no version list to pick from.`n`nAdd one installer URL per version under `"Edit installer URL...`" and they will show up here.",
                'Software Manager', 'OK', 'Information')
            return
        }
    }

    $dialogXaml = @"
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Version" Width="420" Height="480"
        WindowStartupLocation="CenterOwner" ShowInTaskbar="False"
        Background="#F2F4F7" FontFamily="Segoe UI" FontSize="13"
        TextOptions.TextFormattingMode="Display" UseLayoutRounding="True">
  <Window.Resources>
$sharedResources
  </Window.Resources>
  <Grid Margin="20">
    <Grid.RowDefinitions>
      <RowDefinition Height="Auto"/>
      <RowDefinition Height="*"/>
      <RowDefinition Height="Auto"/>
    </Grid.RowDefinitions>

    <StackPanel Grid.Row="0" Margin="0,0,0,12">
      <TextBlock x:Name="Heading" FontSize="17" FontWeight="SemiBold"/>
      <TextBlock Text="Pick a version to pin, or keep installing whatever is latest."
                 Foreground="{StaticResource Muted}" TextWrapping="Wrap" Margin="0,3,0,0"/>
    </StackPanel>

    <Border Grid.Row="1" Background="{StaticResource Card}" CornerRadius="8"
            BorderBrush="{StaticResource Border}" BorderThickness="1">
      <Grid>
        <ListBox x:Name="Versions" Background="Transparent" BorderThickness="0" Padding="6"
                 HorizontalContentAlignment="Stretch">
          <ListBox.ItemContainerStyle>
            <Style TargetType="ListBoxItem">
              <Setter Property="HorizontalContentAlignment" Value="Stretch"/>
              <Setter Property="Template">
                <Setter.Value>
                  <ControlTemplate TargetType="ListBoxItem">
                    <Border x:Name="bd" Background="Transparent" CornerRadius="6" Padding="9,6">
                      <ContentPresenter/>
                    </Border>
                    <ControlTemplate.Triggers>
                      <Trigger Property="IsMouseOver" Value="True">
                        <Setter TargetName="bd" Property="Background" Value="#EEF3FF"/>
                      </Trigger>
                      <Trigger Property="IsSelected" Value="True">
                        <Setter TargetName="bd" Property="Background" Value="#E7EEFF"/>
                      </Trigger>
                    </ControlTemplate.Triggers>
                  </ControlTemplate>
                </Setter.Value>
              </Setter>
            </Style>
          </ListBox.ItemContainerStyle>
          <ListBox.ItemTemplate>
            <DataTemplate>
              <TextBlock Text="{Binding Label}"/>
            </DataTemplate>
          </ListBox.ItemTemplate>
        </ListBox>
        <TextBlock x:Name="LoadingText" Text="Loading versions..." Foreground="{StaticResource Muted}"
                   HorizontalAlignment="Center" VerticalAlignment="Center"/>
      </Grid>
    </Border>

    <StackPanel Grid.Row="2" Orientation="Horizontal" HorizontalAlignment="Right" Margin="0,14,0,0">
      <Button x:Name="CancelBtn" Content="Cancel" Style="{StaticResource SecondaryButton}"/>
      <Button x:Name="OkBtn" Content="Use this version" Style="{StaticResource PrimaryButton}"
              Margin="10,0,0,0" IsEnabled="False"/>
    </StackPanel>
  </Grid>
</Window>
"@

    $dialog = [System.Windows.Markup.XamlReader]::Parse($dialogXaml)
    $dialog.Owner = $Script:Window
    $dialog.FindName('Heading').Text = $Row.Name

    $Script:Ver = @{
        Dialog   = $dialog
        List     = $dialog.FindName('Versions')
        Loading  = $dialog.FindName('LoadingText')
        OkBtn    = $dialog.FindName('OkBtn')
        Rows     = [System.Collections.ObjectModel.ObservableCollection[VersionRow]]::new()
        Row      = $Row
    }
    $Script:Ver.List.ItemsSource = $Script:Ver.Rows

    $dialog.FindName('CancelBtn').Add_Click({ $Script:Ver.Dialog.Close() })
    $Script:Ver.OkBtn.Add_Click({ Set-RowVersion })
    $Script:Ver.List.Add_MouseDoubleClick({ Set-RowVersion })

    if ($Row.Source -eq 'url') {
        # Already known - the mapping is the version list, there is nothing to look up
        Set-VersionList -Versions $urlVersions
    }
    else {
        $null = Start-BackgroundJob -Work $Script:PkgWork -Arguments @('versions', @{ Source = $Row.Source; Id = $Row.Name }) -OnComplete {
            param($Output)

            if (-not $Script:Ver) { return }   # closed before the lookup finished
            Set-VersionList -Versions @($Output | Where-Object { $_ -is [string] -and $_ })
        }
    }

    $null = $dialog.ShowDialog()
    $Script:Ver = $null
}

function Set-VersionList {
    param([string[]]$Versions)

    $latest = [VersionRow]::new()
    $latest.Version = ''
    $latest.Label = 'Latest (no pin)'
    $Script:Ver.Rows.Add($latest)

    foreach ($version in $Versions) {
        $item = [VersionRow]::new()
        $item.Version = $version
        $item.Label = $version
        $Script:Ver.Rows.Add($item)
    }

    $Script:Ver.Loading.Visibility = 'Collapsed'
    $Script:Ver.OkBtn.IsEnabled = $true
    if ($Script:Ver.Rows.Count -eq 1) {
        $Script:Ver.Loading.Text = 'No version list available - only "latest" can be used.'
        $Script:Ver.Loading.Visibility = 'Visible'
    }

    $current = @($Script:Ver.Rows | Where-Object { $_.Version -eq $Script:Ver.Row.Version }) | Select-Object -First 1
    $Script:Ver.List.SelectedItem = if ($current) { $current } else { $latest }
}

function Set-RowVersion {
    $selected = $Script:Ver.List.SelectedItem
    if (-not $selected) { return }

    $row = $Script:Ver.Row
    $row.Version = $selected.Version
    $row.Sync()
    $Script:Ver.Dialog.Close()

    Update-PackageList
    Set-Dirty
    if ($row.Version) { Add-LogLine "$($row.Name) pinned to $($row.Version)" 'Info' }
    else { Add-LogLine "$($row.Name) will install the latest version" 'Info' }
}

# --- Config editor ---

function Show-ConfigDialog {
    param([PackageRow]$Row)

    $dialogXaml = @"
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Edit config" Width="720" Height="700"
        WindowStartupLocation="CenterOwner" ShowInTaskbar="False"
        Background="#F2F4F7" FontFamily="Segoe UI" FontSize="13"
        TextOptions.TextFormattingMode="Display" UseLayoutRounding="True">
  <Window.Resources>
$sharedResources
  </Window.Resources>
  <Grid Margin="20">
    <Grid.RowDefinitions>
      <RowDefinition Height="Auto"/>
      <RowDefinition Height="*"/>
      <RowDefinition Height="*"/>
      <RowDefinition Height="Auto"/>
      <RowDefinition Height="Auto"/>
      <RowDefinition Height="Auto"/>
    </Grid.RowDefinitions>

    <StackPanel Grid.Row="0" Margin="0,0,0,12">
      <TextBlock x:Name="Heading" FontSize="17" FontWeight="SemiBold"/>
      <TextBlock Text="Where this app keeps its settings. One path per line; anything that does not exist on this PC is skipped at backup time. Saved into ConfigMappings.ps1."
                 Foreground="{StaticResource Muted}" TextWrapping="Wrap" Margin="0,3,0,0"/>
    </StackPanel>

    <StackPanel Grid.Row="1" Margin="0,0,0,10">
      <TextBlock Text="Files" FontWeight="SemiBold"/>
      <TextBlock x:Name="FilesHint" Foreground="{StaticResource Muted}" FontSize="11.5" Margin="0,2,0,4"
                 Text="e.g. C:\Users\you\AppData\Roaming\FileZilla\sitemanager.xml"/>
      <TextBox x:Name="FilesBox" Style="{StaticResource MultiLineBox}" Height="90"/>
    </StackPanel>

    <StackPanel Grid.Row="2" Margin="0,0,0,10">
      <TextBlock Text="Folders" FontWeight="SemiBold"/>
      <TextBlock Text="Whole folders. Rarely needed - prefer individual files."
                 Foreground="{StaticResource Muted}" FontSize="11.5" Margin="0,2,0,4"/>
      <TextBox x:Name="FoldersBox" Style="{StaticResource MultiLineBox}" Height="70"/>
    </StackPanel>

    <StackPanel Grid.Row="3" Margin="0,0,0,10">
      <TextBlock Text="Registry keys" FontWeight="SemiBold"/>
      <TextBlock Text="Full HKEY_ paths, e.g. HKEY_CURRENT_USER\Software\SimonTatham\PuTTY"
                 Foreground="{StaticResource Muted}" FontSize="11.5" Margin="0,2,0,4"/>
      <TextBox x:Name="RegistryBox" Style="{StaticResource MultiLineBox}" Height="70"/>
    </StackPanel>

    <TextBlock x:Name="ErrorText" Grid.Row="4" Foreground="#C0392B" TextWrapping="Wrap"
               Margin="0,4,0,0" Visibility="Collapsed"/>

    <Grid Grid.Row="5" Margin="0,14,0,0">
      <Button x:Name="OpenBtn" Content="Open ConfigMappings.ps1" Style="{StaticResource SecondaryButton}"
              HorizontalAlignment="Left" ToolTip="Open the file itself - it has worked examples in its comments"/>
      <StackPanel Orientation="Horizontal" HorizontalAlignment="Right">
        <Button x:Name="CancelBtn" Content="Cancel" Style="{StaticResource SecondaryButton}"/>
        <Button x:Name="SaveBtn" Content="Save" Style="{StaticResource PrimaryButton}" Margin="10,0,0,0"/>
      </StackPanel>
    </Grid>
  </Grid>
</Window>
"@

    $dialog = [System.Windows.Markup.XamlReader]::Parse($dialogXaml)
    $dialog.Owner = $Script:Window
    $dialog.FindName('Heading').Text = "Config for $($Row.Name)"

    $mapping = Get-Mapping $Row.Name

    $Script:Cfg = @{
        Dialog      = $dialog
        FilesBox    = $dialog.FindName('FilesBox')
        FoldersBox  = $dialog.FindName('FoldersBox')
        RegistryBox = $dialog.FindName('RegistryBox')
        ErrorText   = $dialog.FindName('ErrorText')
        Row         = $Row
    }

    # Paths are shown expanded (they are the real ones on this PC) and written back with
    # $env: variables, so a backup still restores under a different username.
    if ($mapping) {
        $Script:Cfg.FilesBox.Text    = (@($mapping['Files'])    | Where-Object { $_ }) -join "`r`n"
        $Script:Cfg.FoldersBox.Text  = (@($mapping['Folders'])  | Where-Object { $_ }) -join "`r`n"
        $Script:Cfg.RegistryBox.Text = (@($mapping['Registry']) | Where-Object { $_ }) -join "`r`n"
    }
    $dialog.FindName('FilesHint').Text = "e.g. $env:APPDATA\FileZilla\sitemanager.xml"

    $dialog.FindName('CancelBtn').Add_Click({ $Script:Cfg.Dialog.Close() })
    $dialog.FindName('SaveBtn').Add_Click({ Save-PackageConfig })
    $dialog.FindName('OpenBtn').Add_Click({
        try { Start-Process $Script:MappingsFile }
        catch { Add-LogLine "Could not open ConfigMappings.ps1: $_" 'Warning' }
    })

    $null = $dialog.ShowDialog()
    $Script:Cfg = $null
}

function Save-PackageConfig {
    $dlg = $Script:Cfg
    $row = $dlg.Row

    $split = { param($Text) @($Text -split "`r?`n" | ForEach-Object { $_.Trim() } | Where-Object { $_ }) }

    $files    = & $split $dlg.FilesBox.Text
    $folders  = & $split $dlg.FoldersBox.Text
    $registry = & $split $dlg.RegistryBox.Text

    $bad = @($registry | Where-Object { $_ -notmatch '^(?i)HKEY_(CURRENT_USER|LOCAL_MACHINE|CLASSES_ROOT|USERS|CURRENT_CONFIG)\\' })
    if ($bad.Count -gt 0) {
        $dlg.ErrorText.Text = "Registry keys need a full HKEY_ path (reg export/import will not take HKCU:). Fix: $($bad[0])"
        $dlg.ErrorText.Visibility = 'Visible'
        return
    }

    try {
        # Only the config paths change here - the install details are the URL dialog's business
        Set-ConfigMapping -Name $row.Name -Files $files -Folders $folders -Registry $registry `
            -InstallUrl (Get-MappingValue $row.Name 'InstallUrl') `
            -DisplayName (Get-MappingValue $row.Name 'DisplayName') `
            -InstallUrls (Get-MappingUrls $row.Name)
    }
    catch {
        $dlg.ErrorText.Text = "$_"
        $dlg.ErrorText.Visibility = 'Visible'
        return
    }

    Update-RowMapping $row
    if ($row.HasMapping -and -not $row.Config) { $row.Config = $true }
    $row.Sync()

    $dlg.Dialog.Close()
    Update-PackageList
    Set-Dirty
    $total = $files.Count + $folders.Count + $registry.Count
    Add-LogLine "Saved config mapping for $($row.Name) ($total item(s))" 'Info'
}

# --- "Browse installed" dialog ---
#
# Matching a Windows display name to a package id costs a `choco search` per candidate, so the
# old dialog only did it when you pressed Add - and a program it could not match was silently
# dropped, which is a miserable way to lose a 50-package selection. Now every unknown program
# is resolved in the background as soon as the dialog opens, the answer (including "nothing
# carries this") is cached in catalog.json, and a program that cannot be matched says so and
# offers to be installed from a URL instead.

function Show-InstalledDialog {
    $dialogXaml = @"
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Installed software" Width="720" Height="660"
        WindowStartupLocation="CenterOwner" ShowInTaskbar="False"
        Background="#F2F4F7" FontFamily="Segoe UI" FontSize="13"
        TextOptions.TextFormattingMode="Display" UseLayoutRounding="True">
  <Window.Resources>
$sharedResources
  </Window.Resources>
  <Grid Margin="20">
    <Grid.RowDefinitions>
      <RowDefinition Height="Auto"/>
      <RowDefinition Height="Auto"/>
      <RowDefinition Height="*"/>
      <RowDefinition Height="Auto"/>
      <RowDefinition Height="Auto"/>
    </Grid.RowDefinitions>

    <StackPanel Grid.Row="0" Margin="0,0,0,12">
      <TextBlock Text="Software installed on this PC" FontSize="17" FontWeight="SemiBold"/>
      <TextBlock Text="Each program is matched to a Chocolatey id, falling back to winget. Results are cached, so this is slow once and instant afterwards. Greyed-out rows are on neither - add those from a URL."
                 Foreground="{StaticResource Muted}" TextWrapping="Wrap" Margin="0,3,0,0"/>
    </StackPanel>

    <Grid Grid.Row="1" Margin="0,0,0,10">
      <Grid.ColumnDefinitions>
        <ColumnDefinition Width="*"/>
        <ColumnDefinition Width="Auto"/>
        <ColumnDefinition Width="Auto"/>
      </Grid.ColumnDefinitions>
      <Grid Grid.Column="0">
        <TextBox x:Name="FilterBox"/>
        <TextBlock x:Name="FilterHint" Text="Filter..." Foreground="#98A1B0" Margin="11,0,0,0"
                   VerticalAlignment="Center" IsHitTestVisible="False"/>
      </Grid>
      <Button x:Name="RefreshBtn" Grid.Column="1" Content="Rescan PC" Margin="10,0,0,0"
              Style="{StaticResource SecondaryButton}"
              ToolTip="Look again at what is installed, keeping the cached package ids"/>
      <Button x:Name="RecheckBtn" Grid.Column="2" Content="Recheck all" Margin="8,0,0,0"
              Style="{StaticResource SecondaryButton}"
              ToolTip="Throw away the cached package ids and look every program up again"/>
    </Grid>

    <Border Grid.Row="2" Background="{StaticResource Card}" CornerRadius="8"
            BorderBrush="{StaticResource Border}" BorderThickness="1">
      <Grid>
        <ListBox x:Name="AppList" Background="Transparent" BorderThickness="0" Padding="6"
                 ScrollViewer.HorizontalScrollBarVisibility="Disabled" HorizontalContentAlignment="Stretch">
          <ListBox.ItemContainerStyle>
            <Style TargetType="ListBoxItem">
              <Setter Property="Focusable" Value="False"/>
              <Setter Property="HorizontalContentAlignment" Value="Stretch"/>
              <Setter Property="Template">
                <Setter.Value>
                  <ControlTemplate TargetType="ListBoxItem">
                    <Border x:Name="bd" Background="Transparent" CornerRadius="6" Padding="8,6">
                      <ContentPresenter/>
                    </Border>
                    <ControlTemplate.Triggers>
                      <Trigger Property="IsMouseOver" Value="True">
                        <Setter TargetName="bd" Property="Background" Value="#EEF3FF"/>
                      </Trigger>
                    </ControlTemplate.Triggers>
                  </ControlTemplate>
                </Setter.Value>
              </Setter>
            </Style>
          </ListBox.ItemContainerStyle>
          <ListBox.ItemTemplate>
            <DataTemplate>
              <Grid>
                <Grid.ColumnDefinitions>
                  <ColumnDefinition Width="*"/>
                  <ColumnDefinition Width="Auto"/>
                </Grid.ColumnDefinitions>
                <!-- A program on neither repository is dimmed, but still selectable: picking it
                     offers a custom installer URL instead of silently dropping it -->
                <CheckBox Content="{Binding Display}" VerticalAlignment="Center"
                          IsChecked="{Binding Selected, Mode=TwoWay, UpdateSourceTrigger=PropertyChanged}">
                  <CheckBox.Style>
                    <Style TargetType="CheckBox" BasedOn="{StaticResource {x:Type CheckBox}}">
                      <Style.Triggers>
                        <DataTrigger Binding="{Binding Resolved}" Value="False">
                          <Setter Property="Opacity" Value="0.55"/>
                        </DataTrigger>
                      </Style.Triggers>
                    </Style>
                  </CheckBox.Style>
                </CheckBox>
                <TextBlock Grid.Column="1" Text="{Binding Status}" FontSize="11" Margin="10,0,0,0"
                           VerticalAlignment="Center">
                  <TextBlock.Style>
                    <Style TargetType="TextBlock">
                      <Setter Property="Foreground" Value="{StaticResource Muted}"/>
                      <Style.Triggers>
                        <DataTrigger Binding="{Binding State}" Value="notfound">
                          <Setter Property="Foreground" Value="#B0553F"/>
                        </DataTrigger>
                        <DataTrigger Binding="{Binding State}" Value="checking">
                          <Setter Property="Foreground" Value="#2F6BFF"/>
                        </DataTrigger>
                      </Style.Triggers>
                    </Style>
                  </TextBlock.Style>
                </TextBlock>
              </Grid>
            </DataTemplate>
          </ListBox.ItemTemplate>
        </ListBox>
        <TextBlock x:Name="LoadingText" Text="Scanning this PC..." Foreground="{StaticResource Muted}"
                   HorizontalAlignment="Center" VerticalAlignment="Center"/>
      </Grid>
    </Border>

    <TextBlock x:Name="SyncText" Grid.Row="3" Foreground="{StaticResource Muted}" FontSize="11.5"
               Margin="2,10,0,0"/>

    <Grid Grid.Row="4" Margin="0,10,0,0">
      <TextBlock x:Name="DialogStatus" Foreground="{StaticResource Muted}" VerticalAlignment="Center"/>
      <StackPanel Orientation="Horizontal" HorizontalAlignment="Right">
        <Button x:Name="CancelBtn" Content="Cancel" Style="{StaticResource SecondaryButton}"/>
        <Button x:Name="AddSelectedBtn" Content="Add selected" Style="{StaticResource PrimaryButton}"
                Margin="10,0,0,0" IsEnabled="False"/>
      </StackPanel>
    </Grid>
  </Grid>
</Window>
"@

    $dialog = [System.Windows.Markup.XamlReader]::Parse($dialogXaml)
    $dialog.Owner = $Script:Window

    $apps = [System.Collections.ObjectModel.ObservableCollection[InstalledRow]]::new()
    $appList = $dialog.FindName('AppList')
    $appList.ItemsSource = $apps

    # The dialog's state lives in script scope so the handlers and the functions below can
    # reach it: a GetNewClosure() scriptblock runs in its own module scope and cannot call
    # this script's functions (Start-BackgroundJob, Add-LogLine, ...).
    $Script:Dlg = @{
        Dialog      = $dialog
        Apps        = $apps
        View        = [System.Windows.Data.CollectionViewSource]::GetDefaultView($apps)
        FilterBox   = $dialog.FindName('FilterBox')
        FilterHint  = $dialog.FindName('FilterHint')
        RefreshBtn  = $dialog.FindName('RefreshBtn')
        RecheckBtn  = $dialog.FindName('RecheckBtn')
        AppList     = $appList
        LoadingText = $dialog.FindName('LoadingText')
        SyncText    = $dialog.FindName('SyncText')
        Status      = $dialog.FindName('DialogStatus')
        AddBtn      = $dialog.FindName('AddSelectedBtn')
        CancelBtn   = $dialog.FindName('CancelBtn')
        Resolving   = $false
        Job         = $null      # the in-flight match, so Add / Cancel can call it off
    }

    $Script:Dlg.FilterBox.Add_TextChanged({
        $dlg = $Script:Dlg
        $dlg.FilterHint.Visibility = if ($dlg.FilterBox.Text) { 'Collapsed' } else { 'Visible' }
        $text = $dlg.FilterBox.Text.Trim()
        if ($text) {
            $dlg.View.Filter = [Predicate[object]] { param($item) $item.Display -like "*$text*" }.GetNewClosure()
        }
        else {
            $dlg.View.Filter = $null
        }
    })

    $Script:Dlg.CancelBtn.Add_Click({ $Script:Dlg.Dialog.Close() })
    $Script:Dlg.RefreshBtn.Add_Click({ Start-InstalledScan })
    $Script:Dlg.RecheckBtn.Add_Click({ Reset-InstalledCatalog })
    $Script:Dlg.AddBtn.Add_Click({ Add-SelectedInstalled })

    # Reuse the previous machine scan - the list of installed programs rarely changes, and the
    # ids behind it are cached anyway. Prefer the in-memory copy from this session; failing that,
    # the one persisted in catalog.json from a previous launch. "Rescan PC" forces a fresh read.
    if ($Script:InstalledCache) {
        Update-InstalledList -Items $Script:InstalledCache
    }
    elseif (@($Script:Catalog.installed).Count -gt 0) {
        $Script:InstalledCache = @($Script:Catalog.installed)
        Add-LogLine "Loaded $($Script:InstalledCache.Count) installed program(s) from the last scan ($($Script:Catalog.scannedAt))" 'Detail'
        Update-InstalledList -Items $Script:InstalledCache
    }
    else {
        Start-InstalledScan
    }

    $null = $dialog.ShowDialog()

    # The match runs in the background; nothing may be left pointing at a dialog that is gone
    Stop-InstalledResolve
    $Script:Dlg = $null

    # Runs a background lookup that opens no modal, but only after this dialog has closed so its
    # rows are already on the list
    Start-PendingResolve
}

# Calls off the in-flight match. Whatever it already reported is kept - the rows it filled in
# are correct, they are just no longer being added to. Its OnComplete (which is what normally
# writes catalog.json) never runs for a cancelled job, so the ids resolved this session are
# flushed to disk here instead - otherwise closing the dialog throws away everything it learned.
function Stop-InstalledResolve {
    if (-not $Script:Dlg) { return }
    $wasResolving = [bool]$Script:Dlg.Job
    if ($Script:Dlg.Job) { $Script:Dlg.Job.Cancelled = $true }
    $Script:Dlg.Job = $null
    $Script:Dlg.Resolving = $false
    if ($wasResolving) { Export-Catalog }
}

function Update-SyncText {
    $known = @($Script:Catalog.apps.Values | Where-Object { $_.id }).Count
    $missing = $Script:Catalog.apps.Count - $known
    $scanned = [string]$Script:Catalog.scannedAt

    $Script:Dlg.SyncText.Text = if ($scanned) {
        "PC scanned $scanned  |  $known matched, $missing with no package  |  cached in catalog.json - use Rescan PC to refresh"
    }
    else {
        'Never synced - package ids are being looked up now.'
    }
}

# Turns the machine scan into rows, answering from the catalog wherever it can and queueing
# whatever is left for the background resolver.
function Update-InstalledList {
    param($Items)

    $dlg = $Script:Dlg
    $dlg.Apps.Clear()

    foreach ($item in $Items) {
        $id = [string]$item.Id
        # Anything already on the package list is not worth offering again
        if ($id -and (Test-DuplicatePackage $id)) { continue }

        $row = [InstalledRow]::new()
        $row.Display = [string]$item.Display
        $row.Id      = $id
        $row.Source  = [string]$item.Source

        if ($id) {
            # Chocolatey manages it, so its id is not a guess
            $row.State = 'known'
            $row.Status = "chocolatey: $id"
            $row.Resolved = $true
        }
        else {
            $cached = Get-CatalogApp $row.Display
            if ($cached -and $cached.id) {
                $row.Id = [string]$cached.id
                $row.Source = [string]$cached.source
                $row.State = 'cached'
                $row.Status = "$($cached.source): $($cached.id)"
                $row.Resolved = $true
                if (Test-DuplicatePackage $row.Id) { continue }
            }
            elseif ($cached) {
                $row.State = 'notfound'
                $row.Status = 'no package - add from URL'
                $row.Resolved = $false
            }
            else {
                $row.State = 'pending'
                $row.Status = 'not checked yet'
                $row.Resolved = $false
            }
        }
        $dlg.Apps.Add($row)
    }

    $dlg.LoadingText.Visibility = 'Collapsed'
    $dlg.AddBtn.IsEnabled = $true
    $dlg.RefreshBtn.IsEnabled = $true
    $dlg.RecheckBtn.IsEnabled = $true
    $dlg.Status.Text = "$($dlg.Apps.Count) program(s)"

    if ($dlg.Apps.Count -eq 0) {
        $dlg.LoadingText.Text = 'Nothing found that is not already on the list.'
        $dlg.LoadingText.Visibility = 'Visible'
    }

    Update-SyncText
    Start-InstalledResolve
}

function Start-InstalledScan {
    $dlg = $Script:Dlg
    $dlg.Apps.Clear()
    $dlg.AddBtn.IsEnabled = $false
    $dlg.RefreshBtn.IsEnabled = $false
    $dlg.RecheckBtn.IsEnabled = $false
    $dlg.LoadingText.Text = 'Scanning this PC...'
    $dlg.LoadingText.Visibility = 'Visible'
    $dlg.Status.Text = ''

    $null = Start-BackgroundJob -Work $Script:PkgWork -Arguments @('scan', $null) -OnComplete {
        param($Output)
        $Script:InstalledCache = @($Output | Where-Object { $_ -is [hashtable] })
        Add-LogLine "Scanned this PC: $($Script:InstalledCache.Count) installed program(s)" 'Detail'
        # Persist the list so the next launch reuses it instead of reading the machine again
        Set-CatalogInstalled -Items $Script:InstalledCache
        Export-Catalog
        Update-InstalledList -Items $Script:InstalledCache
    }
}

# Forgets every cached id for the programs on screen and looks them all up again, so a package
# that has since appeared in a repository (or a wrong old answer) is picked up.
function Reset-InstalledCatalog {
    if ($Script:Dlg.Resolving) { return }

    $answer = [System.Windows.MessageBox]::Show($Script:Dlg.Dialog,
        "Look every program up again?`n`nThe cached package ids are thrown away and rebuilt, which takes a few seconds per program.",
        'Software Manager', 'YesNo', 'Question')
    if ($answer -ne 'Yes') { return }

    $Script:Catalog.apps = @{}
    Export-Catalog

    foreach ($row in $Script:Dlg.Apps) {
        if ($row.State -eq 'known') { continue }   # Chocolatey's own list needs no guessing
        $row.Id = ''
        $row.Source = ''
        $row.State = 'pending'
        $row.Status = 'not checked yet'
        $row.Resolved = $false
    }
    $Script:Dlg.AppList.Items.Refresh()
    Add-LogLine 'Cleared the cached package ids - rechecking every program.' 'Detail'
    Start-InstalledResolve
}

# Resolves every 'pending' row in the background, filling them in as the answers arrive.
function Start-InstalledResolve {
    $dlg = $Script:Dlg
    if ($dlg.Resolving) { return }

    $pending = @($dlg.Apps | Where-Object { $_.State -eq 'pending' })
    if ($pending.Count -eq 0) {
        Update-SyncText
        return
    }

    if (-not $Script:ChocoAvailable -and -not $Script:WingetAvailable) {
        $dlg.Status.Text = "$($dlg.Apps.Count) program(s) - install Chocolatey to match them to packages"
        return
    }

    foreach ($row in $pending) {
        $row.State = 'checking'
        $row.Status = 'checking...'
    }
    $dlg.AppList.Items.Refresh()

    $dlg.Resolving = $true
    # "Add selected" stays live: waiting for a hundred programs to be matched before you may
    # pick the three you came for is the whole complaint. Adding calls the match off and
    # re-runs it against the selection alone.
    $dlg.RecheckBtn.IsEnabled = $false
    $dlg.Status.Text = "Matching $($pending.Count) program(s)..."

    $dlg.Job = Start-BackgroundJob -Work $Script:PkgWork -Arguments @('resolve', @($pending.Display)) -OnProgress {
        param($Update)

        if (-not $Script:Dlg) { return }

        $parts = $Update -split "`t"
        if ($parts[0] -eq 'PROGRESS') {
            $Script:Dlg.Status.Text = "Matching $($parts[1])/$($parts[2]): $($parts[3])"
            return
        }
        if ($parts[0] -ne 'RESULT') { return }

        $display = $parts[1]
        $id      = $parts[2]
        $source  = $parts[3]
        $version = if ($parts.Count -gt 4) { $parts[4] } else { '' }

        # Cache the answer either way: "nothing carries this" is worth remembering too
        Set-CatalogApp -Display $display -Id $id -Source $source -Version $version

        $row = $Script:Dlg.Apps | Where-Object { $_.Display -eq $display } | Select-Object -First 1
        if (-not $row) { return }

        if ($id) {
            $row.Id = $id
            $row.Source = $source
            $row.State = 'cached'
            $row.Status = "$source`: $id"
            $row.Resolved = $true
        }
        else {
            $row.State = 'notfound'
            $row.Status = 'no package - add from URL'
            $row.Resolved = $false
        }
        $Script:Dlg.AppList.Items.Refresh()
    } -OnComplete {
        param($Output)

        Export-Catalog

        $dlg = $Script:Dlg
        if (-not $dlg) { return }   # dialog closed while the lookup was running

        $dlg.Resolving = $false
        $dlg.Job = $null
        $dlg.RecheckBtn.IsEnabled = $true

        $unmatched = @($dlg.Apps | Where-Object { -not $_.Resolved }).Count
        $dlg.Status.Text = "$($dlg.Apps.Count) program(s), $unmatched with no package"
        Update-SyncText
        Add-LogLine "Matched installed software: $($dlg.Apps.Count - $unmatched) with a package, $unmatched without" 'Detail'
    }
}

function Add-SelectedInstalled {
    $dlg = $Script:Dlg
    $selected = @($dlg.Apps | Where-Object { $_.Selected })
    if ($selected.Count -eq 0) { return }

    # Picking a program is the answer - the match running over the other hundred is no longer
    # worth waiting for. Call it off; the selection is matched on its own below.
    Stop-InstalledResolve

    $resolved  = @($selected | Where-Object { $_.Resolved -and $_.Id })
    $unchecked = @($selected | Where-Object { -not $_.Resolved -and $_.State -ne 'notfound' })
    $unmatched = @($selected | Where-Object { -not $_.Resolved -and $_.State -eq 'notfound' })

    $added = 0
    foreach ($app in $resolved) {
        if (Test-DuplicatePackage $app.Id) { continue }
        $source = if ($app.Source -eq 'winget') { 'winget' } else { 'chocolatey' }
        $null = Add-PackageRow -Name $app.Id -Source $source
        Add-LogLine "Added $($app.Id) via $source (from '$($app.Display)')" 'Info'
        $added++
    }

    # A program whose id is not known yet still goes on the list right now, under the name
    # Windows gives it, and is looked up in the background once this dialog is out of the way.
    foreach ($app in $unchecked) {
        if (Test-DuplicatePackage $app.Display) { continue }
        $row = Add-PackageRow -Name $app.Display
        $row.Resolving = $true
        $row.Sync()
        $added++
    }

    # A program neither repository has is not dropped and does not interrupt with a dialog: it
    # goes on the list as a custom-installer row flagged "needs URL", to be completed from there.
    foreach ($app in $unmatched) {
        if (Add-UrlPlaceholderRow -Display $app.Display) { $added++ }
    }

    if ($added -gt 0) {
        Set-Dirty
        Update-PackageList
    }

    $dlg.Dialog.Close()
    Set-Status "Added $added package(s)" $(if ($added) { '#1F7A3D' } else { '#8A6100' })
}

# --- Matching the packages added before they were checked ---
#
# A row added straight from "Browse installed" carries the Windows display name, not a package
# id. Look each one up in the background and swap in the id that comes back; a program neither
# repository carries becomes a custom-installer row for the user to add a URL to.

function Start-PendingResolve {
    $pending = @($Script:Rows | Where-Object { $_.Resolving })
    if ($pending.Count -eq 0) { return }

    if (-not $Script:ChocoAvailable -and -not $Script:WingetAvailable) {
        Add-LogLine "Cannot look up $($pending.Count) package(s) without Chocolatey or winget." 'Warning'
        return
    }

    $Script:Ui.Progress.IsIndeterminate = $true
    $Script:Ui.ProgressText.Text = "Checking $($pending.Count) package(s)..."
    Set-Status "Checking $($pending.Count) package(s) against Chocolatey and winget..."

    $null = Start-BackgroundJob -Work $Script:PkgWork -Arguments @('resolve', @($pending.Name)) -OnProgress {
        param($Update)

        $parts = $Update -split "`t"
        if ($parts[0] -eq 'PROGRESS') {
            $Script:Ui.ProgressText.Text = "Checking $($parts[1])/$($parts[2]): $($parts[3])"
            return
        }
        if ($parts[0] -ne 'RESULT') { return }

        $display = $parts[1]
        $id      = $parts[2]
        $source  = $parts[3]
        $version = if ($parts.Count -gt 4) { $parts[4] } else { '' }

        Set-CatalogApp -Display $display -Id $id -Source $source -Version $version

        $row = $Script:Rows | Where-Object { $_.Resolving -and $_.Name -eq $display } | Select-Object -First 1
        if (-not $row) { return }

        if (-not $id) {
            # Neither repository has it. It stays on the list as a custom-installer row, flagged
            # "needs URL", with the Windows name kept so the URL editor can pre-fill its title.
            $newId = ConvertTo-PackageId $display
            if (-not $newId) { $newId = 'app' }
            if ($newId -ine $display -and (Test-DuplicatePackage $newId)) {
                $null = $Script:Rows.Remove($row)
                Add-LogLine "'$display' resolves to id '$newId', which is already in the list" 'Detail'
                Update-PackageList
                return
            }
            $row.Title     = $display
            $row.Name      = $newId
            $row.Source    = 'url'
            $row.Version   = ''
            $row.Latest    = ''
            $row.Resolving = $false
            Update-RowMapping $row
            $row.Config = $false
            $row.Sync()
            Add-LogLine "'$display' is on neither Chocolatey nor winget - added as a custom installer ($newId), add its URL" 'Info'
            Update-PackageList
            return
        }

        if (Test-DuplicatePackage $id) {
            $null = $Script:Rows.Remove($row)
            Add-LogLine "'$display' is $id, which is already in the list" 'Detail'
            Update-PackageList
            return
        }

        $row.Name      = $id
        $row.Source    = if ($source -eq 'winget') { 'winget' } else { 'chocolatey' }
        $row.Latest    = $version
        $row.Resolving = $false
        Update-RowMapping $row
        $row.Config = $row.HasMapping
        $row.Sync()
        Add-LogLine "Added $id via $source (from '$display')" 'Info'
        Update-PackageList
    } -OnComplete {
        param($Output)

        Export-Catalog
        $Script:Ui.Progress.IsIndeterminate = $false
        $Script:Ui.Progress.Value = 0
        $Script:Ui.ProgressText.Text = ''

        # Anything still marked Resolving never got an answer (the job was torn down)
        foreach ($row in @($Script:Rows | Where-Object { $_.Resolving })) {
            $null = $Script:Rows.Remove($row)
            Add-LogLine "Gave up looking up '$($row.Name)' - it was not added." 'Warning'
        }

        Set-Dirty
        Update-PackageList
        Set-Status 'Finished checking the packages that were added' '#1F7A3D'
    }
}

# --- packages.txt ---

function Save-PackageList {
    # Rewrite packages.txt from the current rows, preserving comments and blank lines and the
    # original ordering; new packages are appended at the end.
    $lines = [System.Collections.Generic.List[string]]::new()
    $written = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)

    # A row still being looked up carries a Windows display name, not a package id - writing it
    # would put a line in packages.txt that no repository can install.
    $unresolved = @($Script:Rows | Where-Object { $_.Resolving })
    $rows = @($Script:Rows | Where-Object { -not $_.Resolving })

    foreach ($line in $Script:OriginalLines) {
        $trimmed = $line.Trim()
        if ($trimmed -eq '' -or $trimmed.StartsWith('#')) {
            $lines.Add($line)
            continue
        }
        $name = (ConvertFrom-PackageLine $trimmed).Name
        $row = $rows | Where-Object { $_.Name -ieq $name } | Select-Object -First 1
        if ($row -and $written.Add($row.Name)) {
            $lines.Add((ConvertTo-PackageLine $row))
        }
        # Rows removed in the GUI drop their line here
    }
    foreach ($row in $rows) {
        if ($written.Add($row.Name)) {
            $lines.Add((ConvertTo-PackageLine $row))
        }
    }

    try {
        Set-Content -Path $Script:PackagesFile -Value $lines
        $Script:OriginalLines = @($lines)
        $Script:Dirty = $unresolved.Count -gt 0
        Set-Status 'Saved packages.txt' '#1F7A3D'
        Add-LogLine "Saved package list ($($rows.Count) packages) to packages.txt" 'Detail'
        if ($unresolved.Count -gt 0) {
            Add-LogLine "$($unresolved.Count) package(s) are still being checked and were not saved yet." 'Warning'
        }
        return $true
    }
    catch {
        Set-Status "Failed to save packages.txt: $_" '#C0392B'
        return $false
    }
}

# --- Running the engine ---

function Complete-EngineRun {
    param([int]$Errors, [int]$Warnings)

    $Script:Timer.Stop()
    foreach ($item in $Script:PsOutput.ReadAll()) {
        if ($null -ne $item) { Add-LogLine "  $item" 'Detail' }
    }
    try { $null = $Script:Ps.EndInvoke($Script:Async) } catch { Add-LogLine "Worker error: $_" 'Error' }
    $Script:Ps.Dispose()
    $Script:Runspace.Dispose()
    $Script:Ps = $null
    $Script:Runspace = $null
    $Script:Running = $false

    foreach ($name in $Script:RunControls) { $Script:Ui[$name].IsEnabled = $true }
    $Script:Ui.Progress.IsIndeterminate = $false
    if ($Script:Ui.Progress.Maximum -gt 0) { $Script:Ui.Progress.Value = $Script:Ui.Progress.Maximum }
    $Script:Ui.ProgressText.Text = ''

    if ($Errors -gt 0) {
        Set-Status "Finished with $Errors error(s), $Warnings warning(s) - see install-log.txt" '#C0392B'
    }
    elseif ($Warnings -gt 0) {
        Set-Status "Finished with $Warnings warning(s) - see install-log.txt" '#8A6100'
    }
    else {
        Set-Status 'Finished successfully' '#1F7A3D'
    }
    Add-LogLine '=== Run finished ===' 'Detail'
}

$Script:Timer = [System.Windows.Threading.DispatcherTimer]::new()
$Script:Timer.Interval = [timespan]::FromMilliseconds(150)
$Script:Timer.Add_Tick({
    # Native command output (choco etc.) surfaces on the worker's output stream
    foreach ($item in $Script:PsOutput.ReadAll()) {
        if ($null -ne $item -and "$item".Trim() -ne '') { Add-LogLine "  $item" 'Detail' }
    }

    $msg = $null
    while ($Script:Queue.TryDequeue([ref]$msg)) {
        switch ($msg.Kind) {
            'log' {
                Add-LogLine $msg.Text $msg.Level
            }
            'progress' {
                $Script:Ui.Progress.IsIndeterminate = $false
                $Script:Ui.Progress.Maximum = [double]$msg.Total
                $Script:Ui.Progress.Value = [double]($msg.Current - 1)
                $Script:Ui.ProgressText.Text = "$($msg.Current)/$($msg.Total)  $($msg.Package)"
            }
            'done' {
                Complete-EngineRun -Errors $msg.Errors -Warnings $msg.Warnings
            }
        }
    }
})

function Start-EngineRun {
    param([string]$Mode)

    if ($Script:Running) { return }

    if ($Script:Rows.Count -eq 0) {
        $null = [System.Windows.MessageBox]::Show($Script:Window,
            'There are no packages in the list.', 'Software Manager', 'OK', 'Information')
        return
    }

    # A row still being looked up has a display name where its package id belongs
    $unresolved = @($Script:Rows | Where-Object { $_.Resolving })
    if ($unresolved.Count -gt 0) {
        $null = [System.Windows.MessageBox]::Show($Script:Window,
            "$($unresolved.Count) package(s) are still being matched to Chocolatey or winget. Wait for that to finish, or remove them from the list.",
            'Software Manager', 'OK', 'Information')
        return
    }

    if ($Mode -eq 'Backup') {
        $targets = @($Script:Rows | Where-Object { $_.Config } | ForEach-Object { ConvertTo-PackageLine $_ })
        if ($targets.Count -eq 0) {
            $null = [System.Windows.MessageBox]::Show($Script:Window,
                'No packages have "Config" checked - there is nothing to back up.',
                'Software Manager', 'OK', 'Information')
            return
        }
        $prompt = "Back up configs for $($targets.Count) package(s)?`n`nThis replaces the existing configs folder and configs.zip."
    }
    else {
        # Every package on the list is installed - the list *is* the selection
        $targets = @($Script:Rows | ForEach-Object { ConvertTo-PackageLine $_ })
        $withConfig = @($Script:Rows | Where-Object { $_.Config }).Count
        $prompt = "Install $($targets.Count) package(s) and restore configs for $withConfig of them?`n`nThis installs software on this PC and imports backed-up files and registry keys."
    }

    $confirm = [System.Windows.MessageBox]::Show($Script:Window, $prompt, 'Software Manager', 'YesNo', 'Question')
    if ($confirm -ne 'Yes') { return }

    # The engine reads packages.txt for nothing here (it is handed the list), but an unsaved
    # list still means the file no longer matches what was just run.
    if ($Script:Dirty) { $null = Save-PackageList }

    $Script:Running = $true
    foreach ($name in $Script:RunControls) { $Script:Ui[$name].IsEnabled = $false }
    $Script:Ui.Progress.Value = 0
    $Script:Ui.Progress.IsIndeterminate = $true
    $Script:Ui.ProgressText.Text = 'Starting...'
    Set-Status $(if ($Mode -eq 'Backup') { 'Backing up...' } else { 'Installing...' })
    Add-LogLine "=== $Mode run started ($($targets.Count) packages) ===" 'Detail'

    $Script:Queue = [System.Collections.Concurrent.ConcurrentQueue[hashtable]]::new()

    # NOTE: dot-sourcing the engine runs its param() block in this scope, resetting any
    # variables named like its parameters ($Mode, $Force, $LoadOnly) - so the worker's own
    # variables must not share those names.
    $worker = {
        param($EnginePath, $RunMode, $RunPackages, $Queue)
        try {
            . $EnginePath -LoadOnly -Force
            $Script:LogSink = {
                param($Entry, $Level)
                $Queue.Enqueue(@{ Kind = 'log'; Text = $Entry; Level = $Level })
            }.GetNewClosure()
            $Script:ProgressSink = {
                param($Current, $Total, $Package)
                $Queue.Enqueue(@{ Kind = 'progress'; Current = $Current; Total = $Total; Package = $Package })
            }.GetNewClosure()

            if ($RunMode -eq 'Backup') { Start-BackupMode -PackageList $RunPackages }
            else { Start-InstallMode -PackageList $RunPackages }

            $Queue.Enqueue(@{ Kind = 'done'; Errors = $Script:ErrorCount; Warnings = $Script:WarningCount })
        }
        catch {
            $Queue.Enqueue(@{ Kind = 'log'; Text = "Fatal error: $_"; Level = 'Error' })
            $Queue.Enqueue(@{ Kind = 'done'; Errors = 1; Warnings = 0 })
        }
    }

    $Script:Runspace = [runspacefactory]::CreateRunspace()
    $Script:Runspace.Open()
    $Script:Ps = [powershell]::Create()
    $Script:Ps.Runspace = $Script:Runspace
    $null = $Script:Ps.AddScript($worker.ToString()).
        AddArgument($Script:EnginePath).AddArgument($Mode).AddArgument($targets).AddArgument($Script:Queue)

    $Script:PsInput = [System.Management.Automation.PSDataCollection[psobject]]::new()
    $Script:PsInput.Complete()
    $Script:PsOutput = [System.Management.Automation.PSDataCollection[psobject]]::new()
    $Script:Async = $Script:Ps.BeginInvoke($Script:PsInput, $Script:PsOutput)
    $Script:Timer.Start()
}

# --- Wire up events ---

# A handler that throws takes the whole window down with it, which is how a failed package
# lookup used to end the session. Log it and carry on instead.
[System.Windows.Threading.Dispatcher]::CurrentDispatcher.Add_UnhandledException({
    param($Sender, $EventArgs)
    $EventArgs.Handled = $true
    try {
        Add-LogLine "Something went wrong: $($EventArgs.Exception.Message)" 'Error'
        Set-Status 'Something went wrong - see the log below' '#C0392B'
    }
    catch { }
})

$Script:Ui.AddBtn.Add_Click({ Add-Package })
$Script:Ui.AddBox.Add_KeyDown({ param($s, $e) if ($e.Key -eq 'Return') { Add-Package } })
$Script:Ui.AddBox.Add_TextChanged({
    $Script:Ui.AddHint.Visibility = if ($Script:Ui.AddBox.Text) { 'Collapsed' } else { 'Visible' }
})
$Script:Ui.UrlBtn.Add_Click({ Show-UrlDialog -Title $Script:Ui.AddBox.Text.Trim() })
$Script:Ui.BrowseBtn.Add_Click({ Show-InstalledDialog })
$Script:Ui.InstallChocoBtn.Add_Click({ Install-ChocolateyFromGui })

$Script:Ui.HdrConfig.Add_Click({
    $checked = [bool]$Script:Ui.HdrConfig.IsChecked
    foreach ($row in $Script:Rows) { $row.Config = $checked }
    Update-PackageList
    Set-Dirty
})

$Script:Ui.PkgList.Add_SelectionChanged({ Show-PackageDetail })

# Row-level clicks bubble up here: the source and version cells, the actions menu, the remove
# button and the config checkbox, each identified by its Tag.
$Script:Ui.PkgList.AddHandler(
    [System.Windows.Controls.Primitives.ButtonBase]::ClickEvent,
    [System.Windows.RoutedEventHandler]{
        param($s, $e)
        $src = $e.OriginalSource
        $row = $src.DataContext
        if ($row -isnot [PackageRow]) { return }

        if ($src -is [System.Windows.Controls.Button]) {
            # A row whose package id is still being looked up has nothing to change yet - only
            # removing it makes sense
            if ($row.Resolving -and $src.Tag -ne 'remove') {
                Set-Status "Still checking '$($row.Name)' - give it a moment" '#8A6100'
                return
            }
            # A custom-installer row with no link yet: the source and version cells both lead to
            # the URL editor, which is the one thing left to do for it.
            if ($row.NeedsUrl -and $src.Tag -in 'source', 'version') {
                Invoke-RowAction -Action 'url' -Row $row
                return
            }
            switch ($src.Tag) {
                'source'  { Show-SourceMenu -Target $src -Row $row }
                'version' { Show-VersionDialog -Row $row }
                'menu'    { Show-RowMenu -Target $src -Row $row }
                'remove'  {
                    $null = $Script:Rows.Remove($row)
                    Show-PackageDetail
                    Set-Dirty
                }
            }
        }
        elseif ($src -is [System.Windows.Controls.CheckBox] -and $src.Tag -eq 'config') {
            Set-Dirty
        }
    })

$Script:Ui.DetailConfigBtn.Add_Click({
    $row = $Script:Ui.PkgList.SelectedItem
    if ($row) { Show-ConfigDialog -Row $row }
})
$Script:Ui.DetailActionsBtn.Add_Click({
    $row = $Script:Ui.PkgList.SelectedItem
    if ($row) { Show-RowMenu -Target $Script:Ui.DetailActionsBtn -Row $row }
})

$Script:Ui.SaveBtn.Add_Click({ $null = Save-PackageList })
$Script:Ui.BackupBtn.Add_Click({ Start-EngineRun -Mode 'Backup' })
$Script:Ui.InstallBtn.Add_Click({ Start-EngineRun -Mode 'Install' })

$Script:Ui.CopyLogBtn.Add_Click({ Copy-LogToClipboard })
$Script:Ui.ClearLogBtn.Add_Click({ Clear-LogPane })

$Script:Window.Add_Closing({
    param($s, $e)
    if ($Script:Running) {
        $answer = [System.Windows.MessageBox]::Show($Script:Window,
            'A run is still in progress. Close anyway?', 'Software Manager', 'YesNo', 'Warning')
        if ($answer -ne 'Yes') {
            $e.Cancel = $true
            return
        }
        try { $Script:Ps.Stop() } catch { }
    }
    if ($Script:Dirty) {
        $answer = [System.Windows.MessageBox]::Show($Script:Window,
            'Save changes to packages.txt before closing?', 'Software Manager', 'YesNoCancel', 'Question')
        if ($answer -eq 'Cancel') { $e.Cancel = $true }
        elseif ($answer -eq 'Yes' -and -not (Save-PackageList)) { $e.Cancel = $true }
    }
    # A background lookup running as the window closes has cached ids in memory whose
    # Export-Catalog (in its OnComplete) will never fire - persist them now as a backstop.
    if (-not $e.Cancel) { Export-Catalog }
})

# --- Initial state ---

$Script:Ui.HdrConfig.IsChecked = ($Script:Rows.Count -gt 0) -and -not ($Script:Rows | Where-Object { -not $_.Config })
Add-LogLine "Loaded $($Script:Rows.Count) packages from packages.txt" 'Detail'

if ($Script:ChocoAvailable) {
    $Script:Ui.ChocoBanner.Visibility = 'Collapsed'
}
else {
    $Script:Ui.ChocoBanner.Visibility = 'Visible'
    Add-LogLine 'Chocolatey is not installed - use the "Install Chocolatey" button above.' 'Warning'
}
Set-Status 'Ready'

# Fill in versions and monikers for anything the catalog does not already know. Cached
# packages are shown immediately; the rest arrive as the lookups finish.
$Script:Window.Add_ContentRendered({
    $unknown = @($Script:Rows | Where-Object { $_.Source -ne 'url' -and -not $_.Latest })
    if ($unknown.Count -gt 0) {
        Update-PackageMeta -Rows $unknown
    }
})

$null = $Script:Window.ShowDialog()
exit 0
