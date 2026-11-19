const { spawnSync, spawn } = require('child_process');

console.log('========================================================');
console.log('      🚀 Antigravity 中文本地化 GitHub 一键推送');
console.log('========================================================\n');

const repo = 'https://github.com/Wkeasy/antigravity-zh.git';

// 1. 确保远程仓库已正确设置
try {
  const remoteCheck = spawnSync('git', ['remote', 'get-url', 'origin'], { encoding: 'utf8' });
  if (remoteCheck.status !== 0 || !remoteCheck.stdout.includes('antigravity-zh')) {
    spawnSync('git', ['remote', 'remove', 'origin']);
    spawnSync('git', ['remote', 'add', 'origin', repo]);
  }
} catch (e) {
  try { spawnSync('git', ['remote', 'add', 'origin', repo]); } catch (_) {}
}

console.log('[1/2] 正在暂存并提交更新...');
spawnSync('git', ['add', '.'], { stdio: 'inherit' });
spawnSync('git', ['commit', '-m', 'chore: update antigravity i18n'], { stdio: 'ignore' });

console.log('[2/2] 正在推送到 GitHub main 分支...');
console.log('👉 如果弹出浏览器窗口，请点击 [Authorize] 授权登录即可！\n');

const child = spawn('git', ['push', '-u', 'origin', 'main'], {
  stdio: 'inherit',
  shell: true
});

child.on('close', (code) => {
  if (code === 0) {
    console.log('\n========================================================');
    console.log('  🎉 推送成功！项目已完整同步至 GitHub 仓库：');
    console.log(`  🔗 ${repo}`);
    console.log('========================================================\n');
  } else {
    console.log('\n========================================================');
    console.log('  ❌ 推送遇到问题 (退出码: ' + code + ')');
    console.log('  👉 请确认已在弹出的浏览器中完成 GitHub 授权，或检查网络连接。');
    console.log('========================================================\n');
  }
});
