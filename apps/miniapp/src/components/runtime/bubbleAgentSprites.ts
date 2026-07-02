export interface SpriteConfig {
  name: string;
  sheetName: string;
  frameCount: number;
  frameWidth: number;
  frameHeight: number;
  fps: number;
  loop: boolean;
  fallbackAction?: string;
  startFrame?: number;
  endFrame?: number;
  frameSequence?: number[];
  holdMs?: number;
}

export type BubbleSpriteVariant = "gray" | "black-gold" | "blue" | "purple" | "red" | "silver";

export const BUBBLE_SPRITE_VARIANTS: readonly BubbleSpriteVariant[] = [
  "gray",
  "black-gold",
  "blue",
  "purple",
  "red",
  "silver"
];

export function isBubbleSpriteVariant(value: unknown): value is BubbleSpriteVariant {
  return typeof value === "string" && BUBBLE_SPRITE_VARIANTS.includes(value as BubbleSpriteVariant);
}

export function resolveBubbleSpritePath(variant: BubbleSpriteVariant, config: SpriteConfig): string {
  return `/agent-bubble-dark/v3/${variant}/${config.sheetName}`;
}

export const BUBBLE_AGENT_SPRITES: Record<
  "idle" | "tap" | "tapRound" | "tapSquare" | "tapTriangle" | "dispatch" | "reward" | "busy" | "waiting" | "tired" | "failed",
  SpriteConfig
> = {
  idle: {
    name: "idle",
    sheetName: "idle-slime-sheet.png",
    frameCount: 24,
    frameWidth: 360,
    frameHeight: 360,
    fps: 7,
    loop: true
  },
  tap: {
    name: "tap",
    sheetName: "tap-round-sheet.png",
    frameCount: 14,
    frameWidth: 360,
    frameHeight: 360,
    fps: 7,
    loop: false,
    holdMs: 140,
    fallbackAction: "idle"
  },
  tapRound: {
    name: "tapRound",
    sheetName: "tap-round-sheet.png",
    frameCount: 14,
    frameWidth: 360,
    frameHeight: 360,
    fps: 7,
    loop: false,
    holdMs: 140,
    fallbackAction: "idle"
  },
  tapSquare: {
    name: "tapSquare",
    sheetName: "tap-square-sheet.png",
    frameCount: 20,
    frameWidth: 360,
    frameHeight: 360,
    fps: 7,
    loop: false,
    holdMs: 140,
    fallbackAction: "idle"
  },
  tapTriangle: {
    name: "tapTriangle",
    sheetName: "tap-triangle-sheet.png",
    frameCount: 19,
    frameWidth: 360,
    frameHeight: 360,
    fps: 7,
    loop: false,
    holdMs: 140,
    fallbackAction: "idle"
  },
  dispatch: {
    name: "dispatch",
    sheetName: "dispatch-sheet.png",
    frameCount: 24,
    frameWidth: 360,
    frameHeight: 360,
    fps: 13,
    loop: false,
    holdMs: 80,
    fallbackAction: "idle"
  },
  reward: {
    name: "reward",
    sheetName: "reward-sheet.png",
    frameCount: 16,
    frameWidth: 360,
    frameHeight: 360,
    fps: 7,
    loop: true
  },
  busy: {
    name: "busy",
    sheetName: "busy-sheet.png",
    frameCount: 16,
    frameWidth: 360,
    frameHeight: 360,
    fps: 8,
    loop: true
  },
  waiting: {
    name: "waiting",
    sheetName: "waiting-sheet.png",
    frameCount: 16,
    frameWidth: 360,
    frameHeight: 360,
    fps: 6,
    loop: true
  },
  tired: {
    name: "tired",
    sheetName: "tired-sheet.png",
    frameCount: 16,
    frameWidth: 360,
    frameHeight: 360,
    fps: 5,
    loop: true
  },
  failed: {
    name: "failed",
    sheetName: "failed-sheet.png",
    frameCount: 16,
    frameWidth: 360,
    frameHeight: 360,
    fps: 6,
    loop: true
  }
};
