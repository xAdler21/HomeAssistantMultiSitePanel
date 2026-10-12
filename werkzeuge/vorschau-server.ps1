# Einfacher Webserver fuer die lokale Vorschau: http://localhost:8765/dev/vorschau.html
# Aufruf: powershell -ExecutionPolicy Bypass -File .\werkzeuge\vorschau-server.ps1   (Beenden mit Strg+C)
param([int]$Port = 8765)
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$types = @{ '.html' = 'text/html; charset=utf-8'; '.js' = 'text/javascript; charset=utf-8'; '.svg' = 'image/svg+xml'; '.css' = 'text/css'; '.json' = 'application/json'; '.yaml' = 'text/plain; charset=utf-8'; '.png' = 'image/png' }
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Output "Vorschau: http://localhost:$Port/dev/vorschau.html"
while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  try {
    $path = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath).TrimStart('/')
    if ($path -eq '') { $ctx.Response.Redirect('/dev/vorschau.html'); continue }
    $file = [System.IO.Path]::GetFullPath((Join-Path $root $path))
    if ($file.StartsWith($root) -and (Test-Path $file -PathType Leaf)) {
      $bytes = [System.IO.File]::ReadAllBytes($file)
      $ext = [System.IO.Path]::GetExtension($file).ToLower()
      $ctx.Response.ContentType = if ($types.ContainsKey($ext)) { $types[$ext] } else { 'application/octet-stream' }
      $ctx.Response.Headers.Add('Cache-Control', 'no-store')
      $ctx.Response.ContentLength64 = $bytes.Length
      $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $ctx.Response.StatusCode = 404
    }
  } finally {
    $ctx.Response.OutputStream.Close()
  }
}
