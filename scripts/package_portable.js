const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const releaseDir = path.join(rootDir, 'release');
const portableName = 'Antigravity-ZH-Portable';
const stagingDir = path.join(releaseDir, portableName);
const zipPath = path.join(releaseDir, `${portableName}.zip`);

function copyDirSync(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function writeBat(filePath, lines) {
  fs.writeFileSync(filePath, lines.join('\r\n') + '\r\n', 'ascii');
}

console.log('========================================================');
console.log('   📦 Antigravity-ZH 绿色便携版 (Portable ZIP) 打包器');
console.log('========================================================\n');

// 1. 清理旧构建
if (fs.existsSync(stagingDir)) {
  fs.rmSync(stagingDir, { recursive: true, force: true });
}
if (fs.existsSync(zipPath)) {
  fs.unlinkSync(zipPath);
}
fs.mkdirSync(stagingDir, { recursive: true });

// 2. 复制核心代码、词典与运行时依赖
console.log('[1/4] 正在复制词典、注入引擎与依赖模块...');
copyDirSync(path.join(rootDir, 'locales'), path.join(stagingDir, 'locales'));
copyDirSync(path.join(rootDir, 'src'), path.join(stagingDir, 'src'));
copyDirSync(path.join(rootDir, 'node_modules'), path.join(stagingDir, 'node_modules'));

const scriptsDest = path.join(stagingDir, 'scripts');
fs.mkdirSync(scriptsDest, { recursive: true });
for (const s of ['apply.js', 'restore.js', 'create_shortcut.js']) {
  fs.copyFileSync(path.join(rootDir, 'scripts', s), path.join(scriptsDest, s));
}
fs.copyFileSync(path.join(rootDir, 'package.json'), path.join(stagingDir, 'package.json'));

// 3. 内置独立 Node.js 运行时
console.log('[2/4] 正在内置独立 Node.js 运行时 (实现新电脑零依赖运行)...');
const runtimeDir = path.join(stagingDir, 'runtime');
fs.mkdirSync(runtimeDir, { recursive: true });
const nodeExeSrc = process.execPath;
fs.copyFileSync(nodeExeSrc, path.join(runtimeDir, 'node.exe'));

// 4. 生成一键批处理入口与说明文件
console.log('[3/4] 正在生成一键启动、还原与快捷方式脚本...');
writeBat(path.join(stagingDir, '启动Antigravity-中文版.bat'), [
  '@echo off',
  'cd /d "%~dp0"',
  '"%~dp0runtime\\node.exe" scripts\\apply.js',
  'if errorlevel 1 pause',
]);

writeBat(path.join(stagingDir, '还原官方英文版.bat'), [
  '@echo off',
  'cd /d "%~dp0"',
  '"%~dp0runtime\\node.exe" scripts\\restore.js',
  'pause',
]);

writeBat(path.join(stagingDir, '创建桌面快捷方式.bat'), [
  '@echo off',
  'cd /d "%~dp0"',
  '"%~dp0runtime\\node.exe" scripts\\create_shortcut.js',
  'pause',
]);

const readmeTxt = [
  '========================================================',
  '     Antigravity 全中文本地化工具 (绿色便携版)',
  '========================================================',
  '',
  '【特点】',
  '1. 无需安装 Node.js 或配置任何环境，解压即可在任意 Windows 电脑运行。',
  '2. 自动探测 Antigravity 安装目录；如安装在自定义路径，按提示拖入 Antigravity.exe 即可。',
  '3. 支持在线更新后自动感知新版本并重新汉化。',
  '4. 词典完全开放：可直接编辑 locales\\zh-CN\\*.json 增改翻译，下次启动自动重新编译生效。',
  '',
  '【使用方式】',
  '- 双击「启动Antigravity-中文版.bat」：自动完成汉化并打开 Antigravity。',
  '- 双击「创建桌面快捷方式.bat」：在桌面生成快捷方式，以后直接点桌面图标启动。',
  '- 双击「还原官方英文版.bat」：一键恢复为官方原版。',
  '',
].join('\r\n');
fs.writeFileSync(path.join(stagingDir, '使用说明.txt'), readmeTxt, 'utf8');

// 5. 打包为 ZIP 压缩包
console.log('[4/4] 正在压缩生成 Antigravity-ZH-Portable.zip ...');
execSync(
  `powershell -NoProfile -Command "Compress-Archive -Path '${stagingDir}' -DestinationPath '${zipPath}' -Force"`,
  { stdio: 'inherit' }
);

const stats = fs.statSync(zipPath);
console.log('\n========================================================');
console.log(`🎉 绿色便携压缩包制作完成！`);
console.log(`📦 文件路径: ${zipPath}`);
console.log(`📏 压缩包大小: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
console.log('========================================================\n');
