# Creates "AI Interview Assistant.lnk" on your Desktop (dev: runs Electron from this repo).
# Run from repo root:  powershell -ExecutionPolicy Bypass -File scripts/create-desktop-shortcut.ps1
# Or:  npm run desktop-shortcut

$ErrorActionPreference = 'Stop'
# scripts/ -> overlay-ai app root
$appDir = Split-Path -Parent $PSScriptRoot
$electronExe = Join-Path $appDir "node_modules\electron\dist\electron.exe"

if (-not (Test-Path $electronExe)) {
  Write-Host "Electron not found at: $electronExe" -ForegroundColor Red
  Write-Host "Run: cd `"$appDir`" && npm install" -ForegroundColor Yellow
  exit 1
}

$desktop = [Environment]::GetFolderPath('Desktop')
$lnkPath = Join-Path $desktop "AI Interview Assistant.lnk"

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($lnkPath)
$shortcut.TargetPath = $electronExe
$shortcut.Arguments = '.'
$shortcut.WorkingDirectory = $appDir
$shortcut.WindowStyle = 1
$shortcut.Description = 'AI Interview Assistant (overlay-ai dev)'
# Optional: folder icon
$shortcut.IconLocation = "$env:SystemRoot\System32\imageres.dll,110"
$shortcut.Save()

Write-Host "Shortcut created: $lnkPath" -ForegroundColor Green
