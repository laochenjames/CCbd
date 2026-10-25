// 内容脚本和设置页共用的默认值与读写函数
const XPET = {
  KEYS: { chars: 'xpetChars', active: 'xpetActive' },
  HIST_KEY: 'xpetHistory', // 按天保存的历史数据：{ 'YYYY-MM-DD': {post, like, ..., seconds, scroll} }
  KEEP_DAYS: 90,
  SETTINGS_KEY: 'xpetSettings',
  SEED_KEY: 'xpetSeeded',        // 已经"播种"过的内置角色，避免用户删掉后又自动回来
  XP_KEY: 'xpetXp',               // 经验：按天结算的记录 { settled: {日期: {min, xp}}, announced: [已通知解锁的装扮], total }
  // 精灵图（角色按状态的动画）：图片单独存成一个键，避免每次打开页面都把所有图片读出来
  SPRITE_PREFIX: 'xpetSprite:',
  SPRITE_STATES: [
    ['idle', '待机（基础图；其他状态没上传时都用它）'],
    ['busy', '你在用页面'],
    ['sleepy', '你停下来了（打盹）'],
    ['yawn', '深夜（哈欠）'],
    ['poke', '被点击'],
  ],
  SPRITE_MAX_FRAME_H: 320, // 帧高上限（像素）：控制内存，解码后一张图 ≈ 宽×高×4 字节
  SPRITE_MAX_SHEET_W: 4096, // 整张图宽度上限，避开显卡纹理上限
  SPRITE_MAX_FRAMES: 24,
  // 内置泰迪与哈基米的动画：按各动作生理节奏科学定制帧率（idle:9fps/2s微呼吸, busy:12fps/1.5s专注, sleepy:8fps/3s深睡, yawn:7fps/2.57s深哈欠, poke:13fps/1.38s弹性起落）
  SPRITE_FPS: { idle: 9, busy: 12, sleepy: 8, yawn: 7, poke: 13 },
  BUILTIN_SPRITES: {
    teddy: Object.fromEntries(['idle', 'busy', 'sleepy', 'yawn', 'poke'].map((st) => [st, { frames: st === 'sleepy' ? 24 : 18, fps: { idle: 9, busy: 12, sleepy: 8, yawn: 7, poke: 13 }[st] || 10, fw: 201, fh: 188, url: 'sprites/teddy/' + st + '.webp' }])),
    cat: Object.fromEntries(['idle', 'busy', 'sleepy', 'yawn', 'poke'].map((st) => [st, { frames: st === 'sleepy' ? 24 : 18, fps: { idle: 9, busy: 12, sleepy: 8, yawn: 7, poke: 13 }[st] || 10, fw: 245, fh: 220, url: 'sprites/cat/' + st + '.webp' }])),
  },
  builtinSprite(c, st) {
    const b = XPET.BUILTIN_SPRITES[c.id];
    return b && !c.img && c.look === c.id && b[st] ? b[st] : null;
  },
  // 某个角色某个状态实际要播放的动画：用户自己的优先，其次内置；返回 { meta, url|null } 或 null
  spriteFor(c, st) {
    const own = c.sprites && c.sprites[st];
    if (own) return { meta: own, url: null };
    const b = XPET.builtinSprite(c, st);
    return b ? { meta: b, url: b.url } : null;
  },
  SIZES: [[1, '标准'], [1.6, '大'], [2.2, '特大']], // 宠物显示大小倍率（标准 72×64 像素）
  spriteKey(id, state) { return XPET.SPRITE_PREFIX + id + ':' + state; },
  SEEN_KEY: 'xpetSeen',           // 最近一次在线的时间戳（「回来了」问候用）
  MILESTONE_DAYS: [7, 30, 100, 200, 365], // 累计陪伴天数里程碑（累计，不是连续）
  GREET_KEY: 'xpetGreet',         // 时段问候：今天已经问候过的时段 { date, done: [slot id] }
  STATUS_KEY: 'xpetStatus', // 内容脚本的运行状态，供设置页诊断用

  // [动作 key, 显示名]
  ACTIONS: [
    ['click', '点击宠物（平时；深夜/接近上限/到上限时改说对应的话）'],
    ['post', '发推 / 回复'],
    ['like', '点赞'],
    ['bookmark', '收藏'],
    ['repost', '转发'],
    ['follow', '关注'],
    ['clickEarly', '点击宠物（今天刚开始，在线不到 3 分钟）'],
    ['tired', '连续使用提醒（今日在线每满 30 分钟）'],
    ['night', '深夜提醒（1–5 点仍在使用）'],
    ['nearCap', '接近每日上限（到上限的 80% 时；可用 {left} 表示还剩几分钟）'],
    ['atCap', '到达每日上限时'],
    ['settled', '昨日到账（每天第一次出现时；可用 {when} {gain} {total} {nextHint}）'],
    ['settledZero', '昨日没有经验时（可用 {when}）'],
    ['milestone', '陪伴天数里程碑（累计 7/30/100/200/365 天；可用 {days}）'],
    ['back', '离开一阵又回来了（可用 {min} 表示今天在线分钟）'],
    ['story', '写了新的一页小本子（可用 {title}）'],
    ['unlock', '解锁新装扮时（可用 {name} 表示装扮名）'],
    ['summaryOk', '今日小结卡片结尾：时长在范围内（可用 {xp} 表示今天预计经验）'],
    ['summaryOver', '今日小结卡片结尾：时长超出上限'],
  ],

  // 语气：慵懒、不催、不评判；被点时才多说一句，偶尔报一下进度（进度就是你自己设的区间）
  DEFAULT_PHRASES: {
    click: ['嗯？', '在呢，不急', '我也在这儿发呆～', '今天已经 {min} 分钟了', '慢慢来', '咕噜…'],
    post: ['嗯，发出去啦', '今天第 {n} 条了', '写完啦，不错'],
    like: ['嗯嗯', '看到好东西啦', '慢慢看～'],
    bookmark: ['收着，不急着看', '先放这儿'],
    repost: ['转出去咯', '嗯，传一下～'],
    follow: ['新朋友呀', '嗯，关注了'],
    clickEarly: ['嗯，今天刚开始呢', '才刚来，不急', '早～慢慢来'],
    tired: ['今天已经 {min} 分钟了…伸个懒腰？', '喝口水吧，我也歇会儿', '眼睛歇一歇，不急'],
    night: ['这么晚啦…明天再刷也行', '有点困了，你呢？'],
    nearCap: ['差不多快到你设的时间了，还有 {left} 分钟', '再逛一会儿就差不多啦，我也准备收收了'],
    atCap: ['到点啦，今天的 +{xp} 经验满额了，这时候收工最划算', '你设的时间到了，今天满额 +{xp}，该歇歇了'],
    settled: ['{when} +{gain} 经验，累计 {total}。{nextHint}', '{when}到账 {gain} 经验啦，累计 {total}～{nextHint}'],
    settledZero: ['{when}没攒到经验，没关系，今天慢慢来', '{when}的经验是 0，不要紧，今天重新开始'],
    milestone: ['陪你第 {days} 天啦', '一起 {days} 天了，谢谢你每天来'],
    back: ['回来啦～', '你回来啦，我一直在这儿', '欢迎回来，不急'],
    story: ['又写了一页小本子：「{title}」，在设置里能看', '小本子多了一页「{title}」'],
    unlock: ['攒够啦，多了一件 {name}', '新装扮 {name}，不用特地来领'],
    summaryOk: ['今天刚刚好', '慢慢来，已经不错了', '嗯，挺好的'],
    summaryOver: ['今天有点久了，明天慢慢来', '没事，明天再说'],
  },
  // 旧版默认台词：角色里的某个动作如果还和它完全一致（说明用户没改过），升级时自动换成新版
  LEGACY_PHRASES: {
    click: ['嗨～', '我在这儿陪你', '今天想发点什么？', '别刷太久哦', '戳我干嘛 (・ω・)', '咕噜咕噜'],
    post: ['今天第 {n} 条！', '发出去啦', '继续写～'],
    like: ['❤', '又一个赞', '看到好东西了？'],
    bookmark: ['收好啦', '记得回来看哦'],
    repost: ['转出去啦', '传播传播～'],
    follow: ['新朋友！', '关注成功'],
    tired: ['今天已经 {min} 分钟了，休息一下？', '站起来动一动吧', '眼睛累了吗？'],
    night: ['夜深了，早点休息', '这么晚了，明天再刷吧'],
    unlock: ['攒够经验了，新装扮：{name}', '多了一件 {name}，不用特地来领'],
    summaryOk: ['今天也辛苦啦', '时间用得刚刚好', '慢慢来，已经不错了'],
    summaryOver: ['今天时间有点长，明天慢慢来', '没关系，明天重新开始'],
  },
  // 0.9.3 引入的「到上限」台词，升级时若没改过则换成带经验的新版
  LEGACY_PHRASES_V2: { atCap: ['到点啦，今天就到这儿吧？', '你设的时间到了，该歇歇了'] },
  LEGACY_SLOT_LINES: {
    dawn: ['这么早（晚）还没睡？', '凌晨了，注意休息'],
    morning: ['早上好～', '新的一天，慢慢来'],
    noon: ['中午好，记得吃饭', '午饭吃了吗？'],
    evening: ['晚上好', '今天辛苦啦'],
  },

  // 宠物"在旁边做自己的事"：你在用页面时它拿着道具，你停下来它打盹，深夜它打哈欠
  ACTIVITIES: [['book', '📖 看书'], ['phone', '📱 玩手机'], ['laptop', '💻 用电脑'], ['none', '不拿东西']],
  PROP_EMOJI: { book: '📖', phone: '📱', laptop: '💻' },

  // 时长与滚动距离的显示（1 CSS 像素按 96dpi 折算，约 0.2646 毫米，是估算值）
  fmtDur(mins) {
    mins = Math.max(0, Math.floor(mins));
    return mins >= 60 ? `${Math.floor(mins / 60)}时${mins % 60}分` : `${mins}分`;
  },
  fmtScroll(px) {
    return (px * 0.000264583).toFixed(1) + '米';
  },

  defaultPhrases() {
    return JSON.parse(JSON.stringify(XPET.DEFAULT_PHRASES));
  },

  // 内置形象：look 为 'teddy'（泰迪犬）或 'slime'（小史莱姆）；没有上传自定义图片时使用
  builtinChar(look) {
    const names = { teddy: '泰迪', slime: '小史莱姆', cat: '哈基米' };
    return { id: look, name: names[look], img: null, look, accessory: "none", size: 1, sprites: {}, phrases: XPET.defaultPhrases() };
  },

  // 全新安装：泰迪犬排第一，是默认角色；小史莱姆保留，二选一
  defaultChars() {
    return [XPET.builtinChar('teddy'), XPET.builtinChar('slime'), XPET.builtinChar('cat')];
  },

  // ---------- 显示与提醒设置 ----------
  // 时段问候的默认时段（小时，起止相同 = 关闭，支持跨午夜）；用户可自行增删修改
  defaultSlots() {
    return [
      { id: 'dawn', name: '凌晨', start: 0, end: 5, lines: ['这么晚了呀…', '凌晨啦，我有点困'] },
      { id: 'morning', name: '早上', start: 5, end: 11, lines: ['哈～早上了', '早呀，不急，慢慢来'] },
      { id: 'noon', name: '中午', start: 11, end: 14, lines: ['中午了，吃点东西吧', '午饭吃了吗？我有点饿'] },
      { id: 'evening', name: '晚上', start: 18, end: 24, lines: ['晚上好呀', '今天也过得差不多了'] },
    ];
  },
  // 节日与纪念日。type: 'solar' 阳历 | 'lunar' 农历 | 'lunarEve' 除夕（春节前一天）
  defaultHolidays() {
    const h = (id, name, type, month, day, lines) => ({ id, name, type, month, day, lines });
    return [
      h('newyear', '元旦', 'solar', 1, 1, ['新年好，新的一年慢慢来', '元旦快乐，今年也请多多关照']),
      h('eve', '除夕', 'lunarEve', 12, 30, ['除夕啦，今天不用着急，好好过', '除夕快乐，今天可以早点收工']),
      h('spring', '春节', 'lunar', 1, 1, ['新年快乐～今天想怎么逛都行', '春节快乐，红包我就不要啦，陪着你就好']),
      h('lantern', '元宵', 'lunar', 1, 15, ['元宵快乐，汤圆吃了吗', '今晚月亮应该很圆']),
      h('dragon', '端午', 'lunar', 5, 5, ['端午安康，粽子吃了吗', '端午快乐，慢慢来']),
      h('qixi', '七夕', 'lunar', 7, 7, ['七夕快乐，今天也别太晚', '今天适合陪陪重要的人']),
      h('midautumn', '中秋', 'lunar', 8, 15, ['中秋快乐，抬头看看月亮吧', '今晚月亮很好，别光盯着屏幕']),
      h('national', '国庆', 'solar', 10, 1, ['国庆快乐，今天好好休息', '假期愉快，不用逛太久']),
      h('xmas', '圣诞', 'solar', 12, 25, ['圣诞快乐～', '平安夜过去啦，圣诞快乐']),
    ];
  },
  // 某一天的农历月日：返回 { month, day, leap } 或 null（浏览器不支持农历时返回 null，农历节日就不会触发）
  lunarOf(date) {
    try {
      const parts = new Intl.DateTimeFormat('zh-u-ca-chinese-nu-latn', { month: 'numeric', day: 'numeric' }).formatToParts(date);
      const m = parts.find((p) => p.type === 'month'), d = parts.find((p) => p.type === 'day');
      if (!m || !d) return null;
      const names = { 正: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10, 冬: 11, 腊: 12 };
      const raw = String(m.value);
      const leap = /闰|bis/i.test(raw);
      let month = parseInt(raw.replace(/\D/g, ''), 10);
      if (!month) { const k = Object.keys(names).find((n) => raw.includes(n)); month = k ? names[k] : 0; }
      const day = parseInt(String(d.value).replace(/\D/g, ''), 10);
      return month && day ? { month, day, leap } : null;
    } catch (e) { return null; }
  },
  // 今天命中的第一个有台词的节日，没有则返回 null
  holidayFor(date, items) {
    const tomorrow = new Date(date.getTime() + 86400000);
    for (const it of items || []) {
      if (!it.lines || !it.lines.length) continue;
      if (it.type === 'solar') { if (date.getMonth() + 1 === it.month && date.getDate() === it.day) return it; continue; }
      if (it.type === 'lunar') { const l = XPET.lunarOf(date); if (l && !l.leap && l.month === it.month && l.day === it.day) return it; continue; }
      if (it.type === 'lunarEve') { const l = XPET.lunarOf(tomorrow); if (l && !l.leap && l.month === 1 && l.day === 1) return it; }
    }
    return null;
  },
  defaultSettings() {
    return {
      chipMode: 'click', // 统计条：'click' 点击宠物时显示 | 'always' 常驻 | 'off' 不显示（右键菜单仍可查看）
      chipItems: { post: true, like: true, bookmark: true, repost: true, follow: true, time: true, scroll: false },
      reminders: { tired: true, tiredMinutes: 30, night: true, nightStart: 1, nightEnd: 5, cap: true },
      greeting: { enabled: true, slots: XPET.defaultSlots() }, // 时段问候：每个时段每天第一次出现时说一句
      goal: { minMinutes: 0, maxMinutes: 90, graceMinutes: 45, baseXp: 10 }, // 每天时间区间；上限 0 = 不设上限
      holidays: { enabled: true, items: XPET.defaultHolidays() }, // 节日/纪念日：当天第一次在线时说一句
      back: { enabled: true, minutes: 90 }, // 同一天内离开超过这么久再回来，说一句「回来啦」
      milestone: true, // 累计陪伴天数里程碑
      sites: {
        x: true,        // X (Twitter)
        binance: true,  // 币安广场 (Binance Square)
        okx: true,      // OK星球 / 广场 (OKX Planet & Square)
      },
      appearance: {
        opacity: 100, // 宠物不透明度（30% ~ 100%），鼠标悬停自动恢复 100%
        bubbleTime: 2500, // 台词停留时间（毫秒，1000 ~ 8000）
        sound: true, // 点击轻柔气泡音效 (Web Audio API)
        hotkey: true, // 快捷键 Alt+P 暂时隐藏/显示桌宠
      },
    };
  },
  mergeSettings(raw) {
    const d = XPET.defaultSettings();
    raw = raw && typeof raw === 'object' ? raw : {};
    const bool = (v, def) => (v === undefined ? def : !!v);
    const int = (v, min, max, def) => {
      v = Math.floor(Number(v));
      return Number.isFinite(v) && v >= min && v <= max ? v : def;
    };
    const rem = raw.reminders || {}, gl = raw.goal || {}, ap = raw.appearance || {}, st = raw.sites || {};
    const gr = raw.greeting && typeof raw.greeting === 'object' ? raw.greeting : {};
    let slots = Array.isArray(gr.slots) ? gr.slots : d.greeting.slots;
    slots = slots.slice(0, 8).map((x, i) => ({
      id: String((x && x.id) || 's' + i + '-' + Math.random().toString(36).slice(2, 6)),
      name: String((x && x.name) || '时段').slice(0, 12),
      start: int(x && x.start, 0, 23, 0),
      end: int(x && x.end, 0, 24, 0) % 24,
      lines: (Array.isArray(x && x.lines) ? x.lines : []).map((t) => String(t).slice(0, 60)).filter((t) => t.trim()).slice(0, 20),
    }));
    slots.forEach((x) => { // 还是旧版默认台词（没被用户改过）就换成新版
      const leg = XPET.LEGACY_SLOT_LINES[x.id];
      if (leg && JSON.stringify(x.lines) === JSON.stringify(leg)) x.lines = XPET.defaultSlots().find((d) => d.id === x.id).lines;
    });
    const hd = raw.holidays && typeof raw.holidays === 'object' ? raw.holidays : {};
    const hItems = (Array.isArray(hd.items) ? hd.items : d.holidays.items).slice(0, 20).map((x, i) => ({
      id: String((x && x.id) || 'h' + i + '-' + Math.random().toString(36).slice(2, 6)),
      name: String((x && x.name) || '纪念日').slice(0, 12),
      type: ['solar', 'lunar', 'lunarEve'].includes(x && x.type) ? x.type : 'solar',
      month: int(x && x.month, 1, 12, 1),
      day: int(x && x.day, 1, 31, 1),
      lines: (Array.isArray(x && x.lines) ? x.lines : []).map((t) => String(t).slice(0, 60)).filter((t) => t.trim()).slice(0, 10),
    }));
    const bk = raw.back && typeof raw.back === 'object' ? raw.back : {};
    const stv = raw.stories && typeof raw.stories === 'object' ? raw.stories : {};
    return {
      v: 3,
      sites: {
        x: bool(st.x, d.sites.x),
        binance: bool(st.binance, d.sites.binance),
        okx: bool(st.okx, d.sites.okx),
      },
      holidays: { enabled: bool(hd.enabled, d.holidays.enabled), items: hItems },
      back: { enabled: bool(bk.enabled, d.back.enabled), minutes: int(bk.minutes, 10, 720, d.back.minutes) },
      milestone: bool(raw.milestone, d.milestone),
      stories: { enabled: bool(stv.enabled, d.stories.enabled) },
      greeting: { enabled: bool(gr.enabled, d.greeting.enabled), slots },
      chipMode: ['click', 'always', 'off'].includes(raw.chipMode) ? raw.chipMode : (raw.showChip === false ? 'off' : d.chipMode),
      chipItems: { ...d.chipItems, ...(raw.chipItems || {}) },
      reminders: {
        tired: bool(rem.tired, d.reminders.tired),
        tiredMinutes: int(rem.tiredMinutes, 5, 720, d.reminders.tiredMinutes),
        night: bool(rem.night, d.reminders.night),
        nightStart: int(rem.nightStart, 0, 23, d.reminders.nightStart),
        nightEnd: int(rem.nightEnd, 0, 23, d.reminders.nightEnd),
        cap: bool(rem.cap, d.reminders.cap),
      },
      appearance: {
        opacity: int(ap.opacity, 30, 100, d.appearance.opacity),
        bubbleTime: int(ap.bubbleTime, 1000, 8000, d.appearance.bubbleTime),
        sound: bool(ap.sound, d.appearance.sound),
        hotkey: bool(ap.hotkey, d.appearance.hotkey),
      },
      goal: {
        minMinutes: int(gl.minMinutes, 0, 1440, d.goal.minMinutes),
        maxMinutes: int(gl.maxMinutes, 0, 1440, d.goal.maxMinutes),
        graceMinutes: int(gl.graceMinutes, 1, 1440, d.goal.graceMinutes),
        baseXp: int(gl.baseXp, 1, 1000, d.goal.baseXp),
      },
    };
  },
  // 工位装备与桌面伴侣道具：摆在宠物身边，随累计经验自动解锁。无需领取，无连续天数限制。
  ACCESSORIES: [
    { id: 'none', name: '极简工位 (无)', icon: '🪑', need: 0, desc: '纯净桌面' },
    { id: 'coffee', name: '暖心拿铁咖啡', icon: '☕', need: 10, desc: '冒着缕缕热气的陶瓷杯' },
    { id: 'duck', name: '极客调试小黄鸭', icon: '🐥', need: 30, desc: '程序员经典桌面解压小鸭' },
    { id: 'plant', name: '治愈多肉小盆栽', icon: '🪴', need: 70, desc: '静立桌角的小绿植' },
    { id: 'cyber_laptop', name: '赛博霓虹电竞本', icon: '💻', need: 140, desc: '带RGB流光渐变电竞本' },
    { id: 'retro_mac', name: '复古大头电脑', icon: '🖥️', need: 220, desc: '80年代经典米白CRT电脑' },
    { id: 'trophy', name: '专注大师金奖杯', icon: '🏆', need: 300, desc: '散发金芒的荣耀成就' },
  ],

  // 每天结算一次经验（确定性，没有随机）：
  //  - 区间内：固定满额，不随时间增加，所以多待并没有好处
  //  - 低于下限（下限默认 0，即不启用）：按比例给一部分
  //  - 超出上限：按超出程度线性递减，宽限分钟数用完后为 0；最低为 0，不会扣已有经验
  //  - 上限填 0 表示不设上限
  calcXp(minutes, goal) {
    const { minMinutes: lo, maxMinutes: hi, graceMinutes: g, baseXp: b } = goal;
    if (!(minutes > 0)) return 0;
    let f = 1;
    if (lo > 0 && minutes < lo) f = minutes / lo;
    else if (hi > 0 && minutes > hi) f = Math.max(0, 1 - (minutes - hi) / Math.max(1, g));
    return Math.round(b * f);
  },

  // 时间窗口判断，支持跨午夜（例如 23 点到次日 5 点）；起止相同表示关闭
  inWindow(hour, start, end) {
    if (start === end) return false;
    return start < end ? hour >= start && hour < end : hour >= start || hour < end;
  },
  async loadSettings() {
    const r = await chrome.storage.local.get(XPET.SETTINGS_KEY);
    return XPET.mergeSettings(r[XPET.SETTINGS_KEY]);
  },
  saveSettings(settings) {
    return chrome.storage.local.set({ [XPET.SETTINGS_KEY]: settings });
  },

  // 补全缺失的字段；某个动作的台词是空数组则表示"这个动作保持沉默"，不会被补回默认值
  normalizeChar(c) {
    const phrases = {};
    for (const [k] of XPET.ACTIONS) {
      const cur = c.phrases && Array.isArray(c.phrases[k]) ? c.phrases[k] : null;
      const isLegacy = cur && [XPET.LEGACY_PHRASES[k], XPET.LEGACY_PHRASES_V2[k]].some((l) => l && JSON.stringify(cur) === JSON.stringify(l));
      phrases[k] = cur && !isLegacy ? cur : XPET.DEFAULT_PHRASES[k].slice();
    }
    const img = typeof c.img === 'string' && c.img.startsWith('data:image/') ? c.img : null;
    const OLD_ACC_MAP = { bow: 'coffee', cap: 'duck', glasses: 'plant', flower: 'cyber_laptop', crown: 'trophy' };
    const rawAcc = OLD_ACC_MAP[c.accessory] || c.accessory;
    const accessory = XPET.ACCESSORIES.some((a) => a.id === rawAcc) ? rawAcc : 'none';
    const OLD_UNLOCK = ['今天也发了推，奖励一件 {name}', '连续出现的你，值得一件 {name}'];
    if (Array.isArray(phrases.unlock) && phrases.unlock.some((t) => OLD_UNLOCK.includes(t))) {
      phrases.unlock = XPET.DEFAULT_PHRASES.unlock.slice();
    }
    const look = c.look === 'teddy' || c.look === 'slime' || c.look === 'cat' ? c.look : 'slime'; // 老数据没有 look 字段，沿用原来的史莱姆
    const sprites = {};
    const raw = c.sprites && typeof c.sprites === 'object' ? c.sprites : {};
    const n = (v, lo, hi, d) => { const x = Math.floor(Number(v)); return Number.isFinite(x) && x >= lo && x <= hi ? x : d; };
    for (const [st] of XPET.SPRITE_STATES) {
      const m = raw[st];
      if (!m || typeof m !== 'object') continue;
      const frames = n(m.frames, 1, XPET.SPRITE_MAX_FRAMES, 0), fw = n(m.fw, 1, 4096, 0), fh = n(m.fh, 1, 4096, 0);
      if (!frames || !fw || !fh) continue;
      sprites[st] = { frames, fps: n(m.fps, 1, 30, 8), fw, fh };
    }
    const size = XPET.SIZES.some(([v]) => v === c.size) ? c.size : ((c.id === 'teddy' || c.id === 'cat') && c.size === undefined ? 1.6 : 1); // 内置泰迪的动画画面更精细，默认用「大」
    return { id: String(c.id), name: String(c.name || '未命名'), img, look, accessory, size, sprites, phrases };
  },

  async load() {
    const r = await chrome.storage.local.get([XPET.KEYS.chars, XPET.KEYS.active, XPET.SEED_KEY]);
    const stored = r[XPET.KEYS.chars];
    const fresh = !(Array.isArray(stored) && stored.length);
    const chars = fresh ? XPET.defaultChars() : stored.map(XPET.normalizeChar);
    let active = r[XPET.KEYS.active];
    const seeded = Array.isArray(r[XPET.SEED_KEY]) ? r[XPET.SEED_KEY].slice() : [];
    let dirty = false;

    // 内置角色只"播种"一次：老用户升级时补上泰迪并设为当前；之后用户把它删掉也不会再回来
    if (!seeded.includes('teddy')) {
      if (!fresh && !chars.some((c) => c.id === 'teddy')) {
        chars.unshift(XPET.builtinChar('teddy'));
        active = 'teddy';
      }
      seeded.push('teddy');
      dirty = true;
    }
    // 哈基米：老用户升级时补一只放在最后，不改变当前角色；删掉后不再回来
    if (!seeded.includes('cat')) {
      if (!fresh && !chars.some((c) => c.id === 'cat')) chars.push(XPET.builtinChar('cat'));
      seeded.push('cat');
      dirty = true;
    }
    if (!chars.some((c) => c.id === active)) active = chars[0].id;
    if (dirty) {
      try {
        await chrome.storage.local.set({ [XPET.KEYS.chars]: chars, [XPET.KEYS.active]: active, [XPET.SEED_KEY]: seeded });
      } catch (e) {}
    }
    return { chars, active };
  },

  save(chars, active) {
    return chrome.storage.local.set({ [XPET.KEYS.chars]: chars, [XPET.KEYS.active]: active });
  },
};
