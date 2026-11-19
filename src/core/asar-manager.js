const fs = require('fs');
const path = require('path');
const os = require('os');
const asar = require('@electron/asar');
const { execSync } = require('child_process');

/**
 * 获取 Antigravity 默认安装路径
 */
function getDefaultInstallPath() {
  const platform = os.platform();
  const homedir = os.homedir();

  if (platform === 'win32') {
    // Windows 默认路径
    const localAppData = process.env.LOCALAPPDATA || path.join(homedir, 'AppData', 'Local');
    const defaultPath = path.join(localAppData, 'Programs', 'antigravity');
    if (fs.existsSync(defaultPath)) return defaultPath;

    // 备用：Program Files
    const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
    const pfPath = path.join(programFiles, 'Antigravity');
    if (fs.existsSync(pfPath)) return pfPath;
  } else if (platform === 'darwin') {
    // macOS 默认路径
    const macPath = '/Applications/Antigravity.app/Contents/Resources';
    if (fs.existsSync(macPath)) return macPath;
  } else if (platform === 'linux') {
    // Linux 默认路径
    const linuxPaths = [
      '/opt/antigravity',
      '/usr/share/antigravity',
      path.join(homedir, '.local', 'share', 'antigravity'),
    ];
    for (const p of linuxPaths) {
      if (fs.existsSync(p)) return p;
    }
  }

  return null;
}

/**
 * 获取 app.asar 路径
 */
function getAsarPath(installPath) {
  const p = installPath || getDefaultInstallPath();
  if (!p) {
    throw new Error('未检测到 Antigravity 安装路径，请通过参数指定。');
  }

  // 适配 macOS 与普通平台路径
  const possiblePaths = [
    path.join(p, 'resources', 'app.asar'),
    path.join(p, 'app.asar'),
    path.join(p, 'Contents', 'Resources', 'app.asar'),
  ];

  for (const ap of possiblePaths) {
    if (fs.existsSync(ap)) return ap;
  }

  // 如果路径本身就以 app.asar 结尾
  if (p.endsWith('app.asar') && fs.existsSync(p)) {
    return p;
  }

  throw new Error(`在 ${p} 中未找到 app.asar 文件，请确认路径是否正确。`);
}

/**
 * 检查 Antigravity 是否正在运行
 */
function isAntigravityRunning() {
  try {
    const platform = os.platform();
    if (platform === 'win32') {
      const output = execSync('tasklist', { encoding: 'utf-8' });
      return /Antigravity\.exe/i.test(output);
    } else {
      const output = execSync('ps aux', { encoding: 'utf-8' });
      return /Antigravity/i.test(output);
    }
  } catch {
    return false;
  }
}

/**
 * 备份 app.asar
 */
function backupAsar(asarPath) {
  const backupPath = `${asarPath}.bak`;
  if (!fs.existsSync(backupPath)) {
    console.log(`[备份] 正在创建原始备份: ${backupPath} ...`);
    fs.copyFileSync(asarPath, backupPath);
    console.log(`[备份] 原始备份已成功保存。`);
  } else {
    console.log(`[备份] 已存在原始备份文件: ${backupPath} (跳过覆盖)`);
  }
  return backupPath;
}

/**
 * 还原 app.asar
 */
function restoreAsar(customPath) {
  const targetAsar = getAsarPath(customPath);
  const backupPath = `${targetAsar}.bak`;

  if (!fs.existsSync(backupPath)) {
    throw new Error(`未找到备份文件: ${backupPath}，无法还原。`);
  }

  if (isAntigravityRunning()) {
    throw new Error('检测到 Antigravity 正在运行，请先完全退出 Antigravity 再执行还原。');
  }

  console.log(`[还原] 正在从备份恢复: ${backupPath} -> ${targetAsar} ...`);
  fs.copyFileSync(backupPath, targetAsar);
  console.log(`[还原] 还原成功！Antigravity 已恢复为官方原版。`);
  return true;
}

/**
 * 解包 asar 到临时目录
 */
async function extractAsar(asarPath, destDir) {
  console.log(`[解包] 正在解压 ${path.basename(asarPath)} ...`);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  // 确保配套的 .unpacked 目录存在 (避免解压 .bak 时找不到 .bak.unpacked 抛出 ENOENT)
  const unpackedDir = `${asarPath}.unpacked`;
  const defaultUnpacked = path.join(path.dirname(asarPath), 'app.asar.unpacked');
  if (!fs.existsSync(unpackedDir) && fs.existsSync(defaultUnpacked)) {
    try {
      fs.symlinkSync(defaultUnpacked, unpackedDir, 'junction');
    } catch (_) {}
  }

  asar.extractAll(asarPath, destDir);
  console.log(`[解包] 解压完成: ${destDir}`);
}

/**
 * 将目录打包为 asar
 */
async function packAsar(srcDir, destAsar) {
  console.log(`[打包] 正在打包生成新的 ${path.basename(destAsar)} ...`);
  const tempPackFile = `${destAsar}.tmp`;
  await asar.createPackage(srcDir, tempPackFile);

  // 替换原有 asar
  if (fs.existsSync(destAsar)) {
    fs.unlinkSync(destAsar);
  }
  fs.renameSync(tempPackFile, destAsar);
  console.log(`[打包] 打包并更新成功！`);
}

module.exports = {
  getDefaultInstallPath,
  getAsarPath,
  isAntigravityRunning,
  backupAsar,
  restoreAsar,
  extractAsar,
  packAsar,
};
