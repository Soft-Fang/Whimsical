#!/usr/bin/env node
// setup/lib/export.mjs
// 采集当前电脑 Obsidian vault 里的插件状态，写进仓库的插件清单。
// 在"配置好的那台电脑"上运行一次并提交，其他电脑就能照着还原。
//
//   node setup/lib/export.mjs [选项]
//
//   --vault <路径>     指定 vault（默认自动探测）
//   --enabled-only     只记录当前启用的插件
//   --with-assets      额外把插件本体快照到 setup/obsidian/plugins/（可离线还原）
//   --dry-run          只打印，不写文件

import fs from 'node:fs';
import path from 'node:path';
import {
  REPO_ROOT,
  SETUP_DIR,
  c,
  log,
  parseArgs,
  readJson,
  writeJson,
  loadProfile,
  loadRegistry,
  resolveVault,
  getRepoState,
  suggestedPushCommand,
} from './core.mjs';
import { renderDocs } from './render-docs.mjs';

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const dryRun = Boolean(args.dryRun);
  const profile = loadProfile();

  console.log('');
  console.log(c.bold('  Whimsical · 采集 Obsidian 插件清单'));
  console.log(c.dim('  ----------------------------------------'));

  /* ---------------------------------------------------- 定位 vault */
  const vault = resolveVault({ profile, explicit: args.vault });
  if (!vault.exists) {
    log.err(`没找到 Obsidian vault：${vault.dir}`);
    log.info('  在该目录下应有 .obsidian 文件夹。请用 --vault "<路径>" 指定。');
    if (vault.knownVaults?.length) {
      log.info('  这台电脑上 Obsidian 记录过的 vault：');
      for (const v of vault.knownVaults.slice(0, 8)) log.info(`    ${v}`);
    }
    process.exit(1);
  }
  log.ok(`vault：${vault.dir} ${c.dim(`（来自 ${vault.from}）`)}`);

  const obsidianDir = path.join(vault.dir, '.obsidian');
  const pluginsDir = path.join(obsidianDir, 'plugins');

  /* ---------------------------------------------------- 读当前状态 */
  const enabledList = readJson(path.join(obsidianDir, 'community-plugins.json'), []);
  const enabled = new Set(Array.isArray(enabledList) ? enabledList : []);

  if (!fs.existsSync(pluginsDir)) {
    log.err(`vault 下没有 plugins 目录：${pluginsDir}`);
    log.info('  说明这个 vault 还没装过任何社区插件。');
    process.exit(1);
  }

  const installed = [];
  for (const name of fs.readdirSync(pluginsDir)) {
    const dir = path.join(pluginsDir, name);
    if (!fs.statSync(dir).isDirectory()) continue;
    const manifest = readJson(path.join(dir, 'manifest.json'), null);
    if (!manifest?.id) {
      log.warn(`跳过 ${name}：没有有效的 manifest.json`);
      continue;
    }
    installed.push({
      id: manifest.id,
      name: manifest.name ?? manifest.id,
      version: manifest.version ?? null,
      author: manifest.author ?? null,
      minAppVersion: manifest.minAppVersion ?? null,
      enabled: enabled.has(manifest.id),
      dir,
      hasData: fs.existsSync(path.join(dir, 'data.json')),
    });
  }

  installed.sort((a, b) => a.id.localeCompare(b.id));

  let chosen = installed;
  if (args.enabledOnly) {
    chosen = installed.filter((p) => p.enabled);
    log.info(`只记录启用的插件（${chosen.length}/${installed.length}）`);
  }

  if (!chosen.length) {
    log.err('没有可记录的有效插件。');
    process.exit(1);
  }

  /* ---------------------------------------------------- 解析仓库地址 */
  log.info('解析插件仓库地址（id → GitHub repo）…');
  const registry = await loadRegistry({ offline: Boolean(args.offline) });

  const entries = [];
  const unresolved = [];
  for (const p of chosen) {
    const repo = registry.get(p.id) ?? null;
    if (!repo) unresolved.push(p.id);
    entries.push({
      id: p.id,
      name: p.name,
      repo,
      version: p.version,
      enabled: p.enabled,
      ...(p.hasData ? { installData: false } : {}),
    });
  }

  /* ---------------------------------------------------- 写清单 */
  const outFile = path.resolve(REPO_ROOT, profile.obsidian?.pluginsManifest ?? 'setup/config/obsidian-plugins.json');
  const payload = {
    _comment:
      'Obsidian 插件清单。由 `npm run setup:export` 自动生成，请提交到仓库；其他电脑用 `npm run setup` 照此还原。version 为 null 表示装最新版。',
    generatedAt: new Date().toISOString(),
    generatedFrom: vault.dir,
    count: entries.length,
    plugins: entries,
  };

  if (dryRun) {
    log.info('');
    log.info(`${c.dim('→')} 将写入 ${outFile}`);
    log.raw(JSON.stringify(payload, null, 2));
  } else {
    writeJson(outFile, payload);
    log.ok(`已写入 ${outFile} ${c.dim(`（${entries.length} 个插件）`)}`);
  }

  if (unresolved.length) {
    log.warn(`${unresolved.length} 个插件没能在官方索引里找到 repo，需要手动补：`);
    for (const id of unresolved) log.info(`    ${id}`);
    log.info('  手动补法：编辑清单，在该插件条目里加 "repo": "作者/仓库名"');
  }

  // 同步刷新人可读的安装文档，保证「清单」和「文档」永远一致
  if (!dryRun) {
    log.info('');
    log.info(`${c.dim('→')} 同步生成安装文档…`);
    try {
      await renderDocs({ offline: Boolean(args.offline) });
    } catch (err) {
      log.warn(`安装文档生成失败（不影响清单本身）：${err.message}`);
    }
  }

  /* ---------------------------------------------------- 离线快照 */
  if (args.withAssets) {
    const dest = path.resolve(REPO_ROOT, profile.obsidian?.offlineAssetsDir ?? 'setup/obsidian/plugins');
    log.info('');
    log.info(`快照插件文件 → ${dest}`);
    let copied = 0;
    for (const p of chosen) {
      const target = path.join(dest, p.id);
      if (dryRun) {
        log.info(`    ${c.dim('→')} ${p.id}`);
        continue;
      }
      fs.mkdirSync(target, { recursive: true });
      for (const f of ['main.js', 'manifest.json', 'styles.css']) {
        const src = path.join(p.dir, f);
        if (fs.existsSync(src)) {
          fs.copyFileSync(src, path.join(target, f));
          copied++;
        }
      }
    }
    if (!dryRun) log.ok(`已快照 ${copied} 个文件（提交后可完全离线还原）`);
  }

  /* ---------------------------------------------------- 汇总 */
  console.log('');
  console.log(c.dim('  ----------------------------------------'));
  log.ok(`共 ${entries.length} 个插件，其中启用 ${entries.filter((e) => e.enabled).length} 个`);
  log.info('');
  const state = getRepoState();
  const pushCmd = suggestedPushCommand(state);
  const addTargets = [
    path.relative(REPO_ROOT, outFile).split(path.sep).join('/'),
    'docs/Obsidian插件清单.md',
    ...(args.withAssets ? [profile.obsidian?.offlineAssetsDir ?? 'setup/obsidian/plugins'] : []),
  ];

  log.info('检查无误后提交：');
  log.info(`    ${c.bold(`git add ${addTargets.join(' ')}`)}`);
  log.info(`    ${c.bold('git commit -m "chore: 更新 Obsidian 插件清单"')}`);

  if (!state.remotes.length) {
    log.warn('这个仓库还没有配置远端（git remote），先加一个再推：');
    log.info(`    ${c.bold('git remote add origin <你的仓库地址>')}`);
    log.info(`    ${c.bold(`git push -u origin ${state.branch ?? 'main'}`)}`);
  } else if (pushCmd) {
    log.info(`    ${c.bold(pushCmd)}`);
    if (!state.hasUpstream) {
      log.info('');
      log.info(
        `  ${c.yellow('注意')}：当前分支 ${c.bold(state.branch ?? '?')} 还没推送过，所以要带 ${c.bold('-u')} 建立上游跟踪。`
      );
      log.info('  直接用 `git push` 会报 "has no upstream branch"。第一次之后就不用再带 -u 了。');
    }
  }
  console.log('');
}

main().catch((err) => {
  console.error('');
  console.error(`  ${c.red('[FAIL]')} ${err.message}`);
  if (process.env.DEBUG) console.error(err.stack);
  process.exit(1);
});