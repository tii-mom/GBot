import React from "react";
import { AgentVisualProfile, AgentMood, AgentState } from "./petAgentTypes";
import { BubbleAgentSpriteStage } from "./BubbleAgentSpriteStage";
import { apiClient, getMockMode } from "../../apiClient";
import { BubbleAgentIdentity, isBubbleMintStatus } from "./bubbleAgentIdentity";
import { BubbleSpriteVariant } from "./bubbleAgentSprites";
import type { BubblePassportStatusResponse } from "@growthbot/shared";

interface AgentAvatarStageProps {
  profile: AgentVisualProfile;
  className?: string;
  onTap?: () => void;
  dispatchSignal?: number;
  onDispatchComplete?: () => void;
  identity: BubbleAgentIdentity;
  showNameplate?: boolean;
}

const stateLabels: Record<AgentState, string> = {
  dormant: "待激活",
  idle: "待命",
  scanning: "扫描中",
  exploring: "探索中",
  executing: "执行中",
  waiting_user: "待确认",
  verifying: "验收中",
  settling: "结算中",
  completed: "已完成",
  failed: "需复盘",
  low_ai_credit: "能量低",
  resting: "休整中"
};

const moodLabel: Record<AgentMood, string> = {
  happy: "稳定",
  focused: "专注",
  tired: "低能量",
  excited: "行动中",
  waiting: "等待确认",
  sleepy: "休整",
  failed: "需要复盘"
};

const hasRadarAccessory = (state: AgentState, profile: AgentVisualProfile) =>
  profile.accessoryIds.includes("accessory_radar") ||
  ["scanning", "exploring", "executing", "verifying", "settling"].includes(state);

const isBusyState = (state: AgentState) =>
  ["scanning", "exploring", "executing", "verifying", "settling"].includes(state);

export const AgentAvatarStage: React.FC<AgentAvatarStageProps> = ({
  profile,
  className = "",
  onTap,
  dispatchSignal = 0,
  onDispatchComplete,
  identity,
  showNameplate = true
}) => {
  const { displayNo, series, rarity, level, mintStatus: initialMintStatus } = identity;
  const storageKey = `gb_agent_mint_status_${displayNo}`;
  const isMockMode = typeof window !== "undefined" && getMockMode();

  const [mintStatus, setMintStatus] = React.useState<"unminted" | "minting" | "minted" | "failed">(() => {
    if (typeof window !== "undefined" && isMockMode) {
      const storedMintStatus = localStorage.getItem(storageKey);
      return isBubbleMintStatus(storedMintStatus) ? storedMintStatus : initialMintStatus;
    }
    return initialMintStatus;
  });

  React.useEffect(() => {
    setMintStatus(initialMintStatus);
  }, [displayNo, initialMintStatus]);

  React.useEffect(() => {
    if (isMockMode || displayNo === "GBOT-000000") return;
    let active = true;
    apiClient.getBubblePassportStatus(displayNo)
      .then((response: BubblePassportStatusResponse) => {
        if (!active) return;
        setMintStatus(response.passport.mintStatus);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [displayNo, isMockMode]);

  React.useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const handlePassportStatus = (event: Event) => {
      const detail = (event as CustomEvent<{ displayNo?: string; mintStatus?: typeof mintStatus }>).detail;
      if (detail?.displayNo !== displayNo || !isBubbleMintStatus(detail.mintStatus)) return;
      setMintStatus(detail.mintStatus);
    };

    const handleStorage = (event: StorageEvent) => {
      if (!isMockMode || event.key !== storageKey || !isBubbleMintStatus(event.newValue)) return;
      setMintStatus(event.newValue);
    };

    window.addEventListener("gb_agent_mint_status_changed", handlePassportStatus);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("gb_agent_mint_status_changed", handlePassportStatus);
      window.removeEventListener("storage", handleStorage);
    };
  }, [displayNo, isMockMode, storageKey]);

  const handleStatusClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isMockMode) return;
    const statuses = ["unminted", "minting", "minted", "failed"] as const;
    const currentIndex = statuses.indexOf(mintStatus);
    const nextStatus = statuses[(currentIndex + 1) % statuses.length] || "unminted";
    setMintStatus(nextStatus);
    if (typeof window !== "undefined") {
      localStorage.setItem(storageKey, nextStatus);
      window.dispatchEvent(new CustomEvent("gb_agent_mint_status_changed", {
        detail: { displayNo, mintStatus: nextStatus }
      }));
    }
  };

  // Check for URL query parameter or localStorage overrides if we are in mock mode
  let activeState = profile.state;
  if (typeof window !== "undefined" && isMockMode) {
    const params = new URLSearchParams(window.location.search);
    const debugState = params.get("agentState") || localStorage.getItem("gb_debug_agent_state");
    if (debugState && stateLabels[debugState as AgentState]) {
      activeState = debugState as AgentState;
    }
  }

  const colorGeneClasses: Record<string, BubbleSpriteVariant> = {
    "烟灰泥泡泡": "gray",
    "黑金泥泡泡": "black-gold",
    "冰蓝泥泡泡": "blue",
    "暗紫泥泡泡": "purple",
    "赤金泥泡泡": "red",
    "白银泥泡泡": "silver"
  };
  const colorGeneClass: BubbleSpriteVariant = colorGeneClasses[identity.colorGene] || "gray";

  const stateLabel = stateLabels[activeState];
  const isShieldVisible = activeState === "waiting_user" || activeState === "low_ai_credit" || activeState === "failed";
  const isReportVisible = activeState === "completed" || activeState === "verifying" || activeState === "settling";
  const accentTone = activeState === "failed" ? "danger" : activeState === "low_ai_credit" || activeState === "waiting_user" ? "warn" : "stable";
  const actionMode = isBusyState(activeState) ? "busy" : activeState === "completed" ? "reward" : "idle";
  
  // Base state mapping for 2D sprite sequence sheets
  const baseSpriteState =
    activeState === "completed" ? "reward" :
    isBusyState(activeState) ? "busy" :
    activeState === "waiting_user" ? "waiting" :
    (activeState === "low_ai_credit" || activeState === "resting") ? "tired" :
    activeState === "failed" ? "failed" :
    "idle";

  // Map mintStatus to UI text
  const displayTokenId = identity.tokenId || (mintStatus === "minted" ? `Passport-#${displayNo.replace("GBOT-", "")}` : undefined);
  const statusTexts = {
    unminted: "游戏内资产 · 可选择铸造 Passport",
    minting: "等待钱包确认",
    minted: displayTokenId ? `已铸造 Passport (${displayTokenId})` : "已铸造 Passport",
    failed: "铸造失败，可重试"
  };
  const mintStatusText = statusTexts[mintStatus];

  return (
    <section
      className={`agent-avatar-stage bubble-agent-stage ${className}`}
      data-state={activeState}
      data-zodiac={profile.zodiac}
      data-mood={profile.mood}
      data-tone={accentTone}
      data-action={actionMode}
      data-color-gene={colorGeneClass}
      aria-label={`Agent 当前状态：${stateLabel}，情绪：${moodLabel[profile.mood]}`}
    >
      <div className="bubble-scene" aria-hidden="true">
        <span className="bubble-scene__glow" />
        <span className="bubble-scene__cloud bubble-scene__cloud--left" />
        <span className="bubble-scene__cloud bubble-scene__cloud--right" />
        <span className="bubble-scene__star bubble-scene__star--a" />
        <span className="bubble-scene__star bubble-scene__star--b" />
        <span className="bubble-scene__star bubble-scene__star--c" />
      </div>

      <div className="bubble-agent-wrap" aria-hidden="true">
        <span className="bubble-agent-orbit bubble-agent-orbit--outer" />
        <span className="bubble-agent-orbit bubble-agent-orbit--inner" />
        <span className="bubble-agent-orbit bubble-agent-orbit--scan" />

        <BubbleAgentSpriteStage
          baseState={baseSpriteState}
          variant={colorGeneClass}
          actionSignal={dispatchSignal}
          actionState="dispatch"
          actionFallbackState="busy"
          onActionComplete={onDispatchComplete}
          onTap={onTap}
        />

        <div className="bubble-agent-charms">
          <span className={`bubble-agent-charm bubble-agent-charm--core bubble-agent-charm--${accentTone}`} />
          {hasRadarAccessory(activeState, profile) && <span className="bubble-agent-charm bubble-agent-charm--radar" />}
          {isShieldVisible && <span className="bubble-agent-charm bubble-agent-charm--shield" />}
          {isReportVisible && <span className="bubble-agent-charm bubble-agent-charm--scroll" />}
        </div>
      </div>

      {showNameplate && (
        <div className="agent-asset-nameplate">
          <div className="agent-asset-nameplate__header">
            <span className="agent-asset-nameplate__id">GBot #{displayNo.replace("GBOT-", "")}</span>
            <span className={`agent-asset-nameplate__rarity is-${rarity.toLowerCase()}`}>{rarity}</span>
          </div>
          <div className="agent-asset-nameplate__series">{series} · Lv.{level}</div>
          
          {identity.naturalSkills && identity.naturalSkills.length > 0 && (
            <div className="agent-asset-nameplate__skills">
              {identity.naturalSkills.map(s => (
                <span key={s.code} className={`agent-asset-nameplate__skill is-${s.tier.toLowerCase()}`} title={s.desc}>
                  🧬 {s.name}
                </span>
              ))}
            </div>
          )}

          <div 
            className={`agent-asset-nameplate__status is-${mintStatus}`} 
            onClick={handleStatusClick} 
            style={{ cursor: isMockMode ? "pointer" : "default" }}
          >
            <span className="agent-asset-nameplate__status-dot" />
            {mintStatusText}
          </div>
        </div>
      )}

      <div className="agent-avatar-status" aria-hidden="true">
        <span className="agent-avatar-status__dot agent-avatar-status__dot--left" />
        <span className="agent-avatar-status__bar" />
        <span className="agent-avatar-status__dot agent-avatar-status__dot--right" />
      </div>
    </section>
  );
};
