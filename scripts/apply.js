const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { execFileSync, execSync, spawn } = require('child_process');
const { extractAsar, packAsar } = require('../src/core/asar-manager');
const { applyPatches } = require('../src/core/patcher');

console.log('========================================================');
console.log('      🚀 Antigravity 永久全中文本地化启动器');
console.log('========================================================');

const localApp = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
const installDir = path.join(localApp, 'Programs', 'antigravity');
const resourcesDir = path.join(installDir, 'resources');
const asarPath = path.join(resourcesDir, 'app.asar');
const patchedPath = path.join(resourcesDir, 'app.asar.patched');
const bakPath = path.join(resourcesDir, 'app.asar.bak');
const exePath = path.join(installDir, 'Antigravity.exe');
const updaterDir = path.join(localApp, 'antigravity-updater');
const roamingApp = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
const logPath = path.join(roamingApp, 'Antigravity', 'logs', 'main.log');
const projectPatched = path.join(__dirname, '..', 'app.asar.patched');

function sleepSync(ms) {
  try {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
  } catch (e) {
    const end = Date.now() + ms;
    while (Date.now() < end) {}
  }
}

function getFileHash(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    const buffer = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(buffer).digest('hex');
  } catch (_) {
    return null;
  }
}

function getAntigravityProcesses() {
  try {
    const stdout = execFileSync('tasklist.exe', ['/FI', 'IMAGENAME eq Antigravity.exe', '/FO', 'CSV', '/NH'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    });
    const procs = [];
    for (const line of stdout.split('\n')) {
      const matches = line.match(/"([^"]*)"/g);
      if (matches && matches.length >= 5 && matches[0].includes('Antigravity.exe')) {
        const pid = parseInt(matches[1].replace(/"/g, '').trim(), 10);
        const memStr = matches[4].replace(/["\s,Kk]/g, '').trim();
        const memKB = parseInt(memStr, 10);
        if (!isNaN(pid)) {
          procs.push({ pid, memKB: isNaN(memKB) ? 0 : memKB });
        }
      }
    }
    return procs;
  } catch (e) {
    return [];
  }
}

function launchAntigravity() {
  const child = spawn(exePath, [], {
    detached: true,
    stdio: 'ignore',
    cwd: installDir
  });
  child.unref();
}

async function main() {
  // 1. 清理后台待执行的官方更新安装包，彻底防止被官方静默覆盖
  if (fs.existsSync(updaterDir)) {
    try {
      console.log('[防护] 正在清理后台静默更新缓存...');
      fs.rmSync(updaterDir, { recursive: true, force: true });
      fs.mkdirSync(updaterDir, { recursive: true });
      console.log('[防护] 已清除待运行的官方覆盖安装包。');
    } catch (_) {}
  }

  // 2. 确保原版备份存在
  if (fs.existsSync(asarPath) && !fs.existsSync(bakPath)) {
    console.log('[备份] 正在创建官方原版备份: app.asar.bak ...');
    try {
      fs.copyFileSync(asarPath, bakPath);
      console.log('[备份] 官方原版备份成功创建。');
    } catch (e) {
      console.warn('[警告] 创建备份提示:', e.message);
    }
  }

  // 3. 准备最新汉化核心包 (优先使用本地稳定验证包)
  console.log('[1/4] 正在准备最新汉化核心数据...');
  if (fs.existsSync(projectPatched)) {
    console.log('[提示] 载入已通过全面校验的稳定汉化包...');
    fs.copyFileSync(projectPatched, patchedPath);
    console.log('[2/4] 稳定汉化核心包就绪！');
  } else if (!fs.existsSync(patchedPath)) {
    const sourceAsar = fs.existsSync(bakPath) ? bakPath : asarPath;
    const tempDir = path.join(os.tmpdir(), `antigravity-build-${Date.now()}`);
    try {
      await extractAsar(sourceAsar, tempDir);
      applyPatches(tempDir);
      await packAsar(tempDir, patchedPath);
      fs.copyFileSync(patchedPath, projectPatched);
      console.log('[2/4] 最新汉化核心包编译就绪！');
    } catch (err) {
      console.error('[错误] 构建汉化包失败:', err.message);
      process.exit(1);
    } finally {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (_) {}
    }
  } else {
    console.log('[2/4] 汉化核心包已就绪！');
  }

  // 4. 检查当前是否需要重新部署补丁
  const currentAsarHash = getFileHash(asarPath);
  const targetAsarHash = getFileHash(patchedPath);
  const isAlreadyPatched = (currentAsarHash !== null && targetAsarHash !== null && currentAsarHash === targetAsarHash);

  if (!isAlreadyPatched) {
    console.log('[3/4] 检测到汉化补丁有更新，正在准备安全写入...');
    let replaced = false;
    try {
      fs.copyFileSync(patchedPath, asarPath);
      replaced = true;
      console.log('[3/4] 核心汉化文件部署成功！');
    } catch (_) {
      const existingProcs = getAntigravityProcesses();
      if (existingProcs.length > 0) {
        console.log('[退出] 正在退出旧 Antigravity 实例以释放文件锁...');
        try {
          execSync('taskkill /F /IM Antigravity.exe', { stdio: 'ignore' });
        } catch (_) {}

        // 等待进程完全退出
        for (let i = 0; i < 20; i++) {
          sleepSync(500);
          if (getAntigravityProcesses().length === 0) break;
        }
        sleepSync(1000); // 确保操作系统完全释放句柄与单例锁
      }

      for (let attempt = 1; attempt <= 15; attempt++) {
        try {
          fs.copyFileSync(patchedPath, asarPath);
          replaced = true;
          console.log('[3/4] 核心汉化文件部署成功！');
          break;
        } catch (err) {
          if (attempt === 15) {
            console.error('\n❌ [错误] 替换失败:', err.message);
            console.log('请稍后再试，或确认 Antigravity 已完全退出。');
            process.exit(1);
          }
          sleepSync(800);
        }
      }
    }
  } else {
    console.log('[3/4] 核心汉化文件已是最新版本，无需重复写入。');
  }

  // 5. 检查是否已经在正常运行中（进程充足且有渲染核心进程）
  const runningProcs = getAntigravityProcesses();
  const hasHeavyProcessNow = runningProcs.some(p => p.memKB > 120000);

  if (isAlreadyPatched && runningProcs.length >= 4 && hasHeavyProcessNow) {
    console.log('[运行] Antigravity 客户端已在运行中，已为您唤起界面！');
    launchAntigravity();
    sleepSync(1500);
    console.log('\n========================================================');
    console.log('  🎉 Antigravity 客户端已在运行中，已成功唤起至前台！');
    console.log('  👉 全量中文本地化已生效，本窗口将在 2 秒后自动关闭...');
    console.log('========================================================\n');
    sleepSync(2000);
    process.exit(0);
  }

  // 6. 启动应用并严格确认界面成功加载
  console.log('[启动] 正在启动 Antigravity 客户端...');
  if (!fs.existsSync(exePath)) {
    console.error('\n❌ [错误] 未在系统路径中找到 Antigravity.exe:', exePath);
    process.exit(1);
  }

  launchAntigravity();
  console.log('[等待] 客户端正在初始化加载核心服务与前端界面，请稍候...');

  let startedSuccessfully = false;
  let stableCount = 0;
  const maxWaitMs = 35000; // 最长等待 35 秒
  const intervalMs = 1000;
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    sleepSync(intervalMs);
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    const procs = getAntigravityProcesses();

    // 如果启动超过 5 秒且进程数为 0，说明进程崩溃退出
    if (Date.now() - startTime > 5000 && procs.length === 0) {
      console.error('\n❌ [错误] Antigravity 进程未能启动或启动后意外退出。');
      process.exit(1);
    }

    // 检查是否有主力渲染窗口进程 (总进程 >= 4 且有 UI 渲染内存占用 > 120MB)
    const hasHeavyProcess = procs.some(p => p.memKB > 120000);

    if (procs.length >= 4 && hasHeavyProcess) {
      stableCount++;
      console.log(`[检测] 界面渲染核心已就绪 (${stableCount}/2)，正在确认界面呈现...`);
      if (stableCount >= 2) {
        startedSuccessfully = true;
        break;
      }
    } else {
      stableCount = 0;
      console.log(`[等待] 正在加载核心服务与界面资源 (${elapsed}秒)...`);
    }
  }

  if (startedSuccessfully) {
    console.log('\n========================================================');
    console.log('  🎉 Antigravity 客户端已成功打开并正常呈现！');
    console.log('  👉 全量中文本地化已生效，本窗口将在 2 秒后自动关闭...');
    console.log('========================================================\n');
    sleepSync(2000);
    process.exit(0);
  } else {
    console.error('\n========================================================');
    console.error('  ❌ [错误] 等待超时：未能检测到 Antigravity 界面完全打开！');
    console.error(`  👉 请检查日志排查异常: ${logPath}`);
    console.error('========================================================\n');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('执行异常:', err);
  process.exit(1);
});
