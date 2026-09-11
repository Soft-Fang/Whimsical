#!/usr/bin/env node
// setup/lib/bootstrap.mjs
// 一键配置：同步仓库 → 装依赖 → 还原 Obsidian 插件 → 配置 Git 身份。
//
//   node setup/lib/bootstrap.mjs [选项]
//
// 常用：
//   --dir <路径>      仓库落到哪里（默认当前仓库）
//   --vault <路径>    Obsidian vault 路径（默认仓库自身）
//   --repo <url>      覆盖 profile.json 里的仓库地址
//   --dry-run         只打印将要做什么
//   --force-plugins   忽略已装版本，强制重装插件
//   --with-assets     同时把插件文件快照进仓库（离线可用）
//   --no-pull         不执行 git pull
//   --dev             配置完成后启动 npm run dev

import fs from 'node:fs';
import path from 'node:path';
import {
  REPO_ROOT,
  SETUP_DIR,
  c,
  log,
  parseArgs,
  run,
  hasCommand,
  readJson,
  writeJson,
  loadProfile,
  loadPluginManifest,
  loadRegistry,
  resolveVault,
  installPlugins,
  enablePlugins,
  isWindows,
} from './core.mjs';

const GITIGNORE_MARKER = '# >>> whimsical-setup >>>';

/**
 * 生成要追加到 .gitignore 的规则块。
 *
 * 有的仓库已经整体忽略了 .obsidian/（很常见），这时候再逐条列 .obsidian/xxx
 * 就是废话，反而让人看不懂。所以这里先探测一下，按实际情况生成。
 */
function buildGitignoreBlock(targetDir) {
  const lines = ['', GITIGNORE_MARKER];
  const obsidianWholeIgnored = gitIgnored(targetDir, '.obsidian/__probe__');

  if (obsidianWholeIgnored) {
    lines.push('# .obsidian/ 已被上面的规则整体忽略，这里只补插件索引缓存');
  } else {
    lines.push('# Obsidian：机器相关的文件不进仓库，插件本体由 setup 脚本按清单还原');
    lines.push('.obsidian/workspace.json');
    lines.push('.obsidian/workspace-mobile.json');
    lines.push('.obsidian/cache/');
    lines.push('.obsidian/plugins/*/main.js');
    lines.push('.obsidian/plugins/*/styles.css');
    lines.push('.obsidian/plugins/*/data.json');
  }

  lines.push('# 插件索引缓存（会自动重新生成）');
  lines.push('setup/.cache/');
  lines.push('# <<< whimsical-setup <<<');
  return `${lines.join('\n')}\n`;
}

/** 某个路径是否已被 .gitignore 忽略 */
function gitIgnored(targetDir, relPath) {
  const res = run('git', ['check-ignore', '-q', relPath], {
    cwd: targetDir,
    quiet: true,
    allowFail: true,
  });
  return res.ok;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help || args.h) return printHelp();

  const dryRun = Boolean(args.dryRun);
  const profile = loadProfile();

  printBanner(dryRun);

  const targetDir = args.dir ? path.resolve(args.dir) : REPO_ROOT;
  const repoUrl = args.repo || profile.git?.repoUrl;
  const summary = { steps: [], warnings: [] };

  /* ---------------------------------------------------- 1. 基础工具 */
  log.step('检查基础工具');
  const toolsOk = checkTools({ profile, dryRun });
  if (!toolsOk.ok) {
    log.err('缺少必需工具，无法继续。');
    log.info('');
    log.info(`  Windows：右键 PowerShell 运行 ${c.bold('setup\\bootstrap.ps1')}，会自动安装并按需配置`);
    log.info(`  macOS/Linux：运行 ${c.bold('bash setup/bootstrap.sh')}`);
    process.exit(1);
  }

  /* ---------------------------------------------------- 2. 仓库 */
  log.step('准备仓库');
  await prepareRepo({ targetDir, repoUrl, dryRun, args, summary });

  /* ---------------------------------------------------- 3. 依赖 */
  if (!args.skipDeps) {
    log.step('安装项目依赖');
    installDeps({ targetDir, dryRun, summary });
  } else {
    log.step('安装项目依赖');
    log.skip('由 --skip-deps 跳过');
  }

  /* ---------------------------------------------------- 4. Git 身份 */
  if (!args.skipGit) {
    log.step('配置 Git 身份');
    configureGit({ targetDir, profile, dryRun, args, summary });
  }

  /* ---------------------------------------------------- 5. Obsidian 插件 */
  if (!args.skipPlugins && !args.skipObsidian) {
    log.step('还原 Obsidian 插件');
    await restoreObsidian({ profile, targetDir, dryRun, args, summary });
  } else {
    log.step('还原 Obsidian 插件');
    log.skip('由 --skip-plugins 跳过');
  }

  /* ---------------------------------------------------- 6. gitignore */
  if (!args.noGitignore) {
    log.step('更新 .gitignore');
    ensureGitignore({ targetDir, dryRun, summary });
  }

  /* ---------------------------------------------------- 7. 收尾 */
  printSummary({ targetDir, profile, summary, dryRun });

  // 有插件没装上就算失败 —— 别让"一键配置"假装成功
  if (summary.pluginFailures && !args.ignorePluginFailures) {
    log.warn('有插件未能还原，退出码记为 1。修好后重跑，或加 --ignore-plugin-failures 强制成功。');
    process.exitCode = 1;
  }

  if (args.dev) {
    log.step('启动本地预览');
    if (dryRun) {
      log.info(`${c.dim('$')} npm run dev`);
    } else {
      log.info(`在 ${targetDir} 运行 npm run dev，浏览器打开 http://localhost:${profile.blog?.devPort ?? 4321}`);
      run('npm', ['run', 'dev'], { cwd: targetDir, allowFail: true });
    }
  }
}

/* ------------------------------------------------------------------ */

function printBanner(dryRun) {
  console.log('');
  console.log(c.bold('  Whimsical 博客 · 一键环境配置'));
  console.log(c.dim('  ----------------------------------------'));
  if (dryRun) console.log(`  ${c.yellow('DRY-RUN')} 只显示将要执行的操作，不修改任何文件`);
  console.log(`  运行目录：${REPO_ROOT}`);
  console.log(`  系统平台：${process.platform} / Node ${process.version}`);
}

function checkTools({ profile, dryRun }) {
  const required = [
    { cmd: 'git', name: 'Git', hint: 'https://git-scm.com/downloads' },
    { cmd: 'node', name: 'Node.js', hint: 'https://nodejs.org（建议 20 LTS 以上）' },
    { cmd: 'npm', name: 'npm', hint: '随 Node.js 一起安装' },
  ];
  const missing = [];
  for (const t of required) {
    const found = hasCommand(t.cmd);
    if (found) {
      const v = run(t.cmd, ['--version'], { quiet: true }).stdout.split('\n')[0];
      log.ok(`${t.name} ${c.dim(v)}`);
    } else {
      log.err(`${t.name} 未安装 — ${t.hint}`);
      missing.push(t);
    }
  }
  if (missing.length && dryRun) {
    log.warn('dry-run 模式下仍会继续，便于预览后续步骤');
    return { ok: true, missing };
  }
  return { ok: missing.length === 0, missing };
}

async function prepareRepo({ targetDir, repoUrl, dryRun, args, summary }) {
  const gitDir = path.join(targetDir, '.git');

  if (!fs.existsSync(gitDir)) {
    if (!repoUrl) {
      log.err('目标目录不是 git 仓库，且没有配置仓库地址（profile.json → git.repoUrl）');
      process.exit(1);
    }
    log.info(`克隆 ${repoUrl} → ${targetDir}`);
    const parent = path.dirname(targetDir);
    if (!dryRun) fs.mkdirSync(parent, { recursive: true });
    const res = run('git', ['clone', repoUrl, targetDir], { cwd: parent, dryRun, allowFail: true });
    if (res.ok) {
      log.ok('仓库已克隆');
      summary.steps.push(`克隆仓库到 ${targetDir}`);
    } else {
      log.warn('克隆未成功（可能是空仓库或需要凭据），继续尝试就地初始化');
      if (!dryRun) fs.mkdirSync(targetDir, { recursive: true });
      run('git', ['init'], { cwd: targetDir, dryRun, allowFail: true });
      run('git', ['remote', 'add', 'origin', repoUrl], { cwd: targetDir, dryRun, allowFail: true });
    }
    return;
  }

  log.ok(`已是 git 仓库：${targetDir}`);

  // 确保 origin 正确
  const remote = run('git', ['remote', 'get-url', 'origin'], { cwd: targetDir, quiet: true, allowFail: true });
  if (!remote.ok) {
    if (repoUrl) {
      const added = run('git', ['remote', 'add', 'origin', repoUrl], { cwd: targetDir, dryRun, allowFail: true });
      if (added.ok) log.ok(`已添加 origin → ${repoUrl}`);
      else log.warn('添加 origin 未成功（权限或已存在），请用 git remote -v 确认');
    }
  } else if (repoUrl && remote.stdout.trim() !== repoUrl) {
    log.warn(`origin 与配置不一致：${remote.stdout.trim()}`);
    log.info(`  配置里是：${repoUrl}（如需更换请手动 git remote set-url origin <url>）`);
  }

  if (args.noPull) {
    log.skip('按 --no-pull 跳过拉取');
    return;
  }

  const hasCommits = run('git', ['rev-parse', '--verify', 'HEAD'], { cwd: targetDir, quiet: true, allowFail: true }).ok;
  if (!hasCommits) {
    log.skip('仓库还没有任何提交，跳过拉取');
    return;
  }

  run('git', ['fetch', '--all', '--prune'], { cwd: targetDir, dryRun, allowFail: true });
  const branch = run('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: targetDir, quiet: true, allowFail: true }).stdout.trim();
  if (branch && branch !== 'HEAD') {
    const pull = run('git', ['pull', '--ff-only'], { cwd: targetDir, dryRun, allowFail: true });
    if (pull.ok) {
      log.ok(`已更新分支 ${branch}`);
      summary.steps.push(`拉取最新代码（${branch}）`);
    } else {
      log.warn('git pull 未成功，可能有本地改动或需要处理冲突 — 请手动检查');
    }
  }
}

function installDeps({ targetDir, dryRun, summary }) {
  const hasLock = fs.existsSync(path.join(targetDir, 'package-lock.json'));
  const cmd = hasLock ? ['ci'] : ['install'];
  const res = run('npm', cmd, { cwd: targetDir, dryRun, allowFail: true });
  if (res.ok) {
    log.ok(`npm ${cmd[0]} 完成`);
    summary.steps.push(`安装 npm 依赖（npm ${cmd[0]}）`);
  } else {
    log.warn('依赖安装失败，稍后可手动执行 npm install');
  }
}

function configureGit({ targetDir, profile, dryRun, args, summary }) {
  const name = args.gitName || profile.git?.userName;
  const email = args.gitEmail || profile.git?.userEmail;

  if (!name || !email) {
    log.warn('profile.json 里 git.userName / git.userEmail 没填全，跳过（提交前必须配置）');
    log.info(`  手动设置：git config --global user.name "你的名字" / user.email "你的邮箱"`);
    return;
  }

  run('git', ['config', 'user.name', name], { cwd: targetDir, dryRun, allowFail: true });
  run('git', ['config', 'user.email', email], { cwd: targetDir, dryRun, allowFail: true });
  log.ok(`${name} <${email}>`);

  // 让凭据被记住，省得每次 push 都输 token
  if (isWindows) {
    run('git', ['config', 'credential.helper', 'manager'], { cwd: targetDir, dryRun, allowFail: true });
  }
  run('git', ['config', 'core.autocrlf', 'input'], { cwd: targetDir, dryRun, allowFail: true });
  summary.steps.push('配置 Git 身份');
}

async function restoreObsidian({ profile, targetDir, dryRun, args, summary }) {
  const { file: manifestFile, plugins } = loadPluginManifest(profile);

  if (!plugins.length) {
    log.warn(`插件清单是空的：${manifestFile}`);
    log.info(`  在装有插件的电脑上执行 ${c.bold('npm run setup:export')} 生成清单`);
    summary.warnings.push('插件清单为空，未还原任何插件');
    return;
  }

  const vault = resolveVault({ profile, explicit: args.vault, baseDir: targetDir });
  let vaultPath = vault.dir;

  if (!vault.exists) {
    if (profile.obsidian?.vaultMode !== 'external' || args.createVault) {
      log.info(`vault 目录尚无 .obsidian，将在 ${vaultPath} 创建（把仓库本身当作 vault）`);
      if (!dryRun) fs.mkdirSync(path.join(vaultPath, '.obsidian'), { recursive: true });
      log.ok(`vault：${vaultPath}`);
    } else {
      log.err(`没有找到 Obsidian vault（${vaultPath} 下没有 .obsidian 目录）`);
      if (vault.knownVaults?.length) {
        log.info('这台电脑上 Obsidian 记录过的 vault：');
        for (const v of vault.knownVaults.slice(0, 5)) log.info(`    ${v}`);
        log.info(`  指定其一：node setup/lib/bootstrap.mjs --vault "<路径>"`);
      }
      summary.warnings.push('未找到 vault，插件未还原');
      return;
    }
  } else {
    log.ok(`vault：${vaultPath} ${c.dim(`（来自 ${vault.from}）`)}`);
  }

  log.info(`插件清单：${manifestFile} ${c.dim(`（${plugins.length} 个）`)}`);

  const registry = await loadRegistry({ offline: Boolean(args.offline) });
  const offlineDir = profile.obsidian?.offlineAssetsDir
    ? path.resolve(targetDir, profile.obsidian.offlineAssetsDir)
    : null;

  const result = await installPlugins({
    vaultPath,
    plugins,
    registry,
    dryRun,
    force: Boolean(args.forcePlugins),
    offlineDir: offlineDir && fs.existsSync(offlineDir) ? offlineDir : null,
  });

  // 只把"确实躺在 vault 里"的插件写进启用列表，否则 Obsidian 启动时会报错
  const present = new Set([...result.installed, ...result.skipped]);
  const enabledIds = plugins
    .filter((p) => p.enabled !== false && present.has(p.id))
    .map((p) => p.id);
  const { added } = enablePlugins({ vaultPath, ids: enabledIds, dryRun });

  log.info('');
  log.ok(`插件：新装 ${result.installed.length} / 已存在 ${result.skipped.length} / 失败 ${result.failed.length}`);
  if (added.length) log.ok(`在 Obsidian 中启用：${added.join(', ')}`);

  if (result.failed.length) {
    summary.warnings.push(`${result.failed.length} 个插件安装失败：${result.failed.map((f) => f.id).join(', ')}`);
    summary.pluginFailures = result.failed.length;
  }
  if (result.installed.length) {
    summary.steps.push(`安装 Obsidian 插件（${result.installed.length} 个）`);
  }

  // 可选：把插件本体快照进仓库，实现完全离线还原
  if (args.withAssets) {
    const dest = path.resolve(targetDir, profile.obsidian?.offlineAssetsDir ?? 'setup/obsidian/plugins');
    log.info(`快照插件文件 → ${dest}`);
    let copied = 0;
    const snapshotIds = plugins.map((p) => p.id);
    for (const id of snapshotIds) {
      const from = path.join(vaultPath, '.obsidian', 'plugins', id);
      if (!fs.existsSync(from)) continue;
      if (dryRun) {
        log.info(`    ${c.dim('→')} ${id}`);
        continue;
      }
      const to = path.join(dest, id);
      fs.mkdirSync(to, { recursive: true });
      for (const f of ['main.js', 'manifest.json', 'styles.css']) {
        const src = path.join(from, f);
        if (fs.existsSync(src)) {
          fs.copyFileSync(src, path.join(to, f));
          copied++;
        }
      }
    }
    if (dryRun) {
      log.info('    （dry-run，未实际写入）');
    } else {
      log.ok(`已快照 ${copied} 个文件 — 提交后其他电脑可完全离线还原`);
      summary.steps.push('快照插件文件到仓库');
    }
  }

  summary.vaultPath = vaultPath;
}

function ensureGitignore({ targetDir, dryRun, summary }) {
  const file = path.join(targetDir, '.gitignore');
  const current = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  if (current.includes(GITIGNORE_MARKER)) {
    log.skip('.gitignore 已包含 whimsical-setup 规则');
    return;
  }

  const block = buildGitignoreBlock(targetDir);

  if (dryRun) {
    const n = block.trim().split('\n').length;
    log.info(`${c.dim('→')} 向 ${path.relative(REPO_ROOT, file) || '.gitignore'} 追加 ${n} 行规则`);
    return;
  }
  const next = current.trimEnd() + '\n' + block;
  fs.writeFileSync(file, next, 'utf8');
  log.ok('已追加 .gitignore 规则（忽略 workspace / 插件本体 / 缓存）');
  summary.steps.push('更新 .gitignore');
}

function printSummary({ targetDir, profile, summary, dryRun }) {
  console.log('');
  console.log(c.bold('  ----------------------------------------'));
  console.log(`  ${dryRun ? c.yellow('DRY-RUN 结束') : c.green('配置完成')}`);

  if (summary.steps.length) {
    console.log('');
    for (const s of summary.steps) console.log(`  ${c.green('✓')} ${s}`);
  }
  if (summary.warnings.length) {
    console.log('');
    for (const w of summary.warnings) console.log(`  ${c.yellow('!')} ${w}`);
  }

  console.log('');
  console.log(c.bold('  下一步'));
  console.log(`  ${c.dim('1.')} 打开 Obsidian → Open folder as vault → ${c.bold(summary.vaultPath ?? targetDir)}`);
  console.log(`  ${c.dim('2.')} 写作：在 ${c.bold(profile.blog?.postsDir ?? 'src/content/blog')} 新建 .md`);
  console.log(`  ${c.dim('3.')} 预览：${c.bold('npm run dev')}  →  http://localhost:${profile.blog?.devPort ?? 4321}`);
  console.log(`  ${c.dim('4.')} 提交：${c.bold('npm run publish -- "这次写了什么"')}`);
  console.log('');
}

function printHelp() {
  console.log(`
${c.bold('Whimsical 博客 · 一键环境配置')}

  node setup/lib/bootstrap.mjs [选项]

${c.bold('选项')}
  --dir <路径>       仓库落到哪里（默认就是当前仓库目录）
  --vault <路径>     指定 Obsidian vault（默认把仓库本身当 vault）
  --repo <url>       覆盖 profile.json 中的仓库地址
  --git-name <名字>  覆盖 Git 用户名
  --git-email <邮箱> 覆盖 Git 邮箱
  --dry-run          只打印将要执行的操作
  --force-plugins    忽略已装版本，强制重装
  --with-assets      同时把插件文件快照进仓库（离线可用）
  --offline          完全不联网（只用缓存/仓库内快照）
  --no-pull          不执行 git pull
  --skip-deps        跳过 npm install
  --skip-plugins     跳过 Obsidian 插件还原
  --no-gitignore     不改动 .gitignore
  --ignore-plugin-failures  插件没装全也返回成功（默认返回 1）
  --dev              配置完成后启动本地预览
  -h, --help         显示本帮助
`);
}

main().catch((err) => {
  console.error('');
  console.error(`  ${c.red('[FAIL]')} ${err.message}`);
  if (process.env.DEBUG) console.error(err.stack);
  process.exit(1);
});