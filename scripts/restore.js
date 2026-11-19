const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync, spawn } = require('child_process');

console.log('========================================================');
console.log('      🔄 Antigravity 官方原版一键还原程序');
console.log('========================================================');

const localApp = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
const installDir = path.join(localApp, 'Programs', 'antigravity');
const resourcesDir = path.join(installDir, 'resources');
const asarPath = path.join(resourcesDir, 'app.asar');
const bakPath = path.join(resourcesDir, 'app.asar.bak');
const exePath = path.join(installDir, 'Antigravity.exe');

if (!fs.existsSync(bakPath)) {
  console.error('\n❌ [错误] 未找到官方原版备份文件:', bakPath);
  console.error('无法执行还原操作！');
  process.exit(1);
}

// 1. 安全退出 Antigravity 进程
console.log('[1/3] 正在安全退出当前运行中的 Antigravity 进程...');
try {
  execSync('taskkill /F /IM Antigravity.exe', { stdio: 'ignore' });
} catch (e) {}

function sleepSync(ms) {
  try {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
  } catch (e) {
    const end = Date.now() + ms;
    while (Date.now() < end) {}
  }
}

// 2. 恢复官方原版（带重试）
console.log('[2/3] 正在从备份恢复原版核心文件...');
for (let attempt = 1; attempt <= 15; attempt++) {
  try {
    sleepSync(800);
    fs.copyFileSync(bakPath, asarPath);
    console.log('[2/3] 官方原版核心文件恢复成功！');
    break;
  } catch (err) {
    if (attempt === 15) {
      console.error('\n❌ [错误] 还原文件失败:', err.message);
      process.exit(1);
    }
  }
}

// 3. 重新启动
console.log('[3/3] 正在重新启动 Antigravity...');
if (fs.existsSync(exePath)) {
  const child = spawn(exePath, [], { detached: true, stdio: 'ignore' });
  child.unref();
  console.log('\n========================================================');
  console.log('  🎉 还原成功！Antigravity 已恢复为官方英文版并启动！');
  console.log('========================================================\n');
}
