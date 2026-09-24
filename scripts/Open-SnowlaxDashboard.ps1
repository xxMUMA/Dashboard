$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$dashboardUrl = 'http://127.0.0.1:3000/'

function Test-SnowlaxDashboard {
    try {
        $response = Invoke-WebRequest -Uri $dashboardUrl -UseBasicParsing -TimeoutSec 3
        return $response.StatusCode -eq 200 -and $response.Content -like '*Snowlax Dashboard*'
    }
    catch {
        return $false
    }
}

try {
    if (-not (Test-SnowlaxDashboard)) {
        $npmCommand = (Get-Command npm.cmd -ErrorAction Stop).Source
        Start-Process -FilePath $npmCommand -ArgumentList @('run', 'dev', '--', '--hostname', '127.0.0.1', '--port', '3000') -WorkingDirectory $projectRoot -WindowStyle Hidden | Out-Null

        $deadline = (Get-Date).AddSeconds(60)
        while ((Get-Date) -lt $deadline -and -not (Test-SnowlaxDashboard)) {
            Start-Sleep -Seconds 2
        }
        if (-not (Test-SnowlaxDashboard)) {
            throw 'The local dashboard did not start on port 3000. Check whether another app is using that port.'
        }
    }

    Start-Process $dashboardUrl
}
catch {
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.MessageBox]::Show($_.Exception.Message, 'Snowlax Dashboard') | Out-Null
}
