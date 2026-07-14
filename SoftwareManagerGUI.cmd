@echo off
rem Launches the Software Manager GUI without leaving a PowerShell console window behind.
where pwsh >nul 2>&1
if errorlevel 1 (
    echo PowerShell 7 is required. Run InstallAndLaunchPowerShell.cmd first.
    pause
    exit /b 2
)
start "" pwsh -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0SoftwareManagerGUI.ps1"
