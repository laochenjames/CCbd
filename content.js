(() => {
  // 防止重复注入
  if (document.getElementById('xpet-root')) return;

  const BASE_W = 72, BASE_H = 64, MARGIN = 8;
  let W = BASE_W, H = BASE_H; // 随角色的「显示大小」变化
  const POS_KEY = 'xpetPos';
  const COUNT_KEY = 'xpetCount';

  const SLIME_SVG = `
    <svg viewBox="0 0 100 90" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 78 C4 50 24 12 50 12 C76 12 96 50 90 78 C88 84 80 86 72 86 L28 86 C20 86 12 84 10 78 Z"
            fill="#6fd08c" stroke="#3e9d5f" stroke-width="3"/>
      <ellipse cx="32" cy="34" rx="9" ry="5" fill="#fff" opacity="0.5" transform="rotate(-25 32 34)"/>
      <ellipse class="xpet-eye" cx="36" cy="56" rx="5" ry="7" fill="#1f2d24"/>
      <ellipse class="xpet-eye" cx="64" cy="56" rx="5" ry="7" fill="#1f2d24"/>
      <circle cx="37.5" cy="53.5" r="1.8" fill="#fff"/>
      <circle cx="65.5" cy="53.5" r="1.8" fill="#fff"/>
      <ellipse cx="24" cy="68" rx="6" ry="3.5" fill="#ff9aa8" opacity="0.7"/>
      <ellipse cx="76" cy="68" rx="6" ry="3.5" fill="#ff9aa8" opacity="0.7"/>
      <path d="M44 68 Q50 74 56 68" stroke="#1f2d24" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    </svg>`;


  // 泰迪犬：棕色卷毛、垂耳、浅色口鼻、粉舌头
  const TEDDY_SVG = `
    <svg viewBox="0 0 100 90" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="50" cy="80" rx="26" ry="9" fill="#b9793f"/>
      <ellipse cx="36" cy="85" rx="8" ry="4.5" fill="#c68a53"/>
      <ellipse cx="64" cy="85" rx="8" ry="4.5" fill="#c68a53"/>
      <g fill="#a9703d">
        <ellipse cx="21" cy="50" rx="11" ry="18" transform="rotate(12 21 50)"/>
        <ellipse cx="79" cy="50" rx="11" ry="18" transform="rotate(-12 79 50)"/>
        <circle cx="17" cy="63" r="7"/><circle cx="83" cy="63" r="7"/>
      </g>
      <g fill="#c68a53">
        <circle cx="50" cy="45" r="28"/>
        <circle cx="31" cy="24" r="10"/><circle cx="50" cy="16" r="11"/><circle cx="69" cy="24" r="10"/>
        <circle cx="24" cy="41" r="9"/><circle cx="76" cy="41" r="9"/>
      </g>
      <ellipse cx="50" cy="58" rx="16" ry="12" fill="#ecd2ac"/>
      <ellipse class="xpet-eye" cx="38" cy="43" rx="4.5" ry="5.5" fill="#2b1d14"/>
      <ellipse class="xpet-eye" cx="62" cy="43" rx="4.5" ry="5.5" fill="#2b1d14"/>
      <circle cx="39.6" cy="40.8" r="1.7" fill="#fff"/>
      <circle cx="63.6" cy="40.8" r="1.7" fill="#fff"/>
      <ellipse cx="50" cy="52" rx="5.5" ry="3.8" fill="#2b1d14"/>
      <ellipse cx="48.5" cy="50.8" rx="1.8" ry="1" fill="#fff" opacity="0.6"/>
      <path d="M50 55.5 V60 M43 60 Q50 66 57 60" stroke="#2b1d14" stroke-width="2" fill="none" stroke-linecap="round"/>
      <ellipse cx="50" cy="65.5" rx="3.6" ry="4.6" fill="#ff8fa3"/>
    </svg>`;
  const LOOKS = { slime: SLIME_SVG, teddy: TEDDY_SVG };

  const root = document.createElement('div');
  root.id = 'xpet-root';
  root.style.display = 'none'; // 初始隐藏，等检测当前站点与页面允许后再显示
  root.innerHTML = '<div class="xpet-bubble"></div><div class="xpet-body"></div><div class="xpet-chip"></div>';
  document.body.appendChild(root);
  const bubble = root.querySelector('.xpet-bubble');
  const body = root.querySelector('.xpet-body');
  const chip = root.querySelector('.xpet-chip');

  // ---------- 角色 ----------
  let chars = XPET.defaultChars();
  let activeId = chars[0].id;
  const activeChar = () => chars.find((c) => c.id === activeId) || chars[0];

  let xpTotal = 0; // 累计经验，决定装扮是否解锁
  let xpDays = 0; // 累计陪伴天数（有记录的天数，累计不是连续）
  let storyTitle = ''; // 最近解锁的小本子标题，给「写了新的一页」台词用

  // ---------- 工位装备与桌面伴侣道具 SVG ----------
  const GEAR_SVGS = {
    coffee: `
      <svg viewBox="0 0 32 32" class="xpet-gear-svg">
        <path class="xpet-steam steam-1" d="M11 9 C10 7 12 5 11 3" stroke="#fff" stroke-width="1.8" stroke-linecap="round" fill="none"/>
        <path class="xpet-steam steam-2" d="M17 10 C16 8 18 6 17 4" stroke="#fff" stroke-width="1.8" stroke-linecap="round" fill="none"/>
        <path d="M6 13 L22 13 L20 27 C20 29 18 30 16 30 L12 30 C10 30 8 29 8 27 Z" fill="#ffffff" stroke="#d5dbe1" stroke-width="1.2"/>
        <path d="M21 16 C25 16 26 21 21 23" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round"/>
        <ellipse cx="14" cy="13" rx="7" ry="2.2" fill="#6f4e37"/>
        <path d="M14 19 C12 18 11 20 14 22 C17 20 16 18 14 19 Z" fill="#ff7675"/>
      </svg>`,
    duck: `
      <svg viewBox="0 0 32 32" class="xpet-gear-svg">
        <circle cx="16" cy="12" r="7.5" fill="#fbc531"/>
        <ellipse cx="18" cy="22" rx="9" ry="7" fill="#fbc531"/>
        <path d="M23 20 C27 21 28 24 23 25 Z" fill="#fbc531"/>
        <circle cx="13" cy="10.5" r="1.4" fill="#2f3640"/>
        <path d="M8 12 C4 12 4 15 8 16 C10 15 10 12.5 8 12 Z" fill="#e17055"/>
      </svg>`,
    plant: `
      <svg viewBox="0 0 32 32" class="xpet-gear-svg">
        <path d="M9 19 L23 19 L21 30 L11 30 Z" fill="#dfe6e9"/>
        <ellipse cx="16" cy="19" rx="7" ry="2" fill="#576574"/>
        <path d="M16 19 C12 14 13 10 16 8 C19 10 20 14 16 19 Z" fill="#10ac84"/>
        <path d="M12 18 C8 14 10 11 13 11 C14 14 14 17 12 18 Z" fill="#1dd1a1"/>
        <path d="M20 18 C24 14 22 11 19 11 C18 14 18 17 20 18 Z" fill="#10ac84"/>
      </svg>`,
    cyber_laptop: `
      <svg viewBox="0 0 34 32" class="xpet-gear-svg">
        <defs>
          <linearGradient id="cyber-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#00f2fe"/>
            <stop offset="50%" stop-color="#4facfe"/>
            <stop offset="100%" stop-color="#f093fb"/>
          </linearGradient>
        </defs>
        <rect x="5" y="10" width="22" height="15" rx="2" fill="#1e1e24" stroke="url(#cyber-grad)" stroke-width="1.5"/>
        <rect x="7" y="12" width="18" height="11" rx="1" fill="#0c0d12"/>
        <circle cx="16" cy="17.5" r="2.8" fill="url(#cyber-grad)" opacity="0.9"/>
        <path d="M2 25 L30 25 L28 29 L4 29 Z" fill="#2d3139"/>
        <line x1="8" y1="27" x2="24" y2="27" stroke="url(#cyber-grad)" stroke-width="1.2" stroke-linecap="round"/>
      </svg>`,
    retro_mac: `
      <svg viewBox="0 0 32 32" class="xpet-gear-svg">
        <rect x="6" y="8" width="20" height="20" rx="3" fill="#eae3d2" stroke="#bcb099" stroke-width="1.2"/>
        <rect x="9" y="11" width="14" height="11" rx="1.5" fill="#1e272e"/>
        <line x1="11" y1="14" x2="15" y2="14" stroke="#0be881" stroke-width="1.5" stroke-linecap="round"/>
        <line x1="11" y1="17" x2="19" y2="17" stroke="#0be881" stroke-width="1.2" stroke-linecap="round"/>
        <rect x="9" y="24" width="8" height="1.5" rx="0.5" fill="#718093"/>
        <circle cx="21" cy="24.5" r="1" fill="#ff3838"/>
      </svg>`,
    trophy: `
      <svg viewBox="0 0 32 32" class="xpet-gear-svg">
        <defs>
          <linearGradient id="gold-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#ffeaa7"/>
            <stop offset="50%" stop-color="#fdcb6e"/>
            <stop offset="100%" stop-color="#e17055"/>
          </linearGradient>
        </defs>
        <path d="M8 9 C3 9 3 17 8 17 M24 9 C29 9 29 17 24 17" fill="none" stroke="url(#gold-grad)" stroke-width="2" stroke-linecap="round"/>
        <path d="M8 7 L24 7 L22 18 C22 22 18 23 16 23 C14 23 10 22 10 18 Z" fill="url(#gold-grad)"/>
        <path d="M14 23 L14 27 L18 27 L18 23 Z" fill="#fdcb6e"/>
        <rect x="10" y="27" width="12" height="3" rx="1" fill="#2d3436"/>
        <polygon points="16,11 17.5,14 20.5,14 18,16 19,19 16,17.5 13,19 14,16 11.5,14 14.5,14" fill="#ffffff" opacity="0.95"/>
      </svg>`
  };

  // ---------- 姿态：在用页面 → 正常工作；停下来 → 打盹；深夜 → 打哈欠 ----------
  let lastPoseActive = true, curPoseKey = "busy"; // 刚打开页面算在用，不要一上来就打盹
  function updatePose(active) {
    lastPoseActive = active;
    let night = false;
    try { // settings 在脚本稍后才初始化，早期调用时忽略
      night = !!(settings.reminders.night && XPET.inWindow(new Date().getHours(), settings.reminders.nightStart, settings.reminders.nightEnd));
    } catch (e) {}
    curPoseKey = !active ? 'idle' : night ? 'night' : 'busy';
    applySprite();
  }

  // ---------- 精灵图：按状态播放角色自带的动画；没有对应图片时退回基础图/静态图/内置形象 ----------
  let spriteEl = null, spriteCache = {}, spriteCharId = null, spriteState = null, spriteToken = 0, forceState = '', forceUntil = 0, forceTimer = null;
  const SPRITE_FALLBACK = { poke: ['poke', 'busy', 'idle'], busy: ['busy', 'idle'], sleepy: ['sleepy', 'idle'], yawn: ['yawn', 'sleepy', 'idle'], idle: ['idle'] };
  function wantedSpriteState() {
    if (Date.now() < forceUntil) return forceState;
    if (curPoseKey === 'idle') return 'sleepy';
    if (curPoseKey === 'night') return 'yawn';
    return 'busy';
  }
  function playState(state, ms) {
    forceState = state;
    forceUntil = Date.now() + ms;
    applySprite();
    clearTimeout(forceTimer);
    forceTimer = setTimeout(applySprite, ms + 50);
  }
  function applySprite() {
    if (!spriteEl) return;
    const c = activeChar();
    const want = wantedSpriteState();
    const use = SPRITE_FALLBACK[want].find((st) => XPET.spriteFor(c, st));
    if (!use) {
      spriteEl.style.display = 'none';
      body.classList.remove('xpet-has-sprite');
      spriteState = null;
      return;
    }
    if (use === spriteState) return;
    const src = XPET.spriteFor(c, use);
    const token = ++spriteToken;
    if (src.url) { // 内置动画：直接用扩展里的文件
      try { paintSprite(use, src.meta, chrome.runtime.getURL(src.url)); } catch (e) {}
      return;
    }
    const key = XPET.spriteKey(c.id, use);
    const show = (data) => { if (token === spriteToken) paintSprite(use, src.meta, data); };
    if (spriteCache[key]) { show(spriteCache[key]); return; }
    try {
      chrome.storage.local.get(key, (r) => {
        const d = r && r[key];
        if (typeof d === 'string' && d.startsWith('data:image/') && d.indexOf('"') < 0) { spriteCache[key] = d; show(d); }
      });
    } catch (e) {}
  }
  function paintSprite(state, m, data) {
    if (!spriteEl) return;
    spriteState = state;
    const sc = Math.min(W / m.fw, H / m.fh); // 保持帧的宽高比，放进宠物框里
    spriteEl.style.display = 'block';
    spriteEl.style.width = Math.round(m.fw * sc) + 'px';
    spriteEl.style.height = Math.round(m.fh * sc) + 'px';
    spriteEl.style.backgroundImage = 'url("' + data + '")';
    spriteEl.style.backgroundSize = m.frames * 100 + '% 100%';
    spriteEl.style.animation = 'none';
    if (m.frames > 1) {
      void spriteEl.offsetWidth; // 重启动画
      const isOnce = state === 'poke';
      const loop = isOnce ? '1' : 'infinite';
      const fill = isOnce ? 'forwards' : 'none';
      spriteEl.style.animation = `xpet-sprite ${m.frames / m.fps}s steps(${m.frames}, jump-none) ${loop} ${fill}`;
    }
    body.classList.add('xpet-has-sprite');
  }
  function applySize() {
    const s = activeChar().size || 1;
    W = Math.round(BASE_W * s);
    H = Math.round(BASE_H * s);
    root.style.width = W + 'px';
    root.style.height = H + 'px';
    root.style.setProperty('--xs', String(s));
    try { const r = root.getBoundingClientRect(); place(r.left, r.top); } catch (e) {}
  }

  function renderChar() {
    const c = activeChar();
    body.textContent = '';
    if (c.img) {
      const img = document.createElement('img');
      img.src = c.img; // 已在 normalizeChar 中限制为 data:image/
      img.alt = c.name;
      img.draggable = false;
      body.appendChild(img);
    } else {
      body.innerHTML = LOOKS[c.look] || SLIME_SVG; // 内置常量，不含用户内容
    }
    if (spriteCharId !== c.id) { spriteCache = {}; spriteCharId = c.id; }
    spriteEl = document.createElement('div');
    spriteEl.className = 'xpet-sprite';
    spriteEl.style.display = 'none';
    body.appendChild(spriteEl);
    spriteState = null;
    applySize();
    updatePose(lastPoseActive);
    renderGear();
  }

  // ---------- 工位伴侣装备渲染 ----------
  let gearEl = null;
  function renderGear() {
    if (gearEl) { gearEl.remove(); gearEl = null; }
    const c = activeChar();
    const acc = XPET.ACCESSORIES.find((a) => a.id === c.accessory);
    if (!acc || acc.id === 'none' || acc.need > xpTotal) return;
    const svg = GEAR_SVGS[acc.id];
    if (!svg) return;
    gearEl = document.createElement('div');
    gearEl.className = 'xpet-desk-gear xpet-gear-' + acc.id;
    gearEl.title = acc.name + ' · ' + acc.desc;
    gearEl.innerHTML = svg;
    root.appendChild(gearEl);
  }

  async function reloadChars() {
    try {
      const d = await XPET.load();
      chars = d.chars.map((c) => (c.id === d.active ? c : { ...c, img: null }));
      activeId = d.active;
      renderChar();
    } catch (e) {}
  }
  renderChar();
  reloadChars();

  // 设置页里的任何修改，这里实时生效，不用刷新页面
  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;
      if (changes[XPET.KEYS.chars] || changes[XPET.KEYS.active]) reloadChars();
      if (Object.keys(changes).some((k) => k.startsWith(XPET.SPRITE_PREFIX))) { spriteCache = {}; spriteState = null; applySprite(); }
      if (changes[XPET.SETTINGS_KEY]) reloadSettings();
      if (changes[XPET.XP_KEY]) {
        xpTotal = (changes[XPET.XP_KEY].newValue && changes[XPET.XP_KEY].newValue.total) || 0;
        xpDays = (changes[XPET.XP_KEY].newValue && changes[XPET.XP_KEY].newValue.daysTotal) || 0;
        renderChar();
      }
    });
  } catch (e) {}

  // ---------- 位置 ----------
  const extraBottom = 26; // 给统计条在宠物下方留出空间，避免被屏幕边缘挡住
  const clamp = (x, y) => ({
    x: Math.min(Math.max(MARGIN, x), window.innerWidth - W - MARGIN),
    y: Math.min(Math.max(MARGIN, y), window.innerHeight - H - MARGIN - extraBottom),
  });
  const place = (x, y) => {
    const p = clamp(x, y);
    root.style.left = p.x + 'px';
    root.style.top = p.y + 'px';
    return p;
  };
  const savePos = (p) => {
    try { chrome.storage.local.set({ [POS_KEY]: p }); } catch (e) {}
  };

  place(window.innerWidth - W - 24, window.innerHeight - H - 24);
  try {
    chrome.storage.local.get(POS_KEY, (res) => {
      const p = res && res[POS_KEY];
      if (p && typeof p.x === 'number') place(p.x, p.y);
    });
  } catch (e) {}

  window.addEventListener('resize', () => {
    const r = root.getBoundingClientRect();
    savePos(place(r.left, r.top));
  });

  // ---------- 显示与提醒设置 ----------
  let settings = XPET.defaultSettings();
  let settingsLoaded = false;
  let chipUntil = 0;     // 统计条临时显示到什么时候（点击宠物 / 右键菜单）
  let chipTimer = null;

  // 统计条、点击显示、右键菜单"今日统计"、台词里的 {stats}，全部用这一个函数，内容完全一致
  function formatDay(day, extraSec, extraScroll) {
    const it = settings.chipItems;
    const parts = [];
    [['post', '发'], ['like', '赞'], ['bookmark', '藏'], ['repost', '转'], ['follow', '关注']].forEach(([k, label]) => {
      if (it[k]) parts.push(label + (day[k] || 0));
    });
    if (it.time) parts.push(XPET.fmtDur(((day.seconds || 0) + extraSec) / 60));
    if (it.scroll) parts.push(XPET.fmtScroll((day.scroll || 0) + extraScroll));
    return parts.join(' · ');
  }
  const chipText = () => formatDay(counts, pendingSec, pendingScroll);

  function refreshChip() {
    const visible = settings.chipMode === 'always' || Date.now() < chipUntil;
    const t = visible ? chipText() : '';
    chip.style.display = t ? 'block' : 'none';
    if (chip.textContent !== t) chip.textContent = t; // 内容没变就不碰 DOM
  }
  function showChipFor(ms) {
    chipUntil = Date.now() + ms;
    refreshChip();
    clearTimeout(chipTimer);
    chipTimer = setTimeout(refreshChip, ms + 50);
  }
  // ---------- 站点检测与单页应用 (SPA) 路由支持 ----------
  function checkSiteAllowed(curSettings) {
    const host = location.hostname.toLowerCase();
    const path = location.pathname.toLowerCase();
    const sites = (curSettings && curSettings.sites) || { x: true, binance: true, okx: true };

    if (host === 'x.com' || host.endsWith('.x.com') || host === 'twitter.com' || host.endsWith('.twitter.com')) {
      return sites.x !== false;
    }
    if (host.includes('binance.com')) {
      if (sites.binance === false) return false;
      // 仅在币安广场页面生效（/square, /feed）
      return path.includes('/square') || path.includes('/feed');
    }
    if (host.includes('okx.com')) {
      if (sites.okx === false) return false;
      // 仅在OK星球与社区页面生效（/square, /community）
      return path.includes('/square') || path.includes('/community');
    }
    return false;
  }

  function updateSiteVisibility() {
    const allowed = checkSiteAllowed(settings);
    root.style.display = (allowed && !isHiddenByHotkey) ? '' : 'none';
  }

  // 监听 SPA 路由切换（如在币安或OKX从其他页面进入广场）
  let lastCheckedHref = location.href;
  setInterval(() => {
    if (location.href !== lastCheckedHref) {
      lastCheckedHref = location.href;
      updateSiteVisibility();
    }
  }, 500);
  window.addEventListener('popstate', updateSiteVisibility);

  function applySettings() {
    tiredBaseline = null; // 提醒间隔改了，重新以当前时长为起点，避免立刻补发提醒
    const op = (settings.appearance && settings.appearance.opacity !== undefined) ? settings.appearance.opacity / 100 : 1;
    root.style.setProperty('--xpet-opacity', String(op));
    updateSiteVisibility();
    refreshChip();
  }
  async function reloadSettings() {
    try {
      settings = await XPET.loadSettings();
      settingsLoaded = true;
      applySettings();
      // 旧版（0.9.1 之前）的收藏/想法数据已废弃，清掉
      try { chrome.storage.local.remove(['xpetBookmarks', 'xpetNotes', 'xpetRemind']); } catch (_) {}
    } catch (e) {}
  }

  // ---------- 说话 ----------
  let bubbleTimer = null;
  function say(text, ms) {
    const base = (settings.appearance && settings.appearance.bubbleTime) || 2500;
    const dur = ms ? Math.round(ms * (base / 2500)) : base;
    bubble.textContent = text; // 用 textContent，用户自定义台词不会被当成 HTML
    bubble.classList.add('xpet-show');
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(() => bubble.classList.remove('xpet-show'), dur);
  }

  // 取一句台词（带占位符替换）；没有台词返回空字符串
  function lineFor(type) {
    const list = activeChar().phrases[type] || [];
    const lines = list.filter((s) => s && s.trim());
    if (!lines.length) return '';
    const raw = lines[Math.floor(Math.random() * lines.length)];
    return raw
      .replace(/\{n\}/g, String(counts[type] || 0))
      .replace(/\{min\}/g, String(Math.floor(totalSeconds() / 60)))
      .replace(/\{left\}/g, String(Math.max(0, settings.goal.maxMinutes - Math.floor(totalSeconds() / 60))))
      .replace(/\{name\}/g, unlockName)
      .replace(/\{days\}/g, String(xpDays))
      .replace(/\{title\}/g, storyTitle)
      .replace(/\{when\}/g, settleInfo.when)
      .replace(/\{gain\}/g, String(settleInfo.gain))
      .replace(/\{total\}/g, String(xpTotal))
      .replace(/\{nextHint\}/g, nextHint())
      .replace(/\{xp\}/g, String(todayXp()))
      .replace(/\{stats\}/g, statsText());
  }
  // 提醒时配上身体动作：说话的同时狗有反应（没有对应动画的角色不受影响）
  const SPEAK_ANIM = { tired: ['yawn', 2400], night: ['yawn', 2400], atCap: ['sleepy', 3000], unlock: ['poke', 2400] };
  function speak(type, quiet) {
    const t = lineFor(type);
    if (t) say(t, type === 'settled' || type === 'settledZero' ? 4200 : 2200);
    if (!quiet && SPEAK_ANIM[type]) playState(SPEAK_ANIM[type][0], SPEAK_ANIM[type][1]);
  }

  function restartClass(cls) {
    root.classList.remove('xpet-jump', 'xpet-nudge');
    void root.offsetWidth; // 重启动画
    root.classList.add(cls);
  }
  root.addEventListener('animationend', (e) => {
    if (e.animationName === 'xpet-jump') root.classList.remove('xpet-jump');
    if (e.animationName === 'xpet-nudge') root.classList.remove('xpet-nudge');
  });

  // 点一下宠物：不让用户选，按当前状态直接说（深夜 > 到上限 > 接近上限 > 刚开始 > 平时）
  function clickType() {
    const r = settings.reminders, hi = settings.goal.maxMinutes;
    const mins = Math.floor(totalSeconds() / 60);
    if (r.night && XPET.inWindow(new Date().getHours(), r.nightStart, r.nightEnd)) return 'night';
    if (r.cap && hi > 0) {
      if (mins >= hi) return todayXp() >= settings.goal.baseXp ? 'atCap' : 'tired'; // 超过上限、经验已经在递减时，不再说「满额」
      if (mins >= hi * 0.8) return 'nearCap';
    }
    return mins < 3 ? 'clickEarly' : 'click';
  }

  // 气泡啵啵微音效（纯原生 Web Audio API，无需外部音频资源）
  let audioCtx = null;
  function playPopSound() {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      const now = audioCtx.currentTime;
      osc.frequency.setValueAtTime(460, now);
      osc.frequency.exponentialRampToValueAtTime(820, now + 0.08);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.08);
    } catch (e) {}
  }

  function poke() {
    if (dead) { say('扩展已更新，请刷新页面（F5）', 5000); return; }
    if (settings.appearance && settings.appearance.sound) playPopSound();
    restartClass('xpet-jump');
    const c = activeChar();
    const sp = XPET.spriteFor(c, 'poke');
    const pokeMs = sp && sp.meta ? Math.round((sp.meta.frames / sp.meta.fps) * 1000) : 1380;
    playState('poke', pokeMs);
    const ct = clickType();
    const murmurs = settings.stories.enabled ? XPET.STORIES.filter((s) => s.need <= xpTotal) : [];
    if (ct === 'click' && murmurs.length && Math.random() < 0.3) say(pickLine(murmurs).murmur, 3200); // 平时点一下，偶尔说一句解锁过的碎碎念
    else speak(ct, true);
    if (settings.chipMode === 'click') showChipFor(4000); // 点击显示统计
  }

  // ---------- 拖动（区分点击与拖动） ----------
  let startX, startY, offX, offY, moved = false, dragging = false;

  root.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    closeMenu();
    dragging = true;
    moved = false;
    startX = e.clientX;
    startY = e.clientY;
    const r = root.getBoundingClientRect();
    offX = e.clientX - r.left;
    offY = e.clientY - r.top;
    root.setPointerCapture(e.pointerId);
    e.preventDefault();
    e.stopPropagation();
  });
  root.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    if (!moved && Math.hypot(e.clientX - startX, e.clientY - startY) > 4) {
      moved = true;
      root.classList.add('xpet-dragging');
    }
    if (moved) place(e.clientX - offX, e.clientY - offY);
  });
  const endDrag = (e) => {
    if (!dragging) return;
    dragging = false;
    root.classList.remove('xpet-dragging');
    try { root.releasePointerCapture(e.pointerId); } catch (_) {}
    if (moved) {
      const r = root.getBoundingClientRect();
      savePos({ x: r.left, y: r.top });
    } else {
      poke();
    }
  };
  root.addEventListener('pointerup', endDrag);
  root.addEventListener('pointercancel', endDrag);

  // ---------- 右键菜单：切换角色 / 今日统计 / 设置 ----------
  let menu = null;
  function closeMenu() {
    if (menu) { menu.remove(); menu = null; }
  }
  function addItem(parent, text, onClick, cls) {
    const el = document.createElement('div');
    el.className = 'xpet-menu-item' + (cls ? ' ' + cls : '');
    el.textContent = text;
    if (onClick) el.addEventListener('click', (e) => { e.stopPropagation(); closeMenu(); onClick(); });
    parent.appendChild(el);
    return el;
  }

  root.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    e.stopPropagation();
    closeMenu();
    menu = document.createElement('div');
    menu.id = 'xpet-menu';
    addItem(menu, '切换角色', null, 'xpet-menu-title');
    chars.forEach((c) => {
      addItem(menu, (c.id === activeId ? '✓ ' : '　') + c.name, () => {
        try { chrome.storage.local.set({ [XPET.KEYS.active]: c.id }); } catch (_) {}
      });
    });
    addItem(menu, '今日小结', openSummary, 'xpet-menu-sep');
    addItem(menu, '今日统计', () => showChipFor(5000));
    addItem(menu, '暂时隐藏 (Alt+P)', toggleHide);
    addItem(menu, '设置 / 添加角色…', () => {
      try { chrome.runtime.sendMessage({ type: 'openOptions' }); } catch (_) {}
    });
    document.body.appendChild(menu);
    const mw = menu.offsetWidth, mh = menu.offsetHeight;
    menu.style.left = Math.max(MARGIN, Math.min(e.clientX, window.innerWidth - mw - MARGIN)) + 'px';
    menu.style.top = Math.max(MARGIN, Math.min(e.clientY, window.innerHeight - mh - MARGIN)) + 'px';
  });

  let isHiddenByHotkey = false;
  function toggleHide() {
    isHiddenByHotkey = !isHiddenByHotkey;
    updateSiteVisibility();
    closeMenu();
    closeSummary();
    if (!isHiddenByHotkey && checkSiteAllowed(settings)) say('我回来啦～', 1800);
  }

  document.addEventListener('keydown', (e) => {
    if (e.altKey && (e.key === 'p' || e.key === 'P')) {
      if (settings.appearance && settings.appearance.hotkey !== false) {
        e.preventDefault();
        toggleHide();
      }
    }
  });

  document.addEventListener('pointerdown', (e) => {
    if (menu && !menu.contains(e.target)) closeMenu();
  }, true);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); }, true);
  window.addEventListener('blur', closeMenu);

  // =====================================================
  // 统计：按天保存历史（发推、点赞、收藏、转发、关注、在线时长、滚动距离）
  // 所有依赖 X 页面结构的选择器都集中在这里，X 改版失效时只改这一处
  // =====================================================
  const SELECTORS = {
    sendButton: '[data-testid="tweetButton"], [data-testid="tweetButtonInline"]',
    composerBox: '[data-testid^="tweetTextarea"]',
    like: '[data-testid="like"]',
    bookmark: '[data-testid="bookmark"]',
    repostConfirm: '[data-testid="retweetConfirm"]',
    follow: '[data-testid$="-follow"]',
  };
  const LABELS = { post: '发', like: '赞', bookmark: '藏', repost: '转', follow: '关注' };
  const OLD_KEY = 'xpetCount'; // 旧版只存"今天"的计数，首次运行时迁移进历史
  const emptyDay = () => ({ post: 0, like: 0, bookmark: 0, repost: 0, follow: 0, seconds: 0, scroll: 0 });

  const todayStr = () => {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  };

  let hist = {};                 // 本地缓存，仅用于显示
  let counts = emptyDay();       // 今天的数据
  let trackedDate = todayStr();
  let pendingSec = 0;            // 还没写入存储的在线秒数
  let pendingScroll = 0;         // 还没写入存储的滚动像素
  const totalSeconds = () => (counts.seconds || 0) + pendingSec;

  // 读改写：每次都从存储读出最新数据再修改，多个标签页同时开着也不会互相覆盖
  let writeChain = Promise.resolve();
  function updateHistory(mutator) {
    const p = writeChain.then(() => doUpdate(mutator)); // 排队执行，避免两次写入互相覆盖
    writeChain = p.catch(() => {});
    p.then(refreshChip);
    return p;
  }
  function doUpdate(mutator) {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get([XPET.HIST_KEY, OLD_KEY], (res) => {
          const h = (res && res[XPET.HIST_KEY]) || {};
          const old = res && res[OLD_KEY];
          if (old && old.date && !h[old.date]) {
            h[old.date] = { ...emptyDay(), ...old, post: old.post != null ? old.post : old.n || 0 };
            delete h[old.date].n;
            delete h[old.date].date;
          }
          const d = todayStr();
          h[d] = { ...emptyDay(), ...(h[d] || {}) };
          mutator(h[d]);
          const keys = Object.keys(h).sort();
          while (keys.length > XPET.KEEP_DAYS) delete h[keys.shift()];
          const toSet = { [XPET.HIST_KEY]: h };
          chrome.storage.local.set(toSet, () => {
            if (old) chrome.storage.local.remove(OLD_KEY);
            hist = h;
            counts = h[d];
            resolve(counts);
          });
        });
      } catch (e) { resolve(counts); }
    });
  }

  // 运行状态：写入存储，设置页的"诊断"区域会读取，用来判断脚本有没有在推特页面上正常运行
  function setStatus(patch) {
    try {
      chrome.storage.local.get(XPET.STATUS_KEY, (r) => {
        chrome.storage.local.set({ [XPET.STATUS_KEY]: { ...((r && r[XPET.STATUS_KEY]) || {}), ...patch } });
      });
    } catch (e) {}
  }
  try {
    setStatus({ version: chrome.runtime.getManifest().version, loadedAt: Date.now(), page: location.pathname });
  } catch (e) {}

  function statsText() { return chipText(); }
  // 启动时读一次历史（顺便完成旧版数据迁移）
  updateHistory(() => {}).then(() => { historyLoaded = true; });

  // ---------- 交互计数 ----------
  const lastAt = {};
  function bump(type) {
    const now = Date.now();
    const gap = type === 'post' ? 1500 : 400;
    if (lastAt[type] && now - lastAt[type] < gap) return;
    lastAt[type] = now;
    setStatus({ lastAction: type, lastActionAt: Date.now() });
    updateHistory((d) => { d[type] += 1; }).then(() => {
      restartClass(type === 'post' ? 'xpet-jump' : 'xpet-nudge');
      speak(type);
    });
  }

  // 智能多平台动作识别（兼容 X / Twitter、币安广场、OK星球）
  function matchAction(target) {
    if (!target || !target.closest) return null;
    const btn = target.closest('button, [role="button"], a, input[type="submit"]');
    if (!btn) return null;

    // 1. X / Twitter 专用 data-testid
    if (btn.matches(SELECTORS.sendButton)) {
      if (btn.disabled || btn.getAttribute('aria-disabled') === 'true') return null;
      return 'post';
    }
    if (btn.matches(SELECTORS.like)) return 'like';
    if (btn.matches(SELECTORS.bookmark)) return 'bookmark';
    if (btn.matches(SELECTORS.repostConfirm)) return 'repost';
    if (btn.matches(SELECTORS.follow)) return 'follow';

    // 2. 币安广场 / OK星球 通用文本与属性特征识别
    const aria = ((btn.getAttribute('aria-label') || '') + ' ' + (btn.getAttribute('title') || '') + ' ' + (btn.getAttribute('data-testid') || '')).toLowerCase();
    const text = (btn.innerText || btn.textContent || '').trim();

    // 发帖 / 发送 / Post / Publish
    if (/^(发布|发帖|发表|发送|post|publish|tweet)$/i.test(text) || /\b(post-button|publish-btn|send-btn)\b/i.test(aria)) {
      if (btn.disabled || btn.getAttribute('aria-disabled') === 'true') return null;
      return 'post';
    }
    // 关注 / Follow
    if (/^(\+?\s*关注|\+?\s*follow)$/i.test(text) || /\bfollow-btn\b/i.test(aria)) {
      return 'follow';
    }
    // 点赞 / Like
    if (/^(赞|点赞|like|likes)$/i.test(text) || /\b(like|favorite|thumb-up|heart)\b/i.test(aria)) {
      return 'like';
    }
    // 收藏 / Bookmark / Collect
    if (/^(收藏|bookmark|favorite)$/i.test(text) || /\b(bookmark|collect)\b/i.test(aria)) {
      return 'bookmark';
    }
    // 转发 / 分享 / Repost / Share
    if (/^(转发|分享|repost|share)$/i.test(text) || /\b(repost|share|retweet)\b/i.test(aria)) {
      return 'repost';
    }

    return null;
  }

  document.addEventListener('click', (e) => {
    if (!checkSiteAllowed(settings)) return;
    const t = e.target;
    if (!t) return;
    const act = matchAction(t);
    if (act) return bump(act);

    // 没匹配上，但按钮的 data-testid 看起来像互动按钮：记录下来
    let node = t;
    for (let i = 0; i < 6 && node && node.getAttribute; i++, node = node.parentElement) {
      const id = node.getAttribute('data-testid');
      if (id && /like|bookmark|retweet|repost|follow/i.test(id)
          && !/^(like|bookmark|retweetConfirm|unlike|unretweet|removeBookmark)$/.test(id) && !/-(un)?follow$/.test(id)) {
        setStatus({ unmatchedTestid: id, unmatchedAt: Date.now() });
        break;
      }
    }
  }, true);

  document.addEventListener('keydown', (e) => {
    if (!checkSiteAllowed(settings)) return;
    if (!(e.ctrlKey || e.metaKey) || e.key !== 'Enter') return;
    const box = e.target.closest && e.target.closest(SELECTORS.composerBox + ', textarea, [contenteditable="true"]');
    if (!box || !box.textContent.trim()) return;
    bump('post');
  }, true);

  // ---------- 在线时长与滚动距离 ----------
  // 只在以下条件同时满足时计时：页面属于允许站点、页面可见、窗口有焦点、最近 60 秒内有操作
  let lastActive = Date.now();
  ['mousemove', 'keydown', 'click', 'wheel', 'touchstart'].forEach((ev) =>
    window.addEventListener(ev, () => { if (checkSiteAllowed(settings)) lastActive = Date.now(); }, { passive: true, capture: true })
  );

  let lastY = window.scrollY;
  window.addEventListener('scroll', () => {
    if (!checkSiteAllowed(settings)) return;
    const y = window.scrollY;
    const d = Math.abs(y - lastY);
    lastY = y;
    // 页面切换导致的瞬间大跳转不算滚动
    if (d < 4000 && document.visibilityState === 'visible') pendingScroll += d;
  }, { passive: true });

  function flush() {
    const s = Math.floor(pendingSec);
    const p = Math.round(pendingScroll);
    if (s < 1 && p < 1) return;
    pendingSec -= s;
    pendingScroll = 0;
    updateHistory((d) => { d.seconds += s; d.scroll += p; });
  }

  let lastTick = Date.now();
  let lastTiredBlock = 0;
  let tiredBaseline = null;
  let historyLoaded = false;
  let lastNightAt = 0;

  // 接近每日上限：到上限的 80% 说一句，到达上限再说一句（每天各一次；重新打开页面时已经过了的不补发）
  let capBase = null; // { near: bool, at: bool }
  function checkCap() {
    const max = settings.goal.maxMinutes;
    if (!settings.reminders.cap || !(max > 0)) { capBase = null; return; }
    const mins = totalSeconds() / 60;
    const now = { near: mins >= max * 0.8, at: mins >= max };
    if (capBase === null) { capBase = now; return; }
    if (now.at && !capBase.at) speak('atCap');
    else if (now.near && !capBase.near) speak('nearCap');
    capBase = now;
  }

  const tickTimer = setInterval(() => {
    if (!extAlive()) { handleDead(); return; }
    const now = Date.now();
    const dt = Math.min((now - lastTick) / 1000, 10); // 电脑休眠后醒来不会一次性算很多秒
    lastTick = now;

    // 跨天：从新的一天重新开始
    const today = todayStr();
    if (today !== trackedDate) {
      flush();
      trackedDate = today;
      counts = emptyDay();
      pendingSec = 0;
      pendingScroll = 0;
      lastTiredBlock = 0;
      tiredBaseline = null;
      capBase = null;
      settleXp(); // 新的一天开始，结算前一天的经验
    }

    const active = document.visibilityState === 'visible' && document.hasFocus() && now - lastActive < 60000;
    if (active) pendingSec += dt;

    if (settingsLoaded) trackBack(now, active);
    if (active && historyLoaded && settingsLoaded) {
      const r = settings.reminders;
      const block = Math.floor(totalSeconds() / (r.tiredMinutes * 60));
      if (tiredBaseline === null) {
        tiredBaseline = block; // 以当前时长为起点，重新打开页面不会补发提醒
        lastTiredBlock = block;
      } else if (block > lastTiredBlock) {
        lastTiredBlock = block;
        if (r.tired) speak('tired');
      }
      const hour = new Date().getHours();
      if (r.night && XPET.inWindow(hour, r.nightStart, r.nightEnd) && now - lastNightAt > 45 * 60 * 1000) {
        lastNightAt = now;
        speak('night');
      }
      checkCap();
      checkGreeting(now);
    }
    updatePose(active);

    refreshChip();
    if (pendingSec >= 15 || pendingScroll >= 3000) flush();
  }, 5000);

  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
  window.addEventListener('pagehide', flush);

  // =====================================================
  // 通用读改写（时段问候等使用）
  // =====================================================
  // 和历史数据共用同一个写入队列，避免互相覆盖
  function updateKey(key, fallback, mutator) {
    const p = writeChain.then(() => new Promise((resolve) => {
      try {
        chrome.storage.local.get(key, (r) => {
          const cur = r && r[key] !== undefined ? r[key] : fallback();
          const out = mutator(cur);
          const val = out === undefined ? cur : out;
          chrome.storage.local.set({ [key]: val }, () => resolve(val));
        });
      } catch (e) { resolve(null); }
    }));
    writeChain = p.catch(() => {});
    return p;
  }

  // ---------- 时段问候：每个时段每天第一次在线时说一句（跨标签页只说一次） ----------
  let greetChecked = ''; // 本页面已处理过的 日期+节日+时段，避免每 5 秒读一次存储
  const pickLine = (arr) => arr[Math.floor(Math.random() * arr.length)];
  // 每天第一次在线：节日/纪念日优先，其次是当前时段的问候；节日当天会把当前时段一并标记为已问候，避免连说两句
  function checkGreeting(now) {
    const g = settings.greeting;
    const hour = new Date().getHours();
    const slot = g && g.enabled ? g.slots.find((s) => s.lines.length && XPET.inWindow(hour, s.start, s.end)) : null;
    const hd = settings.holidays;
    const hol = hd && hd.enabled ? XPET.holidayFor(new Date(), hd.items) : null;
    if (!slot && !hol) return;
    const today = todayStr();
    const holKey = hol ? 'h:' + hol.id : '';
    const mark = today + holKey + (slot ? slot.id : '');
    if (greetChecked === mark) return;
    greetChecked = mark;
    let line = '';
    updateKey(XPET.GREET_KEY, () => ({}), (r) => {
      const rec = r && r.date === today && Array.isArray(r.done) ? r : { date: today, done: [] };
      const done = rec.done.slice();
      if (hol && !done.includes(holKey)) {
        line = pickLine(hol.lines);
        done.push(holKey);
        if (slot && !done.includes(slot.id)) done.push(slot.id);
      } else if (slot && !done.includes(slot.id)) {
        line = pickLine(slot.lines);
        done.push(slot.id);
      } else return rec;
      return { date: today, done };
    }).then(() => { if (line) say(line, 3000); });
  }

  // ---------- 回来了：同一天内离开一阵（默认 90 分钟）再回来，说一句 ----------
  let wasActive = false, lastSeenWrite = 0;
  function trackBack(now, active) {
    if (!active) { wasActive = false; return; }
    if (!wasActive) { // 从"不在"变成"在"（含刚打开页面）
      wasActive = true;
      lastSeenWrite = now;
      try {
        chrome.storage.local.get(XPET.SEEN_KEY, (r) => {
          const seen = r && r[XPET.SEEN_KEY];
          const b = settings.back;
          // 只在"同一天"内的离开才算；跨天回来由到账通知和时段问候负责
          if (b && b.enabled && typeof seen === 'number' && now - seen >= b.minutes * 60000 && dayStr(new Date(seen)) === todayStr()) {
            setTimeout(() => speak('back'), 3500); // 错开可能同时出现的时段问候
          }
          chrome.storage.local.set({ [XPET.SEEN_KEY]: now });
        });
      } catch (e) {}
    } else if (now - lastSeenWrite > 60000) {
      lastSeenWrite = now;
      try { chrome.storage.local.set({ [XPET.SEEN_KEY]: now }); } catch (e) {}
    }
  }

  // =====================================================
  // 经验：每天结算一次，自动累积，不需要领取；达到门槛自动解锁装扮
  // =====================================================
  let unlockName = '';
  let settleInfo = { when: '昨天', gain: 0 }; // 最近一次结算到账的信息，给「昨日到账」台词用
  function nextHint() {
    const next = XPET.ACCESSORIES.find((a) => a.need > xpTotal);
    return next ? `${next.icon}${next.name} 还差 ${next.need - xpTotal}` : '装备都集齐啦';
  }
  const dayStr = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const todayXp = () => XPET.calcXp(Math.floor(totalSeconds() / 60), settings.goal);

  try {
    chrome.storage.local.get(XPET.XP_KEY, (r) => {
      xpTotal = (r && r[XPET.XP_KEY] && r[XPET.XP_KEY].total) || 0;
      xpDays = (r && r[XPET.XP_KEY] && r[XPET.XP_KEY].daysTotal) || 0;
      renderChar();
    });
  } catch (e) {}

  // 结算所有"已过去、还没结算"的日子。幂等：多个标签页同时执行，结果一样。
  // 总经验由结算记录求和得出，而不是在旧值上累加，所以不会重复计算。
  function settleXp() {
    const p = writeChain.then(() => new Promise((resolve) => {
      try {
        chrome.storage.local.get([XPET.HIST_KEY, XPET.XP_KEY, XPET.SETTINGS_KEY], (r) => {
          const h = (r && r[XPET.HIST_KEY]) || {};
          const xp = (r && r[XPET.XP_KEY]) || {};
          const settled = xp.settled || {};
          const before = new Set(Object.keys(settled));
          const announced = Array.isArray(xp.announced) ? xp.announced.slice() : [];
          const goal = XPET.mergeSettings(r && r[XPET.SETTINGS_KEY]).goal;
          const today = todayStr();

          Object.keys(h).sort().forEach((d) => {
            if (d >= today || settled[d]) return;
            const secs = h[d].seconds || 0;
            if (secs < 60) return; // 基本没用，不结算
            const mins = Math.round(secs / 60);
            settled[d] = { min: mins, xp: XPET.calcXp(mins, goal) };
          });
          const keep = Object.keys(settled).sort().slice(-400);
          const trimmed = {};
          keep.forEach((d) => { trimmed[d] = settled[d]; });

          const total = keep.reduce((a, d) => a + (trimmed[d].xp || 0), 0);
          const fresh0 = Object.keys(trimmed).filter((d) => !before.has(d));
          let daysTotal = Number.isFinite(xp.daysTotal) ? xp.daysTotal : before.size; // 累计陪伴天数：只增不减，不受 400 天保留期限制
          daysTotal += fresh0.length;
          const prevMs = Array.isArray(xp.milestones) ? xp.milestones.slice() : XPET.MILESTONE_DAYS.filter((m) => m <= daysTotal - fresh0.length);
          const newMs = XPET.MILESTONE_DAYS.filter((m) => m <= daysTotal && !prevMs.includes(m));
          const storyAnn = Array.isArray(xp.stories) ? xp.stories.slice() : [];
          const newStories = XPET.STORIES.filter((s) => s.need <= total && !storyAnn.includes(s.id));
          newStories.forEach((s) => storyAnn.push(s.id));
          const newly = XPET.ACCESSORIES.filter((a) => a.need > 0 && a.need <= total && !announced.includes(a.id));
          newly.forEach((a) => announced.push(a.id));

          chrome.storage.local.set({ [XPET.XP_KEY]: { settled: trimmed, announced, total, milestones: prevMs.concat(newMs), stories: storyAnn, daysTotal } }, () => {
            const fresh = Object.keys(trimmed).filter((d) => !before.has(d)).sort();
            resolve({ total, name: newly.length ? newly[newly.length - 1].name : '', fresh: fresh.map((d) => ({ d, xp: trimmed[d].xp || 0 })), days: daysTotal, milestone: newMs.length, story: newStories.length ? newStories[newStories.length - 1].title : '' });
          });
        });
      } catch (e) { resolve(null); }
    }));
    writeChain = p.catch(() => {});
    p.then((res) => {
      if (!res) return;
      xpTotal = res.total;
      xpDays = res.days || 0;
      renderChar();
      let delay = 1500;
      if (res.fresh && res.fresh.length) { // 昨日到账：刚结算了新的日子，告诉用户到账了多少
        const gain = res.fresh.reduce((a, f) => a + f.xp, 0);
        const y = new Date(); y.setDate(y.getDate() - 1);
        const only = res.fresh.length === 1 ? res.fresh[0].d : '';
        settleInfo = { gain, when: only ? (only === dayStr(y) ? '昨天' : only.slice(5).replace('-', '月') + '日') : `这 ${res.fresh.length} 天` };
        setTimeout(() => speak(gain > 0 ? 'settled' : 'settledZero'), delay);
        delay += 4800; // 到账提示说完再说解锁
      }
      if (res.milestone && settings.milestone) { // 陪伴天数里程碑
        setTimeout(() => speak('milestone'), delay);
        delay += 4800;
      }
      if (res.name) {
        unlockName = res.name; // 一次登录补上多件时，只提一次最新的
        setTimeout(() => speak('unlock'), delay);
        delay += 4800;
      }
      if (res.story && settings.stories.enabled) { // 小本子写了新的一页（一次补上多页时，只提最新的）
        storyTitle = res.story;
        setTimeout(() => speak('story'), delay);
      }
    });
    return p;
  }
  setTimeout(settleXp, 2500); // 启动时补结算之前的日子

  // =====================================================
  // 今日小结：只在你点开时显示，语气永远是肯定的
  // =====================================================
  let summaryEl = null;
  let summaryTimer = null;
  function closeSummary() {
    clearTimeout(summaryTimer);
    if (summaryEl) { summaryEl.remove(); summaryEl = null; }
  }
  document.addEventListener('pointerdown', (e) => {
    if (summaryEl && !summaryEl.contains(e.target) && !root.contains(e.target)) closeSummary();
  }, true);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSummary(); }, true);

  function openSummary() {
    closeSummary();
    try {
      chrome.storage.local.get(XPET.XP_KEY, (r) => buildSummary((r && r[XPET.XP_KEY]) || {}));
    } catch (e) { buildSummary({}); }
  }

  function buildSummary(xpRec) {
    const goal = settings.goal;
    const mins = Math.floor(totalSeconds() / 60);
    const lo = goal.minMinutes, hi = goal.maxMinutes;
    const over = hi > 0 && mins > hi;
    const under = lo > 0 && mins < lo;

    const rows = [];
    rows.push(['在线', XPET.fmtDur(mins) + (hi > 0 ? `（你设的范围：${lo}–${hi} 分钟）` : lo > 0 ? `（你设的下限：${lo} 分钟）` : '')]);
    rows.push(['状态', over ? `比上限多了 ${mins - hi} 分钟，没关系` : under ? `还没到下限 ${lo} 分钟` : '在你设的范围内']);
    const did = [];
    if (counts.post) did.push(`发推/回复 ${counts.post} 条`);
    if (counts.bookmark) did.push(`收藏 ${counts.bookmark} 条`);
    if (counts.like) did.push(`点赞 ${counts.like} 次`);
    if (counts.repost) did.push(`转发 ${counts.repost} 次`);
    if (counts.follow) did.push(`关注 ${counts.follow} 个`);
    rows.push(['做了', did.length ? did.join('，') : '安安静静地看了看']);

    const next = XPET.ACCESSORIES.find((a) => a.need > xpTotal);
    rows.push(['经验', `今天预计 +${todayXp()}（今晚自动结算）· 累计 ${xpTotal}` + (next ? ` · 下一件装备 ${next.icon}${next.name} 还差 ${next.need - xpTotal}` : '')]);

    summaryEl = document.createElement('div');
    summaryEl.id = 'xpet-summary';
    const title = document.createElement('div');
    title.className = 'xpet-sum-title';
    title.textContent = '今日小结';
    summaryEl.appendChild(title);
    rows.forEach(([k, v]) => {
      const row = document.createElement('div');
      row.className = 'xpet-sum-row';
      const kk = document.createElement('span'); kk.className = 'xpet-sum-k'; kk.textContent = k;
      const vv = document.createElement('span'); vv.textContent = v;
      row.appendChild(kk); row.appendChild(vv);
      summaryEl.appendChild(row);
    });
    const line = lineFor(over ? 'summaryOver' : 'summaryOk');
    if (line) {
      const foot = document.createElement('div');
      foot.className = 'xpet-sum-foot';
      foot.textContent = line;
      summaryEl.appendChild(foot);
    }
    document.body.appendChild(summaryEl);

    const r = root.getBoundingClientRect();
    const w = summaryEl.offsetWidth || 260, h = summaryEl.offsetHeight || 150;
    const left = Math.max(MARGIN, Math.min(r.left + r.width / 2 - w / 2, window.innerWidth - w - MARGIN));
    const top = r.top - h - 40 > MARGIN ? r.top - h - 40 : Math.min(r.bottom + 34, window.innerHeight - h - MARGIN);
    summaryEl.style.left = left + 'px';
    summaryEl.style.top = Math.max(MARGIN, top) + 'px';
    summaryTimer = setTimeout(closeSummary, 20000); // 不用管它，20 秒后自己收起
  }

  // =====================================================
  // 扩展更新后，页面里旧的脚本会失去和扩展的连接：提示用户刷新页面
  // =====================================================
  let dead = false;
  const extAlive = () => { try { return !!(chrome.runtime && chrome.runtime.id); } catch (e) { return false; } };
  function handleDead() {
    if (dead) return;
    dead = true;
    clearInterval(tickTimer);
    chip.style.display = 'none';
    closeSummary();
    say('扩展已更新，请刷新页面（F5）', 600000);
  }

  reloadSettings();
})();
