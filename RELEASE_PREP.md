# CCbd v0.13.0 公开发布准备方案（给 AGENT 执行）

> 编写：Claude（2026-11-11）　执行：AGENT　复核：Claude　拍板：用户
> 本方案的目标：把当前工作区整理成可以**安全公开**的 GitHub 仓库，并发布 v0.13.0 的 Release zip。
> 不改产品行为，不改任何功能代码（除第 6 步中明确列出的文档和许可证文件）。

---

## 0. 背景与已定决定

用户已确认（2026-11-11）：
1. v0.13.0 的浏览器验证没有发现问题（用户汇报，Claude 与 AGENT 均未独立复现）。
2. **不做性能测量**，上线后看反馈再说。
3. 仓库**可以公开**。
4. 发布渠道默认按 **GitHub 公开仓库 + Release zip**（用户手动加载扩展）。Chrome 网上应用店**不在本方案范围内**。若用户另有要求，另开工单。

本方案新增的判断（需要 Step 0 的事实来验证）：
- 公开仓库里不应该出现没有授权的第三方素材（doge、pepe 等）。
- 美术素材（CICI 形象、7 张手绘场景）不应被 MIT 默认全部放开，除非用户明确选择全开放。
- 工作区没有 commit，且 `raw_images/` 等源图只有本机一份。

---

## 1. 硬规则（全程遵守）

1. **不 commit、不 push、不改 git 历史、不删除任何素材文件。** 所有 git 写操作由用户自己执行；AGENT 只准备命令清单。
2. **每个 Gate 都必须停下来汇报，等 Claude 复核和用户确认，才能进入下一步。**
3. 不动三个背景几何常量（`SCENE_SIDE_RATIO`、`SCENE_DX_RATIO`、`SCENE_DY_RATIO`）；不动 `PRIVACY.md` 的承诺范围；不重新引入 `NEXT_WINDOW.md` 第 6 条里列出的禁项。
4. 任何改动 `content.js`、`shared.js`、台词的操作都必须跑 `npm test` 并贴**完整输出**；本方案预期**不会**改这几个文件，如果发现需要改，停下来问。
5. 汇报时把内容分成三类，不要混写：
   - **已核对**：看到文件内容或命令的真实输出；
   - **推断**：根据代码或文档推出来的；
   - **未验证**：只有用户在浏览器里或 GitHub 页面上才能确认的。
   不要把"测试通过"写成"浏览器里正常"。

---

## 2. 执行步骤总览

| 步骤 | 内容 | 会改文件吗 | Gate |
|---|---|---|---|
| 0 | 只读核查 | 否 | **Gate A**（必停） |
| 1 | 备份到仓库外 | 只复制，不删 | 无 |
| 2 | 忽略规则与取消跟踪 | 改 `.gitignore`，准备命令 | 无 |
| 3 | 历史问题处理（按 Step 0 结果分支） | 视分支 | **Gate B**（必停） |
| 4 | 美术素材许可证 | 新增/改文档 | **Gate C**（用户确认默认值） |
| 5 | 信息卫生 | 只报告 | 并入 Gate A/B |
| 6 | README、CHANGELOG、HANDOFF 同步 | 改文档 | 无 |
| 7 | 回归与打包检查 | 生成 zip | 无 |
| 8 | 提交命令清单（交给用户） | 否 | 用户执行 |

---

## 3. Step 0 · 只读核查（不改任何东西）

在 `E:\Doc\Python_daye\CCbd` 下执行并**原样贴出输出**：

**Git 状态与历史**
```
git status --short
git log --oneline -n 30
git log --all --oneline | wc -l       （Windows 下可用 git rev-list --all --count）
git remote -v
git branch -a
```

**哪些素材被跟踪、是否进过历史**
```
git ls-files sprites
git ls-files public
git ls-files raw_images
git ls-files "*.zip"
git log --all --oneline -- sprites/doge sprites/pepe sprites/cat sprites/teddy
git log --all --oneline -- public/assets/pet
git log --all --oneline -- raw_images
```

**体积**
```
git count-objects -vH
```
并列出所有被跟踪的、大于 300KB 的文件（路径 + 大小）。

**敏感信息与个人信息扫描**（在工作区，排除 `.git/`、`raw_images/`）：
- 搜索关键词：`api_key`、`apikey`、`secret`、`token`、`password`、`Authorization`、`Bearer`、`@gmail`、`@qq`、`@163`，以及形如邮箱、手机号、`sk-` 开头的字符串；
- 搜索本机路径和用户名：`C:\Users`、`E:\Doc`、`Z:\`；
- 逐条列出命中位置和上下文，**不要自行判断为安全而省略**。

**manifest 与权限**
- 打印 `manifest.json` 全文；特别指出是否存在 `key` 字段（旧版 v0.11 带过）；列出 `permissions`、`host_permissions`、`web_accessible_resources`。

**对外引用**
- 找出代码、README、设置页里所有指向 GitHub 的 URL（特别是 Issues 反馈入口），列出完整 URL。判断它们指向的仓库名是否与将要公开的仓库一致（这一条 AGENT 无法判断，写"未验证，需用户确认"即可）。

**退役素材是否仍被引用**
- 在全仓库搜索 `sprites/teddy`、`sprites/cat`、`sprites/doge`、`sprites/pepe`、`teddy`、`doge`、`pepe`（含 `tools/`、`manifest.json`、`package_release.py`、测试文件），列出所有引用点，并说明如果这四个目录在仓库里不存在，会不会导致 `npm test`、`package_release.py`、扩展加载出错。

**其他入库物检查**
- `preview_test.html`：打印前 40 行，说明用途，判断是否为调试文件。
- `store_assets/`：列出文件，说明是否与 v0.13.0 一致（HANDOFF 里写着与 v0.12 一致，等用户定稿）。
- 第三方代码或字体：是否有引入外部库、字体、图标集（包括 `icons/`），有无来源与许可证说明。

### Gate A：停下来汇报

汇报按本文件第 1 条第 5 点的三类格式。Claude 根据结果决定 Step 3 走哪条分支。

---

## 4. Step 1 · 备份到仓库外（只复制，不删除）

目标：确保任何后续操作出错时，源图和退役素材都还在。

1. 在仓库**外**新建 `E:\Doc\Python_daye\CCbd_backup_20261111\`。
2. 复制以下内容进去（保持目录结构）：
   - `raw_images\`（全部，含 `_preview\`）
   - `sprites\cat\`、`sprites\doge\`、`sprites\pepe\`、`sprites\teddy\`
   - `public\assets\pet\`
   - `ccbd-v0.13.0.zip`、`ccbd-v0.12.0.zip`
3. 对比文件数量与总大小，贴出源目录与备份目录的两组数字，必须一致。
4. 提醒用户：**这份备份仍然在同一块硬盘上**，请自行再复制一份到云盘或外置盘。AGENT 不要代劳上传。

---

## 5. Step 2 · 忽略规则与取消跟踪（不删除工作区文件）

原则：**取消跟踪 + 忽略，而不是删除**。工作区里的文件保持原样，这样 `HANDOFF.md` 里"恢复其他角色"的步骤和 `tools/build_pet_assets.py` 都不受影响。

### 2.1 修改 `.gitignore`

在文件末尾追加（保留现有内容，不要重排）：

```
# 中间产物，可由 raw_images/ 通过 tools/build_pet_assets.py 重新生成
public/assets/pet/

# 已退役角色素材：未取得授权或不属于本产品，不入库（本地保留，见 HANDOFF.md）
sprites/cat/
sprites/doge/
sprites/pepe/
sprites/teddy/
```

> 注意：`sprites/chabit/` **必须继续跟踪**，它是当前唯一在用的角色。

### 2.2 取消跟踪的命令（只写进清单，由用户执行）

以下命令是否需要，取决于 Step 0 里 `git ls-files` 的结果（仅当对应路径**确实被跟踪**才需要）：

```
git rm -r --cached sprites/cat sprites/doge sprites/pepe sprites/teddy
git rm -r --cached public/assets/pet
```

AGENT 把"实际需要执行的子集"写进汇报，不要全抄。

### 2.3 验证

- 说明 Step 0 的引用检查结论：这四个目录在**工作区**保留，所以不影响运行；但**新克隆的仓库里它们不存在**，请额外确认：在没有这四个目录的情况下，`npm test`、`python tools/package_release.py` 仍能通过。如果不能，贴出报错并停下来，不要硬改代码绕过。
- 验证办法：把仓库复制到一个临时目录（如 `%TEMP%\ccbd_clean_check\`），在**该副本**里删除这四个目录和 `public/assets/pet/`、`raw_images/`，再跑 `npm test`。不要在原目录里做删除。

---

## 6. Step 3 · 历史问题处理（按 Step 0 结果分支，Gate B 必停）

> **不可逆操作警告**：改写 git 历史、强制推送都不可逆。AGENT 一律不执行，只写清楚命令和影响，由用户确认后自己执行。

### 分支一：退役素材和 `public/assets/pet/` **从未进过提交历史**
- 只需 Step 2 的 `.gitignore`，无需额外操作。继续 Step 4。

### 分支二：进过历史，但仓库**没有任何远端**（`git remote -v` 为空）
- **默认推荐方案（A）：全新干净仓库**。
  1. 创建新目录（例如 `E:\Doc\Python_daye\CCbd_public\`），只复制应入库的文件（用 `git ls-files` 的结果减去被忽略的路径，或在 Step 2 完成后用 `git ls-files` 导出）。
  2. 在新目录里 `git init`，按 Step 8 的三次提交结构提交。
  3. 旧仓库整体保留为本地归档，**不删除、不推送**。
  - 代价：丢失细粒度提交历史。对一个还没有外部用户的个人项目，这个代价很小。
- 备选方案（B）：`git filter-repo` 重写现有历史。需要用户自行安装工具，出错风险更高，不推荐，除非用户明确要保留历史。

### 分支三：进过历史，且**已有远端**（无论私有还是公开）
- **停止所有操作，汇报给 Claude 与用户。** 需要先确认：
  - 远端是否曾经公开过？如果公开过，素材应视为已经泄露，重写历史也收不回，要另外评估是否需要联系版权方或下架；
  - 如果一直私有，可以按分支二的方案 A 在**新仓库**里公开，旧远端保持私有或删除，由用户决定。

### Gate B：汇报时附上
- 属于哪个分支（依据 Step 0 的哪条输出）；
- 如果是分支二，给出创建干净目录所需的完整命令列表，等用户确认再执行；
- 明确写出"未执行任何会改变 git 历史的命令"。

---

## 7. Step 4 · 美术素材许可证（Gate C）

### 背景
当前 `LICENSE` 是标准 MIT，覆盖整个仓库。公开后，任何人都可以合法地复制、修改、商用 CICI 形象和 7 张场景图。

### 默认方案（推荐，用户未反对即按此执行）
1. **`LICENSE` 保持 MIT 原文不动**，只在文件最上方加一段说明（不改 MIT 条款）：
   ```
   The MIT License below applies to the source code in this repository.
   Artwork (sprites/, scenes/, icons/, store_assets/) is NOT covered by it;
   see ASSETS_LICENSE.md.
   ```
2. 新增 `ASSETS_LICENSE.md`，内容要点（中英文各一段即可）：
   - 适用范围：`sprites/chabit/`、`scenes/`、`icons/`、`store_assets/`；
   - 版权声明：© 2026 CCbd Contributors，保留所有权利（All rights reserved）；
   - 允许：下载并随本扩展一同使用、个人学习；
   - 不允许：未经书面许可的再分发、商用、修改后以任何形式发布；
   - 联系方式：通过 GitHub Issues。
   - 版权署名沿用现有 `CCbd Contributors`，不要擅自换成真实姓名；是否署真名由用户自行修改。
3. README 增加"许可证"一节，说明代码与素材分别适用的条款。

### 备选：用户选择全开放
- 跳过本步，保持现状。此时在 README 里**不需要**额外说明，但请在汇报里记录"用户已选择素材同样适用 MIT"。

### 汇报
- 贴出新增或修改的文件全文，供用户确认。**用户确认前不要把它们放进任何提交清单。**
- 同时汇报：Step 0 里是否发现第三方来源的字体、图标或代码，它们的许可证是否允许再分发。

---

## 8. Step 5 · 信息卫生（并入 Gate A）

只报告，不自作主张修改，以下项目由用户决定：
- **Step 0 的敏感信息扫描结果**：任何命中都逐条列出。真实的密钥、令牌、邮箱、手机号必须由用户处理（轮换或删除），AGENT 只汇报位置。
- **本机绝对路径**（`E:\Doc\...`、`Z:\视频\...`）：存在于 `HANDOFF.md`、`NEXT_WINDOW.md`、`SCENES_*.md`。默认建议**保持原位**，因为这些文件是你与 Claude 窗口交接用的；如果用户希望对外隐藏，可选择把这些文件加入 `.gitignore`。由用户二选一，AGENT 不改。
- **`preview_test.html`**：Step 0 里已说明用途。如果是调试文件，默认建议忽略（加入 `.gitignore`），但等用户确认。
- **`store_assets/`**：若与 v0.13.0 不一致，汇报并建议暂不入库或先标注，由用户定。
- **GitHub Issues URL**：Step 0 已列出；用户需在 GitHub 上确认该仓库的 Issues 功能已开启，且 URL 与将要公开的仓库名一致。**如果需要改代码里的 URL，立刻停下来汇报**，因为这会触及 `options.js` 或 `README`，必须补跑 `npm test` 并同步 CHANGELOG。

---

## 9. Step 6 · 文档同步

1. **README.md**
   - 先读现有内容，**只做增补，不重写**。目标是让陌生访客能看懂：这是什么、怎么装、隐私边界、怎么反馈、许可证。
   - 增补项（缺什么补什么）：
     - 一句话说明（沿用 HANDOFF 的定位："屏幕里的嘴替，不是养成，不控时长不评判"）；
     - 安装方式：下载 Release zip → 解压 → `chrome://extensions` → 打开开发者模式 → 加载已解压的扩展程序；
     - 隐私：无后端、无遥测、数据只存 `chrome.storage.local`，不读取页面标题与内容，链接到 `PRIVACY.md`；
     - 支持站点：x.com / twitter.com、binance.com、okx.com（含镜像）；金融页不显示；
     - 反馈：GitHub Issues；
     - 开发：`npm test`；
     - 许可证：按 Step 4 的结果写。
   - 不写夸大的宣传语，不写"已上架"。
2. **CHANGELOG.md**：在 0.13.0 条目下新增"仓库整理"小节：退役角色素材不再入库（本地保留）、`public/assets/pet/` 不再入库、素材许可条款（视 Step 4）、新增 `RELEASE_PREP.md`（如保留）。
3. **HANDOFF.md**：
   - 0.0 快照里补一条"仓库已为公开做准备"和 git 状态；
   - 「恢复其他角色」步骤里增加一句：**退役素材不在仓库，需从本地备份（`CCbd_backup_20261111\sprites\`）复制回 `sprites/<角色>/`**。
4. **NEXT_WINDOW.md**：更新第 0 节（状态）和第 4 节（待办）：A（性能）改为"不测，等反馈"；B（提交前清理）改为"已转入 `RELEASE_PREP.md`"。**其余未决项保持原样，不要顺手关闭。**

---

## 10. Step 7 · 回归与打包检查

1. 在**当前工作区**运行 `npm test`，贴完整输出（预期全绿；本方案没有动功能代码，若失败要说明原因）。
2. 运行 `python tools/package_release.py`，贴完整输出。
3. 检查新生成的 zip 内容：
   - 贴出文件清单，并对比 HANDOFF 里"32 个文件，约 0.38MB"；
   - **必须不包含**：`raw_images/`、`public/assets/pet/`、`sprites/cat|doge|pepe|teddy/`、`*.md` 开发文档（除打包脚本本来就收的）、`tools/`、`.git/`；
   - **必须包含**：`scenes/`（7 个 webp）、`sprites/chabit/`（9 个 webp）、`manifest.json`、`icons/`；
   - 如果文件数量与 32 不同，逐项说明差异原因。
4. 说明哪些仍需用户**在浏览器里**确认（未验证项）：把 zip 解压到临时目录加载，CICI 能正常出现、背景场景能切换、设置页能打开。

---

## 11. Step 8 · 提交命令清单（AGENT 只写，用户执行）

AGENT 在汇报最后给出**可直接复制的命令清单**，不要执行。建议的三次提交：

1. **素材**：`sprites/chabit/`、`scenes/`、`icons/`
   提交信息示例：`assets: add CICI sprites and hand-drawn scenes`
2. **代码与测试**：`*.js`、`*.html`、`*.css`、`manifest.json`、`package.json`、`tools/`、`.gitignore`
   提交信息示例：`feat: scene layers, retire non-CICI characters, soft-disable accessories (v0.13.0)`
3. **文档与许可证**：`README.md`、`CHANGELOG.md`、`HANDOFF.md`、`NEXT_WINDOW.md`、`PRIVACY.md`、`LICENSE`、`ASSETS_LICENSE.md`、`RELEASE_PREP.md`（若入库）
   提交信息示例：`docs: prepare repository for public release`

之后：`git tag v0.13.0`。

**推送顺序（给用户的提醒，不是给 AGENT 的指令）**：
1. 先 `git status` 确认没有意外文件；
2. 在 GitHub 上先建仓库并保持 **Private**，推送后检查仓库页面和文件列表；
3. 确认没有退役素材、没有源图、没有敏感信息，再把仓库改为 Public；
4. 在 GitHub 上创建 Release，附 `ccbd-v0.13.0.zip`，并确认 Issues 已开启。

---

## 12. 验收标准

- [ ] Step 0 的输出完整贴出，并按"已核对/推断/未验证"分类；
- [ ] 备份目录文件数与大小与源目录一致；
- [ ] `.gitignore` 已追加规则，`sprites/chabit/` 仍被跟踪；
- [ ] Step 3 的分支已明确，没有执行任何改历史的命令；
- [ ] 许可证文件已由用户确认（或用户选择全开放）；
- [ ] `npm test` 全绿且贴出完整输出；
- [ ] 新 zip 内容符合 Step 7 的清单；
- [ ] 提交命令清单已给出，且 AGENT 没有 commit/push；
- [ ] 所有"未验证"项已明确交给用户。

---

## 13. 不在本轮范围内（附触发条件）

以下事项**全部不做**，不要顺手改：

| 事项 | 触发条件 |
|---|---|
| 性能优化（背景呼吸暂停、缩图、网址轮询） | 收到用户反馈卡顿，或 Chrome 任务管理器里空闲 CPU 明显偏高 |
| 方案 B（背景圆算进 `clamp` 边距） | 有多位用户反馈宠物贴边时背景被裁 |
| `tools/test_migration.js` | 准备恢复退役角色，或开始对外发布升级版本且涉及存档迁移 |
| `chabitFatigue` 死代码与 TDZ | 需要让 tired 眼睛跟随"深夜提醒"开关时；届时先读代码再定方案 |
| `FIN_PATH` 收窄 | 有用户反馈在币安/OKX 社交页被误隐藏 |
| 右键子菜单左侧越界 | 有窄窗口用户反馈 |
| 设置页下拉带英文 id、`{name}` 帮助文案 | 做一次文案统一时顺带处理 |
| Chrome 网上应用店上架 | 用户明确决定上架；需要另一份工单，包含商店素材、隐私申报和权限说明 |
