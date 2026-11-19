const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { loadDictionaries } = require('../src/core/patcher');

// 1. 加载所有语言词典
const localesDir = path.join(__dirname, '..', 'locales', 'zh-CN');
const dict = loadDictionaries(localesDir);

// 2. 模拟 i18n-runtime 翻译函数
dict.lower = {};
if (dict.exact) {
  for (const [k, v] of Object.entries(dict.exact)) {
    dict.lower[k.toLowerCase()] = v;
  }
}

if (dict.patterns && Array.isArray(dict.patterns)) {
  dict.patterns = dict.patterns.map((p) => ({
    re: new RegExp(p.regex, p.flags || ''),
    replace: p.replace,
  }));
}

function lookupWord(word) {
  if (!word) return null;
  if (dict.exact && dict.exact[word]) return dict.exact[word];
  const low = word.toLowerCase();
  if (dict.lower && dict.lower[low]) return dict.lower[low];
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

  // 2. 标点剥离匹配：冒号
  if (trimmed.endsWith(':') || trimmed.endsWith('：')) {
    const base = trimmed.slice(0, -1).trim();
    const baseTrans = lookupWord(base);
    if (baseTrans) {
      return leading + baseTrans + '：' + trailing;
    }
  }

  // 3. 标点剥离匹配：省略号
  if (trimmed.endsWith('...') || trimmed.endsWith('…')) {
    const base = trimmed.replace(/\.{3}$|…$/, '').trim();
    const baseTrans = lookupWord(base);
    if (baseTrans) {
      return leading + baseTrans + '...' + trailing;
    }
  }

  // 4. 计数角标剥离匹配
  const countMatch = trimmed.match(/^(.+?)\s*\(([0-9]+)\)$/);
  if (countMatch) {
    const base = countMatch[1].trim();
    const count = countMatch[2];
    const baseTrans = lookupWord(base);
    if (baseTrans) {
      return leading + baseTrans + ' (' + count + ')' + trailing;
    }
  }

  // 5. 标点剥离匹配：问号
  if (trimmed.endsWith('?') || trimmed.endsWith('？')) {
    const base = trimmed.slice(0, -1).trim();
    const baseTrans = lookupWord(base);
    if (baseTrans) {
      return leading + baseTrans + '？' + trailing;
    }
  }

  // 6. 标点剥离匹配：句号
  if (trimmed.endsWith('.') && !trimmed.endsWith('..')) {
    const base = trimmed.slice(0, -1).trim();
    const baseTrans = lookupWord(base);
    if (baseTrans) {
      return leading + baseTrans + '。' + trailing;
    }
  }

  // 7. 标点剥离匹配：感叹号
  if (trimmed.endsWith('!') || trimmed.endsWith('！')) {
    const base = trimmed.slice(0, -1).trim();
    const baseTrans = lookupWord(base);
    if (baseTrans) {
      return leading + baseTrans + '！' + trailing;
    }
  }

  // 8. 外层括号剥离匹配
  if ((trimmed.startsWith('(') && trimmed.endsWith(')')) || (trimmed.startsWith('（') && trimmed.endsWith('）'))) {
    const inner = trimmed.slice(1, -1).trim();
    const innerTrans = lookupWord(inner);
    if (innerTrans) {
      return leading + '（' + innerTrans + '）' + trailing;
    }
  }

  // 9. 外层引号剥离匹配
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    const inner = trimmed.slice(1, -1).trim();
    const innerTrans = lookupWord(inner);
    if (innerTrans) {
      return leading + '“' + innerTrans + '”' + trailing;
    }
  }

  // 10. 前导符号剥离匹配
  const bulletMatch = trimmed.match(/^([•\-\*]\s+)(.+)$/);
  if (bulletMatch) {
    const bullet = bulletMatch[1];
    const base = bulletMatch[2].trim();
    const baseTrans = lookupWord(base);
    if (baseTrans) {
      return leading + bullet + baseTrans + trailing;
    }
  }

  // 11. 配额刷新倒计时动态匹配
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

  // 12. 刷新倒计时
  const resetsMatch = trimmed.match(/^Resets in (.+)$/i);
  if (resetsMatch) {
    const timeStr = formatDuration(resetsMatch[1]);
    return leading + `将在 ${timeStr} 后重置` + trailing;
  }

  // 13. 正则动态规则匹配
  if (dict.patterns && dict.patterns.length > 0) {
    for (const p of dict.patterns) {
      if (p.re && p.re.test(trimmed)) {
        const trans = trimmed.replace(p.re, p.replace);
        return leading + trans + trailing;
      }
    }
  }

  return str;
}

console.log('=== 开始全面验证用户报告的所有未汉化词条 ===\n');

const testCases = [
  // 1. 通用与执行
  { input: 'Execution', expected: '执行控制' },
  { input: 'Global Permissions', expected: '全局权限' },
  { input: 'Security Preset', expected: '安全预设' },
  { input: 'Controls the actions the agent can take.', expected: '控制智能体可执行的操作。' },
  { input: 'Learn more about', expected: '了解关于 ' },
  { input: 'Turbo mode', expected: 'Turbo 模式' },
  { input: 'Full machine', expected: '全机模式' },
  { input: 'Tool Permissions', expected: '工具权限' },
  { input: 'Modify permissions for file, terminal, and MCP tools.', expected: '修改文件、终端和 MCP 工具的权限。' },
  { input: 'Plan Review Policy', expected: '方案审查策略' },
  { input: 'Whether the agent asks you to review its documents.', expected: '控制智能体在生成方案或文档时是否请求您进行审查。' },
  
  // 2. 网络与终端
  { input: 'Network Permissions', expected: '网络权限' },
  { input: 'Terminal & Tooling Permissions', expected: '终端与工具权限' },
  { input: 'Commands Outside Sandbox', expected: '沙箱外执行命令' },
  { input: 'Commands the agent can run outside the sandbox in this workspace.', expected: '在此工作区中智能体可在沙箱外部运行的命令。' },

  // 3. 浏览器
  { input: 'Browser', expected: '浏览器' },
  { input: 'Configure the browser subagent. It requires', expected: '配置浏览器子代理。该功能需要安装 ' },
  { input: 'to be installed.', expected: ' 浏览器。' },
  { input: 'The browser subagent can be invoked by typing /browser in the conversation input box.', expected: '在对话输入框中输入 /browser 即可调用浏览器子代理。' },

  // 4. 应用与远程控制
  { input: 'Manage Antigravity app settings.', expected: '管理 Antigravity 应用设置。' },
  { input: 'Remote Control', expected: '远程控制' },
  { input: 'Enable Remote Control', expected: '启用远程控制' },
  { input: 'Notification Settings', expected: '通知设置' },
  { input: "To modify notification settings, open your operating system's system preferences.", expected: '如需修改通知设置，请打开操作系统的系统偏好设置/设置。' },

  // 5. 模型与用量
  { input: 'Models & Usage', expected: '模型与用量' },
  { input: 'Manage your model quota and credits.', expected: '管理您的模型配额与积分。' },
  { input: 'Plan', expected: '套餐方案' },
  { input: 'Your Plan: ', expected: '当前套餐： ' },
  { input: 'You can upgrade to a Google AI Ultra plan to receive higher rate limits.', expected: '您可以升级到 Google AI Ultra 套餐以获取更高的速率限制配额。' },
  { input: 'Model Credits', expected: '模型积分' },
  { input: 'Enable AI Credit Overages', expected: '启用 AI 积分超额使用' },
  { input: "When toggled on, Antigravity will use your AI credits to fulfill model requests once you're out of model quota. Antigravity will always use your model quota first before using AI credits.", expected: '开启后，当您的模型配额用尽时，Antigravity 将使用您的 AI 积分来响应模型请求。Antigravity 将始终优先使用您的模型配额，然后再使用 AI 积分。' },
  { input: 'Gemini Models', expected: 'Gemini 模型' },
  { input: 'Weekly Limit Remaining', expected: '每周配额剩余' },
  { input: 'You have used some of your weekly limit, it will fully refresh in 6 days, 22 hours.', expected: '您已使用部分的每周配额，将在 6 天 22 小时 后完全刷新。' },
  { input: 'Five Hour Limit Remaining', expected: '5 小时配额剩余' },
  { input: 'You have used some of your 5-hour limit, it will fully refresh in 3 hours.', expected: '您已使用部分的 5 小时配额，将在 3 小时 后完全刷新。' },
  { input: 'Claude and GPT models', expected: 'Claude 与 GPT 模型' },
  { input: 'You have used some of your weekly limit, it will fully refresh in 1 day, 23 hours.', expected: '您已使用部分的每周配额，将在 1 天 23 小时 后完全刷新。' },

  // 6. 开发者与迁移
  { input: 'Developer', expected: '开发者' },
  { input: 'Developer-only tools. These settings are stored locally in this browser and do not affect other users.', expected: '仅限开发者使用的工具。这些设置仅保存在当前浏览器本地，不会影响其他用户。' },
  { input: 'Regroup Google3 Chats', expected: '重组 Google3 对话' },
  { input: 'Google3 chats will be regrouped into their workspaces in the sidebar.', expected: 'Google3 对话将重新归类至侧边栏对应的各工作区中。' },
  { input: 'This migration may mess up your settings, chats, and sidebar.', expected: '此迁移可能会影响您的设置、聊天记录和侧边栏。' },
  { input: 'Follow the guide at', expected: '请参考指南 ' },
  { input: 'to back up your data and run the migration.', expected: '以备份数据并执行迁移。' },

  // 7. 快捷键
  { input: 'Keyboard shortcuts for quick navigation and control.', expected: '用于快速导航和操作控制的快捷键。' },
  { input: 'Open Conversation Picker', expected: '打开对话选择器' },
  { input: 'Open File Search', expected: '打开文件搜索' },
  { input: 'Focus Input', expected: '聚焦输入框' },
  { input: 'File Picker', expected: '文件选择器' },
  { input: 'Previous Pane Tab', expected: '上一个窗格标签页' },
  { input: 'Next Pane Tab', expected: '下一个窗格标签页' },
  { input: 'Toggle Voice Recording', expected: '切换语音输入录音' },
  { input: 'Find in Pane', expected: '在窗格中查找' },
  { input: 'Add to Chat/Quote', expected: '添加至对话 / 引用' },
  { input: 'Toggle Maximize Auxiliary Pane', expected: '最大化/还原辅助窗格' },
  { input: 'Toggle Overview Panel', expected: '切换概览面板' },

  // 8. 提供反馈
  { input: 'Feedback Type', expected: '反馈类型' },
  { input: 'Bug Report', expected: '缺陷报告' },
  { input: 'Feature Request', expected: '功能建议' },
  { input: 'Remote Control Issue', expected: '远程控制问题' },
  { input: 'General Feedback', expected: '通用反馈' },
  { input: 'Please describe the issue in detail. The more actionable your feedback, the quicker our team can address your request. Some helpful information includes:', expected: '请详细描述您遇到的问题。您的反馈越具体可操作，我们的团队越能快速处理您的请求。一些有帮助的信息包括：' },
  { input: 'Steps to reproduce the issue', expected: '重现问题的步骤' },
  { input: 'Steps to Reproduce', expected: '重现步骤' },
  { input: 'Expected behavior', expected: '预期行为' },
  { input: 'Attach Antigravity server logs', expected: '附加 Antigravity 服务器日志' },
  { input: 'Send feedback as user@example.com', expected: '作为 user@example.com 发送反馈' },
  { input: 'Legal Help', expected: '法律帮助' },
  { input: 'to ask for content changes for legal reasons.', expected: '以出于法律原因申请修改或移除内容。' },

  // 9. 外观与主题
  { input: "Configure the agent's visual theme and display preferences.", expected: '配置智能体的视觉主题与显示偏好。' },
  { input: 'Contrast', expected: '对比度' },
  { input: 'Dark Theme', expected: '深色主题' },
  { input: 'Preset', expected: '预设' },
  { input: 'Background', expected: '背景色' },
  { input: 'Foreground', expected: '前景色' },
  { input: 'Accent', expected: '强调色' },
  { input: '// Greet a user by name', expected: '// 根据姓名向用户问候' },

  // 10. 编辑器与插件市场
  { input: 'Editor Settings', expected: '编辑器设置' },
  { input: 'To modify editor settings, open Settings within the editor window.', expected: '如需修改编辑器设置，请在编辑器窗口内打开“设置”。' },
  { input: 'Selection Actions', expected: '选中文本操作' },
  { input: 'Show Selection Actions', expected: '显示选中文本操作浮条' },
  { input: 'Show "Edit" and "Chat" buttons when selecting text in the editor.', expected: '在编辑器中选中文本时显示“编辑”和“对话”按钮。' },
  { input: 'Marketplace Item URL', expected: '插件详情基地址 (URL)' },
  { input: 'Marketplace Gallery URL', expected: '插件市场列表基地址 (URL)' },

  // 11. Jetski Chat 与定制
  { input: 'Jetski Chat', expected: 'Jetski 聊天机器人' },
  { input: 'Configure a chat bot so you can use Jetski directly from Google Chat.', expected: '配置聊天机器人，以便直接从 Google Chat 中使用 Jetski。' },
  { input: 'Bot Name', expected: '机器人名称' },
  { input: 'Avatar URL', expected: '头像 URL' },
  { input: 'Token Usage', expected: 'Token 用量' },
  { input: 'The breakdown below shows token usage from customizations like rules, skills, and MCP. If a budget is exceeded, large rules are demoted to path pointers and large customizations are excluded automatically.', expected: '下方的明细展示了规则、技能与 MCP 等自定义项的 Token 用量。如果超出预算，大型规则将被降级为路径指针，大型自定义项将被自动排除。' },
  { input: 'There are no customizations enabled.', expected: '当前未启用任何自定义项。' },
  { input: 'Global', expected: '全局' },

  // 12. v2.33.0 新增界面词条测试
  { input: 'Projects', expected: '项目' },
  { input: 'Agents', expected: '智能体' },
  { input: 'Environments', expected: '运行环境' },
  { input: 'Side Question', expected: '侧边追问' },
  { input: 'Enter to Send', expected: '回车键直接发送' },
  { input: 'Enable Terminal Sandbox', expected: '启用终端沙箱' },
  { input: 'Conversation Steps', expected: '思考与执行步骤展示' },
  { input: 'Custom Context Menus', expected: '自定义右键快捷菜单' },
  { input: 'Screen Reader Mode', expected: '屏幕朗读器模式' },
  { input: 'Built-in Browser', expected: '内置浏览器' },
  { input: 'Code Search', expected: '代码搜索' },
  { input: 'Previous Worktrees', expected: '历史工作树 (Worktrees)' },
  { input: 'This Computer', expected: '当前计算机' },
  { input: 'Keybinding Scheme', expected: '快捷键方案' },
  { input: 'Reset All to Defaults', expected: '全部恢复为默认设置' },

  // 13. 用户截图重点反馈项 (v2.33.0 体验卡片、权限预设、排队消息与语音模式)
  { input: 'Knowledge Work', expected: '知识工作' },
  { input: 'Simplified interface for research, writing, and everyday tasks.', expected: '适用于调研、写作与日常任务的轻量精简界面。' },
  { input: 'Software Engineering', expected: '软件工程' },
  { input: 'Full interface for coding, developer tools, and managing agents.', expected: '具备编程、开发者工具与智能体管理的完整开发界面。' },
  { input: 'Permission Preset', expected: '权限预设' },
  { input: 'Queue', expected: '排队等待' },
  { input: 'Send Immediately', expected: '立即发送' },
  { input: 'Queue until after the current turn.', expected: '排队等待至当前轮次结束后发送。' },
  { input: 'Voice mode', expected: '语音模式' },
  { input: 'Voice', expected: '语音音色' },
  { input: 'The voice used in Voice mode. Powered by Gemini Live.', expected: '语音模式所使用的音色。由 Gemini Live 提供技术支持。' },
  { input: 'Not set', expected: '未设置' },
  { input: 'Change', expected: '更改' },
  { input: 'Microphone', expected: '麦克风' },
  { input: 'Input device for voice mode and dictation.', expected: '用于语音模式与语音输入的麦克风设备。' },
  { input: "How loud Antigravity's voice is.", expected: 'Antigravity 播放语音时的音量大小。' },
  { input: "Choose Antigravity's Voice", expected: '选择 Antigravity 的语音音色' },
  { input: 'Voices', expected: '音色选项' },
  { input: 'Save audio recordings', expected: '保存录音文件' },
  { input: 'Recordings', expected: '录音记录' },
  { input: 'Delete all', expected: '全部删除' },
  { input: 'Delete all recordings?', expected: '删除所有录音？' },
  { input: 'Clear and friendly', expected: '清晰亲切' },
  { input: 'Use Puck', expected: '使用 Puck' },
  { input: 'Deleted 3 recordings (1.2 MB)', expected: '已删除 3 条录音 (1.2 MB)' },
  { input: '5 calls · 12.4 MB', expected: '5 次通话 · 12.4 MB' },

  // 14. 用户 5 张补充截图测试 (浏览器下载位置/历史、Upgrade按钮、快捷键面板)
  { input: 'Download Location', expected: '下载保存位置' },
  { input: 'Folder where files downloaded in the built-in browser are saved.', expected: '内置浏览器下载的文件所保存的文件夹目录。' },
  { input: 'Browsing History', expected: '浏览历史记录' },
  { input: 'Clear visited URLs and autocomplete suggestions from the built-in browser.', expected: '清除内置浏览器中访问过的网址与自动补全建议。' },
  { input: 'Browser Subagent', expected: '浏览器子代理' },
  { input: 'Configure allowed and denied URLs for the browser subagent. It runs in the built-in browser, so no separate browser install is needed.', expected: '配置浏览器子代理允许与禁止访问的网址。子代理在内置浏览器中运行，因此无需另外安装独立的外部浏览器。' },
  { input: 'Upgrade', expected: '升级' },
  { input: 'Previous Side Panel Tab', expected: '上一个侧边栏标签页' },
  { input: 'Next Side Panel Tab', expected: '下一个侧边栏标签页' },
  { input: 'Submit Prompt (Alternate to Enter)', expected: '提交提问 (回车备选快捷键)' },
  { input: 'Enter always submits. This adds a second shortcut.', expected: '回车键始终用于提交。此设置可添加第二个快捷键。' },
  { input: 'Terminal: Add to Chat', expected: '终端：添加至对话' },
  { input: 'Terminal: Select All', expected: '终端：全选' },
];

let passed = 0;
for (const tc of testCases) {
  const actual = translateString(tc.input);
  assert.strictEqual(actual, tc.expected, `Mismatch for: "${tc.input}"`);
  passed++;
  console.log(`✓ [通过] "${tc.input}" => "${actual}"`);
}

// 7. 测试上下文 Type 消歧
const mockNode = {
  parentNode: {
    textContent: 'Type / and select plan to have the agent generate a plan.'
  }
};
const typeActual = translateString('Type', mockNode);
assert.strictEqual(typeActual, '输入');
console.log(`✓ [通过] Contextual "Type" => "${typeActual}"`);

const standaloneNode = {
  parentNode: {
    textContent: 'Type'
  }
};
const typeStandalone = translateString('Type', standaloneNode);
assert.strictEqual(typeStandalone, '类型');
console.log(`✓ [通过] Standalone "Type" => "${typeStandalone}"`);

console.log(`\n🎉 全部 ${passed + 2} 个关键测试项均 100% 验证通过！`);
