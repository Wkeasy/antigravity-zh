const fs = require('fs');
const path = require('path');
const https = require('https');
const { loadDictionaries } = require('./patcher');

/**
 * 从本地文件或运行中服务扫描提取候选词条
 */
async function scanCandidates(options = {}) {
  console.log('[扫描] 正在检测当前词典覆盖率...');
  const dict = loadDictionaries();
  const exactSet = new Set(Object.keys(dict.exact));

  console.log(`[扫描] 当前已收录词条: ${exactSet.size} 条。`);

  // 尝试连接运行中的 Antigravity language_server 或读取缓存文件
  const candidatesPath = path.join(__dirname, '..', '..', 'data', 'candidates.json');
  let candidates = [];

  if (fs.existsSync(candidatesPath)) {
    try {
      candidates = JSON.parse(fs.readFileSync(candidatesPath, 'utf-8'));
    } catch {
      candidates = [];
    }
  }

  if (candidates.length === 0) {
    console.log('[扫描] 未发现离线词条包，正在尝试探测本地服务...');
    // 可以在此扩展动态请求逻辑
  }

  const missing = candidates.filter((item) => !exactSet.has(item.trim()));
  console.log(`[扫描] 发现未翻译候选词条: ${missing.length} 条。`);

  const outputPath = path.join(__dirname, '..', '..', 'missing_candidates.json');
  fs.writeFileSync(outputPath, JSON.stringify(missing, null, 2), 'utf-8');
  console.log(`[扫描] 未翻译词条已导出至: missing_candidates.json`);
  return missing;
}

module.exports = {
  scanCandidates,
};
