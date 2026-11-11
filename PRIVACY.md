# 隐私政策 / Privacy Policy for CCbd 伴宠

**最后更新日期 / Last updated**: 2026-11-07

「CCbd 伴宠」（以下简称“本插件”或“我们”）是一款运行在 Chrome 等 Chromium 内核浏览器上的开源伴宠扩展。我们高度重视用户隐私与数据安全，并严格遵守 Google Chrome Web Store 开发者计划政策及单一用途原则。

CCbd ("we", "our", or "the Extension") is an open-source browser extension designed to provide a companion desk pet while browsing supported social platforms. We respect your privacy and are committed to protecting it in compliance with the Google Chrome Web Store Developer Program Policies.

---

### 1. 数据收集与处理 / Data Collection & Usage

- **不收集个人信息 / No Personal Data Collection**:  
  本插件**不会**收集、记录、存储或传输任何用户的个人身份信息（PII）、浏览历史、你输入或发布的内容、账号密码、钱包地址、交易记录或敏感数据。  
  The Extension does **NOT** collect, record, track, transmit, or sell any personally identifiable information (PII), browsing history, the content you type or post, passwords, crypto wallet information, financial transactions, or private communications.

- **只记录「次数」和「时长」，不记录「内容」 / Counts and durations only, never content**:  
  为了在「今日统计」和设置页日历里展示数据，本插件会在**推特、币安广场、OK星球的社交动态页面**上，在本地累计发文、点赞、收藏、转发、关注的**次数**、页面处于前台且有操作的**在线时长**以及页面滚动的大致距离。它**不会**读取、保存帖子、评论或你所输入文字的内容。  
  To show your daily statistics, the Extension keeps local counters on supported social feed pages only: the **number** of posts, likes, bookmarks, reposts and follows, the active **time** spent, and approximate scroll distance. It never reads or stores the text of posts, comments, or anything you type.

- **100% 纯本地存储 / 100% Local Storage**:  
  所有数据（选择的角色形象、台词文本、画像选项、陪伴天数、统计计数、宠物位置等）均完全存储在你浏览器本地的 `chrome.storage.local` 中，不会上传到任何服务器。  
  All data (chosen character looks, dialogue lines, profile choices, companion-day count, counters, pet position) is stored **strictly locally** on your device using `chrome.storage.local` and is never uploaded.

- **无第三方分析或追踪 / No Third-Party Analytics**:  
  本插件未引入任何第三方跟踪器、分析代码、广告脚本或远程服务器上报。  
  The Extension does not include any third-party trackers, analytics SDKs, advertising scripts, or remote telemetry.

- **AI 台词生成 / AI line generation**:  
  设置页的「AI 定制台词」只是帮你生成一段提示词，由你**自己**复制到任意大模型、再把回复粘贴回来导入；本插件本身不联网、不调用任何 AI 服务。  
  The "AI line generator" in the Options page only builds a prompt for you to copy into any model of your choice and paste the reply back. The Extension itself makes no network requests and calls no AI service.

---

### 2. 权限使用说明 / Permissions Justification

本插件仅申请实现其核心功能所必需的最低权限：

1. **`storage` & `unlimitedStorage`**：  
   - **用途**：仅用于在你本地存储伴宠角色设定、台词、统计计数与陪伴记录。数据永远不离开你的设备。  
   - **Purpose**: Used exclusively to store pet settings, dialogue lines, counters and companion records locally.

2. **`activeTab`**：  
   - **用途**：当你点击浏览器右上角的伴宠图标弹出快捷面板时，用于判断当前标签页是否属于支持的站点，以便一键开启/关闭该站点的伴宠显示。  
   - **Purpose**: Used when you open the toolbar popup, to detect whether the active tab is on a supported site and let you toggle it with one click.

3. **主机权限 / Host Permissions (`x.com`/`twitter.com`, `binance.com`, `okx.com` 及其镜像域名)**：  
   - **为什么需要整站权限**：币安、OKX 是单页应用，页面之间跳转不会重新加载，所以脚本需要在这些站点的页面上加载，才能在你从别的页面进入广场/星球时及时出现。  
   - **脚本实际做什么**：脚本只根据**网址路径**判断当前是不是社交动态页面。在交易、行情、资产、充值、提现、账户、钱包等页面（以及任何不是社交动态的页面），脚本**不显示任何内容、不计时、不统计、不读取页面内容**；它只检查网址路径，然后保持静默。  
   - **Why site-wide host permissions**: Binance and OKX are single-page apps, so the script must be loaded across the site to appear when you navigate into a social feed.  
   - **What the script actually does**: it decides from the URL **path** alone whether the current page is a social feed. On trading, markets, assets, deposit, withdraw, account, wallet pages (and any page that is not a social feed) it renders nothing, does not count time, does not count interactions, and does not read page content.

---

### 3. 数据删除与控制 / Data Deletion & Control

- 你可以随时在「设置」页面的「数据管理」中一键清除所有本地历史统计，也可以导出或导入备份。
- 卸载本扩展将自动彻底删除浏览器中与本插件相关的所有本地存储数据。
- Users can clear all local history at any time from the "Data Management" section of the Options page, and can export or import a backup.
- Uninstalling the Extension will immediately and permanently remove all locally stored data from your browser.

---

### 4. 政策变更与联系方式 / Policy Updates & Contact

如本隐私政策有任何调整，我们将在 GitHub 仓库公开发布更新。如果您对本隐私政策有任何疑问，请通过 GitHub 仓库提交 Issue：

If you have any questions or concerns regarding this Privacy Policy, please contact us via our official repository:  
- **GitHub**: [https://github.com/laochenjames/CCbd](https://github.com/laochenjames/CCbd)
