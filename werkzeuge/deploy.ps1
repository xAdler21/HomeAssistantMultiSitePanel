# Kopiert die Integration auf den Home-Assistant-Server, falls der Konfigurationsordner als Netzlaufwerk
# erreichbar ist (z. B. über das Samba-Add-on). Mit dem File-Editor- oder VS-Code-Add-on den Ordner
# custom_components\multisite_panel stattdessen von Hand nach /homeassistant/custom_components/ hochladen.
# Aufruf: powershell -ExecutionPolicy Bypass -File .\werkzeuge\deploy.ps1 -Ziel "\\homeassistant.local\config"
param(
  [string]$Ziel = '\\homeassistant.local\config'
)
$quelle = Join-Path $PSScriptRoot '..\custom_components\multisite_panel'
$ordner = Join-Path $Ziel 'custom_components\multisite_panel'
if (-not (Test-Path $Ziel)) {
  Write-Error "Ziel $Ziel ist nicht erreichbar. Ist das Samba-Add-on aktiv und der Pfad richtig?"
  exit 1
}
New-Item -ItemType Directory -Force $ordner | Out-Null
Copy-Item (Join-Path $quelle '*') $ordner -Recurse -Force -Exclude '__pycache__'
$version = (Get-Content (Join-Path $quelle 'manifest.json') -Raw | ConvertFrom-Json).version
Write-Output "Kopiert nach $ordner (Version $version)."
Write-Output 'Nur frontend\ geändert: Integration in HA neu laden. Python-Dateien geändert: Home Assistant neu starten.'
