/**
 * 站点注册表重构前的“黄金表”回归测试（Phase 2.1）
 * 覆盖 x / twitter / binance / okx 及其镜像域名、FIN_PATH、X 排除路径与 sites 开关。
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const sharedPath = path.join(__dirname, '..', 'shared.js');
const sandbox = { chrome: { storage: { local: {} } }, Intl };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(sharedPath, 'utf8') + '\nthis.XPET = XPET;', sandbox);
const XPET = sandbox.XPET;

const ALL_ON = { x: true, binance: true, okx: true };

// [host, path, sites, expectedKey, expectedAllowed, desc]
const GOLDEN = [
  // X / Twitter
  ['x.com', '/home', ALL_ON, 'x', true, 'X 首页'],
  ['www.x.com', '/elonmusk', ALL_ON, 'x', true, 'www.x.com 用户页'],
  ['twitter.com', '/home', ALL_ON, 'x', true, 'twitter.com 首页'],
  ['mobile.twitter.com', '/explore', ALL_ON, 'x', true, 'mobile.twitter.com'],
  ['x.com', '/messages', ALL_ON, 'x', false, 'X 私信页排除'],
  ['x.com', '/messages/12345', ALL_ON, 'x', false, 'X 私信会话页排除'],
  ['x.com', '/settings', ALL_ON, 'x', false, 'X 设置页排除'],
  ['x.com', '/settings/account', ALL_ON, 'x', false, 'X 设置子页排除'],
  ['x.com', '/i/flow/login', ALL_ON, 'x', false, 'X 登录流程排除'],
  ['x.com', '/i/chat', ALL_ON, 'x', false, 'X 新版私信入口排除'],
  ['x.com', '/i/chat/999', ALL_ON, 'x', false, 'X 新版私信子页排除'],
  ['x.com', '/home', { x: false, binance: true, okx: true }, 'x', false, 'X 开关关闭'],
  ['notx.com', '/home', ALL_ON, 'other', false, 'notx.com 不误判为 X'],
  ['fox.com', '/home', ALL_ON, 'other', false, 'fox.com 不误判为 X'],

  // Binance
  ['www.binance.com', '/zh-CN/square', ALL_ON, 'binance', true, '币安广场主页'],
  ['www.binance.com', '/zh-CN/square/post/123456', ALL_ON, 'binance', true, '币安广场帖子'],
  ['www.binance.com', '/en/square/profile/creator1', ALL_ON, 'binance', true, '币安广场个人页'],
  ['www.binance.com', '/zh-CN/feed/post/987654', ALL_ON, 'binance', true, '币安旧版 feed'],
  ['www.binance.com', '/zh-CN/trade/BTC_USDT', ALL_ON, 'binance', false, '币安现货交易排除'],
  ['www.binance.com', '/zh-CN/futures/BTCUSDT', ALL_ON, 'binance', false, '币安合约交易排除'],
  ['www.binance.com', '/zh-CN/markets/overview', ALL_ON, 'binance', false, '币安行情排除'],
  ['www.binance.com', '/zh-CN/my/wallet/account/main/deposit/crypto/USDT', ALL_ON, 'binance', false, '币安充值排除'],
  ['www.binance.com', '/zh-CN/earn/simple-earn', ALL_ON, 'binance', false, '币安理财排除'],
  ['www.binance.com', '/en/p2p/buy/usdt', ALL_ON, 'binance', false, '币安 P2P 排除'],
  ['www.binance.com', '/en/futures/square-x', ALL_ON, 'binance', false, '金融词优先于 square'],
  ['www.binance.com', '/zh-CN', ALL_ON, 'binance', false, '币安首页排除'],
  ['accounts.binance.com', '/en/login', ALL_ON, 'binance', false, '币安登录子域排除'],
  ['www.binance.com', '/zh-CN/square', { x: true, binance: false, okx: true }, 'binance', false, '币安开关关闭'],

  // OKX / Ouyi
  ['www.okx.com', '/zh-hans/orbit', ALL_ON, 'okx', true, 'OKX Orbit 主页'],
  ['www.okx.com', '/zh-hans/orbit/post/123456', ALL_ON, 'okx', true, 'OKX Orbit 帖子'],
  ['www.okx.com', '/ul/orbit', ALL_ON, 'okx', true, 'OKX 短链 Orbit'],
  ['www.okx.com', '/zh-hans/square', ALL_ON, 'okx', true, 'OKX 广场兼容'],
  ['www.okx.cab', '/zh-hans/orbit', ALL_ON, 'okx', true, 'OKX .cab 镜像'],
  ['www.okx.me', '/orbit', ALL_ON, 'okx', true, 'OKX .me 镜像'],
  ['www.ouyi.com', '/zh-hans/orbit', ALL_ON, 'okx', true, 'Ouyi 镜像'],
  ['www.okx.com', '/zh-hans/trade-spot/btc-usdt', ALL_ON, 'okx', false, 'OKX 现货交易排除'],
  ['www.okx.cab', '/zh-hans/trade-spot/btc-usdt', ALL_ON, 'okx', false, 'OKX 镜像交易排除'],
  ['www.okx.com', '/zh-hans/balance/overview', ALL_ON, 'okx', false, 'OKX 资产概览排除'],
  ['www.okx.com', '/zh-hans/web3', ALL_ON, 'okx', false, 'OKX Web3 排除'],
  ['www.okx.com', '/zh-hans/options', ALL_ON, 'okx', false, 'OKX 期权排除'],
  ['www.okx.com', '/zh-hans/help/some-doc', ALL_ON, 'okx', false, 'OKX 帮助中心排除'],
  ['www.okx.com', '/zh-hans/orbit', { x: true, binance: true, okx: false }, 'okx', false, 'OKX 开关关闭'],
];

assert.ok(GOLDEN.length >= 40, `黄金表用例数应 >= 40，当前 ${GOLDEN.length}`);

for (const [host, path, sites, expKey, expAllowed, desc] of GOLDEN) {
  assert.strictEqual(XPET.siteKeyOf(host), expKey, `siteKeyOf 失败: ${desc} (${host})`);
  assert.strictEqual(XPET.siteAllowed(host, path, sites), expAllowed, `siteAllowed 失败: ${desc} (${host}${path})`);
}

console.log(`✅ test_sites_golden.js: ${GOLDEN.length} 组黄金表用例全部通过！`);

// Phase 2.4: normalizeDay 回归测试（未知站点 key 保留 + 旧数据兼容）
const withTemp = {
  post: 3,
  seconds: 120,
  bySite: {
    x: { seconds: 60, post: 1 },
    testsite: { seconds: 60, post: 2, like: 5 },
  },
};
const once = XPET.normalizeDay(withTemp);
const twice = XPET.normalizeDay(once);
assert.strictEqual(twice.bySite.testsite.seconds, 60, '未知站点 key seconds 不应丢失');
assert.strictEqual(twice.bySite.testsite.post, 2, '未知站点 key post 不应丢失');
assert.strictEqual(twice.bySite.testsite.like, 5, '未知站点 key like 不应丢失');
assert.strictEqual(twice.bySite.binance.seconds, 0, '缺失的注册站点应补空');
assert.strictEqual(twice.bySite.okx.seconds, 0, '缺失的注册站点应补空');
assert.strictEqual(twice.bySite.x.post, 1, '已有注册站点数据应保留');
console.log('✅ test_sites_golden.js: normalizeDay 未知 key 保留与旧数据兼容测试通过！');
