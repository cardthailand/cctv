# เริ่ม PostgreSQL local (port 5433) แล้วรัน app
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

& (Join-Path $PSScriptRoot "setup-local-db.ps1")
npm start
