# Kopiert das Panel auf den Home-Assistant-Server, falls der Konfigurationsordner als Netzlaufwerk
# erreichbar ist (z. B. über das Samba-Add-on). Mit dem File-Editor- oder VS-Code-Add-on die Datei
# stattdessen von Hand nach /homeassistant/www/art_custom/ hochladen.
# Aufruf: powershell -ExecutionPolicy Bypass -File .\werkzeuge\deploy.ps1 -Ziel "\\homeassistant.local\config"
param(
  [string]$Ziel = '\\homeassistant.local\config'
)
$quelle = Join-Path $PSScriptRoot '..\multisite-panel.js'
$ordner = Join-Path $Ziel 'www\art_custom'
if (-not (Test-Path $Ziel)) {
  Write-Error "Ziel $Ziel ist nicht erreichbar. Ist das Samba-Add-on aktiv und der Pfad richtig?"
  exit 1
}
New-Item -ItemType Directory -Force $ordner | Out-Null
Copy-Item $quelle $ordner -Force
$version = (Select-String -Path $quelle -Pattern "const VERSION = '([^']+)'").Matches[0].Groups[1].Value
Write-Output "Kopiert nach $ordner (Version $version)."
Write-Output "Jetzt in art_configs\multisite_panel.yaml module_url auf ?v=$version setzen und Home Assistant neu starten."
