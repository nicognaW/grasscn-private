# grasscn launch (private)

Launch plan, post copy, video and the tooling that produced it. Kept out of the public `nicognaW/grasscn` repository on purpose.

## Status

| Item | State |
| --- | --- |
| Launch video | **Done** — `video/grasscn-launch.mp4` (45.5 s, 1920×1080, 60 fps, H.264 + AAC) |
| grasscn.dev hosting and `/r/*.json` install links | **Blocking** — owned by a separate session; launch waits on it |
| Post copy | Final main post (below); reply 2 to tighten before posting |
| Launch time | Decided by progress; target a weekday ~8:30 AM PT |
| `@grasscn` shadcn namespace | Apply after launch; announce as a follow-up |
| Daily clips (Hotbar, Book, Trading first) | Not started |
| Licensed music | Optional — current track is original and synthesized |

## Decisions

- **Name:** lowercase `grasscn` everywhere public.
- **Claim:** pixel-perfect UI components, matched pixel by pixel against the game. Never "the whole interface".
- **Audience:** shadcn / React developers; the video should also travel among Minecraft fans. Not named in content.
- **Disclaimer:** none.
- **Account:** personal X (~600 followers).
- **Launch gate:** post only when the video is final, grasscn.dev is live and every `/r/*.json` installs into a fresh shadcn project.
- **Launch time:** a weekday around 8:30 AM PT (Perth = PT + 16 h, so 12:30 AM the next day in Perth). Avoid US election days.
- **Install form at launch:** `npx shadcn add https://grasscn.dev/r/button.json`.
- **Tracking:** this repository only. No public GitHub issue for the launch.

## Post

Main post (attach `video/grasscn-launch.mp4`, no links; ~275 characters, confirm in X's composer):

> Meet grasscn: pixel-perfect Minecraft UI components for shadcn.
>
> → Matched pixel by pixel against the game
> → Original textures, font, sounds
> → 67 components, from Button to Data Table
> → Hotbar, HUD, books, signs, maps and trading
> → More on the way
>
> Open source. Links below 👇

Reply 1: `npx shadcn add https://grasscn.dev/r/button.json` · grasscn.dev · github.com/nicognaW/grasscn

Reply 2: how pixel-perfect is checked — captured references from Minecraft Java 26.2, zero differing RGBA pixels per declared case. Concrete proof from the video: the five grasscn Buttons at scale 3 match the game's title-screen buttons with 0 differing pixels, and the whole browser frame at the cut matches the game frame with 0 differing pixels. Tag @shadcn and @orcdev here.

Reference patterns: 8bitcn launch (@orcdev, Apr 2025: "Links below 👇", @shadcn reposted with "🎮"); Vercel Labs posts ("Introducing X", → list, `npx` call to action, link in a reply on personal accounts).

## After launch

- Daily 6–10 s clips for ~10 days, quoting the launch post, 16:9, one caption each. First three ready before launch: Hotbar, Book, Trading (draft 3 has usable scenes).
- Follow-ups: `@grasscn` namespace approval, star milestones, new components ("More components are cooking" is promised in the video).

## Video

Timeline (`video/grasscn-launch.mp4`):

| Time | Content |
| --- | --- |
| 0–2 s | Real Minecraft 26.2 title screen (in-game capture), splash "Now with components!", menu piano |
| 2 s | Invisible cut to the browser — 0 differing pixels across the full frame |
| 2–8.7 s | MINECRAFT logo rebuilds into GRASSCN block by block; labels slide to "Get started" / "Browse components"; other buttons drop away; panorama blurs into the site background; layout morphs into the real homepage hero; zoom out into a browser window |
| 8.7–10.7 s | Music crossfades to the city-pop bed |
| 10.7–19.5 s | Homepage with a 1.5× camera: Click me, type "Steve", switch, chart → Line, calendar Nov 20. Caption "Real components. Fully interactive." |
| 19.5–37 s | "The shadcn components you know": three boards at scale 3, three cursors working in parallel (one per column) |
| 37–45.5 s | End card: splash "Also try GitHub stars!", Star on GitHub → "Advancement Made! · Starred grasscn on GitHub" toast with the challenge jingle, "More components are cooking. Stay tuned." |

Boards: Overlays (Select, Dropdown Menu, Popover, Tooltip, Toggle, Toast) · Inputs (Slider, Checkbox, Toggle Group, Switch, Radio Group, Input OTP) · Display (Tabs, Pagination, Progress, Kbd, Badge, Avatar).

Drafts in `video/drafts/` and the feedback that shaped each:

1. First pass. Feedback: splash bounced erratically; transition not smooth.
2. Hero-matching morph, skill-guided motion (animate, emil-design-eng, apple-design). Feedback: in-game splash still bouncing.
3. Game clock fixed; real-input homepage interactions; Minecraft-only montage. Feedback: web splash fast; demo too fast; show general shadcn components; slower overall.
4. 1.5× slower choreography; Dialog/Dropdown/Select/Tabs/Toast. Feedback: add music; caret blinks fast; too few components; cursor continuity.
5. Music; caret on video clock; 3 boards × 6 components; continuous cursor. Feedback: camera push; montage too fast; multi-cursor; GitHub star call to action; cursor precision.
6. **Final.** Parallel cursors, scale 3 boards, end card easter egg and call to action.

Possible trims if 45.5 s feels long: drop one or two homepage interactions (saves 2–3 s).

## How the video is made

Everything renders frame by frame, so nothing depends on real-time speed.

1. **Game capture** (`recorder/`). `VideoMain.java` wraps the vanilla client: after load it installs a virtual 60 fps clock (`Util.setTimeSource`), holds and sets the panorama spin per frame, fixes the splash via `SplashManager.literalSplash`, and saves each finished frame with `Screenshot.takeScreenshot`. Three passes (520 frames each, GUI scale 3, 1920×1080): `title`, `panorama` (background only), `nosplash` (splash hidden). `record.py` runs the bundle's `launch.py` with the main class swapped; `run-all.sh` runs passes (`START`, `FRAMES`, `MODES`). Needs Xvfb, Mesa software GL and Java 25. Game files: the user's pinned Minecraft 26.2 Linux bundle (jar SHA-256 `40896ee9…`), not stored here.
2. **Layers** (`pipeline/build_layers.py`). Splits frames exactly: logo = nosplash − panorama (inside the logo box), splash = title − nosplash, extras = icons and texts.
3. **Stage** (`stage/`). Local-only Next route `apps/web/app/launch-video/` in the grasscn repo (kept out of git via `.git/info/exclude`). Timeline in timeline frames × `K = 1.5`; game layers advance one frame per video frame. Homepage runs in an iframe whose `performance.now` and `Date.now` follow the video clock; the stage's own `Date.now` drives the toast motion. Cursor waypoints use a minimum-jerk speed profile on a slight arc; presses, drags and typing are real Playwright input. `?pass=1|2|3` selects which board column the cursor works.
4. **Recording** (`pipeline/record_stage.cjs`). Per frame: read `__input(n)`, replay mouse/keyboard, `__setFrame(n)`, screenshot. Pass 1 records everything; passes 2 and 3 record the montage only. Interactive ranges must be one continuous session.
5. **Music** (`pipeline/music.py` → `audio/music.wav`). Original, synthesized: menu-style piano with long reverb, then electric piano, bass and swung drums on Fmaj7–E7–Am7–Gm7–C7 (100 bpm). No samples, no Mojang music.
6. **Encode** (`pipeline/encode.py`). Joins montage passes column by column using the board track offset, prepends 120 game frames, mixes UI sounds on their frames (game click, challenge jingle) over the music, encodes H.264 CRF 14.

Scripts use the original scratchpad paths; adjust `L`, `G` and `R` before reusing. Mojang sound files (`click.ogg`, `challenge.ogg`, `page.ogg`) come from the game's asset index and are not stored here.

## Side work in the public repo

- Agent skill packs installed and pushed on branch `ccr-d82793f5-i2uboj` (grill-with-docs and friends; `matt-prototype` / `emil-prototype` renamed to avoid collision).
- README showcase image (`docs/images/showcase.png`, 3840×2200, homepage hero and first row of examples) live on `main` (`6f941a77`, cherry-picked from the branch's `73d23c13`).
- Issue [#39](https://github.com/nicognaW/grasscn/issues/39): website generation fails under Bun on Linux in `generate-component-symbols.mjs` (works under Node).
