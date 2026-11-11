(async () => {
  const $ = (id) => document.getElementById(id);
  const listEl = $('list');
  const statusEl = $('status');
  let { chars, active } = await XPET.load();

  // 累计陪伴天数（装扮、日记的解锁条件）
  let xpDays = 0;
  const daysOf = (rec) => (rec && Number.isFinite(rec.daysTotal) ? rec.daysTotal : rec && rec.settled ? Object.keys(rec.settled).length : 0);
  async function loadXp() {
    const r = await chrome.storage.local.get(XPET.XP_KEY);
    xpDays = daysOf(r[XPET.XP_KEY]);
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
    else avatar.textContent = c.look === 'teddy' ? '🐶' : c.look === 'cat' ? '🐱' : c.look === 'doge' ? '🐕' : c.look === 'pepe' ? '🐸' : c.look === 'chabit' ? '🧸' : '🟢';

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

    // 内置形象选择（没有上传自己的图片时使用）
    const lookRow = el('div', { className: 'acc-row' });
    lookRow.appendChild(el('span', { textContent: '内置形象：' }));
    const lookSel = el('select');
    [['chabit', '🧸 小桌宠']].forEach(([v, t]) => lookSel.appendChild(el('option', { value: v, textContent: t })));
    lookSel.value = c.look || 'chabit';
    lookSel.addEventListener('change', () => { c.look = lookSel.value; render(); saveNow(); });
    lookRow.appendChild(el('span', { className: 'hint', textContent: '　上传了自己的图片后，以图片为准' }));
    lookRow.insertBefore(lookSel, lookRow.lastChild);
    card.appendChild(lookRow);

    // 工位伴侣装备：用累计陪伴天数解锁（自动解锁，不需要领取）
    if (XPET.ACCESSORIES_ENABLED) {
      const accRow = el('div', { className: 'acc-row' });
      accRow.appendChild(el('span', { textContent: '工位伴侣装备：' }));
      const sel = el('select');
      XPET.ACCESSORIES.forEach((a) => {
        const locked = a.need > xpDays;
        sel.appendChild(el('option', {
          value: a.id,
          disabled: locked,
          textContent: `${a.icon} ${a.name}`.trim() + (locked ? `（陪伴满 ${a.need} 天解锁）` : ''),
        }));
      });
      sel.value = c.accessory || 'none';
      sel.addEventListener('change', () => { c.accessory = sel.value; saveSoon(); });
      accRow.appendChild(sel);
      accRow.appendChild(el('span', { className: 'hint', textContent: `　已陪伴 ${xpDays} 天 · 摆在宠物身前桌角` }));
      card.appendChild(accRow);
    }

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

    const aiCardBtn = el('button', { textContent: '✨ AI 定制此角色台词', className: 'primary' });
    aiCardBtn.addEventListener('click', () => {
      openAiModal(c.id);
    });
    const resetBtn = el('button', { textContent: '恢复默认台词', className: 'btn-subtle' });
    resetBtn.addEventListener('click', () => {
      if (!confirm('把这个角色的所有台词恢复为默认吗？')) return;
      c.phrases = XPET.defaultPhrases();
      render();
      saveNow();
    });
    card.appendChild(el('div', { className: 'foot' }, [aiCardBtn, resetBtn]));
    return card;
  }

  document.getElementById('add').addEventListener('click', () => {
    const id = 'c' + Date.now().toString(36);
    chars.push({ id, name: '新角色', img: null, look: 'chabit', accessory: 'none', size: XPET.DEFAULT_SIZE, phrases: XPET.defaultPhrases() });
    render();
    saveNow();
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  });

  render();

  // ---------- AI 设定与台词弹窗控制器 ----------
  const aiModal = $('ai-modal');
  const aiModalOpenBtn = $('ai-modal-open-btn');
  const aiModalClose = $('ai-modal-close');
  const aiPresetPills = $('ai-preset-pills');
  const aiLookSel = $('ai-look-sel');
  const aiNameInput = $('ai-name-input');
  const aiIncludeSlots = $('ai-include-slots');
  const aiPersonaInput = $('ai-persona-input');
  const aiCustomInput = $('ai-custom-input');
  const aiPromptPreview = $('ai-prompt-preview');
  const aiCopyPromptBtn = $('ai-copy-prompt-btn');
  const aiImportInput = $('ai-import-input');
  const aiTargetSel = $('ai-target-sel');
  const aiSyncSlots = $('ai-sync-slots');
  const aiImportMsg = $('ai-import-msg');
  const aiImportApplyBtn = $('ai-import-apply-btn');

  let activePresetId = null;

  function updateAiPrompt() {
    if (!aiPromptPreview) return;
    const prompt = XPET.AI.buildPrompt({
      look: aiLookSel.value,
      name: aiNameInput.value,
      persona: aiPersonaInput.value,
      custom: aiCustomInput.value,
      includeSlots: aiIncludeSlots.checked,
    });
    aiPromptPreview.value = prompt;
  }

  function applyPreset(p) {
    activePresetId = p.id;
    aiLookSel.value = p.look;
    aiNameInput.value = p.charName;
    aiPersonaInput.value = p.persona;
    aiCustomInput.value = p.custom;
    renderPresets();
    updateAiPrompt();
  }

  function renderPresets() {
    if (!aiPresetPills) return;
    aiPresetPills.innerHTML = '';
    XPET.AI.PERSONAS.forEach((p) => {
      const btn = el('button', {
        type: 'button',
        className: 'preset-pill' + (activePresetId === p.id ? ' active' : ''),
        textContent: p.name,
      });
      btn.addEventListener('click', () => applyPreset(p));
      aiPresetPills.appendChild(btn);
    });
  }

  function openAiModal(targetCharId = null) {
    if (!aiModal) return;
    aiTargetSel.innerHTML = '';
    aiTargetSel.appendChild(el('option', { value: '__new__', textContent: '➕ 创建为全新角色' }));
    chars.forEach((c) => {
      const isCur = c.id === active;
      const opt = el('option', {
        value: c.id,
        textContent: `覆盖角色：${c.name} (${XPET.AI.LOOK_NAMES[c.look] || c.look})` + (isCur ? ' [当前活跃]' : ''),
      });
      aiTargetSel.appendChild(opt);
    });

    if (targetCharId && chars.some((c) => c.id === targetCharId)) {
      aiTargetSel.value = targetCharId;
      const targetChar = chars.find((c) => c.id === targetCharId);
      aiLookSel.value = targetChar.look || 'chabit';
      aiNameInput.value = targetChar.name || '';
      activePresetId = null;
    } else {
      aiTargetSel.value = '__new__';
      if (!activePresetId) {
        applyPreset(XPET.AI.PERSONAS[0]);
      }
    }

    renderPresets();
    updateAiPrompt();
    aiImportMsg.style.display = 'none';
    aiModal.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closeAiModal() {
    if (!aiModal) return;
    aiModal.hidden = true;
    document.body.style.overflow = '';
  }

  if (aiModalOpenBtn) aiModalOpenBtn.addEventListener('click', () => openAiModal());
  if (aiModalClose) aiModalClose.addEventListener('click', closeAiModal);
  if (aiModal) {
    aiModal.addEventListener('click', (e) => { if (e.target === aiModal) closeAiModal(); });
  }
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && aiModal && !aiModal.hidden) closeAiModal();
  });

  if (aiCopyPromptBtn) {
    aiCopyPromptBtn.addEventListener('click', async () => {
      updateAiPrompt();
      try {
        await navigator.clipboard.writeText(aiPromptPreview.value);
        const oldTxt = aiCopyPromptBtn.textContent;
        aiCopyPromptBtn.textContent = '✅ 已成功复制 Prompt！';
        setTimeout(() => { aiCopyPromptBtn.textContent = oldTxt; }, 2000);
      } catch (e) {
        aiPromptPreview.select();
        document.execCommand('copy');
        alert('Prompt 已选中并复制！');
      }
    });
  }

  [aiLookSel, aiNameInput, aiIncludeSlots, aiPersonaInput, aiCustomInput].forEach((elem) => {
    if (elem) elem.addEventListener('input', updateAiPrompt);
    if (elem && elem.tagName === 'SELECT') elem.addEventListener('change', updateAiPrompt);
  });

  // ---------- 显示与提醒设置 ----------
  const settings = await XPET.loadSettings();

  if (aiImportApplyBtn) {
    aiImportApplyBtn.addEventListener('click', async () => {
      const rawText = aiImportInput.value;
      const res = XPET.AI.parseOutput(rawText);
      if (!res.ok) {
        aiImportMsg.className = 'ai-msg err';
        aiImportMsg.textContent = '❌ ' + res.error;
        aiImportMsg.style.display = 'block';
        return;
      }

      const { data, stats } = res;
      const target = aiTargetSel.value;
      let appliedCharName = data.name;

      if (target === '__new__') {
        const id = 'c' + Date.now().toString(36);
        const newChar = {
          id,
          name: data.name,
          img: null,
          look: data.look,
          accessory: 'none',
          size: XPET.DEFAULT_SIZE,
          sprites: {},
          phrases: data.phrases,
        };
        chars.push(newChar);
        active = id;
      } else {
        const c = chars.find((x) => x.id === target);
        if (c) {
          c.name = data.name || c.name;
          c.look = data.look || c.look;
          c.phrases = data.phrases;
          appliedCharName = c.name;
        }
      }

      // 同步时段问候（如果勾选且存在）
      let slotMsg = '';
      if (aiSyncSlots.checked && Array.isArray(data.slots) && data.slots.length > 0) {
        settings.greeting = settings.greeting || { enabled: true, slots: XPET.defaultSlots() };
        settings.greeting.slots = settings.greeting.slots || XPET.defaultSlots();
        data.slots.forEach((newSlot) => {
          const exist = settings.greeting.slots.find((s) => s.id === newSlot.id);
          if (exist) {
            exist.lines = newSlot.lines;
          } else {
            const rangeMap = { dawn: [0, 5], morning: [5, 11], noon: [11, 14], evening: [18, 24] };
            const [start, end] = rangeMap[newSlot.id] || [8, 10];
            settings.greeting.slots.push({ id: newSlot.id, name: newSlot.name, start, end, lines: newSlot.lines });
          }
        });
        try {
          await XPET.saveSettings(settings);
          if (typeof renderSlots === 'function') renderSlots();
          slotMsg = `，并同步更新了 ${data.slots.length} 个时段问候`;
        } catch (_) {}
      }

      render();
      saveNow();

      const filterNote = stats.filteredCount > 0 ? `（已按语气规范自动过滤 ${stats.filteredCount} 句说教/第二人称台词）` : '';
      aiImportMsg.className = 'ai-msg ok';
      aiImportMsg.textContent = `🎉 成功导入角色「${appliedCharName}」！共导入 ${stats.actionCount} 类动作台词（${stats.lineCount} 条）${slotMsg}${filterNote}。修改已实时保存生效！`;
      aiImportMsg.style.display = 'block';

      setTimeout(() => {
        closeAiModal();
        showStatus(`已成功导入角色「${appliedCharName}」全套 AI 台词`, true);
      }, 1500);
    });
  }
  const itemBoxes = Array.from(document.querySelectorAll('#s-items input[data-item]'));
  const intIn = (el, min, max, fallback) => {
    const v = Math.floor(Number(el.value));
    return Number.isFinite(v) && v >= min && v <= max ? v : fallback;
  };

  function syncSettingsUI() {
    $('s-chipMode').value = settings.chipMode;
    itemBoxes.forEach((b) => { b.checked = !!settings.chipItems[b.dataset.item]; });
    const r = settings.reminders;
    $('s-night').checked = r.night;
    $('s-nightStart').value = r.nightStart;
    $('s-nightEnd').value = r.nightEnd;
    $('s-nightStart').disabled = $('s-nightEnd').disabled = !r.night;
    $('p-rhythm').value = settings.profile.rhythm;
    $('p-talk').value = settings.profile.talk;
    $('p-voice').value = settings.profile.voice;
    const sites = settings.sites || {};
    $('site-x').checked = sites.x !== false;
    $('site-binance').checked = sites.binance !== false;
    $('site-okx').checked = sites.okx !== false;
    // 背景场景 UI 初始化与同步
    const sc = settings.scene || { mode: 'off', id: 'rain' };
    $('s-sceneMode').value = sc.mode || 'off';
    const sceneRow = $('s-sceneManualRow');
    if (sceneRow) sceneRow.style.display = sc.mode === 'manual' ? 'flex' : 'none';
    const sceneSel = $('s-sceneId');
    if (sceneSel && sceneSel.options.length === 0) {
      XPET.SCENES.forEach((s) => {
        sceneSel.appendChild(el('option', { value: s.id, textContent: `${s.label} (${s.id})` }));
      });
    }
    if (sceneSel) sceneSel.value = sc.id || 'rain';

    const ap = settings.appearance || {};
    $('s-opacity').value = ap.opacity !== undefined ? ap.opacity : 100;
    $('s-opacityVal').textContent = (ap.opacity !== undefined ? ap.opacity : 100) + '%';
    $('s-bubbleTime').value = String(ap.bubbleTime || 2500);
    $('s-sound').checked = !!ap.sound;
    $('s-hotkey').checked = ap.hotkey !== false;
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
    try { await XPET.saveSettings(settings); showStatus('已保存', true); try { renderCalendar(); } catch (_) {} }
    catch (e) { showStatus('保存失败，请稍后重试', false); }
  }
  const bindCheck = (id, fn) => $(id).addEventListener('change', (e) => { fn(e.target.checked); syncSettingsUI(); saveSettingsNow(); });
  const bindNum = (id, min, max, getCur, set) => $(id).addEventListener('change', (e) => {
    set(intIn(e.target, min, max, getCur()));
    syncSettingsUI();
    saveSettingsNow();
  });

  bindCheck('site-x', (v) => { settings.sites = settings.sites || {}; settings.sites.x = v; });
  bindCheck('site-binance', (v) => { settings.sites = settings.sites || {}; settings.sites.binance = v; });
  bindCheck('site-okx', (v) => { settings.sites = settings.sites || {}; settings.sites.okx = v; });

  // 背景场景事件绑定
  $('s-sceneMode').addEventListener('change', (e) => {
    settings.scene = settings.scene || {};
    settings.scene.mode = e.target.value;
    syncSettingsUI();
    saveSettingsNow();
  });
  $('s-sceneId').addEventListener('change', (e) => {
    settings.scene = settings.scene || {};
    settings.scene.id = e.target.value;
    saveSettingsNow();
  });

  $('s-chipMode').addEventListener('change', (e) => { settings.chipMode = e.target.value; saveSettingsNow(); });
  itemBoxes.forEach((b) => b.addEventListener('change', () => { settings.chipItems[b.dataset.item] = b.checked; saveSettingsNow(); }));
  $('s-opacity').addEventListener('input', (e) => {
    const v = intIn(e.target, 30, 100, 100);
    $('s-opacityVal').textContent = v + '%';
    settings.appearance = settings.appearance || {};
    settings.appearance.opacity = v;
    saveSettingsNow();
  });
  $('s-bubbleTime').addEventListener('change', (e) => {
    const v = intIn(e.target, 1000, 8000, 2500);
    settings.appearance = settings.appearance || {};
    settings.appearance.bubbleTime = v;
    saveSettingsNow();
  });
  bindCheck('s-sound', (v) => { settings.appearance = settings.appearance || {}; settings.appearance.sound = v; });
  bindCheck('s-hotkey', (v) => { settings.appearance = settings.appearance || {}; settings.appearance.hotkey = v; });
  bindCheck('s-night', (v) => { settings.reminders.night = v; });
  bindNum('s-nightStart', 0, 23, () => settings.reminders.nightStart, (v) => { settings.reminders.nightStart = v; });
  bindNum('s-nightEnd', 0, 23, () => settings.reminders.nightEnd, (v) => { settings.reminders.nightEnd = v; });
  bindCheck('s-back', (v) => { settings.back.enabled = v; });
  bindNum('s-backMin', 10, 720, () => settings.back.minutes, (v) => { settings.back.minutes = v; });
  bindCheck('s-milestone', (v) => { settings.milestone = v; });
  bindCheck('s-stories', (v) => { settings.stories.enabled = v; });
  bindCheck('s-holiday', (v) => { settings.holidays.enabled = v; });
  // 画像：作息和话多话少选完立刻生效；语气要点按钮才会套到当前角色（会覆盖该角色里对应的几组台词）
  const RHYTHM_WINDOW = { owl: [3, 6], normal: [1, 5], early: [23, 5] };
  $('p-rhythm').addEventListener('change', (e) => {
    settings.profile.rhythm = e.target.value;
    const w = RHYTHM_WINDOW[e.target.value];
    if (w) { settings.reminders.nightStart = w[0]; settings.reminders.nightEnd = w[1]; }
    syncSettingsUI();
    saveSettingsNow();
  });
  $('p-talk').addEventListener('change', (e) => { settings.profile.talk = e.target.value; saveSettingsNow(); });
  $('p-voice').addEventListener('change', (e) => { settings.profile.voice = e.target.value; saveSettingsNow(); });
  $('p-apply').addEventListener('click', () => {
    const c = chars.find((x) => x.id === active) || chars[0];
    if (!c) return;
    const vn = $('p-voice').selectedOptions[0].textContent;
    if (!confirm(`把「${vn}」语气套到角色「${c.name}」吗？会覆盖该角色里点击、发文、点赞、收藏、转发、关注、深夜、回来这几组台词（其他台词不动）。`)) return;
    XPET.applyVoice(c, settings.profile.voice);
    render();
    saveNow();
    $('p-msg').textContent = `已套用到「${c.name}」。`;
  });
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

  // ---------- 宠物的日记：已解锁的显示全文，没解锁的只显示还差几天 ----------
  function renderBook(rec) {
    const days = daysOf(rec);
    const fill = (t) => t.replace(/\{days\}/g, days);
    const open = XPET.STORIES.filter((s) => s.need <= days).length;
    $('book-sum').textContent = `宠物的日记（已写 ${open} / ${XPET.STORIES.length} 页）`;
    const box = $('book-list');
    box.textContent = '';
    XPET.STORIES.forEach((s, i) => {
      const item = el('div', { className: 'book-item' + (s.need <= days ? '' : ' locked') });
      if (s.need <= days) {
        item.appendChild(el('div', { className: 'book-title', textContent: `${i + 1}. ${s.title}` }));
        item.appendChild(el('div', { className: 'book-text', textContent: fill(s.text) }));
      } else {
        item.appendChild(el('div', { className: 'book-title', textContent: `🔒 第 ${i + 1} 页　再陪 ${s.need - days} 天解锁` }));
      }
      box.appendChild(item);
    });
  }
  async function loadBook() { const r = await chrome.storage.local.get(XPET.XP_KEY); renderBook(r[XPET.XP_KEY]); }

  // ---------- 日历：每天的在线时长，有记录的日子上色（不和任何区间比较，没有对错） ----------
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
    return mins > 0 ? 'in' : '';
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
    const sum = { post: 0, like: 0, bookmark: 0, repost: 0, follow: 0, scroll: 0, mins: 0, days: 0 };
    const siteMins = { x: 0, binance: 0, okx: 0 };
    const siteAgg = { x: {}, binance: {}, okx: {} };
    for (let d = 1; d <= days; d++) {
      const k = dayKey(y, m, d), x = calData.h[k], sx = calData.settled[k], mins = dayMinutes(k);
      if (x) {
        ['post', 'like', 'bookmark', 'repost', 'follow', 'scroll'].forEach((f) => { sum[f] += x[f] || 0; });
        if (x.bySite) {
          ['x', 'binance', 'okx'].forEach((sk) => {
            const bs = x.bySite[sk];
            if (!bs) return;
            if (bs.seconds) siteMins[sk] += Math.floor(bs.seconds / 60);
            ['post', 'like', 'bookmark', 'repost', 'follow'].forEach((f) => { siteAgg[sk][f] = (siteAgg[sk][f] || 0) + (bs[f] || 0); });
          });
        }
      }
      if (mins > 0) { sum.days++; sum.mins += mins; }
    }
    const siteLabels = (XPET && XPET.SITE_NAMES) || { x: '𝕏 推特', binance: '🟡 币安广场', okx: '🔵 OK星球' };
    const monthBox = document.getElementById('cal-month');
    monthBox.textContent = '';
    if (!sum.days) {
      monthBox.textContent = '本月还没有记录';
    } else {
      const cell = (k, v) => el('div', { className: 'stat-cell' }, [el('b', { textContent: String(v) }), el('span', { textContent: k })]);
      monthBox.appendChild(el('div', { className: 'stat-head', textContent: `本月合计 · ${sum.days} 天有记录` }));
      monthBox.appendChild(el('div', { className: 'stat-grid' }, [
        cell('在线', XPET.fmtDur(sum.mins)), cell('日均', XPET.fmtDur(sum.mins / sum.days)),
        cell('滚动', '约 ' + XPET.fmtScroll(sum.scroll)), cell('一起', xpDays + ' 天'),
        cell('发文/回复', sum.post), cell('点赞', sum.like), cell('收藏', sum.bookmark),
        cell('转发/引用', sum.repost), cell('关注', sum.follow),
      ]));
      ['x', 'binance', 'okx'].forEach((sk) => {
        const a = siteAgg[sk];
        if (!(siteMins[sk] > 0) && !['post', 'like', 'bookmark', 'repost', 'follow'].some((f) => a[f])) return;
        const acts = [['发', 'post'], ['赞', 'like'], ['藏', 'bookmark'], ['转', 'repost'], ['关注', 'follow']]
          .filter(([, f]) => a[f]).map(([t, f]) => `${t} ${a[f]}`).join(' · ') || '无互动';
        monthBox.appendChild(el('div', { className: 'stat-site' }, [
          el('b', { textContent: siteLabels[sk] }),
          el('span', { textContent: siteMins[sk] > 0 ? XPET.fmtDur(siteMins[sk]) : '—' }),
          el('span', { textContent: acts }),
        ]));
      });
    }
    document.getElementById('cal-legend').innerHTML =
      '<span><i style="background:color-mix(in srgb,var(--accent) 38%,var(--card))"></i>这天有陪伴记录</span>';
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
    // 分站明细
    const siteLines = [];
    const bs = d && d.bySite;
    if (bs) {
      const siteLabels = (XPET && XPET.SITE_NAMES) || { x: '𝕏 推特', binance: '🟡 币安广场', okx: '🔵 OK星球' };
      ['x', 'binance', 'okx'].forEach((key) => {
        const item = bs[key];
        if (item && ((item.seconds && item.seconds >= 30) || item.post || item.like || item.bookmark || item.repost || item.follow)) {
          const itemMins = Math.floor((item.seconds || 0) / 60);
          const iParts = [];
          if (itemMins > 0) iParts.push(`时长 ${XPET.fmtDur(itemMins)}`);
          if (item.post) iParts.push(`发 ${item.post}`);
          if (item.like) iParts.push(`赞 ${item.like}`);
          if (item.bookmark) iParts.push(`藏 ${item.bookmark}`);
          if (item.repost) iParts.push(`转 ${item.repost}`);
          if (item.follow) iParts.push(`关注 ${item.follow}`);
          siteLines.push(`${siteLabels[key]}　${iParts.join(' · ')}`);
        }
      });
    }

    box.textContent = '';
    box.appendChild(el('div', { className: 'detail-head', textContent: `${k}　${parts.join(' · ')}` }));
    siteLines.forEach((l) => box.appendChild(el('div', { className: 'detail-site', textContent: l })));
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
    // 监听 SETTINGS_KEY 变化（如在网页右键菜单切换场景或今天安静），实时同步给 options 内存状态，避免被后续保存冲掉
    if (changes[XPET.SETTINGS_KEY] && changes[XPET.SETTINGS_KEY].newValue) {
      const ns = XPET.mergeSettings(changes[XPET.SETTINGS_KEY].newValue);
      settings.scene = ns.scene;
      settings.quietUntil = ns.quietUntil;
      syncSettingsUI();
    }
  });
  // ---------- 备份：导出 / 导入（扩展换文件夹或重装后数据会丢，先备份） ----------
  const BACKUP_KEYS = [XPET.KEYS.chars, XPET.KEYS.active, XPET.SEED_KEY, XPET.RETIRED_KEY, XPET.HIST_KEY, XPET.XP_KEY, XPET.SETTINGS_KEY];
  document.getElementById('backup-export').addEventListener('click', async () => {
    const all = await chrome.storage.local.get(null);
    const data = {};
    Object.keys(all).forEach((k) => { if (BACKUP_KEYS.includes(k) || k.startsWith(XPET.SPRITE_PREFIX)) data[k] = all[k]; });
    const blob = new Blob([JSON.stringify({ app: 'ccbd', version: chrome.runtime.getManifest().version, exportedAt: new Date().toISOString(), data })], { type: 'application/json' });
    const a = el('a', { href: URL.createObjectURL(blob), download: `ccbd-backup-${new Date().toISOString().slice(0, 10)}.json` });
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
      const d = obj && (obj.app === 'ccbd' || obj.app === 'x-pet') && obj.data;
      const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
      if (!isObj(d)) throw new Error('不是 CCbd 伴宠的备份文件');
      const out = {};
      if (d[XPET.KEYS.chars] !== undefined) { if (!Array.isArray(d[XPET.KEYS.chars])) throw new Error('角色数据格式不对'); out[XPET.KEYS.chars] = d[XPET.KEYS.chars]; }
      if (typeof d[XPET.KEYS.active] === 'string') out[XPET.KEYS.active] = d[XPET.KEYS.active];
      if (Array.isArray(d[XPET.SEED_KEY])) out[XPET.SEED_KEY] = d[XPET.SEED_KEY];
      if (isObj(d[XPET.RETIRED_KEY])) out[XPET.RETIRED_KEY] = d[XPET.RETIRED_KEY];
      [XPET.HIST_KEY, XPET.XP_KEY, XPET.SETTINGS_KEY].forEach((k) => { if (d[k] !== undefined) { if (!isObj(d[k])) throw new Error('数据格式不对：' + k); out[k] = d[k]; } });
      Object.keys(d).forEach((k) => { if (k.startsWith(XPET.SPRITE_PREFIX) && typeof d[k] === 'string' && d[k].startsWith('data:image/')) out[k] = d[k]; });
      if (!Object.keys(out).length) throw new Error('备份里没有可导入的内容');
      if (!confirm('导入会覆盖当前的角色、历史统计、陪伴天数和设置，确定吗？')) return;
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

