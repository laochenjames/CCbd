/**
 * Phase 4 (L2): 国内站点规则引擎、脱敏夹具与静态类名检查
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

const weiboFixtures = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'weibo-chains.json'), 'utf8'));
const zhihuFixtures = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'zhihu-chains.json'), 'utf8'));

// 1. 夹具回归测试（weibo）
const weiboLabels = new Set(weiboFixtures.map((f) => f.label));
for (const fx of weiboFixtures) {
  const hit = XPET.matchDomesticRule('weibo', fx.chain);
  const actual = hit ? hit.rule.act : null;
  assert.strictEqual(actual, fx.expect, `weibo 夹具 "${fx.label}" 期望 ${fx.expect}，实际 ${actual}`);
}

// 2. 知乎夹具回归测试
const zhihuLabels = new Set(zhihuFixtures.map((f) => f.label));
for (const fx of zhihuFixtures) {
  const hit = XPET.matchDomesticRule('zhihu', fx.chain);
  const actual = hit ? hit.rule.act : null;
  assert.strictEqual(actual, fx.expect, `zhihu 夹具 "${fx.label}" 期望 ${fx.expect}，实际 ${actual}`);
}

// 3. 静态检查：拒绝哈希/混淆类名（18-22位字母数字下划线无连字符、css-开头、_name_hash_num）
const HASH_CLS_RE = /(?:^|\.)(?:css-[a-zA-Z0-9]+|_[a-zA-Z0-9]+_[a-zA-Z0-9]+_\d+|[A-Za-z0-9_]{18,22})(?=$|[.\[:\s])/;
for (const [siteKey, rules] of Object.entries(XPET.DOMESTIC_RULES)) {
  for (const r of rules) {
    assert.ok(Array.isArray(r.evidence) && r.evidence.length > 0, `${siteKey} 规则 ${r.act} 缺少 evidence`);
    for (const sel of [r.sel, r.mustBeInside, r.mustNotBeInside].filter(Boolean)) {
      const m = sel.match(HASH_CLS_RE);
      assert.strictEqual(m, null, `${siteKey} 规则 ${r.act} 选择器含疑似哈希类名: ${sel}`);
    }
    const labelsSet = siteKey === 'weibo' ? weiboLabels : zhihuLabels;
    for (const ev of r.evidence) {
      assert.ok(labelsSet.has(ev), `${siteKey} 规则 ${r.act} 的 evidence "${ev}" 在夹具中未找到`);
    }
  }
}

console.log(`✅ test_domestic_rules.js: ${weiboFixtures.length} 条微博夹具 + ${zhihuFixtures.length} 条知乎夹具 + 静态类名检查全部通过！`);

