# 视频/内容站（小红书、B站、抖音）· L1 工单（给 AGENT）

> 编写：Claude（2026-11-14）　执行：AGENT　拍板与浏览器验证：用户
> 用户决策（2026-11-14）：
> - 不在乎老用户被 Chrome 暂时停用（用户都在私域，会自行通知）→ **直接在 manifest 加主机权限，不做可选权限/动态注册，成本最低**；
> - 互动只做**鼠标**点赞、收藏、关注；**不做**投币、三连、键盘快捷键；
> - 分两步：**本工单 = L1**（显示宠物 + 在线时长 + 滚动 + 台词，不识别互动）；L2 要先采探针，**不能凭记忆写选择器**（见第 6 节）。
> 红线：不 commit、不 push、不提交应用店；`PRIVACY.md` 本工单**不改**（用户还在考虑，见第 5 节）；币安、OKX、X、微博、知乎的行为**一律不动**。

---

## 1. 站点注册表（`shared.js` 的 `XPET.SITES`）

新增三项，`level: 'L1'`，`generic: false`，`ctrlEnterPost: false`：

| key | name | icon | clickPool | matchHost |
|---|---|---|---|---|
| `xhs` | 小红书 | 📕 | `clickXhs` | `host === 'xiaohongshu.com' \|\| host.endsWith('.xiaohongshu.com')` |
| `bilibili` | B站 | 📺 | `clickBilibili` | `host === 'bilibili.com' \|\| host.endsWith('.bilibili.com')`，**排除** `passport.` `pay.` `member.` `account.` `mall.` `show.` `cm.` 子域 |
| `douyin` | 抖音 | 🎵 | `clickDouyin` | `host === 'douyin.com' \|\| host.endsWith('.douyin.com')`，**排除** `sso.` `creator.` `pay.` `mcn.` 子域 |

**路径策略：用白名单（allowPath 只放行内容流页面），不要用黑名单。** 原因：这三个站的登录多为弹层，路径上看不出来；白名单更保守，隐私上更安全。下面路径是 Claude **凭经验推测**，标 `assumed`，需用户在浏览器里核对真实路径后微调：
- 小红书：`/`、`/explore`、`/search_result`、`/user/profile/`、`/discovery/item/`
- B站：`/`、`/video/`、`/opus/`、`/read/`、`/v/`；子域 `t.bilibili.com`（动态）、`search.bilibili.com`、`space.bilibili.com`
- 抖音：`/`、`/jingxuan`、`/discover`、`/video/`、`/user/`、`/search/`
- 所有站点统一**额外排除**：路径含 `login`、`passport`、`message`、`setting`、`account`、`pay`、`creator`、`upload`、`publish`、`draft`、`studio`。
- 测试：`tools/test_site_rules.js` 增加每站的放行/排除用例，**每条标 `observed` 或 `assumed`**。

## 2. manifest.json

- `content_scripts[0].matches` 与 `web_accessible_resources[0].matches` 同步加：
  `https://xiaohongshu.com/*`、`https://*.xiaohongshu.com/*`、`https://bilibili.com/*`、`https://*.bilibili.com/*`、`https://douyin.com/*`、`https://*.douyin.com/*`。
- **不要**碰 `permissions`；`description` 里的站点列表同步。
- `bilibili`、`douyin` 部分页面在 iframe 里，**不要**加 `all_frames`（保持只在顶层页面）。
- 版本号暂不改（等整批完成再定 0.15.0）。

## 3. 台词与设置项

- `ACTIONS` 增加 `clickXhs`、`clickBilibili`、`clickDouyin`；`VOICE_KEYS` 同步；`DEFAULT_PHRASES` 与 `VOICE_PLAYFUL` 各 3–4 句，**第一人称、不评判、不劝导**，过 `tools/lint_tone.js`。示例：
  - 小红书：「我也在翻笔记」「这篇我也点开了」
  - B站：「我也在看视频」「这个我也想看完」
  - 抖音：「我也在刷」「再刷一个就停（大概）」
- `popup.js`、`options.js`、`options.html`、`README.md` 里的站点名单同步；L1 站点今日小结显示"该站暂不统计互动"（沿用微博知乎 L1 时的实现）。

## 4. 视频站"在用"判定（B站、抖音必须做；小红书不需要）

问题：看视频时没有鼠标键盘操作，现在 60 秒后宠物判定你停下来，5 分钟后睡着。
最小方案：
- 活跃判定在原有"60 秒内有操作"之外，增加 **`document.querySelector('video')` 存在且 `!paused && !ended`** 也算活跃，**仅限 `bilibili`、`douyin`**（由 `SITES` 里加 `videoActive: true` 控制）。
- **只读布尔播放状态**，不读视频标题、地址、进度、内容。每 5 秒检查一次即可，不用事件监听。
- 全屏：**v1 不处理**，全屏时宠物看不见，接受。后续再考虑把容器挂进 `document.fullscreenElement`。
- 滚动距离：抖音按页吸附，滚动距离没意义；v1 不特殊处理，只在 L1 小结里不展示抖音的滚动数据（可选）。

## 5. 隐私（本工单不改文档，只做记录）

- 视频播放状态读取是**新的读取行为**，`PRIVACY.md` 必须在**上架这一版之前**改，否则文档比代码承诺得少。用户决定怎么改之前，**本版不得提交应用店**。
- 同时仍有一条欠账：微博知乎 L2 已翻，`PRIVACY.md` 仍写"不读取页面内容"而失效探测会读按钮文字。

## 6. L2（下一步，不在本工单）

- 范围：只做**点赞、收藏、关注**。不做发文、转发、投币、三连、键盘。
- 方法：沿用探针脱敏白名单流程，每站采集：点赞（含取消）、收藏（含取消）、关注（含取消）、**未登录点击**、**点赞数为 0**。小红书、B站、抖音的类名多半带哈希，规则必须依赖语义类/`aria`/状态类，**采不到稳定特征就不做该动作**。
- 抖音鼠标点赞：双击视频也会点赞，**v1 只认点赞按钮，不认双击**。
- B站：长按点赞会触发三连，**只在"点赞数增加"时计 like**，不计投币和收藏（收藏要有自己的确认）。

## 7. 汇报格式

已核对 / 推断 / 未验证分开；贴 `npm test` 完整输出；列出改动文件；**所有 `assumed` 的路径逐条列出，让用户核对**。
