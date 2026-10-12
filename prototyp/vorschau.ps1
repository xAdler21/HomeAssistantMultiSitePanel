# Startet eine lokale Vorschau des Prototyps unter http://localhost:8765/
# Aufruf: powershell -ExecutionPolicy Bypass -File .\vorschau.ps1   (Beenden mit Strg+C)
$file = Join-Path $PSScriptRoot 'zuhause-app.html'
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add('http://localhost:8765/')
$listener.Start()
Write-Output 'Vorschau: http://localhost:8765/'
while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  try {
    $body = [System.IO.File]::ReadAllText($file, [System.Text.Encoding]::UTF8)
    $html = '<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + $body + '</body></html>'
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($html)
    $ctx.Response.ContentType = 'text/html; charset=utf-8'
    $ctx.Response.ContentLength64 = $bytes.Length
    $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
  } finally {
    $ctx.Response.OutputStream.Close()
  }
}
