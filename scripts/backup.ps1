<#
  备份「不随 git 同步」的本地内容。
  这些文件在 .gitignore 里，换电脑 / 重装系统都不会自动带过去。

  用法：
    powershell -ExecutionPolicy Bypass -File scripts/backup.ps1
    powershell -ExecutionPolicy Bypass -File scripts/backup.ps1 -OutDir "E:\Backup\Whimsical"
#>
param(
  [string]$OutDir = "$HOME\Whimsical-Backup"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$stage = Join-Path $env:TEMP "whimsical-backup-$stamp"
$dest = Join-Path $OutDir "whimsical-backup-$stamp.zip"

# 需要备份的「本地独有」内容（相对于仓库根目录）
$targets = @(
  "content/private",
  "content/study",
  ".obsidian",
  ".env",
  "维护教程.md",
  "content/仪表盘.md",
  "Excalidraw"
)

New-Item -ItemType Directory -Path $stage -Force | Out-Null
New-Item -ItemType Directory -Path $OutDir -Force | Out-Null

$count = 0
foreach ($rel in $targets) {
  $src = Join-Path $root $rel
  if (-not (Test-Path -LiteralPath $src)) { continue }
  $dst = Join-Path $stage $rel
  $parent = Split-Path -Parent $dst
  if ($parent) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
  if ((Get-Item -LiteralPath $src).PSIsContainer) {
    Copy-Item -LiteralPath $src -Destination $dst -Recurse -Force
  } else {
    Copy-Item -LiteralPath $src -Destination $dst -Force
  }
  $count++
  Write-Host "  + $rel"
}

if ($count -eq 0) {
  Write-Host "没有找到需要备份的本地内容（可能都还没创建）。"
  Remove-Item -LiteralPath $stage -Recurse -Force
  exit 0
}

Compress-Archive -Path (Join-Path $stage "*") -DestinationPath $dest -Force
Remove-Item -LiteralPath $stage -Recurse -Force

$size = [Math]::Round((Get-Item -LiteralPath $dest).Length / 1KB, 1)
Write-Host ""
Write-Host "备份完成：$dest  ($size KB, 共 $count 项)"
Write-Host "建议把该文件同步到网盘 / 另一台电脑。"