# WENKER Router - publish len npm registry.
#
# Chay:  powershell -ExecutionPolicy Bypass -File scripts\publish-npm.ps1
#
# Yeu cau: tai khoan npm CUA CHINH BAN (agent khong bao gio dung credential).
#   1) Chua co tai khoan:  https://www.npmjs.com/signup
#   2) Dang nhap:          npm adduser   (hoac npm login)
#   3) Bat 2FA (khuyen dung): npmjs.com -> Access Tokens -> 2FA:
#      "Authorization for publishing and bypassing 2FA". Publish se hoi OTP 6 so.
#
# Script: kiem tra tien de -> xem truoc tarball -> xac nhan -> npm publish -> xac minh.

# LUU Y: khong dung $ErrorActionPreference="Stop" vi npm ghi "npm notice" ra stderr,
# PowerShell 5.1 se dich thanh NativeCommandError va dung script. Bat loi qua $LASTEXITCODE.
$ErrorActionPreference = "Continue"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host "== WENKER Router npm publish ==" -ForegroundColor Cyan

# 1. Node >= 18
$major = [int]((node -p "process.versions.node.split('.')[0]"))
if ($major -lt 18) { Write-Host "Can Node.js >= 18 (dang: $(node -v)). Cai tai: https://nodejs.org/" -ForegroundColor Red; exit 1 }

# 2. Dang nhap npm
$who = (npm whoami 2>$null) | Out-String
if (-not $who.Trim()) {
    Write-Host "Chua dang nhap npm. Chay:  npm adduser   roi chay lai script nay." -ForegroundColor Yellow
    exit 1
}
Write-Host "Dang nhap npm voi: $who" -ForegroundColor Green

# 3. Tien de: cac muc trong files[] co ton tai
foreach ($p in @("bin/wenker.js", "client/dist/index.html", "server/index.js", "web/index.html", "LICENSE", "README.md")) {
    if (-not (Test-Path (Join-Path $root $p))) { Write-Host "Thieu file: $p - dung publish." -ForegroundColor Red; exit 1 }
}

# 4. Xem truoc tarball
Write-Host ""
Write-Host "-- Noi dung tarball se upload --" -ForegroundColor Cyan
$prevEAP = $ErrorActionPreference
$ErrorActionPreference = "SilentlyContinue"
npm pack --dry-run 2>&1 | Select-String "package size|total files|version:"
$ErrorActionPreference = $prevEAP

# 5. Xac nhan
$ans = Read-Host "Publish wenker-router len npm cong khai? (ghi PUBLISH de xac nhan)"
if ($ans -ne "PUBLISH") { Write-Host "Huy. Khong upload gi ca."; exit 0 }

# 6. Publish (neu bat 2FA se hoi OTP 6 so)
$ver = (Get-Content (Join-Path $root "package.json") | ConvertFrom-Json).version
Write-Host ""
Write-Host "npm publish (version $ver)..." -ForegroundColor Cyan
npm publish --access public 2>&1 | ForEach-Object { "$_" }
if ($LASTEXITCODE -ne 0) {
    Write-Host "Publish THAT BAI (exit $LASTEXITCODE). Nguyen nhan thuong gap: chua login / OTP sai / ten package da bi trung / 2FA can token loai 'Publishing'." -ForegroundColor Red
    exit 1
}

# 7. Xac minh
Write-Host ""
Write-Host "-- Xac minh registry --" -ForegroundColor Cyan
Start-Sleep -Seconds 3
$prevEAP = $ErrorActionPreference
$ErrorActionPreference = "SilentlyContinue"
npm view wenker-router@latest version name bin dist.tarball access 2>&1 | ForEach-Object { "$_" }
$ErrorActionPreference = $prevEAP
Write-Host ""
Write-Host "XONG. Thu nghiem bang:  npm install -g wenker-router   roi chay:  wenker" -ForegroundColor Green
