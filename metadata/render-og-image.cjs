const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  for (const [name, w, h, hideNav] of [['og-c',1600,840,true]]) {
    const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1.5 });
    await p.goto('http://127.0.0.1:5176/', { waitUntil: 'networkidle' });
    if (hideNav) await p.addStyleTag({ content: 'header{display:none!important}' });
    await p.waitForTimeout(1500);
    await p.screenshot({ path: name + '.png' });
    await p.close();
  }
  await b.close();
})();
