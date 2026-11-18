# CCbd 国内站点 L2 · Gate D0 复核结论与实现规格（给 AGENT）

> 编写：Claude（2026-11-14）　执行：AGENT　拍板与浏览器验证：用户
> 依据：`_probe_data/weibo-round2.json`、`zhihu-round2.json`（Claude 逐条读过原始数据）。AGENT 的两张规则设计表没有随消息一起送到，**本复核直接基于原始探针数据**；如果你的表与本文不一致，以"探针标签（label）"为证据逐条对照，说明差异理由。
> 结论：**微博可以立即开始 C1–C4；知乎设计已确认，但按原计划等微博通过 Gate D1 后再实现。**

---

## 0. 对数据本身的复核

**隐私**：已核对，数据里没有账号名、昵称、正文；`data-*` 值、`title`、计数文字之外的文字都已是 `<redacted>`。可继续使用。

**数据缺口（会影响规则可信度，在 Gate D1 由用户验证，不阻塞微博实现）**

| 缺口 | 影响 |
|---|---|
| 微博、知乎都**没有未登录的采集** | 未登录点击会弹登录框，必须保证**不计数**。下面所有切换型规则都用"点击后确认状态变化才计数"，原因就在这里 |
| 微博 `repost-confirm`、`comment-send`、`comment-reply` 三条记录里的按钮**都带 `disabled` 类**，即**只采到了"禁用状态"，没采到"可点击状态"**。`post-send` 的"发送"按钮是可点击状态，没有 `disabled` | 规则只依赖"类名里**没有** `disabled` 这个词"，不依赖可点击状态的完整类名，所以不阻塞；但要用户验证"输入文字后点转发、点评论确实各计 1 次" |
| 微博点赞数为 0 时按钮上显示什么文字，没有样本 | 解析 0 赞的情况要保守，见 2.1 第 2 条 |
| 微博收藏：点菜单里的"收藏"后弹出一个带按钮的层（按钮文字 2 个字，不在白名单里，所以被脱敏），**无法判断收藏是在点菜单时生效，还是点层里按钮时生效** | 见 2.2，让用户在 Gate D1 验证 |
| 微博「快转」没有采到（`repost-quick` 只点到了"…"菜单） | **不做快转** |
| 知乎**没有「反对」按钮的样本** | `VoteButton` 可能同时包含赞同和反对，见 3.1 |
| 知乎"发布""发布回答"按钮的**禁用状态**没采到 | 见 3.4 |
| 知乎收藏的确认按钮只有干跑记录，**没有点击后的状态** | 见 3.3 |

**标签混乱（不影响分析，仅提醒）**：个别记录标签与动作不符（如知乎 `agree-feed-2` 里混入了点"发想法"菜单项，`comment-send` 里混入了点"写回答"）。后续不要依赖标签做自动分类，只作为人工对照。

---

## 1. 规则引擎设计修正（对 C1 的补充，**以本节为准**）

原 C1 的规则格式 `{ act, sel, toggle?, ... }` **不够用**：微博的发送、评论、转发共用同一个按钮样式，只能靠按钮文字区分；点赞要靠"点击后数字变大"。要求如下：

### 1.1 规则引擎吃"事实"，不吃 DOM

- 在 `shared.js` 增加纯函数 `XPET.ruleMatches(rule, chain)`，其中 `chain` 是**从点击目标往上最多 12 层的节点事实数组**，每层只有：`{ tag, role, cls: [类名数组], aria, text, disabled, hasEditor }`。
  - `text` 和 `aria`：**只对第一个 `button` / `[role=button]` 祖先**读取，文字长度沿用现有 40 字符上限；其余层不读文字；
  - `hasEditor`：该层的子孙里是否存在 `textarea`、`[contenteditable]`、`[role=textbox]`（**只在规则声明了 `ancestorHasEditor` 时才计算**，避免每次点击都扫 DOM）；
  - 不读取任何输入框内容。
- `content.js` 只负责把真实 DOM 转成这个 `chain`，再调用 `XPET.ruleMatches`。
- **好处：不需要 `jsdom`，就能用探针数据做回归测试**（见 5）。

### 1.2 规则字段

```
{
  act:   'post' | 'like' | 'bookmark' | 'repost' | 'follow',
  sel:   一个 CSS 选择器（对应 chain 里的某个节点，只能用 tag、语义类、aria 属性）,
  text:  可选，按钮文字必须"完全等于"数组中的某一项（来自白名单词）,
  notClassWord: 可选，类名里不得出现的词（如 'disabled'）——按"整词"匹配，不是子串,
  ancestorHasEditor: 可选，往上最多 N 层内必须有一个 hasEditor 为 true 的祖先,
  labelStartsWith: 可选，点击前按钮的 aria-label 或文字必须以数组中的某一项开头（用于知乎赞同：['赞同']；文字长度仍受 40 字符上限）,
  mustBeInside: 可选，往上最多 N 层内必须有一个匹配此选择器的祖先,
  mustNotBeInside: 可选，往上最多 N 层内不得有匹配此选择器的祖先,
  pre:   可选，点击时的前置状态（如 { absentClass: 'is-active' }、{ ariaIs: '喜欢' }）,
  post:  可选，点击后的确认条件，二选一或组合：
         { presentClass | absentClass | ariaIs | textChanged | countIncrease: true },
  pollMs: 可选，确认窗口，默认 1500，**上限 2000**,
  once:  可选，去重范围（如 'modal' 表示同一个弹窗打开期间只计一次）,
  evidence: 必填，探针标签数组，如 ['like-card-1','like-detail-1']
}
```

### 1.3 统一原则：宁可少计，不要误计

- 凡是带 `post` 的规则：**在确认窗口内没有观察到确认条件，就不计数**。这与现有币安/OKX 的 `bumpToggle` 不同（那边是"无法判断时按点赞计"），**不要改动币安/OKX 的行为**，国内站点走新引擎。
- 同一个目标元素 800ms 内重复触发，只处理第一次。
- 点击时目标已被移出文档（`isConnected === false`）则不计数。

---

## 2. 微博规则（批准实现）

> 稳定性说明：下列选择器里，`woo-*`、`wbpro-*` 是微博组件库的前缀类，**看起来稳定，但不保证以后不改**，必须配合诊断兜底（见 6）。所有 `_xxx_哈希_数字` 形式的类名（如 `_cur_198pe_148`、`_btn_1eajd_51`）**一律不用**，即使其语义部分看起来有用。

| 动作 | 规则 | 证据与说明 |
|---|---|---|
| **点赞** `like` | `sel: 'button.woo-like-main'`；`post: { countIncrease: true }`，`pollMs: 2000` | 证据：`like-card-1`、`like-detail-1`。**关键事实**：第一次点赞时，600ms 后数字仍是 471，类也没变；而详情页那次在 600ms 内就变了。**所以现有的 600ms 窗口不够，必须轮询到 2 秒**。取消点赞时数字变小（472→471、56→55），不满足"增加"，因此不计。读取数字的位置是按钮自己的文字（形如 `471`），用现有的 `parseCount` |
| **发文** `post` | `sel: 'button.woo-button-main'`，`text: ['发送','评论']`，`notClassWord: 'disabled'`，`ancestorHasEditor`（最多 8 层） | 证据：`post-send`（"发送"，可点击状态）、`comment-send`、`comment-reply`（"评论"）。**评论的发送按钮和展开评论区的入口是两回事**：入口是 `i.woo-font--comment`（`title="评论"`），不是 `button`，不会匹配 ✔。**用户要求"只要点发送都算发文"，所以评论、回复都归为 `post`** |
| **转发** `repost` | `sel: 'button.woo-button-main'`，`text: ['转发']`，`notClassWord: 'disabled'`，`ancestorHasEditor`（最多 8 层） | 证据：`repost-confirm`。**转发的入口是工具栏里的 `span`（哈希类），不是 `button`，不会匹配** ✔。转发表单是**内联在卡片里**的（`dialogAppeared` 为 `false`，`inDialog` 为 `false`），**不要写"必须在 dialog 里"这类容器条件** |
| **收藏** `bookmark` | `sel: '[role="button"].woo-pop-item-main'`，`text: ['收藏']`；`once: 'modal'` | 证据：`bookmark-1`。收藏入口在"…"菜单里，菜单项文字区分"收藏"和"取消收藏"（`bookmark-2`），**文字完全等于"收藏"才计**。点完菜单项会弹出一个带按钮的层（`woo-modal-wrap`），**层里的按钮不计**。见 2.2 |
| **关注** `follow` | `sel: 'button.woo-button-main'`，`text: ['关注','+关注']`；`post: { textChanged: true }`，`pollMs: 1500` | 证据：`follow-1`。点击后按钮从 `woo-button-primary` 变成 `woo-button-default`，并弹出提示层。顶部的"推荐 / 关注"标签页是 `div.woo-tab-item-main`，**不是 `button`，不会匹配** ✔ |
| 取消关注、取消收藏、取消点赞 | 不计 | — |

### 2.1 微博实现时的注意事项（逐条）

1. `disabled` 是**普通类名**，不是 `disabled` 属性：按钮仍然可点击、点击事件仍然会触发，所以 `notClassWord: 'disabled'` **必须存在**。这就是 AGENT 提到的那个细节，复核结论是：**判断正确，规则必须这样写，并且要有测试**（用 `repost-confirm`、`comment-send` 的探针链各做一条"应当不计"的用例）。
2. 点赞数为 0 时按钮上可能显示"赞"这样的文字而不是数字：`parseCount` 对它会返回 `NaN`。处理方式：**若点击前文字是 `NaN` 且等于"赞"，当作 0；点击后读到数字且大于前值则计数；读不出数字则不计。**
3. `ancestorHasEditor` 为真，只说明按钮附近有输入框，**不说明输入框里有内容**。内容为空时按钮带 `disabled` 类，由规则 1 排除。
4. `Ctrl+Enter`：`ctrlEnterPost` 保持 `false`，等用户验证微博里 `Ctrl+Enter` 是否等于发送，再决定是否开启。
5. 不要为快转写任何规则。

### 2.2 收藏的计数时机

**默认在点"收藏"菜单项时计数**（不是点弹层里的按钮）。依据：弹层里的按钮不在文字白名单里，且弹层可能还会被用于选分组或标签，把它当作"收藏成功"风险更大。**需要用户验证（Gate D1）**：点"收藏"后，不点弹层按钮，直接关掉弹层，再打开"…"菜单，看里面是不是已经变成"取消收藏"。如果是，说明收藏在点菜单项时就生效，默认设计正确；如果不是，需要改成"点弹层按钮时计数"，并告诉 Claude。

---

## 3. 知乎规则（设计确认，**暂不实现**，等微博通过 Gate D1）

| 动作 | 规则 | 证据与说明 |
|---|---|---|
| **点赞（赞同）** `like` | `sel: 'button.VoteButton:not(.VoteButton--down)'`（`--down` 是推断，见 3.1）；`labelStartsWith: ['赞同']`；`pre: { absentClass: 'is-active' }`；`post: { presentClass: 'is-active' }`，`pollMs: 1500` | 证据：`agree-answer-1`、`agree-feed-1`、`agree-feed-2`（首页的 `ArticleItem` 也是同一个类）。**点击时的 `chain` 就是点击前的状态**：第一次点击时没有 `is-active`，600ms 后新增；取消时点击前有、之后移除。所以"点击前没有、点击后有"才计 |
| **点赞（喜欢）** `like` | `sel: 'button.ContentItem-action[aria-label="喜欢"]'`；`post: { ariaIs: '取消喜欢' }` | 证据：`like-1`（`aria="喜欢"`）、`like-2`（`aria="取消喜欢"`）。`aria-label` 本身就区分状态，是最稳的特征 |
| **收藏** `bookmark` | `sel: 'button.Favlists-updateButton'`，`text: ['收藏']`，`mustBeInside: '.FavlistsModal'`，`once: 'modal'` | 证据：`bookmark-confirm`（干跑）。打开收藏夹的入口是 `button.ContentItem-action[aria-label="收藏"]`，**不计**。**没有点击后的状态数据**，见 3.3 |
| **发文** `post` | `sel: 'button'`（带 `Button` 类），`text: ['发布','发布回答']`，同时满足 `mustBeInside` 其一：`.Comments-container`（评论）、`.WritePinToolbar`（想法）、`.AnswerAdd`（回答） | 证据：`comment-send`（"发布"，在 `Comments-container` 内）、`pin-send`（"发布"，在 `WritePinToolbar` 内）、`answer-send`（"发布回答"，在 `AnswerAdd` 内）。**这三个容器类都是语义类**，不是哈希。专栏写文章页在 `zhuanlan.zhihu.com/write`，已被黑名单排除 |
| **关注** `follow` | `sel: 'button.FollowButton'`，`pre: { absentClass: 'Button--grey' }`，`post: { presentClass: 'Button--grey' }`，**`mustNotBeInside: '.QuestionHeader'`** | 证据：`follow-user-1`/`unfollow-user-1`（用户）、`follow-q-1`/`unfollow-q-1`（问题）。两者用的是**同一个 `FollowButton` 类**，区别只有祖先。**用户已决定（2026-11-14）：只算关注用户，不算关注问题，见 3.2** |
| 转发 | **不做** | 知乎没有转发 |
| 取消赞同、取消喜欢、取消关注 | 不计 | — |

### 3.1 `VoteButton` 的风险（推断，需要补样本）

探针里只有赞同按钮，类是 `Button VoteButton <随机串>`。我记得知乎的"反对"按钮通常也带 `VoteButton`，只是多一个 `VoteButton--down` 类，**这只是推断，没有证据**。如果反对被计成点赞，是明显误计。所以：
- 用户已决定**不统计反对**，也**不再要求采集「反对」样本**。为了在没有样本的情况下仍然保证反对不会被误计成点赞，规则里**加三道保险**：① `:not(.VoteButton--down)`；② **点击前**按钮的 `aria-label` 或文字必须以“赞同”开头（“已赞同”不匹配，反对按钮的文字不会以“赞同”开头）；③ 仍然要求点击后出现 `is-active`。三者缺一不计；
- **局限**：①②是凭 UI 文字习惯做的推断（探针里赞同按钮的 `aria` 和文字都被脱敏成了 `<redacted:N>`，长度与“赞同 + 数字”吻合，但没有逐字证据）。如果实际文字不是以“赞同”开头，规则会永远匹配不上，表现为知乎点赞一直不计数，失效探测会把它记成 `unmatchedAction`。**Gate D1 时用户验证：赞同计 1 次；顺手点一次反对（再取消），确认不计数。**

### 3.2 已决定：关注问题不算 `follow`（用户，2026-11-14）

- **用户已决定：只算关注用户，不算关注问题。** 当初的理由：台词"关注新账号"和统计里的"关注"语义是账号；关注问题更像收藏，且不是在"发现一个人"。
- 规则里的 `mustNotBeInside: '.QuestionHeader'` 保持不变。
- 此项已关闭，不需要再回复。

### 3.3 知乎收藏

- 只有干跑数据，没有点击后状态，所以无法写 `post` 确认条件；先用 `once: 'modal'` 保证同一个弹窗里只计一次。
- Gate D1 时用户要验证：收藏夹里**点"收藏"后，该条是否真的被收藏**，以及**同一弹窗里连续收藏两个收藏夹只计 1 次**。
- 第三轮采集里补一条**live 模式**的收藏记录（点收藏，立刻再点取消），拿到点击后的状态。

### 3.4 知乎发布按钮的禁用状态

- 没采到。知乎的按钮如果是**真正的 `disabled` 属性**，浏览器不会触发点击，天然不会误计；如果像微博一样用类名表示禁用，就会误计。
- 第三轮采集补：**空内容时点"发布""发布回答"（干跑）**，看按钮有没有 `disabled` 属性或类名里的 `disabled`。

---

## 4. 第三轮采集（小，**不阻塞微博**；知乎只需要第 7 项）

沿用 `DOMESTIC_PROBE_ROUND2.md` 的方法和红线。每项都在对应站点做：

**微博（用于 Gate D1 验证，不阻塞实现）**
1. `like-zero`：找一条**点赞数为 0** 的微博，点赞再取消（live），记录按钮上的文字；
2. `like-loggedout`：退出登录后点赞（live）；
3. `repost-enabled`：在转发框里**输入任意文字**后点转发（**dry**），拿到可点击状态下的类名；
4. `comment-enabled`：同上，评论（**dry**）。

**知乎（只有第 7 项是前置条件，其余在 Gate D1 验证即可）**
5. ~~`vote-down`~~ **已取消**（用户决定不统计反对，见 3.1）；
6. `agree-loggedout`：退出登录后点赞同（live）；
7. `publish-empty`：**输入框为空**时点"发布"（评论）和"发布回答"（dry）；
8. `bookmark-live`：收藏夹里点"收藏"（**live**），再点一次取消，拿点击后的状态；
9. `follow-profile`：在某个用户的个人主页上点关注再取消（live）。

---

## 5. 测试设计（C4 修订，**以本节为准**）

**不安装 `jsdom`。** 用探针数据本身做回归：

1. 把探针样本整理成**脱敏夹具** `tools/fixtures/weibo-chains.json`、`zhihu-chains.json`，只保留：`label`、`expect`（期望的 `act`，或 `null`）、`chain`（每层只留 `tag`、`role`、`cls` 数组、`aria`、白名单内的 `text`、`disabled`、`hasEditor`）。**不要保留任何 `data-*`、`title`、被 `<redacted>` 的字段。** 这些夹具会进公开仓库，提交前要自查一遍。
2. `tools/test_domestic_rules.js`：对每条夹具调用 `XPET.ruleMatches`，断言期望动作。**必须覆盖的反例**（"应该不计"）：
   - 微博 `repost-confirm`、`comment-send`、`comment-reply` 的**禁用状态**记录 → `null`；
   - 微博 `comment-open`（`i.woo-font--comment`）→ `null`；
   - 微博 `repost-open`（`span`）→ `null`；
   - 微博"取消收藏"菜单项 → `null`；
   - 微博顶部"推荐/关注"标签页 → `null`；
   - 知乎 `bookmark-open`（`aria="收藏"` 的入口）→ `null`；
   - 知乎 `unfollow-*`（`Button--grey`、文字"取消关注"）→ `null`；
   - 点击页面空白 / 宠物自己 → `null`。
3. 静态检查（原 C4 第 2 条）补充一条：**拒绝任何长度 18 到 22、只含字母数字和下划线、不含连字符的类名**（知乎的 `FEfUrdfMIKpQDJDqkjte`、`JmYzaky7MEPMFcJDLNMG`、`epMJl0lFQuYbC7jrwr_o` 属于这种），以及 `css-` 开头的类名、`_名字_哈希_数字` 形式的类名。允许的语义类包括：`VoteButton`、`FollowButton`、`Favlists-updateButton`、`Comments-container`、`AnswerAdd`、`WritePinToolbar`、`ContentItem-actions`、`is-active`、`Button--grey`、`woo-like-main`、`woo-button-main`、`woo-pop-item-main`、`wbpro-form`。
4. 每条规则的 `evidence` 必须能在夹具里找到同名 `label`。

---

## 6. 诊断（C 部分第 7.3 条的落实）

- 为这两个站点各记录一条"最近一次识别到的动作"（沿用 `setStatus({ lastAction, lastActionAt })`，加上站点 key）。
- **新增一条失效探测**：国内站点上，如果用户点了任何文字在白名单里（赞、转发、评论、收藏、关注、发送、发布、发布回答）的 `button` 或 `[role=button]`，但**没有规则命中**，就 `setStatus({ unmatchedAction: <白名单词>, unmatchedAt: Date.now() })`。**只记白名单词，不记类名以外的任何内容。** 这样站点改版后，设置页能看到"点了发送但没识别"，比 X 的 `unmatchedTestid` 更直接。**该改动不扩大隐私读取范围**（白名单词本来就是按钮文字，且已在规则里使用）。

---

## 7. 实现顺序与 Gate

1. **现在**：做微博的 C1–C4（引擎、规则、夹具与测试、诊断）。`level` 暂时仍是 `'L1'`，**用一个临时开关（不进注册表）在开发中验证**，通过测试后再改成 `'L2'`。
2. 完成后汇报，包含：`npm test` 完整输出、夹具里每条用例的期望与结果、改动文件清单、**未验证项**（见下）。
3. **Gate D1（用户浏览器验证）**，除了 L2 工单 C5 的表，再加：
   - 微博收藏的计数时机（见 2.2）；
   - 微博点赞数为 0 的情况（采集 `like-zero`）；
   - 微博未登录点赞、关注，**不计数**；
   - 输入文字后点转发、点评论、点发送，**各计 1 次**；
   - 输入框为空时点转发、点评论，**不计数**；
   - `Ctrl+Enter` 是否等于发送。
4. 微博 Gate D1 通过后，补第三轮的知乎样本，再做知乎。
5. **每次把某个站点的 `level` 改成 `'L2'` 之前**，复核 `PRIVACY.md` 对"读取被点击按钮的文字或 `aria-label`"的表述是否已经覆盖微博、知乎（失效探测会对所有被点击的按钮读取文字，只用于和白名单词比较，不保存、不上传）。表述不到位就先改文档，并提醒用户同步应用店的隐私实践页面。

---

## 8. 汇报格式

沿用总方案：已核对 / 推断 / 未验证三类分开。本次尤其要把"依据探针样本的"和"凭经验推断的"分开写。
