// popup.js: CCbd 伴宠快捷开关弹窗面板
(async function () {
  'use strict';

  const tabStatusEl = document.getElementById('tab-status');
  const tabTextEl = document.getElementById('tab-text');
  const checkX = document.getElementById('pop-x');
  const checkBinance = document.getElementById('pop-binance');
  const checkOkx = document.getElementById('pop-okx');
  const btnReload = document.getElementById('btn-reload');
  const btnOptions = document.getElementById('btn-options');

  let currentTab = null;
  let settings = null;

  // 1. 获取当前正在浏览的标签页
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs && tabs.length > 0) {
      currentTab = tabs[0];
    }
  } catch (err) {
    console.warn('[CCbd Popup] 获取当前标签页失败:', err);
  }

  // 2. 加载伴宠配置
  try {
    settings = await XPET.loadSettings();
  } catch (err) {
    settings = XPET.defaultSettings();
  }

  const sites = settings.sites || { x: true, binance: true, okx: true };
  checkX.checked = sites.x !== false;
  checkBinance.checked = sites.binance !== false;
  checkOkx.checked = sites.okx !== false;

  // 3. 渲染当前标签页状态
  function renderTabStatus() {
    if (!currentTab || !currentTab.url) {
      tabStatusEl.className = 'status-card inactive';
      tabTextEl.textContent = '未检测到活跃网页';
      return;
    }
    const url = currentTab.url.toLowerCase();
    let siteKey = null;
    let siteName = '';

    if (url.includes('x.com') || url.includes('twitter.com')) {
      siteKey = 'x';
      siteName = '𝕏 推特';
    } else if (url.includes('binance.com')) {
      siteKey = 'binance';
      siteName = '🟡 币安广场';
    } else if (url.includes('okx.') || url.includes('ouyi.')) {
      siteKey = 'okx';
      siteName = '🔵 OK星球/社区';
    }

    if (siteKey) {
      const isEnabled = settings.sites && settings.sites[siteKey] !== false;
      if (isEnabled) {
        tabStatusEl.className = 'status-card active';
        tabTextEl.innerHTML = `当前页面：<b>${siteName}</b>（伴宠已启用）`;
      } else {
        tabStatusEl.className = 'status-card inactive';
        tabTextEl.innerHTML = `当前页面：<b>${siteName}</b>（已关闭，勾选后刷新）`;
      }
    } else {
      tabStatusEl.className = 'status-card inactive';
      tabTextEl.textContent = '当前标签页非推特/币安/OK星球页面';
    }
  }

  renderTabStatus();

  // 4. 开关切换保存
  async function updateSiteSetting(key, checked) {
    if (!settings.sites) {
      settings.sites = { x: true, binance: true, okx: true };
    }
    settings.sites[key] = checked;
    await XPET.saveSettings(settings);
    renderTabStatus();
  }

  checkX.addEventListener('change', () => updateSiteSetting('x', checkX.checked));
  checkBinance.addEventListener('change', () => updateSiteSetting('binance', checkBinance.checked));
  checkOkx.addEventListener('change', () => updateSiteSetting('okx', checkOkx.checked));

  // 5. 立即刷新当前标签页
  btnReload.addEventListener('click', () => {
    if (currentTab && currentTab.id) {
      try {
        chrome.tabs.reload(currentTab.id);
        const originalText = btnReload.textContent;
        btnReload.textContent = '✅ 已触发刷新！';
        btnReload.style.backgroundColor = '#00ba7c';
        setTimeout(() => {
          btnReload.textContent = originalText;
          btnReload.style.backgroundColor = '';
        }, 1200);
      } catch (e) {
        console.error('刷新标签页失败:', e);
      }
    }
  });

  // 6. 打开完整设置页
  btnOptions.addEventListener('click', () => {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open(chrome.runtime.getURL('options.html'));
    }
    window.close();
  });

  // 7. 渲染今日统计数据（双层统计：总数 + 分站明细）
  async function renderTodayStats() {
    const totalEl = document.getElementById('pop-today-total');
    const sitesEl = document.getElementById('pop-today-sites');
    if (!totalEl || !sitesEl) return;

    try {
      const res = await chrome.storage.local.get(XPET.HIST_KEY);
      const h = res[XPET.HIST_KEY] || {};
      const d = new Date();
      const p = (n) => String(n).padStart(2, '0');
      const todayK = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
      const todayData = h[todayK] || {};

      const totalMins = Math.floor((todayData.seconds || 0) / 60);
      totalEl.textContent = XPET.fmtDur(totalMins);

      const bs = todayData.bySite || {};
      const siteConfig = [
        { key: 'x', name: '𝕏', fullName: '推特' },
        { key: 'binance', name: '🟡', fullName: '币安广场' },
        { key: 'okx', name: '🔵', fullName: 'OK星球' },
      ];

      sitesEl.innerHTML = '';
      siteConfig.forEach(({ key, name, fullName }) => {
        const item = bs[key] || {};
        const mins = Math.floor((item.seconds || 0) / 60);
        const chip = document.createElement('span');
        chip.className = `site-chip chip-${key}` + (mins > 0 ? ' has-time' : '');
        chip.textContent = `${name} ${mins}分`;
        const details = [];
        if (item.post) details.push(`发 ${item.post}`);
        if (item.like) details.push(`赞 ${item.like}`);
        if (item.bookmark) details.push(`藏 ${item.bookmark}`);
        chip.title = `${fullName}：${XPET.fmtDur(mins)}` + (details.length ? ` (${details.join(' · ')})` : '');
        sitesEl.appendChild(chip);
      });
    } catch (e) {
      console.warn('获取今日统计失败', e);
    }
  }

  renderTodayStats();
})();
