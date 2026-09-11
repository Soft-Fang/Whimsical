// setup/lib/core.mjs
// 跨平台核心逻辑：配置读取、vault 探测、插件清单解析与安装、进程调用。
// 被 bootstrap.mjs / export.mjs 共用。

import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

/* ------------------------------------------------------------------ 路径 */

export const REPO_ROOT = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));
export const SETUP_DIR = path.join(REPO_ROOT, 'setup');
export const CACHE_DIR = path.join(SETUP_DIR, '.cache');

/** Obsidian 社区插件官方索引：id -> repo */
const REGISTRY_URL =
  'https://raw.githubusercontent.com/obsidianmd/obsidian-releases/master/community-plugins.json';

/* ------------------------------------------------------------------ 日志 */

const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code) => (s) => (useColor ? `\u001b[${code}m${s}\u001b[0m` : s);

export const c = {
  dim: paint('2'),
  red: paint('31'),
  green: paint('32'),
  yellow: paint('33'),
  blue: paint('36'),
  bold: paint('1'),
};

export const log = {
  step: (m) => console.log(`\n${c.blue('==>')} ${c.bold(m)}`),
  info: (m) => console.log(`    ${m}`),
  ok: (m) => console.log(`  ${c.green('[ OK ]')} ${m}`),
  skip: (m) => console.log(`  ${c.dim('[SKIP]')} ${m}`),
  warn: (m) => console.log(`  ${c.yellow('[WARN]')} ${m}`),
  err: (m) => console.log(`  ${c.red('[FAIL]')} ${m}`),
  raw: (m) => console.log(m),
};

/* ------------------------------------------------------------------ 参数 */

/**
 * 极简参数解析：--key value / --flag / -k
 */
export function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const [k, inline] = a.slice(2).split('=');
      const key = k.replace(/-([a-z])/g, (_, ch) => ch.toUpperCase());
      if (inline !== undefined) out[key] = inline;
      else if (argv[i + 1] && !argv[i + 1].startsWith('-')) out[key] = argv[++i];
      else out[key] = true;
    } else {
      out._.push(a);
    }
  }
  return out;
}

/* ------------------------------------------------------------------ 进程 */

export const isWindows = process.platform === 'win32';

/**
 * Windows 上给 cmd.exe 用的引号处理。
 * 只需要处理"含空格/元字符"的参数；cmd 会把普通参数原样传递。
 */
function quoteForCmd(arg) {
  if (arg === '') return '""';
  if (!/[\s&|<>^()]/.test(arg)) return arg;
  return `"${arg}"`;
}

/**
 * 执行命令。dryRun 时只打印不执行。
 *
 * Windows 说明：npm / npx / yarn 实际是 .cmd 文件，用 spawn(shell:false) 会
 * 报 ENOENT/EINVAL；而 `shell:true` + args 数组又会被 Node 二次转义（DEP0190，
 * 且带空格的参数会碎掉）。实测可行且无警告的写法是把整条命令拼成一个字符串、
 * args 传空数组，交给 cmd.exe。Linux/macOS 走正常的 argv 直传，无需任何引号处理。
 *
 * @returns {{ok:boolean, stdout:string, status:number|null}}
 */
export function run(cmd, args = [], { cwd = REPO_ROOT, dryRun = false, allowFail = false, quiet = false, env } = {}) {
  const printable = [cmd, ...args]
    .map((s) => (/\s/.test(s) ? JSON.stringify(s) : s))
    .join(' ');
  if (dryRun) {
    log.info(`${c.dim('$')} ${printable}`);
    return { ok: true, stdout: '', status: 0 };
  }
  if (!quiet) log.info(`${c.dim('$')} ${printable}`);

  const file = isWindows ? [cmd, ...args].map(quoteForCmd).join(' ') : cmd;
  const argv = isWindows ? [] : args;

  const res = spawnSync(file, argv, {
    cwd,
    encoding: 'utf8',
    shell: isWindows,
    stdio: quiet ? 'pipe' : ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, ...env },
  });
  const stdout = `${res.stdout ?? ''}${res.stderr ?? ''}`.trim();
  const ok = res.status === 0;
  if (!ok && !allowFail) {
    log.err(`命令失败（退出码 ${res.status}）：${printable}`);
    if (stdout) log.raw(stdout.split('\n').slice(-15).join('\n'));
  } else if (!ok && allowFail && !quiet) {
    log.warn(`命令未成功（已忽略）：${printable}`);
  }
  return { ok, stdout, status: res.status };
}

/**
 * 看一眼当前仓库的状态，用来给出"正确的下一步命令"。
 * 典型的坑：本地新建的分支还没推过，直接 `git push` 会因为"没有上游分支"而失败。
 */
export function getRepoState({ cwd = REPO_ROOT } = {}) {
  const q = (args) => run('git', args, { cwd, quiet: true, allowFail: true });
  const branchRes = q(['rev-parse', '--abbrev-ref', 'HEAD']);
  const upstreamRes = q(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']);
  const remoteRes = q(['remote']);
  return {
    branch: branchRes.ok ? branchRes.stdout.trim() : null,
    hasCommits: q(['rev-parse', '--verify', 'HEAD']).ok,
    hasUpstream: upstreamRes.ok,
    upstream: upstreamRes.ok ? upstreamRes.stdout.trim() : null,
    remotes: remoteRes.ok ? remoteRes.stdout.split('\n').map((s) => s.trim()).filter(Boolean) : [],
  };
}

/** 按仓库当前状态给出一条能用的推送命令。 */
export function suggestedPushCommand(state) {
  if (!state?.remotes?.length) return null;
  const remote = state.remotes.includes('origin') ? 'origin' : state.remotes[0];
  if (state.hasUpstream) return 'git push';
  return `git push -u ${remote} ${state.branch || 'main'}`;
}

/** 命令是否可用 */
export function hasCommand(cmd) {
  const probe = isWindows ? 'where' : 'which';
  const res = spawnSync(probe, [cmd], { stdio: 'ignore', shell: false });
  return res.status === 0;
}

/** 后台启动一个长驻进程（npm run dev），不阻塞。 */
export function startDetached(cmd, args, { cwd = REPO_ROOT } = {}) {
  const child = spawn(cmd, args, { cwd, detached: true, stdio: 'ignore', shell: isWindows });
  child.unref();
  return child;
}

/* ------------------------------------------------------------------ JSON */

/**
 * 读 JSON。文件不存在 / 没有读取权限时返回 fallback（不抛异常）——
 * 因为很多调用点读的是"尽力而为"的第三方配置文件（比如 Obsidian 全局配置）。
 * 但文件存在且格式错误时会明确报错，避免把配置写坏。
 */
export function readJson(file, fallback = null) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT' || err.code === 'EACCES' || err.code === 'EPERM') return fallback;
    throw err;
  }
  try {
    return JSON.parse(text.replace(/^\uFEFF/, ''));
  } catch (err) {
    throw new Error(`解析 JSON 失败：${file}\n${err.message}`);
  }
}

export function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

/* ------------------------------------------------------------------ HTTP */

function headers(extra = {}) {
  const h = { 'User-Agent': 'whimsical-setup', Accept: '*/*', ...extra };
  if (process.env.GITHUB_TOKEN) h.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return h;
}

/**
 * 下载并返回内容。optional=true 时 404 / 网络错误返回 null 而不抛异常。
 * @returns {Promise<Buffer|null>}
 */
export async function fetchBuffer(url, { optional = false, timeout = 30000, retries = 1 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeout);
    try {
      const res = await fetch(url, { redirect: 'follow', headers: headers(), signal: ctrl.signal });
      if (!res.ok) {
        if (optional) return null;
        throw new Error(`HTTP ${res.status} ${res.statusText} — ${url}`);
      }
      return Buffer.from(await res.arrayBuffer());
    } catch (err) {
      lastErr = err;
      if (optional) return null;
      if (attempt === retries) break;
      await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr;
}

export async function fetchText(url, opts) {
  const buf = await fetchBuffer(url, opts);
  return buf ? buf.toString('utf8') : null;
}

export async function fetchJson(url, opts) {
  const text = await fetchText(url, opts);
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ 配置 */

export function loadProfile() {
  const file = path.join(SETUP_DIR, 'config', 'profile.json');
  const profile = readJson(file);
  if (!profile) throw new Error(`找不到或无法读取配置文件：${file}`);
  return profile;
}

export function loadPluginManifest(profile) {
  const rel = profile?.obsidian?.pluginsManifest ?? 'setup/config/obsidian-plugins.json';
  const file = path.isAbsolute(rel) ? rel : path.join(REPO_ROOT, rel);
  const data = readJson(file, { plugins: [] });
  return { file, data, plugins: Array.isArray(data.plugins) ? data.plugins : [] };
}

/* ------------------------------------------------------------------ 插件索引 */

/** 缓存格式版本。改了条目结构就 +1，让老缓存自动失效重新拉取。 */
const REGISTRY_CACHE_FORMAT = 2;

/** 兼容新旧两种缓存格式：老版本存的是 "id": "owner/repo" 字符串。 */
function normalizeRegistryEntry(value) {
  if (typeof value === 'string') return { repo: value, name: null, author: null, description: null };
  return value ?? { repo: null, name: null, author: null, description: null };
}

/**
 * 拉取社区插件索引的完整信息（id -> {repo, name, author, description}），带本地缓存。
 * 网络不可用时退化为本地缓存 / 空索引。
 * @returns {Promise<Map<string,{repo:string|null,name:string|null,author:string|null,description:string|null}>>}
 */
export async function loadRegistryDetail({ maxAgeDays = 7, offline = false } = {}) {
  const cacheFile = path.join(CACHE_DIR, 'community-plugins.json');
  const cached = readJson(cacheFile, null);
  const fresh =
    cached?.fetchedAt &&
    cached?.format === REGISTRY_CACHE_FORMAT &&
    Date.now() - cached.fetchedAt < maxAgeDays * 864e5;

  if (!fresh && !offline) {
    try {
      const list = await fetchJson(REGISTRY_URL, { timeout: 20000 });
      if (!Array.isArray(list)) throw new Error('索引格式异常');
      const map = {};
      for (const item of list) {
        if (!item?.id) continue;
        map[item.id] = {
          repo: item.repo ?? null,
          name: item.name ?? null,
          author: item.author ?? null,
          description: item.description ?? null,
        };
      }
      writeJson(cacheFile, {
        format: REGISTRY_CACHE_FORMAT,
        fetchedAt: Date.now(),
        count: Object.keys(map).length,
        map,
      });
      return new Map(Object.entries(map));
    } catch (err) {
      if (!cached?.map) {
        log.warn(`插件索引拉取失败，且无本地缓存：${err.message}`);
        return new Map();
      }
      log.warn(`插件索引拉取失败，改用本地缓存（${Object.keys(cached.map).length} 条）：${err.message}`);
    }
  }

  const out = new Map();
  for (const [id, value] of Object.entries(cached?.map ?? {})) out.set(id, normalizeRegistryEntry(value));
  return out;
}

/**
 * 只要 id -> repo 的精简视图（安装插件用）。
 * @returns {Promise<Map<string,string>>}
 */
export async function loadRegistry(opts) {
  const detail = await loadRegistryDetail(opts);
  const out = new Map();
  for (const [id, v] of detail) if (v?.repo) out.set(id, v.repo);
  return out;
}

/* ------------------------------------------------------------------ Obsidian vault */

/**
 * 找出 Obsidian vault 目录（约定：目录下含 .obsidian 文件夹）。
 * 顺序：命令行参数 > 配置 > 仓库自身 > Obsidian 全局注册表里最近打开的。
 */
export function resolveVault({ profile, explicit, baseDir = REPO_ROOT } = {}) {
  const base = path.resolve(baseDir);
  const candidates = [];

  if (explicit && explicit !== 'auto') candidates.push({ dir: path.resolve(explicit), from: '命令行 --vault' });

  const configured = profile?.obsidian?.vaultPath;
  if (configured && configured !== 'auto') {
    candidates.push({ dir: path.resolve(base, configured), from: 'profile.json → obsidian.vaultPath' });
  }

  if (profile?.obsidian?.vaultMode !== 'external') {
    candidates.push({ dir: base, from: '仓库根目录（vaultMode=repo）' });
  }

  for (const cand of candidates) {
    if (fs.existsSync(path.join(cand.dir, '.obsidian'))) return { ...cand, exists: true };
  }

  // 兜底：读 Obsidian 自己的 vault 注册表，给出提示
  const known = readObsidianVaultList();
  const first = candidates[0]?.dir ?? base;
  return {
    dir: first,
    from: candidates[0]?.from ?? '默认',
    exists: false,
    knownVaults: known,
  };
}

/** 读取 Obsidian 全局配置中的 vault 列表（只读，尽力而为）。 */
export function readObsidianVaultList() {
  const appData =
    process.platform === 'win32'
      ? process.env.APPDATA
      : process.platform === 'darwin'
        ? path.join(os.homedir(), 'Library', 'Application Support')
        : path.join(os.homedir(), '.config');
  const file = path.join(appData ?? '', 'obsidian', 'obsidian.json');
  const cfg = readJson(file, null);
  if (!cfg?.vaults) return [];
  return Object.values(cfg.vaults)
    .filter((v) => v?.path)
    .sort((a, b) => (b.ts ?? 0) - (a.ts ?? 0))
    .map((v) => v.path);
}

/* ------------------------------------------------------------------ 插件安装 */

function releaseBase(repo, ref) {
  return ref
    ? `https://github.com/${repo}/releases/download/${ref}`
    : `https://github.com/${repo}/releases/latest/download`;
}

function rawBase(repo, ref) {
  return `https://raw.githubusercontent.com/${repo}/${ref || 'HEAD'}`;
}

/**
 * 下载一个插件的文件。优先 Release 资产（插件作者普遍把 main.js 挂在 Release 上），
 * 找不到再退回仓库源码。
 * @returns {Promise<{main:Buffer, manifest:object|null, styles:Buffer|null, from:string}|null>}
 */
async function fetchPluginBundle(repo, version) {
  const refs = version ? [version, `v${version}`] : [null];

  for (const ref of refs) {
    const base = releaseBase(repo, ref);
    const main = await fetchBuffer(`${base}/main.js`, { optional: true });
    if (!main) continue;
    const manifestText = await fetchText(`${base}/manifest.json`, { optional: true });
    const styles = await fetchBuffer(`${base}/styles.css`, { optional: true });
    let manifest = null;
    if (manifestText) {
      try {
        manifest = JSON.parse(manifestText);
      } catch {
        /* 忽略，后面回退 */
      }
    }
    if (!manifest) {
      const t = await fetchText(`${rawBase(repo, ref ?? 'HEAD')}/manifest.json`, { optional: true });
      if (t) {
        try {
          manifest = JSON.parse(t);
        } catch {
          /* ignore */
        }
      }
    }
    return { main, manifest, styles, from: base };
  }

  // 回退：源码仓库里直接带了构建产物
  for (const ref of refs) {
    const base = rawBase(repo, ref ?? 'HEAD');
    const main = await fetchBuffer(`${base}/main.js`, { optional: true });
    if (!main) continue;
    const manifestText = await fetchText(`${base}/manifest.json`, { optional: true });
    const styles = await fetchBuffer(`${base}/styles.css`, { optional: true });
    let manifest = null;
    if (manifestText) {
      try {
        manifest = JSON.parse(manifestText);
      } catch {
        /* ignore */
      }
    }
    return { main, manifest, styles, from: base };
  }

  return null;
}

/**
 * 把清单里的插件安装到 vault。
 * @returns {Promise<{installed:string[], skipped:string[], failed:Array<{id:string,reason:string}>}>}
 */
export async function installPlugins({ vaultPath, plugins, registry, dryRun = false, force = false, offlineDir = null }) {
  const pluginsDir = path.join(vaultPath, '.obsidian', 'plugins');
  const result = { installed: [], skipped: [], failed: [] };

  if (!dryRun) fs.mkdirSync(pluginsDir, { recursive: true });

  for (const entry of plugins) {
    const id = entry.id;
    if (!id) continue;

    const repo = entry.repo || registry.get(id);
    if (!repo) {
      result.failed.push({ id, reason: '无法确定仓库地址（索引里没有，清单里也没写 repo）' });
      log.err(`${id} — 无法确定仓库地址，请在该插件的清单条目里补 "repo" 字段`);
      continue;
    }

    const target = path.join(pluginsDir, id);
    const installedManifest = readJson(path.join(target, 'manifest.json'), null);
    const wantVersion = entry.version ?? null;

    if (!force && installedManifest && fs.existsSync(path.join(target, 'main.js'))) {
      if (!wantVersion || installedManifest.version === wantVersion) {
        result.skipped.push(id);
        log.skip(`${id} ${c.dim(`v${installedManifest.version ?? '?'}（已存在）`)}`);
        await maybeInstallDataJson({ entry, target, offlineDir, dryRun });
        continue;
      }
    }

    if (dryRun) {
      log.info(`    ${c.dim('→')} ${id} ${wantVersion ? `v${wantVersion}` : 'latest'} ← ${repo}`);
      result.installed.push(id);
      continue;
    }

    // 1) 先用仓库内离线快照（如果导出时带了 --with-assets）
    const offline = offlineDir ? path.join(offlineDir, id) : null;
    if (offline && fs.existsSync(path.join(offline, 'main.js'))) {
      fs.mkdirSync(target, { recursive: true });
      copyInto(offline, target, ['main.js', 'manifest.json', 'styles.css']);
      const dataCopied = await maybeInstallDataJson({ entry, target, offlineDir, dryRun });
      result.installed.push(id);
      log.ok(`${id} ${c.dim('（来自仓库内离线快照）')}${dataCopied ? ' + data.json' : ''}`);
      continue;
    }

    // 2) 联网下载
    let bundle = null;
    try {
      bundle = await fetchPluginBundle(repo, wantVersion);
    } catch (err) {
      bundle = null;
      log.warn(`${id} 下载异常：${err.message}`);
    }

    if (!bundle) {
      result.failed.push({ id, reason: `下载失败（${repo}）` });
      log.err(`${id} — 下载失败，请检查网络或该插件版本 ${wantVersion ?? 'latest'}`);
      continue;
    }

    fs.mkdirSync(target, { recursive: true });
    fs.writeFileSync(path.join(target, 'main.js'), bundle.main);
    if (bundle.manifest) {
      writeJson(path.join(target, 'manifest.json'), bundle.manifest);
    } else {
      log.warn(`${id} — 缺少 manifest.json，Obsidian 可能无法加载该插件`);
    }
    if (bundle.styles) fs.writeFileSync(path.join(target, 'styles.css'), bundle.styles);

    const dataCopied = await maybeInstallDataJson({ entry, target, offlineDir, dryRun });

    const got = bundle.manifest?.version ?? wantVersion ?? 'latest';
    result.installed.push(id);
    log.ok(`${id} ${c.dim(`v${got}`)}${dataCopied ? ' + data.json' : ''}`);
  }

  return result;
}

/** 按配置决定是否恢复 data.json（默认不覆盖，避免把 token 带进仓库 / 覆盖本机设置）。 */
async function maybeInstallDataJson({ entry, target, offlineDir, dryRun }) {
  const dataFile = path.join(target, 'data.json');
  if (fs.existsSync(dataFile)) return false;
  if (entry.installData !== true) return false;
  const source = offlineDir ? path.join(offlineDir, entry.id, 'data.json') : null;
  if (!source || !fs.existsSync(source) || dryRun) return false;
  fs.copyFileSync(source, dataFile);
  return true;
}

function copyInto(fromDir, toDir, files) {
  for (const f of files) {
    const src = path.join(fromDir, f);
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(toDir, f));
  }
}

/**
 * 把插件写进 vault 的 community-plugins.json（这个文件决定"哪些插件是启用的"）。
 * 保留用户已有、但不在我们清单里的插件。
 */
export function enablePlugins({ vaultPath, ids, dryRun = false }) {
  const file = path.join(vaultPath, '.obsidian', 'community-plugins.json');
  const current = readJson(file, []);
  const list = Array.isArray(current) ? current : [];
  const merged = [...new Set([...list, ...ids])].sort();
  const added = merged.filter((x) => !list.includes(x));

  if (dryRun) {
    if (added.length) log.info(`    ${c.dim('→')} 启用插件：${added.join(', ')}`);
    return { added, enabled: merged };
  }
  writeJson(file, merged);
  return { added, enabled: merged };
}