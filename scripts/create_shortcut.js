const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const targetBat = path.resolve(__dirname, '..', 'apply-zh.bat');
const workingDir = path.resolve(__dirname, '..');
const desktopDir = path.join(os.homedir(), 'Desktop');
const shortcutPath = path.join(desktopDir, 'antigravity.lnk');

const localApp = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
const exePath = path.join(localApp, 'Programs', 'antigravity', 'Antigravity.exe');

const ps1File = path.join(os.tmpdir(), `create_shortcut_${Date.now()}.ps1`);
const psScript = `
$WshShell = New-Object -ComObject WScript.Shell
$shortcut = $WshShell.CreateShortcut('${shortcutPath.replace(/'/g, "''")}')
$shortcut.TargetPath = '${targetBat.replace(/'/g, "''")}'
$shortcut.WorkingDirectory = '${workingDir.replace(/'/g, "''")}'
$shortcut.IconLocation = '${exePath.replace(/'/g, "''")},0'
$shortcut.Description = 'Antigravity (中文汉化版)'
$shortcut.Save()
`;

fs.writeFileSync(ps1File, psScript, 'utf8');

try {
  execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${ps1File}"`, { stdio: 'inherit' });
} finally {
  try { fs.unlinkSync(ps1File); } catch (e) {}
}

if (fs.existsSync(shortcutPath)) {
  console.log('✅ 快捷方式已成功创建到桌面：', shortcutPath);
} else {
  console.error('❌ 创建失败：未找到文件', shortcutPath);
  process.exit(1);
}
