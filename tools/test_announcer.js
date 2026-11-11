/**
 * test_announcer.js
 * 用假时钟测试 XPET.createAnnouncer（一次性通知队列，shared.js）：
 *  1. 依次展示、气泡还在显示时等它结束
 *  2. 展示成功后才 ack；被挡住（show 返回 false）时放回队首重试，最多 5 次，超过就放弃且不 ack
 *  3. canSpeak() 为 false（今天安静 / 在打字 / 标签页不在前台）时一直等，不 ack；恢复后补发
 *  4. 带 expiresAt 的时效性通知过期就丢弃（不 ack），没有 expiresAt 的一直等
 *  5. 同 key 去重、ack 抛错不影响后面的通知
 * 用法：node tools/test_announcer.js
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const code = fs.readFileSync(path.join(__dirname, '..', 'shared.js'), 'utf8');
const sandbox = { chrome: { storage: { local: {} } }, Intl };
vm.createContext(sandbox);
vm.runInContext(code + '\nthis.XPET = XPET;', sandbox);
const XPET = sandbox.XPET;

// 假时钟：advance(ms) 按时间顺序触发到期的定时器（回调里新建的定时器也会在窗口内被触发）
function makeEnv() {
  let t = 1000000;
  const timers = [];
  const env = {
    speakable: true, // canSpeak() 的返回值
    bubbleEnd: 0,    // 当前气泡显示到什么时候
    results: [],     // 依次决定每次 show 的返回值；用完后默认 true
    shown: [],       // 每次 show 被调用时的 key
    acked: [],       // 每次 ack 的 key
    now: () => t,
    setTimer(fn, ms) { timers.push({ at: t + ms, fn }); return timers.length; },
    advance(ms) {
      const end = t + ms;
      for (;;) {
        timers.sort((a, b) => a.at - b.at);
        const next = timers[0];
        if (!next || next.at > end) break;
        timers.shift();
        t = Math.max(t, next.at);
        next.fn();
      }
      t = end;
    },
  };
  env.announcer = XPET.createAnnouncer({
    now: env.now,
    setTimer: env.setTimer,
    canSpeak: () => env.speakable,
    bubbleUntil: () => env.bubbleEnd,
    show: (item) => {
      env.shown.push(item.key || item.type);
      return env.results.length ? env.results.shift() : true;
    },
  });
  env.mk = (key, extra) => ({ key, type: 'x', ack: () => env.acked.push(key), ...extra });
  return env;
}
const eq = (a, b, msg) => assert.strictEqual(JSON.stringify(a), JSON.stringify(b), msg);

// 1. 基本：入队后等 400ms 才展示，展示成功后 ack 一次
{
  const e = makeEnv();
  e.announcer.enqueue(e.mk('a'));
  e.advance(399);
  eq(e.shown, [], '400ms 之前不应展示');
  e.advance(1);
  eq(e.shown, ['a']);
  eq(e.acked, ['a'], '展示成功后应 ack');
  assert.strictEqual(e.announcer.size(), 0);
}

// 2. 气泡还在显示：等它结束再加 400ms
{
  const e = makeEnv();
  e.bubbleEnd = e.now() + 3000;
  e.announcer.enqueue(e.mk('a'));
  e.advance(3399);
  eq(e.shown, [], '气泡显示期间不应展示');
  e.advance(1);
  eq(e.shown, ['a']);
}

// 3. 先进先出、依次展示
{
  const e = makeEnv();
  ['a', 'b', 'c'].forEach((k) => e.announcer.enqueue(e.mk(k)));
  e.advance(5000);
  eq(e.shown, ['a', 'b', 'c']);
  eq(e.acked, ['a', 'b', 'c']);
}

// 4. 同 key 去重；展示完成后同 key 可以再次入队
{
  const e = makeEnv();
  assert.strictEqual(e.announcer.enqueue(e.mk('k')), true);
  assert.strictEqual(e.announcer.enqueue(e.mk('k')), false, '队列里已有同 key 通知时不应重复入队');
  assert.strictEqual(e.announcer.size(), 1);
  e.advance(1000);
  assert.strictEqual(e.announcer.enqueue(e.mk('k')), true, '已展示完的 key 可以再入队');
}

// 5. 被更高优先级的气泡挡住（show 返回 false）：放回队首重试，成功后才 ack，且重试的是原来的队首
{
  const e = makeEnv();
  e.results = [false, false, true];
  e.announcer.enqueue(e.mk('a'));
  e.announcer.enqueue(e.mk('b'));
  e.advance(10000);
  eq(e.shown, ['a', 'a', 'a', 'b'], '队首被挡住时应先重试它，再轮到后面的');
  eq(e.acked, ['a', 'b']);
}

// 6. 重试上限：一共尝试 6 次（首次 + 5 次重试），之后放弃，不 ack
{
  const e = makeEnv();
  e.results = new Array(20).fill(false);
  e.announcer.enqueue(e.mk('a'));
  e.advance(60000);
  assert.strictEqual(e.shown.length, 6, '应尝试 6 次后放弃');
  eq(e.acked, [], '放弃的通知不应 ack（存储标记不被消耗，下次仍会触发）');
  assert.strictEqual(e.announcer.size(), 0);
}

// 7. 今天安静 / 在打字 / 标签页不在前台（canSpeak 为 false）：一直等，不展示、不 ack、不丢；恢复后补发
{
  const e = makeEnv();
  e.speakable = false;
  e.announcer.enqueue(e.mk('milestone'));
  e.advance(10 * 60 * 1000);
  eq(e.shown, [], 'canSpeak 为 false 时不应展示');
  eq(e.acked, []);
  assert.strictEqual(e.announcer.size(), 1, '没有过期时间的通知应一直等');
  e.speakable = true;
  e.advance(1500);
  eq(e.shown, ['milestone'], '恢复后应补发');
  eq(e.acked, ['milestone']);
}

// 8. 过期：带 expiresAt 的问候/回来过期就丢弃（不 ack）；没有 expiresAt 的里程碑留着
{
  const e = makeEnv();
  e.speakable = false;
  e.announcer.enqueue(e.mk('greet', { expiresAt: e.now() + 5 * 60 * 1000 }));
  e.announcer.enqueue(e.mk('milestone'));
  e.advance(6 * 60 * 1000);
  assert.strictEqual(e.announcer.size(), 1, '过期的问候应被丢弃，里程碑保留');
  e.speakable = true;
  e.advance(1500);
  eq(e.shown, ['milestone'], '过期的问候不应在晚些时候冒出来');
  eq(e.acked, ['milestone']);
}

// 9. ack 抛错不影响后面的通知
{
  const e = makeEnv();
  e.announcer.enqueue(e.mk('a', { ack: () => { throw new Error('boom'); } }));
  e.announcer.enqueue(e.mk('b'));
  e.advance(5000);
  eq(e.shown, ['a', 'b']);
  eq(e.acked, ['b']);
}

// 10. 字符串入队 = { type }
{
  const e = makeEnv();
  e.announcer.enqueue('back');
  e.advance(1000);
  eq(e.shown, ['back']);
}

console.log('✅ announcer queue: all 10 scenarios passed (fake clock)');
