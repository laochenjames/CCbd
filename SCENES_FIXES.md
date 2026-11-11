# 背景场景 v0.13.0 · 修复清单（给 AGENT）

> 来源：对已完成的 v0.13.0 背景场景实现做的代码评审（只读代码，没有运行）。
> 先读 `HANDOFF.md` 的「零、接手说明」；汇报时把「已核对（看到文件或输出）/ 推断 / 未验证（需用户在浏览器确认）」分开写。
> **不要自行 commit / push。** 不要改动已定的产品决策（默认关闭、只用本地信号、不接天气、不挂解锁）。

本清单共 5 项，按顺序做。每项都有「问题 → 要求 → 验收」。

---

## 0. 开工前

1. 跑一次 `npm test`，把完整输出贴进汇报（这是基线；HANDOFF 里目前没有 v0.13 的输出）。
2. 以下文件会被改：`content.js`、`pet.css`、`options.js`、`tools/build_scene_assets.py`、`tools/test_scenes.js`、`HANDOFF.md`、`CHANGELOG.md`。改前先读一遍当前内容，不要凭本文档假设行号。

---

## 1. 右键「背景场景」子菜单会掉出屏幕（必修）

### 问题
- `content.js` 的右键菜单：主菜单位置做了边界约束，但子菜单 `.xpet-submenu`（`position:absolute; left:100%; top:-4px`，`display:none`，悬停时 `display:block`）只处理了水平翻转（`xpet-submenu-flip`，且只按固定 140px 估算宽度），**没有处理垂直方向**。
- 子菜单有 9 项（关闭、跟随时段、7 个场景），高约 290px，从菜单第 6 行开始向下展开。宠物默认在右下角、菜单贴着屏幕底部时，估计会超出视口约 190px，下面 5～6 项点不到（`position: fixed` 的菜单不能滚动）。

### 要求
1. 悬停「背景场景」那一行（`mouseenter`）时，实测子菜单尺寸再定位：
   - 先让子菜单临时可测（例如临时 `display:block; visibility:hidden`，量完恢复，或利用 `:hover` 已生效的状态量），拿 `getBoundingClientRect()`。
   - **垂直**：若 `rect.bottom > innerHeight - MARGIN`，把 `top` 往上移 `overflow` 像素（即 `top = -4 - overflow`）；移动后若 `rect.top < MARGIN`，则把 `top` 调到刚好 `rect.top = MARGIN`，并给子菜单设 `max-height: innerHeight - 2*MARGIN; overflow-y: auto`。
   - **水平**：改用实测宽度判断：`rect.right > innerWidth - MARGIN` 时才加 `xpet-submenu-flip`；翻转后若左边仍超出，则贴边（不要出现两边都超出）。
2. 每次悬停都重新计算（先清掉上一次设置的 `top` / `max-height` / flip class），因为主菜单位置每次右键都不同。
3. 不改变菜单项内容、顺序、勾选逻辑和 `closeMenu()` 行为。
4. 深色模式样式不动。

### 验收（交给用户手测，AGENT 先自查代码）
- 把宠物分别拖到：屏幕最下方、最右、最上、最左、四个角、中间；每个位置右键 → 悬停「背景场景」：**9 项全部可见、可点**，Esc 能关闭。
- 缩小浏览器窗口高度（例如 500px 高）再试一次，出现滚动条也要能点到全部项。

---

## 2. 背景几何：记录实际数值，并让预览图与运行时一致（必修）

### 问题
- 方案要求 `0.86W` 居中、不出根框。实际代码是（`content.js` 顶部）：
  ```
  SCENE_SIDE_RATIO = 1.15
  SCENE_DX_RATIO  = -0.11   // 向左 11% W
  SCENE_DY_RATIO  = -0.18   // 向上 18% H
  ```
  这个改动没有写进 HANDOFF / CHANGELOG；`tools/build_scene_assets.py` 生成的 `sheet_pet.png` 还在用旧的 0.86W 居中几何，所以预览图和用户实际看到的不一致。
- 按这组数值算（`W=72s, H=64s`，四舍五入后约）：

  | 大小档 | W×H | 圆边长 | left | top |
  |---|---|---|---|---|
  | 标准 1.0 | 72×64 | 83 | −13 | −21 |
  | 大 2.2 | 158×141 | 182 | −29 | −46 |
  | 特大 3.0 | 216×192 | 248 | −40 | −63 |

  即圆会明显超出宠物根框（特大档顶部多出约 63px、左侧约 40px）。**这是用户可能手调出来的，数值本身不要改，只补记录、补一致性。**

### 要求
1. **不改这三个常量的数值**。在 `content.js` 里给它们加一段注释：这是用户对着预览手调的结果，含义是什么（放大并向左上平移，让圆形窗景衬在头部与笔记本后面），以及圆会超出根框。
2. 在 `HANDOFF.md` 的「0.0 最新状态快照」和 `CHANGELOG.md` 的 0.13.0 里写明：实际几何是 1.15 / −0.11 / −0.18，并附上面的尺寸表；说明「`clamp` 只约束根框，宠物贴近屏幕上沿/左沿时背景圆会被屏幕边裁掉一块」是已知的、**当前选择不处理**。
3. **预览图与运行时对齐**：
   - `tools/build_scene_assets.py` 里把这三个常量原样复制一份（顶部写明「必须与 content.js 保持一致」），并用它们重画 `sheet_pet.png`。
   - 预览单元格要放得下超出部分：例如每格 320×300，把 3.0 档的根框（216×192）放在格内偏右下的位置（如左上角 (70, 90)），再按上述公式贴背景和宠物（宠物是 `W×W`、底部对齐）。
   - 保留 4 种底色（#FFFFFF、#000000、#15202B、#181A20）。同时再各出一份 1.0 档和 2.2 档的缩略对照（不用逐场景，挑 night / snow / rain 即可）。
4. **加一致性测试**：在 `tools/test_scenes.js` 里用正则分别读出 `content.js` 与 `tools/build_scene_assets.py` 里的这三个常量，断言两边相等（防止以后只改一边）。
5. 可选方案 B（**需要用户明确同意才做，没同意就不要实现**）：让 `clamp` 在场景开启时把圆的超出量算进边距，宠物就不能贴着屏幕边放。默认不做，在汇报里写一句「未实现，待用户决定」。

### 验收
- 新生成的 `sheet_pet.png` 里，背景和宠物的相对位置与浏览器里一致（用户肉眼对比）。
- `npm test` 通过，且常量一致性断言在故意改动一边时会失败（AGENT 自测一次后还原）。

---

## 3. 设置页会用旧数据覆盖右键菜单的改动（必修）

### 问题
- `options.js` 在页面打开时读一次 `settings`，之后每次保存都写回整个对象；它不监听 `XPET.SETTINGS_KEY` 的变化。
- 复现：开着设置页 → 在 X 页面用右键菜单切场景 → 回设置页改任意一项 → 场景被设置页里的旧值写回去。`quietUntil`（「今天安静」）同理。

### 要求
1. 在 `options.js` 现有的 `chrome.storage.onChanged` 监听里（或新增一个），对 `changes[XPET.SETTINGS_KEY]`：
   ```js
   const ns = XPET.mergeSettings(changes[XPET.SETTINGS_KEY].newValue);
   settings.scene = ns.scene;
   settings.quietUntil = ns.quietUntil;
   syncSettingsUI();
   ```
   只同步**设置页自己不通过界面编辑**、会被内容脚本改动的字段（`scene`、`quietUntil`），其余字段保持设置页的内存状态，避免打断用户正在输入的内容。
2. 自己写入触发的 `onChanged` 也会走到这里，必须无副作用（值相同、`syncSettingsUI()` 幂等；`renderSlots` / `renderHolidays` 已有「正在输入就不重绘」保护，保持）。
3. 不改其他保存逻辑。

### 验收
- 开着设置页，在 X 上右键切场景：设置页的「背景场景」下拉**不刷新也会跟着变**。
- 再在设置页改任意其他选项：场景**不会被改回去**。
- 在设置页自己切场景/模式依然正常，无重复保存提示闪烁。

---

## 4. 切换场景的体验与实现细节（应修）

### 问题
- 文档（HANDOFF / CHANGELOG）声称有「250ms 交叉淡入淡出」，实际只有开/关时的淡入淡出；场景 A → B 是直接换 `img.src`，没预加载，可能闪一下旧图或空白；首次显示时图片还没解码就开始淡入，会「蹦」出来。
- 关闭场景时用 `sceneImg.src = ''`，不规范（某些情况下会触发错误事件）。
- `content.js` 用 `` `scenes/${targetId}.webp` `` 拼地址，没有用 `XPET.SCENES[].file`，而测试检查的是 `file`；两者将来不一致时测试通过、运行时 404。

### 要求（改 `applyScene()`，只描述行为，代码仅为示意）
1. 地址一律来自 `XPET.SCENES.find(s => s.id === targetId).file`。
2. 切换到新场景时：**先预加载**（`new Image()`，`onload`/`onerror` 都要收尾），加载完成后再显示；若当前已有旧场景，先淡出旧的（等 transition 结束，约 250ms），再换 `src` 并淡入。
3. 用递增的 token（如 `sceneToken`）防竞态：快速连续切换（A→B→C）时，只有最后一次生效，前面的回调直接丢弃。
4. 关闭场景：先淡出，250ms 后（且 token 未变）`removeAttribute('src')`；不要再设 `src = ''`。
5. 色调滤镜的 class（`xpet-scene-<id>`）随目标场景立即切换即可（CSS 自带 0.4s 的 filter 过渡）。
6. 保持：`curSceneId` 相同直接返回；5 秒 tick 里只有结果变了才动 DOM；减少动态效果下背景不呼吸。
7. 示意（可改）：
   ```js
   let sceneToken = 0;
   function applyScene() {
     if (!sceneEl || !sceneImg) return;
     const targetId = XPET.sceneFor(new Date().getHours(), settings.scene);
     if (targetId === curSceneId) return;
     const hadScene = !!curSceneId;
     curSceneId = targetId;
     const token = ++sceneToken;
     Array.from(root.classList).forEach((c) => { if (c.startsWith('xpet-scene-')) root.classList.remove(c); });
     sceneEl.classList.remove('xpet-scene-active');            // 先淡出旧的
     if (!targetId) { setTimeout(() => { if (token === sceneToken) sceneImg.removeAttribute('src'); }, 260); return; }
     root.classList.add('xpet-scene-' + targetId);
     const def = XPET.SCENES.find((s) => s.id === targetId);
     const url = chrome.runtime.getURL('scenes/' + def.file);
     const im = new Image();
     const show = () => setTimeout(() => {
       if (token !== sceneToken) return;
       sceneImg.src = url;
       sceneEl.classList.add('xpet-scene-active');
     }, hadScene ? 260 : 0);
     im.onload = show;
     im.onerror = () => {};                                     // 图片缺失就保持无背景，不报错
     im.src = url;
   }
   ```
   （注意：`settings` 是 `let`，声明在 `renderChar()` 首次调用之后；`applyScene` 目前只在设置加载完成后调用，保持这一点，不要在启动期同步路径里读 `settings`。）

### 验收
- 手选场景之间来回切、快速连续点右键菜单里的不同场景：没有闪白、没有旧图残留，最终停在最后一次选择。
- 「关闭」后再次「开启」同一场景：能正常淡入。
- 把某个 `scenes/*.webp` 临时改名：对应场景不显示背景，控制台无未捕获报错（验完改回）。

---

## 5. 资产脚本的假设与文档修正（应修）

### 5a. `tools/build_scene_assets.py`
- 现在固定用 `R_CROP = 810`、居中裁切，隐含「每张原图都是 2048×2048」，没有任何断言；尺寸不对会静默产出带黑边的坏图。
- 要求：
  1. 读到图后检查宽高：必须近似正方形（宽高差 ≤ 2px），否则**报错并终止**，提示是哪个文件、实际尺寸。
  2. 把 `R_CROP` 改成按比例：`R_CROP_RATIO = 810 / 2048`，`r = R_CROP_RATIO * min(w, h)`，中心取图像中心。2048 的图结果必须与现在**逐像素一致**（回归检查：对 7 张图重新生成后，与现有 `scenes/*.webp` 的像素差应为 0 或仅有压缩噪声级别，AGENT 自行比较并在汇报里写结果；若与现有产物明显不同，先别覆盖，汇报）。
  3. 开头 `print` 每张源图的尺寸，方便用户核对。
  4. 羽化参数 `FEATHER_INNER / OUTER` 保持现值。

### 5b. 文档修正（`HANDOFF.md`、`CHANGELOG.md`）
- 把「250ms 交叉淡入淡出」改成实际行为（完成第 4 项后，就如实写预加载 + 淡出淡入）。
- 删除「无杂色白晕边」这类没有验证依据的说法；改成：「边缘由径向羽化蒙版处理（0.88→0.98），在深色页面上的观感需用户目检；对照图见 `raw_images/_preview/`」。
- 把 HANDOFF 标题的 `(v0.12)` 和 0.1 节里的「manifest.json 版本 0.12.0」改成 0.13.0。
- 在 0.3「验证状态」里写明 v0.13 的真实验证情况：`npm test` 的实际输出（第 0 步贴的）、哪些是只读代码推断、哪些必须用户在浏览器实测（子菜单边缘、背景切换、设置页同步、深色页面上的边缘观感）。
- 在 0.0 快照里加一条：实际背景几何数值（见第 2 项）。

### 验收
- 用一张故意改成 1024×1024 的临时图跑脚本：必须报错终止；用原图跑：产物与现有 `scenes/*.webp` 一致。
- 文档里不再有与代码不符的说法。

---

## 完成后

1. `npm test` 全部通过，并贴**完整输出**。
2. 汇报格式：每项写「改了什么 / 改动的文件 / 已核对 / 推断 / 未验证」。
3. 把用户需要在浏览器里做的手测整理成一张清单交给用户：
   - 宠物在屏幕四边四角 + 中间，右键 →「背景场景」，9 项都能点到；
   - 开着设置页，在 X 上切场景，设置页同步，再改别的项场景不回退；
   - 手选场景之间快速切换、开关场景，无闪烁、无残留；
   - 深色页面（X 深色 / 币安深色）上各场景的边缘观感；
   - 新的 `sheet_pet.png` 与浏览器里的实际位置一致。
4. 不 commit、不 push；提醒用户在手测通过后再自行提交。

## 本清单未纳入（用户未决定，不要顺手做）

- `tools/test_migration.js`（迁移逻辑测试）仍未写；
- `public/assets/pet/` 的 PNG 是否加入 `.gitignore`；
- `chabitFatigue` 里不可达的 `half` 分支，以及 tired 眼睛不看「深夜提醒」开关；
- 第 2 项的方案 B（`clamp` 把背景超出量算进边距）。
