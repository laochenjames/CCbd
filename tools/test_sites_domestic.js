/**
 * Phase 3 + Workorder Part A: 国内站点（微博、知乎）规则、interactionPolicy、AI buildPrompt 与老角色升级回归测试
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const sharedPath = path.join(__dirname, '..', 'shared.js');
const sandbox = { Object, Array, chrome: { storage: { local: {} } }, Intl };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(sharedPath, 'utf8') + '\nthis.XPET = XPET;', sandbox);
const XPET = sandbox.XPET;

const ALL_ON = { x: true, binance: true, okx: true, weibo: true, zhihu: true };

// 每条用例标注来源：observed（Phase 1 浏览器实测路径）或 assumed（按常见站点结构假设）
const CASES = [
  // 微博：允许
  ['weibo.com', '/', ALL_ON, 'weibo', true, '微博首页', 'observed'], // observed
  ['weibo.com', '/hot/weibo/102803', ALL_ON, 'weibo', true, '微博热搜流', 'observed'], // observed
  ['weibo.com', '/u/123456', ALL_ON, 'weibo', true, '微博个人主页', 'observed'], // observed
  ['s.weibo.com', '/weibo', ALL_ON, 'weibo', true, '微博搜索子域', 'assumed'], // assumed
  // 微博：黑名单排除
  ['weibo.com', '/login', ALL_ON, 'weibo', false, '微博登录页 /login', 'assumed'], // assumed
  ['weibo.com', '/login.php', ALL_ON, 'weibo', false, '微博登录页 /login.php', 'assumed'], // assumed
  ['weibo.com', '/newlogin', ALL_ON, 'weibo', false, '微博新登录页 /newlogin', 'assumed'], // assumed
  ['weibo.com', '/signin', ALL_ON, 'weibo', false, '微博 signin', 'assumed'], // assumed
  ['weibo.com', '/settings/account', ALL_ON, 'weibo', false, '微博设置页', 'assumed'], // assumed
  ['weibo.com', '/set/index', ALL_ON, 'weibo', false, '微博旧版设置路径 /set', 'assumed'], // assumed
  ['weibo.com', '/messages', ALL_ON, 'weibo', false, '微博私信页', 'assumed'], // assumed
  ['weibo.com', '/chat/123', ALL_ON, 'weibo', false, '微博聊天页', 'assumed'], // assumed
  ['weibo.com', '/pay/vip', ALL_ON, 'weibo', false, '微博支付/会员', 'assumed'], // assumed
  ['weibo.com', '/creator/home', ALL_ON, 'weibo', false, '微博创作者中心', 'assumed'], // assumed
  ['weibo.com', '/draft', ALL_ON, 'weibo', false, '微博草稿页', 'assumed'], // assumed
  ['passport.weibo.com', '/sso/login', ALL_ON, 'other', false, '微博登录子域排除', 'assumed'], // assumed
  ['account.weibo.com', '/set/index', ALL_ON, 'other', false, '微博账号子域排除', 'assumed'], // assumed
  ['card.weibo.com', '/article/v3/editor', ALL_ON, 'other', false, '微博头条文章编辑器子域排除', 'assumed'], // assumed
  ['weibo.com', '/', { ...ALL_ON, weibo: false }, 'weibo', false, '微博开关关闭', 'observed'], // observed

  // 知乎：允许
  ['www.zhihu.com', '/', ALL_ON, 'zhihu', true, '知乎首页', 'observed'], // observed
  ['www.zhihu.com', '/question/123456', ALL_ON, 'zhihu', true, '知乎问题页', 'assumed'], // assumed
  ['zhuanlan.zhihu.com', '/p/123456', ALL_ON, 'zhihu', true, '知乎专栏文章', 'assumed'], // assumed
  ['www.zhihu.com', '/people/someone', ALL_ON, 'zhihu', true, '知乎个人主页', 'assumed'], // assumed
  // 知乎：黑名单排除
  ['www.zhihu.com', '/signin', ALL_ON, 'zhihu', false, '知乎登录页', 'assumed'], // assumed
  ['www.zhihu.com', '/settings/profile', ALL_ON, 'zhihu', false, '知乎设置页', 'assumed'], // assumed
  ['www.zhihu.com', '/account/security', ALL_ON, 'zhihu', false, '知乎账号安全', 'assumed'], // assumed
  ['www.zhihu.com', '/messages', ALL_ON, 'zhihu', false, '知乎私信页', 'assumed'], // assumed
  ['www.zhihu.com', '/notifications', ALL_ON, 'zhihu', false, '知乎通知页', 'assumed'], // assumed
  ['www.zhihu.com', '/vip', ALL_ON, 'zhihu', false, '知乎会员页', 'assumed'], // assumed
  ['www.zhihu.com', '/xen/market', ALL_ON, 'zhihu', false, '知乎盐选市场页', 'assumed'], // assumed
  ['www.zhihu.com', '/creator', ALL_ON, 'zhihu', false, '知乎创作者中心', 'assumed'], // assumed
  ['zhuanlan.zhihu.com', '/write', ALL_ON, 'zhihu', false, '知乎专栏写文章页', 'assumed'], // assumed
  ['www.zhihu.com', '/drafts', ALL_ON, 'zhihu', false, '知乎草稿页', 'assumed'], // assumed
  ['passport.zhihu.com', '/login', ALL_ON, 'other', false, '知乎登录子域排除', 'assumed'], // assumed
  ['www.zhihu.com', '/', { ...ALL_ON, zhihu: false }, 'zhihu', false, '知乎开关关闭', 'observed'], // observed
];

let observedCount = 0;
let assumedCount = 0;
for (const [host, pathname, sites, expKey, expAllowed, desc, src] of CASES) {
  if (src === 'observed') observedCount++;
  else assumedCount++;
  assert.strictEqual(XPET.siteKeyOf(host), expKey, `siteKeyOf 失败: ${desc} (${host})`);
  assert.strictEqual(XPET.siteAllowed(host, pathname, sites), expAllowed, `siteAllowed 失败: ${desc} (${host}${pathname})`);
}

// A1: interactionPolicy 测试
assert.deepStrictEqual({ ...XPET.interactionPolicy('x') }, { level: 'L2', generic: false, ctrlEnter: true }, 'x 互动策略');
assert.deepStrictEqual({ ...XPET.interactionPolicy('binance') }, { level: 'L2', generic: true, ctrlEnter: true }, 'binance 互动策略');
assert.deepStrictEqual({ ...XPET.interactionPolicy('okx') }, { level: 'L2', generic: true, ctrlEnter: true }, 'okx 互动策略');
assert.deepStrictEqual({ ...XPET.interactionPolicy('weibo') }, { level: 'L2', generic: false, ctrlEnter: false }, 'weibo 互动策略');
assert.deepStrictEqual({ ...XPET.interactionPolicy('zhihu') }, { level: 'L2', generic: false, ctrlEnter: false }, 'zhihu 互动策略');
assert.deepStrictEqual({ ...XPET.interactionPolicy('other') }, { level: 'L1', generic: false, ctrlEnter: false }, '未知站点互动策略');

for (const s of XPET.SITES) {
  if (s.level === 'L1') {
    const pol = XPET.interactionPolicy(s.key);
    assert.strictEqual(pol.generic, false, `L1 站点 ${s.key} generic 必须为 false`);
    assert.strictEqual(pol.ctrlEnter, false, `L1 站点 ${s.key} ctrlEnter 必须为 false`);
  }
}

// A2: AI buildPrompt 编号连续性与站点名称测试
const promptText = XPET.AI.buildPrompt();
const numLines = promptText.split(/\r?\n/).filter((l) => /^\d+\.\s/.test(l));
assert.strictEqual(numLines.length, 20, `buildPrompt 编号行应为 20 条，实际 ${numLines.length}`);
numLines.forEach((line, idx) => {
  const n = parseInt(line.match(/^(\d+)\./)[1], 10);
  assert.strictEqual(n, idx + 1, `buildPrompt 编号不连续: 期望 ${idx + 1}，实际 ${n} (${line})`);
});
for (const s of XPET.SITES) {
  assert.ok(promptText.includes(s.name), `buildPrompt 应包含站点名: ${s.name}`);
}

// 老角色缺少 clickWeibo / clickZhihu 时，normalizeChar 自动补全默认台词
const oldChar = { id: 'c1', name: '旧角色', phrases: { click: ['hi'] } };
const norm = XPET.normalizeChar(oldChar);
assert.ok(Array.isArray(norm.phrases.clickWeibo) && norm.phrases.clickWeibo.length > 0, 'normalizeChar 应补全 clickWeibo');
assert.ok(Array.isArray(norm.phrases.clickZhihu) && norm.phrases.clickZhihu.length > 0, 'normalizeChar 应补全 clickZhihu');
assert.ok(Array.isArray(norm.phrases.clickXhs) && norm.phrases.clickXhs.length > 0, 'normalizeChar 应补全 clickXhs');
assert.ok(Array.isArray(norm.phrases.clickBilibili) && norm.phrases.clickBilibili.length > 0, 'normalizeChar 应补全 clickBilibili');
assert.ok(Array.isArray(norm.phrases.clickDouyin) && norm.phrases.clickDouyin.length > 0, 'normalizeChar 应补全 clickDouyin');

// videoActive 与 hasPlayingVideo 纯函数测试
assert.strictEqual(XPET.hasPlayingVideo([]), false, '无视频应返回 false');
assert.strictEqual(XPET.hasPlayingVideo([{ paused: true, ended: false, readyState: 4, currentTime: 10 }]), false, '暂停应返回 false');
assert.strictEqual(XPET.hasPlayingVideo([{ paused: false, ended: true, readyState: 4, currentTime: 10 }]), false, '结束应返回 false');
assert.strictEqual(XPET.hasPlayingVideo([{ paused: false, ended: false, readyState: 1, currentTime: 10 }]), false, '缓冲中 readyState<2 应返回 false');
assert.strictEqual(XPET.hasPlayingVideo([{ paused: false, ended: false, readyState: 2, currentTime: 0.1 }]), true, '正常播放应返回 true');
assert.strictEqual(
  XPET.hasPlayingVideo([
    { paused: true, ended: false, readyState: 4, currentTime: 5 },
    { paused: false, ended: false, readyState: 3, currentTime: 1.5 },
  ]),
  true,
  '多个视频只要一个播放应返回 true'
);
assert.strictEqual(Boolean(XPET.siteByKey('bilibili').videoActive), true, 'bilibili 应启用 videoActive');
assert.strictEqual(Boolean(XPET.siteByKey('douyin').videoActive), true, 'douyin 应启用 videoActive');
assert.strictEqual(Boolean(XPET.siteByKey('xhs').videoActive), false, 'xhs 不应启用 videoActive');

console.log(`✅ test_sites_domestic.js: ${CASES.length} 组国内站点规则（observed: ${observedCount}, assumed: ${assumedCount}）+ interactionPolicy + buildPrompt + 老角色升级全部通过！`);
