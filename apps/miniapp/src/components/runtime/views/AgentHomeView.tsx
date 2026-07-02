import {
  AlertTriangle,
  Bot,
  ChevronRight,
  Coins,
  Crosshair,
  Gauge,
  LockKeyhole,
  Send,
  Share2,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Wallet,
  Zap
} from "lucide-react";
import React from "react";
import { RuntimeState, WorkspacePrimaryActionKind } from "../runtimeTypes";
import { AgentAvatarStage } from "../AgentAvatarStage";
import { deriveAgentVisualProfile, deriveValueCreationSummary } from "../petAgentAdapters";
import { deriveBubbleAgentIdentity, isBubbleInventoryItem } from "../bubbleAgentIdentity";
import { RuntimeTab } from "../petAgentTypes";
import { apiClient } from "../../../apiClient";
import { telegramAdapter } from "../../../telegramAdapter";
import { deriveTelegramPlaygroundContext } from "../telegramPlaygroundAdapter";
import { SkillCardDeck } from "../SkillCardDeck";

interface AgentHomeViewProps {
  state: RuntimeState;
  setTab: (tab: RuntimeTab) => void;
  onPrimaryAction: (kind: WorkspacePrimaryActionKind) => void;
  onDispatchAgent?: () => Promise<void>;
  openReport?: (runId: string) => Promise<void>;
}

function getAssetAmount(state: RuntimeState, asset: "G" | "TON" | "AI_CREDIT") {
  return state.assetBalances.find((balance) => balance.asset === asset)?.available.amount || "0";
}

function clampPercent(value: number, max: number) {
  if (!Number.isFinite(value) || max <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((value / max) * 100)));
}

function parseAmount(value: string | number | undefined | null) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatAgentNo(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number") return "";
  const raw = String(value).trim();
  if (!raw) return "";
  if (/^#?\d{1,6}$/.test(raw)) return `#${raw.replace("#", "").padStart(6, "0")}`;
  if (/^agent[-_#]?\d{1,8}$/i.test(raw)) return raw.toUpperCase().replace("_", "-");
  return raw.slice(0, 14);
}

function deriveAgentDisplayNo(agent: RuntimeState["agent"]) {
  if (!agent) return "#000000";
  const a = agent as any;
  const explicitNo = formatAgentNo(a.displayNo || a.agentNo || a.serialNo || a.display_no || a.agent_no || a.serial_no);
  if (explicitNo) return explicitNo;

  let hash = 0;
  const source = `${agent.id}:agent`;
  for (let i = 0; i < source.length; i++) {
    hash = (hash << 5) - hash + source.charCodeAt(i);
    hash |= 0;
  }
  return `#${String(Math.abs(hash) % 1000000).padStart(6, "0")}`;
}

export const AgentHomeView: React.FC<AgentHomeViewProps> = ({ state, setTab, onPrimaryAction, onDispatchAgent, openReport }) => {
  const { agent, activeRun, runs, walletPolicy, aiCreditBalance, skills, inventory } = state;
  const [dispatchSignal, setDispatchSignal] = React.useState(0);
  const [isDispatching, setIsDispatching] = React.useState(false);
  const [dispatchNotice, setDispatchNotice] = React.useState("");
  const [selectedBubbleItemId, setSelectedBubbleItemId] = React.useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("gb_selected_bubble_item_id");
  });
  const dispatchTimeoutRef = React.useRef<number | null>(null);
  const tgContext = deriveTelegramPlaygroundContext();
  React.useEffect(() => () => {
    if (dispatchTimeoutRef.current) {
      window.clearTimeout(dispatchTimeoutRef.current);
      dispatchTimeoutRef.current = null;
    }
  }, []);

  React.useEffect(() => {
    const syncSelectedBubble = () => {
      setSelectedBubbleItemId(localStorage.getItem("gb_selected_bubble_item_id"));
    };
    window.addEventListener("storage", syncSelectedBubble);
    window.addEventListener("focus", syncSelectedBubble);
    window.addEventListener("gb_selected_bubble_changed", syncSelectedBubble);
    return () => {
      window.removeEventListener("storage", syncSelectedBubble);
      window.removeEventListener("focus", syncSelectedBubble);
      window.removeEventListener("gb_selected_bubble_changed", syncSelectedBubble);
    };
  }, []);

  const goExplore = React.useCallback(() => {
    if (dispatchTimeoutRef.current) {
      window.clearTimeout(dispatchTimeoutRef.current);
      dispatchTimeoutRef.current = null;
    }
    setIsDispatching(false);
    setTab("Explore");
  }, [setTab]);

  if (!agent) {
    return (
      <main className="gbot-game-home gbot-game-home--claim">
        <section className="gbot-claim">
          <div className="gbot-pill">
            <Sparkles size={14} />
            GBOT 养成主线
          </div>
          <h1>领养一只会赚钱的 Agent</h1>
          <p>先拥有 Agent，再给它购买技能卡。它会消耗 G 燃料执行任务，外部赏金归你的钱包或平台账户。</p>
          <div className="gbot-claim__stage">
            <div className="gbot-unborn-stage" aria-label="未出生泥泡泡 Agent">
              <div className="gbot-unborn-stage__scan" />
              <img src="/agent-bubble-dark/reference/unborn-bubble.png" alt="未出生泥泡泡 Agent" />
              <div className="gbot-unborn-stage__status">
                <span>UNBORN</span>
                <strong>等待激活</strong>
              </div>
            </div>
          </div>
          <button className="gbot-primary-button" onClick={() => onPrimaryAction("claim")}>
            <Bot size={18} />
            激活我的 Agent
          </button>
        </section>
      </main>
    );
  }

  const profile = deriveAgentVisualProfile(agent, activeRun, walletPolicy, aiCreditBalance);
  const bubbleItems = (inventory || []).filter(isBubbleInventoryItem);
  const selectedBubble = bubbleItems.find((item) => item.id === selectedBubbleItemId) || bubbleItems[0] || null;
  
  const identity = deriveBubbleAgentIdentity(agent, selectedBubble);

  const valueSummary = deriveValueCreationSummary(agent, activeRun, runs);
  const latestRun = runs[0] || null;
  const gBalance = getAssetAmount(state, "G");
  const tonBalance = getAssetAmount(state, "TON");
  const aiCredits = aiCreditBalance[0]?.balance.amount || getAssetAmount(state, "AI_CREDIT") || String(agent.energy || 0);
  const equippedNames = skills.map((skill) => skill.skillName || skill.skillCode).filter(Boolean).slice(0, 4);
  const energyMax = agent.maxEnergy || 240;
  const energyValue = parseAmount(aiCredits);
  const dailyRunLimit = agent.dailyRunLimit || 3;
  const dailyRunCount = agent.dailyRunCount || 0;
  const tokenPercent = clampPercent(energyValue, energyMax);
  const gPercent = clampPercent(parseAmount(gBalance), 300);
  const tonPercent = clampPercent(parseAmount(tonBalance), 1);
  const runPercent = clampPercent(dailyRunLimit - dailyRunCount, dailyRunLimit);
  const todayClues = tgContext.available ? tgContext.cluesCount : valueSummary.todayRadarCount;
  const agentDisplayName = agent.name?.trim() || "我的 Agent";
  const agentDisplayNo = deriveAgentDisplayNo(agent);
  const bubbleDisplayNo = identity.displayNo.replace("GBOT-", "");
  const naturalSkillLabel = identity.naturalSkills.length > 0
    ? identity.naturalSkills.map((skill) => skill.name).join(" / ")
    : "无天生标签";

  const handleShareAgent = () => {
    const link = typeof window !== "undefined" ? `${window.location.origin}/?startapp=agent_${identity.displayNo}` : "https://t.me/GrowthBot";
    const text = `我的 GBot ${identity.series} ${identity.displayNo} 已装配 ${equippedNames.length}/4 个技能槽，正在整理候选机会。候选结果需验收后结算。`;
    void apiClient.trackEvent("share_clicked", "agent_home", { displayNo: identity.displayNo, colorGene: identity.colorGene });
    void apiClient.trackEvent("share_completed", "agent_home", { displayNo: identity.displayNo, colorGene: identity.colorGene });
    telegramAdapter.shareUrl(link, text);
  };

  const handleDispatch = () => {
    setDispatchSignal((value) => value + 1);
    setIsDispatching(true);
    setDispatchNotice("Agent 已出勤，正在整理本次行动。");
    if (dispatchTimeoutRef.current) {
      window.clearTimeout(dispatchTimeoutRef.current);
    }
    dispatchTimeoutRef.current = window.setTimeout(async () => {
      try {
        if (onDispatchAgent) {
          await onDispatchAgent();
          setDispatchNotice("出勤完成，战报已生成。");
        } else {
          goExplore();
        }
      } finally {
        setIsDispatching(false);
        dispatchTimeoutRef.current = null;
      }
    }, 1800);
  };

  return (
    <main className="gbot-game-home" data-dispatching={isDispatching ? "true" : "false"}>
      <section className="game-home-console">
        <section className="game-agent-stage">
          <div className="game-stage-hud">
            <span className="game-hud__nav-slot" aria-hidden="true" />
            <button className="game-hud__agent" type="button" onClick={() => setTab("Nest")}>
              <span>
                <small>当前 Agent</small>
                <strong>{agentDisplayName}</strong>
                <em>编号 {agentDisplayNo} · Lv.{agent.level || 1}</em>
              </span>
            </button>
            <button className="game-hud__wallet" type="button" onClick={() => setTab("Nest")}>
              <Coins size={16} />
              {gBalance} G
            </button>
          </div>

          <div className="game-stage-avatar">
            <AgentAvatarStage
              profile={profile}
              identity={identity}
              dispatchSignal={dispatchSignal}
              showNameplate={false}
            />
          </div>

          <div className="game-bubble-identity-bar" aria-label="当前泡泡资产信息">
            <div className="game-bubble-identity-bar__main">
              <span>泡泡编号</span>
              <strong>GBot #{bubbleDisplayNo}</strong>
            </div>
            <span className={`game-bubble-identity-bar__rarity is-${identity.rarity.toLowerCase()}`}>{identity.rarity}</span>
            <div className="game-bubble-identity-bar__series">
              <span>{identity.series} · Lv.{identity.level}</span>
              <small>{naturalSkillLabel}</small>
            </div>
          </div>

          <div className="game-vitals game-stage-vitals" aria-label="Agent 状态条">
            <div className="game-vital game-vital--energy">
              <div>
                <Zap size={16} />
                <span>Token 能量</span>
                <strong>{aiCredits}</strong>
              </div>
              <i><b style={{ width: `${tokenPercent}%` }} /></i>
            </div>
            <div className="game-vital game-vital--g">
              <div>
                <Coins size={16} />
                <span>G 燃料</span>
                <strong>{gBalance}</strong>
              </div>
              <i><b style={{ width: `${gPercent}%` }} /></i>
            </div>
            <div className="game-vital game-vital--ton">
              <div>
                <Wallet size={16} />
                <span>用户赏金</span>
                <strong>{tonBalance !== "0" ? `${tonBalance} TON` : "待追踪"}</strong>
              </div>
              <i><b style={{ width: `${tonPercent}%` }} /></i>
            </div>
            <div className="game-vital game-vital--runs">
              <div>
                <Gauge size={16} />
                <span>今日行动</span>
                <strong>{Math.max(0, dailyRunLimit - dailyRunCount)}/{dailyRunLimit}</strong>
              </div>
              <i><b style={{ width: `${runPercent}%` }} /></i>
            </div>
          </div>
        </section>

        <SkillCardDeck equippedNames={equippedNames} compact onOpenStore={() => setTab("Train")} />

        {activeRun?.status === "waiting_user" && (
          <section className="game-alert">
            <AlertTriangle size={18} />
            <div>
              <strong>Agent 等你确认</strong>
              <p>它已经算好行动方案，确认后才会继续动用预算。</p>
            </div>
            <button onClick={() => setTab("Explore")}>
              去确认
              <ChevronRight size={16} />
            </button>
          </section>
        )}

        <section className="game-command-panel">
          <button className="game-dispatch-button" onClick={handleDispatch} disabled={isDispatching}>
            <Send size={22} />
            {isDispatching ? "Agent 出勤中" : "派 Agent 赚钱"}
          </button>
          {dispatchNotice && (
            <div className={`game-dispatch-notice${isDispatching ? " is-running" : " is-done"}`} role="status">
              <Sparkles size={14} />
              <span>{dispatchNotice}</span>
            </div>
          )}
          <div className="game-sub-actions">
            <button onClick={handleShareAgent}>
              <Share2 size={16} />
              分享
            </button>
            <button onClick={() => setTab("Train")}>
              <ShoppingBag size={16} />
              技能
            </button>
          </div>
        </section>

        <div className="game-home-feed">
          <section className="game-brief">
            <div>
              <span>今日简报</span>
              <strong>{todayClues} 个机会 · {valueSummary.settlingRewards} 条待追踪 · {valueSummary.filteredRisksCount} 个风险</strong>
            </div>
            <ShieldCheck size={18} />
          </section>

          <section className={`game-report-card${latestRun ? " has-report" : ""}`}>
            <div>
              <span>最近战报</span>
              <strong>{latestRun ? latestRun.taskId : "等待首次外出"}</strong>
            </div>
            <button
              disabled={!latestRun}
              onClick={() => {
                if (openReport && latestRun) openReport(latestRun.id);
              }}
            >
              <Crosshair size={15} />
              查看
            </button>
          </section>
        </div>
      </section>
    </main>
  );
};
