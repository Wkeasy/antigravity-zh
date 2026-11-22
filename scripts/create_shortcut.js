const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { findAntigravityInstallDir } = require('../src/core/locator');

async function main() {
  const workingDir = path.resolve(__dirname, '..');
  const portableBat = path.join(workingDir, '启动Antigravity-中文版.bat');
  const devBat = path.join(workingDir, 'apply-zh.bat');
  const targetBat = fs.existsSync(portableBat) ? portableBat : devBat;

  const desktopDir = path.join(os.homedir(), 'Desktop');
  const shortcutPath = path.join(desktopDir, 'Antigravity.lnk');

  const installDir = await findAntigravityInstallDir({ interactive: false });
  const exePath = path.join(installDir, 'Antigravity.exe');
  const iconLine = fs.existsSync(exePath)
    ? `$shortcut.IconLocation = '${exePath.replace(/'/g, "''")},0'`
    : '';

  const ps1File = path.join(os.tmpdir(), `create_shortcut_${Date.now()}.ps1`);
  const psScript = `
$WshShell = New-Object -ComObject WScript.Shell
$shortcut = $WshShell.CreateShortcut('${shortcutPath.replace(/'/g, "''")}')
$shortcut.TargetPath = '${targetBat.replace(/'/g, "''")}'
$shortcut.WorkingDirectory = '${workingDir.replace(/'/g, "''")}'
${iconLine}
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
}

main().catch((err) => {
  console.error('创建快捷方式失败:', err);
  process.exit(1);
});
