import { INPUT } from "../../config/feel";
import { DESIGN_W } from "../../core/Viewport";
import { BONE, STEEL } from "../../render/palette";
import { drawText } from "../../render/text";
import { drawPanel } from "../widgets/Panel";
import { Button } from "../widgets/Button";
import { Slider } from "../widgets/Slider";
import { Toggle } from "../widgets/Toggle";
import type { WidgetTree } from "../Widget";

export interface Settings {
  bloom: boolean;
  scanlines: boolean;
  vignette: boolean;
  shake: boolean;
  ditherStrength: number;
  /** Capture the mouse during play, so the cursor cannot leave the window and freeze steering. */
  mouseLock: boolean;
}

export const defaultSettings = (): Settings => ({
  bloom: true,
  scanlines: true,
  vignette: true,
  shake: true,
  ditherStrength: 1,
  mouseLock: INPUT.mouseLock,
});

const PANEL = { x: DESIGN_W * 0.5 - 260, y: 118, w: 520, h: 476 };

export function buildOptions(tree: WidgetTree, settings: Settings, onBack: () => void): void {
  tree.clear();
  const x = PANEL.x + 44;
  const w = PANEL.w - 88;
  let y = PANEL.y + 62;
  const gap = 54;

  const bloom = tree.add(new Toggle(x, y, w, 34, "bloom", settings.bloom));
  bloom.onChange = (v) => (settings.bloom = v);
  y += gap;

  const scan = tree.add(new Toggle(x, y, w, 34, "scanlines", settings.scanlines));
  scan.onChange = (v) => (settings.scanlines = v);
  y += gap;

  const vig = tree.add(new Toggle(x, y, w, 34, "vignette", settings.vignette));
  vig.onChange = (v) => (settings.vignette = v);
  y += gap;

  const shake = tree.add(new Toggle(x, y, w, 34, "screen shake", settings.shake));
  shake.onChange = (v) => (settings.shake = v);
  y += gap;

  const dither = tree.add(new Slider(x, y, w, 34, "dither strength", settings.ditherStrength, 8));
  dither.onChange = (v) => (settings.ditherStrength = v);
  y += gap;

  const lock = tree.add(new Toggle(x, y, w, 34, "capture mouse", settings.mouseLock));
  lock.onChange = (v) => (settings.mouseLock = v);
  y += gap + 14;

  const back = tree.add(new Button(DESIGN_W * 0.5 - 90, y, 180, 48, "back", "neutral"));
  back.onPress = onBack;
}

export function drawOptions(ctx: CanvasRenderingContext2D): void {
  drawPanel(ctx, PANEL.x, PANEL.y, PANEL.w, PANEL.h, "options");
  drawText(ctx, "display  ·  input", PANEL.x + 44, PANEL.y + 30, {
    size: 12,
    color: STEEL[3],
    tracking: 0.44,
    weight: "light",
  });
  drawText(ctx, "settings are not saved", DESIGN_W * 0.5, PANEL.y + PANEL.h - 16, {
    size: 10,
    color: BONE[0],
    align: "center",
    tracking: 0.3,
    weight: "light",
    alpha: 0.35,
  });
}
