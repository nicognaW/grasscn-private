"use client";

// Launch video stage. Frame-driven: the recorder calls window.__setFrame(n)
// and screenshots each frame. Game-derived layers are served at /__launch/* by the recorder.
import type { StaticImageData } from "next/image";
import * as React from "react";
import { createPortal } from "react-dom";

import dirt from "../../assets/dirt.png";
import titleSvg from "../../assets/grasscn-title.svg";
import { Button } from "../../registry/ui/button";
import { minecraftGlyphs } from "../../registry/ui/minecraft-font";
import { MinecraftText } from "../../registry/ui/minecraft-text";
import { Toaster, toast } from "../../registry/ui/sonner";
import { splashMotion, splashTransform } from "../../splash-motion";
import {
  AvatarDemo,
  BadgeDemo,
  CheckboxDemo,
  DropdownDemo,
  KbdDemo,
  OtpDemo,
  PaginationDemo,
  PopoverDemo,
  ProgressDemo,
  RadioDemo,
  SelectDemo,
  SliderDemo,
  SwitchDemo,
  TabsDemo,
  ToggleDemo,
  ToggleGroupDemo,
  TooltipDemo,
} from "./demos";

declare global {
  interface Window {
    /** Present on every window; declared so iframe windows expose their own Date. */
    Date: DateConstructor;
    __clickFrames?: readonly number[];
    __cut?: number;
    __frames?: number;
    __input?: (videoFrame: number) => StageInput;
    __montage?: readonly number[];
    __setFrame?: (videoFrame: number, point?: Point) => Promise<void>;
    __sounds?: readonly { frame: number; kind: string }[];
    __track?: (videoFrame: number) => number;
    /** Virtual clock of the embedded homepage, in milliseconds. */
    __vt?: number;
  }
}

const S = 3;
const W = 1920;
const H = 1080;

/** First game frame shown by the stage; earlier frames are the untouched game recording. */
const CUT = 120;
const GAME_FRAMES = 520;

const pad = (n: number) => String(n).padStart(5, "0");
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));

const ramp = (f: number, start: number, end: number) => {
  if (end <= start) {
    return f >= end ? 1 : 0;
  }

  return clamp((f - start) / (end - start));
};

/** CSS cubic-bezier(x1, y1, x2, y2) as a function of progress. */
const bezier = (x1: number, y1: number, x2: number, y2: number) => {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;

  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;

  const sx = (u: number) => ((ax * u + bx) * u + cx) * u;
  const sy = (u: number) => ((ay * u + by) * u + cy) * u;
  const dx = (u: number) => (3 * ax * u + 2 * bx) * u + cx;

  return (t: number) => {
    if (t <= 0) {
      return 0;
    }

    if (t >= 1) {
      return 1;
    }

    let u = t;

    for (let i = 0; i < 8; i += 1) {
      const e = sx(u) - t;
      const d = dx(u);

      if (Math.abs(e) < 1e-6 || Math.abs(d) < 1e-6) {
        break;
      }

      u -= e / d;
    }

    let hi = 1;
    let lo = 0;

    for (let i = 0; i < 30 && Math.abs(sx(u) - t) > 1e-6; i += 1) {
      if (sx(u) < t) {
        lo = u;
      } else {
        hi = u;
      }

      u = (lo + hi) / 2;
    }

    return sy(u);
  };
};

/** Strong ease-in-out for on-screen movement. */
const inOut = bezier(0.77, 0, 0.175, 1);

/** Strong ease-out for entering and exiting. */
const outCubic = bezier(0.23, 1, 0.32, 1);

/** Apple-style spring { duration: 0.5s, bounce: 0.2 } sampled at 60 fps; t in frames. */
const spring = (frames: number) => {
  if (frames <= 0) {
    return 0;
  }

  const zeta = 1 - 0.2;
  const omega = (2 * Math.PI) / 0.5;
  const t = frames / 60;
  const wd = omega * Math.sqrt(1 - zeta * zeta);

  return (
    1 -
    Math.exp(-zeta * omega * t) *
      (Math.cos(wd * t) + ((zeta * omega) / wd) * Math.sin(wd * t))
  );
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const isStaticImage = (value: unknown): value is StaticImageData =>
  typeof value === "object" &&
  value !== null &&
  "src" in value &&
  typeof value.src === "string";

const titleSrc = (() => {
  const asset: unknown = titleSvg;

  if (!isStaticImage(asset)) {
    throw new Error("Bundled title image metadata required");
  }

  return asset.src;
})();

const dirtSrc = dirt.src;

/** Style object that also carries Minecraft text custom properties. */
type StageStyle = React.CSSProperties & Record<`--${string}`, number | string>;

const gameFrame = (n: number) => Math.min(CUT + n, GAME_FRAMES - 1);

/** Game layers for video frame n (one game frame per video frame). */
const layerUrls = (n: number) => {
  const g = pad(gameFrame(n));

  return {
    extras: `/__launch/layers/extras-${g}.png`,
    logo: `/__launch/layers/logo-${g}.png`,
    panorama: `/__launch/frames/panorama/panorama-${g}.png`,
    splash: `/__launch/layers/splash-${g}.png`,
  };
};

// ---- Timeline (stage frames, 60 fps) ----
const T = {
  dropEnd: 150,
  dropStart: 70,
  heroEnd: 230,
  heroStart: 160,
  logoEnd: 150,
  logoStart: 40,
  siteEnd: 200,
  siteStart: 120,
  swapA: 92,
  swapB: 104,
  toSiteEnd: 262,
  toSiteStart: 236,
  zoomEnd: 340,
  zoomStart: 268,
};

const CLICK_FRAMES = [T.swapA, T.swapB];

const SCROLL = [
  [350, 410, 0, 560],
  [600, 660, 560, 1500],
] as const;

const WINDOW_OUT = 700;
const M0 = 740;
const END_START = 1400;

/** Global slow-down: timeline frames play K times slower; game footage still advances one frame per video frame. */
const K = 1.5;

// ---- Hero targets (homepage at 1920×1080, scroll 0) ----
const HERO = {
  buttons: [
    { gui: 104, x: 726, y: 528 },
    { gui: 124, x: 946, y: 528 },
  ],
  splash: { dx: 1318.8 - 1329, dy: 372.92 - 207 },
  wordmarkDy: 232 - 23 * S,
};

// ---- Logo rebuild ----
const CELL = 4 * S;
const BOX = { h: 66 * S, w: 264 * S, x: 188 * S, y: 22 * S };
const WORD = { x: (W - 260 * S) / 2, y: 23 * S };

interface Cell {
  fall: number;
  jitter: number;
  spin: number;
  x: number;
  y: number;
}

const cells: Cell[] = (() => {
  const list: Cell[] = [];
  let seed = 11;

  const rand = () => {
    seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;

    return seed / 2_147_483_648;
  };

  for (let y = 0; y < BOX.h; y += CELL) {
    for (let x = 0; x < BOX.w; x += CELL) {
      list.push({
        fall: T.logoStart + (x / BOX.w) * 62 + rand() * 14,
        jitter: rand(),
        spin: (rand() - 0.5) * 0.9,
        x,
        y,
      });
    }
  }

  return list;
})();

const LogoCanvas = ({ frame, logoUrl }: { frame: number; logoUrl: string }) => {
  const ref = React.useRef<HTMLCanvasElement>(null);
  React.useLayoutEffect(() => {
    const old = new Image();
    const nextImage = new Image();
    old.src = logoUrl;
    nextImage.src = titleSrc;
    let cancelled = false;

    const draw = async () => {
      await Promise.all([old.decode().catch(() => null), nextImage.decode()]);

      const ctx = ref.current?.getContext("2d");

      if (cancelled || !ctx) {
        return;
      }

      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, W, H);

      // The recorder serves game layers; without them only the rebuilt title is drawn.
      const hasOld = old.complete && old.naturalWidth > 0;

      if (frame < T.logoStart) {
        if (hasOld) {
          ctx.drawImage(old, 0, 0);
        }

        return;
      }

      for (const cell of cells) {
        const x = BOX.x + cell.x;
        const y = BOX.y + cell.y;
        // Old block: exits with a short ease-out drift, scale 0.9 and fade (300 ms).
        const t = (frame - cell.fall) / 18;

        if (hasOld && t < 0) {
          ctx.drawImage(old, x, y, CELL, CELL, x, y, CELL, CELL);
        } else if (hasOld && t < 1) {
          const e = outCubic(t);
          const k = 1 - 0.1 * e;
          ctx.save();
          ctx.globalAlpha = 1 - e;
          ctx.translate(x + CELL / 2, y + CELL / 2 + e * 8 * S);
          ctx.scale(k, k);
          ctx.drawImage(
            old,
            x,
            y,
            CELL,
            CELL,
            -CELL / 2,
            -CELL / 2,
            CELL,
            CELL
          );
          ctx.restore();
        }

        // New block: springs into place from above (0.5 s, bounce 0.2), scale 0.95 and fade in.
        const n = frame - cell.fall - 6 - cell.jitter * 3;

        if (n <= 0) {
          continue;
        }

        const p = spring(n);
        const sx = (x - WORD.x) / S;
        const sy = (y - WORD.y) / S;
        const k = 0.95 + 0.05 * p;
        ctx.save();
        ctx.globalAlpha = outCubic(clamp(n / 12));
        ctx.translate(x + CELL / 2, y + CELL / 2 + (1 - p) * -8 * S);
        ctx.scale(k, k);
        ctx.drawImage(
          nextImage,
          sx,
          sy,
          CELL / S,
          CELL / S,
          -CELL / 2,
          -CELL / 2,
          CELL,
          CELL
        );
        ctx.restore();
      }
    };

    void draw();

    return () => {
      cancelled = true;
    };
  }, [frame, logoUrl]);

  return (
    <canvas
      ref={ref}
      width={W}
      height={H}
      style={{ inset: 0, position: "absolute" }}
    />
  );
};

const Text = ({
  children,
  scale = S,
  style,
}: {
  children: string;
  scale?: number;
  style?: StageStyle;
}) => {
  const textStyle: StageStyle = {
    "--mc-scale": scale,
    lineHeight: 0,
    ...style,
  };

  return (
    <span style={textStyle}>
      <MinecraftText>{children}</MinecraftText>
    </span>
  );
};

/** Label slide: old label rises out, new label rises in. Returns the text and a label transform. */
const swap = (frame: number, start: number, from: string, to: string) => {
  const t = ramp(frame, start, start + 16);
  const h = 6 * S;

  if (t <= 0) {
    return { label: from, style: undefined };
  }

  if (t >= 1) {
    return { label: to, style: undefined };
  }

  if (t < 0.5) {
    const e = outCubic(t * 2);

    return {
      label: from,
      style: {
        filter: `blur(${e * 2}px)`,
        opacity: 1 - e,
        transform: `translateY(${-e * h}px)`,
      },
    };
  }

  const e = outCubic((t - 0.5) * 2);

  return {
    label: to,
    style: {
      filter: `blur(${(1 - e) * 2}px)`,
      opacity: e,
      transform: `translateY(${(1 - e) * h}px)`,
    },
  };
};

/** One of the two main buttons, moving from the title layout into the homepage hero. */
const HeroButton = ({
  frame,
  index,
  from: fromLabel,
  start,
  to: toLabel,
}: {
  frame: number;
  index: 0 | 1;
  from: string;
  start: number;
  to: string;
}) => {
  const from = { gui: 200, x: 220 * S, y: (138 + index * 24) * S };
  const to = HERO.buttons[index];

  // Both shrink first; the second slides right, then both settle into one row.
  const R =
    index === 0
      ? { size: [160, 195], x: [178, 226], y: [178, 226] }
      : { size: [160, 195], x: [160, 202], y: [186, 230] };

  const size = outCubic(ramp(frame, R.size[0], R.size[1]));
  const tx = inOut(ramp(frame, R.x[0], R.x[1]));
  const ty = inOut(ramp(frame, R.y[0], R.y[1]));
  const t = tx;
  const done = size >= 1 && tx >= 1 && ty >= 1;
  const k = lerp(1, 2 / 3, size);
  const gui = Math.round(lerp(from.gui, to.gui, size));
  const { label, style } = swap(frame, start, fromLabel, toLabel);
  const id = `hb${index}`;

  return (
    <Button
      className={id}
      scale={done ? 2 : 3}
      style={{
        left: lerp(from.x, to.x, t),
        overflow: "hidden",
        position: "absolute",
        top: lerp(from.y, to.y, ty),
        transform: done ? undefined : `scale(${k})`,
        transformOrigin: "0 0",
        width: done ? to.gui * 2 : gui * S,
      }}
    >
      {style && (
        <style>{`.${id} .mc-button-label{filter:${style.filter};opacity:${style.opacity};transform:${style.transform}}`}</style>
      )}
      {label}
    </Button>
  );
};

const DropButton = ({
  children,
  frame,
  order,
  x,
  y,
  width,
}: {
  children: string;
  frame: number;
  order: number;
  x: number;
  y: number;
  width: number;
}) => {
  const t = ramp(frame, T.dropStart + order * 3, T.dropStart + order * 3 + 15);

  if (t >= 1) {
    return null;
  }

  const e = outCubic(t);

  return (
    <Button
      scale={3}
      style={{
        left: x * S,
        opacity: 1 - e,
        position: "absolute",
        top: y * S,
        transform:
          t > 0 ? `translateY(${e * 24}px) scale(${1 - 0.05 * e})` : undefined,
        width: width * S,
      }}
    >
      {children}
    </Button>
  );
};

const TitleLayer = ({ frame, n }: { frame: number; n: number }) => {
  const urls = layerUrls(n);
  const site = inOut(ramp(frame, T.siteStart, T.siteEnd));
  const hero = inOut(ramp(frame, T.heroStart, T.heroEnd));
  const extras = outCubic(ramp(frame, T.dropStart + 2, T.dropStart + 17));

  return (
    <div style={{ height: H, inset: 0, position: "absolute", width: W }}>
      {site < 1 && (
        // eslint-disable-next-line next/no-img-element, react-doctor/nextjs-no-img-element -- Recorder frame layers are screenshotted 1:1; image optimization would resample them.
        <img
          alt=""
          src={urls.panorama}
          style={{
            filter: site > 0 ? `blur(${site * 6}px)` : undefined,
            inset: 0,
            position: "absolute",
          }}
        />
      )}
      {site > 0 && (
        <div
          style={{
            backgroundBlendMode: "multiply",
            backgroundColor: "#555",
            backgroundImage: `url(${dirtSrc})`,
            backgroundSize: "64px 64px",
            imageRendering: "pixelated",
            inset: 0,
            opacity: site,
            position: "absolute",
          }}
        >
          <div
            style={{
              background: "rgb(0 0 0 / 45%)",
              inset: 0,
              position: "absolute",
            }}
          />
        </div>
      )}
      <div
        style={{
          inset: 0,
          position: "absolute",
          transform: hero
            ? `translateY(${hero * HERO.wordmarkDy}px)`
            : undefined,
        }}
      >
        <LogoCanvas frame={frame} logoUrl={urls.logo} />
      </div>
      {extras < 1 && (
        // eslint-disable-next-line next/no-img-element, react-doctor/nextjs-no-img-element -- Recorder frame layers are screenshotted 1:1; image optimization would resample them.
        <img
          alt=""
          src={urls.extras}
          style={{
            inset: 0,
            opacity: 1 - extras,
            position: "absolute",
            transform: extras > 0 ? `translateY(${extras * 24}px)` : undefined,
          }}
        />
      )}
      {/* eslint-disable-next-line next/no-img-element, react-doctor/nextjs-no-img-element -- Recorder frame layers are screenshotted 1:1; image optimization would resample them. */}
      <img
        alt=""
        src={urls.splash}
        style={{
          inset: 0,
          position: "absolute",
          transform: hero
            ? `translate(${hero * HERO.splash.dx}px, ${hero * HERO.splash.dy}px)`
            : undefined,
        }}
      />
      <HeroButton
        frame={frame}
        index={0}
        from="Singleplayer"
        start={T.swapA}
        to="Get started"
      />
      <HeroButton
        frame={frame}
        index={1}
        from="Multiplayer"
        start={T.swapB}
        to="Browse components"
      />
      <DropButton frame={frame} order={0} x={220} y={186} width={200}>
        Minecraft Realms
      </DropButton>
      <DropButton frame={frame} order={2} x={220} y={234} width={98}>
        Options...
      </DropButton>
      <DropButton frame={frame} order={3} x={322} y={234} width={98}>
        Quit Game
      </DropButton>
    </div>
  );
};

const Chrome = ({ t }: { t: number }) => (
  <div
    style={{
      background: "#202020",
      borderBottom: "4px solid #555",
      height: 72,
      left: 0,
      opacity: t,
      position: "absolute",
      right: 0,
      top: -76,
      transform: `translateY(${(1 - outCubic(t)) * 16}px)`,
    }}
  >
    {["#ff5f57", "#febc2e", "#28c840"].map((color, i) => (
      <span
        key={color}
        style={{
          background: color,
          height: 18,
          left: 24 + i * 30,
          position: "absolute",
          top: 27,
          width: 18,
        }}
      />
    ))}
    <span
      style={{
        background: "#000",
        border: "2px solid #a0a0a0",
        height: 44,
        left: "50%",
        position: "absolute",
        top: 14,
        transform: "translateX(-50%)",
        width: 720,
      }}
    />
    <Text
      scale={2}
      style={{
        left: "50%",
        position: "absolute",
        top: 28,
        transform: "translateX(-50%)",
      }}
    >
      grasscn.dev
    </Text>
  </div>
);

/** Camera over the browser window: centre point (window coords) and scale, eased between keys. */
const CAMERA: {
  at: number;
  cx: number;
  cy: number;
  from: number;
  s: number;
}[] = [
  { at: T.zoomEnd, cx: 960, cy: 540 - 36 / 0.8, from: T.zoomStart, s: 0.8 },
  { at: 440, cx: 600, cy: 330, from: 405, s: 1.5 },
  { at: 662, cx: 1160, cy: 420, from: 600, s: 1.5 },
  { at: 728, cx: 960, cy: 495, from: 684, s: 0.8 },
];

const cameraAt = (f: number) => {
  let c = { cx: 960, cy: 540, s: 1 };

  for (const k of CAMERA) {
    if (f < k.from) {
      break;
    }

    const t = inOut(ramp(f, k.from, k.at));
    c = {
      cx: lerp(c.cx, k.cx, t),
      cy: lerp(c.cy, k.cy, t),
      s: lerp(c.s, k.s, t),
    };
  }

  return c;
};

const scrollAt = (f: number) => {
  let y = 0;

  for (const [a, b, from, to] of SCROLL) {
    if (f >= a) {
      y = lerp(from, to, inOut(ramp(f, a, b)));
    }
  }

  return Math.round(y);
};

// ---- Montage: three boards, one cursor per column (each column recorded in its own pass) ----
/** Recording pass: 1 = column 0 + homepage + end card, 2 = column 1, 3 = column 2. */
const PASS =
  typeof window === "undefined"
    ? 1
    : Number(new URLSearchParams(window.location.search).get("pass") ?? 1);

const BOARD = 220;
const SLIDE = 40;
const boardAt = (i: number) => M0 + BOARD * i;

const ToastButton = ({ frame }: { frame: number }) => {
  React.useEffect(() => {
    if (frame >= boardAt(1) - SLIDE - 6 && frame < END_START) {
      toast.dismiss();
    }
  }, [frame]);

  return (
    <Button
      scale={3}
      onClick={() => {
        toast("World saved", {
          description: "Your progress has been saved.",
          duration: Number.POSITIVE_INFINITY,
        });
      }}
    >
      Show message
    </Button>
  );
};

const COL_X = [320, 960, 1600];
const ROW_Y = [400, 770];

type BoardCell = [string, (frame: number) => React.ReactNode];

const BOARDS: BoardCell[][] = [
  [
    ["Select", () => <SelectDemo />],
    ["Dropdown Menu", () => <DropdownDemo />],
    ["Popover", () => <PopoverDemo />],
    ["Tooltip", () => <TooltipDemo />],
    ["Toggle", () => <ToggleDemo />],
    ["Toast", (f) => <ToastButton frame={f} />],
  ],
  [
    ["Slider", () => <SliderDemo />],
    ["Checkbox", () => <CheckboxDemo />],
    ["Toggle Group", () => <ToggleGroupDemo />],
    ["Switch", () => <SwitchDemo />],
    ["Radio Group", () => <RadioDemo />],
    ["Input OTP", () => <OtpDemo />],
  ],
  [
    ["Tabs", () => <TabsDemo />],
    ["Pagination", () => <PaginationDemo />],
    ["Progress", () => <ProgressDemo />],
    ["Kbd", () => <KbdDemo />],
    ["Badge", () => <BadgeDemo />],
    ["Avatar", () => <AvatarDemo />],
  ],
];

const trackX = (f: number) => {
  let x = 0;

  for (let i = 1; i < BOARDS.length; i += 1) {
    x += inOut(ramp(f, boardAt(i) - SLIDE, boardAt(i))) * W;
  }

  return x;
};

const SiteBackground = () => (
  <div
    style={{
      backgroundBlendMode: "multiply",
      backgroundColor: "#555",
      backgroundImage: `url(${dirtSrc})`,
      backgroundSize: "64px 64px",
      imageRendering: "pixelated",
      inset: 0,
      position: "absolute",
    }}
  >
    <div
      style={{ background: "rgb(0 0 0 / 45%)", inset: 0, position: "absolute" }}
    />
  </div>
);

const Montage = ({ frame }: { frame: number }) => {
  const enter = outCubic(ramp(frame, M0 - 36, M0));
  const exit = outCubic(ramp(frame, END_START, END_START + 36));
  const x = trackX(frame);

  return (
    <div
      style={{
        inset: 0,
        opacity: enter * (1 - exit),
        position: "absolute",
        transform: `translateY(${(1 - enter) * 24}px) scale(${1 - 0.03 * exit})`,
      }}
    >
      <SiteBackground />
      <Text
        scale={4}
        style={{
          left: "50%",
          position: "absolute",
          top: 96,
          transform: "translateX(-50%)",
        }}
      >
        The shadcn components you know
      </Text>
      <div
        style={{
          inset: 0,
          position: "absolute",
          transform: `translateX(${-x}px)`,
        }}
      >
        {BOARDS.map((boardCells, b) => (
          <div
            key={b}
            style={{
              height: H,
              left: b * W,
              position: "absolute",
              top: 0,
              width: W,
            }}
          >
            {boardCells.map(([name, render], i) => {
              const cx = COL_X[i % 3];
              const cy = ROW_Y[Math.floor(i / 3)];

              return (
                <div key={name}>
                  <Text
                    scale={2}
                    style={{
                      "--mc-ink": "#a0a0a0",
                      "--mc-shadow": "#282828",
                      left: cx,
                      position: "absolute",
                      top: cy - 130,
                      transform: "translateX(-50%)",
                    }}
                  >
                    {name}
                  </Text>
                  <div
                    style={{
                      alignItems: "center",
                      display: "flex",
                      height: 200,
                      justifyContent: "center",
                      left: cx - 300,
                      position: "absolute",
                      top: cy - 90,
                      width: 600,
                    }}
                  >
                    {render(frame)}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

// ---- Cursor scripts: real input, replayed by the recorder each frame ----
type Point = [number, number];

type Target = () => Point | null;

const iframeEl = () =>
  document.querySelector<HTMLIFrameElement>("iframe[title=grasscn]");

const centre = (node: Element | null | undefined, fx = 0.5): Point | null => {
  if (!node) {
    return null;
  }

  const r = node.getBoundingClientRect();

  return [r.left + r.width * fx, r.top + r.height / 2];
};

const inFrame = (
  find: (doc: Document) => Element | null | undefined
): Target => {
  const locate = (): Point | null => {
    const el = iframeEl();
    const doc = el?.contentDocument;
    const node = doc ? find(doc) : undefined;

    if (!el || !node) {
      return null;
    }

    const outer = el.getBoundingClientRect();
    const r = node.getBoundingClientRect();
    const k = outer.width / W;

    return [
      outer.left + (r.left + r.width / 2) * k,
      outer.top + (r.top + r.height / 2) * k,
    ];
  };

  return locate;
};

/** Visible element (portals included), optionally by exact text; `nth` among visible matches. */
const onStage =
  (selector: string, text?: string, fx = 0.5, nth = 0): Target =>
  () => {
    const nodes = [...document.querySelectorAll(selector)].filter((e) => {
      const r = e.getBoundingClientRect();

      return (
        r.width > 0 &&
        r.right > 0 &&
        r.left < W &&
        (text === undefined || e.textContent?.trim() === text)
      );
    });

    return centre(nodes[nth], fx);
  };

const byText = (doc: Document, tag: string, text: string) =>
  [...doc.querySelectorAll(`.grass-showcase-grid ${tag}`)].find(
    (e) => e.textContent?.trim() === text
  );

const at =
  (x: number, y: number): Target =>
  () => [x, y];

/**
 * Waypoints in timeline frames: travel from the previous resting point over [from, arrive], then rest.
 * Presses happen at `clicks`; `drag` holds the button from drag[0] to drag[1] across the next move.
 */
interface Waypoint {
  arrive: number;
  clicks?: number[];
  drag?: [number, number];
  from: number;
  silent?: number[];
  target: Target;
  type?: [number, string];
}

/** Waypoint relative to a board start and this column's stagger. */
const OFF = [0, 16, 32];

const w = (
  board: number,
  col: number,
  from: number,
  arrive: number,
  target: Target,
  extra: Partial<Waypoint> = {}
): Waypoint => {
  const base = boardAt(board) + OFF[col];

  return {
    ...extra,
    arrive: base + arrive,
    clicks: extra.clicks?.map((c) => base + c),
    drag: extra.drag && [base + extra.drag[0], base + extra.drag[1]],
    from: base + from,
    target,
    type: extra.type && [base + extra.type[0], extra.type[1]],
  };
};

const press = (c: number) => ({ clicks: [c] });

const HOMEPAGE: Waypoint[] = [
  {
    arrive: 432,
    clicks: [436],
    from: 392,
    target: inFrame((d) => byText(d, "button", "Click me")),
  },
  {
    arrive: 472,
    clicks: [476],
    from: 446,
    target: inFrame((d) => d.querySelector(".grass-showcase-grid input")),
    type: [488, "Steve"],
  },
  {
    arrive: 542,
    clicks: [546],
    from: 516,
    target: inFrame((d) =>
      d.querySelector('.grass-showcase-grid [aria-label="Enable example"]')
    ),
  },
  {
    arrive: 580,
    clicks: [584],
    from: 556,
    target: inFrame((d) => byText(d, "button", "Line")),
  },
  {
    arrive: 676,
    clicks: [680],
    from: 640,
    target: inFrame((d) =>
      d.querySelector(
        '.grass-showcase-grid button[aria-label^="Friday, November 20th"]'
      )
    ),
  },
];

const COLUMN: Waypoint[][] = [
  [
    // Board 1. The silent press on empty background hands focus from the iframe to the stage.
    {
      ...w(
        0,
        0,
        -50,
        20,
        onStage('[role=combobox][aria-label="Game mode"]'),
        press(24)
      ),
      silent: [boardAt(0) - 20],
    },
    w(0, 0, 34, 56, onStage("[role=option]", "Creative"), press(60)),
    w(0, 0, 90, 120, onStage("button", "Inspect pickaxe")),
    // Board 2.
    w(1, 0, -10, 18, onStage("[data-slot=slider-thumb]"), { drag: [22, 72] }),
    w(1, 0, 26, 66, onStage("[data-slot=slider-track]", undefined, 0.85)),
    w(1, 0, 92, 120, onStage("[role=switch]"), press(124)),
    // Board 3.
    w(2, 0, -10, 20, onStage("[role=tab]", "World"), press(24)),
    w(2, 0, 56, 80, onStage("[role=tab]", "More"), press(84)),
    w(2, 0, 110, 140, onStage("[data-slot=kbd]", undefined, 0.5, 0)),
  ],
  [
    w(0, 1, -30, 20, onStage("button", "Game menu"), press(24)),
    w(
      0,
      1,
      34,
      56,
      onStage("[role=menuitemcheckbox]", "Show coordinates"),
      press(60)
    ),
    w(0, 1, 70, 88, onStage("[role=menuitem]", "Resume game"), press(92)),
    w(
      0,
      1,
      104,
      130,
      onStage('[aria-label="Only craftable recipes"]'),
      press(134)
    ),
    w(1, 1, -10, 24, onStage("[role=checkbox]"), press(28)),
    w(1, 1, 84, 110, onStage("[role=radio]", undefined, 0.5, 1), press(114)),
    w(2, 1, -10, 24, onStage("a", "2"), press(28)),
    w(2, 1, 50, 70, onStage("a", "3"), press(74)),
    w(2, 1, 104, 130, onStage("[data-slot=badge]")),
  ],
  [
    w(0, 2, -30, 20, onStage("button", "Show message"), press(24)),
    w(0, 2, 60, 90, onStage("button", "World options"), press(94)),
    w(0, 2, 140, 160, onStage("button", "World options"), press(164)),
    w(1, 2, -10, 24, onStage('[aria-label="Furnace"]'), press(28)),
    w(1, 2, 76, 100, onStage('[aria-label="One-time code"]'), {
      clicks: [104],
      type: [112, "2026"],
    }),
    w(2, 2, -10, 24, onStage("button", "Complete"), press(28)),
    w(2, 2, 96, 120, onStage("[data-slot=avatar-group]")),
  ],
];

// ---- End card ----
const STAR_AT = END_START + 140;

const END_CARD: Waypoint[] = [
  {
    arrive: STAR_AT - 6,
    clicks: [STAR_AT],
    from: STAR_AT - 60,
    target: onStage("button", "Star on GitHub"),
  },
  { arrive: END_START + 300, from: END_START + 250, target: at(2000, 1180) },
];

const EXIT = (col: number): Waypoint => ({
  arrive: END_START - 4,
  from: END_START - 44,
  target: at(COL_X[col] + 80, 1180),
});

const pathFor = (pass: number): Waypoint[] => {
  const start: Waypoint = {
    arrive: 0,
    from: 0,
    target: at(pass === 1 ? 2000 : COL_X[pass - 1] + 80, 1180),
  };

  if (pass === 1) {
    return [start, ...HOMEPAGE, ...COLUMN[0], ...END_CARD];
  }

  return [start, ...COLUMN[pass - 1], EXIT(pass - 1)];
};

const PATH = pathFor(PASS);

/** Video frame of a timeline event: the first video frame at or after it. */
const vf = (timeline: number) => Math.ceil(timeline * K);
const clicksOf = (path: Waypoint[]) => path.flatMap((p) => p.clicks ?? []);
const clickFrames = clicksOf(PATH);
const silentFrames = PATH.flatMap((p) => p.silent ?? []);

/** Sounds of all three passes, so every pass reports the same list. */
const SOUND_FRAMES = [
  { frame: vf(T.swapA), kind: "click" },
  { frame: vf(T.swapB), kind: "click" },
  ...[1, 2, 3]
    .flatMap((p) => clicksOf(pathFor(p)))
    .map((c) => ({ frame: vf(c), kind: "click" })),
  { frame: vf(STAR_AT + 8), kind: "challenge" },
];

/** Minimum-jerk profile: zero velocity and acceleration at both ends, like a hand-moved pointer. */
const minJerk = (s: number) => s * s * s * (10 - 15 * s + 6 * s * s);

const cursorAt = (t: number): Point => {
  let prev: Point = PATH[0].target() ?? [2000, 1180];
  let point: Point = prev;

  for (let i = 1; i < PATH.length; i += 1) {
    const seg = PATH[i];

    if (t < seg.from) {
      break;
    }

    const target = seg.target() ?? prev;
    const s = minJerk(ramp(t, seg.from, seg.arrive));
    // A slight clockwise bow, as a wrist-driven pointer makes; none on short hops.
    const dx = target[0] - prev[0];
    const dy = target[1] - prev[1];
    const bow = Math.hypot(dx, dy) > 80 ? 0.07 : 0;
    const cx = (prev[0] + target[0]) / 2 - dy * bow;
    const cy = (prev[1] + target[1]) / 2 + dx * bow;
    const u = 1 - s;

    point = [
      u * u * prev[0] + 2 * u * s * cx + s * s * target[0],
      u * u * prev[1] + 2 * u * s * cy + s * s * target[1],
    ];
    prev = t >= seg.arrive ? target : point;
  }

  return point;
};

interface StageInput {
  down: boolean;
  type: string | undefined;
  up: boolean;
  x: number;
  y: number;
}

/** Input for video frame n: pointer position, presses on their exact video frames, typed characters. */
const inputAt = (n: number): StageInput => {
  const [x, y] = cursorAt(n / K);
  const presses = [...clickFrames, ...silentFrames];
  const drags = PATH.flatMap((p) => (p.drag ? [p.drag] : []));

  const down =
    presses.some((c) => vf(c) === n) || drags.some(([d]) => vf(d) === n);

  const up =
    presses.some((c) => vf(c + 4) === n) || drags.some(([, u]) => vf(u) === n);

  let type: string | undefined;

  for (const p of PATH) {
    if (!p.type) {
      continue;
    }

    for (let i = 0; i < p.type[1].length; i += 1) {
      if (vf(p.type[0] + i * 8) === n) {
        type = p.type[1][i];
      }
    }
  }

  return {
    down,
    type,
    up,
    x: Math.round(x * 10) / 10,
    y: Math.round(y * 10) / 10,
  };
};

const Cursor = ({ t, x, y }: { t: number; x: number; y: number }) => {
  const pressed =
    clickFrames.some((c) => t >= c && t < c + 4) ||
    PATH.some((p) => p.drag !== undefined && t >= p.drag[0] && t < p.drag[1]);

  if (x > W + 40 || y > H + 60) {
    return null;
  }

  // The arrow's tip is the SVG origin, so it sits exactly on the pointer position.
  return createPortal(
    <svg
      width={36}
      height={54}
      viewBox="0 0 12 18"
      data-launch-cursor=""
      style={{
        filter: "drop-shadow(0 4px 6px rgb(0 0 0 / 50%))",
        left: x,
        pointerEvents: "none",
        position: "fixed",
        top: y,
        transform: `scale(${pressed ? 0.9 : 1})`,
        transformOrigin: "0 0",
        zIndex: 60,
      }}
    >
      <path
        d="M0 0h1v1h1v1h1v1h1v1h1v1h1v1h1v1h1v1h1v1h1v1h1v1H7v1h1v1h1v2H8v1H6v-1H5v-2H4v-1H3v1H2v1H1v1H0z"
        fill="currentColor"
        style={{ color: "#000" }}
      />
      <path
        d="M1 2h1v1h1v1h1v1h1v1h1v1h1v1h1v1h1v1h1v1H6v1h1v1h1v2H7v-1H6v-2H5v-1H4v-1H3v1H2v1H1z"
        fill="currentColor"
        style={{ color: "#fff" }}
      />
    </svg>,
    document.body
  );
};

const Caption = ({
  frame,
  from,
  text,
  to,
}: {
  frame: number;
  from: number;
  text: string;
  to: number;
}) => {
  const t =
    outCubic(ramp(frame, from, from + 30)) *
    (1 - outCubic(ramp(frame, to - 20, to)));

  if (t <= 0) {
    return null;
  }

  return (
    <div
      style={{
        backdropFilter: "blur(12px)",
        background: "rgb(16 16 16 / 72%)",
        border: "2px solid #555",
        left: "50%",
        opacity: t,
        padding: "18px 28px",
        position: "absolute",
        top: 978,
        transform: `translate(-50%, ${(1 - t) * 16}px)`,
      }}
    >
      <Text scale={3}>{text}</Text>
    </div>
  );
};

/** End card: the opening's splash returns with a new line, then a star button and a teaser. */
const END_SPLASH = "Also try GitHub stars!";

const endSplashWidth = (() => {
  let width = 0;

  for (const c of END_SPLASH) {
    width += minecraftGlyphs[(c.codePointAt(0) ?? 32) - 32][2];
  }

  return width;
})();

const EndCard = ({ frame, n }: { frame: number; n: number }) => {
  const endIn = (delay: number) => {
    const t = outCubic(
      ramp(frame, END_START + 24 + delay, END_START + 60 + delay)
    );

    return {
      filter: `blur(${(1 - t) * 4}px)`,
      opacity: t,
      transform: `translateY(${(1 - t) * 16}px)`,
    };
  };

  const splashIn = spring(frame - (END_START + 70));
  const motion = splashMotion(((CUT + n) * 1000) / 60, endSplashWidth);
  const tease = endIn(STAR_AT + 60 - (END_START + 24));

  const splashStyle: StageStyle = {
    "--mc-ink": "#ffff00",
    "--mc-scale": 1,
    "--mc-shadow": "#3f3f00",
    height: 0,
    left: "96%",
    opacity: clamp(splashIn * 1.5),
    position: "absolute",
    top: "73.4%",
    transform: `${splashTransform(motion, S)} scale(${0.6 + 0.4 * splashIn})`,
    transformOrigin: "0 0",
    whiteSpace: "nowrap",
    width: 0,
  };

  return (
    <div
      style={{
        alignItems: "center",
        display: "flex",
        flexDirection: "column",
        gap: 36,
        inset: 0,
        justifyContent: "center",
        position: "absolute",
      }}
    >
      <div
        style={{
          height: 64 * S,
          position: "relative",
          width: 260 * S,
          ...endIn(0),
        }}
      >
        {/* eslint-disable-next-line next/no-img-element, react-doctor/nextjs-no-img-element -- Recorder frame layers are screenshotted 1:1; image optimization would resample them. */}
        <img
          alt=""
          src={titleSrc}
          style={{
            height: 64 * S,
            imageRendering: "pixelated",
            width: 260 * S,
          }}
        />
        <span style={splashStyle}>
          <span
            style={{
              display: "inline-flex",
              height: 8,
              left: -Math.trunc(endSplashWidth / 2),
              lineHeight: "8px",
              position: "absolute",
              top: -8,
            }}
          >
            <MinecraftText>{END_SPLASH}</MinecraftText>
          </span>
        </span>
      </div>
      <Text scale={3} style={endIn(5)}>
        Pixel-perfect Minecraft UI for shadcn
      </Text>
      <Text
        scale={2}
        style={{
          ...endIn(10),
          "--mc-ink": "#a0a0a0",
          "--mc-shadow": "#282828",
        }}
      >
        npx shadcn add https://grasscn.dev/r/button.json
      </Text>
      <div
        style={{ alignItems: "center", display: "flex", gap: 32, ...endIn(16) }}
      >
        <Button
          scale={3}
          onClick={() => {
            toast("Advancement Made!", {
              description: "Starred grasscn on GitHub",
              duration: Number.POSITIVE_INFINITY,
            });
          }}
        >
          Star on GitHub
        </Button>
        <Text
          scale={3}
          style={{ "--mc-ink": "#ffff55", "--mc-shadow": "#3f3f15" }}
        >
          grasscn.dev
        </Text>
      </div>
      <Text
        scale={2}
        style={{ ...tease, "--mc-ink": "#a0a0a0", "--mc-shadow": "#282828" }}
      >
        More components are cooking. Stay tuned.
      </Text>
    </div>
  );
};

const END_FRAMES = 340;
const STAGE_FRAMES = vf(END_START + END_FRAMES);

/** Stage-document clock: Date.now advances exactly 1/60 s per video frame (drives toast motion). */
const realDateNow = Date.now.bind(Date);
const dateBase = realDateNow();
let stageNow = dateBase;

/** Resolves after two animation frames of `win`, so a committed frame has painted. */
const painted = async (win: Window = window) => {
  const { promise, resolve } = Promise.withResolvers<undefined>();

  win.requestAnimationFrame(() => {
    win.requestAnimationFrame(() => {
      resolve(undefined);
    });
  });

  await promise;
};

/** Drive the embedded homepage's clocks from the stage timeline instead of wall time. */
const controlSiteClock = (event: React.SyntheticEvent<HTMLIFrameElement>) => {
  const win = event.currentTarget.contentWindow;
  const doc = event.currentTarget.contentDocument;

  if (!win || !doc) {
    return;
  }

  win.__vt = 0;
  const dateZero = win.Date.now();
  win.performance.now = () => win.__vt ?? 0;
  win.Date.now = () => dateZero + (win.__vt ?? 0);
  const style = doc.createElement("style");

  style.textContent =
    "nextjs-portal{display:none!important}html{scrollbar-width:none}*{cursor:none!important}";
  doc.head.append(style);
};

export const LaunchStage = () => {
  const [n, setN] = React.useState(0);
  const [pointer, setPointer] = React.useState<Point>([2000, 1180]);
  const iframe = React.useRef<HTMLIFrameElement>(null);
  const frame = n / K;

  React.useEffect(() => {
    Date.now = () => stageNow;

    window.__cut = CUT;
    window.__clickFrames = CLICK_FRAMES;
    window.__sounds = SOUND_FRAMES;
    window.__frames = STAGE_FRAMES;
    window.__montage = [vf(M0 - 40), vf(END_START + 40)];
    window.__track = (v: number) => trackX(v / K);
    window.__input = (v: number) => inputAt(v);
    window.__setFrame = async (v: number, point?: Point) => {
      stageNow = dateBase + Math.round((v * 1000) / 60);

      if (v / K < T.toSiteEnd) {
        await Promise.all(
          Object.values(layerUrls(v)).map(async (src) => {
            const image = new Image();
            image.src = src;
            await image.decode().catch(() => null);
          })
        );
      }

      const win = iframe.current?.contentWindow;

      if (win) {
        // Homepage clock (splash pulse, caret blink) follows the game's clock: 1/60 s per video frame.
        win.__vt = ((CUT + v) * 1000) / 60;
        win.scrollTo({ behavior: "instant", top: scrollAt(v / K) });
      }

      if (point) {
        setPointer(point);
      }

      setN(v);
      await painted();

      if (win) {
        await painted(win);
      }

      await painted();
    };
  }, []);

  const zoom = inOut(ramp(frame, T.zoomStart, T.zoomEnd));
  const cam = cameraAt(frame);
  const toSite = outCubic(ramp(frame, T.toSiteStart, T.toSiteEnd));
  const out = outCubic(ramp(frame, WINDOW_OUT, WINDOW_OUT + 36));

  return (
    <div
      style={{
        background: "#101010",
        height: H,
        left: 0,
        overflow: "hidden",
        position: "fixed",
        top: 0,
        width: W,
        zIndex: 40,
      }}
    >
      <style>
        {
          "nextjs-portal{display:none!important}canvas{image-rendering:pixelated}[data-launch-cursor]{shape-rendering:crispEdges}*{cursor:none!important}"
        }
      </style>
      {frame >= M0 - 40 && frame < END_START + 40 && <Montage frame={frame} />}
      {/* One toaster for the montage toast and the end-card advancement. */}
      {frame >= M0 - 40 && <Toaster scale={3} />}
      <div
        style={{
          display: out >= 1 ? "none" : undefined,
          height: H,
          left: 0,
          opacity: 1 - out,
          position: "absolute",
          top: 0,
          transform: zoom
            ? `translate(${W / 2}px, ${H / 2}px) scale(${cam.s - out * 0.03}) translate(${-cam.cx}px, ${-cam.cy}px)`
            : undefined,
          transformOrigin: "0 0",
          width: W,
        }}
      >
        <div
          style={{
            boxShadow: `0 ${40 * zoom}px ${120 * zoom}px rgb(0 0 0 / ${0.6 * zoom})`,
            inset: "-76px 0 0 0",
            position: "absolute",
          }}
        />
        <Chrome t={zoom} />
        <div
          style={{
            height: H,
            overflow: "hidden",
            position: "relative",
            width: W,
          }}
        >
          {/* eslint-disable-next-line react/iframe-missing-sandbox -- The stage drives the same-origin homepage's scripts and clocks directly. */}
          <iframe
            ref={iframe}
            src="/"
            title="grasscn"
            onLoad={controlSiteClock}
            style={{
              border: 0,
              height: H,
              inset: 0,
              opacity: frame >= T.siteEnd ? 1 : 0,
              position: "absolute",
              width: W,
            }}
          />
          {toSite < 1 && (
            <div
              style={{ inset: 0, opacity: 1 - toSite, position: "absolute" }}
            >
              <TitleLayer frame={frame} n={n} />
            </div>
          )}
        </div>
      </div>
      <Caption
        frame={frame}
        from={372}
        text="Real components. Fully interactive."
        to={700}
      />
      {frame >= END_START && <EndCard frame={frame} n={n} />}
      <Cursor t={frame} x={pointer[0]} y={pointer[1]} />
    </div>
  );
};
