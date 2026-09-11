#!/usr/bin/env node
// setup/lib/render-docs.mjs
// 把 setup/config/obsidian-plugins.json 渲染成人可读的安装文档
// （docs/Obsidian插件清单.md）。
//
// "脚本自动装"和"人照着装"共用同一份数据源，永远不会对不上。
//
//   node setup/lib/render-docs.mjs [--offline] [--stdout]
//
// 也被 setup/lib/export.mjs 调用（导出清单后自动重新生成文档）。

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  REPO_ROOT,
  c,
  log,
  parseArgs,
  loadProfile,
  loadPluginManifest,
  loadRegistryDetail,
} from './core.mjs';

/** Markdown 表格里 | 和换行会破坏结构 */
function cell(text) {
  if (!text) return '—';
  return String(text).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ').trim();
}

function link(url, label) {
  return url ? `[${label ?? url}](${url})` : '—';
}

function repoUrl(repo) {
  return repo ? `https://github.com/${repo}` : null;
}

/** Obsidian 官方插件页直达链接（换电脑手动装时用来核对 ID） */
function pluginPage(id) {
  return `https://obsidian.md/plugins?id=${encodeURIComponent(id)}`;
}

function formatDate(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * 生成文档。
 * @param {{offline?:boolean, stdout?:boolean}} options
 * @returns {Promise<string>} 生成的 Markdown 全文
 */
export async function renderDocs({ offline = false, stdout = false } = {}) {
  const profile = loadProfile();
  const { file: manifestFile, data, plugins } = loadPluginManifest(profile);

  if (!plugins.length) throw new Error(`插件清单是空的：${manifestFile}`);

  const registry = await loadRegistryDetail({ offline });

  // 把官方索引信息合并进每条记录
  const rows = plugins.map((p) => {
    const reg = registry.get(p.id) ?? {};
    return {
      id: p.id,
      name: p.name || reg.name || p.id,
      searchName: reg.name || p.name || p.id,
      author: reg.author || null,
      description: reg.description || null,
      note: p._note || null,
      repo: p.repo || reg.repo || null,
      version: p.version || null,
      enabled: p.enabled !== false,
      installData: p.installData === true,
      inRegistry: Boolean(reg.repo || p.repo),
    };
  });

  const enabled = rows.filter((r) => r.enabled);
  const disabled = rows.filter((r) => !r.enabled);
  const unresolved = rows.filter((r) => !r.inRegistry);
  const manifestRel = path.relative(REPO_ROOT, manifestFile).split(path.sep).join('/');

  const L = [];
  L.push('# Obsidian 插件清单');
  L.push('');
  L.push('> **本文件由脚本自动生成，请不要手工编辑。**');
  L.push(`> 数据来源：\`${manifestRel}\``);
  L.push('> 重新生成：`npm run setup:docs`（`npm run setup:export` 时也会一并生成）');
  L.push('>');
  L.push(`> 最后生成：${formatDate(new Date())}`);
  L.push('');
  L.push(
    `**共 ${rows.length} 个插件 —— 默认启用 ${enabled.length} 个` +
      (disabled.length ? `，只安装不启用 ${disabled.length} 个` : '') +
      '。**'
  );
  L.push('');
  L.push('换电脑后有两条路，二选一即可：');
  L.push('');
  L.push('| 方式 | 怎么做 | 适合 |');
  L.push('|---|---|---|');
  L.push('| **自动** | 跑 `setup/bootstrap.ps1`（或 `setup/bootstrap.sh`），照本清单把插件装好并启用 | 推荐 |');
  L.push('| **手动** | 打开 Obsidian 的「浏览」页，照下面表格一个个搜索安装 | 脚本跑不通时 |');
  L.push('');

  L.push('## 手动安装步骤');
  L.push('');
  L.push('1. 在 Obsidian 里打开你的 vault（本项目建议直接把仓库目录当 vault）');
  L.push('2. `设置` → `第三方插件` → 关闭「受限模式」(Restricted mode)');
  L.push('3. 点「浏览」(Browse)，按下面表格的 **搜索关键词** 逐个搜索');
  L.push('4. 核对 **插件 ID** 一致后点 `安装` → `启用`');
  L.push('');
  L.push('> 插件名容易撞车。最稳的是点开「官方页面」链接，确认作者和插件 ID 都对得上再装。');
  L.push('');

  L.push('## 插件一览');
  L.push('');
  L.push('| # | 插件 | 搜索关键词 | 插件 ID | 版本 | 启用 |');
  L.push('|---|------|-----------|---------|------|------|');
  rows.forEach((r, i) => {
    const ver = r.version ? `\`${cell(r.version)}\`` : '最新';
    L.push(`| ${i + 1} | ${cell(r.name)} | \`${cell(r.searchName)}\` | \`${cell(r.id)}\` | ${ver} | ${r.enabled ? '✅' : '⬜'} |`);
  });
  L.push('');
  L.push('> `版本 = 最新` 表示不锁版本，安装时取该插件的最新 Release。');
  L.push('');

  L.push('## 逐个说明');
  L.push('');
  rows.forEach((r, i) => {
    L.push(`### ${i + 1}. ${r.name} ${r.enabled ? '✅ 启用' : '⬜ 只安装不启用'}`);
    L.push('');
    L.push(`- **插件 ID**：\`${r.id}\``);
    L.push(`- **搜索关键词**：\`${r.searchName}\`${r.author ? `（作者：${r.author}）` : ''}`);
    L.push(`- **官方页面**：${link(pluginPage(r.id))}`);
    L.push(`- **源码仓库**：${link(repoUrl(r.repo), r.repo ?? undefined)}`);
    L.push(`- **安装版本**：${r.version ? `\`${r.version}\`` : '最新 Release'}`);
    if (r.note) L.push(`- **为什么装它**：${r.note}`);
    if (r.description) L.push(`- **插件自述**：${r.description}`);
    if (!r.inRegistry) {
      L.push('');
      L.push('  > ⚠️ 这个插件不在 Obsidian 官方社区索引里（可能是自建或 BRAT 装的），');
      L.push('  > 自动安装会跳过它。请在清单里给它补上 `repo` 字段，或在新电脑上手动装。');
    }
    if (r.installData) {
      L.push(
        `- **设置同步**：已开启（\`installData: true\`）——新电脑会用仓库里的 \`data.json\` 初始化，**请确认里面没有 Token**`
      );
    }
    L.push('');
  });

  L.push('## 新电脑上需要重新配置的');
  L.push('');
  L.push('下面这些**故意不进仓库**（含密钥或机器专属路径），换电脑后手动重设一次：');
  L.push('');
  L.push('| 插件 | 要重设什么 | 为什么没跟着走 |');
  L.push('|---|---|---|');
  L.push('| Git | GitHub 用户名 + Personal Access Token | Token 存在 `data.json` 里，提交等于泄密 |');
  L.push('| Templater | 模板文件夹路径 | 绝对路径每台电脑不一样 |');
  L.push('| 其他带登录态的插件 | 各自的账号 / API Key | 同上 |');
  L.push('');
  L.push('> 具体位置：`.obsidian/plugins/*/data.json`。本项目的 `.gitignore` 已把它们全部排除。');
  L.push('');

  if (disabled.length) {
    L.push('## 只安装、不启用的插件');
    L.push('');
    for (const r of disabled) L.push(`- **${r.name}**（\`${r.id}\`）${r.note ? ` —— ${r.note}` : ''}`);
    L.push('');
    L.push('脚本会把它们装进 `.obsidian/plugins/`，但不写进启用列表。');
    L.push('想启用：Obsidian `设置` → `第三方插件` → 找到它 → 打开开关。');
    L.push('');
  }

  if (unresolved.length) {
    L.push('## ⚠️ 无法自动安装的插件');
    L.push('');
    L.push('下面这些在 Obsidian 官方索引里查不到仓库地址，自动安装会失败：');
    L.push('');
    for (const r of unresolved) L.push(`- \`${r.id}\``);
    L.push('');
    L.push('解决：编辑清单补上 `repo` 字段（格式 `作者/仓库名`），再重新生成。');
    L.push('');
  }

  L.push('---');
  L.push('');
  L.push('相关文档：[换电脑一键配置教程](换电脑一键配置.md)');
  L.push('');

  const out = `${L.join('\n')}\n`;

  if (stdout) {
    process.stdout.write(out);
    return out;
  }

  const outFile = path.join(REPO_ROOT, 'docs', 'Obsidian插件清单.md');
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, out, 'utf8');

  log.ok(`已生成 ${path.relative(REPO_ROOT, outFile)} ${c.dim(`（${rows.length} 个插件）`)}`);
  if (unresolved.length) log.warn(`${unresolved.length} 个插件不在官方索引里，文档中已标注`);
  if (!data.generatedAt) {
    log.info('  提示：清单目前是手工维护的初始示例，跑 `npm run setup:export` 可换成你真实的清单');
  }
  return out;
}

/* ------------------------------------------------------------------ CLI */

const isEntry =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isEntry) {
  const args = parseArgs(process.argv.slice(2));
  renderDocs({ offline: Boolean(args.offline), stdout: Boolean(args.stdout) }).catch((err) => {
    console.error(`\n  ${c.red('[FAIL]')} ${err.message}`);
    if (process.env.DEBUG) console.error(err.stack);
    process.exit(1);
  });
}