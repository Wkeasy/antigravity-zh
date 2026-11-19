const fs = require('fs');
const path = require('path');

/**
 * 加载并合并所有语言字典
 */
function loadDictionaries(localesDir) {
  const targetDir = localesDir || path.join(__dirname, '..', '..', 'locales', 'zh-CN');
  const files = fs.readdirSync(targetDir);

  const merged = {
    exact: {},
    patterns: [],
  };

  for (const f of files) {
    if (f.endsWith('.json')) {
      const filePath = path.join(targetDir, f);
      try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        if (data.exact) {
          Object.assign(merged.exact, data.exact);
        }
        if (data.patterns && Array.isArray(data.patterns)) {
          merged.patterns.push(...data.patterns);
        }
      } catch (err) {
        console.warn(`[警告] 解析词典失败 ${f}:`, err.message);
      }
    }
  }

  return merged;
}

/**
 * 对解包后的应用目录打补丁
 */
function applyPatches(unpackedDir) {
  console.log(`[补丁] 正在向 unpacked 目录应用汉化补丁...`);

  const localesDir = path.join(__dirname, '..', '..', 'locales', 'zh-CN');
  const dict = loadDictionaries(localesDir);

  const fontCssPath = path.join(__dirname, '..', 'runtime', 'font-override.css');
  const fontCss = fs.existsSync(fontCssPath) ? fs.readFileSync(fontCssPath, 'utf-8') : '';

  const runtimePath = path.join(__dirname, '..', 'runtime', 'i18n-runtime.js');
  const runtimeCode = fs.readFileSync(runtimePath, 'utf-8');

  const distDir = path.join(unpackedDir, 'dist');
  if (!fs.existsSync(distDir)) {
    throw new Error(`未在解包目录中找到 dist 文件夹: ${unpackedDir}`);
  }

  // 核心内联注入代码 (完全自包含，无任何外部 require 依赖)
  const inlineBundle = `
/** [Antigravity-i18n Inline Bundle] **/
(function() {
  try {
    window.__ANTIGRAVITY_ZH_DICT__ = ${JSON.stringify(dict)};
    window.__ANTIGRAVITY_ZH_FONT_CSS__ = ${JSON.stringify(fontCss)};
    ${runtimeCode}
  } catch (err) {
    console.error('[Antigravity-i18n] 注入执行异常:', err);
  }
})();
`;

  // 1. 深度内联注入 dist/preload.js
  const preloadPath = path.join(distDir, 'preload.js');
  if (fs.existsSync(preloadPath)) {
    let preloadCode = fs.readFileSync(preloadPath, 'utf-8');
    const preloadMarker = '/* [Antigravity-i18n Preload Hook] */';

    if (!preloadCode.includes(preloadMarker)) {
      preloadCode += `\n${preloadMarker}\n${inlineBundle}\n`;
      fs.writeFileSync(preloadPath, preloadCode, 'utf-8');
      console.log(`[补丁] 已将汉化引擎完整内联至 preload.js。`);
    } else {
      console.log(`[补丁] preload.js 已存在内联代码。`);
    }
  }

  // 2. 双保险注入 dist/utils.js 中的 createWindow (在 main world 执行 executeJavaScript)
  const utilsPath = path.join(distDir, 'utils.js');
  if (fs.existsSync(utilsPath)) {
    let utilsCode = fs.readFileSync(utilsPath, 'utf-8');
    const utilsMarker = '/* [Antigravity-i18n WebContents Hook] */';

    if (!utilsCode.includes(utilsMarker)) {
      const webContentsHook = `
    ${utilsMarker}
    const __zhScript = ${JSON.stringify(inlineBundle)};
    win.webContents.on('did-finish-load', () => {
      win.webContents.executeJavaScript(__zhScript).catch(() => {});
    });
    win.webContents.on('dom-ready', () => {
      win.webContents.executeJavaScript(__zhScript).catch(() => {});
    });
`;
      if (utilsCode.includes("win.on('page-title-updated', (event, title) => {")) {
        utilsCode = utilsCode.replace(
          "win.on('page-title-updated', (event, title) => {",
          `${webContentsHook}\n    win.on('page-title-updated', (event, title) => {`
        );
        fs.writeFileSync(utilsPath, utilsCode, 'utf-8');
        console.log(`[补丁] 已向 utils.js (createWindow) 植入主世界自动注入钩子。`);
      } else if (utilsCode.includes("win.on('page-title-updated', (e) => {")) {
        utilsCode = utilsCode.replace(
          "win.on('page-title-updated', (e) => {",
          `${webContentsHook}\n    win.on('page-title-updated', (e) => {`
        );
        fs.writeFileSync(utilsPath, utilsCode, 'utf-8');
        console.log(`[补丁] 已向 utils.js (createWindow) 植入主世界自动注入钩子。`);
      } else if (utilsCode.includes("win.on('page-title-updated',")) {
        utilsCode = utilsCode.replace(
          "win.on('page-title-updated',",
          `${webContentsHook}\n    win.on('page-title-updated',`
        );
        fs.writeFileSync(utilsPath, utilsCode, 'utf-8');
        console.log(`[补丁] 已向 utils.js (createWindow) 植入主世界自动注入钩子。`);
      } else {
        console.warn(`[警告] 未能在 utils.js 中找到注入锚点 win.on('page-title-updated')！`);
      }
    }
  }

  // 3. 补丁 dist/menu.js 原生菜单 (Win32 全量模板重构版)
  const menuPath = path.join(distDir, 'menu.js');
  if (fs.existsSync(menuPath)) {
    let menuCode = fs.readFileSync(menuPath, 'utf-8');
    const menuHookMarker = '/* [Antigravity-i18n Menu Hook v2] */';

    if (!menuCode.includes(menuHookMarker)) {
      const menuTranslateCode = `
${menuHookMarker}
const __menuDict = ${JSON.stringify(dict.exact)};
const __menuDictLower = {};
for (const [k, v] of Object.entries(__menuDict)) {
  __menuDictLower[k.toLowerCase()] = v;
}
const __roleMap = {
  'close': '关闭窗口',
  'minimize': '最小化',
  'zoom': '缩放',
  'undo': '撤销',
  'redo': '重做',
  'cut': '剪切',
  'copy': '复制',
  'paste': '粘贴',
  'pasteandmatchstyle': '粘贴并匹配样式',
  'delete': '删除',
  'selectall': '全选',
  'reload': '重新加载',
  'forcereload': '强制重新加载',
  'toggledevtools': '切换开发者工具',
  'resetzoom': '重置缩放',
  'zoomin': '放大',
  'zoomout': '缩小',
  'togglefullscreen': '切换全屏',
  'quit': '退出',
  'services': '服务',
  'hide': '隐藏',
  'hideothers': '隐藏其他',
  'unhide': '显示全部'
};
function __translateMenuLabel(label, role) {
  if (label && typeof label === 'string') {
    if (__menuDict[label]) return __menuDict[label];
    const stripped = label.replace(/&/g, '').trim();
    if (__menuDict[stripped]) {
      const m = label.match(/&([a-zA-Z0-9])/);
      return m ? (__menuDict[stripped] + '(&' + m[1].toUpperCase() + ')') : __menuDict[stripped];
    }
    const low = stripped.toLowerCase();
    if (__menuDictLower[low]) {
      const m = label.match(/&([a-zA-Z0-9])/);
      return m ? (__menuDictLower[low] + '(&' + m[1].toUpperCase() + ')') : __menuDictLower[low];
    }
  }
  if (role && typeof role === 'string' && __roleMap[role.toLowerCase()]) {
    return __roleMap[role.toLowerCase()];
  }
  return label;
}
function __menuItemToTemplate(item) {
  if (!item) return null;
  if (item.type === 'separator') return { type: 'separator' };
  const t = {};
  if (item.id) t.id = item.id;
  if (item.type) t.type = item.type;
  if (item.role) t.role = item.role;
  if (item.accelerator) t.accelerator = item.accelerator;
  if (item.checked !== undefined) t.checked = item.checked;
  if (item.enabled !== undefined) t.enabled = item.enabled;
  if (item.visible !== undefined) t.visible = item.visible;
  if (item.click) t.click = item.click;

  const translatedLabel = __translateMenuLabel(item.label, item.role);
  if (translatedLabel) {
    t.label = translatedLabel;
  }

  if (item.submenu && item.submenu.items) {
    t.submenu = item.submenu.items.map(__menuItemToTemplate).filter(Boolean);
  }
  return t;
}
function __buildTranslatedApplicationMenu(m, MenuModule) {
  try {
    if (!m || !m.items) return m;
    function __translateInPlace(menu) {
      if (!menu || !menu.items) return;
      for (const item of menu.items) {
        const trans = __translateMenuLabel(item.label, item.role);
        if (trans && item.label !== trans) {
          try { item.label = trans; } catch (e) {}
        }
        if (item.submenu) __translateInPlace(item.submenu);
      }
    }
    __translateInPlace(m);
    const template = m.items.map(__menuItemToTemplate).filter(Boolean);
    return MenuModule.buildFromTemplate(template);
  } catch (err) {
    return m;
  }
}
const __origSetAppMenu = electron_1.Menu.setApplicationMenu;
electron_1.Menu.setApplicationMenu = function(m) {
  if (!m) return __origSetAppMenu.call(electron_1.Menu, m);
  const newMenu = __buildTranslatedApplicationMenu(m, electron_1.Menu);
  return __origSetAppMenu.call(electron_1.Menu, newMenu);
};
const __origSetupAppMenu = exports.setupApplicationMenu;
exports.setupApplicationMenu = function(url) {
  __origSetupAppMenu(url);
  try {
    const currentMenu = electron_1.Menu.getApplicationMenu();
    if (currentMenu) {
      const translated = __buildTranslatedApplicationMenu(currentMenu, electron_1.Menu);
      __origSetAppMenu.call(electron_1.Menu, translated);
    }
  } catch (e) {}
};
`;
      // 增强 addItemToSubmenu 支持中英文匹配
      menuCode = menuCode.replace(
        /const submenuItem = appMenu\.items\.find\(\(item\) => item\.label === submenuLabel\);/,
        `const submenuItem = appMenu.items.find((item) => item.label === submenuLabel || (submenuLabel === 'File' && (item.label?.startsWith('文件') || item.label?.includes('File'))) || (submenuLabel === 'Help' && (item.label?.startsWith('帮助') || item.label?.includes('Help'))) || (submenuLabel === 'Window' && (item.label?.startsWith('窗口') || item.label?.includes('Window'))));`
      );

      menuCode = menuCode + '\n' + menuTranslateCode;
      fs.writeFileSync(menuPath, menuCode, 'utf-8');
      console.log(`[补丁] 已注入 menu.js 原生菜单汉化逻辑 (Win32 全量模板重构版)。`);
    }
  }

  // 4. 补丁 dist/tray.js 原生托盘
  const trayPath = path.join(distDir, 'tray.js');
  if (fs.existsSync(trayPath)) {
    let trayCode = fs.readFileSync(trayPath, 'utf-8');
    const trayHookMarker = '/* [Antigravity-i18n Tray Hook] */';

    if (!trayCode.includes(trayHookMarker)) {
      const trayHook = `
${trayHookMarker}
const __trayDict = ${JSON.stringify(dict.exact)};
function __translateTrayActions(actions) {
  if (!Array.isArray(actions)) return actions;
  for (const a of actions) {
    if (a.label && __trayDict[a.label]) a.label = __trayDict[a.label];
  }
  return actions;
}
`;
      trayCode = trayCode.replace(
        /contextMenu = electron_1\.Menu\.buildFromTemplate\(actions\);/,
        `__translateTrayActions(actions);\n    contextMenu = electron_1.Menu.buildFromTemplate(actions);`
      );

      trayCode = trayHook + '\n' + trayCode;
      fs.writeFileSync(trayPath, trayCode, 'utf-8');
      console.log(`[补丁] 已注入 tray.js 系统托盘汉化逻辑。`);
    }
  }

  // 5. 补丁 dist/ipcHandlers.js 右键原生上下文菜单
  const ipcPath = path.join(distDir, 'ipcHandlers.js');
  if (fs.existsSync(ipcPath)) {
    let ipcCode = fs.readFileSync(ipcPath, 'utf-8');
    const ipcHookMarker = '/* [Antigravity-i18n Context Menu Hook] */';

    if (!ipcCode.includes(ipcHookMarker)) {
      const ipcHook = `
${ipcHookMarker}
const __ipcDict = ${JSON.stringify(dict.exact)};
function __translateContextLabel(l) {
  if (!l || typeof l !== 'string') return l;
  if (__ipcDict[l]) return __ipcDict[l];
  const clean = l.replace(/&/g, '').trim();
  if (__ipcDict[clean]) return __ipcDict[clean];
  return l;
}
`;
      ipcCode = ipcCode.replace(
        /label: item\.label \?\? '',/g,
        `label: __translateContextLabel(item.label) ?? '',`
      );

      ipcCode = ipcHook + '\n' + ipcCode;
      fs.writeFileSync(ipcPath, ipcCode, 'utf-8');
      console.log(`[补丁] 已注入 ipcHandlers.js 右键上下文菜单汉化逻辑。`);
    }
  }

  // 6. 补丁 dist/updater.js 禁用后台静默自动下载与退出静默重装，彻底防止重启电脑后汉化被官方覆盖
  const updaterPath = path.join(distDir, 'updater.js');
  if (fs.existsSync(updaterPath)) {
    let updaterCode = fs.readFileSync(updaterPath, 'utf-8');
    const updaterHookMarker = '// [Antigravity-i18n Updater Hook]';

    if (!updaterCode.includes(updaterHookMarker)) {
      updaterCode = updaterCode.replace(
        /electron_updater_1\.autoUpdater\.autoDownload = true;/g,
        `${updaterHookMarker}\n    electron_updater_1.autoUpdater.autoDownload = false;\n    electron_updater_1.autoUpdater.autoInstallOnAppQuit = false;`
      );
      updaterCode = updaterCode.replace(
        /electron_updater_1\.autoUpdater\.autoInstallOnAppQuit = electron_1\.app\.isPackaged;/g,
        `electron_updater_1.autoUpdater.autoInstallOnAppQuit = false;`
      );
      fs.writeFileSync(updaterPath, updaterCode, 'utf-8');
      console.log(`[补丁] 已禁用后台静默下载与退出自动覆盖，永久锁定汉化状态。`);
    }
  }

  console.log(`[补丁] 所有补丁应用完成！`);
}

module.exports = {
  loadDictionaries,
  applyPatches,
};
