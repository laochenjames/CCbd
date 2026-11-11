/**
 * test_scenes.js
 * 自动化测试背景场景逻辑、数据模型合并、静态资源完整性。
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '..');

// 加载 shared.js
const sharedCode = fs.readFileSync(path.join(ROOT, 'shared.js'), 'utf8');
const vm = require('vm');
const sandbox = {
  chrome: {
    runtime: { id: 'test' },
    storage: { local: {} },
  },
  console,
};
vm.createContext(sandbox);
vm.runInContext(sharedCode + '\nthis.XPET = XPET;', sandbox);
const XPET = sandbox.XPET;

console.log('=== 开始执行背景场景自动化测试 (test_scenes.js) ===');

// 1. 测试 XPET.sceneFor(hour, sceneSettings)
console.log('1. 测试 sceneFor 边界与映射规则...');
// off 模式
assert.strictEqual(XPET.sceneFor(10, { mode: 'off', id: 'rain' }), null, 'off 模式必须返回 null');
assert.strictEqual(XPET.sceneFor(0, null), null, 'null 设置必须返回 null');
assert.strictEqual(XPET.sceneFor(12, { mode: 'unknown' }), null, '非法 mode 必须返回 null');

// manual 模式
assert.strictEqual(XPET.sceneFor(2, { mode: 'manual', id: 'rain' }), 'rain', 'manual 合法 id 必须返回对应 id');
assert.strictEqual(XPET.sceneFor(15, { mode: 'manual', id: 'snow' }), 'snow', 'manual 合法 id 必须返回对应 id');
assert.strictEqual(XPET.sceneFor(8, { mode: 'manual', id: 'invalid-id' }), null, 'manual 非法 id 必须返回 null');

// time 模式时段映射 (05-10 morning, 11-16 afternoon, 17-19 dusk, 20-23/00-04 night)
const timeTests = [
  [0, 'night'],
  [4, 'night'],
  [5, 'morning'],
  [10, 'morning'],
  [11, 'afternoon'],
  [16, 'afternoon'],
  [17, 'dusk'],
  [19, 'dusk'],
  [20, 'night'],
  [23, 'night'],
];
timeTests.forEach(([hour, expected]) => {
  const res = XPET.sceneFor(hour, { mode: 'time' });
  assert.strictEqual(res, expected, `小时 ${hour} 应映射到场景 ${expected}，实际得到 ${res}`);
});
console.log('  -> sceneFor 全部时段与模式测试通过！');

// 2. 测试 mergeSettings 数据合并
console.log('2. 测试 mergeSettings 校验与旧版本兼容...');
const defSettings = XPET.defaultSettings();
assert.strictEqual(defSettings.scene.mode, 'off', '默认 scene mode 必须为 off');
assert.strictEqual(defSettings.scene.id, 'rain', '默认 scene id 必须为 rain');

// 老版本存档没有 scene 字段
const legacyRaw = { chipMode: 'always' };
const mergedLegacy = XPET.mergeSettings(legacyRaw);
assert.strictEqual(mergedLegacy.scene.mode, 'off', '无 scene 字段的旧存档必须安全赋予默认 off');
assert.strictEqual(mergedLegacy.scene.id, 'rain', '无 scene 字段的旧存档赋予默认 rain');

// 脏数据或非法字段
const dirtyRaw = { scene: { mode: 'hack', id: 'not-exist' } };
const mergedDirty = XPET.mergeSettings(dirtyRaw);
assert.strictEqual(mergedDirty.scene.mode, 'off', '非法 mode 必须回退到 off');
assert.strictEqual(mergedDirty.scene.id, 'rain', '非法 id 必须回退到 rain');

// 正常合法设置保留
const validRaw = { scene: { mode: 'time', id: 'snow' } };
const mergedValid = XPET.mergeSettings(validRaw);
assert.strictEqual(mergedValid.scene.mode, 'time');
assert.strictEqual(mergedValid.scene.id, 'snow');
console.log('  -> mergeSettings 校验与旧版本兼容测试通过！');

// 3. 测试静态一致性（防止打包或运行时 404）
console.log('3. 测试静态一致性（文件存在、体积、manifest、打包清单）...');
assert(Array.isArray(XPET.SCENES) && XPET.SCENES.length === 7, 'XPET.SCENES 必须包含 7 个场景');

const ids = new Set();
XPET.SCENES.forEach((s) => {
  assert(/^[a-z]+$/.test(s.id), `场景 id 必须为全小写字母: ${s.id}`);
  assert(!ids.has(s.id), `场景 id 重复: ${s.id}`);
  ids.add(s.id);
  assert(s.label && typeof s.label === 'string', `场景 label 不能为空: ${s.id}`);

  // 检查实际文件存在且 <= 80KB
  const filePath = path.join(ROOT, 'scenes', s.file);
  assert(fs.existsSync(filePath), `场景物理文件不存在: ${filePath}`);
  const stats = fs.statSync(filePath);
  const sizeKb = stats.size / 1024;
  assert(sizeKb <= 80, `场景文件 ${s.file} 体积超标 (${sizeKb.toFixed(1)} KB > 80 KB)`);
});

// 检查 manifest.json
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
const war = manifest.web_accessible_resources || [];
const hasSceneResource = war.some((w) => (w.resources || []).some((r) => r.includes('scenes/')));
assert(hasSceneResource, 'manifest.json 的 web_accessible_resources 必须包含 scenes/*');

// 检查 tools/package_release.py
const packagerCode = fs.readFileSync(path.join(ROOT, 'tools', 'package_release.py'), 'utf8');
assert(packagerCode.includes("'scenes'") || packagerCode.includes('"scenes"'), 'package_release.py 必须包含 scenes 目录');

// 4. 运行时几何常量一致性校验（content.js 与 build_scene_assets.py 必须保持完全一致）
console.log('4. 测试背景几何常量双向一致性 (content.js <-> build_scene_assets.py)...');
const contentCode = fs.readFileSync(path.join(ROOT, 'content.js'), 'utf8');
const assetBuilderCode = fs.readFileSync(path.join(ROOT, 'tools', 'build_scene_assets.py'), 'utf8');

const parseConst = (code, name) => {
  const m = code.match(new RegExp(`${name}\\s*=\\s*([-0-9.]+)`));
  assert(m, `未在代码中找到常量定义: ${name}`);
  return parseFloat(m[1]);
};

['SCENE_SIDE_RATIO', 'SCENE_DX_RATIO', 'SCENE_DY_RATIO'].forEach((constName) => {
  const vContent = parseConst(contentCode, constName);
  const vBuilder = parseConst(assetBuilderCode, constName);
  assert.strictEqual(vContent, vBuilder, `几何常量 ${constName} 不一致: content.js(${vContent}) !== build_scene_assets.py(${vBuilder})`);
});
console.log('  -> 背景几何常量一致性检查通过！');

console.log('  -> 静态一致性检查全部通过！');

console.log('✅ test_scenes.js: 所有 4 大类测试全部 100% 通过！\n');
