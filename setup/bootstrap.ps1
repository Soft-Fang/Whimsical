<#
.SYNOPSIS
  Whimsical 博客 · Windows 一键环境配置。

.DESCRIPTION
  自动检查并安装 Git / Node.js / Obsidian，然后把剩余工作交给跨平台脚本
  setup/lib/bootstrap.mjs（同步仓库、装依赖、还原 Obsidian 插件）。

  最省事的用法：在仓库目录里右键 →「在终端中打开」，然后执行

      powershell -ExecutionPolicy Bypass -File setup\bootstrap.ps1

.EXAMPLE
  .\setup\bootstrap.ps1
  一键配置，缺什么装什么。

.EXAMPLE
  .\setup\bootstrap.ps1 -DryRun
  只看看会做什么，不改任何东西。

.EXAMPLE
  .\setup\bootstrap.ps1 -Vault "D:\MyVault" -Force
  指定 Obsidian vault 路径，并强制重装插件。
#>
[CmdletBinding()]
param(
  [string]$Dir,
  [string]$Vault,
  [string]$RepoUrl,
  [string]$GitName,
  [string]$GitEmail,
  [switch]$DryRun,
  [switch]$Force,
  [switch]$WithAssets,
  [switch]$SkipApps,
  [switch]$SkipPlugins,
  [switch]$NoPull,
  [switch]$Dev,
  [switch]$NoPause
)

$ErrorActionPreference = 'Stop'
$script:RepoRoot = Split-Path -Parent $PSScriptRoot   # setup/ 的上一级
Set-Location -LiteralPath $script:RepoRoot

function Write-Head($text) { Write-Host ''; Write-Host "==> $text" -ForegroundColor Cyan }
function Write-Ok($text)   { Write-Host "  [ OK ] $text" -ForegroundColor Green }
function Write-Skip2($text){ Write-Host "  [SKIP] $text" -ForegroundColor DarkGray }
function Write-Warn2($text){ Write-Host "  [WARN] $text" -ForegroundColor Yellow }
function Write-Err2($text) { Write-Host "  [FAIL] $text" -ForegroundColor Red }

function Update-PathFromRegistry {
  # 安装完软件后，当前进程的 PATH 不会自动刷新，这里手动合并一次
  try {
    $machine = [Environment]::GetEnvironmentVariable('Path', 'Machine')
    $user    = [Environment]::GetEnvironmentVariable('Path', 'User')
    $env:Path = (@($machine, $user) | Where-Object { $_ }) -join ';'
  } catch {
    Write-Warn2 "刷新 PATH 失败，若新装的软件找不到，请重开一个终端"
  }
}

function Test-Cmd($line) {
  if (-not $line) { return $false }
  $parts = $line -split '\s+', 2
  return [bool](Get-Command $parts[0] -ErrorAction SilentlyContinue)
}

function Test-Winget {
  return [bool](Get-Command winget -ErrorAction SilentlyContinue)
}

function Install-WithWinget($id, $name) {
  if ($DryRun) {
    Write-Host "    `$ winget install --id $id -e --accept-package-agreements --accept-source-agreements"
    return $true
  }
  Write-Host "    正在安装 $name（winget --id $id）…" -ForegroundColor DarkGray
  & winget install --id $id -e --source winget `
      --accept-package-agreements --accept-source-agreements --silent
  $code = $LASTEXITCODE
  if ($code -eq 0) { Write-Ok "$name 安装完成"; return $true }
  if ($code -eq -1978335189) { Write-Skip2 "$name 已是最新版本"; return $true }  # 0x8A15002B 已安装
  Write-Warn2 "$name 安装返回码 $code"
  return $false
}

# ------------------------------------------------------------------ 开始

Clear-Host -ErrorAction SilentlyContinue
Write-Host ''
Write-Host '  Whimsical 博客 · Windows 一键环境配置' -ForegroundColor White
Write-Host '  ----------------------------------------' -ForegroundColor DarkGray
Write-Host "  仓库目录：$script:RepoRoot"
if ($DryRun) { Write-Host '  DRY-RUN 模式：只显示将要做的事' -ForegroundColor Yellow }

# ------------------------------------------------------------------ 1. 安装软件

if (-not $SkipApps) {
  Write-Head '检查并安装所需软件'

  $appsFile = Join-Path $PSScriptRoot 'config\apps.json'
  if (-not (Test-Path -LiteralPath $appsFile)) {
    Write-Err2 "找不到 $appsFile"
    exit 1
  }
  $apps = (Get-Content -LiteralPath $appsFile -Raw -Encoding UTF8 | ConvertFrom-Json).windows

  $hasWinget = Test-Winget
  if (-not $hasWinget) {
    Write-Warn2 '这台电脑没有 winget，无法自动安装软件'
    Write-Host '    → 手动安装以下软件后重跑本脚本：' -ForegroundColor DarkGray
    Write-Host '      Git      https://git-scm.com/download/win' -ForegroundColor DarkGray
    Write-Host '      Node.js  https://nodejs.org （选 LTS）' -ForegroundColor DarkGray
    Write-Host '      Obsidian https://obsidian.md/download' -ForegroundColor DarkGray
  }

  foreach ($app in $apps) {
    $installed = Test-Cmd $app.check
    if ($installed) {
      Write-Skip2 "$($app.name) 已安装"
      continue
    }
    if (-not $hasWinget) {
      if ($app.required) { Write-Err2 "$($app.name) 未安装且必需，请手动装好后重跑" }
      else { Write-Warn2 "$($app.name) 未安装（非必需，可稍后手动装）" }
      continue
    }
    if (-not (Install-WithWinget $app.id $app.name) -and $app.required) {
      Write-Err2 "$($app.name) 安装失败，无法继续"
      exit 1
    }
  }

  Update-PathFromRegistry
}

# ------------------------------------------------------------------ 2. 检查 Node

Write-Head '准备运行环境'
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Err2 'node 仍然不可用。请安装 Node.js LTS 后重开终端再跑一次：https://nodejs.org'
  exit 1
}
$nodeVersion = (& node --version)
Write-Ok "Node.js $nodeVersion"

# ------------------------------------------------------------------ 3. 交给跨平台脚本

$forward = @()
if ($Dir)      { $forward += @('--dir', $Dir) }
if ($Vault)    { $forward += @('--vault', $Vault) }
if ($RepoUrl)  { $forward += @('--repo', $RepoUrl) }
if ($GitName)  { $forward += @('--git-name', $GitName) }
if ($GitEmail) { $forward += @('--git-email', $GitEmail) }
if ($DryRun)     { $forward += '--dry-run' }
if ($Force)      { $forward += '--force-plugins' }
if ($WithAssets) { $forward += '--with-assets' }
if ($SkipPlugins){ $forward += '--skip-plugins' }
if ($NoPull)     { $forward += '--no-pull' }
if ($Dev)        { $forward += '--dev' }

$entry = Join-Path $PSScriptRoot 'lib\bootstrap.mjs'
if (-not (Test-Path -LiteralPath $entry)) {
  Write-Err2 "找不到 $entry"
  exit 1
}

& node $entry @forward
$code = $LASTEXITCODE

# ------------------------------------------------------------------ 结束

Write-Host ''
if ($code -eq 0) {
  Write-Host '  全部完成 🎉' -ForegroundColor Green
} else {
  Write-Host "  配置过程中出现问题（退出码 $code）" -ForegroundColor Yellow
  Write-Host '  详见上方日志；如提示网络问题，请检查代理/VPN 后重试。' -ForegroundColor DarkGray
}

if (-not $NoPause -and [string]::IsNullOrWhiteSpace($MyInvocation.Line)) {
  Write-Host ''
  Read-Host '按回车键关闭窗口'
}

exit $code