param(
  [string]$SshHost = "ctb2.upz.in.th",
  [int]$SshPort = 50022,
  [string]$SshUser = "root",
  [string]$RemotePath = "/home/cctv/domains/cctvcard.in.th/public_html"
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$Archive = Join-Path $env:TEMP "cctv-web-client-deploy.tar.gz"

Write-Host "Packaging project..."
Push-Location $ProjectRoot
tar `
  --exclude=node_modules `
  --exclude=.env `
  --exclude=recordings `
  --exclude=.git `
  -czf $Archive .
Pop-Location

Write-Host "Uploading to ${SshUser}@${SshHost}:${RemotePath} ..."
ssh -p $SshPort "${SshUser}@${SshHost}" "mkdir -p '$RemotePath'"
scp -P $SshPort $Archive "${SshUser}@${SshHost}:/tmp/cctv-web-client-deploy.tar.gz"
ssh -p $SshPort "${SshUser}@${SshHost}" @"
set -e
mkdir -p '$RemotePath'
tar -xzf /tmp/cctv-web-client-deploy.tar.gz -C '$RemotePath'
mkdir -p /home/cctv/domains/cctvcard.in.th/recordings
chmod +x '$RemotePath/scripts/deploy-remote.sh'
bash '$RemotePath/scripts/deploy-remote.sh'
"@

Write-Host "Deploy finished."
