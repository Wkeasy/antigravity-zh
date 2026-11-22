const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const readline = require('readline');
const { execSync } = require('child_process');

const localApp = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
const cacheDir = path.join(localApp, 'antigravity-i18n');
const configPath = path.join(cacheDir, 'config.json');

function ensureCacheDir() {
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }
}

function loadConfig() {
  try {
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
  } catch (_) {}
  return {};
}

function saveConfig(cfg) {
  try {
    ensureCacheDir();
    fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2), 'utf8');
  } catch (_) {}
}

function isValidInstallDir(dir) {
  if (!dir || typeof dir !== 'string') return false;
  return (
    fs.existsSync(path.join(dir, 'Antigravity.exe')) &&
    fs.existsSync(path.join(dir, 'resources', 'app.asar'))
  );
}

function findFromRegistry() {
  if (process.platform !== 'win32') return null;
  const regKeys = [
    'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
    'HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
    'HKLM\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
  ];
  for (const key of regKeys) {
    try {
      const out = execSync(`reg query "${key}" /s /f "Antigravity" /d`, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      const lines = out.split(/\r?\n/);
      for (const line of lines) {
        const m = line.match(/InstallLocation\s+REG_SZ\s+(.+)$/i);
        if (m && m[1]) {
          const candidate = m[1].trim().replace(/^"|"$/g, '');
          if (isValidInstallDir(candidate)) return candidate;
        }
      }
    } catch (_) {}
  }
  return null;
}

async function promptInstallDir() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const ask = (q) => new Promise((resolve) => rl.question(q, resolve));

  console.log('\n[定位] 未能在默认位置找到 Antigravity 安装目录。');
  console.log('👉 请将桌面上的 Antigravity 快捷方式或安装目录下的 Antigravity.exe 拖入此窗口，然后按回车：');

  try {
    while (true) {
      const raw = (await ask('路径: ')).trim().replace(/^"|"$/g, '');
      if (!raw) continue;

      let candidate = raw;
      if (candidate.toLowerCase().endsWith('.exe')) {
        candidate = path.dirname(candidate);
      }
      if (isValidInstallDir(candidate)) {
        saveConfig({ ...loadConfig(), installDir: candidate });
        return candidate;
      }
      console.log('❌ 该路径下未找到 Antigravity.exe 或 resources\\app.asar，请重新输入或拖入：');
    }
  } finally {
    rl.close();
  }
}

async function findAntigravityInstallDir({ interactive = true } = {}) {
  const cfg = loadConfig();
  if (isValidInstallDir(cfg.installDir)) {
    return cfg.installDir;
  }

  const candidates = [
    path.join(localApp, 'Programs', 'antigravity'),
    path.join(process.env.ProgramFiles || 'C:\\Program Files', 'antigravity'),
    path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'antigravity'),
  ];

  for (const dir of candidates) {
    if (isValidInstallDir(dir)) {
      return dir;
    }
  }

  const regDir = findFromRegistry();
  if (regDir) {
    saveConfig({ ...cfg, installDir: regDir });
    return regDir;
  }

  if (interactive) {
    return await promptInstallDir();
  }
  return candidates[0];
}

function getBundleAssetsHash() {
  const hash = crypto.createHash('sha256');
  const rootDir = path.join(__dirname, '..', '..');
  const dirsToHash = [
    path.join(rootDir, 'locales', 'zh-CN'),
    path.join(rootDir, 'src', 'runtime'),
  ];
  for (const dir of dirsToHash) {
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir).sort();
    for (const f of files) {
      const fp = path.join(dir, f);
      if (fs.statSync(fp).isFile()) {
        hash.update(f);
        hash.update(fs.readFileSync(fp));
      }
    }
  }
  return hash.digest('hex');
}

module.exports = {
  cacheDir,
  ensureCacheDir,
  findAntigravityInstallDir,
  getBundleAssetsHash,
};
