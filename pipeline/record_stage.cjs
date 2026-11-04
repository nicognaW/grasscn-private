// Render the launch stage frame by frame. Usage: node record_stage.cjs <launchDir> <from> <to> <outDir>
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const [dir, from, to, out] = [process.argv[2], +process.argv[3], +process.argv[4], process.argv[5]];
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  await p.route('**/__launch/**', (route) => {
    const rel = new URL(route.request().url()).pathname.replace('/__launch/', '');
    const file = path.join(dir, rel.startsWith('frames/') ? 'recorder' : '', rel);
    fs.existsSync(file) ? route.fulfill({ path: file, contentType: 'image/png' }) : route.fulfill({ status: 404 });
  });
  await p.goto(`http://127.0.0.1:5176/launch-video?pass=${process.env.PASS || 1}`, { waitUntil: 'networkidle', timeout: 300000 });
  await p.waitForFunction(() => typeof window.__setFrame === 'function');
  await p.waitForTimeout(3000);
  fs.writeFileSync(path.join(dir, 'sounds.json'), JSON.stringify(await p.evaluate(() => window.__sounds)));
  fs.writeFileSync(path.join(dir, 'montage.json'), JSON.stringify(await p.evaluate(() => { const [a, b] = window.__montage; const track = []; for (let n = a; n < b; n++) track.push(window.__track(n)); return { from: a, to: b, track, frames: window.__frames }; })));
  for (let f = from; f < to; f++) {
    const inp = await p.evaluate((n) => window.__input(n), f);
    await p.mouse.move(inp.x, inp.y);
    if (inp.down) await p.mouse.down();
    if (inp.up) await p.mouse.up();
    if (inp.type) await p.keyboard.type(inp.type);
    await p.evaluate(([n, x, y]) => window.__setFrame(n, [x, y]), [f, inp.x, inp.y]);
    if (f % (+process.env.STEP || 1) === 0) await p.screenshot({ path: path.join(out, `stage-${String(f).padStart(5, '0')}.png`) });
    if (f % 60 === 0) console.log('frame', f);
  }
  await b.close();
})();
