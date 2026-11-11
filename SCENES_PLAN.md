# 背景场景功能 · 执行方案（给 AGENT）

> 本文件由讨论结论整理而成，用来指导 AGENT 实现「小桌宠背景场景」。
> 开工前先读 `HANDOFF.md` 的「零、接手说明」，并遵守其中的工作约定（先评估再动手；汇报时分开写「已核对 / 推断 / 未验证」）。

---

## 0. 目标与范围

**要做什么**：在小桌宠后面加一层可选的手绘背景（雨天、午后暖光、夜晚……），让它从「透明贴纸」变成「坐在一个小场景里」。同时停用不协调的「桌搭/工位伴侣装备」。

**为什么这么做（已定的决策，不要翻案）**
- 桌搭小物是矢量风格，和手绘主图精度、风格不一致，显得突兀；主图里自带笔记本和杯子（`drinking` 姿态也依赖杯子），不能把杯子抠掉。
- 背景放在角色后面，清晰度差异像景深，不会像前景小物那样露馅；手绘背景与主图水彩风格同源。
- 只用本地信号（手选 / 时段），**不接真实天气**（要联网和定位，违背「无后端、无遥测」）。
- 背景不挂「按天数解锁」，避免重新带回养成味道。
- 默认**关闭**；「跟随时段」只是一个可选模式。

**范围外（不要做）**
- 真实天气、雨声/音效、给每个场景单独画道具、解锁机制。
- 雨丝/落雪等粒子动画（可作为以后的 Phase 4，用户确认后再做）。
- 夏、秋两个季节场景（没有素材；因此「春/雪」只能手选，不参与自动）。
- 改动 finance 页面隐藏逻辑、announcer、语气 lint 词库、`renderChar` 整体结构、眼睛层逻辑。

---

## 1. 开工前先确认的事

1. **提醒用户先提交一次当前稳定状态**。HANDOFF 记录全部改动尚未进 git；背景是新实验，需要回退点。**AGENT 不要自己 commit / push。**
2. **缺一张夜晚图**：`raw_images/` 目前只有 6 张背景，没有夜晚。用户之前提供过一张深靛蓝星空圆形背景（1024×1024，需用户把文件存进 `raw_images/`，建议命名 `夜晚星空.jpg` 或 `.png`）。
   - 若开工时该文件不存在：`night` 场景暂缺，**不要伪造**；`SCENES` 里只登记实际存在的文件；跟随时段模式在夜间返回 `null`（不显示背景）。
   - 并在最终汇报里明确提醒用户「夜间时段目前没有背景」。
3. 先跑一次 `npm test`，记录基线输出（改动前）。
4. 用 grep 确认下面「待确认」里的名字和位置（见第 6 节），不要凭本文假设。

### 已核对的事实（来自读文件）
- `manifest.json` 版本 `0.12.0`；`web_accessible_resources` 目前只有 `sprites/*` 和 `sprites/*/*`。
- `tools/package_release.py`：`INCLUDE_DIRS = ['icons', 'sprites']`，`SPRITE_DIRS_IN_PACKAGE = {'chabit'}`；`run_tests()` 跑三个脚本：`test_site_rules.js`、`lint_tone.js`、`test_announcer.js`。`VERSION` 读取失败时的兜底值也写着 `'0.12.0'`。
- `package.json` 的 `npm test` = 上述三个脚本串联。
- `.gitignore` 已忽略 `raw_images/` 与 `*.zip`；`public/assets/pet/` **没有**被忽略。
- 小桌宠主图 `sprites/chabit/*.webp` 是方图（1:1），内容上方约 7–8% 透明、下方约 14% 透明；桌面椭圆左右较宽。
- 根框尺寸为 `W = 72×s`、`H = 64×s`（`s` 为大小档），主图是 `W×W` 方块、底部对齐，所以顶部会比根框高出约 `0.11W`（此前已评估：因顶部留白，净超出很小，不用处理）。

### 已测量（仅夜晚那一张，作为参考）
- 1024×1024，RGB，**无透明通道**，四角纯白。
- 实心圆范围约 x 108–866、y 105–905（亮度 <150 判定）；圆外有一圈淡紫到白的柔光，约 40–50px 宽（水平中线上从约 x=60 开始变深）。
- 文件 595KB。

### 没有核对的（AGENT 必须自己测）
- **六张背景 JPG 的实际尺寸、圆心、半径、白晕边宽度**（单张 1.2–1.8MB，超出文件工具的 1MB 读取限制，没能查看）。
- 浅色场景（冬日初雪、清晨晴空等）很可能和白底差别很小，**自动检测圆边大概率失败**，预期要手填圆参数。

---

## 2. 场景清单与命名

| id | 中文名 | 源文件（raw_images/） | 分组 | 自动时段 |
|---|---|---|---|---|
| `morning` | 清晨晴空 | 清晨晴空.jpg | time | 05–10 |
| `afternoon` | 午后暖光 | 午后暖光.jpg | time | 11–16 |
| `dusk` | 黄昏晚霞 | 黄昏晚霞.jpg | time | 17–19 |
| `night` | 夜晚星空 | （待用户补） | time | 20–23、00–04 |
| `spring` | 春日微风 | 春日微风.jpg | season | 不参与自动 |
| `snow` | 冬日初雪 | 冬日初雪.jpg | season | 不参与自动 |
| `rain` | 雨天 | 雨天.jpg | weather | 不参与自动 |

- 时段边界先放在**一处常量**里。实现前先看 `shared.js` 里是否已有「问候时段」的函数（`slot` 一类）；如果有，**优先复用它的边界**保持一致，只在没有时才用上表。
- 输出文件：`scenes/<id>.webp`（顶层新目录 `scenes/`）。

---

## 3. Phase 1 · 资产生成（做完先停，等用户确认）

新增 `tools/build_scene_assets.py`（用 Pillow + numpy；缺依赖就 `pip install pillow numpy`；注意 Pillow 要带 WebP 支持）。

### 3.1 输入输出
- 输入：`raw_images/<中文名>.jpg`（夜晚可能是 png）。
- 输出：`scenes/<id>.webp`（RGBA，512×512，quality≈80，method=6）。
- 预览：`raw_images/_preview/`（该目录已被 `raw_images/` 的忽略规则覆盖）。
- Windows 控制台 + 中文文件名：脚本里用 `pathlib`，开头 `sys.stdout.reconfigure(encoding='utf-8')`，避免 GBK 报错。

### 3.2 圆的检测与裁切
1. 读成 RGB，把背景当纯白，计算每个像素到白色的距离（如 `255 - min(R,G,B)`）。
2. 按阈值取最大连通区域，用外接框估计圆心 `(cx, cy)` 和半径 `r = (w+h)/4`。夜晚图在亮度阈值 <150 时得到约 r≈379。
3. 合理性检查：宽高比在 0.9–1.1，圆心偏离图像中心不超过 8%。不通过就用脚本顶部的手填表：
   ```python
   CIRCLE_OVERRIDES = {  # id: (cx, cy, r)  浅色场景大概率要手填
   }
   ```
   手填值由 AGENT 看图确定（AGENT 若无法看图，就停下来向用户要，不要瞎猜）。
4. 以 `(cx, cy)` 为中心、半边长 `r` 裁方块，缩放到 512。
5. 每个场景可单独配 `R_SCALE`（默认 1.0），用来收缩半径以去掉白边。

### 3.3 烘焙羽化 alpha（不要用「白色转透明」）
- 白晕边是淡紫/淡色渐变到白，直接把白转透明会把边缘的淡色一起吃掉，边缘发灰。
- 做法：径向 alpha，`ρ = 距离 / 半径`：`ρ ≤ FEATHER_INNER` 时 alpha=1，之后 smoothstep 降到 0，`ρ ≥ FEATHER_OUTER` 为 0。
  - 初值 `FEATHER_INNER = 0.80`、`FEATHER_OUTER = 0.98`，由联系表目测微调。
  - 目的：把图自带的白晕边整个排除在不透明区域之外，边缘形状由我们控制。
- 体积：每张目标 25–45KB，**硬上限 80KB**。超了先降 quality（到 72），再缩尺寸（到 448）；不要用无损。

### 3.4 联系表（让用户确认的依据）
生成两张对照图到 `raw_images/_preview/`：
- **sheet_bg.png**：每个场景分别叠在 4 种底色上：`#FFFFFF`、`#000000`、`#15202B`、`#181A20`（X 浅色/深色/暗蓝、币安深色）。检查边缘有没有发白/发灰的环。
- **sheet_pet.png**：模拟运行时几何，把场景和 `sprites/chabit/working.webp` 合成：
  - 根框 `W×H = 216×192`（即 3.0 档）；场景居中，边长 `0.86W`；宠物 `W×W` 底部对齐。
  - 同样叠在上面 4 种底色上。
  - 额外再出一份 `1.0` 档（72×64）和 `2.2` 档（158×141）的缩略检查。

### 3.5 停点
Phase 1 完成后，**停下来**，告诉用户 `_preview/` 的路径和每张图的最终体积，等用户确认视觉效果再进入 Phase 2。重点请用户看：
- 深色底色上有没有白边/灰边；
- 浅色场景在 `#000000` 上会不会像一个刺眼的亮盘（可能需要单场景降 opacity，**不要改图**）；
- 桌面椭圆左右伸出圆外的样子是否可接受。

---

## 4. Phase 2 · 运行时接入

### 4.1 数据模型（`shared.js`）
```js
// 全局设置，不随角色
settings.scene = { mode: 'off' | 'manual' | 'time', id: '<场景 id>' }
// 默认: { mode: 'off', id: 'rain' }
```
- `XPET.SCENES`：有序数组 `[{ id, label, file, group }]`，**只登记 `scenes/` 里实际存在的文件**。
- 纯函数 `XPET.sceneFor(hour, sceneSettings)`：
  - `off` → `null`；
  - `manual` → id 合法则返回该 id，否则 `null`；
  - `time` → 按小时映射到 `group === 'time'` 的场景；该场景不在 `SCENES` 里（例如夜晚缺图）则 `null`；
  - 非法 `mode` 一律当 `off`。
- `defaultSettings()` 加入 `scene` 默认值；`mergeSettings` 对 `scene` 做白名单校验（缺失→默认；非法 mode→`off`；非法 id→默认 id），**旧版本存档没有 `scene` 字段必须能正常加载**。
- 设置本身已在备份键里（`SETTINGS_KEY`），导入时确认走的是 `mergeSettings`，不会让脏数据进来。

### 4.2 DOM 与布局（`content.js` / `pet.css`）
- 新增一个场景层 `<div class="xpet-scene" aria-hidden="true">`，内含一个 `<img draggable="false" decoding="async">`。
  - **挂在 `#xpet-root` 下、`.xpet-body` 的兄弟节点**，放在最前面；这样 `renderChar()`（只重建 body 内容）不会把它冲掉，点击跳动/拖动变形时背景也不跟着动。
  - `pointer-events: none`；`z-index` 低于气泡、统计条、设置齿轮等（先读 `pet.css` 里现有的 z-index 再定）。
  - 层内元素全部限制在根框边界内（不超出根框），这样 `clamp`、`fitBubble`、气泡定位都不用改。
- 几何（在 `applySize` 里随大小档重算）：
  ```
  side = round(0.86 * W)
  left = (W - side) / 2
  top  = (H - side) / 2 + SCENE_DY    // SCENE_DY 初值 0，允许在预览里微调（向上不超过 0.04H）
  ```
  常量 `SCENE_SIDE_RATIO = 0.86`、`SCENE_DY = 0` 放在文件顶部，方便预览时调。
- 图片地址：`chrome.runtime.getURL('scenes/<id>.webp')`。切换场景时做 250ms 的透明度交叉淡入淡出，避免闪白；选中后可预加载。
- 小桌宠隐藏时场景层随根节点一起隐藏，不需要额外处理。

### 4.3 角色色调（让角色融进场景）
在根节点上加 class `xpet-scene-<id>`，用 CSS filter 作用在 **`.xpet-chabit` 容器**上（眼睛层是它的子节点，会一起生效；不要对眼睛层单独加）。加 `transition: filter .4s`。

初始值（都是轻微调整，≤ 12%，实测后微调）：

| 场景 | filter |
|---|---|
| night | `brightness(.88) saturate(.92)` |
| dusk | `sepia(.12) saturate(1.05) brightness(.97)` |
| afternoon | `sepia(.08) brightness(1.02)` |
| rain | `saturate(.88) brightness(.96)` |
| snow | `brightness(1.02) saturate(.95)` |
| morning / spring | 无 |

验证眼睛叠层位置不受影响（位置是按主图的比例算的，filter 不改变几何）。

### 4.4 微动画
```css
@keyframes xpet-scene-breathe {
  0%, 100% { opacity: .92; transform: scale(1); }
  50%      { opacity: 1;   transform: scale(1.015); }
}
.xpet-scene { animation: xpet-scene-breathe 8s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) {
  .xpet-scene { animation: none; opacity: 1; }
}
```
- 只动 `transform` 和 `opacity`（合成层，成本低）。
- 浅色场景若在深色页面过亮，允许**单场景**加 `--scene-opacity`（≤0.9）。
- **不新增 JS 定时器**用于动画。

### 4.5 应用时机（`content.js`）
- 新增 `applyScene()`：计算 `XPET.sceneFor(new Date().getHours(), settings.scene)`，只有当结果和当前不同才改 DOM。
- 调用点：根节点创建后；设置加载完成后；`chrome.storage.onChanged` 里设置键变化时；**现有 5 秒 tick 里**（仅为了「跟随时段」跨小时自动切换，必须是「结果变了才动 DOM」）。
- 注意 `settings` 是 `let`，声明在 `renderChar()` 首次调用之后（TDZ）。**不要在启动期的同步路径里直接读 `settings`**；`typeof settings` 也救不了。要么在 `settings` 加载完成之后再首次调用，要么 try/catch。

### 4.6 入口
- **右键菜单**：增加「场景」项：关闭 / 跟随时段 / 分隔线 / 7 个场景（当前选中打勾）。写入方式沿用菜单里其它开关的做法（先读现有代码，保持一致）。
- **设置页**：新增「背景场景」卡片：模式下拉（关闭 / 手选 / 跟随时段）+ 场景下拉；可加小缩略图预览（设置页是扩展页，直接用相对路径，不需要 web_accessible_resources）。
- 弹窗（popup）不改。

### 4.7 桌搭软关闭（不是删除）
- 在 `shared.js` 增加一个总开关常量，如 `ACCESSORIES_ENABLED = false`，让下面这些地方都受它控制，**将来想恢复只改这一处**：
  - 角色渲染里挂装备的部分不再渲染；
  - 设置页的装备选择行隐藏；
  - 「今日小结」里「还差几天解锁」那类文案去掉；
  - 解锁播报不再触发。
- **保留不动**：`ACCESSORIES` 数据、角色的 `accessory` 字段、`normalizeChar` 里的旧值映射、`unlock` 台词、AI 导入提示词的对应类别。这样语气 lint、占位符校验、announcer 测试都不用改。
- 实现前先用 grep（`accessory`、`ACCESSORIES`、`unlock`）列出所有接触点，写进汇报；有些点牵连到测试，要逐个确认测试仍然通过。

---

## 5. Phase 3 · 测试、打包、文档

### 5.1 新增 `tools/test_scenes.js`（并入 `npm test` 与 `package_release.py` 的 `run_tests`）
1. `sceneFor` 边界：小时 0、4、5、10、11、16、17、19、20、23 的结果符合映射；`off`、`manual`、`time` 三种模式；非法 `mode`、非法 `id` 的回退；夜晚缺图时 `time` 夜间返回 `null`。
2. `mergeSettings`：缺 `scene` 字段 → 默认值；乱写的 `scene` → 默认值；不带 `scene` 的旧设置对象能正常通过。
3. 静态一致性（专治「本地正常、打包后 404」）：
   - `XPET.SCENES` 里每一项的 `scenes/<file>` 文件存在，且 ≤ 80KB；
   - id 唯一、符合 `/^[a-z-]+$/`、label 非空；
   - `manifest.json` 的 `web_accessible_resources` 覆盖 `scenes/*`；
   - `package_release.py` 的 `INCLUDE_DIRS` 含 `scenes`。

### 5.2 同时做的卫生项（见第 7 节，建议一起做）
- `node --check` 并入 npm test 与 `run_tests`。

### 5.3 打包与清单
- `manifest.json`：`web_accessible_resources.resources` 加 `"scenes/*"`。
- `tools/package_release.py`：`INCLUDE_DIRS` 加 `'scenes'`，且只打包 `.webp`；`VERSION` 兜底值同步更新。
- 打包后核对 zip 内容：7（或 6）张 webp 都在；体积增量约 200–300KB 量级。
- 版本号：`manifest.json` 与 `package.json` 一起升到 `0.13.0`（先读 `CHANGELOG.md` 确认版本号约定）。
- 更新 `CHANGELOG.md` 与 `HANDOFF.md` 的「0.0 最新状态快照」（含：背景功能完成度、桌搭已软关闭、夜晚图是否到位、未验证项）。如果 README / 隐私说明提到桌搭或资源清单，同步修改。**不新增任何权限。**

---

## 6. 待确认（实现前用 grep / 阅读核对，别凭本文假设）

- `shared.js`：有没有现成的时段函数；`defaultSettings` / `mergeSettings` 的写法与 settings 版本字段；`BACKUP_KEYS` 与导入校验。
- `content.js`：根节点的创建位置、`applySize` 与 `renderChar` 的调用关系、右键菜单的实现与开关的保存方式、5 秒 tick 的位置。
- `pet.css`：`#xpet-root` / `.xpet-body` / 气泡 / 统计条 / 齿轮的 z-index 与定位。
- `options.html` / `options.js`：卡片的写法和设置保存的节奏。

---

## 7. 前置/并行卫生项（不属于背景功能，建议先做，可由用户删减）

1. **`node --check`**：现在 `content.js`、`options.js` 没有任何测试会解析它们（`test_site_rules` 与 `lint_tone` 只把 `content.js` 当文本），语法错误会被 `npm test` 和打包放过。在 `package.json` 的 test 与 `package_release.py` 的 `run_tests` 里加：对 `content.js`、`options.js`、`background.js`、`popup.js`、`shared.js`、`stories.js` 逐个 `node --check`。
2. **`tools/test_migration.js`**：用假的 `chrome.storage.local` 在 vm 沙箱里测 `XPET.load()` 的迁移。场景：全新安装；只有泰迪且有小桌宠存档；只有泰迪无存档；小桌宠已被用户改名；旧大小 1.6 被归一到现有档位；二次载入不再写入存储。先单独运行给用户看，确认通过后再并进 `npm test`，免得它先红了干扰基线。
3. **备份补存档键**：把 `xpetRetiredChars`（`XPET.RETIRED_KEY`）加进 `BACKUP_KEYS`，导入时按对象校验。现在备份不含它，重装或换文件夹后存档的角色和台词会丢。
4. **`public/assets/pet/` 的 4.3MB PNG**（中间产物）没被 `.gitignore` 忽略。二进制进了 git 历史就删不干净。**请先问用户**：忽略，还是刻意入库？默认建议忽略。

---

## 8. 用户手测清单（AGENT 做完后交给用户）

对每个场景 × 页面底色（X 浅色、X 深色、币安深色）× 大小档（标准 / 大 / 特大）：
1. 背景边缘有没有发白、发灰的环；桌面椭圆的半透明软边在深色底上是否发灰。
2. 浅色场景在深色页面上是否过亮；气泡是否仍清晰地盖在背景之上。
3. 角色色调是否自然；眼睛叠层是否还对得准（眨眼、困眼睛时看）。
4. 右键菜单与设置页能切换；刷新页面后设置保留；三个站点（X、币安、OKX）表现一致。
5. 「跟随时段」：改系统时间或等到跨小时，场景会自动换；夜晚缺图时夜间不显示背景（若夜晚图已补，则应显示夜晚）。
6. 系统开启「减少动态效果」时背景不再呼吸。
7. 打开 DevTools Console 无报错（`content.js` 没被 npm test 解析过，这一条别省）；Network 面板无外部请求。
8. 老存档（没有 `scene` 字段的）升级后能正常打开，默认背景为关闭。

---

## 9. 汇报要求

每个 Phase 结束时汇报：
- **已核对**（你亲眼看到文件内容或运行输出的）、**推断**、**未验证**（需要用户在浏览器里确认的）分开写；
- 改动的文件清单和关键 diff 摘要；
- `npm test` 的真实输出（改动前基线 + 改动后）；
- 与本文不一致的地方，以及为什么。

**不要**自行 commit / push；遇到需要删角色、清存档这类不好回退的操作，先复述你的理解并等用户确认。
