(() => {
  // 防止重复注入
  if (document.getElementById('xpet-root')) return;

  const BASE_W = 72, BASE_H = 64, MARGIN = 8;
  // 手绘背景几何配置（用户根据视觉手调定案）：
  // 边长按 1.15W 放大并向左上微移（左移 11%W，上移 18%H），使手绘圆形窗景自然衬托在头部与笔记本后方。
  // 注意：背景圆会超出根框（特大档顶部多出约 63px、左侧约 40px），贴近屏幕边缘时会被裁剪，当前方案已知且保持此设计。
  const SCENE_SIDE_RATIO = 1.15;
  const SCENE_DX_RATIO = -0.11; // 往左平移 11% W
  const SCENE_DY_RATIO = -0.18; // 往上平移 18% H
  let W = BASE_W, H = BASE_H; // 随角色的「显示大小」变化
  const POS_KEY = 'xpetPos';

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
  root.innerHTML = '<div class="xpet-scene" aria-hidden="true"><img draggable="false" decoding="async"></div><div class="xpet-bubble"></div><div class="xpet-body"></div><div class="xpet-chip"></div>';
  document.body.appendChild(root);
  const sceneEl = root.querySelector('.xpet-scene');
  const sceneImg = sceneEl ? sceneEl.querySelector('img') : null;
  const bubble = root.querySelector('.xpet-bubble');
  const body = root.querySelector('.xpet-body');
  const chip = root.querySelector('.xpet-chip');

  // ---------- 角色 ----------
  let chars = XPET.defaultChars();
  let activeId = chars[0].id;
  const activeChar = () => chars.find((c) => c.id === activeId) || chars[0];

  let xpDays = 0; // 累计陪伴天数（有记录的天数，累计不是连续）；装扮和日记都按它解锁
  let storyTitle = ''; // 最近解锁的日记标题，给「写了新的一页」台词用
  // 从「陪伴记录」里读累计天数；老数据没有 daysTotal 字段时，用已结算的天数代替
  const daysOf = (rec) => (rec && Number.isFinite(rec.daysTotal) ? rec.daysTotal : rec && rec.settled ? Object.keys(rec.settled).length : 0);

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
    curPoseKey = active ? 'busy' : 'idle'; // 深夜不再常驻「打哈欠」循环（整晚循环太吵）：哈欠只在 maybeYawn 里偶尔演一次
    applySprite();
  }

  // 深夜窗口内：每隔 YAWN_EVERY_MS 最多打一次哈欠（只演一遍动画，不说话）。与「深夜台词」共用计时，不会前后脚连着演。「今天安静」只保留动画，所以不受它影响
  let lastYawnAt = 0;
  const YAWN_EVERY_MS = 20 * 60 * 1000;
  function maybeYawn(now) {
    if (now - Math.max(lastYawnAt, lastNightAt) < YAWN_EVERY_MS) return;
    if (now < forceUntil || document.visibilityState !== 'visible' || !petVisible()) return;
    let ms = 2400; // 小桌宠是静态图（stretching），停 2.4 秒；精灵图角色按动画时长演一遍
    if (!chabitEl) {
      const sp = XPET.spriteFor(activeChar(), 'yawn');
      if (!sp || !sp.meta) return;
      ms = Math.round((sp.meta.frames / sp.meta.fps) * 1000);
    }
    lastYawnAt = now;
    playState('yawn', ms);
  }

  // ---------- 小桌宠（分层静态图）：状态整图 + 独立眼睛层，眨眼靠换眼睛层 ----------
  // 姿态映射沿用原有判断：在用页面→working；停下来→发呆，停久了→睡着；深夜哈欠→伸懒腰；被点击→喝水
  const CHABIT_STATE = { busy: 'working', sleepy: 'daydreaming', yawn: 'stretching', poke: 'drinking', idle: 'working' };
  const CHABIT_EYE = { x: 380 / 1024, y: 285 / 1024, w: 255 / 1024, h: 100 / 1024 }; // 与 tools/build_pet_assets.py 的 EYE_BBOX 一致
  const CHABIT_SLEEP_AFTER_MS = 5 * 60 * 1000; // 发呆满 5 分钟后趴下睡着
  let chabitEl = null, chabitImg = null, chabitEyeImg = null, chabitState = '', chabitBlinkTimer = null, sleepySince = 0;
  const chabitUrl = (name) => { try { return chrome.runtime.getURL('sprites/chabit/' + name + '.webp'); } catch (e) { return ''; } };
  function chabitFatigue() {
    const h = new Date().getHours();
    if (h < 5) return 'tired'; // 深夜
    if (sleepySince && Date.now() - sleepySince > 60 * 1000) return 'half'; // 停下来一阵子
    return 'normal';
  }
  function chabitSetEyes(kind) {
    if (chabitEyeImg && chabitState === 'working') chabitEyeImg.src = chabitUrl('eye_' + kind);
  }
  function chabitScheduleBlink() {
    clearTimeout(chabitBlinkTimer);
    chabitBlinkTimer = setTimeout(() => {
      if (chabitEl && document.visibilityState === 'visible' && chabitState === 'working') {
        chabitSetEyes('closed');
        setTimeout(() => chabitSetEyes(chabitFatigue()), 150);
      }
      if (chabitEl) chabitScheduleBlink();
    }, 3000 + Math.random() * 3000);
  }
  function stopChabit() {
    clearTimeout(chabitBlinkTimer);
    chabitEl = chabitImg = chabitEyeImg = null;
    chabitState = '';
  }
  function buildChabit() {
    chabitEl = document.createElement('div');
    chabitEl.className = 'xpet-chabit';
    chabitImg = document.createElement('img');
    chabitEyeImg = document.createElement('img');
    chabitEyeImg.className = 'xpet-chabit-eye';
    chabitEyeImg.style.cssText = `left:${CHABIT_EYE.x * 100}%;top:${CHABIT_EYE.y * 100}%;width:${CHABIT_EYE.w * 100}%;height:${CHABIT_EYE.h * 100}%`;
    [chabitImg, chabitEyeImg].forEach((im) => { im.draggable = false; im.alt = ''; });
    chabitEl.appendChild(chabitImg);
    chabitEl.appendChild(chabitEyeImg);
    body.appendChild(chabitEl);
    // 预加载 9 张图，避免第一次换姿态、第一次眨眼时因为图片还没解码而闪一下空白
    ['working', 'daydreaming', 'sleeping', 'stretching', 'drinking', 'eye_normal', 'eye_half', 'eye_tired', 'eye_closed'].forEach((n) => { const im = new Image(); im.src = chabitUrl(n); });
    chabitState = '';
    chabitScheduleBlink();
  }
  function applyChabit() {
    if (!chabitEl) return;
    const want = wantedSpriteState();
    if (want === 'sleepy') { if (!sleepySince) sleepySince = Date.now(); } else sleepySince = 0;
    let st = CHABIT_STATE[want] || 'working';
    if (want === 'sleepy' && Date.now() - sleepySince > CHABIT_SLEEP_AFTER_MS) st = 'sleeping';
    const side = Math.min(W, H * 1.15);
    chabitEl.style.width = chabitEl.style.height = Math.round(side) + 'px';
    chabitEl.classList.toggle('xpet-chabit-sleeping', st === 'sleeping');
    body.classList.add('xpet-has-sprite');
    if (st !== chabitState) {
      chabitState = st;
      chabitImg.src = chabitUrl(st);
      chabitEyeImg.style.display = st === 'working' ? 'block' : 'none'; // 其他姿态自带表情
      if (st === 'working') chabitEyeImg.src = chabitUrl('eye_' + chabitFatigue());
    }
  }
  // 发呆转睡着需要时间推进：每 20 秒复查一次；页面隐藏时不跑
  setInterval(() => { if (chabitEl && document.visibilityState === 'visible') applyChabit(); }, 20000);
  // ---------- 精灵图：按状态播放角色自带的动画；没有对应图片时退回基础图/静态图/内置形象 ----------
  let spriteEl = null, spriteCache = {}, spriteCharId = null, spriteState = null, spriteToken = 0, forceState = '', forceUntil = 0, forceTimer = null;
  const SPRITE_FALLBACK = { poke: ['poke', 'busy', 'idle'], busy: ['busy', 'idle'], sleepy: ['sleepy', 'idle'], yawn: ['yawn', 'sleepy', 'idle'], idle: ['idle'] };
  function wantedSpriteState() {
    if (Date.now() < forceUntil) return forceState;
    if (curPoseKey === 'idle') return 'sleepy';
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
    if (chabitEl) { applyChabit(); return; }
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
    if (sceneEl) {
      const side = Math.round(SCENE_SIDE_RATIO * W);
      sceneEl.style.width = side + 'px';
      sceneEl.style.height = side + 'px';
      sceneEl.style.left = Math.round((W - side) / 2 + SCENE_DX_RATIO * W) + 'px';
      sceneEl.style.top = Math.round((H - side) / 2 + SCENE_DY_RATIO * H) + 'px';
    }
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
    stopChabit();
    if (!c.img && c.look === 'chabit') buildChabit();
    applySize();
    updatePose(lastPoseActive);
    renderGear();
  }

  // ---------- 工位伴侣装备渲染 ----------
  let gearEl = null;
  function renderGear() {
    if (gearEl) { gearEl.remove(); gearEl = null; }
    if (!XPET.ACCESSORIES_ENABLED) return; // 软关闭：上线背景后停用矢量小物
    const c = activeChar();
    const acc = XPET.ACCESSORIES.find((a) => a.id === c.accessory);
    if (!acc || acc.id === 'none' || acc.need > xpDays) return;
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
      // 其他标签页写入了今天的统计：同步到本页，否则三个站分开开着时，切回来看到的是旧数字（统计条、今日小结、上限提醒都用它）
      if (changes[XPET.HIST_KEY]) syncCountsFrom(changes[XPET.HIST_KEY].newValue);
      if (changes[XPET.XP_KEY]) {
        xpDays = daysOf(changes[XPET.XP_KEY].newValue);
        renderChar();
      }
    });
  } catch (e) {}

  // ---------- 位置（按站点独立记忆，旧版全局 xpetPos 作为初始回退） ----------
  const extraBottom = 26; // 给统计条在宠物下方留出空间，避免被屏幕边缘挡住
  const posKeyForSite = () => {
    const sk = XPET.siteKeyOf(location.hostname);
    return sk !== 'other' ? `${POS_KEY}:${sk}` : POS_KEY;
  };
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
    try { chrome.storage.local.set({ [posKeyForSite()]: p, [POS_KEY]: p }); } catch (e) {}
  };

  place(window.innerWidth - W - 24, window.innerHeight - H - 24);
  try {
    const skey = posKeyForSite();
    chrome.storage.local.get([skey, POS_KEY], (res) => {
      const p = (res && res[skey]) || (res && res[POS_KEY]);
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
  // 严格只看网址（hostname + pathname），不读取页面标题或任何内容；金融操作页面与 X 私信/设置页一律不生效
  function checkSiteAllowed(curSettings) {
    const sites = (curSettings && curSettings.sites) || { x: true, binance: true, okx: true };
    return XPET.siteAllowed(location.hostname, location.pathname, sites);
  }

  // 获取当前页面所属站点标识 ('x' | 'binance' | 'okx' | 'other')
  function currentSiteKey() {
    return XPET.siteKeyOf(location.hostname);
  }

  let isHiddenByHotkey = false;
  let allowedNow = true; // 当前页面是否属于生效页面；mousemove/scroll 这类高频事件只读这个缓存，不再每次重新拼字符串判断
  // 判断当前焦点是否在输入框或可编辑区域内（打字时静音，但发文 post 台词除外）
  function isTyping() {
    const a = document.activeElement;
    if (!a || a === document.body) return false;
    const tag = (a.tagName || '').toLowerCase();
    if (tag === 'textarea') return true;
    if (tag === 'input') {
      const t = (a.type || 'text').toLowerCase();
      return !['button', 'checkbox', 'radio', 'range', 'submit', 'reset', 'file', 'image', 'color', 'hidden'].includes(t);
    }
    if (a.isContentEditable) return true;
    if (a.getAttribute && a.getAttribute('role') === 'textbox') return true;
    return false;
  }
  const isQuietToday = () => !!(settings.quietUntil && Date.now() < settings.quietUntil);
  // 宠物现在是否在屏幕上看得见；只有看得见、标签页也在前台、未开启「今天安静」、且未在输入框打字时才主动说话（allowWhileTyping 为 true 时豁免打字检查，用于 Ctrl+Enter 发文）
  const petVisible = () => allowedNow && !isHiddenByHotkey;
  const canSpeak = (allowWhileTyping) => petVisible() && document.visibilityState === 'visible' && !isQuietToday() && (allowWhileTyping || !isTyping());
  function updateSiteVisibility() {
    allowedNow = checkSiteAllowed(settings);
    root.style.display = (allowedNow && !isHiddenByHotkey) ? '' : 'none';
  }

  // 监听 SPA 路由切换（如在币安或OKX从其他页面进入广场）：只检查 location.href，不读取页面标题或内容
  let lastCheckedHref = location.href;
  setInterval(() => {
    const href = location.href;
    if (href !== lastCheckedHref) {
      lastCheckedHref = href;
      updateSiteVisibility();
    }
  }, 500);
  window.addEventListener('popstate', updateSiteVisibility);
  updateSiteVisibility(); // 启动时立即执行一次可见性校验

  // ---------- 背景场景渲染与时段同步 ----------
  let curSceneId = null;
  let sceneToken = 0;
  function applyScene() {
    if (!sceneEl || !sceneImg) return;
    const targetId = XPET.sceneFor(new Date().getHours(), settings.scene);
    if (targetId === curSceneId) return;
    const hadScene = !!curSceneId;
    curSceneId = targetId;
    const token = ++sceneToken;

    // 清理之前的 scene class，色调滤镜随目标场景立即切换（CSS 有 0.4s 渐变）
    Array.from(root.classList).forEach((cls) => {
      if (cls.startsWith('xpet-scene-')) root.classList.remove(cls);
    });
    sceneEl.classList.remove('xpet-scene-active'); // 先淡出旧背景

    // 关闭场景分支：等待淡出完成（260ms）后彻底移除 src 属性
    if (!targetId) {
      setTimeout(() => {
        if (token === sceneToken) sceneImg.removeAttribute('src');
      }, 260);
      return;
    }

    root.classList.add(`xpet-scene-${targetId}`);
    const def = XPET.SCENES.find((s) => s.id === targetId);
    if (!def) return;
    const sceneUrl = chrome.runtime.getURL(`scenes/${def.file}`);

    // 先预加载图片，解码就绪后再进行淡入展示，防白闪和未解码造成的跳变
    const preloader = new Image();
    const show = () => {
      setTimeout(() => {
        if (token !== sceneToken) return;
        sceneImg.src = sceneUrl;
        sceneEl.classList.add('xpet-scene-active');
      }, hadScene ? 260 : 0);
    };
    preloader.onload = show;
    preloader.onerror = () => {}; // 资源不存在或损坏则静默保持无背景
    preloader.src = sceneUrl;
  }

  function applySettings() {
    const op = (settings.appearance && settings.appearance.opacity !== undefined) ? settings.appearance.opacity / 100 : 1;
    root.style.setProperty('--xpet-opacity', String(op));
    updateSiteVisibility();
    refreshChip();
    applyScene();
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
  // 同一时刻只说一句：优先级低的话不会打断还在显示的高优先级的话，直接丢弃（notice 通知走队列重试，不会丢）。
  // user(4) = 用户主动点击宠物；act(3) = 发文/转发/关注/深夜；notice(2) = 问候/纪念/日记/新东西/回来；soft(1) = 点赞/收藏
  const PRIO = { user: 4, act: 3, notice: 2, soft: 1 };
  let bubbleTimer = null, bubblePrio = 0, bubbleUntil = 0;
  function fitBubble() {
    bubble.style.marginLeft = '0px';
    bubble.classList.remove('xpet-bubble-below');
    try {
      const r = bubble.getBoundingClientRect();
      if (!r.width) return;
      let dx = 0;
      if (r.right > window.innerWidth - MARGIN) dx = (window.innerWidth - MARGIN) - r.right;
      if (r.left + dx < MARGIN) dx = MARGIN - r.left;
      if (dx) bubble.style.marginLeft = Math.round(dx) + 'px';
      if (r.top < MARGIN) bubble.classList.add('xpet-bubble-below');
    } catch (e) {}
  }
  function say(text, ms, prio) {
    prio = prio || PRIO.act;
    const now = Date.now();
    if (now < bubbleUntil && prio < bubblePrio) return false;
    const base = (settings.appearance && settings.appearance.bubbleTime) || 2500;
    const dur = ms ? Math.round(ms * (base / 2500)) : base;
    bubble.textContent = text; // 用 textContent，用户自定义台词不会被当成 HTML
    fitBubble();
    bubble.classList.add('xpet-show');
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(() => bubble.classList.remove('xpet-show'), dur);
    bubblePrio = prio;
    bubbleUntil = now + dur;
    return true;
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
      .replace(/\{name\}/g, unlockName)
      .replace(/\{days\}/g, String(xpDays))
      .replace(/\{title\}/g, storyTitle)
      .replace(/\{stats\}/g, statsText())
      .replace(/\{(left|xp|gain|total|when|nextHint)\}/g, ''); // 旧版自定义台词里的经验、上限类占位符已不再支持，直接去掉
  }
  // 说话的同时配上身体动作（没有对应动画的角色不受影响）
  const SPEAK_ANIM = { night: ['yawn', 2400], unlock: ['poke', 2400] };
  function speak(type, quiet, prio) {
    const t = lineFor(type);
    if (!t) return false;
    const ok = say(t, 2200, prio);
    if (ok && !quiet && SPEAK_ANIM[type]) playState(SPEAK_ANIM[type][0], SPEAK_ANIM[type][1]);
    return ok;
  }

  // 行为触发的话不是每次都说：p = 说话概率，cd = 同类冷却（毫秒）。
  // 发文必说（且豁免输入框焦点静音检查，避免 Ctrl+Enter 发文时被吞）；其他行为共用一个 6 秒的间隔，连着点几下只说一句。
  const SPEAK_RULE = {
    post: { p: 1, cd: 0, prio: PRIO.act },
    repost: { p: 0.8, cd: 20000, prio: PRIO.act },
    follow: { p: 0.6, cd: 30000, prio: PRIO.act },
    bookmark: { p: 0.3, cd: 60000, prio: PRIO.soft },
    like: { p: 0.12, cd: 90000, prio: PRIO.soft },
  };
  const TALK_MUL = { quiet: 0.5, normal: 1, chatty: 1.6 };
  const lastSpokeAt = {};
  let lastActSpoke = 0;
  function reactTo(type) {
    const r = SPEAK_RULE[type];
    if (!r || !canSpeak(type === 'post')) return false;
    const mul = TALK_MUL[settings.profile && settings.profile.talk] || 1;
    const now = Date.now();
    if (type !== 'post' && now - lastActSpoke < 6000 / mul) return false;
    if (r.cd && now - (lastSpokeAt[type] || 0) < r.cd / mul) return false;
    if (Math.random() > Math.min(1, r.p * mul)) return false;
    if (!speak(type, false, r.prio)) return false;
    lastSpokeAt[type] = now;
    lastActSpoke = now;
    return true;
  }

  // 通知（问候、纪念、日记、新东西、回来）排队依次说。队列逻辑在 shared.js 的 XPET.createAnnouncer（有自动化测试 tools/test_announcer.js），
  // 这里只负责「怎么说」。队列的约定：
  // 1. 「显示成功后再写已通知（ack）」：只有气泡真正展示出来（或用户清空了该类台词无需展示）时才调用 item.ack() 写入存储；
  //    页面刷新/关闭、开启「今天安静」、或连续冲突放弃时，一次性通知都不会被白白消耗，下次符合条件时仍会触发。
  // 2. 时效性通知（问候、回来）带 expiresAt（5 分钟过期），避免早上入队的问候拖到晚上才冒出来；里程碑、解锁、日记无过期。
  // 3. 触发时 !canSpeak() 则 1.5 秒后重试；因高优先级气泡正在显示导致 say() 返回 false，则放回队首最多重试 5 次。
  const announcer = XPET.createAnnouncer({
    now: () => Date.now(),
    setTimer: (fn, ms) => setTimeout(fn, ms),
    canSpeak: () => canSpeak(),
    bubbleUntil: () => bubbleUntil,
    show: (item) => {
      if (item.prepare) item.prepare();
      if (item.type) {
        if (!lineFor(item.type)) return true; // 该动作台词被用户设为空，视同无需展示并直接确认
        return speak(item.type, false, PRIO.notice);
      }
      if (item.text) return say(item.text, 3000, PRIO.notice);
      return true;
    },
  });
  const enqueueAnnounce = (item) => announcer.enqueue(item);
  const pumpAnnounce = (delayMs) => announcer.pump(delayMs);

  function restartClass(cls) {
    root.classList.remove('xpet-jump', 'xpet-nudge');
    void root.offsetWidth; // 重启动画
    root.classList.add(cls);
  }
  root.addEventListener('animationend', (e) => {
    if (e.animationName === 'xpet-jump') root.classList.remove('xpet-jump');
    if (e.animationName === 'xpet-nudge') root.classList.remove('xpet-nudge');
  });

  // 点一下宠物：深夜说深夜的话；今天刚开始说刚开始的；平时说「我也在……」，优先用当前站点的那组
  function clickType() {
    const r = settings.reminders;
    if (r.night && XPET.inWindow(new Date().getHours(), r.nightStart, r.nightEnd)) return 'night';
    if (Math.floor(totalSeconds() / 60) < 3) return 'clickEarly';
    const pool = { x: 'clickX', binance: 'clickBinance', okx: 'clickOkx' }[currentSiteKey()];
    if (pool && (activeChar().phrases[pool] || []).some((s) => s && s.trim()) && Math.random() < 0.7) return pool;
    return 'click';
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
    if (dead) { say('扩展已更新，请刷新页面（F5）', 5000, PRIO.user); return; }
    if (settings.appearance && settings.appearance.sound) playPopSound();
    restartClass('xpet-jump');
    const c = activeChar();
    const sp = XPET.spriteFor(c, 'poke');
    const pokeMs = sp && sp.meta ? Math.round((sp.meta.frames / sp.meta.fps) * 1000) : 1380;
    playState('poke', pokeMs);
    const ct = clickType();
    const murmurs = settings.stories.enabled ? XPET.STORIES.filter((s) => s.need <= xpDays) : [];
    if (/^click/.test(ct) && ct !== 'clickEarly' && murmurs.length && Math.random() < 0.25) say(pickLine(murmurs).murmur.replace(/\{days\}/g, String(xpDays)), 3200, PRIO.user); // 平时点一下，偶尔说一句已解锁日记里的碎碎念
    else speak(ct, true, PRIO.user);
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
    addItem(menu, (isQuietToday() ? '✓ ' : '') + '今天安静（只保留动画）', toggleQuietToday);

    // 背景场景二级扩展菜单（鼠标悬浮展开）
    const sc = (settings && settings.scene) || { mode: 'off', id: 'rain' };
    const curLabel = sc.mode === 'off' ? '关闭' : sc.mode === 'time' ? '跟随时段' : (XPET.SCENES.find((s) => s.id === sc.id) || {}).label || '手选';

    const sceneMenuParent = document.createElement('div');
    sceneMenuParent.className = 'xpet-menu-item xpet-has-sub';
    sceneMenuParent.innerHTML = `<span>背景场景 (${curLabel})</span><span class="xpet-submenu-arrow">▶</span>`;

    const subMenu = document.createElement('div');
    subMenu.className = 'xpet-submenu';
    addItem(subMenu, (sc.mode === 'off' ? '✓ ' : '　') + '关闭（透明）', () => {
      settings.scene = { ...sc, mode: 'off' };
      XPET.saveSettings(settings);
    });
    addItem(subMenu, (sc.mode === 'time' ? '✓ ' : '　') + '跟随时段（自动）', () => {
      settings.scene = { ...sc, mode: 'time' };
      XPET.saveSettings(settings);
    });
    XPET.SCENES.forEach((s) => {
      const active = sc.mode === 'manual' && sc.id === s.id;
      addItem(subMenu, (active ? '✓ ' : '　') + s.label, () => {
        settings.scene = { mode: 'manual', id: s.id };
        XPET.saveSettings(settings);
      });
    });
    sceneMenuParent.appendChild(subMenu);

    // 悬停定位：动态实测子菜单高宽，自动纠正垂直与水平方向溢出
    sceneMenuParent.addEventListener('mouseenter', () => {
      subMenu.style.top = '-4px';
      subMenu.style.maxHeight = '';
      subMenu.style.overflowY = '';
      subMenu.classList.remove('xpet-submenu-flip');

      const rect = subMenu.getBoundingClientRect();
      if (!rect.width || !rect.height) return;

      // 1. 水平方向检测：右边超出视口则向左翻转
      if (rect.right > window.innerWidth - MARGIN) {
        subMenu.classList.add('xpet-submenu-flip');
      }

      // 2. 垂直方向检测：下方超出视口则上移，必要时限制最大高度并加滚动
      const overflowBottom = rect.bottom - (window.innerHeight - MARGIN);
      if (overflowBottom > 0) {
        let newTop = -4 - overflowBottom;
        const parentRect = sceneMenuParent.getBoundingClientRect();
        // 如果上移后子菜单顶部超出屏幕顶部，贴住屏幕上沿并限制最大高度
        if (parentRect.top + newTop < MARGIN) {
          newTop = MARGIN - parentRect.top;
          subMenu.style.maxHeight = Math.max(120, window.innerHeight - 2 * MARGIN) + 'px';
          subMenu.style.overflowY = 'auto';
        }
        subMenu.style.top = Math.round(newTop) + 'px';
      }
    });

    menu.appendChild(sceneMenuParent);

    addItem(menu, '暂时隐藏 (Alt+P)', toggleHide, 'xpet-menu-sep');
    addItem(menu, '设置 / 添加角色…', () => {
      try { chrome.runtime.sendMessage({ type: 'openOptions' }); } catch (_) {}
    });
    document.body.appendChild(menu);
    const mw = menu.offsetWidth, mh = menu.offsetHeight;
    const posX = Math.max(MARGIN, Math.min(e.clientX, window.innerWidth - mw - MARGIN));
    const posY = Math.max(MARGIN, Math.min(e.clientY, window.innerHeight - mh - MARGIN));
    menu.style.left = posX + 'px';
    menu.style.top = posY + 'px';
  });

  function toggleQuietToday() {
    if (isQuietToday()) {
      settings.quietUntil = 0;
      XPET.saveSettings(settings);
      say('嗯，恢复说话了', 1800, PRIO.user);
      pumpAnnounce(600);
    } else {
      const end = new Date();
      end.setHours(24, 0, 0, 0);
      settings.quietUntil = end.getTime();
      XPET.saveSettings(settings);
      say('好，今天安静陪着', 1800, PRIO.user);
    }
  }

  function toggleHide() {
    isHiddenByHotkey = !isHiddenByHotkey;
    updateSiteVisibility();
    closeMenu();
    closeSummary();
    if (!isHiddenByHotkey && checkSiteAllowed(settings)) say('我回来啦～', 1800, PRIO.user);
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
  const OLD_KEY = 'xpetCount'; // 旧版只存"今天"的计数，首次运行时迁移进历史
  const emptySite = () => ({ post: 0, like: 0, bookmark: 0, repost: 0, follow: 0, seconds: 0, scroll: 0 });
  const emptyDay = () => ({
    post: 0,
    like: 0,
    bookmark: 0,
    repost: 0,
    follow: 0,
    seconds: 0,
    scroll: 0,
    bySite: {
      x: emptySite(),
      binance: emptySite(),
      okx: emptySite(),
    },
  });

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
          const cur = h[d] || {};
          h[d] = {
            ...emptyDay(),
            ...cur,
            bySite: {
              x: { ...emptySite(), ...(cur.bySite && cur.bySite.x) },
              binance: { ...emptySite(), ...(cur.bySite && cur.bySite.binance) },
              okx: { ...emptySite(), ...(cur.bySite && cur.bySite.okx) },
            },
          };
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

  function syncCountsFrom(h) {
    const t = h && h[todayStr()];
    if (!t || typeof t !== 'object') return;
    const bs = t.bySite || {};
    hist = h;
    counts = { ...emptyDay(), ...t, bySite: { x: { ...emptySite(), ...bs.x }, binance: { ...emptySite(), ...bs.binance }, okx: { ...emptySite(), ...bs.okx } } };
    refreshChip();
  }

  // 运行状态：写入存储，设置页的"诊断"区域会读取，用来判断脚本有没有在推特页面上正常运行
  // 对「运行状态」的读改写排成一队。之前探针和 setStatus 同时读改写同一个键，后写的会把先写的覆盖掉，
  // 点赞那条探针记录就是这样丢的
  let statusChain = Promise.resolve();
  function updateStatus(mutator) {
    statusChain = statusChain.then(() => new Promise((resolve) => {
      try {
        chrome.storage.local.get(XPET.STATUS_KEY, (r) => {
          const st = (r && r[XPET.STATUS_KEY]) || {};
          const out = mutator(st) || st;
          chrome.storage.local.set({ [XPET.STATUS_KEY]: out }, () => resolve());
        });
      } catch (e) { resolve(); }
    })).catch(() => {});
    return statusChain;
  }
  function setStatus(patch) { updateStatus((st) => ({ ...st, ...patch })); }
  try {
    setStatus({ version: chrome.runtime.getManifest().version, loadedAt: Date.now() });
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
    const siteKey = currentSiteKey();
    updateHistory((d) => {
      d[type] = (d[type] || 0) + 1;
      if (siteKey !== 'other') {
        d.bySite = d.bySite || {};
        d.bySite[siteKey] = d.bySite[siteKey] || emptySite();
        d.bySite[siteKey][type] = (d.bySite[siteKey][type] || 0) + 1;
      }
    }).then(() => {
      const spoke = reactTo(type); // 不是每次都说：按概率和冷却决定（点赞最少）
      if (type === 'post') restartClass('xpet-jump');
      else if (spoke) restartClass('xpet-nudge');
    });
  }

  // ---------- 币安 / OKX 专用规则（来自探针采集到的真实 DOM）----------
  // 这两站的互动元素很多不是 button，所以必须放在通用识别之前
  const SITE_RULES = {
    binance: [
      // 点赞/取消点赞是同一个元素（thumb-up-button，里面的文字就是点赞数），靠数字变化区分
      { act: 'like', sel: '.thumb-up-button', toggle: true },
      // 收藏：详情页有专用 class；列表页卡片底部最右那组图标里，第一个是收藏、第二个是分享（分享不计）。
      // 收藏/取消收藏的图形不变、靠颜色区分，而悬停也会变黄，所以无法区分。只记正向行为的做法：
      // 同一条帖子在页面不刷新期间只计第一次；书签页里点收藏图标是取消收藏，不计（见 onceAllowed）
      { act: 'bookmark', sel: '.detail-bookmark-button', once: true },
      { act: 'bookmark', sel: '.footer-function-grid > .gap-3 > :first-child', once: true },
      // 关注：已关注的按钮带 isFollowing，点它是取消关注，不计
      { act: 'follow', sel: '.feed-follow-button:not(.isFollowing)' },
      // 引用入口：只做标记，转发在引用「发出去」时才计（见 quoteContext）
      { arm: true, sel: '.quote-icon' },
    ],
    okx: [
      { act: 'like', sel: '[data-testid="feed-like-button"]', toggle: true },
      { arm: true, sel: '[data-testid="quote-btn"]' },
    ],
  };
  // 引用和转发算在一起：引用编辑器里点「发文」，计一次转发，不计发文
  // OKX 的引用编辑器没有 quote-mode 这类状态 class，只能靠「点过转发入口」的标记来判断，三道限制防止误计：
  // ① 只有「弹窗里的发文」才算转发（首页输入框不在弹窗里，发的是普通帖）；② 点遮罩或关闭图标（取消引用）就撤销标记；
  // ③ 标记 30 分钟后失效。已知局限：用 Esc 取消引用后，30 分钟内在另一个弹窗里发的普通帖仍会被误计为转发
  let quoteArmedAt = 0;
  const QUOTE_ARM_MS = 30 * 60 * 1000;
  function quoteContext(el) {
    if (el && el.closest && el.closest('.quote-mode')) return true; // 币安：引用编辑器带 quote-mode
    if (currentSiteKey() === 'okx' && quoteArmedAt && Date.now() - quoteArmedAt < QUOTE_ARM_MS && el && el.closest && el.closest('[role="dialog"]')) { quoteArmedAt = 0; return true; }
    return false;
  }
  const SKIP = 'skip'; // 专用规则命中了，但这次点击不该计数（后面的通用规则也不要再去匹配）
  const onceSeen = new Set(); // 「每条帖子只计一次」的动作（收藏）：已经计过的 动作:帖子id
  // 帖子 id：详情页取网址里的数字；列表页取卡片里指向帖子的链接。找不到就返回空字符串
  function postKeyOf(el) {
    const m = location.pathname.match(/\/post\/(\d+)/);
    if (m) return m[1];
    const card = el.closest('.feed-buzz-card-base-view') || (el.closest('.card__ft') || {}).parentElement;
    const a = card && card.querySelector && card.querySelector('a[href*="/post/"]');
    const mm = a && (a.getAttribute('href') || '').match(/\/post\/(\d+)/);
    return mm ? mm[1] : '';
  }
  function onceAllowed(act, el) {
    // 书签页里点收藏图标是取消收藏。网址里含 bookmark/collect/favorite 就认为是这类页面（路径未经你的页面验证，探针记录里的 path 可以核对）
    if (/bookmark|collect|favorite/i.test(location.pathname)) return false;
    const id = postKeyOf(el);
    if (!id) return true; // 找不到帖子 id，没法去重，按每次点击计
    const key = act + ':' + id;
    if (onceSeen.has(key)) return false;
    onceSeen.add(key);
    return true;
  }
  const PUBLISH_TEXT = /^(发文|发布|发帖|发表|发送|post|publish)$/i;
  let lastHit = null; // 最近一次专用规则命中的元素与是否为切换型按钮

  function matchSiteRule(target) {
    const site = currentSiteKey();
    if (site !== 'binance' && site !== 'okx') return null;
    for (const r of SITE_RULES[site] || []) {
      const el = target.closest(r.sel);
      if (el) {
        if (r.arm) { quoteArmedAt = Date.now(); return null; }
        if (r.once && !onceAllowed(r.act, el)) return SKIP;
        lastHit = { el, toggle: !!r.toggle };
        return r.act;
      }
    }
    // 发文：只认编辑器/弹窗里的提交按钮，排除仅用来打开编辑器的入口；按钮禁用（内容为空）时不计
    const b = target.closest('button, [role="button"]');
    if (b && PUBLISH_TEXT.test((b.innerText || b.textContent || '').trim())) {
      const cls = typeof b.className === 'string' ? b.className : '';
      // 从父级往上找（不包含按钮自己）：必须有一个编辑器/弹窗类的祖先，且其中真的有输入框，才算提交按钮
      let inEditor = /publishBtn|publish-btn/i.test(cls);
      for (let a = b.parentElement, i = 0; !inEditor && a && i < 12; a = a.parentElement, i++) {
        if (a.matches('[role="dialog"], [class*="editor"], [class*="composer"]') && a.querySelector('[role="textbox"], .ProseMirror, textarea')) inEditor = true;
      }
      // 币安用 class 里的 inactive 表示不可点（按钮点击后的快照里出现过 "inactive css-xxx"），不是 disabled 属性
      const disabled = b.disabled || b.getAttribute('aria-disabled') === 'true' || /(^|\s)(inactive|disabled)(\s|$)/i.test(cls);
      if (inEditor && !disabled) { lastHit = null; return quoteContext(b) ? 'repost' : 'post'; }
    }
    return null;
  }

  // 把 "1.2k" / "3万" / "" 解析成数字；解析不了返回 NaN
  function parseCount(s) {
    s = String(s || '').trim().replace(/,/g, '').toLowerCase();
    if (!s) return 0;
    const m = s.match(/^(\d+(?:\.\d+)?)([kmw万]?)$/);
    if (!m) return NaN;
    const mul = { '': 1, k: 1e3, m: 1e6, w: 1e4, '万': 1e4 }[m[2]];
    return Math.round(parseFloat(m[1]) * mul);
  }
  // 切换型按钮（点赞/取消点赞）：点击后 600ms 再读一次数字，数字变小说明是取消，不计数；无法判断时按点赞计
  function bumpToggle(type, el) {
    const before = parseCount(el.textContent);
    setTimeout(() => {
      const after = document.contains(el) ? parseCount(el.textContent) : NaN;
      if (Number.isFinite(before) && Number.isFinite(after) && after < before) return;
      bump(type);
    }, 600);
  }

  // 智能多平台动作识别（兼容 X / Twitter、币安广场、OK星球）
  function matchAction(target) {
    if (!target || !target.closest) return null;
    lastHit = null;
    const siteAct = matchSiteRule(target);
    if (siteAct === SKIP) return null;
    if (siteAct) return siteAct;
    // X 的「转发」确认项是 role="menuitem" 的 div，不是 button，下面的 button 检查会把它漏掉，所以先单独识别
    if (target.closest(SELECTORS.repostConfirm)) return 'repost';
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
    // X 已有完整的 data-testid 规则；下面的文字/aria 通用规则只给其他站点用，
    // 否则侧栏 "Post"、"Share post"、个人页 "Likes" 标签都会被误计
    if (currentSiteKey() === 'x') return null;

    // 2. 币安广场 / OK星球 通用文本与属性特征识别
    const aria = ((btn.getAttribute('aria-label') || '') + ' ' + (btn.getAttribute('title') || '') + ' ' + (btn.getAttribute('data-testid') || '')).toLowerCase();
    const rawText = btn.textContent || ''; // 不用 innerText（会强制排版）；整张卡片大小的链接不取文字
    const text = rawText.length > 40 ? '' : rawText.trim();

    // 发帖 / 发送 / Post / Publish
    if (/^(发布|发帖|发表|发送|post|publish|tweet)$/i.test(text) || /\b(post-button|publish-btn|send-btn)\b/i.test(aria)) {
      if (btn.disabled || btn.getAttribute('aria-disabled') === 'true') return null;
      return 'post';
    }
    // 关注 / Follow
    // 顶部「关注」标签页（推荐/关注/快讯…）不是关注动作，排除
    const isTab = btn.getAttribute('role') === 'tab' || !!btn.closest('[role="tablist"], nav');
    if (!isTab && (/^(\+?\s*关注|\+?\s*follow)$/i.test(text) || /\bfollow-btn\b/i.test(aria))) {
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
    if (!allowedNow) return;
    const t = e.target;
    if (!t || (t.closest && t.closest('#xpet-root, #xpet-menu, #xpet-summary'))) return; // 点宠物自己的界面不参与统计
    if (quoteArmedAt && currentSiteKey() === 'okx' && t.closest) { // 取消引用（点遮罩或关闭图标）就撤销标记
      const cb = t.closest('button');
      if (t.closest('.okui-dialog-mask') || t.closest('.okds-close') || (cb && cb.querySelector('.okds-close'))) quoteArmedAt = 0;
    }
    const act = matchAction(t);
    if (act) {
      const hit = lastHit;
      lastHit = null;
      if (hit && hit.toggle) return bumpToggle(act, hit.el);
      return bump(act);
    }

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
    if (!allowedNow) return;
    if (!(e.ctrlKey || e.metaKey) || e.key !== 'Enter') return;
    const box = e.target.closest && e.target.closest(SELECTORS.composerBox + ', textarea, [contenteditable="true"]');
    if (!box || !box.textContent.trim()) return;
    bump(quoteContext(e.target) ? 'repost' : 'post');
  }, true);

  // ---------- 在线时长与滚动距离 ----------
  // 只在以下条件同时满足时计时：页面属于允许站点、页面可见、窗口有焦点、最近 60 秒内有操作
  let lastActive = Date.now();
  ['mousemove', 'keydown', 'click', 'wheel', 'touchstart'].forEach((ev) =>
    window.addEventListener(ev, () => { if (allowedNow) lastActive = Date.now(); }, { passive: true, capture: true })
  );

  // 滚动距离：页面本身的滚动 + 内层大滚动容器（高度 ≥ 200px，如信息流面板）的滚动。
  // scroll 事件不冒泡，所以用 capture 才能收到内层容器的；小控件（下拉框、输入框）的滚动忽略。
  // 每个容器第一次出现时只记录起点不计距离，所以会少算很小一段；这是尽力而为的估算
  let lastY = window.scrollY;
  const innerScroll = new WeakMap(); // 容器 -> { top, big }
  window.addEventListener('scroll', (e) => {
    if (!allowedNow) return;
    const tgt = e.target;
    let d = 0;
    if (!tgt || tgt === document || tgt === document.documentElement || tgt === document.body) {
      const y = window.scrollY;
      d = Math.abs(y - lastY);
      lastY = y;
    } else if (tgt.nodeType === 1) {
      let st = innerScroll.get(tgt);
      if (!st) { innerScroll.set(tgt, { top: tgt.scrollTop, big: tgt.clientHeight >= 200 }); return; }
      if (!st.big) return;
      const y = tgt.scrollTop;
      d = Math.abs(y - st.top);
      st.top = y;
    } else return;
    // 页面切换导致的瞬间大跳转不算滚动
    if (d < 4000 && document.visibilityState === 'visible') pendingScroll += d;
  }, { passive: true, capture: true });

  function flush() {
    const s = Math.floor(pendingSec);
    const p = Math.round(pendingScroll);
    if (s < 1 && p < 1) return;
    pendingSec -= s;
    pendingScroll = 0;
    const siteKey = currentSiteKey();
    updateHistory((d) => {
      d.seconds = (d.seconds || 0) + s;
      d.scroll = (d.scroll || 0) + p;
      if (siteKey !== 'other') {
        d.bySite = d.bySite || {};
        d.bySite[siteKey] = d.bySite[siteKey] || emptySite();
        d.bySite[siteKey].seconds = (d.bySite[siteKey].seconds || 0) + s;
        d.bySite[siteKey].scroll = (d.bySite[siteKey].scroll || 0) + p;
      }
    });
  }

  let lastTick = Date.now();
  let historyLoaded = false;
  let lastNightAt = 0;
  let noticePending = true; // 需要检查有没有新的纪念 / 解锁 / 日记要说；只在宠物看得见时才检查和说

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
      settleDays(); // 新的一天开始，结算前一天的陪伴天数
    }

    // 只有属于生效页面时才计时：币安 / OKX 的交易等页面上脚本虽然加载了，但不会统计任何时长
    const active = allowedNow && document.visibilityState === 'visible' && document.hasFocus() && now - lastActive < 60000;
    if (active) pendingSec += dt;

    if (settingsLoaded) trackBack(now, active);
    if (active && historyLoaded && settingsLoaded) {
      const r = settings.reminders;
      const hour = new Date().getHours();
      if (r.night && canSpeak() && XPET.inWindow(hour, r.nightStart, r.nightEnd) && now - lastNightAt > 45 * 60 * 1000) {
        lastNightAt = now;
        speak('night', false, PRIO.act);
      }
      if (r.night && XPET.inWindow(hour, r.nightStart, r.nightEnd)) maybeYawn(now);
      if (canSpeak()) checkGreeting(now);
    }
    if (noticePending && historyLoaded && settingsLoaded && canSpeak()) { // 有新的纪念 / 解锁 / 日记时排队说（宠物被隐藏时不检查，等看得见了再说）
      noticePending = false;
      checkNotices();
    }
    updatePose(active);
    if (settingsLoaded) applyScene(); // 跟随时段模式：跨小时无缝更新场景（结果变化时才动 DOM）

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

  // ---------- 时段问候：每个时段每天第一次在线时说一句（跨标签页只说一次，显示成功后才写入 GREET_KEY） ----------
  let greetChecked = ''; // 本页面已入队或已确认过的 日期+节日+时段，避免每 5 秒读一次存储
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
    try {
      chrome.storage.local.get(XPET.GREET_KEY, (res) => {
        const r = res && res[XPET.GREET_KEY];
        const done = r && r.date === today && Array.isArray(r.done) ? r.done : [];
        let line = '';
        const toAdd = [];
        if (hol && !done.includes(holKey)) {
          line = pickLine(hol.lines);
          toAdd.push(holKey);
          if (slot && !done.includes(slot.id)) toAdd.push(slot.id);
        } else if (slot && !done.includes(slot.id)) {
          line = pickLine(slot.lines);
          toAdd.push(slot.id);
        }
        if (!line) return;
        enqueueAnnounce({
          key: 'greet:' + mark,
          text: line,
          expiresAt: Date.now() + 5 * 60 * 1000, // 问候具有时效性，5 分钟内未展示则过期丢弃
          ack: () => updateKey(XPET.GREET_KEY, () => ({}), (cur) => {
            const rec = cur && cur.date === today && Array.isArray(cur.done) ? cur : { date: today, done: [] };
            const next = rec.done.slice();
            toAdd.forEach((k) => { if (!next.includes(k)) next.push(k); });
            return { date: today, done: next };
          }),
        });
      });
    } catch (e) {}
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
          // 只在"同一天"内的离开才算；跨天回来由时段问候和陪伴结算负责
          if (b && b.enabled && typeof seen === 'number' && now - seen >= b.minutes * 60000 && dayStr(new Date(seen)) === todayStr()) {
            setTimeout(() => {
              enqueueAnnounce({
                key: 'back',
                type: 'back',
                expiresAt: Date.now() + 5 * 60 * 1000, // 5 分钟过期
              });
            }, 3500);
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
  // 陪伴天数：每天结算一次（有记录的天数 +1，只增不减）；装扮和日记按累计天数自动解锁，不需要领取
  // =====================================================
  let unlockName = '';
  const dayStr = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  try {
    chrome.storage.local.get(XPET.XP_KEY, (r) => {
      xpDays = daysOf(r && r[XPET.XP_KEY]);
      renderChar();
    });
  } catch (e) {}

  // 结算所有"已过去、还没结算"的日子（有记录的天数 +1）。幂等：多个标签页同时执行，结果一样。
  function settleDays() {
    const p = writeChain.then(() => new Promise((resolve) => {
      try {
        chrome.storage.local.get([XPET.HIST_KEY, XPET.XP_KEY], (r) => {
          const h = (r && r[XPET.HIST_KEY]) || {};
          const rec = (r && r[XPET.XP_KEY]) || {};
          const settled = rec.settled || {};
          const before = new Set(Object.keys(settled));
          const today = todayStr();

          Object.keys(h).sort().forEach((d) => {
            if (d >= today || settled[d]) return;
            const secs = h[d].seconds || 0;
            if (secs < 60) return; // 基本没用，不结算
            const mins = Math.round(secs / 60);
            settled[d] = { min: mins };
          });
          const keep = Object.keys(settled).sort().slice(-400);
          const trimmed = {};
          keep.forEach((d) => { trimmed[d] = settled[d]; });

          const fresh = keep.filter((d) => !before.has(d)).length;
          const prevDays = Number.isFinite(rec.daysTotal) ? rec.daysTotal : before.size; // 累计陪伴天数：只增不减，不受 400 天保留期限制
          const daysTotal = prevDays + fresh;
          chrome.storage.local.set({ [XPET.XP_KEY]: { ...rec, settled: trimmed, daysTotal } }, () => resolve(daysTotal));
        });
      } catch (e) { resolve(null); }
    }));
    writeChain = p.catch(() => {});
    p.then((days) => {
      if (days === null) return;
      xpDays = days;
      renderChar();
      noticePending = true; // 天数变了，可能有新的纪念 / 装扮 / 日记；等宠物看得见时再检查并说
    });
    return p;
  }
  setTimeout(settleDays, 2500); // 启动时补结算之前的日子

  // 有没有新的里程碑 / 装扮 / 日记要说。
  // 采用「先只读检查 → 入队 → 气泡真正显示成功后再调用 ack 写入已通知标记」：
  // 即使入队后开启了今天安静、连续被高优气泡打断、或者直接刷新/关闭了网页，未展示的通知也不会被消耗，下次仍会补发。
  function checkNotices() {
    try {
      chrome.storage.local.get(XPET.XP_KEY, (res) => {
        const rec = (res && res[XPET.XP_KEY]) || {};
        const days = daysOf(rec);
        const announced = Array.isArray(rec.announced) ? rec.announced : [];
        // 老数据没有里程碑记录时，把已经过了的都算作已通知，不补发
        if (!Array.isArray(rec.milestones)) {
          const initMs = XPET.MILESTONE_DAYS.filter((m) => m <= days);
          updateKey(XPET.XP_KEY, () => ({}), (cur) => ({ ...cur, milestones: Array.isArray(cur.milestones) ? cur.milestones : initMs }));
        }
        const prevMs = Array.isArray(rec.milestones) ? rec.milestones : XPET.MILESTONE_DAYS.filter((m) => m <= days);
        const newMs = XPET.MILESTONE_DAYS.filter((m) => m <= days && !prevMs.includes(m));
        const storyAnn = Array.isArray(rec.stories) ? rec.stories : [];
        const newStories = XPET.STORIES.filter((s) => s.need <= days && !storyAnn.includes(s.id));
        const newly = XPET.ACCESSORIES_ENABLED ? XPET.ACCESSORIES.filter((a) => a.need > 0 && a.need <= days && !announced.includes(a.id)) : [];

        if (newMs.length) {
          const ackMs = () => updateKey(XPET.XP_KEY, () => ({}), (cur) => {
            const ms = Array.isArray(cur.milestones) ? cur.milestones.slice() : [];
            newMs.forEach((m) => { if (!ms.includes(m)) ms.push(m); });
            return { ...cur, milestones: ms };
          });
          if (settings.milestone) {
            enqueueAnnounce({ key: 'ms:' + newMs.join(','), type: 'milestone', ack: ackMs });
          } else {
            ackMs();
          }
        }

        if (newly.length) {
          const gearName = newly[newly.length - 1].name; // 一次补上多件时只提最新的
          const ids = newly.map((a) => a.id);
          enqueueAnnounce({
            key: 'gear:' + ids.join(','),
            type: 'unlock',
            prepare: () => { unlockName = gearName; },
            ack: () => updateKey(XPET.XP_KEY, () => ({}), (cur) => {
              const ann = Array.isArray(cur.announced) ? cur.announced.slice() : [];
              ids.forEach((id) => { if (!ann.includes(id)) ann.push(id); });
              return { ...cur, announced: ann };
            }),
          });
        }

        if (newStories.length) {
          const latestTitle = newStories[newStories.length - 1].title;
          const sids = newStories.map((s) => s.id);
          const ackStory = () => updateKey(XPET.XP_KEY, () => ({}), (cur) => {
            const st = Array.isArray(cur.stories) ? cur.stories.slice() : [];
            sids.forEach((id) => { if (!st.includes(id)) st.push(id); });
            return { ...cur, stories: st };
          });
          if (settings.stories && settings.stories.enabled) {
            enqueueAnnounce({
              key: 'story:' + sids.join(','),
              type: 'story',
              prepare: () => { storyTitle = latestTitle; },
              ack: ackStory,
            });
          } else {
            ackStory();
          }
        }
      });
    } catch (e) {}
  }

  // =====================================================
  // 今日小结：只在你点开时显示，只列事实、不评价
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

  function buildSummary() {
    const mins = Math.floor(totalSeconds() / 60);

    // 所有文字都用 textContent，不拼 HTML
    const mk = (tag, cls, text) => {
      const e = document.createElement(tag);
      if (cls) e.className = cls;
      if (text !== undefined && text !== null) e.textContent = text;
      return e;
    };

    summaryEl = mk('div');
    summaryEl.id = 'xpet-summary';

    // ① 头部：标题 + 今日在线总时长（整张卡片里最大的数字）
    const head = mk('div', 'xpet-sum-head');
    head.appendChild(mk('div', 'xpet-sum-title', '今日小结'));
    head.appendChild(mk('div', 'xpet-sum-time', XPET.fmtDur(mins)));
    summaryEl.appendChild(head);

    // ② 状态：不再拿今天的时长和任何区间比较，只列事实

    // ③ 五项互动：数字在上、名称在下；为 0 的项变淡
    const grid = mk('div', 'xpet-sum-grid');
    [['post', '发文'], ['like', '点赞'], ['bookmark', '收藏'], ['repost', '转发'], ['follow', '关注']].forEach(([k, label]) => {
      const n = counts[k] || 0;
      const cell = mk('div', 'xpet-sum-cell' + (n ? '' : ' zero'));
      cell.appendChild(mk('div', 'xpet-sum-num', String(n)));
      cell.appendChild(mk('div', 'xpet-sum-lab', label));
      grid.appendChild(cell);
    });
    summaryEl.appendChild(grid);

    // ④ 分站明细：每站一块，第一行站名 + 时长，第二行互动数（没有就不显示这一行）
    const bs = counts.bySite || {};
    const SITE_SHORT = { x: '推特', binance: '币安广场', okx: 'OK星球' };
    const siteIcons = (XPET && XPET.SITE_ICONS) || { x: '𝕏', binance: '🟡', okx: '🔵' };
    const blocks = [];
    ['x', 'binance', 'okx'].forEach((k) => {
      const s = bs[k];
      if (!(s && ((s.seconds && s.seconds >= 30) || s.post || s.like || s.bookmark || s.repost || s.follow))) return;
      const smins = Math.floor((s.seconds || 0) / 60);
      const acts = [];
      [['post', '发文'], ['like', '赞'], ['bookmark', '藏'], ['repost', '转'], ['follow', '关注']].forEach(([f, l]) => { if (s[f]) acts.push(`${l} ${s[f]}`); });
      const block = mk('div', 'xpet-sum-site');
      const top = mk('div', 'xpet-sum-site-top');
      top.appendChild(mk('span', 'xpet-sum-site-name', `${siteIcons[k]} ${SITE_SHORT[k]}`));
      top.appendChild(mk('span', 'xpet-sum-site-time', smins > 0 ? XPET.fmtDur(smins) : (s.seconds ? '<1分' : '0分')));
      block.appendChild(top);
      if (acts.length) block.appendChild(mk('div', 'xpet-sum-site-acts', acts.join('　')));
      blocks.push(block);
    });
    if (blocks.length) {
      summaryEl.appendChild(mk('div', 'xpet-sum-sec', '分站明细'));
      blocks.forEach((b) => summaryEl.appendChild(b));
    }

    // ⑤ 陪伴：累计天数；下一件桌上的东西还差几天（若开启了桌搭）
    const next = XPET.ACCESSORIES_ENABLED ? XPET.ACCESSORIES.find((a) => a.need > xpDays) : null;
    summaryEl.appendChild(mk('div', 'xpet-sum-sec', '陪伴'));
    summaryEl.appendChild(mk('div', 'xpet-sum-sub', `一起 ${xpDays} 天` + (XPET.ACCESSORIES_ENABLED ? (next ? `　${next.icon}${next.name} 还差 ${next.need - xpDays} 天` : '　桌上的东西都齐了') : '')));
    document.body.appendChild(summaryEl);

    const r = root.getBoundingClientRect();
    const w = summaryEl.offsetWidth || 300, h = summaryEl.offsetHeight || 260;
    const left = Math.max(MARGIN, Math.min(r.left + r.width / 2 - w / 2, window.innerWidth - w - MARGIN));
    const top = r.top - h - 40 > MARGIN ? r.top - h - 40 : Math.min(r.bottom + 34, window.innerHeight - h - MARGIN);
    summaryEl.style.left = left + 'px';
    summaryEl.style.top = Math.max(MARGIN, top) + 'px';
    const armClose = (ms) => { clearTimeout(summaryTimer); summaryTimer = setTimeout(closeSummary, ms); };
    summaryEl.addEventListener('mouseenter', () => clearTimeout(summaryTimer)); // 鼠标放在卡片上时不自动收起，方便慢慢看
    summaryEl.addEventListener('mouseleave', () => armClose(8000));
    armClose(30000); // 不用管它，30 秒后自己收起
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
    say('扩展已更新，请刷新页面（F5）', 600000, PRIO.user);
  }

  reloadSettings();
})();

