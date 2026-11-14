$ErrorActionPreference = 'Stop'
$soundLabUrl = 'http://127.0.0.1:8766'
$soundLabReady = $false
try {
    $soundLabHealth = Invoke-RestMethod "$soundLabUrl/api/health" -TimeoutSec 2
    $soundLabReady = $soundLabHealth.service -eq 'cosmic-sound-lab'
} catch {}
if (-not $soundLabReady) {
    $soundLabPython = Join-Path $PSScriptRoot '.venv\Scripts\python.exe'
    if (-not (Test-Path -LiteralPath $soundLabPython)) { $soundLabPython = Join-Path (Split-Path $PSScriptRoot -Parent) 'tutorial-hf\.venv\Scripts\python.exe' }
    if (-not (Test-Path -LiteralPath $soundLabPython)) { throw 'Run python -m venv .venv, then .venv\Scripts\python -m pip install -r requirements.txt first.' }
    $soundLabServer = Join-Path $PSScriptRoot 'server.py'
    $soundLabProcess = Start-Process -FilePath $soundLabPython -ArgumentList ('"' + $soundLabServer + '"') -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $PSScriptRoot 'sound-lab-server.log') -RedirectStandardError (Join-Path $PSScriptRoot 'sound-lab-server-errors.log')
    $soundLabProcess.Id | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'sound-lab-server.pid')
    for ($soundLabAttempt = 0; $soundLabAttempt -lt 40; $soundLabAttempt++) {
        Start-Sleep -Milliseconds 500
        try {
            $soundLabHealth = Invoke-RestMethod "$soundLabUrl/api/health" -TimeoutSec 1
            if ($soundLabHealth.service -eq 'cosmic-sound-lab') { $soundLabReady = $true; break }
        } catch {}
        if ($soundLabProcess.HasExited) { break }
    }
}
if (-not $soundLabReady) { throw 'Sound Lab could not start. Check sound-lab-server-errors.log; port 8766 may be in use.' }
Start-Process $soundLabUrl
