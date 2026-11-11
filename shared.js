// 内容脚本和设置页共用的默认值与读写函数
const XPET = {
  KEYS: { chars: 'xpetChars', active: 'xpetActive' },
  HIST_KEY: 'xpetHistory', // 按天保存的历史数据：{ 'YYYY-MM-DD': {post, like, ..., seconds, scroll} }
  KEEP_DAYS: 90,
  SETTINGS_KEY: 'xpetSettings',
  RETIRED_IDS: ['slime', 'cat', 'doge', 'pepe', 'teddy'], // 这一版暂时移除的内置角色（只保留小桌宠 CICI）：载入时从角色列表里去掉，原始数据先存进 RETIRED_KEY，想恢复时可以取回
  RETIRED_KEY: 'xpetRetiredChars',
  SEED_KEY: 'xpetSeeded',        // 已经"播种"过的内置角色，避免用户删掉后又自动回来
  XP_KEY: 'xpetXp',               // 陪伴记录：按天结算的记录 { settled: {日期: {min}}, announced: [已通知解锁的装扮], milestones: [已通知里程碑], stories: [已通知日记], daysTotal }
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
    cat: Object.fromEntries(['idle', 'busy', 'sleepy', 'yawn', 'poke'].map((st) => [st, { frames: st === 'sleepy' ? 24 : 18, fps: { idle: 9, busy: 12, sleepy: 8, yawn: 7, poke: 13 }[st] || 10, fw: 199, fh: 187, url: 'sprites/cat/' + st + '.webp' }])),
    doge: Object.fromEntries(['idle', 'busy', 'sleepy', 'yawn', 'poke'].map((st) => [st, { frames: st === 'sleepy' ? 24 : 18, fps: { idle: 9, busy: 12, sleepy: 8, yawn: 7, poke: 13 }[st] || 10, fw: 200, fh: 188, url: 'sprites/doge/' + st + '.webp' }])),
    pepe: Object.fromEntries(['idle', 'busy', 'sleepy', 'yawn', 'poke'].map((st) => [st, { frames: st === 'sleepy' ? 24 : 18, fps: { idle: 9, busy: 12, sleepy: 8, yawn: 7, poke: 13 }[st] || 10, fw: 200, fh: 188, url: 'sprites/pepe/' + st + '.webp' }])),
  },
  builtinSprite(c, st) {
    const key = c.look || c.id;
    const b = XPET.BUILTIN_SPRITES[key];
    return b && !c.img && b[st] ? b[st] : null;
  },
  // 某个角色某个状态实际要播放的动画：用户自己的优先，其次内置；返回 { meta, url|null } 或 null
  spriteFor(c, st) {
    const own = c.sprites && c.sprites[st];
    if (own) return { meta: own, url: null };
    const b = XPET.builtinSprite(c, st);
    return b ? { meta: b, url: b.url } : null;
  },
  // 宠物显示大小倍率（标准 72×64 像素）。2026-11-08：原「特大」2.2 改名为「大」，新「特大」为 3.0（小桌宠原图 1024px，放大不会糊；泰迪精灵图帧高约 188px，3.0 时约 1:1，再大才会发虚）
  SIZES: [[1, '标准'], [2.2, '大'], [3, '特大']],
  DEFAULT_SIZE: 2.2, // 新建角色的默认大小
  // 存储里不在 SIZES 里的旧值（如旧版「大」1.6）取最接近的档位，距离相同时取较大的
  nearestSize(v) {
    v = Number(v);
    if (!Number.isFinite(v)) return XPET.DEFAULT_SIZE;
    let best = XPET.SIZES[0][0];
    XPET.SIZES.forEach(([s]) => { if (Math.abs(s - v) <= Math.abs(best - v) + 1e-9) best = s; });
    return best;
  },
  spriteKey(id, state) { return XPET.SPRITE_PREFIX + id + ':' + state; },
  SEEN_KEY: 'xpetSeen',           // 最近一次在线的时间戳（「回来了」问候用）
  MILESTONE_DAYS: [7, 30, 100, 200, 365], // 累计陪伴天数里程碑（累计，不是连续）
  GREET_KEY: 'xpetGreet',         // 时段问候：今天已经问候过的时段 { date, done: [slot id] }
  STATUS_KEY: 'xpetStatus', // 内容脚本的运行状态，供设置页诊断用

  // [动作 key, 显示名]
  ACTIONS: [
    ['click', '点击宠物（通用：「我也在……」）'],
    ['clickX', '点击宠物 · 在推特上'],
    ['clickBinance', '点击宠物 · 在币安广场'],
    ['clickOkx', '点击宠物 · 在 OK星球'],
    ['clickEarly', '点击宠物（今天刚开始，在线不到 3 分钟）'],
    ['post', '发文 / 回复'],
    ['like', '点赞（出现概率很低，不会每次都说）'],
    ['bookmark', '收藏（偶尔说）'],
    ['repost', '转发 / 引用'],
    ['follow', '关注'],
    ['night', '深夜（1–5 点仍在使用；可在设置里关闭）'],
    ['back', '离开一阵又回来了'],
    ['milestone', '陪伴天数里程碑（累计 7/30/100/200/365 天；可用 {days}）'],
    ['story', '写了新的一页日记（可用 {title}）'],
    ['unlock', '桌上多了新东西（可用 {name} 表示装扮名）'],
  ],

  // 语气：贴合用户，不劝导、不评判；第一人称，替用户说出那一刻可能在想的话；被点击时说「我也在……」。
  // 句式尽量用犹豫、开放的口吻，不下断言，不报时长，不卖萌。
  DEFAULT_PHRASES: {
    click: ['我也在发呆', '嗯，我在', '我也在看屏幕', '刚走神了一下', '…在呢'],
    clickX: ['我也在刷推特', '这条我也看到了', '我也在翻时间线', '推特今天好像挺热闹'],
    clickBinance: ['我也在看广场', '我也在翻帖子', '广场今天好像挺吵的', '我也在看行情，嗯'],
    clickOkx: ['我也在逛星球', '我也在看这边的帖子', '星球今天有点热闹', '我也在刷'],
    clickEarly: ['刚坐下，我也是', '我也才刚到', '先看看今天有什么'],
    post: ['发出去了…有点紧张', '发了，不知道有没有人看', '写完了，松了口气', '发出去就不想了'],
    like: ['这条懂我', '嗯，赞一下', '说得对啊', '戳到我了'],
    bookmark: ['先收着，说不定哪天看', '收藏 = 以后一定看（大概）', '先放这儿'],
    repost: ['这个得让更多人看到', '转一下，说得太对了', '忍不住转了'],
    follow: ['这个人有点意思', '关注一下，看看他还说什么', '新朋友？先看看'],
    night: ['好晚啊…', '我考虑考虑要不要睡觉', '再看一条就睡（大概）', '有点困，但是不想睡'],
    back: ['我回来了', '刚去倒了杯水', '回来了，刚才错过什么了吗'],
    milestone: ['不知不觉，一起 {days} 天了', '{days} 天了，我也习惯这儿了'],
    story: ['今天写了一页日记：「{title}」，在设置里能看', '日记多了一页「{title}」'],
    unlock: ['桌上多了一件 {name}', '{name}，不知道什么时候放这儿的'],
  },
  // 画像向导里的「语气」：懒散（默认，即上面的 DEFAULT_PHRASES）和俏皮。只覆盖和点击、行为有关的这几组台词
  VOICE_KEYS: ['click', 'clickX', 'clickBinance', 'clickOkx', 'clickEarly', 'post', 'like', 'bookmark', 'repost', 'follow', 'night', 'back'],
  VOICE_PLAYFUL: {
    click: ['嘿嘿，我也在这儿～', '被发现啦，我在摸鱼', '我也在偷看屏幕', '咕噜…刚在想事情'],
    clickX: ['我也在刷推特，嘿嘿', '我也在蹲时间线', '有啥新鲜事吗，我也想看', '我也在翻时间线，嘿嘿'],
    clickBinance: ['我也在逛广场～', '我也在看行情，心跳加速', '广场今天好热闹呀', '我也在潜水'],
    clickOkx: ['我也在逛星球～', '我也在围观', '星球今天好热闹呀', '我也在潜水'],
    clickEarly: ['刚坐好，我也是～', '才刚开始，先摸会儿鱼', '嗨，我也刚到'],
    post: ['发出去啦，好紧张！', '发了发了，快有人来看！', '写完啦，松一口气～', '发出去就不想了，嘿嘿'],
    like: ['这条太懂我了', '赞！忍不住', '说到心坎里了', '戳到了～'],
    bookmark: ['先收着，以后一定看（大概）', '收藏了，吃灰预定', '放进小口袋～'],
    repost: ['这个必须转！', '太对了，转一下～', '忍不住分享给大家'],
    follow: ['这个人好像很有趣', '关注啦，看看他还说啥', '新朋友，先观察～'],
    night: ['好晚啊…我是不是该睡了', '眼睛要睁不开了，但还想看', '再看一条，就一条', '要不要睡呢，我再想想'],
    back: ['我回来啦！', '刚去倒水了，错过啥了吗', '我也刚回来～'],
  },
  // 0.11 的默认台词：角色里的某个动作如果还和它完全一致（说明用户没改过），升级时自动换成新版
  LEGACY_PHRASES_V3: {
    click: ['嗯？', '在呢，不急', '我也在这儿发呆～', '今天已经 {min} 分钟了', '慢慢来', '咕噜…'],
    post: ['嗯，发出去啦', '今天第 {n} 条了', '写完啦，不错'],
    like: ['嗯嗯', '看到好东西啦', '慢慢看～'],
    bookmark: ['收着，不急着看', '先放这儿'],
    repost: ['转出去咯', '嗯，传一下～'],
    follow: ['新朋友呀', '嗯，关注了'],
    clickEarly: ['嗯，今天刚开始呢', '才刚来，不急', '早～慢慢来'],
    night: ['这么晚啦…明天再刷也行', '有点困了，你呢？'],
    milestone: ['陪你第 {days} 天啦', '一起 {days} 天了，谢谢你每天来'],
    back: ['回来啦～', '你回来啦，我一直在这儿', '欢迎回来，不急'],
    story: ['又写了一页小本子：「{title}」，在设置里能看', '小本子多了一页「{title}」'],
    unlock: ['攒够啦，多了一件 {name}', '新装扮 {name}，不用特地来领'],
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
  // 0.9.3 引入的「到上限」旧台词，升级时若没改过则忽略并清理
  LEGACY_PHRASES_V2: { atCap: ['到点啦，今天就到这儿吧？', '你设的时间到了，该歇歇了'] },
  LEGACY_SLOT_LINES: {
    dawn: ['这么早（晚）还没睡？', '凌晨了，注意休息'],
    morning: ['早上好～', '新的一天，慢慢来'],
    noon: ['中午好，记得吃饭', '午饭吃了吗？'],
    evening: ['晚上好', '今天辛苦啦'],
  },
  // 0.11 的时段问候默认台词；没改过的升级时换成新版（新版去掉了提醒、建议的口吻）
  LEGACY_SLOT_LINES_V2: {
    dawn: ['这么晚了呀…', '凌晨啦，我有点困'],
    morning: ['哈～早上了', '早呀，不急，慢慢来'],
    noon: ['中午了，吃点东西吧', '午饭吃了吗？我有点饿'],
    evening: ['晚上好呀', '今天也过得差不多了'],
  },

  // 宠物"在旁边做自己的事"：你在用页面时它拿着道具，你停下来它打盹，深夜它打哈欠
  ACTIVITIES: [['book', '📖 看书'], ['phone', '📱 玩手机'], ['laptop', '💻 用电脑'], ['none', '不拿东西']],
  PROP_EMOJI: { book: '📖', phone: '📱', laptop: '💻' },

  SITE_NAMES: {
    x: '𝕏 推特',
    binance: '🟡 币安广场',
    okx: '🔵 OK星球',
  },
  SITE_ICONS: {
    x: '𝕏',
    binance: '🟡',
    okx: '🔵',
  },

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
  // 把「语气」套到某个角色上：只覆盖点击和行为相关的几组台词，其他组不动
  applyVoice(c, voice) {
    const src = voice === 'playful' ? XPET.VOICE_PLAYFUL : XPET.DEFAULT_PHRASES;
    c.phrases = c.phrases || {};
    XPET.VOICE_KEYS.forEach((k) => { if (src[k]) c.phrases[k] = src[k].slice(); });
  },

  // 内置形象：目前只有 'chabit'（小桌宠，默认名 CICI）；没有上传自定义图片时使用
  builtinChar(look) {
    const names = { chabit: 'CICI' }; // 这一版只保留小桌宠，默认名叫 CICI（其他内置角色暂时移除，见 RETIRED_IDS）
    return { id: look, name: names[look] || look, img: null, look, accessory: "none", size: XPET.DEFAULT_SIZE, sprites: {}, phrases: XPET.defaultPhrases() };
  },

  // 全新安装：只有小桌宠（CICI）
  defaultChars() {
    return [XPET.builtinChar('chabit')];
  },

  // ---------- 显示与提醒设置 ----------
  // 时段问候的默认时段（小时，起止相同 = 关闭，支持跨午夜）；用户可自行增删修改
  defaultSlots() {
    return [
      { id: 'dawn', name: '凌晨', start: 0, end: 5, lines: ['好晚啊…', '凌晨了，我还醒着'] },
      { id: 'morning', name: '早上', start: 5, end: 11, lines: ['早…还没完全醒', '早上了，先看看今天有什么'] },
      { id: 'noon', name: '中午', start: 11, end: 14, lines: ['中午了，有点饿', '不知道午饭吃什么'] },
      { id: 'evening', name: '晚上', start: 18, end: 24, lines: ['晚上了，一天过得好快', '晚上了，今天也差不多了'] },
    ];
  },
  // 节日与纪念日。type: 'solar' 阳历 | 'lunar' 农历 | 'lunarEve' 除夕（春节前一天）
  defaultHolidays() {
    const h = (id, name, type, month, day, lines) => ({ id, name, type, month, day, lines });
    return [
      h('newyear', '元旦', 'solar', 1, 1, ['新年了，今年也在这儿趴着', '元旦快乐，新的一年慢慢过']),
      h('eve', '除夕', 'lunarEve', 12, 30, ['除夕了，屏幕里也挺安静的', '除夕快乐，今晚好像到处都很热闹']),
      h('spring', '春节', 'lunar', 1, 1, ['春节了，时间线好像慢下来了', '新年快乐，今天也在这儿陪着']),
      h('lantern', '元宵', 'lunar', 1, 15, ['元宵快乐，想吃汤圆了', '今晚的月亮应该很圆']),
      h('dragon', '端午', 'lunar', 5, 5, ['端午安康，突然有点想吃粽子', '端午快乐，放假的感觉真好']),
      h('qixi', '七夕', 'lunar', 7, 7, ['七夕了，时间线今天有点甜', '七夕快乐，今天到处都在冒粉红泡泡']),
      h('midautumn', '中秋', 'lunar', 8, 15, ['中秋快乐', '今晚的月亮应该不错']),
      h('national', '国庆', 'solar', 10, 1, ['国庆了，放假的感觉真好', '国庆快乐，长假真舒服']),
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
      reminders: { night: true, nightStart: 1, nightEnd: 5 }, // 深夜：这个时段内还在用时，宠物说一句「好晚啊」之类的心里话
      greeting: { enabled: true, slots: XPET.defaultSlots() }, // 时段问候：每个时段每天第一次出现时说一句
      profile: { rhythm: 'normal', talk: 'normal', voice: 'lazy' }, // 画像（选择题）：作息 owl/normal/early、话多话少 quiet/normal/chatty、语气 lazy/playful
      holidays: { enabled: true, items: XPET.defaultHolidays() }, // 节日/纪念日：当天第一次在线时说一句
      back: { enabled: true, minutes: 90 }, // 同一天内离开超过这么久再回来，说一句「回来啦」
      milestone: true, // 累计陪伴天数里程碑
      stories: { enabled: true }, // 小本子：解锁提示 + 点击宠物时偶尔说一句碎碎念
      quietUntil: 0, // 「今天安静」截止时间戳（毫秒）；在此之前除用户点击外不主动弹气泡，动画保留
      sites: {
        x: true,        // X (Twitter)
        binance: true,  // 币安广场 (Binance Square)
        okx: true,      // OK星球 / 广场 (OKX Planet & Square)
      },
      appearance: {
        opacity: 100, // 宠物不透明度（30% ~ 100%），鼠标悬停自动恢复 100%
        bubbleTime: 2500, // 台词停留时间（毫秒，1000 ~ 8000）
        sound: false, // 点击轻柔气泡音效（Web Audio API，默认关闭以免打扰）
        hotkey: true, // 快捷键 Alt+P 暂时隐藏/显示伴宠
      },
      scene: { mode: 'off', id: 'rain' }, // 背景手绘场景：'off' | 'manual' | 'time'
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
    const rem = raw.reminders || {}, pf = raw.profile || {}, ap = raw.appearance || {}, st = raw.sites || {};
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
      const same = (leg) => leg && JSON.stringify(x.lines) === JSON.stringify(leg);
      if (same(XPET.LEGACY_SLOT_LINES[x.id]) || same(XPET.LEGACY_SLOT_LINES_V2[x.id])) x.lines = XPET.defaultSlots().find((d) => d.id === x.id).lines;
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
    // 旧版默认节日台词带建议或第二人称口吻；没改过的升级时换成新版
    const LEG_H = {
      newyear: ['新年好，新的一年慢慢来', '元旦快乐，今年也请多多关照'],
      eve: ['除夕啦，今天不用着急，好好过', '除夕快乐，今天可以早点收工'],
      spring: [
        ['新年快乐～今天不用管时间，好好玩', '春节快乐，红包我就不要啦，陪着你就好'],
        ['新年快乐～今天想怎么逛都行', '春节快乐，红包我就不要啦，陪着你就好'],
      ],
      lantern: ['元宵快乐，汤圆吃了吗', '今晚月亮应该很圆'],
      dragon: ['端午安康，粽子吃了吗', '端午快乐，慢慢来'],
      qixi: ['七夕快乐，今天也别太晚', '今天适合陪陪重要的人'],
      midautumn: ['中秋快乐，抬头看看月亮吧', '今晚月亮很好，别光盯着屏幕'],
      national: [
        ['国庆快乐，今天好好休息', '假期愉快，不用逛太久'],
        ['国庆快乐', '假期愉快，今天想怎么逛都行'],
      ],
    };
    hItems.forEach((x) => {
      const leg = LEG_H[x.id];
      if (!leg) return;
      const list = Array.isArray(leg[0]) ? leg : [leg];
      if (list.some((l) => JSON.stringify(x.lines) === JSON.stringify(l))) {
        x.lines = XPET.defaultHolidays().find((d) => d.id === x.id).lines;
      }
    });
    const bk = raw.back && typeof raw.back === 'object' ? raw.back : {};
    const stv = raw.stories && typeof raw.stories === 'object' ? raw.stories : {};
    return {
      v: 4,
      sites: {
        x: bool(st.x, (d.sites && d.sites.x) !== false),
        binance: bool(st.binance, (d.sites && d.sites.binance) !== false),
        okx: bool(st.okx, (d.sites && d.sites.okx) !== false),
      },
      holidays: { enabled: bool(hd.enabled, d.holidays.enabled), items: hItems },
      back: { enabled: bool(bk.enabled, d.back.enabled), minutes: int(bk.minutes, 10, 720, d.back.minutes) },
      milestone: bool(raw.milestone, d.milestone),
      stories: { enabled: bool(stv.enabled, (d.stories && d.stories.enabled) !== false) },
      quietUntil: Number.isFinite(Number(raw.quietUntil)) && Number(raw.quietUntil) > 0 ? Math.floor(Number(raw.quietUntil)) : 0,
      greeting: { enabled: bool(gr.enabled, d.greeting.enabled), slots },
      chipMode: ['click', 'always', 'off'].includes(raw.chipMode) ? raw.chipMode : (raw.showChip === false ? 'off' : d.chipMode),
      chipItems: { ...d.chipItems, ...(raw.chipItems || {}) },
      reminders: {
        night: bool(rem.night, d.reminders.night),
        nightStart: int(rem.nightStart, 0, 23, d.reminders.nightStart),
        nightEnd: int(rem.nightEnd, 0, 23, d.reminders.nightEnd),
      },
      appearance: {
        opacity: int(ap.opacity, 30, 100, d.appearance.opacity),
        bubbleTime: int(ap.bubbleTime, 1000, 8000, d.appearance.bubbleTime),
        sound: bool(ap.sound, d.appearance.sound),
        hotkey: bool(ap.hotkey, d.appearance.hotkey),
      },
      profile: {
        rhythm: ['owl', 'normal', 'early'].includes(pf.rhythm) ? pf.rhythm : d.profile.rhythm,
        talk: ['quiet', 'normal', 'chatty'].includes(pf.talk) ? pf.talk : d.profile.talk,
        voice: ['lazy', 'playful'].includes(pf.voice) ? pf.voice : d.profile.voice,
      },
      scene: {
        mode: ['off', 'manual', 'time'].includes(raw.scene && raw.scene.mode) ? raw.scene.mode : d.scene.mode,
        id: (raw.scene && typeof raw.scene.id === 'string' && XPET.SCENES.some((s) => s.id === raw.scene.id))
          ? raw.scene.id
          : d.scene.id,
      },
    };
  },
  // 7 种手绘背景场景：有景深感，默认关闭
  SCENES: [
    { id: 'morning', label: '清晨晴空', file: 'morning.webp', group: 'time' },
    { id: 'afternoon', label: '午后暖光', file: 'afternoon.webp', group: 'time' },
    { id: 'dusk', label: '黄昏晚霞', file: 'dusk.webp', group: 'time' },
    { id: 'night', label: '夜晚星空', file: 'night.webp', group: 'time' },
    { id: 'spring', label: '春日微风', file: 'spring.webp', group: 'season' },
    { id: 'snow', label: '冬日初雪', file: 'snow.webp', group: 'season' },
    { id: 'rain', label: '雨天', file: 'rain.webp', group: 'weather' },
  ],
  // 根据小时与场景设置返回要展示的场景 id；off 或无法匹配时返回 null
  sceneFor(hour, sceneSettings) {
    if (!sceneSettings || typeof sceneSettings !== 'object') return null;
    const mode = sceneSettings.mode;
    if (mode === 'manual') {
      const match = XPET.SCENES.find((s) => s.id === sceneSettings.id);
      return match ? match.id : null;
    }
    if (mode === 'time') {
      let tid = null;
      if (hour >= 5 && hour < 11) tid = 'morning';
      else if (hour >= 11 && hour < 17) tid = 'afternoon';
      else if (hour >= 17 && hour < 20) tid = 'dusk';
      else tid = 'night'; // 20-23, 0-4
      const match = XPET.SCENES.find((s) => s.id === tid);
      return match ? match.id : null;
    }
    return null;
  },
  // 工位装备软关闭总开关：背景场景上线后停用不协调的矢量小物，保留数据结构以便将来恢复
  ACCESSORIES_ENABLED: false,
  // 工位装备与桌面伴侣道具：摆在宠物身边，随累计陪伴天数自动解锁。need = 需要的累计天数（累计，不要求连续），无需领取。
  ACCESSORIES: [
    { id: 'none', name: '极简工位 (无)', icon: '🪑', need: 0, desc: '纯净桌面' },
    { id: 'coffee', name: '暖心拿铁咖啡', icon: '☕', need: 3, desc: '冒着缕缕热气的陶瓷杯' },
    { id: 'duck', name: '极客调试小黄鸭', icon: '🐥', need: 7, desc: '程序员经典桌面解压小鸭' },
    { id: 'plant', name: '治愈多肉小盆栽', icon: '🪴', need: 14, desc: '静立桌角的小绿植' },
    { id: 'cyber_laptop', name: '赛博霓虹电竞本', icon: '💻', need: 30, desc: '带RGB流光渐变电竞本' },
    { id: 'retro_mac', name: '复古大头电脑', icon: '🖥️', need: 60, desc: '80年代经典米白CRT电脑' },
    { id: 'trophy', name: '陪伴纪念小奖杯', icon: '🏆', need: 100, desc: '一起过了好些天的小纪念' },
  ],


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
      const isLegacy = cur && [XPET.LEGACY_PHRASES[k], XPET.LEGACY_PHRASES_V2[k], XPET.LEGACY_PHRASES_V3[k]].some((l) => l && JSON.stringify(cur) === JSON.stringify(l));
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
    const look = 'chabit'; // 这一版只保留小桌宠：其他内置形象（含旧数据里的 teddy / slime / cat / doge / pepe）一律显示小桌宠
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
    const size = XPET.SIZES.some(([v]) => v === c.size) ? c.size : (c.size === undefined || c.size === null ? XPET.DEFAULT_SIZE : XPET.nearestSize(c.size));
    return { id: String(c.id), name: String(c.name || '未命名'), img, look, accessory, size, sprites, phrases };
  },

  async load() {
    const r = await chrome.storage.local.get([XPET.KEYS.chars, XPET.KEYS.active, XPET.SEED_KEY, XPET.RETIRED_KEY]);
    const rawStored = Array.isArray(r[XPET.KEYS.chars]) ? r[XPET.KEYS.chars] : [];
    const isRetired = (c) => !!c && XPET.RETIRED_IDS.includes(String(c.id));
    const retiredRaw = rawStored.filter(isRetired);
    const keptRaw = rawStored.filter((c) => !isRetired(c));
    const fresh = !rawStored.length; // 全新安装
    const chars = keptRaw.map(XPET.normalizeChar);
    let active = r[XPET.KEYS.active];
    const seeded = Array.isArray(r[XPET.SEED_KEY]) ? r[XPET.SEED_KEY].slice() : [];
    const arch = r[XPET.RETIRED_KEY] && typeof r[XPET.RETIRED_KEY] === 'object' ? { ...r[XPET.RETIRED_KEY] } : {};
    let dirty = retiredRaw.length > 0;

    // 这一版只保留小桌宠（CICI）。之前被存档的小桌宠（含自定义台词、大小）优先取回；没有存档才按默认新建
    let archChanged = retiredRaw.length > 0;
    if (!chars.some((c) => c.id === 'chabit')) {
      if (arch.chabit) {
        chars.unshift(XPET.normalizeChar(arch.chabit));
        delete arch.chabit;
        archChanged = true;
        dirty = true;
      } else if (fresh || !chars.length || !seeded.includes('chabit')) {
        chars.unshift(XPET.builtinChar('chabit'));
        dirty = true;
      }
    }
    if (!seeded.includes('chabit')) { seeded.push('chabit'); dirty = true; }
    chars.forEach((c) => { if (c.id === 'chabit' && c.name === '小桌宠') { c.name = 'CICI'; dirty = true; } }); // 默认名改为 CICI；用户自己改过名字的不动
    if (!chars.some((c) => c.id === active)) active = (chars.find((c) => c.id === 'chabit') || chars[0]).id;
    if (dirty) {
      try {
        const toSet = { [XPET.KEYS.chars]: chars, [XPET.KEYS.active]: active, [XPET.SEED_KEY]: seeded };
        if (archChanged) { // 先存档再从列表里去掉，想恢复时可以从 xpetRetiredChars 里取回
          retiredRaw.forEach((c) => { arch[String(c.id)] = c; });
          toSet[XPET.RETIRED_KEY] = arch;
        }
        await chrome.storage.local.set(toSet);
      } catch (e) {}
    }
    return { chars, active };
  },

  save(chars, active) {
    return chrome.storage.local.set({ [XPET.KEYS.chars]: chars, [XPET.KEYS.active]: active });
  },

  // ---------- 站点路径判断（纯函数，不读页面标题或内容，供 content.js 与自动化测试共用） ----------
  FIN_PATH: /(^|\/)(trade|trading|spot|futures|margin|derivatives|options|swap|convert|assets?|balance|wallet|deposit|withdraw|funding|earn|finance|account|copy-trading|web3|dex|p2p|fiat|buy-crypto|markets?)(\/|$|-)/,
  X_EXCLUDE_PATH: /^\/(messages|settings)(\/|$)|^\/i\/(flow|chat)(\/|$)/, // /i/chat 是 X 新版私信入口（2026-11-08 用户在浏览器中确认）
  siteKeyOf(host) {
    host = String(host || '').toLowerCase();
    if (host === 'x.com' || host.endsWith('.x.com') || host === 'twitter.com' || host.endsWith('.twitter.com')) return 'x';
    if (host.includes('binance.com')) return 'binance';
    if (host.includes('okx.') || host.includes('ouyi.')) return 'okx';
    return 'other';
  },
  siteAllowed(host, path, sites) {
    host = String(host || '').toLowerCase();
    path = String(path || '').toLowerCase();
    sites = sites || { x: true, binance: true, okx: true };
    if (host === 'x.com' || host.endsWith('.x.com') || host === 'twitter.com' || host.endsWith('.twitter.com')) {
      if (sites.x === false) return false;
      if (XPET.X_EXCLUDE_PATH.test(path)) return false;
      return true;
    }
    if (host.includes('binance.com')) {
      if (sites.binance === false) return false;
      if (XPET.FIN_PATH.test(path)) return false;
      return path.includes('/square') || path.includes('/feed');
    }
    if (host.includes('okx.') || host.includes('ouyi.')) {
      if (sites.okx === false) return false;
      if (XPET.FIN_PATH.test(path)) return false;
      // 只看网址路径（不读 document.title）：OK星球官方为 /orbit，兼容 /square、/community、/feed、/social、/insights、/discover、/post、/article
      return /\/(orbit|square|community|feed|social|insights|discover|post|article)(\/|$|-)/.test(path);
    }
    return false;
  },

  // ---------- 语气规范检查（供 tools/lint_tone.js 与 AI 导入过滤共用） ----------
  // 注意：
  //  - 「要不要」是犹豫疑问词而非命令「不要」，用 (?<!要) 排除；
  //  - 「应该」是自言自语里常用的犹豫词，用 (?<!应) 排除，只拦单独的「该」（如「该睡了」「你该…」）；
  //  - 句尾「吧」不一概而论（「先放着吧」是自言自语），只拦祈使形式：快/赶紧/去/该 + 不超过 6 个字 + 吧。
  TONE_BANNED_RE: /你|您|别|(?<!要)不要|早点|赶紧|记得|注意|休息|(?<!应)该|歇|睡吧|快去|去睡|少刷|多喝|早些|早睡|(?:快|赶紧|去|该).{0,6}吧[！!。.~～]*$/,
  MAX_LINE_LEN: 60, // 单句台词字数上限；AI 导入超过的整句丢弃（不截断，避免把 {days} 这类占位符切成半截）
  TONE_ALLOWLIST: [
    '好晚啊…我是不是该睡了',
    '我考虑考虑要不要睡觉',
    '要不要睡呢，我再想想',
  ],
  checkLineTone(line) {
    const s = String(line || '').trim();
    if (!s) return { ok: true };
    if (XPET.TONE_ALLOWLIST.includes(s)) return { ok: true };
    const m = s.match(XPET.TONE_BANNED_RE);
    return m ? { ok: false, word: m[0] } : { ok: true };
  },

  // ---------- 台词里的占位符 ----------
  // lineFor()（content.js）运行时只会替换下面这几个；写了别的 {xxx} 会被原样显示出来，所以 AI 导入时直接过滤。
  // 时段问候 / 节日台词不经过 lineFor，不支持任何占位符；日记（stories.js）只替换 {days}。
  PLACEHOLDERS: ['n', 'min', 'name', 'days', 'title', 'stats'],
  PLACEHOLDER_ONLY: { // 某些占位符只在特定动作里有意义，用在其他动作里会显示成 0 或空
    n: ['post', 'like', 'bookmark', 'repost', 'follow'],
    name: ['unlock'],
    title: ['story'],
  },
  // ctx：动作 key（如 'like'），或 'slot'（时段问候/节日，不允许任何占位符），或 'diary'（日记，只允许 {days}）
  checkPlaceholders(line, ctx) {
    const ms = String(line || '').match(/\{[^{}]*\}/g) || [];
    for (const m of ms) {
      const name = m.slice(1, -1);
      if (ctx === 'slot') return { ok: false, word: m };
      if (ctx === 'diary') { if (name !== 'days') return { ok: false, word: m }; continue; }
      if (!XPET.PLACEHOLDERS.includes(name)) return { ok: false, word: m };
      const only = XPET.PLACEHOLDER_ONLY[name];
      if (only && ctx && !only.includes(ctx)) return { ok: false, word: m };
    }
    return { ok: true };
  },

  // ---------- 通知队列（纯逻辑，不碰 DOM，便于用假时钟做自动化测试：tools/test_announcer.js） ----------
  // deps = { now(), setTimer(fn, ms), canSpeak(), bubbleUntil(), show(item) -> boolean }
  // 规则：
  //  1. 依次展示；气泡还在显示时等它结束（再加 400ms）；
  //  2. 展示成功（show 返回 true）后才调用 item.ack()，所以页面刷新、今天安静、放弃重试时，一次性通知不会被消耗；
  //  3. 带 expiresAt 的时效性通知（问候、回来）过期就丢弃，不调用 ack；
  //  4. canSpeak() 为 false 时 1.5 秒后重试（不限次数，直到过期）；show 返回 false（被更高优先级的气泡挡住）时放回队首，最多重试 5 次。
  createAnnouncer(deps) {
    const queue = [];
    let timer = null;
    const MAX_RETRIES = 5;
    function enqueue(item) {
      const entry = typeof item === 'string' ? { type: item, retries: 0 } : { ...item, retries: item.retries || 0 };
      if (entry.key && queue.some((x) => x.key === entry.key)) return false; // 同一通知已在队列中则不重复入队
      queue.push(entry);
      pump();
      return true;
    }
    function pump(delayMs) {
      if (timer || !queue.length) return;
      const wait = delayMs !== undefined ? delayMs : Math.max(0, deps.bubbleUntil() - deps.now()) + 400;
      timer = deps.setTimer(() => {
        timer = null;
        const now = deps.now();
        while (queue.length && queue[0].expiresAt && now > queue[0].expiresAt) queue.shift(); // 过期丢弃（不调用 ack，不消耗存储标记）
        if (!queue.length) return;
        if (!deps.canSpeak()) { pump(1500); return; }
        const item = queue.shift();
        const ok = !!deps.show(item);
        if (ok) {
          if (typeof item.ack === 'function') { try { item.ack(); } catch (_) {} }
        } else if ((item.retries || 0) < MAX_RETRIES) {
          item.retries = (item.retries || 0) + 1;
          queue.unshift(item);
        }
        pump();
      }, wait);
    }
    return { enqueue, pump, size: () => queue.length };
  },

  // ---------- AI 设定与台词一键生成 / 导入 ----------
  AI: {
    PERSONAS: [
      {
        id: 'degen',
        name: '🐸 Web3 Degen 交易员',
        look: 'chabit',
        charName: 'CICI',
        persona: '狂热且幽默的 Web3 链上交易员，满嘴币圈梗，盯着推特和广场动态，用第一人称说出刷帖时的心里话。',
        custom: '多结合推特/币安广场/OK星球的加密社区梗（如炒币、投研、百倍币、K线、挂单、Alpha等），自言自语，不评价用户。',
      },
      {
        id: 'tsundere',
        name: '🐱 傲娇吐槽猫咪',
        look: 'chabit',
        charName: 'CICI',
        persona: '傲娇高冷、嘴硬心软的猫咪，用第一人称自言自语；吐槽对象只能是自己或外部事物（如时间线、热搜、行情），绝不针对或嫌弃用户，偶尔带点口癖“喵”。',
        custom: '吐槽对象只能是自己或外部事物，不针对用户；深夜时嘴硬说自己还不困，其实眼皮打架。',
      },
      {
        id: 'cheerful',
        name: '🐕 元气忠诚柴柴',
        look: 'chabit',
        charName: 'CICI',
        persona: '元气满满、阳光温暖的柴犬，用第一人称自言自语，发帖或点赞时自己也跟着开心摇尾巴。',
        custom: '充满活力，偶尔带汪汪拟声词，自言自语当下在做的事，不说教。',
      },
      {
        id: 'worker',
        name: '💼 毒舌打工人搭子',
        look: 'chabit',
        charName: 'CICI',
        persona: '幽默毒舌的职场打工人，咖啡续命，精通摸鱼哲学；吐槽对象只能是自己或外部事物（如周一、加班、需求、行情），绝不针对或评判用户。',
        custom: '职场摸鱼幽默，吐槽对象只能是自己或外部事物，替自己说出打工人的心里话。',
      },
      {
        id: 'healing',
        name: '☕ 温柔治愈系搭子',
        look: 'chabit',
        charName: 'CICI',
        persona: '温柔慢热的安静伴侣，用第一人称轻声自言自语，像热饮一样安静待在桌角。',
        custom: '温和细腻，不施加任何压力，只说自己当下的感受。',
      },
      {
        id: 'cyber',
        name: '⚡ 赛博AI助手',
        look: 'chabit',
        charName: 'CICI',
        persona: '来自未来的赛博机体，冷静睿智，用第一人称像系统日志一样旁白自己眼前的状态，偶尔展现出一点温度。',
        custom: '带点未来科技感和系统日志风格，旁白自己的状态而不分析用户。',
      },
    ],

    LOOK_NAMES: {
      chabit: '小桌宠',
    },

    buildPrompt(opts = {}) {
      const look = opts.look || 'chabit';
      const lookName = XPET.AI.LOOK_NAMES[look] || look;
      const charName = (opts.name || '').trim() || lookName;
      const persona = (opts.persona || '').trim() || '随和幽默的桌面伴宠';
      const custom = (opts.custom || '').trim() || '无特殊要求，请自由发挥。';
      const includeSlots = opts.includeSlots !== false;

      return `你是一名专属桌面伴宠（Desk Pet）台词与人设架构师。
请为一款运行在浏览器（推特/X、币安广场、OK星球）上的桌面伴宠插件【CCbd 伴宠】设计一套充满个性的角色台词与配置。

【伴宠设定要求】
- 角色形象：${lookName}（形象ID: "${look}"）
- 角色名称：${charName}
- 人设与性格：${persona}
- 额外定制需求：${custom}

【台词设计规范与变量占位符】
伴宠是用户在屏幕里的“嘴替”：用户在浏览网页、发帖点赞时，它用第一人称（“我”）说出这一刻可能在想的话，像一个和用户很像的人在自言自语。
写作原则（非常重要）：
- 只用第一人称自言自语，贴合当下行为，不劝导、不评判、不说教、不下命令；严禁出现“你”“您”“别”“不要”“早点”“赶紧”“记得”“注意”“休息”等第二人称或说教词汇。
- 吐槽对象只能是自己或外部事物（如时间线、热搜），绝不针对用户。
- 不下绝对断言，多用犹豫、开放的句式，例如“我考虑考虑要不要睡觉”“好晚啊…”。
- 不要卖萌撒娇，不要堆叠语气词；每句尽量短（20 字以内）。
- 被点击时说“我也在……”：说自己此刻在做什么（看推特、发呆、看屏幕），不要报在线时长。
变量占位符只有三个：{days}（陪伴天数）、{title}（日记标题）、{name}（桌搭名称），且只能出现在下面第 13–15 类里；其他类别和时段问候里不要出现任何 {} 变量，也不要自创变量（插件会在运行时自动替换成真实内容）：
1. click (平时点击伴宠): 3~5句，“我也在……”，说自己此刻在干嘛（发呆、看屏幕等）。
2. clickX (在推特上点击): 3~4句，例如“我也在刷推特”。
3. clickBinance (在币安广场点击): 3~4句。
4. clickOkx (在OK星球点击): 3~4句。
5. clickEarly (今天刚开始时点击): 2~3句。
6. post (发文/发推/发帖/回复后): 3~4句，刚发完内容那一刻的心里话。
7. like (点赞): 3~4句（出现概率很低，所以每句要有味道）。
8. bookmark (收藏): 2~3句。
9. repost (转发/引用): 2~3句。
10. follow (关注新账号): 2~3句。
11. night (深夜1点-5点仍在使用): 3~4句，用犹豫、矛盾的口吻，不要劝睡。
12. back (中途离开后重新回来): 2~3句，说自己回来了。
13. milestone (陪伴天数里程碑): 2句，【必须保留】{days} 变量。例如："不知不觉，一起 {days} 天了"
14. story (写了新的一页日记): 2句，【必须保留】{title} 变量。例如："日记多了一页「{title}」"
15. unlock (桌上多了新东西): 2句，【必须保留】{name} 变量。例如："桌上多了一件 {name}"
${includeSlots ? `
【时段问候 (通用每日首次问候，同样只用第一人称自言自语，不含“你/别/记得/注意/休息”)】
- morning (早上 5-11点): 2句早安自言自语
- noon (中午 11-14点): 2句中午自言自语
- evening (晚上 18-24点): 2句晚间自言自语
- dawn (凌晨 0-5点): 2句凌晨自言自语
` : ''}
【重要输出要求】
请直接输出纯 JSON 数据，使用 \`\`\`json 代码块包裹，不要包含任何前言、解释或对话废话。
JSON 数据结构必须严格符合以下格式：
\`\`\`json
{
  "name": "${charName}",
  "look": "${look}",
  "persona": "${persona}",
  "phrases": {
    "click": ["..."],
    "clickX": ["..."],
    "clickBinance": ["..."],
    "clickOkx": ["..."],
    "clickEarly": ["..."],
    "post": ["..."],
    "like": ["..."],
    "bookmark": ["..."],
    "repost": ["..."],
    "follow": ["..."],
    "night": ["..."],
    "back": ["..."],
    "milestone": ["不知不觉，一起 {days} 天了"],
    "story": ["日记多了一页「{title}」"],
    "unlock": ["桌上多了一件 {name}"]
  }${includeSlots ? `,
  "slots": [
    { "id": "dawn", "name": "凌晨", "lines": ["..."] },
    { "id": "morning", "name": "早上", "lines": ["..."] },
    { "id": "noon", "name": "中午", "lines": ["..."] },
    { "id": "evening", "name": "晚上", "lines": ["..."] }
  ]` : ''}
}
\`\`\``;
    },

    parseOutput(text) {
      if (!text || typeof text !== 'string') {
        return { ok: false, error: '输入内容为空，请粘贴 AI 的生成结果。' };
      }
      try {
        let clean = text.trim();
        // 提取 ```json 代码块
        const blockMatch = clean.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
        if (blockMatch) clean = blockMatch[1].trim();

        // 截取首个 { 到最后一个 }
        const start = clean.indexOf('{');
        const end = clean.lastIndexOf('}');
        if (start === -1 || end === -1 || end <= start) {
          return { ok: false, error: '未识别到有效的 JSON 对象格式（缺少花括号 {}）。' };
        }
        let jsonStr = clean.slice(start, end + 1);
        // 清理末尾多余逗号 [a, b,] 或 {"a": 1,}
        jsonStr = jsonStr.replace(/,\s*([}\]])/g, '$1');

        const parsed = JSON.parse(jsonStr);
        if (!parsed || typeof parsed !== 'object') {
          return { ok: false, error: '解析结果不是有效的 JSON 对象。' };
        }

        // 提取 phrases，并按语气规范过滤含说教/第二人称的句子
        const rawPhrases = parsed.phrases && typeof parsed.phrases === 'object' ? parsed.phrases : parsed;
        const validActions = XPET.ACTIONS.map(([k]) => k);
        const phrases = {};
        let lineCount = 0;
        let actionCount = 0;
        let filteredCount = 0;
        const fallbackActions = [];

        for (const act of validActions) {
          const arr = rawPhrases[act];
          if (Array.isArray(arr) && arr.length > 0) {
            const rawLines = arr.map((s) => String(s || '').trim()).filter(Boolean);
            const kept = [];
            for (const l of rawLines) {
              if (l.length <= XPET.MAX_LINE_LEN && XPET.checkLineTone(l).ok && XPET.checkPlaceholders(l, act).ok) kept.push(l);
              else filteredCount++;
            }
            if (kept.length > 0) {
              phrases[act] = kept;
              lineCount += kept.length;
              actionCount++;
              continue;
            }
            if (rawLines.length > 0) fallbackActions.push(act);
          }
          // 如果某类缺失或全被过滤，采用默认台词补全
          phrases[act] = (XPET.DEFAULT_PHRASES[act] || []).slice();
        }

        if (actionCount === 0) {
          if (filteredCount > 0) {
            return { ok: false, error: `AI 生成的 ${filteredCount} 条台词均因包含第二人称/说教词汇（如“你/别/休息/快去”）、超过 ${XPET.MAX_LINE_LEN} 字或含不支持的 {占位符} 被拦截，请重新生成。` };
          }
          return { ok: false, error: '未能从数据中提取到任何有效的伴宠台词分类。' };
        }

        const validLooks = ['chabit'];
        const look = validLooks.includes(parsed.look) ? parsed.look : 'chabit';
        const name = (parsed.name && typeof parsed.name === 'string') ? parsed.name.trim().slice(0, 20) : (XPET.AI.LOOK_NAMES[look] || '新伴宠');
        const persona = typeof parsed.persona === 'string' ? parsed.persona.trim() : '';

        // 处理 slots（同样过滤违规语气）
        let slots = null;
        let slotLineCount = 0;
        if (Array.isArray(parsed.slots)) {
          slots = [];
          for (const s of parsed.slots) {
            if (s && typeof s === 'object' && s.id && Array.isArray(s.lines)) {
              const rawLines = s.lines.map((l) => String(l || '').trim()).filter(Boolean);
              const lines = [];
              for (const l of rawLines) {
                if (l.length <= XPET.MAX_LINE_LEN && XPET.checkLineTone(l).ok && XPET.checkPlaceholders(l, 'slot').ok) lines.push(l);
                else filteredCount++;
              }
              if (lines.length > 0) {
                slots.push({ id: String(s.id), name: String(s.name || s.id), lines });
                slotLineCount += lines.length;
              }
            }
          }
        }

        return {
          ok: true,
          data: {
            name,
            look,
            persona,
            phrases,
            slots,
          },
          stats: {
            actionCount,
            lineCount,
            slotLineCount,
            filteredCount,
            fallbackActions,
          },
        };
      } catch (e) {
        return { ok: false, error: 'JSON 解析失败：' + (e.message || String(e)) };
      }
    },
  },
};

