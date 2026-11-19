const fs = require('fs');
const path = require('path');
const os = require('os');
const { extractAsar, packAsar, getAsarPath } = require('../src/core/asar-manager');
const { applyPatches } = require('../src/core/patcher');

async function build() {
  console.log('=== 开始为 Antigravity 构建全新汉化核心包 ===');
  
  const currentAsar = getAsarPath();
  const bakAsar = `${currentAsar}.bak`;
  const officialAsar = fs.existsSync(bakAsar) ? bakAsar : currentAsar;
  if (!fs.existsSync(officialAsar)) {
    throw new Error('未找到官方 app.asar: ' + officialAsar);
  }

  const tempDir = path.join(os.tmpdir(), `antigravity-build-${Date.now()}`);
  const targetProjectPatched = path.join(__dirname, '..', 'app.asar.patched');
  const targetResourcePatched = `${currentAsar}.patched`;

  try {
    console.log('[1/4] 正在解包官方 v2.33.0 app.asar ...');
    await extractAsar(officialAsar, tempDir);

    console.log('[2/4] 正在应用全新 v2.33.0 补丁与扩展词典...');
    applyPatches(tempDir);

    console.log('[3/4] 正在将补丁打包为 app.asar.patched ...');
    await packAsar(tempDir, targetProjectPatched);

    console.log('[4/4] 同步至应用 resources 目录...');
    fs.copyFileSync(targetProjectPatched, targetResourcePatched);
    try {
      fs.copyFileSync(targetProjectPatched, currentAsar);
      console.log('✅ 已直接将最新汉化核心包同步更新至 app.asar');
    } catch (e) {
      console.warn('⚠️ 无法直接写入 app.asar:', e.message);
    }

    const stats = fs.statSync(targetProjectPatched);
    console.log(`\n🎉 构建圆满成功！全新 2.33.0 汉化核心包体积: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
  } finally {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (_) {}
  }
}

build().catch(err => {
  console.error('构建失败:', err);
  process.exit(1);
});
