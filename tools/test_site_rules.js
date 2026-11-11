/**
 * test_site_rules.js
 * URL 表驱动的回归测试，验证 XPET.siteAllowed(host, path, sites) 的生效边界：
 * - 币安：仅广场/动态页生效，交易/合约/行情/资产/充值/提现等一律 false
 * - OKX：仅 Orbit/社区动态页生效，交易/行情/资产/钱包等一律 false
 * - X/Twitter：主页、帖子详情、个人主页生效，/messages、/settings、/i/flow、/i/chat 一律 false
 * - 镜像域名（okx.cab/.me、ouyi.com）、子域名、金融词优先、query 不参与判断、siteKeyOf 不误判
 * 注意：用例里的路径是按假设写的，全绿只证明代码与假设一致；请把在真实网站上确认过的 URL 补进 CASES。
 * - 同时验证 content.js 中 document.title 出现次数为 0
 * 用法：node tools/test_site_rules.js
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const sharedPath = path.join(__dirname, '..', 'shared.js');
const contentPath = path.join(__dirname, '..', 'content.js');
const code = fs.readFileSync(sharedPath, 'utf8');

const sandbox = { chrome: { storage: { local: {} } }, Intl };
vm.createContext(sandbox);
vm.runInContext(code + '\nthis.XPET = XPET;', sandbox);
const XPET = sandbox.XPET;

const CASES = [
  // --- X / Twitter ---
  ['https://x.com/home', true, 'X 主页信息流'],
  ['https://x.com/elonmusk/status/123456789', true, 'X 推文详情页'],
  ['https://x.com/explore', true, 'X 探索页'],
  ['https://twitter.com/home', true, 'Twitter 旧域名主页'],
  ['https://x.com/messages', false, 'X 私信列表页 (排除)'],
  ['https://x.com/messages/12345-67890', false, 'X 私信对话页 (排除)'],
  ['https://x.com/settings/account', false, 'X 设置页 (排除)'],
  ['https://x.com/i/flow/login', false, 'X 登录流程页 (排除)'],

  // --- Binance (币安) ---
  ['https://www.binance.com/zh-CN/square', true, '币安广场主页'],
  ['https://www.binance.com/zh-CN/square/post/123456789', true, '币安广场帖子详情页'],
  ['https://www.binance.com/en/square/profile/creator123', true, '币安广场创作者主页'],
  ['https://www.binance.com/zh-CN/feed/post/987654', true, '币安旧版 Feed 帖子页'],
  ['https://www.binance.com/zh-CN/trade/BTC_USDT', false, '币安现货交易页 (排除)'],
  ['https://www.binance.com/zh-CN/futures/BTCUSDT', false, '币安合约交易页 (排除)'],
  ['https://www.binance.com/zh-CN/markets/overview', false, '币安行情概览页 (排除)'],
  ['https://www.binance.com/zh-CN/my/wallet/account/main/deposit/crypto/USDT', false, '币安充值页 (排除)'],
  ['https://www.binance.com/zh-CN/my/wallet/account/main/withdrawal/crypto/USDT', false, '币安提现页 (排除)'],
  ['https://www.binance.com/zh-CN/earn/simple-earn', false, '币安理财页 (排除)'],
  ['https://www.binance.com/zh-CN', false, '币安官网首页 (排除)'],

  // --- OKX (欧易 / OK星球) ---
  ['https://www.okx.com/zh-hans/orbit', true, 'OKX Orbit 星球主页'],
  ['https://www.okx.com/zh-hans/orbit/post/123456', true, 'OKX Orbit 帖子详情页'],
  ['https://www.okx.com/ul/orbit', true, 'OKX 短链 Orbit 页'],
  ['https://www.okx.com/zh-hans/square', true, 'OKX 广场兼容路径'],
  ['https://www.okx.com/zh-hans/trade-spot/btc-usdt', false, 'OKX 现货交易页 (排除)'],
  ['https://www.okx.com/zh-hans/trade-swap/btc-usdt-swap', false, 'OKX 永续合约页 (排除)'],
  ['https://www.okx.com/zh-hans/markets/prices', false, 'OKX 行情列表页 (排除)'],
  ['https://www.okx.com/zh-hans/balance/overview', false, 'OKX 资产概览页 (排除)'],
  ['https://www.okx.com/zh-hans/balance/recharge', false, 'OKX 充币页 (排除)'],
  ['https://www.okx.com/zh-hans/web3', false, 'OKX Web3 钱包页 (排除)'],
  ['https://www.okx.com/zh-hans/help/some-help-center-doc', false, 'OKX 帮助中心普通页 (排除)'],

  // --- 用户 2026-11-08 在真实浏览器里确认过的 URL（币安广场没有话题页）---
  ['https://www.binance.com/zh-CN/square/post/385979144593535', true, '【真实】币安广场帖子详情'],
  ['https://www.binance.com/zh-CN/square/profile/square-creator-00fdd008343d', true, '【真实】币安广场个人页（默认昵称 square-creator-<hex>）'],
  ['https://www.okx.com/zh-hans/orbit', true, '【真实】OKX Orbit 主页'],
  ['https://www.okx.com/zh-hans/orbit/post/92190152109824', true, '【真实】OKX Orbit 帖子详情'],
  ['https://www.okx.com/zh-hans/orbit/user/872896074087006208', true, '【真实】OKX Orbit 用户页'],
  // 假设用例（非真实 URL）：个人页自定义昵称含金融词会被 FIN_PATH 误隐藏，node 实测为 false；与 hashtag/earn 同属宁可隐藏的取舍，未决
  ['https://www.binance.com/en/square/profile/trade-king', false, '已知取舍（未决）：个人页昵称含金融词会被隐藏'],

  // --- 补充：X 新版私信、镜像域名、子域名、金融词优先、query 不参与判断 ---
  ['https://x.com/i/chat', false, 'X 新版私信入口 /i/chat (排除；用户 2026-11-08 在浏览器中确认)'],
  ['https://x.com/i/chat/123456', false, 'X 新版私信对话 (排除)'],
  ['https://mobile.twitter.com/home', true, 'twitter.com 子域名主页'],
  ['https://www.okx.cab/zh-hans/orbit', true, 'OKX .cab 镜像的 Orbit 页'],
  ['https://www.okx.me/orbit', true, 'OKX .me 镜像的 Orbit 页'],
  ['https://www.ouyi.com/zh-hans/orbit', true, '欧易 ouyi.com 镜像的 Orbit 页'],
  ['https://www.okx.cab/zh-hans/trade-spot/btc-usdt', false, 'OKX .cab 镜像的现货交易页 (排除)'],
  ['https://www.okx.com/zh-hans/trade-spot/btc-usdt?from=orbit', false, 'query 里带 orbit 的交易页 (排除：只看 path，不看 query)'],
  ['https://www.okx.com/zh-hans/options', false, 'OKX 期权页 (排除)'],
  ['https://accounts.binance.com/en/login', false, '币安登录页（子域名，排除）'],
  ['https://web3.binance.com/en', false, '币安 Web3 子域名首页 (排除)'],
  ['https://www.binance.com/en/p2p/buy/usdt', false, '币安 P2P 页 (排除)'],
  ['https://www.binance.com/en/convert', false, '币安闪兑页 (排除)'],
  ['https://www.binance.com/en/copy-trading', false, '币安跟单页 (排除)'],
  ['https://www.binance.com/en/dex', false, '币安 DEX 页 (排除)'],
  ['https://www.binance.com/en/futures/square-x', false, '金融词优先：路径里虽然有 square，但在 /futures 下 (排除)'],
  ['https://www.binance.com/en/square/hashtag/earn', false, '已知取舍：广场路径中含金融词的页面宁可隐藏（如果你想让它显示，要改这条期望值并放宽 FIN_PATH）'],
];

let passed = 0;
for (const [rawUrl, expected, desc] of CASES) {
  const u = new URL(rawUrl);
  const actual = XPET.siteAllowed(u.hostname, u.pathname, { x: true, binance: true, okx: true });
  assert.strictEqual(actual, expected, `[FAIL] ${desc}: ${rawUrl} -> expected ${expected}, got ${actual}`);
  passed++;
}

// 验证站点开关关闭时的行为
assert.strictEqual(XPET.siteAllowed('x.com', '/home', { x: false, binance: true, okx: true }), false);
assert.strictEqual(XPET.siteAllowed('www.binance.com', '/zh-CN/square', { x: true, binance: false, okx: true }), false);
assert.strictEqual(XPET.siteAllowed('www.okx.com', '/zh-hans/orbit', { x: true, binance: true, okx: false }), false);

// 验证 siteKeyOf：不该把 fox.com、notx.com 误判成 X
const KEY_CASES = [
  ['x.com', 'x'], ['www.x.com', 'x'], ['twitter.com', 'x'], ['mobile.twitter.com', 'x'],
  ['www.binance.com', 'binance'], ['accounts.binance.com', 'binance'],
  ['www.okx.com', 'okx'], ['www.okx.cab', 'okx'], ['www.okx.me', 'okx'], ['www.ouyi.com', 'okx'],
  ['fox.com', 'other'], ['notx.com', 'other'], ['example.com', 'other'],
];
for (const [host, expected] of KEY_CASES) {
  assert.strictEqual(XPET.siteKeyOf(host), expected, `siteKeyOf(${host}) 应为 ${expected}`);
}

// 验证 content.js 中不再出现 document.title
const contentSrc = fs.readFileSync(contentPath, 'utf8');
const titleMatches = contentSrc.match(/document\.title/g);
assert.strictEqual(titleMatches, null, 'content.js 中不应再出现 document.title');

console.log(`✅ All ${passed} URL site rule test cases + site toggle checks + 0 document.title check passed!`);

