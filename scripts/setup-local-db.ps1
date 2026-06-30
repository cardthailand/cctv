# เริ่ม PostgreSQL local dev บนพอร์ต 5433 (ไม่ต้องใช้รหัส postgres ของระบบ)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$PgBin = "C:\Program Files\PostgreSQL\16\bin"
$DataDir = Join-Path $Root "data\pgdev"
$Port = 5433

if (-not (Test-Path "$PgBin\initdb.exe")) {
  Write-Error "PostgreSQL 16 not found. Install with: winget install PostgreSQL.PostgreSQL.16"
}

if (-not (Test-Path $DataDir)) {
  New-Item -ItemType Directory -Path $DataDir -Force | Out-Null
  & "$PgBin\initdb.exe" -D $DataDir -U postgres --encoding=UTF8 --locale=C
  Add-Content -Path (Join-Path $DataDir "postgresql.conf") -Value "`nport = $Port`nlisten_addresses = 'localhost'"
  $hba = @(
    "host    all    all    127.0.0.1/32    trust"
    "host    all    all    ::1/128         trust"
    "local   all    all                    trust"
  )
  $hba | Set-Content -Path (Join-Path $DataDir "pg_hba.conf") -Encoding ascii
}

$running = netstat -ano | Select-String ":$Port\s"
if (-not $running) {
  $logFile = Join-Path $DataDir "server.log"
  & "$PgBin\pg_ctl.exe" -D $DataDir -l $logFile -o "-p $Port" start
  Start-Sleep -Seconds 3
}

$sqlFile = Join-Path $PSScriptRoot "setup-local-db.sql"
& "$PgBin\psql.exe" -h localhost -p $Port -U postgres -d postgres -f $sqlFile
Write-Host "Local DB ready on port $Port (user: cctv_db)"
