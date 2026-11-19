/**
 * Antigravity 注入式高性能全量中文翻译引擎 (i18n-runtime v2.0)
 */
(function () {
  if (window.__ANTIGRAVITY_ZH_ACTIVE__) return;
  window.__ANTIGRAVITY_ZH_ACTIVE__ = true;

  const DICT = window.__ANTIGRAVITY_ZH_DICT__ || { exact: {}, patterns: [] };
  const FONT_CSS = window.__ANTIGRAVITY_ZH_FONT_CSS__ || '';

  // 构建小写不区分大小写索引表，大幅提升匹配命中率
  DICT.lower = {};
  if (DICT.exact) {
    for (const [k, v] of Object.entries(DICT.exact)) {
      DICT.lower[k.toLowerCase()] = v;
    }
  }

  const IGNORE_TAGS = new Set([
    'SCRIPT',
    'STYLE',
    'CODE',
    'PRE',
    'KBD',
    'SAMP',
    'TEXTAREA'
  ]);

  const lastTranslated = new WeakMap();

  function injectStyles() {
    if (!FONT_CSS) return;
    if (document.getElementById('antigravity-zh-font-style')) return;
    const style = document.createElement('style');
    style.id = 'antigravity-zh-font-style';
    style.textContent = FONT_CSS;
    const target = document.head || document.documentElement;
    if (target) {
      target.appendChild(style);
    }
  }

  function lookupWord(word) {
    if (!word) return null;
    if (DICT.exact && DICT.exact[word]) return DICT.exact[word];
    const low = word.toLowerCase();
    if (DICT.lower && DICT.lower[low]) return DICT.lower[low];
    return null;
  }

  function formatDuration(timeStr) {
    if (!timeStr) return timeStr;
    return timeStr
      .replace(/<1m/gi, '< 1 分钟')
      .replace(/(\d+)\s*days?/gi, '$1 天')
      .replace(/(\d+)\s*hours?/gi, '$1 小时')
      .replace(/(\d+)\s*(?:minutes?|mins?)/gi, '$1 分钟')
      .replace(/(\d+)\s*(?:seconds?|secs?)/gi, '$1 秒')
      .replace(/(\d+)d\b/gi, '$1 天')
      .replace(/(\d+)h\b/gi, '$1 小时')
      .replace(/(\d+)m\b/gi, '$1 分钟')
      .replace(/(\d+)s\b/gi, '$1 秒')
      .replace(/,\s*/g, ' ')
      .trim();
  }

  function translateString(str, node) {
    if (!str || typeof str !== 'string') return str;
    const trimmed = str.trim();
    if (!trimmed || trimmed.length > 2000) return str;

    const leading = str.match(/^\s*/)[0];
    const trailing = str.match(/\s*$/)[0];

    // 0. 上下文特定多义词消歧 (如 "Type" 在命令引导句中作动词 "输入")
    if (trimmed === 'Type' && node && node.parentNode) {
      const pText = node.parentNode.textContent || '';
      if (pText.includes('select plan') || pText.includes('generate a plan') || pText.includes('/') || pText.includes('to invoke commands')) {
        return leading + '输入' + trailing;
      }
    }

    // 1. 直接全词匹配 (含大小写回退)
    let direct = lookupWord(trimmed);
    if (direct) {
      return leading + direct + trailing;
    }

    // 2. 标点剥离匹配：冒号 (例: "Model:", "Status:", "Target:")
    if (trimmed.endsWith(':') || trimmed.endsWith('：')) {
      const base = trimmed.slice(0, -1).trim();
      const baseTrans = lookupWord(base);
      if (baseTrans) {
        return leading + baseTrans + '：' + trailing;
      }
    }

    // 3. 标点剥离匹配：省略号 (例: "Loading...", "Searching...", "Thinking...")
    if (trimmed.endsWith('...') || trimmed.endsWith('…')) {
      const base = trimmed.replace(/\.{3}$|…$/, '').trim();
      const baseTrans = lookupWord(base);
      if (baseTrans) {
        return leading + baseTrans + '...' + trailing;
      }
    }

    // 4. 计数角标剥离匹配 (例: "Files Changed (3)", "Artifacts (1)")
    const countMatch = trimmed.match(/^(.+?)\s*\(([0-9]+)\)$/);
    if (countMatch) {
      const base = countMatch[1].trim();
      const count = countMatch[2];
      const baseTrans = lookupWord(base);
      if (baseTrans) {
        return leading + baseTrans + ' (' + count + ')' + trailing;
      }
    }

    // 5. 标点剥离匹配：问号 (例: "Delete message?", "Discard changes?")
    if (trimmed.endsWith('?') || trimmed.endsWith('？')) {
      const base = trimmed.slice(0, -1).trim();
      const baseTrans = lookupWord(base);
      if (baseTrans) {
        return leading + baseTrans + '？' + trailing;
      }
    }

    // 6. 标点剥离匹配：句号 (例: "No conversations yet.", "Saved changes.")
    if (trimmed.endsWith('.') && !trimmed.endsWith('..')) {
      const base = trimmed.slice(0, -1).trim();
      const baseTrans = lookupWord(base);
      if (baseTrans) {
        return leading + baseTrans + '。' + trailing;
      }
    }

    // 7. 标点剥离匹配：感叹号 (例: "Saved!", "Success!")
    if (trimmed.endsWith('!') || trimmed.endsWith('！')) {
      const base = trimmed.slice(0, -1).trim();
      const baseTrans = lookupWord(base);
      if (baseTrans) {
        return leading + baseTrans + '！' + trailing;
      }
    }

    // 8. 外层括号剥离匹配 (例: "(Recommended)", "(default)", "(optional)", "(Beta)")
    if ((trimmed.startsWith('(') && trimmed.endsWith(')')) || (trimmed.startsWith('（') && trimmed.endsWith('）'))) {
      const inner = trimmed.slice(1, -1).trim();
      const innerTrans = lookupWord(inner);
      if (innerTrans) {
        return leading + '（' + innerTrans + '）' + trailing;
      }
    }

    // 9. 外层引号剥离匹配 (例: "'Explain and Fix'", "\"Settings\"")
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
      const inner = trimmed.slice(1, -1).trim();
      const innerTrans = lookupWord(inner);
      if (innerTrans) {
        return leading + '“' + innerTrans + '”' + trailing;
      }
    }

    // 10. 前导符号剥离匹配 (例: "• Item", "- Step")
    const bulletMatch = trimmed.match(/^([•\-\*]\s+)(.+)$/);
    if (bulletMatch) {
      const bullet = bulletMatch[1];
      const base = bulletMatch[2].trim();
      const baseTrans = lookupWord(base);
      if (baseTrans) {
        return leading + bullet + baseTrans + trailing;
      }
    }

    // 11. 配额刷新倒计时动态匹配 (例: "You have used some of your weekly limit, it will fully refresh in 6 days, 22 hours.")
    const quotaMatch = trimmed.match(/^You have used (some|all|most|part) of your (.+?) limit, it will fully refresh in (.+?)\.?$/i);
    if (quotaMatch) {
      const usageMap = { some: '部分', all: '全部', most: '大部分', part: '部分' };
      const usage = usageMap[quotaMatch[1].toLowerCase()] || quotaMatch[1];
      let limitType = quotaMatch[2];
      if (limitType.toLowerCase() === 'weekly') limitType = '每周';
      else if (limitType.toLowerCase() === '5-hour') limitType = '5 小时';
      else if (limitType.toLowerCase() === 'daily') limitType = '每日';
      else if (limitType.toLowerCase() === 'monthly') limitType = '每月';

      const timeStr = formatDuration(quotaMatch[3]);
      const space = /^\d/.test(limitType) ? ' ' : '';
      return leading + `您已使用${usage}的${space}${limitType}配额，将在 ${timeStr} 后完全刷新。` + trailing;
    }

    // 12. 刷新倒计时 (例: "Resets in 6d 22h", "Resets in <1m")
    const resetsMatch = trimmed.match(/^Resets in (.+)$/i);
    if (resetsMatch) {
      const timeStr = formatDuration(resetsMatch[1]);
      return leading + `将在 ${timeStr} 后重置` + trailing;
    }

    // 13. 正则动态规则匹配
    if (DICT.patterns && DICT.patterns.length > 0) {
      for (const p of DICT.patterns) {
        if (p.re && p.re.test(trimmed)) {
          const trans = trimmed.replace(p.re, p.replace);
          return leading + trans + trailing;
        }
      }
    }

    return str;
  }

  function shouldIgnore(el) {
    let curr = el;
    while (curr) {
      if (curr.nodeType === 1) {
        if (IGNORE_TAGS.has(curr.tagName)) return true;
        if (curr.isContentEditable) return true;
        if (curr.classList && curr.classList.contains('monaco-editor')) {
          return true;
        }
      }
      curr = curr.parentNode;
    }
    return false;
  }

  const TARGET_ATTRS = ['placeholder', 'title', 'aria-label', 'aria-description', 'data-tooltip', 'data-tip', 'data-title', 'aria-placeholder', 'alt'];

  function translateNode(node) {
    if (!node) return;
    if (node.nodeType === 3) {
      if (shouldIgnore(node.parentNode)) return;
      const text = node.nodeValue;
      if (!text || !text.trim()) return;
      if (lastTranslated.get(node) === text) return;

      const trans = translateString(text, node);
      if (trans !== text) {
        lastTranslated.set(node, trans);
        node.nodeValue = trans;
      } else {
        lastTranslated.set(node, text);
      }
      return;
    }

    if (node.nodeType === 1 || node.nodeType === 11) { // 元素节点或 DocumentFragment / ShadowRoot
      if (node.tagName && IGNORE_TAGS.has(node.tagName)) return;

      // 属性汉化
      if (node.hasAttribute) {
        for (let i = 0; i < TARGET_ATTRS.length; i++) {
          const attr = TARGET_ATTRS[i];
          if (node.hasAttribute(attr)) {
            const val = node.getAttribute(attr);
            if (val) {
              const trans = translateString(val, node);
              if (trans !== val) node.setAttribute(attr, trans);
            }
          }
        }
      }

      // 输入框按钮值
      if (node.tagName === 'INPUT' && (node.type === 'button' || node.type === 'submit')) {
        const val = node.value;
        const trans = translateString(val, node);
        if (trans !== val) node.value = trans;
      }

      // 子节点递归
      let child = node.firstChild;
      while (child) {
        translateNode(child);
        child = child.nextSibling;
      }

      // Shadow DOM 穿透支持 (针对 Web Components)
      if (node.shadowRoot) {
        translateNode(node.shadowRoot);
      }
    }
  }

  function startObserver() {
    injectStyles();
    translateNode(document.body || document.documentElement);

    const observer = new MutationObserver((mutations) => {
      for (let i = 0; i < mutations.length; i++) {
        const m = mutations[i];
        if (m.type === 'childList') {
          for (let j = 0; j < m.addedNodes.length; j++) {
            translateNode(m.addedNodes[j]);
          }
        } else if (m.type === 'characterData') {
          const text = m.target.nodeValue;
          if (lastTranslated.get(m.target) !== text) {
            translateNode(m.target);
          }
        }
      }
    });

    const target = document.documentElement || document;
    if (target) {
      observer.observe(target, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    }

    // 用户交互主动补偿扫描 (点击菜单、弹窗打开时快速触发翻译)
    document.addEventListener('click', () => {
      setTimeout(() => translateNode(document.body || document.documentElement), 50);
      setTimeout(() => translateNode(document.body || document.documentElement), 250);
    }, { capture: true, passive: true });

    // 周期性主动补偿扫描 (100ms - 8000ms)，确保 React 异步更新无遗漏
    const intervals = [100, 250, 500, 1000, 1800, 3000, 5000, 8000];
    for (let k = 0; k < intervals.length; k++) {
      setTimeout(() => {
        translateNode(document.body || document.documentElement);
      }, intervals[k]);
    }

    // 后台轻量轮询检查 (针对设置窗口切换、懒加载模块)
    setInterval(() => {
      translateNode(document.body || document.documentElement);
    }, 2000);
  }

  if (DICT.patterns && Array.isArray(DICT.patterns)) {
    DICT.patterns = DICT.patterns.map((p) => ({
      re: new RegExp(p.regex, p.flags || ''),
      replace: p.replace,
    }));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startObserver);
    window.addEventListener('load', startObserver);
  } else {
    startObserver();
  }

  console.log('[Antigravity-i18n] 全量中文本地化引擎 v2.0 已就绪。');
})();
