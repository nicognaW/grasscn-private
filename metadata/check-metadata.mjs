// Checks a site's share metadata the way X, Facebook, LinkedIn, Slack and Discord read it.
// Usage: node check-metadata.mjs <base-url> [path ...]
// Example: node check-metadata.mjs http://127.0.0.1:5176 / /docs /docs/components/button /charts
const [base, ...paths] = process.argv.slice(2);
if (!base) throw new Error("usage: node check-metadata.mjs <base-url> [path ...]");
const PROD = "https://grasscn.dev";
const local = (url) => url.replace(PROD, base.replace(/\/$/, ""));
let failures = 0;
const report = (ok, label, detail = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${detail ? `  (${detail})` : ""}`);
};
const attrs = (tag) =>
  Object.fromEntries([...tag.matchAll(/([\w:-]+)="([^"]*)"/g)].map((m) => [m[1].toLowerCase(), m[2]]));
const parse = (html) => {
  const head = html.slice(0, html.indexOf("</head>"));
  const meta = {};
  for (const [tag] of head.matchAll(/<meta\b[^>]*>/g)) {
    const a = attrs(tag);
    const key = a.property ?? a.name;
    if (key && a.content !== undefined) (meta[key] ??= []).push(a.content);
  }
  const links = [...head.matchAll(/<link\b[^>]*>/g)].map(([t]) => attrs(t));
  const title = head.match(/<title>([^<]*)<\/title>/)?.[1];
  const lang = html.match(/<html[^>]*\blang="([^"]+)"/)?.[1];
  return { lang, links, meta, title };
};
const fetchOk = async (url, type) => {
  const res = await fetch(local(url));
  const buf = Buffer.from(await res.arrayBuffer());
  const ct = res.headers.get("content-type") ?? "";
  return { bytes: buf.length, ct, ok: res.ok && (!type || ct.includes(type)), status: res.status, buf };
};
const pngSize = (buf) => [buf.readUInt32BE(16), buf.readUInt32BE(20)];

for (const path of paths.length ? paths : ["/"]) {
  console.log(`\n# ${path}`);
  const html = await (await fetch(base + path)).text();
  const { lang, links, meta, title } = parse(html);
  const m = (k) => meta[k]?.[0];
  report(lang, "html lang", lang);
  report(title && title.length <= 70, "title <= 70 chars", `${title?.length}: ${title}`);
  const desc = m("description");
  report(desc && desc.length <= 160, "description <= 160 chars", `${desc?.length}`);
  if (desc && desc.length < 50) console.log(`warn description under 50 chars  (${desc.length})`);
  const canonical = links.find((l) => l.rel === "canonical")?.href;
  report(canonical?.startsWith(PROD), "canonical absolute on grasscn.dev", canonical);
  for (const k of ["og:title", "og:description", "og:url", "og:type", "og:site_name", "og:image", "og:image:width", "og:image:height", "og:image:alt"])
    report(m(k), k, m(k));
  report(m("og:url") === canonical, "og:url matches canonical");
  report(m("twitter:card") === "summary_large_image", "twitter:card summary_large_image", m("twitter:card"));
  for (const k of ["twitter:title", "twitter:description", "twitter:image", "twitter:image:alt"]) report(m(k), k, m(k));
  report((m("twitter:title") ?? "").length <= 70, "twitter:title <= 70 chars");
  report((m("twitter:description") ?? "").length <= 200, "twitter:description <= 200 chars");
  for (const key of ["og:image", "twitter:image"]) {
    const url = m(key);
    if (!url) continue;
    report(url.startsWith(`${PROD}/`), `${key} absolute https URL`);
    const img = await fetchOk(url, "image/");
    report(img.ok, `${key} fetches as image`, `${img.status} ${img.ct}`);
    report(img.bytes < 5e6, `${key} < 5 MB (X limit)`, `${img.bytes} bytes`);
    if (img.ct.includes("png")) {
      const [w, h] = pngSize(img.buf);
      report(w >= 1200 && Math.abs(w / h - 1.91) < 0.05, `${key} >= 1200 wide at 1.91:1`, `${w}x${h}`);
      report(String(w) === m("og:image:width") && String(h) === m("og:image:height"), `${key} declared size matches file`);
    }
  }
  report(links.some((l) => l.rel === "apple-touch-icon"), "apple-touch-icon");
  report(links.some((l) => l.rel === "icon"), "icon");
  report(m("theme-color"), "theme-color", m("theme-color"));
}

console.log("\n# site files");
for (const [path, type] of [["/favicon.ico", "image/"], ["/apple-touch-icon.png", "image/png"], ["/robots.txt", "text/plain"], ["/sitemap.xml", "xml"], ["/manifest.webmanifest", "json"]]) {
  const r = await fetchOk(PROD + path, type);
  report(r.ok, path, `${r.status} ${r.ct}`);
  if (path === "/robots.txt") report(r.buf.toString().includes(`Sitemap: ${PROD}/sitemap.xml`), "robots.txt names sitemap");
  if (path === "/sitemap.xml") report((r.buf.toString().match(/<loc>/g) ?? []).length > 10, "sitemap lists pages", `${(r.buf.toString().match(/<loc>/g) ?? []).length} urls`);
}
console.log(failures ? `\n${failures} failing checks` : "\nall checks pass");
process.exitCode = failures ? 1 : 0;
