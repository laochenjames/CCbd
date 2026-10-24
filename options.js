(async () => {
  const listEl = document.getElementById('list');
  const statusEl = document.getElementById('status');
  let { chars, active } = await XPET.load();

  // 累计经验（装扮解锁条件）
  let xpTotal = 0;
  async function loadXp() {
    const r = await chrome.storage.local.get(XPET.XP_KEY);
    xpTotal = (r[XPET.XP_KEY] && r[XPET.XP_KEY].total) || 0;
  }
  await loadXp();

  // ---------- 保存（带防抖） ----------
  let saveTimer = null;
  function showStatus(msg, ok) {
    statusEl.textContent = msg;
    statusEl.className = ok ? 'ok' : 'err';
  }
  async function saveNow() {
    try {
      await XPET.save(chars, active);
      showStatus('已保存', true);
    } catch (e) {
      showStatus('保存失败：可能是图片太大或角色太多，超出了浏览器给扩展的存储空间。请删除一些角色或换小一点的图片。', false);
    }
  }
  function saveSoon() {
    showStatus('', true);
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 400);
  }

  // ---------- 图片处理 ----------
  const readAsDataURL = (file) => new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = () => rej(new Error('读取失败'));
    r.readAsDataURL(file);
  });

  async function fileToDataUrl(file) {
    if (!/^image\/(png|jpeg|gif|webp)$/.test(file.type)) throw new Error('仅支持 PNG / JPG / GIF / WebP 图片');
    if (file.type === 'image/gif' && file.size <= 1.5 * 1024 * 1024) return readAsDataURL(file); // 保留动画
    const bmp = await createImageBitmap(file);
    const MAX = 160;
    const scale = Math.min(1, MAX / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * scale));
    const h = Math.max(1, Math.round(bmp.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d').drawImage(bmp, 0, 0, w, h);
    return canvas.toDataURL('image/png'); // PNG 保留透明背景
  }

  // ---------- 渲染 ----------
  function el(tag, props = {}, children = []) {
    const e = document.createElement(tag);
    Object.assign(e, props);
    children.forEach((c) => e.appendChild(c));
    return e;
  }

  function render() {
    listEl.textContent = '';
    chars.forEach((c) => listEl.appendChild(renderCard(c)));
  }

  // 精灵图：横向拼接的 n 帧 → 限制帧高/总宽 → 逐帧缩放（避免相邻帧互相渗色）→ 重新编码
  async function processSprite(file, n) {
    if (!/^image\/(png|webp)$/.test(file.type)) throw new Error('精灵图请用 PNG 或 WebP（需要透明背景）');
    if (file.size > 12 * 1024 * 1024) throw new Error('文件超过 12MB，请先压缩');
    const bmp = await createImageBitmap(file);
    const fw = Math.floor(bmp.width / n), fh = bmp.height;
    if (fw < 8 || fh < 8) throw new Error('帧太小：请检查帧数是否填对');
    const s = Math.min(1, XPET.SPRITE_MAX_FRAME_H / fh, XPET.SPRITE_MAX_SHEET_W / (fw * n));
    const nfw = Math.max(1, Math.round(fw * s)), nfh = Math.max(1, Math.round(fh * s));
    const canvas = document.createElement('canvas');
    canvas.width = nfw * n;
    canvas.height = nfh;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    for (let i = 0; i < n; i++) ctx.drawImage(bmp, i * fw, 0, fw, fh, i * nfw, 0, nfw, nfh);
    let data = canvas.toDataURL('image/webp', 0.92);
    if (!data.startsWith('data:image/webp')) data = canvas.toDataURL('image/png');
    if (data.length > 6 * 1024 * 1024 && data.startsWith('data:image/webp')) data = canvas.toDataURL('image/webp', 0.75);
    const warn = bmp.width % n ? `图宽不能被 ${n} 整除，已裁掉右边多余的 ${bmp.width % n} 像素。` : '';
    return { data, fw: nfw, fh: nfh, warn };
  }

  function renderSprites(c) {
    const box = el('details', { className: 'sprites' });
    box.appendChild(el('summary', { textContent: '动画（精灵图，可选）' }));
    box.appendChild(el('p', { className: 'hint', textContent: '精灵图 = 把动画的每一帧横向拼成一张透明背景的长图（PNG 或 WebP），帧宽 = 图宽 ÷ 帧数。先填帧数和每秒几帧，再选文件。只上传「待机」也行，其他状态没图时会用它。帧高超过 320 像素会自动缩小。' }));
    c.sprites = c.sprites || {};
    XPET.SPRITE_STATES.forEach(([st, label]) => {
      const m = c.sprites[st];
      const bi = !m ? XPET.builtinSprite(c, st) : null;
      const row = el('div', { className: 'sprite-row' });
      const frames = el('input', { type: 'number', className: 'num', min: 1, max: XPET.SPRITE_MAX_FRAMES, value: m ? m.frames : bi ? bi.frames : 8, disabled: !!m, title: '帧数' });
      const fps = el('input', { type: 'number', className: 'num', min: 1, max: 30, value: m ? m.fps : bi ? bi.fps : 8, title: '每秒几帧' });
      const file = el('input', { type: 'file', accept: 'image/png,image/webp', hidden: true });
      const up = el('button', { type: 'button', textContent: m ? '更换' : bi ? '换成自己的' : '上传' });
      const del = el('button', { type: 'button', className: 'danger', textContent: '删除', disabled: !m });
      const info = el('span', { className: 'hint', textContent: m ? `已上传：${m.frames} 帧，每帧 ${m.fw}×${m.fh}` : bi ? `使用内置动画（${bi.frames} 帧）` : '未上传' });
      row.append(el('span', { className: 'sprite-label', textContent: label }), el('span', { textContent: '帧数' }), frames, el('span', { textContent: '帧率' }), fps, up, del, info, file);
      fps.addEventListener('change', () => {
        const v = Math.max(1, Math.min(30, Math.floor(Number(fps.value)) || 8));
        fps.value = v;
        if (c.sprites[st]) { c.sprites[st].fps = v; saveSoon(); }
      });
      up.addEventListener('click', () => {
        frames.disabled = false; // 更换时允许重新填帧数
        file.click();
      });
      file.addEventListener('change', async () => {
        const f = file.files && file.files[0];
        file.value = '';
        if (!f) return;
        const n = Math.max(1, Math.min(XPET.SPRITE_MAX_FRAMES, Math.floor(Number(frames.value)) || 1));
        const rate = Math.max(1, Math.min(30, Math.floor(Number(fps.value)) || 8));
        try {
          showStatus('处理中…', true);
          const r = await processSprite(f, n);
          await chrome.storage.local.set({ [XPET.spriteKey(c.id, st)]: r.data });
          c.sprites[st] = { frames: n, fps: rate, fw: r.fw, fh: r.fh };
          await saveNow();
          render();
          if (r.warn) showStatus(r.warn, true);
        } catch (e) {
          showStatus(e && e.message ? e.message : '精灵图处理失败（可能是存储空间不足）', false);
          frames.disabled = !!c.sprites[st];
        }
      });
      del.addEventListener('click', async () => {
        delete c.sprites[st];
        try { await chrome.storage.local.remove(XPET.spriteKey(c.id, st)); } catch (_) {}
        await saveNow();
        render();
      });
      box.appendChild(row);
    });
    return box;
  }

  function renderCard(c) {
    const isActive = c.id === active;
    const card = el('div', { className: 'card' + (isActive ? ' active' : '') });

    // 头部：头像、名称、按钮
    const avatar = el('div', { className: 'avatar' });
    if (c.img) avatar.appendChild(el('img', { src: c.img, alt: c.name }));
    else avatar.textContent = c.look === 'teddy' ? '🐶' : c.look === 'cat' ? '🐱' : '🟢';

    const nameInput = el('input', { className: 'name', type: 'text', value: c.name, maxLength: 20, placeholder: '角色名称' });
    nameInput.addEventListener('input', () => { c.name = nameInput.value.trim() || '未命名'; saveSoon(); });

    const fileInput = el('input', { type: 'file', accept: 'image/png,image/jpeg,image/gif,image/webp' });
    fileInput.addEventListener('change', async () => {
      const f = fileInput.files && fileInput.files[0];
      if (!f) return;
      try {
        c.img = await fileToDataUrl(f);
        render();
        saveNow();
      } catch (e) {
        showStatus(e.message || '图片处理失败', false);
      }
    });
    const uploadBtn = el('button', { textContent: c.img ? '更换图片' : '上传图片' });
    uploadBtn.addEventListener('click', () => fileInput.click());

    const resetImgBtn = el('button', { textContent: '用内置形象', disabled: !c.img });
    resetImgBtn.addEventListener('click', () => { c.img = null; render(); saveNow(); });

    const useBtn = el('button', { textContent: isActive ? '当前角色' : '设为当前', disabled: isActive, className: isActive ? '' : 'primary' });
    useBtn.addEventListener('click', () => { active = c.id; render(); saveNow(); });

    const delBtn = el('button', { textContent: '删除', className: 'danger', disabled: chars.length <= 1 });
    delBtn.addEventListener('click', () => {
      if (!confirm(`确定删除角色「${c.name}」吗？`)) return;
      try { chrome.storage.local.remove(Object.keys(c.sprites || {}).map((st) => XPET.spriteKey(c.id, st))); } catch (_) {}
      chars = chars.filter((x) => x.id !== c.id);
      if (active === c.id) active = chars[0].id;
      render();
      saveNow();
    });

    card.appendChild(el('div', { className: 'head' }, [
      avatar, nameInput,
      el('div', { className: 'btns' }, [uploadBtn, resetImgBtn, useBtn, delBtn, fileInput]),
    ]));

    // 内置形象二选一（没有上传自己的图片时使用）
    const lookRow = el('div', { className: 'acc-row' });
    lookRow.appendChild(el('span', { textContent: '内置形象：' }));
    const lookSel = el('select');
    [['teddy', '🐶 泰迪犬'], ['slime', '🟢 小史莱姆'], ['cat', '🐱 哈基米']].forEach(([v, t]) => lookSel.appendChild(el('option', { value: v, textContent: t })));
    lookSel.value = c.look || 'slime';
    lookSel.addEventListener('change', () => { c.look = lookSel.value; render(); saveNow(); });
    lookRow.appendChild(el('span', { className: 'hint', textContent: '　上传了自己的图片后，以图片为准' }));
    lookRow.insertBefore(lookSel, lookRow.lastChild);
    card.appendChild(lookRow);

    // 装扮：用累计经验解锁（自动解锁，不需要领取）
    const accRow = el('div', { className: 'acc-row' });
    accRow.appendChild(el('span', { textContent: '装扮：' }));
    const sel = el('select');
    XPET.ACCESSORIES.forEach((a) => {
      const locked = a.need > xpTotal;
      sel.appendChild(el('option', {
        value: a.id,
        disabled: locked,
        textContent: `${a.emoji} ${a.name}`.trim() + (locked ? `（累计 ${a.need} 经验解锁）` : ''),
      }));
    });
    sel.value = c.accessory || 'none';
    sel.addEventListener('change', () => { c.accessory = sel.value; saveSoon(); });
    accRow.appendChild(sel);
    accRow.appendChild(el('span', { className: 'hint', textContent: `　已累计 ${xpTotal} 经验` }));
    card.appendChild(accRow);

    const actRow = el('div', { className: 'acc-row' });
    actRow.appendChild(el('span', { textContent: '在旁边做的事：' }));
    const actSel = el('select');
    XPET.ACTIVITIES.forEach(([v, t]) => actSel.appendChild(el('option', { value: v, textContent: t })));
    actSel.value = c.activity || 'book';
    actSel.addEventListener('change', () => { c.activity = actSel.value; saveSoon(); });
    actRow.appendChild(actSel);
    actRow.appendChild(el('span', { className: 'hint', textContent: '　你在用页面时它拿着；你停下来它打盹；深夜它打哈欠' }));
    card.appendChild(actRow);

    const sizeRow = el('div', { className: 'acc-row' });
    sizeRow.appendChild(el('span', { textContent: '显示大小：' }));
    const sizeSel = el('select');
    XPET.SIZES.forEach(([v, t]) => sizeSel.appendChild(el('option', { value: String(v), textContent: t })));
    sizeSel.value = String(c.size || 1);
    sizeSel.addEventListener('change', () => { c.size = Number(sizeSel.value); saveSoon(); });
    sizeRow.appendChild(sizeSel);
    sizeRow.appendChild(el('span', { className: 'hint', textContent: '　用了精灵图、想要更细腻的画面时选大一点' }));
    card.appendChild(sizeRow);
    card.appendChild(renderSprites(c));

    // 台词：每个动作一个文本框，一行一句
    const grid = el('div', { className: 'phrases' });
    XPET.ACTIONS.forEach(([key, label]) => {
      const ta = el('textarea', { value: (c.phrases[key] || []).join('\n'), placeholder: '留空 = 不说话' });
      ta.addEventListener('input', () => {
        c.phrases[key] = ta.value.split('\n').map((s) => s.trim()).filter(Boolean);
        saveSoon();
      });
      grid.appendChild(el('div', {}, [el('label', { textContent: label + '（一行一句）' }), ta]));
    });
    const det = el('details');
    det.appendChild(el('summary', { textContent: '台词设置（点击展开）' }));
    det.appendChild(grid);
    card.appendChild(det);

    const resetBtn = el('button', { textContent: '恢复默认台词' });
    resetBtn.addEventListener('click', () => {
      if (!confirm('把这个角色的所有台词恢复为默认吗？')) return;
      c.phrases = XPET.defaultPhrases();
      render();
      saveNow();
    });
    card.appendChild(el('div', { className: 'foot' }, [resetBtn]));
    return card;
  }

  document.getElementById('add').addEventListener('click', () => {
    const id = 'c' + Date.now().toString(36);
    chars.push({ id, name: '新角色', img: null, look: 'teddy', accessory: 'none', phrases: XPET.defaultPhrases() });
    render();
    saveNow();
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  });

  render();

  // ---------- 显示与提醒设置 ----------
  const settings = await XPET.loadSettings();
  const $ = (id) => document.getElementById(id);
  const itemBoxes = Array.from(document.querySelectorAll('#s-items input[data-item]'));
  const intIn = (el, min, max, fallback) => {
    const v = Math.floor(Number(el.value));
    return Number.isFinite(v) && v >= min && v <= max ? v : fallback;
  };

  function syncSettingsUI() {
    $('s-chipMode').value = settings.chipMode;
    itemBoxes.forEach((b) => { b.checked = !!settings.chipItems[b.dataset.item]; });
    const r = settings.reminders;
    $('s-tired').checked = r.tired;
    $('s-tiredMin').value = r.tiredMinutes;
    $('s-tiredMin').disabled = !r.tired;
    $('s-night').checked = r.night;
    $('s-cap').checked = r.cap;
    $('s-nightStart').value = r.nightStart;
    $('s-nightEnd').value = r.nightEnd;
    $('s-nightStart').disabled = $('s-nightEnd').disabled = !r.night;
    $('s-goalMin').value = settings.goal.minMinutes;
    $('s-goalMax').value = settings.goal.maxMinutes;
    $('s-goalGrace').value = settings.goal.graceMinutes;
    renderGoalSummary();
    $('s-greet').checked = settings.greeting.enabled;
    renderSlots();
    $('s-back').checked = settings.back.enabled;
    $('s-backMin').value = settings.back.minutes;
    $('s-backMin').disabled = !settings.back.enabled;
    $('s-milestone').checked = settings.milestone;
    $('s-stories').checked = settings.stories.enabled;
    $('s-holiday').checked = settings.holidays.enabled;
    renderHolidays();
  }
  async function saveSettingsNow() {
    try { await XPET.saveSettings(settings); showStatus('已保存', true); try { renderCalendar(); renderGoalSummary(); } catch (_) {} }
    catch (e) { showStatus('保存失败，请稍后重试', false); }
  }
  const bindCheck = (id, fn) => $(id).addEventListener('change', (e) => { fn(e.target.checked); syncSettingsUI(); saveSettingsNow(); });
  const bindNum = (id, min, max, getCur, set) => $(id).addEventListener('change', (e) => {
    set(intIn(e.target, min, max, getCur()));
    syncSettingsUI();
    saveSettingsNow();
  });

  $('s-chipMode').addEventListener('change', (e) => { settings.chipMode = e.target.value; saveSettingsNow(); });
  itemBoxes.forEach((b) => b.addEventListener('change', () => { settings.chipItems[b.dataset.item] = b.checked; saveSettingsNow(); }));
  bindCheck('s-tired', (v) => { settings.reminders.tired = v; });
  bindNum('s-tiredMin', 5, 720, () => settings.reminders.tiredMinutes, (v) => { settings.reminders.tiredMinutes = v; });
  bindCheck('s-cap', (v) => { settings.reminders.cap = v; });
  bindCheck('s-night', (v) => { settings.reminders.night = v; });
  bindNum('s-nightStart', 0, 23, () => settings.reminders.nightStart, (v) => { settings.reminders.nightStart = v; });
  bindNum('s-nightEnd', 0, 23, () => settings.reminders.nightEnd, (v) => { settings.reminders.nightEnd = v; });
  bindCheck('s-back', (v) => { settings.back.enabled = v; });
  bindNum('s-backMin', 10, 720, () => settings.back.minutes, (v) => { settings.back.minutes = v; });
  bindCheck('s-milestone', (v) => { settings.milestone = v; });
  bindCheck('s-stories', (v) => { settings.stories.enabled = v; });
  bindCheck('s-holiday', (v) => { settings.holidays.enabled = v; });
  bindNum('s-goalMin', 0, 1440, () => settings.goal.minMinutes, (v) => { settings.goal.minMinutes = v; });
  bindNum('s-goalMax', 0, 1440, () => settings.goal.maxMinutes, (v) => { settings.goal.maxMinutes = v; });
  bindNum('s-goalGrace', 1, 1440, () => settings.goal.graceMinutes, (v) => { settings.goal.graceMinutes = v; });
  // ---------- 时段问候 ----------
  function renderSlots() {
    const box = $('greet-slots');
    if (box.contains(document.activeElement)) return; // 正在输入时不重绘，避免打断
    box.textContent = '';
    const slots = settings.greeting.slots;
    slots.forEach((s, i) => {
      const row = el('div', { className: 'slot' });
      const name = el('input', { type: 'text', value: s.name, maxLength: 12 });
      const mk = (v, max) => el('input', { type: 'number', className: 'num', value: v, min: 0, max });
      const st = mk(s.start, 23), en = mk(s.end, 24);
      const ta = el('textarea', { value: s.lines.join('\n'), placeholder: '一行一句；留空 = 这个时段不说话' });
      const del = el('button', { type: 'button', className: 'danger', textContent: '删除' });
      const commit = () => {
        s.name = name.value.trim().slice(0, 12) || '时段';
        const iv = (e, d) => { const n = Math.floor(Number(e.value)); return Number.isFinite(n) && n >= 0 && n <= 24 ? n : d; };
        s.start = iv(st, s.start) % 24;
        s.end = iv(en, s.end) % 24;
        s.lines = ta.value.split('\n').map((t) => t.trim().slice(0, 60)).filter(Boolean).slice(0, 20);
        saveSettingsNow();
      };
      [name, st, en].forEach((e) => e.addEventListener('change', commit));
      ta.addEventListener('input', () => { clearTimeout(ta._t); ta._t = setTimeout(commit, 600); });
      ta.addEventListener('blur', commit);
      del.addEventListener('click', () => { slots.splice(i, 1); saveSettingsNow(); renderSlots(); });
      row.append(name, el('span', { textContent: ' ' }), st, el('span', { textContent: ' 点 到 ' }), en, el('span', { textContent: ' 点 ' }), del, ta);
      box.appendChild(row);
    });
  }
  $('greet-add').addEventListener('click', () => {
    const slots = settings.greeting.slots;
    if (slots.length >= 8) { showStatus('最多 8 个时段', false); return; }
    slots.push({ id: 's' + Date.now().toString(36), name: '新时段', start: 14, end: 18, lines: ['你好呀'] });
    saveSettingsNow();
    renderSlots();
  });
  bindCheck('s-greet', (v) => { settings.greeting.enabled = v; });
  syncSettingsUI();

  chrome.storage.onChanged.addListener(async (changes, area) => {
    if (area !== 'local') return;
    if (changes[XPET.XP_KEY]) { await loadXp(); render(); renderHistory(); }
  });

  // ---------- 历史数据 ----------


  // ---------- 节日与纪念日 ----------
  function renderHolidays() {
    const box = $('holiday-items');
    if (box.contains(document.activeElement)) return; // 正在输入时不重绘
    box.textContent = '';
    const items = settings.holidays.items;
    items.forEach((it, i) => {
      const row = el('div', { className: 'slot' });
      const name = el('input', { type: 'text', value: it.name, maxLength: 12 });
      const type = el('select');
      [['solar', '阳历'], ['lunar', '农历'], ['lunarEve', '除夕']].forEach(([v, t]) => type.appendChild(el('option', { value: v, textContent: t })));
      type.value = it.type;
      const mo = el('input', { type: 'number', className: 'num', value: it.month, min: 1, max: 12 });
      const da = el('input', { type: 'number', className: 'num', value: it.day, min: 1, max: 31 });
      const ta = el('textarea', { value: it.lines.join('\n'), placeholder: '一行一句；留空 = 当天不说' });
      const del = el('button', { type: 'button', className: 'danger', textContent: '删除' });
      const sync = () => { mo.disabled = da.disabled = type.value === 'lunarEve'; };
      const commit = () => {
        it.name = name.value.trim().slice(0, 12) || '纪念日';
        it.type = type.value;
        const iv = (e, lo, hi, d) => { const n = Math.floor(Number(e.value)); return Number.isFinite(n) && n >= lo && n <= hi ? n : d; };
        it.month = iv(mo, 1, 12, it.month);
        it.day = iv(da, 1, 31, it.day);
        it.lines = ta.value.split('\n').map((t) => t.trim().slice(0, 60)).filter(Boolean).slice(0, 10);
        sync();
        saveSettingsNow();
      };
      [name, type, mo, da].forEach((e) => e.addEventListener('change', commit));
      ta.addEventListener('input', () => { clearTimeout(ta._t); ta._t = setTimeout(commit, 600); });
      ta.addEventListener('blur', commit);
      del.addEventListener('click', () => { items.splice(i, 1); saveSettingsNow(); renderHolidays(); });
      sync();
      row.append(name, el('span', { textContent: ' ' }), type, el('span', { textContent: ' ' }), mo, el('span', { textContent: ' 月 ' }), da, el('span', { textContent: ' 日 ' }), del, ta);
      box.appendChild(row);
    });
  }
  $('holiday-add').addEventListener('click', () => {
    const items = settings.holidays.items;
    if (items.length >= 20) { showStatus('最多 20 个', false); return; }
    items.push({ id: 'h' + Date.now().toString(36), name: '纪念日', type: 'solar', month: 1, day: 1, lines: ['今天是个特别的日子'] });
    saveSettingsNow();
    renderHolidays();
  });

  // ---------- 宠物的小本子：已解锁的显示全文，没解锁的只显示还差多少经验 ----------
  function renderBook(rec) {
    rec = rec || {};
    const settled = rec.settled || {};
    const days = Number.isFinite(rec.daysTotal) ? rec.daysTotal : Object.keys(settled).length;
    const full = Object.values(settled).filter((s) => s && s.xp >= settings.goal.baseXp).length; // 停在自己设的范围里（拿到满额经验）的天数
    const total = xpTotal;
    const fill = (t) => t.replace(/\{days\}/g, days).replace(/\{full\}/g, full).replace(/\{total\}/g, total);
    const open = XPET.STORIES.filter((s) => s.need <= total).length;
    $('book-sum').textContent = `宠物的小本子（已写 ${open} / ${XPET.STORIES.length} 页）`;
    const box = $('book-list');
    box.textContent = '';
    XPET.STORIES.forEach((s, i) => {
      const item = el('div', { className: 'book-item' + (s.need <= total ? '' : ' locked') });
      if (s.need <= total) {
        item.appendChild(el('div', { className: 'book-title', textContent: `${i + 1}. ${s.title}` }));
        item.appendChild(el('div', { className: 'book-text', textContent: fill(s.text) }));
      } else {
        item.appendChild(el('div', { className: 'book-title', textContent: `🔒 第 ${i + 1} 页　再攒 ${s.need - total} 经验解锁` }));
      }
      box.appendChild(item);
    });
  }
  async function loadBook() { const r = await chrome.storage.local.get(XPET.XP_KEY); renderBook(r[XPET.XP_KEY]); }

  // ---------- 当前区间设定的一句话说明 ----------
  function renderGoalSummary() {
    const { minMinutes: lo, maxMinutes: hi, graceMinutes: g, baseXp: b } = settings.goal;
    const range = lo > 0 && hi > 0 ? `${lo}–${hi} 分钟` : lo > 0 ? `${lo} 分钟以上` : hi > 0 ? `不超过 ${hi} 分钟` : '任意时长';
    let t = `当前设定：每天在线 ${range}，得满额 ${b} 经验`;
    if (lo > 0) t += `；不足 ${lo} 分钟按比例给`;
    if (hi > 0) t += `；超过 ${hi} 分钟后逐渐减少，多 ${g} 分钟降为 0`;
    document.getElementById('goal-sum').textContent = t + '。';
  }

  // ---------- 日历：每天的在线时长，颜色表示和你设的区间的关系（没有惩罚色） ----------
  const calEl = document.getElementById('cal');
  let calView = (() => { const n = new Date(); return { y: n.getFullYear(), m: n.getMonth() }; })();
  let calSel = null;
  let calData = { h: {}, settled: {} };
  const pad2 = (n) => String(n).padStart(2, '0');
  const dayKey = (y, m, d) => `${y}-${pad2(m + 1)}-${pad2(d)}`;

  function dayMinutes(k) {
    const d = calData.h[k], s = calData.settled[k];
    if (d && d.seconds) return Math.floor(d.seconds / 60);
    return s ? s.min || 0 : 0;
  }
  function dayState(mins) {
    const lo = settings.goal.minMinutes, hi = settings.goal.maxMinutes;
    if (mins <= 0) return '';
    if (hi > 0 && mins > hi) return 'over';
    if (lo > 0 && mins < lo) return 'under';
    return 'in';
  }
  function renderCalendar(h, settled) {
    if (h) calData = { h, settled: settled || {} };
    const { y, m } = calView;
    document.getElementById('cal-title').textContent = `${y} 年 ${m + 1} 月`;
    calEl.textContent = '';
    ['一', '二', '三', '四', '五', '六', '日'].forEach((t) => calEl.appendChild(el('div', { className: 'cal-h', textContent: t })));
    const first = (new Date(y, m, 1).getDay() + 6) % 7; // 周一为一周起点
    const days = new Date(y, m + 1, 0).getDate();
    const now = new Date();
    const todayK = dayKey(now.getFullYear(), now.getMonth(), now.getDate());
    for (let i = 0; i < first; i++) calEl.appendChild(el('div', { className: 'cal-d blank' }));
    for (let d = 1; d <= days; d++) {
      const k = dayKey(y, m, d);
      const mins = dayMinutes(k);
      const st = dayState(mins);
      const btn = el('button', { type: 'button', className: ['cal-d', st, k === todayK ? 'today' : '', k === calSel ? 'sel' : ''].filter(Boolean).join(' ') });
      btn.appendChild(el('span', { className: 'n', textContent: d }));
      btn.appendChild(el('span', { className: 'm', textContent: mins > 0 ? XPET.fmtDur(mins) : '' }));
      btn.addEventListener('click', () => { calSel = k; showCalDetail(k); renderCalendar(); });
      calEl.appendChild(btn);
    }
    if (calSel) showCalDetail(calSel);
    // 本月合计
    const sum = { post: 0, like: 0, bookmark: 0, repost: 0, follow: 0, scroll: 0, mins: 0, xp: 0, days: 0, inRange: 0 };
    for (let d = 1; d <= days; d++) {
      const k = dayKey(y, m, d), x = calData.h[k], sx = calData.settled[k], mins = dayMinutes(k);
      if (x) ['post', 'like', 'bookmark', 'repost', 'follow', 'scroll'].forEach((f) => { sum[f] += x[f] || 0; });
      if (sx) sum.xp += sx.xp || 0;
      if (mins > 0) { sum.days++; sum.mins += mins; if (dayState(mins) === 'in') sum.inRange++; }
    }
    document.getElementById('cal-month').textContent = sum.days
      ? `本月合计：${sum.days} 天有记录，${sum.inRange} 天在区间内 · 在线 ${XPET.fmtDur(sum.mins)}（日均 ${XPET.fmtDur(sum.mins / sum.days)}）· 发 ${sum.post} · 赞 ${sum.like} · 藏 ${sum.bookmark} · 转 ${sum.repost} · 关注 ${sum.follow} · 滚动约 ${XPET.fmtScroll(sum.scroll)} · 经验 +${sum.xp}`
      : '本月还没有记录';
    const lo = settings.goal.minMinutes, hi = settings.goal.maxMinutes;
    const rng = hi > 0 ? `${lo}–${hi} 分钟` : lo > 0 ? `${lo} 分钟以上` : '不限';
    document.getElementById('cal-legend').innerHTML =
      `<span><i style="background:color-mix(in srgb,var(--accent) 38%,var(--card))"></i>在你设的区间内（${rng}）</span>`
      + (lo > 0 ? '<span><i style="background:color-mix(in srgb,var(--accent) 14%,var(--card))"></i>还没到下限</span>' : '')
      + (hi > 0 ? '<span><i style="background:color-mix(in srgb,#c9a227 26%,var(--card))"></i>超出上限</span>' : '');
  }
  function showCalDetail(k) {
    const d = calData.h[k], s = calData.settled[k];
    const box = document.getElementById('cal-detail');
    if (!d && !s) { box.textContent = `${k}：没有记录`; return; }
    const parts = [`在线 ${XPET.fmtDur(dayMinutes(k))}`];
    if (d) {
      const did = [];
      if (d.post) did.push(`发 ${d.post}`); if (d.like) did.push(`赞 ${d.like}`); if (d.bookmark) did.push(`藏 ${d.bookmark}`);
      if (d.repost) did.push(`转 ${d.repost}`); if (d.follow) did.push(`关注 ${d.follow}`);
      if (did.length) parts.push(did.join(' · '));
      if (d.scroll) parts.push(`滚动约 ${XPET.fmtScroll(d.scroll)}`);
    }
    parts.push(s ? `经验 +${s.xp}` : '经验今晚结算');
    box.textContent = `${k}：` + parts.join('　');
  }
  document.getElementById('cal-prev').addEventListener('click', () => { calView = calView.m === 0 ? { y: calView.y - 1, m: 11 } : { y: calView.y, m: calView.m - 1 }; renderCalendar(); });
  document.getElementById('cal-next').addEventListener('click', () => { calView = calView.m === 11 ? { y: calView.y + 1, m: 0 } : { y: calView.y, m: calView.m + 1 }; renderCalendar(); });
  document.getElementById('cal-today').addEventListener('click', () => { const n = new Date(); calView = { y: n.getFullYear(), m: n.getMonth() }; renderCalendar(); });

  async function renderHistory() {
    const r = await chrome.storage.local.get([XPET.HIST_KEY, XPET.XP_KEY]);
    const h = r[XPET.HIST_KEY] || {};
    const settled = (r[XPET.XP_KEY] && r[XPET.XP_KEY].settled) || {};
    renderCalendar(h, settled);
    renderBook(r[XPET.XP_KEY]);
  }
  renderHistory();

  // ---------- 诊断 ----------
  const diagEl = document.getElementById('diag');
  const rawEl = document.getElementById('raw');
  const fmtTime = (t) => new Date(t).toLocaleString();
  async function renderDiag() {
    const r = await chrome.storage.local.get([XPET.STATUS_KEY, XPET.HIST_KEY]);
    const st = r[XPET.STATUS_KEY];
    const ver = chrome.runtime.getManifest().version;
    const lines = [`当前扩展版本：${ver}`];
    if (!st || !st.loadedAt) {
      lines.push('推特页面上还没有检测到本扩展的脚本在运行。请先在 chrome://extensions 点刷新扩展，再回到 x.com 刷新页面（只刷新扩展不刷新页面是不够的）。');
    } else {
      lines.push(`推特页面上脚本版本：${st.version || '未知'}，最近一次加载：${fmtTime(st.loadedAt)}${st.version && st.version !== ver ? '（与当前扩展版本不一致，请刷新 x.com 页面）' : ''}`);
      lines.push(st.lastActionAt ? `最近一次识别到的互动：${st.lastAction}，${fmtTime(st.lastActionAt)}` : '还没有识别到任何点赞/收藏/转发/关注/发推动作');
      if (st.unmatchedTestid) lines.push(`发现可能没被识别的按钮：data-testid="${st.unmatchedTestid}"（${fmtTime(st.unmatchedAt)}）。把这个值发给开发者，说明推特改了写法。`);
    }
    diagEl.textContent = '';
    lines.forEach((t) => diagEl.appendChild(el('li', { textContent: t })));
    rawEl.textContent = JSON.stringify(r[XPET.HIST_KEY] || {}, null, 2);
  }
  renderDiag();

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes[XPET.HIST_KEY]) renderHistory();
    if (changes[XPET.HIST_KEY] || changes[XPET.STATUS_KEY]) renderDiag();
  });
  // ---------- 备份：导出 / 导入（扩展换文件夹或重装后数据会丢，先备份） ----------
  const BACKUP_KEYS = [XPET.KEYS.chars, XPET.KEYS.active, XPET.SEED_KEY, XPET.HIST_KEY, XPET.XP_KEY, XPET.SETTINGS_KEY];
  document.getElementById('backup-export').addEventListener('click', async () => {
    const all = await chrome.storage.local.get(null);
    const data = {};
    Object.keys(all).forEach((k) => { if (BACKUP_KEYS.includes(k) || k.startsWith(XPET.SPRITE_PREFIX)) data[k] = all[k]; });
    const blob = new Blob([JSON.stringify({ app: 'x-pet', version: chrome.runtime.getManifest().version, exportedAt: new Date().toISOString(), data })], { type: 'application/json' });
    const a = el('a', { href: URL.createObjectURL(blob), download: `x-pet-backup-${new Date().toISOString().slice(0, 10)}.json` });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    showStatus('已导出备份', true);
  });
  const backupFile = document.getElementById('backup-file');
  document.getElementById('backup-import').addEventListener('click', () => backupFile.click());
  backupFile.addEventListener('change', async () => {
    const f = backupFile.files && backupFile.files[0];
    backupFile.value = '';
    if (!f) return;
    try {
      const obj = JSON.parse(await f.text());
      const d = obj && obj.app === 'x-pet' && obj.data;
      const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
      if (!isObj(d)) throw new Error('不是 X 桌宠的备份文件');
      const out = {};
      if (d[XPET.KEYS.chars] !== undefined) { if (!Array.isArray(d[XPET.KEYS.chars])) throw new Error('角色数据格式不对'); out[XPET.KEYS.chars] = d[XPET.KEYS.chars]; }
      if (typeof d[XPET.KEYS.active] === 'string') out[XPET.KEYS.active] = d[XPET.KEYS.active];
      if (Array.isArray(d[XPET.SEED_KEY])) out[XPET.SEED_KEY] = d[XPET.SEED_KEY];
      [XPET.HIST_KEY, XPET.XP_KEY, XPET.SETTINGS_KEY].forEach((k) => { if (d[k] !== undefined) { if (!isObj(d[k])) throw new Error('数据格式不对：' + k); out[k] = d[k]; } });
      Object.keys(d).forEach((k) => { if (k.startsWith(XPET.SPRITE_PREFIX) && typeof d[k] === 'string' && d[k].startsWith('data:image/')) out[k] = d[k]; });
      if (!Object.keys(out).length) throw new Error('备份里没有可导入的内容');
      if (!confirm('导入会覆盖当前的角色、历史统计、经验和设置，确定吗？')) return;
      await chrome.storage.local.set(out);
      location.reload();
    } catch (e) {
      showStatus('导入失败：' + (e && e.message ? e.message : '文件无法读取'), false);
    }
  });

  document.getElementById('clear-hist').addEventListener('click', async () => {
    if (!confirm('确定清除所有历史统计数据吗？此操作无法撤销。')) return;
    await chrome.storage.local.remove(XPET.HIST_KEY);
    renderHistory();
  });
})();
