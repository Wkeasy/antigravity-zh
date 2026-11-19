#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');
const {
  getDefaultInstallPath,
  getAsarPath,
  isAntigravityRunning,
  backupAsar,
  restoreAsar,
  extractAsar,
  packAsar,
} = require('../src/core/asar-manager');
const { applyPatches } = require('../src/core/patcher');
const { scanCandidates } = require('../src/core/scanner');

const command = process.argv[2] || 'help';
const args = process.argv.slice(3);

function printBanner() {
  console.log(`
============================================================
      🚀 Antigravity 中文本地化一键汉化工具 (v1.0.0)
============================================================
`);
}

function printHelp() {
  printBanner();
  console.log(`使用方法:
  npm run patch     - 自动备份并应用中文汉化补丁
  npm run restore   - 一键还原为官方原版状态
  npm run status    - 查看 Antigravity 安装与汉化状态
  npm run extract   - 扫描并提取未翻译候选词条

命令行选项:
  node bin/cli.js patch [--path <自定义安装路径>] [--force]
  node bin/cli.js restore [--path <自定义安装路径>]
  node bin/cli.js status
`);
}

async function handlePatch() {
  printBanner();
  let customPath = null;
  const pathIdx = args.indexOf('--path');
  if (pathIdx !== -1 && args[pathIdx + 1]) {
    customPath = args[pathIdx + 1];
  }
  const isForce = args.includes('--force');

  if (isAntigravityRunning() && !isForce) {
    console.warn(`
⚠️  【警告】检测到 Antigravity 正在运行中！
    Windows 系统下正在运行的程序会锁定 app.asar，导致补丁写入失败。
    👉 请先在系统托盘右键退出 Antigravity，然后再重新运行此命令！
    （若需强制执行，请追加参数: --force）
`);
    process.exit(1);
  }

  const asarPath = getAsarPath(customPath);
  console.log(`[定位] 目标文件: ${asarPath}`);

  // 1. 自动安全备份
  backupAsar(asarPath);

  const prebuiltPath = `${asarPath}.patched`;
  if (fs.existsSync(prebuiltPath)) {
    console.log(`[提示] 检测到已存在预构建的汉化包: ${prebuiltPath}`);
    console.log(`[应用] 正在直接写入最新汉化包...`);
    fs.copyFileSync(prebuiltPath, asarPath);
    console.log(`
🎉 【汉化完成】恭喜！Antigravity 中文汉化补丁已成功应用！
👉 现在您可以重新启动 Antigravity，体验全中文交互界面。
💡 如需随时还原原版，只需在当前目录运行: npm run restore
`);
    return;
  }

  // 2. 解压到临时工作目录
  const tempDir = path.join(os.tmpdir(), `antigravity-patch-${Date.now()}`);
  try {
    await extractAsar(asarPath, tempDir);

    // 3. 应用补丁代码与语言字典
    applyPatches(tempDir);

    // 4. 重新打包回 asar
    await packAsar(tempDir, asarPath);

    console.log(`
🎉 【汉化完成】恭喜！Antigravity 中文汉化补丁已成功应用！
👉 现在您可以重新启动 Antigravity，体验全中文交互界面。
💡 如需随时还原原版，只需在当前目录运行: npm run restore
`);
  } catch (err) {
    console.error(`\n❌ [错误] 汉化补丁应用失败:`, err.message);
  } finally {
    // 清理临时解压目录
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch {
      // 忽略清理临时文件的错误
    }
  }
}

async function handleRestore() {
  printBanner();
  let customPath = null;
  const pathIdx = args.indexOf('--path');
  if (pathIdx !== -1 && args[pathIdx + 1]) {
    customPath = args[pathIdx + 1];
  }

  try {
    restoreAsar(customPath);
    console.log(`
🎉 【还原成功】Antigravity 已恢复至官方原版初始状态。
`);
  } catch (err) {
    console.error(`\n❌ [还原失败]:`, err.message);
  }
}

async function handleStatus() {
  printBanner();
  const installPath = getDefaultInstallPath();
  const isRunning = isAntigravityRunning();

  console.log(`[检测信息]`);
  console.log(`  安装根目录:   ${installPath || '未检测到默认安装路径'}`);
  console.log(`  运行状态:     ${isRunning ? '🟢 正在运行中' : '⚪ 未在运行'}`);

  if (installPath) {
    try {
      const asarPath = getAsarPath(installPath);
      const backupPath = `${asarPath}.bak`;
      const hasBackup = fs.existsSync(backupPath);
      console.log(`  app.asar 路径: ${asarPath}`);
      console.log(`  原始备份存在: ${hasBackup ? '✅ 是 (' + backupPath + ')' : '❌ 否'}`);
    } catch (e) {
      console.log(`  app.asar 状态: 未找到 (${e.message})`);
    }
  }
}

async function main() {
  switch (command) {
    case 'patch':
    case 'install':
      await handlePatch();
      break;
    case 'restore':
      await handleRestore();
      break;
    case 'status':
      await handleStatus();
      break;
    case 'extract':
    case 'scan':
      await scanCandidates();
      break;
    case 'help':
    default:
      printHelp();
      break;
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
