# Antigravity 中文本地化项目 (Antigravity-i18n)

专为 **Google Antigravity** 桌面客户端打造的高性能、无损、可逆的中文汉化工具与词典系统。

---

## 🌟 特色与设计亮点

1. **零底层破坏**：无需逆向或重新编译 Go 语言后端二进制 (`language_server.exe`)，保持官方版本稳定运行与网络互联。
2. **多版本兼容**：采用 Electron Preload 动态 DOM 注入与 MutationObserver 响应式监听，即使客户端自动更新，已翻译内容仍然平滑生效，未收录新词条优雅显示原英文。
3. **原生与界面全覆盖**：
   - 顶部系统原生菜单（文件、编辑、视图、窗口、帮助、WSL 模式等）。
   - 系统托盘右键菜单。
   - 左侧导航栏（新建对话、项目、计划任务、技能定制、设置等）。
   - 核心设置面板（模型配额与用量、工具执行策略、终端沙箱、网络权限、外观等）。
   - 对话交互区与操作卡片（审批、拒绝、改动对比、子代理、成果物等）。
4. **一键运维与自动备份**：打补丁前自动保存 `app.asar.bak`，支持随时一键完全复原官方原版。
5. **智能启动守护**：提供一键启动脚本 `apply-zh.bat` 与桌面快捷方式，自动应用汉化、清理静默更新缓存、并等待界面就绪后自动关闭控制台窗口。

---

## 🚀 快速上手

### 1. 桌面快捷方式启动（推荐）
双击桌面的 **`antigravity`** 图标，启动器将自动完成补丁校验并拉起 Antigravity，在界面完全就绪后黑窗口自动关闭。

### 2. 命令行一键应用汉化
```bash
npm run patch
```

### 3. 一键还原官方原版英文
双击根目录下的 **`restore-en.bat`**，或运行：
```bash
npm run restore
```

### 4. 运行全量测试套件
```bash
npm test
```

---

## 📁 项目目录结构

```
plus/
├── bin/
│   └── cli.js                 # 核心命令行工具 (patch / restore / status / extract)
├── src/
│   ├── core/
│   │   ├── asar-manager.js    # ASAR 安全解包、打包、备份与还原
│   │   ├── patcher.js         # 注入器模块 (向 preload.js 和 menu.js 插入钩子)
│   │   └── scanner.js         # 词条扫描提取工具 (新版本词条发现与字典同步)
│   └── runtime/
│       ├── i18n-runtime.js    # 注入到前端的高性能汉化引擎
│       └── font-override.css  # 中文字体美化样式 (Microsoft YaHei UI / 微软雅黑)
├── locales/
│   └── zh-CN/                 # 模块化中文词典
│       ├── menu.json          # 顶部菜单栏与托盘
│       ├── sidebar.json       # 侧边栏导航 (对话、项目、任务、设置等)
│       ├── settings.json      # 设置面板所有选项与说明
│       ├── chat.json          # 聊天主区、操作按钮、卡片与工具交互
│       └── common.json        # 通用操作词条 (保存、取消、复制、确定等)
├── scripts/
│   ├── apply.js               # 启动应用、补丁部署与界面就绪检测核心
│   ├── restore.js             # 原版核心恢复脚本
│   └── create_shortcut.js     # 桌面快捷方式创建与修复
├── test/
│   ├── test-pipeline.js       # 端到端打包与补丁注入完整性测试
│   └── test-user-strings.js   # 界面词条覆盖与上下文匹配测试 (96项)
├── apply-zh.bat               # Windows 一键中文启动批处理 (纯净无依赖)
├── restore-en.bat             # Windows 一键恢复原版批处理
├── package.json               # 项目包配置与脚本
└── README.md                  # 使用说明手册
```

---

## ✍️ 自定义与扩充词条

所有词条均采用模块化 JSON 存储在 [`locales/zh-CN/`](file:///d:/Projects/plus/locales/zh-CN/) 目录下：

- **精确匹配 (`exact`)**：
  ```json
  {
    "exact": {
      "English Text": "中文翻译"
    }
  }
  ```
- **正则模式匹配 (`patterns`)**：
  ```json
  {
    "patterns": [
      {
        "regex": "^(\\d+)\\s+files?\\s+changed$",
        "replace": "$1 个文件变动"
      }
    ]
  }
  ```

修改或添加词条后，运行 `npm run patch` 或双击 `apply-zh.bat` 即可重新打包生效。
