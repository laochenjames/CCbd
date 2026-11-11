# CCbd 伴宠 · 新窗口接手说明（2026-11-11）

> 给新窗口里的 Claude（或 AGENT）看。先读本文件，再按需读 `HANDOFF.md` 的「零、接手说明」。
> 本文件只记录**当前状态、已定决策、待办、协作约定**；产品定义、语气规范等长期内容在 `HANDOFF.md`。

---

## 0. 一句话状态

v0.13.0 开源发布准备已基本就绪：小桌宠（CICI）+ 7 种手绘背景场景 + 双重许可证架构（MIT代码 + 专有素材授权）+ 外部备份完成（48个文件 32.64MB）。**本地未执行任何 git commit / push**。当前等待用户在 Gate B / 分支决策下复制执行 Git 提交与发布命令。

---

## 1. 先读哪些文件

| 文件 | 用途 |
|---|---|
| `RELEASE_PREP.md` | 本次开源发布的完整操作指南与 Gate A/B/C 清单 |
| `HANDOFF.md` 的「零、接手说明」 | 产品定位、已定决策、代码地图、开工约定（0.0 是最新快照） |
| `ASSETS_LICENSE.md` | 素材专属许可证（sprites/chabit, scenes, icons 等保留所有权） |
| `SCENES_PLAN.md` / `SCENES_FIXES.md` | 背景场景方案与修复记录 |
| `CHANGELOG.md` | 0.13.0 条目 |

项目路径：`E:\Doc\Python_daye\CCbd`（Chrome MV3 扩展，非网页应用）。Claude 这边有**文件系统读写工具**，但**没有执行命令的能力**，跑不了 `npm test`，也看不了超过 1MB 的图片。

---

## 2. 当前状态（已核对 / AGENT 汇报 / 未验证 分开写）

### 已完成的功能
- **只保留小桌宠**（内置形象 `chabit`，默认名 CICI）；其他内置角色（teddy/cat/doge/pepe/slime）已退役，原始数据存档在 `xpetRetiredChars`。
- **背景场景**：7 张圆形手绘 WebP（`scenes/`：morning、afternoon、dusk、night、spring、snow、rain，共约 88KB）。
  - 设置：`settings.scene = { mode: 'off' | 'manual' | 'time', id }`，默认 `off`；`XPET.sceneFor(hour, sceneSettings)` 是纯函数。
  - 时段映射：05–10 morning、11–16 afternoon、17–19 dusk、其余 night；只有 morning/afternoon/dusk/night 参与自动，spring/snow/rain 只能手选。
  - 入口：右键菜单「背景场景」二级菜单；设置页「外观与交互偏好」里的模式 + 场景下拉。
  - 几何（用户手调，**不要改**）：`SCENE_SIDE_RATIO = 1.15`、`SCENE_DX_RATIO = -0.11`、`SCENE_DY_RATIO = -0.18`，圆会超出宠物根框（特大档顶部约 63px、左侧约 40px），宠物贴近屏幕上沿/左沿时圆会被屏幕边裁掉一块——这是**已知且选择不处理**。
  - 角色色调：根节点加 `xpet-scene-<id>` 类，用 CSS filter 微调 `.xpet-chabit`（≤12%）。
  - 切换：预加载 → 旧背景淡出 → 换图 → 淡入；`sceneToken` 防快速切换竞态。
- **桌搭软关闭**：`XPET.ACCESSORIES_ENABLED = false`（`shared.js`）。数据结构、`unlock` 台词、AI 导入类别都保留。
- **工程**：`npm test` = 6 个文件 `node --check` + `test_site_rules.js`（53 例）+ `lint_tone.js` + `test_announcer.js`（10 场景）+ `test_scenes.js`（4 大类）。`package_release.py` 打包前串联同样的检查。
- **备份**：`BACKUP_KEYS` 已含 `xpetRetiredChars`；设置页会监听 `SETTINGS_KEY`，只同步 `scene` 和 `quietUntil`，避免覆盖网页右键菜单的改动。
- **发布包**：`ccbd-v0.13.0.zip`（约 0.38MB，已被 `.gitignore` 的 `*.zip` 忽略）。

### 验证情况
- AGENT 贴出的 `npm test` 与打包输出全部通过（**AGENT 汇报，Claude 没有运行**）。
- 我（Claude）读过的代码：`content.js`、`shared.js`、`options.js/html`、`pet.css`、`test_scenes.js`、`build_scene_assets.py`、`package_release.py`、`manifest.json`、`package.json`。静态审查没有发现会让测试变红或明显出错的地方。
- **只有浏览器能证明、用户只笼统反馈"没问题"、没有逐项确认的**：
  1. 右键子菜单在屏幕最下方/最右边时 9 项是否都点得到。注意：这一版的修复依赖"`mouseenter` 时 `:hover` 已让子菜单显示"，否则 `rect` 为 0 会**静默 return**。若发现不行，修法是先 `subMenu.style.display='block'`、量完再还原。
  2. 在 X 上用右键菜单切场景，设置页是否同步、再改别的项是否会把场景覆盖回去。
  3. `#000000` / 深色页面上各场景的边缘观感（`night`、`snow` 最值得看）。
  4. 宠物拖到屏幕上沿/左沿时被裁掉的圆是否可接受。
  5. 深夜哈欠（`maybeYawn`）仍然没有在深夜窗口实测过。

---

## 3. 已定的决策（不要反复追问）

1. 产品定位：用户在屏幕里的"嘴替"，**不是养成**；不控时长、不劝睡、不报时长、不评判；第一人称自言自语。
2. 背景：只用本地信号（手选 / 跟随时段），**不接真实天气**；**不挂"按天数解锁"**；默认关闭；以手选为主。
3. 桌搭：不适用（画里已有笔记本和杯子，矢量小物风格/精度不一致）；软关闭，不删数据。
4. 背景几何三常量保持现状。
5. 暂不考虑上架/打包上传；扩展本身无后端、无遥测，数据只存 `chrome.storage.local`。
6. 小桌宠素材已定稿（9 张 WebP，在 `sprites/chabit/`）；原图在 `raw_images/`（已被 `.gitignore` 忽略）。

---

## 4. 待办与待决（按建议顺序）

### A. 性能：先测量，再决定要不要优化（用户刚问起）
我的判断（**读代码的推断，未测量**）：常驻开销很轻（5 秒 tick、500ms 网址轮询、20 秒睡眠复查、几秒一次眨眼；全局监听在页面不生效时第一行就返回；统计 ≥15 秒批量写一次）。真正值得留意的只有：
- 永远在跑的两个 CSS 动画：小桌宠呼吸（3.6s）和背景呼吸（8s，最大约 248px 的图层）；
- 小桌宠原图 1024px，解码后每张约 4MB，每个开着的标签页各占一份。

**让用户先自己测（约 10 分钟）**：Shift+Esc 打开 Chrome 任务管理器，看 X 标签页的 CPU / 内存，对比三种情况各静置 60 秒：扩展停用 / 扩展启用且场景关 / 特大档且场景开；再在 DevTools 的 Rendering 面板勾选"减少动态效果"看差值。判断标准：空闲 CPU 多出约 1% 以内、内存多出不到约 30MB → 不用优化。

若数据偏高，按性价比：
1. 背景呼吸在"你停下来"（5 秒 tick 里已有 `active`）时 `animation-play-state: paused`；
2. 小桌宠与背景图缩到 768px（需重新生成并目检）；
3. 网址轮询改用 Navigation API（收益很小，最后考虑）。

**不建议**：改历史数据存储结构；加 `requestAnimationFrame` 循环。

### B. 提交前的小清理（用户尚未决定）
- `public/assets/pet/` 约 4.3MB 的 PNG（中间产物）**没有被 `.gitignore` 忽略**。二进制进了 git 历史就删不干净，提交前先定：忽略，还是刻意入库？（默认建议忽略。）
- 然后由用户自己 `git commit`（AGENT 和 Claude 都不要 commit/push）。

### C. 遗留项（都是"用户没拍板"，别顺手改）
- `tools/test_migration.js`：`XPET.load()` 的迁移逻辑（退役角色存档/取回、旧大小归一、改名 CICI）仍然**零测试**。建议用假的 `chrome.storage.local` 在 vm 里测：全新安装 / 只有泰迪且有小桌宠存档 / 只有泰迪无存档 / 小桌宠已改名 / 旧大小 1.6 / 二次载入不再写入。
- `chabitFatigue`：`half` 分支不可达（死代码）；tired 眼睛写死 `h < 5` 且不看"深夜提醒"开关。若要改成跟随设置，**注意 TDZ**：`settings` 是 `let`，声明在 `renderChar()` 首次调用之后，而首次 `applyChabit` 就会调 `chabitFatigue`；直接读会在启动时抛 ReferenceError，`typeof` 也救不了，只能 try/catch 或把声明提前。
- 方案 B：让 `clamp` 把背景圆的超出量算进边距（代价：场景开启时宠物不能贴屏幕边放）。目前未实现。
- `FIN_PATH` 收窄方案（HANDOFF 0.5 第 2 项）：用户未决。

### D. 已知小瑕疵（不紧急）
- 预加载失败时 `xpet-scene-<id>` 色调类仍生效，只剩色调没有背景。
- 子菜单翻到左侧后没再检查左边是否越界（只有窗口很窄时才会遇到）。
- 设置页场景下拉显示 `雨天 (rain)`，带英文 id；`#s-sceneDesc` 元素没被使用。
- 设置页帮助里仍提到 `{name}`（桌搭名）占位符。
- 自定义上传图片的角色在"减少动态效果"下，背景层（有定位、z-index:0）可能盖住该图片——目前用户没有自定义图角色，可忽略。
- 圆形背景在特大档约 250px、不透明度 0.96，会遮住下面的帖子文字（点击能穿透）。这是体验取舍；默认关闭已缓解，如要改，调 `--scene-opacity` 或缩小比例。

---

## 5. 关键代码位置（场景相关）

- `content.js`：顶部 `SCENE_*` 常量（带"用户手调"注释）；`applySize()` 里按 W/H 计算场景位置；`applyScene()` + `sceneToken`；右键菜单里的 `背景场景` 子菜单（`mouseenter` 里做边界修正）；5 秒 tick 末尾调用 `applyScene()`。
- `shared.js`：`SCENES`、`sceneFor`、`defaultSettings().scene`、`mergeSettings` 里的 `scene` 校验、`ACCESSORIES_ENABLED`、`RETIRED_IDS/RETIRED_KEY`、`load()` 迁移、`normalizeChar`（强制 `look = 'chabit'`）。
- `pet.css`：`.xpet-scene`（z-index 0，`pointer-events:none`，8s 呼吸，减少动态效果时关闭）、`xpet-scene-<id>` 色调、右键菜单与子菜单样式。
- `options.js/html`：`#s-sceneMode`、`#s-sceneManualRow`、`#s-sceneId`；`chrome.storage.onChanged` 里对 `SETTINGS_KEY` 的同步。
- `tools/build_scene_assets.py`：从 `raw_images/*.jpg`（要求正方形，`R_CROP_RATIO = 810/2048`）生成 `scenes/*.webp`，并重画 `raw_images/_preview/sheet_bg.png`、`sheet_pet.png`（几何与运行时一致）。**几何常量必须与 `content.js` 保持一致**，`test_scenes.js` 里有一致性断言。
- `tools/test_scenes.js`：`sceneFor` 边界、`mergeSettings` 兼容、静态一致性（文件存在 ≤80KB、manifest `scenes/*`、打包清单含 `scenes`）、几何常量一致。

---

## 6. 协作约定（用户明确要求，务必遵守）

1. **客观中立、批判性**：不要讨好；想法不切实际或有更专业的做法，直接指出；输出前先自检。尽量穷举方法。
2. **工作方式**：先讨论 → 我写方案文档 → 用户交给 AGENT 执行 → 我复核。**Claude 不执行项目命令。**讨论阶段不要擅自改代码。
3. **汇报必须分开写**：已核对（看到文件内容或真实输出）/ 推断 / 未验证（需要用户在浏览器确认）。不要把推断写成事实，不要把"测试通过"当成"浏览器行为正常"。
4. **不自行 commit / push。**删角色、清存档这类不好回退的操作，先复述理解、确认后再动手。
5. **不要重新引入**：`document.title` 读取、时长播报、劝导语气、经验/上限机制、用户自己写台词作为主路径。
6. 改了 `content.js` / `shared.js` / 台词，必须跑 `npm test`（由用户或 AGENT 跑，贴完整输出）；改完同步 `CHANGELOG.md` 和 `HANDOFF.md`。

---

## 7. 新窗口的开场建议

把下面这段连同本文件一起发给新窗口：

> 请先读 `E:\Doc\Python_daye\CCbd\NEXT_WINDOW.md`，再读 `HANDOFF.md` 的「零、接手说明」。按里面的协作约定：先给我客观、批判性的评估，再动手；你不执行命令，方案写成文档给 AGENT。
> 我这边的状态：（1）性能测量结果是 ……（Chrome 任务管理器里三种情况的 CPU/内存数字，没测就写"还没测"）；（2）浏览器里的新发现是 ……；（3）我对「提交前清理」的决定是 ……（`public/assets/pet/` 是否忽略）。

如果新窗口需要更多背景，可以让它读 `SCENES_PLAN.md`（原方案）和 `SCENES_FIXES.md`（修复清单），它们记录了每个决策的理由。
