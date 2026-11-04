# 隐私政策 / Privacy Policy for CCbd 伴宠

**最后更新日期 / Last updated**: 2026-11-05

「CCbd 伴宠」（以下简称“本插件”或“我们”）是一款运行在 Chrome 等 Chromium 内核浏览器上的开源伴宠扩展。我们高度重视用户隐私与数据安全，并严格遵守 Google Chrome Web Store 开发者计划政策及单一用途原则。

CCbd ("we", "our", or "the Extension") is an open-source browser extension designed to provide a companion desk pet while browsing supported social platforms. We respect your privacy and are committed to protecting it in compliance with the Google Chrome Web Store Developer Program Policies.

---

### 1. 数据收集与处理 / Data Collection & Usage

- **绝不收集个人信息 / No Personal Data Collection**:  
  本插件**不会**收集、记录、存储或传输任何用户的个人身份信息（PII）、浏览历史、输入内容、账号密码、钱包地址、交易记录或敏感数据。  
  The Extension does **NOT** collect, record, track, transmit, or sell any personal identifiable information (PII), browsing history, keystrokes, passwords, crypto wallet information, financial transactions, or private communications.

- **100% 纯本地存储 / 100% Local Storage**:  
  所有用户自定义的内容（包括选择的角色形象、台词文本、健康浏览时间区间、每日陪伴经验、本地统计计数等）均完全存储在用户浏览器本地的 `chrome.storage.local` 中。  
  All user data (such as chosen character looks, custom dialogue phrases, daily duration goals, experience points, and interaction counters) is stored **strictly locally** on your device using `chrome.storage.local`.

- **无第三方分析或追踪 / No Third-Party Analytics**:  
  本插件未引入任何第三方跟踪器、分析代码、广告脚本或远程服务器上报。  
  The Extension does not include any third-party trackers, analytics SDKs, advertising scripts, or remote telemetry.

---

### 2. 权限使用说明 / Permissions Justification

本插件仅申请实现其核心功能所必需的最低权限：

1. **`storage` & `unlimitedStorage`**：  
   - **用途**：仅用于在用户本地存储伴宠角色设定、台词、每日时间目标与陪伴小本子成长记录。数据永远不离开用户设备。  
   - **Purpose**: Used exclusively to store pet settings, dialogue lines, time limits, and companion milestone stories locally.

2. **`activeTab`**：  
   - **用途**：当用户点击浏览器右上角的伴宠图标弹出快捷面板时，用于判断当前标签页是否处于支持的社交广场，以便用户一键开启/关闭该站点的伴宠显示。  
   - **Purpose**: Used when the user opens the toolbar popup to detect whether the active tab is on a supported social feed, enabling one-click site toggling.

3. **主机权限 / Host Permissions (`x.com`, `binance.com`, `okx.com`)**：  
   - **用途**：仅在推特、币安广场与OK星球等社交动态信息流页面中注入伴宠悬浮组件与台词气泡。**本插件绝不会在任何交易、盯盘、资产、充值或提现等金融操作页面生效或读取数据**。  
   - **Purpose**: Strictly required to render the companion pet UI on supported social feed pages (X/Twitter, Binance Square, and OKX Planet). The Extension does NOT access, inject into, or interact with any trading, wallet, asset, or financial pages.

---

### 3. 数据删除与控制 / Data Deletion & Control

- 用户可随时在「设置」页面的「数据管理」中一键清除所有本地历史数据。
- 卸载本扩展将自动彻底删除浏览器中与本插件相关的所有本地存储数据。
- Users can clear all local history at any time from the "Data Management" section in the Options page.
- Uninstalling the Extension will immediately and permanently remove all locally stored data from your browser.

---

### 4. 政策变更与联系方式 / Policy Updates & Contact

如本隐私政策有任何调整，我们将在 GitHub 仓库公开发布更新。如果您对本隐私政策有任何疑问，请通过 GitHub 仓库提交 Issue：

If you have any questions or concerns regarding this Privacy Policy, please contact us via our official repository:  
- **GitHub**: [https://github.com/laochenjames/CCbd](https://github.com/laochenjames/CCbd)
