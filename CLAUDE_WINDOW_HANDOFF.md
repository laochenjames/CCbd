# CCbd 国内站点适配 · 新窗口交接说明（给下一个窗口的 Claude）

> 编写：Claude（2026-11-14）　用途：让新窗口的 Claude 接上"讨论、写方案、复核 AGENT 汇报"的工作
> 项目目录：`E:\Doc\Python_daye\CCbd`（文件系统 MCP 可读写；**只读不执行**，见第 1 节）
> 本文是**工作笔记**，含协作约定，不是产品文档；是否进入公开仓库由用户决定（默认建议不入库，或加入 `.gitignore`）。

---

## 0. 怎么用这份文档

1. 用户把本文（或本文路径）发给新窗口的 Claude。
2. 新窗口先按**第 9 节**的启动清单读文件、核对状态，**不要直接信本文第 5 节的"当前进度"**——那是 2026-11-14 的快照，AGENT 可能已经改了东西。
3. 然后问用户第 9 节里的三个问题，再继续工作。

---

## 1. 角色与协作协议

**三方分工**
- **用户**：拍板产品决策；在真实浏览器里做验证和采集；执行所有 git 写操作（commit、push、改历史）；手动提交 Chrome 应用店。
- **Claude（本窗口及新窗口）**：讨论、批判性分析、写方案与工单（写成文件放在项目目录里）、复核 AGENT 的汇报和代码。**不改代码。**
- **AGENT**：按 Claude 写的工单改代码、跑测试、汇报。**不 commit、不 push、不改历史、不提交应用店。**

**用户对 Claude 的要求（来自用户设置，必须遵守）**
- 客观中立，比起讨好，更要专业、建设性的意见；用户的想法有不切实际之处要直说；
- 穷举方案，不限次数，探索到饱和；
- **输出前批判性自检**：先检查自己要给出的内容，再给用户。

**回复规范**
- 中文；先给结论，再给依据；不堆砌格式。
- 汇报一律分"**已核对**（看到了文件内容）/ **推断** / **未验证**（只有用户在浏览器里才能确认）"。**不要把"测试通过"写成"浏览器里正常"。**
- 没读过的文件、没运行过的命令，必须明说。

**工具限制（影响你怎么做事）**
- 文件系统 MCP 只能访问被授权的目录。`E:\Doc\Python_daye\CCbd_probe`（探针副本）**在授权目录之外，读不到**；`E:\Doc\Python_daye` 本身也列不出来。
- 不能执行命令：**不能跑 `npm test`、不能跑 `git`**。所有"测试通过""git 状态"都只能来自 AGENT 的汇报或用户转述，不能自己核实。
- `read_text_file` 只支持 `head` / `tail`，不支持行号区间；读大文件要分两次或用 `tail`。
- 改文件优先用 `edit_file`（精确文本替换），整文件重写用 `write_file`。

---

## 2. 项目快照

- **CCbd 伴宠**：Chrome 扩展，页面上的"桌宠"小角色 CICI。定位是"屏幕里的嘴替，不是养成，不控时长不评判"：第一人称自言自语，不劝导、不评判。
- **隐私承诺**（`PRIVACY.md`）：只看网址路径、只记次数和时长、不读内容、纯本地存储、无网络请求。
- **已在 Chrome 网上应用店上架**（推特、币安广场、OK星球），有少量用户，没做推广（用户 2026-11-13 告知）。**应用店当前版本号、安装包里是否含退役素材，用户尚未告知。**
- 仓库计划公开（隐私政策里已经指向 `github.com/laochenjames/CCbd`）；美术素材用 `ASSETS_LICENSE.md`，代码 MIT。
- **版本**：`manifest.json` 和 `package.json` 当前是 `0.14.0`。
- **关键文件**
  - `manifest.json`：内容脚本匹配的站点、`web_accessible_resources`；
  - `shared.js`：站点注册表 `XPET.SITES`、`siteKeyOf`、`siteAllowed`、`interactionPolicy`、`normalizeDay`、国内规则引擎（`DOMESTIC_RULES`、`matchDomesticRule`、`nodeMatchesSel`）、默认台词、AI 提示词；
  - `content.js`：页面里的宠物、点击与互动识别、统计、气泡；
  - `popup.js`、`options.js`、`options.html`：弹窗与设置页；
  - `tools/`：`test_*.js`（`npm test` 全部跑一遍）、`lint_tone.js`（语气规范）、`package_release.py`（打包）；
  - `tools/fixtures/weibo-chains.json`、`zhihu-chains.json`：L2 规则的脱敏夹具；
  - `_probe_data/`（已被 `.gitignore` 忽略）：探针原始数据。

---

## 3. 用户已定决策（截至 2026-11-14）

**发布与仓库**
- 不做性能测量，上线后看反馈；仓库可以公开；退役角色素材（cat/doge/pepe/teddy）与 `public/assets/pet/`、`raw_images/` 不入库，已备份到仓库外。
- 版本策略建议：0.14.0 = L1 基线；**L2 作为 0.14.1 发布，不新增任何权限**（新增主机权限会让已安装用户的扩展被暂时停用，直到重新确认）。

**国内站点范围与语义**
- 先做微博（`weibo.com`）和知乎（`zhihu.com`，含 `zhuanlan.zhihu.com`）的**桌面网页版**；**不做**移动版、`weibo.cn`、`m.weibo.cn`；之后才考虑抖音、小红书、B站（需拆开，见第 7 节）。
- 分级：**L1** = 显示宠物 + 在线时长 + 滚动距离 + 台词，**不识别互动**；**L2** = 再加互动识别。先验证，再分批。
- 互动语义（统计仍是五类：`post` / `like` / `bookmark` / `repost` / `follow`）：
  - **只要点"发送"，都算发文**：文字、图片、评论、回复；
  - 转发就是转发；收藏就是收藏；点赞就是点赞；
  - 知乎「赞同」和「喜欢」都算点赞；
  - 知乎**只算关注用户，不算关注问题**；
  - **不统计反对**（也不再采集反对样本）；知乎没有转发，不做。
- 微博不做「快转」（探针里没采到）。

---

## 4. 文档地图与权威顺序

冲突时，**越靠前越权威**。均在 `E:\Doc\Python_daye\CCbd\`：

| 文件 | 用途 | 状态 |
|---|---|---|
| `DOMESTIC_L2_RULES_REVIEW.md` | **Gate D0 复核结论 + 微博/知乎 L2 实现规格**（规则引擎字段、每条规则、测试设计、诊断、实现顺序） | **最新、最权威** |
| `DOMESTIC_PROBE_ROUND2.md` | 探针第二轮：脱敏白名单、干跑模式、采集清单 | 已执行；第 4 节"第三轮采集"见 REVIEW |
| `DOMESTIC_L2_WORKORDER.md` | Phase 3 复核修复（A 部分）+ Phase 4 总工单 | A 部分已修；C 部分以 REVIEW 为准 |
| `DOMESTIC_SITES_PLAN.md` | 国内站点总方案（Phase 0–5） | 总框架 |
| `RELEASE_PREP.md` | 公开发布准备（备份、忽略、许可证、提交命令清单）；第 0、6、13 节有 2026-11-13 的更正 | 部分执行 |
| `HANDOFF.md`、`NEXT_WINDOW.md`、`CHANGELOG.md`、`README.md` | AGENT 维护的项目记录 | **`HANDOFF.md` 的版本描述仍偏旧（读到过 v0.13.0）**，以代码和 CHANGELOG 为准 |

---

## 5. 当前进度快照（2026-11-14）

> 标注：【已核对】= Claude 读到了文件；【未知】= 没有证据。

**已完成并复核**
- 【已核对】Phase 0–3：站点注册表 `XPET.SITES`、`normalizeDay`（修复了 `bySite` 重建会丢未知站点数据的问题）、微博和知乎 L1 接入、台词与设置项、`interactionPolicy`（L1 站点不再落入通用文字规则）、AI 提示词编号修复、`popup.js` 文案、`PRIVACY.md`（已拆分各站点排除页面，对 X 的说法已与代码一致，日期 2026-11-14）。
- 【已核对】探针第二轮数据已采集（`_probe_data/weibo-round2.json`、`zhihu-round2.json`，经脱敏）。Claude 逐条读过并写出规则复核。

**正在进行（AGENT 的工作，Claude 只看到文件现状）**
- 【已核对】`shared.js` 里已经有 `DOMESTIC_RULES.weibo`（点赞、发文、转发、收藏、关注五条规则）、`nodeMatchesSel`、`matchDomesticRule`；`zhihu` 规则为空数组。
- 【已核对】**微博 `level` 在注册表里已经是 `'L2'`，知乎仍是 `'L1'`。**
- 【已核对】`tools/test_domestic_rules.js` 与 `tools/fixtures/weibo-chains.json`（15 条）、`zhihu-chains.json`（体积很小）已存在，并已加入 `npm test` 的脚本链。
- 【已核对】`CHANGELOG.md` **没有**记录 L2；`ccbd-v0.14.0.zip`（389.13KB）是 **L1 时期打的包，与当前工作区代码不一致**。
- 【未知】AGENT 是否已提交对微博 C1–C4 的完整汇报；`npm test` 是否全绿（Claude 不能运行）；git 状态（是否已提交 L1 基线）；**用户是否已做微博 Gate D1 浏览器验证**；0.14.0 是否已提交应用店。

**Claude 在新窗口里没读过的东西**：`options.js`、`options.html`、`popup.html`、`README.md` 是否同步到微博知乎；`content.js` 里国内规则的接线（点击处理、轮询确认、`once`、失效探测）；`shared.js` 里 `matchDomesticRule` 的完整实现。**这些是复核 AGENT 汇报时的首要检查对象。**

---

## 6. 未决事项（按优先级）

| # | 事项 | 负责 | 说明 |
|---|---|---|---|
| 1 | **复核 AGENT 对微博 C1–C4 的汇报与代码** | Claude | 检查清单见第 8 节 |
| 2 | **微博 Gate D1：用户浏览器逐项验证** | 用户 | 见下方清单 |
| 3 | 知乎 L2 | AGENT | 等微博通过 D1 后做；设计已确认（`DOMESTIC_L2_RULES_REVIEW.md` 第 3 节）；前置采集只剩**第 7 项**：输入框为空时点"发布""发布回答"（干跑） |
| 4 | 黑名单的真实路径 | 用户 | 38 条测试里大部分仍是 `assumed`；需要用户提供微博、知乎登录/私信/设置/支付/创作者中心/草稿的真实路径（`DOMESTIC_PROBE_ROUND2.md` 3.4） |
| 5 | **应用店现状** | 用户 | 当前版本号；已上架安装包是否含 `sprites/cat|doge|pepe|teddy/`（若含，未授权素材已随包发布，要尽快在新版本移除） |
| 6 | 0.14.0 是否已提交应用店；新增主机权限会让老用户被暂时停用 | 用户 | 商店文案要提前提示；**第二批站点之前**要决定是否改成"可选主机权限 + 动态注册内容脚本" |
| 7 | **L2 翻转前复核 `PRIVACY.md`** | Claude/AGENT | 失效探测会读取所有被点击按钮的文字，只与白名单词比较；`PRIVACY.md` 现有的"不读取页面内容"表述要明确覆盖这一点；改完提醒用户同步应用店的隐私实践页 |
| 8 | 同步 `CHANGELOG.md`、`HANDOFF.md`、`NEXT_WINDOW.md`、`README.md`、版本号（0.14.1） | AGENT | 微博 L2 通过后 |
| 9 | 抖音、小红书、B站 | 之后 | 见第 7 节 |
| 10 | 旧待办（性能、方案 B、迁移测试等） | — | 见 `RELEASE_PREP.md` 第 13 节，**全部是"收到反馈再做"** |

**微博 Gate D1（用户浏览器验证）清单**
- 点赞一次：计 1；再点取消：不计；快速连点多条：各计 1；
- 点赞数为 0 的微博：点赞能正确计数（采集 `like-zero`，**这一条没有样本，是真实未知**）；
- 转发（输入文字后点转发）：只计转发，不计发文；输入框为空时点转发：不计；
- 评论、回复（输入文字后）：计发文；空内容：不计；展开评论区：不计；
- 发微博（文字、带图片）：计发文；
- 收藏：**默认在点"…"菜单里的"收藏"时计数**。需要验证：点"收藏"后不点弹层按钮、直接关掉弹层，再打开菜单是否已变成"取消收藏"。如果不是，要改成"点弹层按钮时计数"，并告诉 Claude；
- 关注：计 1；取消关注：不计；顶部"推荐/关注"标签页：不计；
- **未登录**时点赞、关注、发送：不计数；
- `Ctrl+Enter` 是否等于发送（决定是否把 `ctrlEnterPost` 设为 `true`，目前是 `false`）；
- 黑名单页面（登录、私信、设置、支付、创作者中心）：宠物不显示；
- 推特、币安、OKX：行为与 0.14.0 一致。

---

## 7. 第二批站点（抖音、小红书、B站）的前置问题

用户原先把三者当"类似"，Claude 的判断是**不是一类**，应拆开：
- **小红书**：图文信息流，更接近微博；有登录墙；
- **B站**：长视频，有投币和三连；
- **抖音**：短视频，键盘快捷键点赞、全屏。

视频站共同的前置问题（现在不做，但现有设计不能堵死）：
- **活跃判定**：现在是"60 秒内有鼠标、键盘、滚轮、触摸"才算在用。看视频时没有操作，宠物会判定你停下来，5 分钟后趴下睡着。需要"正在播放也算活跃"，这会读取 `video` 元素的播放状态，**必须先更新隐私政策、得用户确认**；
- **全屏**：宠物挂在 `document.body` 下，视频全屏时不可见；
- **滚动距离**对按页吸附的短视频没有意义；
- 建议这批**先做 L1**（只显示宠物和计时，不依赖脆弱的选择器），再看反馈决定是否升级。

---

## 8. 复核 AGENT 汇报时的检查清单

**代码与测试（先读文件再下结论）**
1. `content.js` 里国内站点的接线：`matchAction` 对 L2 国内站点是否只走新规则引擎、`generic` 是否为 `false`、`ctrlEnter` 是否走 `interactionPolicy`；币安、OKX、X 的路径是否**完全没动**。
2. `matchDomesticRule` / 引擎是否支持工单要求的字段：`text`（完全相等）、`notClassWord`（**整词匹配**，不是子串）、`ancestorHasEditor`、`labelStartsWith`、`mustBeInside`、`mustNotBeInside`、`pre`、`post`（`countIncrease`、`textChanged`、`presentClass`、`ariaIs`）、`pollMs`（**上限 2000**）、`once`。
3. 微博点赞：是否轮询到 2 秒、**只在数字变大时计数**；点赞数为 0（文字可能是"赞"）是否保守处理；
4. **失效探测**：`unmatchedAction` 是否只记白名单词，不记其它内容。
5. **夹具真实性**：`weibo-chains.json` 里的 `comment-send-enabled`、`repost-confirm-enabled` **不在探针数据里，是 AGENT 合成的"可点击状态"**。应当明确标注 `synthetic`，并在汇报里说明它们是假设；真实证据是带 `disabled` 的那几条。
6. 静态类名检查是否覆盖：`css-` 开头、`_名字_哈希_数字`、18 到 22 位无连字符字母数字串。**注意 `HASH_CLS_RE` 的写法**（`test_domestic_rules.js`），确认它能拒绝 `_item_1z046_40` 和 `FEfUrdfMIKpQDJDqkjte`，且不会误拒 `woo-like-main`、`VoteButton` 这类语义类。
7. 汇报是否贴了 `npm test` 完整输出，且把"已核对 / 推断 / 未验证"分开。

**需要警惕的历史教训**
- **L1 站点曾落入通用文字规则**：`matchSiteRule` 返回 `null` 后 `matchAction` 继续往下走，微博知乎会按"赞、发送、转发"等文字误计数。已用 `interactionPolicy` 修复。**任何新增站点或改动 `matchAction` 都要重新检查这一类漏洞。**
- **测试全绿只证明代码与测试写手的假设一致**：黑名单测试曾大量标注 `assumed`，必须区分 `observed` 与 `assumed`。
- **探针第一版泄露过内容**（`data-zop` 里的作者昵称、`title` 里的账号名）。第二版已改成白名单脱敏。任何新的采集都要沿用这些红线。
- **600ms 窗口对微博点赞不够**（第一次点赞时 600ms 后数字仍未变）。国内站点一律"确认到状态变化才计数，宁可少计，不要误计"，币安、OKX 保持原样。
- **`PRIVACY.md` 不能比代码承诺得更多**：曾把 X 也写进"支付、创作者、草稿页隐藏"，实际 X 只排除 `/messages`、`/settings`、`/i/flow`、`/i/chat`。已拆开。每次改动站点范围或读取行为都要回头核对。
- 微博 `disabled` 是**普通类名**，不是 `disabled` 属性：按钮仍可点击，所以规则必须检查类名里有没有 `disabled` 这个词。知乎的"禁用状态"没采到，如果它用真正的 `disabled` 属性，浏览器不会触发点击；如果用类名，会误计。

---

## 9. 新窗口启动清单

1. 读本文，再读 `DOMESTIC_L2_RULES_REVIEW.md`（最权威）。
2. 读 `shared.js`（重点：`SITES`、`interactionPolicy`、`DOMESTIC_RULES`、`matchDomesticRule`、`nodeMatchesSel`，**用 `head` 加 `tail` 分次读**）和 `content.js` 中国内规则的接线部分，确认第 5 节"当前进度"是否还成立。
3. 读 `tools/test_domestic_rules.js`、`tools/fixtures/*.json`、`CHANGELOG.md` 顶部。
4. **向用户确认三件事**（一次问清，不要分多轮）：
   - AGENT 是否已经交了微博 C1–C4 的汇报？汇报内容是什么（请用户粘贴）；
   - 微博 Gate D1 的浏览器验证做了没有？结果如何；
   - 应用店当前的版本号，以及 0.14.0 有没有提交。
5. 然后进入"复核 AGENT 汇报"（第 8 节清单），再决定：是继续微博修正，还是放行知乎。

**可直接粘贴到新窗口的启动提示**

> 我在做 CCbd 伴宠扩展的国内站点适配（微博、知乎），你是"讨论、写方案、复核"的角色，AGENT 负责改代码，我负责浏览器验证和 git。请先读 `E:\Doc\Python_daye\CCbd\CLAUDE_WINDOW_HANDOFF.md` 和 `DOMESTIC_L2_RULES_REVIEW.md`，再按交接文档第 9 节的清单核对当前状态。你不能运行命令，只能读文件；汇报请分"已核对/推断/未验证"。要求客观中立、批判性思考，有不切实际的地方直接指出。
