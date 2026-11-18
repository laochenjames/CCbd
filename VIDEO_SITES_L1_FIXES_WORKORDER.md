# 视频站 L1 · 收尾工单（给 AGENT）

> 编写：Claude（2026-11-15）　执行：AGENT　验证：用户
> 前提：`VIDEO_SITES_L1_WORKORDER.md` 的主体已完成，用户已在浏览器确认三站宠物正常显示。
> 红线不变：不 commit、不 push、不提交应用店；**不改 `PRIVACY.md`**（用户尚未批准措辞）；不动币安、OKX、X、微博、知乎的行为。

## 1. AI 提示词补齐三个新动作（`shared.js` 的 `XPET.AI.buildPrompt`）

现象：编号列表只到 `clickZhihu`，JSON 模板里没有 `clickXhs`、`clickBilibili`、`clickDouyin`，AI 生成的角色不会产出这三类台词，只能回退默认台词。
要求：
- 在 `clickZhihu` 之后补三类，格式与其他站点一致（3~4 句，"我也在……"）；后面各类编号顺延，**保证连续**。
- 同步 JSON 模板里的 `phrases`。
- `tools/test_sites_domestic.js` 里写死的编号行数（现为 17）改为实际条数；断言的站点名遍历已经自动覆盖，不用动。
- 检查 `options.js` / `options.html` 中 AI 导入或台词编辑界面是否有写死的动作列表，没有则不用改，**有则同步**，并在汇报里写明。
- 占位符规则不变（`{days}` 只在里程碑，`{title}` 只在日记，`{name}` 只在装扮）。

## 2. 老角色升级测试补三个键

- `tools/test_sites_domestic.js` 里已有老角色缺 `clickWeibo`、`clickZhihu` 时 `normalizeChar` 自动补全的断言，**增加** `clickXhs`、`clickBilibili`、`clickDouyin` 三条同样的断言。
- 如果断言失败，说明老用户的角色数据在这三个站没有点击台词，**修 `normalizeChar`**，不要改测试。
- 同时确认：用户已改过的角色台词**不能被覆盖**（沿用现有的"完全一致才升级"原则）。

## 3. `videoActive` 的实现与测试

背景：`shared.js` 里 B站、抖音已有 `videoActive: true`，但 Claude 在 `content.js` 前 400 行没看到它被使用，也没有任何测试覆盖。
先做：**在 `content.js` 里搜 `videoActive`**，汇报是否已有实现、在哪一行。
- 若已有实现：检查是否符合下面的约束，补测试。
- 若没有：按下面实现。

约束（隐私红线）：
- 只读 `document.querySelectorAll('video')` 每个元素的**播放布尔状态**（`paused`、`ended`、`readyState`、`currentTime` 是否大于 0 即可）。**不读** `src`、`currentSrc`、`title`、`duration`、封面、字幕、页面文字、地址里的 BV 号。
- 只对 `videoActive: true` 的站点生效；其他站点不查。
- 每 5 秒检查一次，不用事件监听；页面隐藏（`document.visibilityState !== 'visible'`）时不查、不算活跃。
- 把判断写成 `shared.js` 里的**纯函数**（输入是只含布尔和数字的数组，如 `[{paused, ended, readyState, currentTime}]`），便于 `node` 测试。
- 活跃判定：原来的"60 秒内有操作" **或** 存在一个 `!paused && !ended && readyState >= 2 && currentTime > 0` 的视频。
- 已知局限（汇报里写进去，**不要自己加复杂判断**）：B站首页卡片悬停预览、抖音页面常驻视频，也会算活跃。这是 v1 接受的取舍。
- 测试：覆盖"无视频""暂停""结束""缓冲中 readyState<2""正常播放""多个视频只要一个播放""非视频站点不调用"。

## 4. 汇报格式

已核对 / 推断 / 未验证分开；贴 `npm test` 完整输出；列出改动文件和行号；**第 3 节先单独汇报 `videoActive` 原先是否有实现**。
