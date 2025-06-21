@echo off
echo Installing PowerShell 7.5.1 using winget...
winget install --id Microsoft.PowerShell --source winget --accept-package-agreements --accept-source-agreements

echo.
echo Attempting to launch SoftwareManager.ps1 in PowerShell 7 as Administrator...

:: Run pwsh.exe elevated and execute the script with execution policy bypass
powershell -Command "Start-Process 'pwsh.exe' -ArgumentList '-ExecutionPolicy Bypass -File \"%CD%\SoftwareManager.ps1\"' -Verb RunAs"

echo.
echo If prompted, approve the UAC prompt to continue.
pause
