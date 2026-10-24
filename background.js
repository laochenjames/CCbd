// 内容脚本不能直接打开设置页，需要通过后台脚本转一下
chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === 'openOptions') chrome.runtime.openOptionsPage();
});
