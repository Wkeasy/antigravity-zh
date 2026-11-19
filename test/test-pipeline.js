const fs = require('fs');
const path = require('path');
const asar = require('@electron/asar');
const { extractAsar, packAsar } = require('../src/core/asar-manager');
const { applyPatches } = require('../src/core/patcher');

async function testPipeline() {
  console.log('--- 开始端到端自动化测试 ---');
  const testDir = path.join(__dirname, 'mock_app');
  const testDist = path.join(testDir, 'dist');
  fs.mkdirSync(testDist, { recursive: true });

  // 1. 创建模拟文件
  fs.writeFileSync(path.join(testDist, 'preload.js'), 'console.log("original preload");', 'utf-8');
  fs.writeFileSync(path.join(testDist, 'menu.js'), 'electron_1.Menu.setApplicationMenu(menu);', 'utf-8');
  fs.writeFileSync(path.join(testDist, 'tray.js'), 'contextMenu = electron_1.Menu.buildFromTemplate(actions);', 'utf-8');

  // 2. 打包为 mock.asar
  const mockAsar = path.join(__dirname, 'mock.asar');
  await asar.createPackage(testDir, mockAsar);
  console.log('✅ 生成测试 mock.asar 成功');

  // 3. 测试解压与补丁应用
  const unpackDir = path.join(__dirname, 'mock_unpacked');
  await extractAsar(mockAsar, unpackDir);
  applyPatches(unpackDir);

  // 4. 验证补丁是否正确写入
  const patchedPreload = fs.readFileSync(path.join(unpackDir, 'dist', 'preload.js'), 'utf-8');
  if (!patchedPreload.includes('Antigravity-i18n Inline Bundle')) {
    throw new Error('preload.js 补丁校验失败！');
  }
  const patchedMenu = fs.readFileSync(path.join(unpackDir, 'dist', 'menu.js'), 'utf-8');
  if (!patchedMenu.includes('__translateMenuLabel')) {
    throw new Error('menu.js 补丁校验失败！');
  }
  const patchedTray = fs.readFileSync(path.join(unpackDir, 'dist', 'tray.js'), 'utf-8');
  if (!patchedTray.includes('__translateTrayActions')) {
    throw new Error('tray.js 补丁校验失败！');
  }
  console.log('✅ 所有文件补丁及注入代码校验通过！');

  // 5. 重新打包
  const repackedAsar = path.join(__dirname, 'mock_repacked.asar');
  await packAsar(unpackDir, repackedAsar);
  console.log('✅ 重新打包 asar 成功！大小:', fs.statSync(repackedAsar).size, '字节');

  // 6. 清理测试资源
  fs.rmSync(testDir, { recursive: true, force: true });
  fs.rmSync(unpackDir, { recursive: true, force: true });
  fs.unlinkSync(mockAsar);
  fs.unlinkSync(repackedAsar);
  console.log('--- 测试圆满通过并清理完毕 ---');
}

testPipeline().catch(err => {
  console.error('测试失败:', err);
  process.exit(1);
});
