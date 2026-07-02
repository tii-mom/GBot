import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  BUBBLE_AGENT_SPRITES,
  BubbleSpriteVariant,
  resolveBubbleSpritePath
} from "./bubbleAgentSprites";

export type BubbleAgentSpriteState =
  | "idle"
  | "tap"
  | "tapRound"
  | "tapSquare"
  | "tapTriangle"
  | "dispatch"
  | "reward"
  | "busy"
  | "waiting"
  | "tired"
  | "failed";

const ALL_BUBBLE_AGENT_STATES: BubbleAgentSpriteState[] = [
  "idle",
  "tap",
  "tapRound",
  "tapSquare",
  "tapTriangle",
  "dispatch",
  "reward",
  "busy",
  "waiting",
  "tired",
  "failed"
];

const INITIAL_BUBBLE_AGENT_STATES: BubbleAgentSpriteState[] = [
  "idle",
  "tapRound",
  "tapSquare",
  "tapTriangle"
];

interface BubbleAgentSpriteStageProps {
  baseState: BubbleAgentSpriteState;
  variant?: BubbleSpriteVariant;
  actionSignal?: number;
  actionState?: BubbleAgentSpriteState;
  actionFallbackState?: BubbleAgentSpriteState;
  className?: string;
  onTap?: () => void;
  onActionComplete?: () => void;
}

export const BubbleAgentSpriteStage: React.FC<BubbleAgentSpriteStageProps> = ({
  baseState,
  variant = "gray",
  actionSignal = 0,
  actionState = "dispatch",
  actionFallbackState,
  className = "",
  onTap,
  onActionComplete
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [playingState, setPlayingState] = useState<BubbleAgentSpriteState>(baseState);
  
  // Cache image preloads to avoid flashing
  const imagesRef = useRef<Record<string, HTMLImageElement>>({});
  const loadingImagesRef = useRef<Record<string, HTMLImageElement>>({});
  const loadedStatesRef = useRef<Record<string, boolean>>({});
  const [loadedStates, setLoadedStates] = useState<Record<string, boolean>>({});
  const frameBoundsRef = useRef<Record<string, Array<{ left: number; right: number; top: number; bottom: number } | null>>>({});
  const lastTapAtRef = useRef(0);
  const tapVariantIndexRef = useRef(0);
  const holdTimeoutRef = useRef<number | null>(null);
  const playingStateRef = useRef<BubbleAgentSpriteState>(baseState);
  const isExternalActionRef = useRef(false);
  const [tapVariantIndex, setTapVariantIndex] = useState(0);

  const DISPLAY_SIZE = 264; // Larger canvas lets the slime fill the stage while preserving click target comfort.
  const getAssetKey = (state: BubbleAgentSpriteState) => `${variant}:${state}`;

  const markLoadedStates = useCallback((states: BubbleAgentSpriteState[]) => {
    let changed = false;
    const nextLoaded = { ...loadedStatesRef.current };
    states.forEach((state) => {
      const assetKey = getAssetKey(state);
      if (!nextLoaded[assetKey]) {
        nextLoaded[assetKey] = true;
        changed = true;
      }
    });
    if (!changed) return;
    loadedStatesRef.current = nextLoaded;
    setLoadedStates(nextLoaded);
  }, [variant]);

  // Keep track of the current baseState to handle visibility updates or click restoration
  const baseStateRef = useRef<BubbleAgentSpriteState>(baseState);
  useEffect(() => {
    baseStateRef.current = baseState;
    if (!playingStateRef.current.startsWith("tap") && !isExternalActionRef.current) {
      setPlayingState(baseState);
    }
  }, [baseState, variant]);

  useEffect(() => {
    playingStateRef.current = playingState;
  }, [playingState]);

  const computeFrameBounds = (img: HTMLImageElement, config: typeof BUBBLE_AGENT_SPRITES[BubbleAgentSpriteState]) => {
    const scratch = document.createElement("canvas");
    scratch.width = config.frameWidth;
    scratch.height = config.frameHeight;
    const scratchCtx = scratch.getContext("2d", { willReadFrequently: true });
    if (!scratchCtx) return [];

    return Array.from({ length: config.frameCount }, (_, index) => {
      const sheetFrame = config.frameSequence?.[index] ?? (config.startFrame || 0) + index;
      scratchCtx.clearRect(0, 0, config.frameWidth, config.frameHeight);
      scratchCtx.drawImage(
        img,
        sheetFrame * config.frameWidth,
        0,
        config.frameWidth,
        config.frameHeight,
        0,
        0,
        config.frameWidth,
        config.frameHeight
      );

      const pixels = scratchCtx.getImageData(0, 0, config.frameWidth, config.frameHeight).data;
      let left = config.frameWidth;
      let right = 0;
      let top = config.frameHeight;
      let bottom = 0;

      for (let y = 0; y < config.frameHeight; y += 1) {
        for (let x = 0; x < config.frameWidth; x += 1) {
          const alpha = pixels[(y * config.frameWidth + x) * 4 + 3] ?? 0;
          if (alpha <= 8) continue;
          left = Math.min(left, x);
          right = Math.max(right, x);
          top = Math.min(top, y);
          bottom = Math.max(bottom, y);
        }
      }

      return left <= right ? { left, right, top, bottom } : null;
    });
  };

  const loadSpriteStates = useCallback((states: BubbleAgentSpriteState[]) => {
    Array.from(new Set(states)).forEach((state) => {
      const config = BUBBLE_AGENT_SPRITES[state];
      const sheetPath = resolveBubbleSpritePath(variant, config);
      const assetKey = getAssetKey(state);

      if (loadedStatesRef.current[assetKey]) return;

      const loadingImage = loadingImagesRef.current[sheetPath];
      if (loadingImage) {
        imagesRef.current[assetKey] = loadingImage;
        return;
      }

      const existingImage = imagesRef.current[assetKey];
      if (existingImage?.complete && existingImage.naturalWidth > 0) {
        frameBoundsRef.current[assetKey] = frameBoundsRef.current[assetKey] || computeFrameBounds(existingImage, config);
        markLoadedStates([state]);
        return;
      }

      const img = new Image();
      loadingImagesRef.current[sheetPath] = img;

      const sameSheetStates = ALL_BUBBLE_AGENT_STATES.filter((candidateState) => (
        resolveBubbleSpritePath(variant, BUBBLE_AGENT_SPRITES[candidateState]) === sheetPath
      ));
      sameSheetStates.forEach((candidateState) => {
        imagesRef.current[getAssetKey(candidateState)] = img;
      });

      img.onload = () => {
        sameSheetStates.forEach((candidateState) => {
          const candidateKey = getAssetKey(candidateState);
          frameBoundsRef.current[candidateKey] = computeFrameBounds(img, BUBBLE_AGENT_SPRITES[candidateState]);
        });
        delete loadingImagesRef.current[sheetPath];
        markLoadedStates(sameSheetStates);
      };

      img.onerror = () => {
        delete loadingImagesRef.current[sheetPath];
      };

      img.src = sheetPath;
    });
  }, [markLoadedStates, variant]);

  useEffect(() => {
    imagesRef.current = {};
    loadingImagesRef.current = {};
    frameBoundsRef.current = {};
    loadedStatesRef.current = {};
    setLoadedStates({});
  }, [variant]);

  useEffect(() => {
    loadSpriteStates([...INITIAL_BUBBLE_AGENT_STATES, baseState]);
  }, [baseState, loadSpriteStates]);

  useEffect(() => {
    loadSpriteStates([playingState]);
  }, [loadSpriteStates, playingState]);

  useEffect(() => {
    if (actionSignal) loadSpriteStates([actionState, actionFallbackState || baseState]);
  }, [actionFallbackState, actionSignal, actionState, baseState, loadSpriteStates]);

  const triggerTap = () => {
    const now = Date.now();
    if (now - lastTapAtRef.current < 260) return;
    lastTapAtRef.current = now;

    if (playingStateRef.current.startsWith("tap") || isExternalActionRef.current) return;

    onTap?.();
    loadSpriteStates(["tapRound", "tapSquare", "tapTriangle"]);

    if (
      loadedStatesRef.current[getAssetKey("tapRound")] &&
      loadedStatesRef.current[getAssetKey("tapSquare")] &&
      loadedStatesRef.current[getAssetKey("tapTriangle")]
    ) {
      const tapVariants: BubbleAgentSpriteState[] = ["tapRound", "tapSquare", "tapTriangle"];
      const nextVariant = tapVariants[tapVariantIndexRef.current % tapVariants.length] || "tapRound";
      tapVariantIndexRef.current += 1;
      setTapVariantIndex(tapVariantIndexRef.current);
      setPlayingState(nextVariant);
    }
  };

  useEffect(() => {
    if (!actionSignal) return;
    loadSpriteStates([actionState, actionFallbackState || baseState]);

    if (holdTimeoutRef.current) {
      window.clearTimeout(holdTimeoutRef.current);
      holdTimeoutRef.current = null;
    }
    isExternalActionRef.current = true;
    setPlayingState(actionState);
  }, [actionSignal, actionState, actionFallbackState, baseState, loadSpriteStates]);

  const handleTapStart = (e: React.SyntheticEvent) => {
    e.stopPropagation();

    if ("nativeEvent" in e) {
      const nativeEvent = e.nativeEvent as Event;
      if (nativeEvent.type !== "pointerdown") return;
    }

    triggerTap();
  };

  // Canvas drawing & Frame loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let lastTime = 0;
    let accumulatedTime = 0;
    let currentFrame = 0;
    let isHoldingLastFrame = false;

    if (holdTimeoutRef.current) {
      window.clearTimeout(holdTimeoutRef.current);
      holdTimeoutRef.current = null;
    }

    // Check system setting for reduced motion
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let prefersReduced = mediaQuery.matches;
    const handleMediaChange = (e: MediaQueryListEvent) => {
      prefersReduced = e.matches;
    };
    mediaQuery.addEventListener("change", handleMediaChange);

    // Visibility API listener to stop loops when the page is inactive
    let isVisible = document.visibilityState === "visible";
    const handleVisibilityChange = () => {
      isVisible = document.visibilityState === "visible";
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    const tick = (timestamp: number) => {
      if (!lastTime) lastTime = timestamp;
      const deltaTime = timestamp - lastTime;
      lastTime = timestamp;

      // Skip processing and loop if the page is hidden to save energy
      if (!isVisible) {
        animationFrameId = requestAnimationFrame(tick);
        return;
      }

      const config = BUBBLE_AGENT_SPRITES[playingState];
      const assetKey = getAssetKey(playingState);
      const img = imagesRef.current[assetKey];

      // Fallback: draw a soft glowing gradient circle while the image is loading
      if (!img) {
        ctx.clearRect(0, 0, DISPLAY_SIZE, DISPLAY_SIZE);
        ctx.beginPath();
        ctx.arc(DISPLAY_SIZE / 2, DISPLAY_SIZE / 2, DISPLAY_SIZE / 3, 0, 2 * Math.PI);
        const gradient = ctx.createRadialGradient(
          DISPLAY_SIZE / 2, DISPLAY_SIZE / 2, 5,
          DISPLAY_SIZE / 2, DISPLAY_SIZE / 2, DISPLAY_SIZE / 3
        );
        gradient.addColorStop(0, "rgba(255, 230, 150, 0.4)");
        gradient.addColorStop(1, "rgba(255, 255, 255, 0.05)");
        ctx.fillStyle = gradient;
        ctx.fill();
        
        animationFrameId = requestAnimationFrame(tick);
        return;
      }

      // If reduced motion is requested, render the first frame and pause
      if (prefersReduced) {
        const sheetFrame = config.frameSequence?.[0] ?? (config.startFrame || 0);
        ctx.clearRect(0, 0, DISPLAY_SIZE, DISPLAY_SIZE);
        ctx.drawImage(
          img,
          sheetFrame * config.frameWidth,
          0,
          config.frameWidth,
          config.frameHeight,
          0,
          0,
          DISPLAY_SIZE,
          DISPLAY_SIZE
        );
        animationFrameId = requestAnimationFrame(tick);
        return;
      }

      // Delta time accumulation for frame-independent playback rate
      accumulatedTime += deltaTime;
      const msPerFrame = 1000 / config.fps;

      if (accumulatedTime >= msPerFrame) {
        const framesToAdvance = Math.floor(accumulatedTime / msPerFrame);
        accumulatedTime %= msPerFrame;

        const nextFrame = currentFrame + framesToAdvance;
        if (nextFrame >= config.frameCount) {
          if (config.loop) {
            currentFrame = nextFrame % config.frameCount;
          } else {
            const holdMs = config.holdMs || 0;
            currentFrame = Math.max(0, config.frameCount - 1);
            accumulatedTime = 0;
            if (!isHoldingLastFrame) {
              isHoldingLastFrame = true;
              holdTimeoutRef.current = window.setTimeout(() => {
                const nextState = isExternalActionRef.current
                  ? (actionFallbackState || baseStateRef.current)
                  : baseStateRef.current;
                isExternalActionRef.current = false;
                setPlayingState(nextState);
                if (playingState === actionState) {
                  onActionComplete?.();
                }
                holdTimeoutRef.current = null;
              }, holdMs);
            }
          }
        } else {
          currentFrame = nextFrame;
        }
      }

      // Render the current frame
      ctx.clearRect(0, 0, DISPLAY_SIZE, DISPLAY_SIZE);
      const sheetFrame = config.frameSequence?.[currentFrame] ?? (config.startFrame || 0) + currentFrame;
      const sx = sheetFrame * config.frameWidth;
      const sy = 0;
      const frameBounds = frameBoundsRef.current[assetKey]?.[currentFrame];
      const dx = frameBounds ? (DISPLAY_SIZE - (frameBounds.left + frameBounds.right) * (DISPLAY_SIZE / config.frameWidth)) / 2 : 0;
      const dy = frameBounds ? (DISPLAY_SIZE * 0.92) - ((frameBounds.bottom + 1) * (DISPLAY_SIZE / config.frameHeight)) : 0;

      ctx.drawImage(
        img,
        sx,
        sy,
        config.frameWidth,
        config.frameHeight,
        dx,
        dy,
        DISPLAY_SIZE,
        DISPLAY_SIZE
      );

      animationFrameId = requestAnimationFrame(tick);
    };

    animationFrameId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animationFrameId);
      if (holdTimeoutRef.current) {
        window.clearTimeout(holdTimeoutRef.current);
        holdTimeoutRef.current = null;
      }
      mediaQuery.removeEventListener("change", handleMediaChange);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [playingState, variant, actionFallbackState, actionState, onActionComplete]);

  // Handle DPR resolution scaling
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = DISPLAY_SIZE * dpr;
    canvas.height = DISPLAY_SIZE * dpr;

    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.scale(dpr, dpr);
    }
  }, []);

  return (
    <div
      className={`bubble-agent-sprite-container ${className}`}
      data-sprite-state={playingState}
      data-sprite-variant={variant}
      data-tap-ready={loadedStates[getAssetKey("tapRound")] && loadedStates[getAssetKey("tapSquare")] && loadedStates[getAssetKey("tapTriangle")] ? "true" : "false"}
      data-tap-variant-index={tapVariantIndex}
      onPointerDown={handleTapStart}
      style={{
        width: `${DISPLAY_SIZE}px`,
        height: `${DISPLAY_SIZE}px`,
        position: "absolute",
        zIndex: 4,
        display: "flex",
        justifyContent: "center",
        alignItems: "center"
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: "100%",
          height: "100%",
          display: "block",
          cursor: "pointer"
        }}
      />
    </div>
  );
};
