#!/usr/bin/env bash
# setup/bootstrap.sh
# Whimsical 博客 · macOS / Linux 一键环境配置。
#
# 自动检查并安装 Git / Node.js / Obsidian，然后把剩余工作交给跨平台脚本
# setup/lib/bootstrap.mjs（同步仓库、装依赖、还原 Obsidian 插件）。
#
#   bash setup/bootstrap.sh
#   bash setup/bootstrap.sh --vault ~/MyVault --force-plugins
#   bash setup/bootstrap.sh --dry-run

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# ------------------------------------------------------------------ 输出

if [ -t 1 ] && [ -z "${NO_COLOR:-}" ]; then
  BOLD=$'\033[1m'; DIM=$'\033[2m'; RED=$'\033[31m'
  GREEN=$'\033[32m'; YELLOW=$'\033[33m'; CYAN=$'\033[36m'; RESET=$'\033[0m'
else
  BOLD=""; DIM=""; RED=""; GREEN=""; YELLOW=""; CYAN=""; RESET=""
fi

head()  { printf '\n%s==>%s %s%s%s\n' "$CYAN" "$RESET" "$BOLD" "$1" "$RESET"; }
ok()    { printf '  %s[ OK ]%s %s\n' "$GREEN" "$RESET" "$1"; }
skip()  { printf '  %s[SKIP]%s %s\n' "$DIM" "$RESET" "$1"; }
warn()  { printf '  %s[WARN]%s %s\n' "$YELLOW" "$RESET" "$1"; }
err()   { printf '  %s[FAIL]%s %s\n' "$RED" "$RESET" "$1"; }

# ------------------------------------------------------------------ 参数

DID_ASK=false
PASSTHROUGH=()
for arg in "$@"; do
  case "$arg" in
    --skip-apps)   SKIP_APPS=true ;;
    --no-pause)    NO_PAUSE=true ;;
    *)             PASSTHROUGH+=("$arg") ;;
  esac
done
SKIP_APPS="${SKIP_APPS:-false}"
NO_PAUSE="${NO_PAUSE:-false}"

DRY_RUN=false
for arg in "${PASSTHROUGH[@]:-}"; do
  [ "$arg" = "--dry-run" ] && DRY_RUN=true
done

# ------------------------------------------------------------------ 环境探测

OS="$(uname -s)"
case "$OS" in
  Darwin) PLATFORM="macos" ;;
  Linux)  PLATFORM="linux" ;;
  *)      err "不支持的系统：$OS"; exit 1 ;;
esac

PKG=""
if [ "$PLATFORM" = "macos" ]; then
  command -v brew >/dev/null 2>&1 && PKG="brew"
elif command -v brew >/dev/null 2>&1; then PKG="brew"
elif command -v apt-get >/dev/null 2>&1; then PKG="apt"
elif command -v dnf >/dev/null 2>&1; then PKG="dnf"
elif command -v pacman >/dev/null 2>&1; then PKG="pacman"
fi

run_maybe() {
  if [ "$DRY_RUN" = true ]; then printf '    %s$ %s%s\n' "$DIM" "$*" "$RESET"; return 0; fi
  "$@"
}

have() { command -v "$1" >/dev/null 2>&1; }

install_pkg() {
  # $1 = 逻辑名, $2 = brew 包名, $3 = apt 包名
  local name="$1" brewname="$2" aptname="$3"
  case "$PKG" in
    brew)   run_maybe brew install "$brewname" || return 1 ;;
    apt)    run_maybe sudo apt-get update -qq && run_maybe sudo apt-get install -y "$aptname" || return 1 ;;
    dnf)    run_maybe sudo dnf install -y "$aptname" || return 1 ;;
    pacman) run_maybe sudo pacman -S --noconfirm "$aptname" || return 1 ;;
    *)      return 1 ;;
  esac
}

# ------------------------------------------------------------------ 开始

printf '\n%s  Whimsical 博客 · %s 一键环境配置%s\n' "$BOLD" "$PLATFORM" "$RESET"
printf '%s  ----------------------------------------%s\n' "$DIM" "$RESET"
printf '  仓库目录：%s\n' "$REPO_ROOT"
[ "$DRY_RUN" = true ] && printf '  %sDRY-RUN 模式：只显示将要做的事%s\n' "$YELLOW" "$RESET"

# ------------------------------------------------------------------ 1. 软件

if [ "$SKIP_APPS" != true ]; then
  head "检查并安装所需软件"

  if ! have git; then
    warn "Git 未安装，尝试安装…"
    install_pkg git git git || { err "Git 安装失败，请手动安装后重试"; exit 1; }
  fi
  have git && ok "Git $(git --version | awk '{print $3}')" || { err "Git 仍不可用"; exit 1; }

  if ! have node; then
    warn "Node.js 未安装，尝试安装…"
    if [ "$PKG" = "brew" ]; then install_pkg node node node || true
    else install_pkg node nodejs nodejs || true; fi
  fi

  if ! have node; then
    err "Node.js 仍不可用。"
    if [ "$PKG" = "brew" ]; then
      printf '    请先装 Homebrew：https://brew.sh  然后 brew install node\n'
    else
      printf '    推荐用 nvm 安装 LTS：https://github.com/nvm-sh/nvm\n'
    fi
    exit 1
  fi
  ok "Node.js $(node --version)"

  if [ "$PLATFORM" = "macos" ]; then
    if [ -d "/Applications/Obsidian.app" ]; then skip "Obsidian 已安装"
    elif [ "$PKG" = "brew" ]; then
      warn "Obsidian 未安装，尝试安装…"; install_pkg obsidian obsidian-cask obsidian || warn "Obsidian 安装失败，请到 https://obsidian.md/download 手动安装"
    else warn "Obsidian 未安装，请到 https://obsidian.md/download 手动安装"; fi
  else
    if have obsidian; then skip "Obsidian 已安装"
    else warn "Obsidian（Linux 版）请到 https://obsidian.md/download 手动安装，或用发行版包管理器安装"
    fi
  fi
fi

# ------------------------------------------------------------------ 2. 交给跨平台脚本

head "准备运行环境"
ok "Node.js $(node --version)"

ENTRY="$REPO_ROOT/setup/lib/bootstrap.mjs"
[ -f "$ENTRY" ] || { err "找不到 $ENTRY"; exit 1; }

set +e
node "$ENTRY" ${PASSTHROUGH[@]+"${PASSTHROUGH[@]}"}
CODE=$?
set -e

printf '\n'
if [ "$CODE" -eq 0 ]; then
  printf '  %s全部完成 🎉%s\n' "$GREEN" "$RESET"
else
  printf '  %s配置过程中出现问题（退出码 %s）%s\n' "$YELLOW" "$CODE" "$RESET"
  printf '  %s详见上方日志；如提示网络问题，请检查代理/VPN 后重试。%s\n' "$DIM" "$RESET"
fi

exit "$CODE"