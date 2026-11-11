/**
 * lint_tone.js
 * 1. 扫描所有默认台词（DEFAULT_PHRASES、VOICE_PLAYFUL、defaultSlots、defaultHolidays，以及 stories.js 的 murmur；不含日记正文 text）
 *    检查是否包含第二人称或说教词汇。规则见 shared.js 的 XPET.TONE_BANNED_RE（唯一来源，这里不再重复抄写，避免过期）。
 * 2. 自测断言：验证 HANDOFF.md 中的正例全部放行、反例全部被拦截，并验证 AI 导入全被过滤时返回错误。
 * 用法：node tools/lint_tone.js
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const sharedPath = path.join(__dirname, '..', 'shared.js');
const code = fs.readFileSync(sharedPath, 'utf8');

const sandbox = { chrome: { storage: { local: {} } }, Intl };
vm.createContext(sandbox);
vm.runInContext(code + '\nthis.XPET = XPET;', sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'stories.js'), 'utf8'), sandbox);
const XPET = sandbox.XPET;
const contentSrc = fs.readFileSync(path.join(__dirname, '..', 'content.js'), 'utf8');

const hits = [];

function scanPlaceholders(groupName, key, lines, ctx) {
  for (const line of lines || []) {
    const res = XPET.checkPlaceholders(line, ctx);
    if (!res.ok) {
      hits.push({ group: groupName, key, word: '占位符 ' + res.word, line });
    }
  }
}

function scanLines(groupName, key, lines) {
  for (const line of lines || []) {
    const res = XPET.checkLineTone(line);
    if (!res.ok) {
      hits.push({ group: groupName, key, word: res.word, line });
    }
  }
}

// 1. DEFAULT_PHRASES
for (const [k, lines] of Object.entries(XPET.DEFAULT_PHRASES)) {
  scanLines('DEFAULT_PHRASES', k, lines);
  scanPlaceholders('DEFAULT_PHRASES', k, lines, k);
}

// 2. VOICE_PLAYFUL
for (const [k, lines] of Object.entries(XPET.VOICE_PLAYFUL)) {
  scanLines('VOICE_PLAYFUL', k, lines);
  scanPlaceholders('VOICE_PLAYFUL', k, lines, k);
}

// 3. defaultSlots
for (const s of XPET.defaultSlots()) {
  scanLines('defaultSlots', s.id, s.lines);
  scanPlaceholders('defaultSlots', s.id, s.lines, 'slot');
}

// 4. defaultHolidays
for (const h of XPET.defaultHolidays()) {
  scanLines('defaultHolidays', h.id, h.lines);
  scanPlaceholders('defaultHolidays', h.id, h.lines, 'slot');
}

// 5. stories.js 的 murmur（点击宠物时会真的说出来，和普通台词一样要过语气规范；日记正文 text 只在设置页里看，不扫描）
for (const s of XPET.STORIES || []) {
  scanLines('STORIES.murmur', s.id, [s.murmur]);
  scanPlaceholders('STORIES.murmur', s.id, [s.murmur], 'diary'); // 日记只替换 {days}
  scanPlaceholders('STORIES.text', s.id, [s.text], 'diary');
}

// 5b. 台词里允许的每个占位符，都必须真的在 content.js 的 lineFor() 里有对应的替换（否则会原样显示出来）
for (const p of XPET.PLACEHOLDERS) {
  assert.ok(contentSrc.includes('\\{' + p + '\\}'), `content.js 里没有找到 {${p}} 的替换逻辑，但 XPET.PLACEHOLDERS 声明了它`);
}

// 6. AI.PERSONAS (persona & custom prompts)
for (const p of XPET.AI.PERSONAS) {
  if (p.callUser !== undefined) {
    hits.push({ group: 'AI.PERSONAS', key: p.id, word: 'callUser字段残留', line: String(p.callUser) });
  }
}

// 7. 自测断言（HANDOFF.md 中的正反例验证 + AI 导入全过滤报错验证）
const POSITIVES = [
  '发出去了…有点紧张',
  '这条懂我',
  '好晚啊…',
  '我考虑考虑要不要睡觉',
  '再看一条就睡（大概）',
  '有点困，但是不想睡',
  '今晚的月亮应该很圆', // 「应该」是犹豫词，不能被「该」误伤
  '先放着吧', // 自言自语的句尾「吧」不是祈使
  '也许吧…我再想想',
];
for (const pos of POSITIVES) {
  const r = XPET.checkLineTone(pos);
  assert.strictEqual(r.ok, true, `正例应通过但却被拦截: "${pos}" (命中: ${r.word})`);
}

const NEGATIVES = [
  '你今天发了第 3 条推！',
  '夜深了，你该早点休息了',
  '别刷太久哦',
  '快去睡觉吧，明天还要早起',
  '今天也别太晚',
  '今天可以早点收工',
  '该睡了吧', // 「该…吧」祈使
  '赶紧关掉吧',
];
for (const neg of NEGATIVES) {
  const r = XPET.checkLineTone(neg);
  assert.strictEqual(r.ok, false, `反例应被拦截但却放行了: "${neg}"`);
}

// 验证 AI 导入全部违规时返回 ok: false
const badAiJson = JSON.stringify({
  name: '测试',
  look: 'teddy',
  phrases: {
    click: ['你今天刷太久了', '别看了，快去休息吧'],
    post: ['你发得真好，注意休息'],
  },
});
const parseRes = XPET.AI.parseOutput(badAiJson);
assert.strictEqual(parseRes.ok, false, '当 AI 台词全部违规被过滤时，parseOutput 应返回 ok: false');

// 占位符自测
assert.strictEqual(XPET.checkPlaceholders('不知不觉，一起 {days} 天了', 'milestone').ok, true);
assert.strictEqual(XPET.checkPlaceholders('日记多了一页「{title}」', 'story').ok, true);
assert.strictEqual(XPET.checkPlaceholders('桌上多了一件 {name}', 'unlock').ok, true);
assert.strictEqual(XPET.checkPlaceholders('今天第 {n} 条', 'post').ok, true);
assert.strictEqual(XPET.checkPlaceholders('今天第 {n} 条', 'night').ok, false, '{n} 用在不计数的动作里会显示成 0');
assert.strictEqual(XPET.checkPlaceholders('{name} 来啦', 'click').ok, false, '{name} 只能用在 unlock');
assert.strictEqual(XPET.checkPlaceholders('{title}', 'milestone').ok, false, '{title} 只能用在 story');
assert.strictEqual(XPET.checkPlaceholders('今天心情 {mood}', 'click').ok, false, '自创占位符会被原样显示');
assert.strictEqual(XPET.checkPlaceholders('一起 {days} 天', 'slot').ok, false, '时段问候/节日不支持占位符');
assert.strictEqual(XPET.checkPlaceholders('{title}', 'diary').ok, false, '日记只替换 {days}');
assert.strictEqual(XPET.checkPlaceholders('没有占位符的台词', 'click').ok, true);

// 验证 AI 导入：超长句整句丢弃、不截断；占位符完整保留；「应该」不被误伤；自创占位符、时段问候里的占位符被过滤
const longLine = '我'.repeat(XPET.MAX_LINE_LEN + 1);
const goodAiJson = JSON.stringify({
  name: '测试',
  look: 'teddy',
  phrases: {
    click: ['我也在发呆', longLine, '今天心情 {mood}', '{name} 来啦'],
    milestone: ['不知不觉，一起 {days} 天了', '今晚的月亮应该不错'],
  },
  slots: [
    { id: 'morning', name: '早上', lines: ['早…还没完全醒', '一起 {days} 天了，早'] },
  ],
});
const goodRes = XPET.AI.parseOutput(goodAiJson);
assert.strictEqual(goodRes.ok, true, '正常的 AI 导入应该成功');
assert.strictEqual(JSON.stringify(goodRes.data.phrases.click), JSON.stringify(['我也在发呆']), '超长句应整句丢弃，不应被截断保留'); // 用 JSON 比较：vm 沙箱里创建的数组原型不同，deepStrictEqual 会误报
assert.ok(goodRes.data.phrases.milestone.includes('不知不觉，一起 {days} 天了'), '占位符 {days} 应完整保留');
assert.ok(goodRes.data.phrases.milestone.includes('今晚的月亮应该不错'), '「应该」不应被误拦');
assert.strictEqual(JSON.stringify(goodRes.data.slots.find((s) => s.id === 'morning').lines), JSON.stringify(['早…还没完全醒']), '时段问候里带占位符的句子应被过滤');
assert.strictEqual(goodRes.stats.filteredCount, 4, '应过滤 4 句：超长 1、自创占位符 1、错误动作里的 {name} 1、时段里的 {days} 1');

console.log(`=== Tone Lint Report ===`);
console.log(`Allowlist (${XPET.TONE_ALLOWLIST.length}):`, XPET.TONE_ALLOWLIST);
if (hits.length === 0) {
  console.log(`✅ 0 hits outside allowlist! All default lines & ${POSITIVES.length} positive + ${NEGATIVES.length} negative self-tests passed.`);
  process.exit(0);
} else {
  console.error(`❌ Found ${hits.length} tone violation(s):`);
  for (const h of hits) {
    console.error(`  - [${h.group}.${h.key}] hit "${h.word}": ${h.line}`);
  }
  process.exit(1);
}
