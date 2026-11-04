# Share metadata

- `check-metadata.mjs`: checks title, description, canonical, Open Graph, X card, share image (absolute URL, fetchable, < 5 MB, 1.91:1, declared size), icons, theme color, and `/favicon.ico`, `/robots.txt`, `/sitemap.xml`, `/manifest.webmanifest`. Production URLs are fetched from `<base-url>`.
  `node check-metadata.mjs http://127.0.0.1:5176 $(curl -s http://127.0.0.1:5176/sitemap.xml | grep -oE '<loc>[^<]+' | sed 's#<loc>https://grasscn.dev##; s#^$#/#')`
- `render-og-image.cjs`: renders `apps/web/public/og.png` (2400×1260) from the local production homepage, header hidden, 1600×840 at 1.5×. Rerun when the hero changes.

External validators (opengraph.xyz etc.) are outside this environment's network allowlist; grasscn.dev itself is reachable only through the Vercel MCP fetch.
