import { AlertTriangle } from "lucide-react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type { InventoryItem, WorkReport, WorkRun, WorkStep } from "@growthbot/shared";
import { apiClient, clearFallbackOccurred, fallbackOccurred, getMockMode, setMockMode } from "./apiClient";
import { telegramAdapter } from "./telegramAdapter";
import { Card, EnvironmentNotice } from "./components/runtime";
import { EnvironmentBadge, deriveRuntimeEnvironment } from "./components/runtime/EnvironmentBadge";
import type { ResearchBriefInput, RuntimeState, Tab, WorkspacePrimaryAction, WorkspaceStats } from "./components/runtime/runtimeTypes";
import { reportUrl, tabs, legacyTabRedirectMap } from "./components/runtime/runtimeUtils";
import { AgentHomeView } from "./components/runtime/views/AgentHomeView";
import { TrainView } from "./components/runtime/views/TrainView";
import { ExploreView } from "./components/runtime/views/ExploreView";
import { NestView } from "./components/runtime/views/NestView";
import { GuildView } from "./components/runtime/views/GuildView";
import { BottomTabBar } from "./components/runtime/BottomTabBar";
import { OfflineRecoveryPanel } from "./components/runtime/OfflineRecoveryPanel";
import { RuntimeSkeleton } from "./components/runtime/RuntimeSkeleton";
import type { LegacyTab, RuntimeTab } from "./components/runtime/petAgentTypes";
import { isBubbleInventoryItem } from "./components/runtime/bubbleAgentIdentity";
import "./styles.css";

const initialState: RuntimeState = {
  user: null,
  agent: null,
  tasks: [],
  inventory: [],
  skills: [],
  skillSlots: null,
  runs: [],
  activeRun: null,
  selectedRun: null,
  selectedSteps: [],
  selectedReport: null,
  reportCache: {},
  realAssetAgent: null,
  assetBalances: [],
  agentWallet: null,
  walletPolicy: null,
  aiCreditBalance: [],
  skillCards: [],
  apiStatus: "Degraded",
  error: null
};

function getInitialRoute(): { tab: RuntimeTab; runId: string | null } {
  if (typeof window === "undefined") return { tab: "Agent", runId: null };
  const params = new URLSearchParams(window.location.search);
  const tabParam = params.get("tab");
  const runId = params.get("runId");

  // Check if legacy tab needs redirection
  if (tabParam && tabParam in legacyTabRedirectMap) {
    return { tab: legacyTabRedirectMap[tabParam as LegacyTab], runId };
  }

  // Valid runtime tab check
  if (tabParam && (tabs as readonly string[]).includes(tabParam)) {
    return { tab: tabParam as RuntimeTab, runId };
  }

  // URL has runId -> redirect to AgentHomeView (where the active/latest report is displayed)
  if (runId) {
    return { tab: "Agent", runId };
  }

  return { tab: "Agent", runId };
}

function getWorkspaceStats(state: RuntimeState): WorkspaceStats {
  const findAsset = (asset: "G" | "TON" | "AI_CREDIT") => state.assetBalances.find((balance) => balance.asset === asset)?.available.amount || "0";
  const aiCredits = state.aiCreditBalance[0]?.balance.amount || findAsset("AI_CREDIT");
  return {
    todayTasks: state.tasks.length,
    activeAgentCount: state.agent ? 1 : 0,
    runningTasks: state.runs.filter((run) => ["discovered", "analyzing", "qualified", "planning", "queued", "executing", "waiting_signature", "submitting", "verifying", "waiting_user", "settling"].includes(run.status)).length,
    waitingConfirmation: state.runs.filter((run) => run.status === "waiting_user").length,
    pendingVerification: state.runs.filter((run) => run.status === "verifying" || run.status === "waiting_signature" || run.status === "submitting").length,
    completedRuns: state.runs.filter((run) => run.status === "completed").length,
    settledRuns: state.runs.filter((run) => run.settled).length,
    pendingPoints: state.agent?.pendingPoints || state.user?.pendingPoints || 0,
    gBalance: findAsset("G"),
    tonBalance: findAsset("TON"),
    aiCreditBalance: aiCredits,
    skillCardPower: state.skillCards.length || state.realAssetAgent?.skillCardSummary.totalCanonicalCards || 31,
    autoPurchaseEnabled: Boolean(state.walletPolicy?.autoPurchaseEnabled),
    energy: state.agent?.energy || 0
  };
}

function getSelectedBubbleItem(inventory: InventoryItem[]) {
  const bubbleItems = inventory.filter(isBubbleInventoryItem);
  if (!bubbleItems.length) return null;
  const selectedId = typeof window !== "undefined" ? localStorage.getItem("gb_selected_bubble_item_id") : null;
  return bubbleItems.find((item) => item.id === selectedId) || bubbleItems[0] || null;
}

function App() {
  const initialRoute = getInitialRoute();
  const [tab, setTab] = useState<RuntimeTab>(initialRoute.tab);
  const [pendingRunId, setPendingRunId] = useState<string | null>(initialRoute.runId);
  const [state, setState] = useState(initialState);
  const [loading, setLoading] = useState(true);
  const latestReportRequestRef = useRef<string | null>(null);
  const environment = deriveRuntimeEnvironment();

  const isDemoMode = getMockMode();

  const setRuntimeTab = useCallback((nextTab: RuntimeTab) => {
    setTab(nextTab);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", nextTab);
      window.history.replaceState(null, "", url.toString());
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handlePopState = () => {
      const route = getInitialRoute();
      setTab(route.tab);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const loadRuntime = useCallback(async () => {
    setLoading(true);
    clearFallbackOccurred();
    try {
      const initData = typeof window !== "undefined" ? window.Telegram?.WebApp?.initData || "" : "";
      const me = initData ? await apiClient.loginOrRegister(initData, telegramAdapter.getStartParam()) : await apiClient.getMe();
      const [tasksRes, invRes] = await Promise.all([apiClient.getTasks(), apiClient.getInventory()]);
      let skills: RuntimeState["skills"] = [];
      let runs: RuntimeState["runs"] = [];
      let activeRun: RuntimeState["activeRun"] = null;
      let skillSlots: RuntimeState["skillSlots"] = null;

      if (me.agent) {
        const [skillRes, runRes, activeRes] = await Promise.all([
          apiClient.getAgentSkills(me.agent.id),
          apiClient.getWorkRuns(me.agent.id),
          apiClient.getActiveWorkRun(me.agent.id)
        ]);
        skills = (skillRes.skills || []).map((skill: any) => skill);
        runs = runRes.workRuns || [];
        activeRun = activeRes.run || null;
        skillSlots = skillRes.slots || null;
      }

      setState((s) => ({
        ...s,
        user: me.user,
        agent: me.agent,
        tasks: tasksRes.tasks,
        inventory: invRes.items,
        skills,
        skillSlots,
        runs,
        activeRun,
        reportCache: s.reportCache,
        realAssetAgent: (me as any).realAssetAgent || null,
        assetBalances: me.assetBalances || [],
        agentWallet: me.agentWallet || null,
        walletPolicy: me.walletPolicy || null,
        aiCreditBalance: me.aiCreditBalance || [],
        skillCards: (me as any).skillCards || [],
        apiStatus: fallbackOccurred ? "Degraded" : "Healthy",
        error: null
      }));
    } catch (err: any) {
      setState((s) => ({ ...s, apiStatus: "Offline", error: err?.message || "Runtime API request failed" }));
    } finally {
      setLoading(false);
    }
  }, []);

  const openReport = useCallback(async (runId: string, syncUrl = true) => {
    latestReportRequestRef.current = runId;
    const cachedReport = state.reportCache[runId];
    if (cachedReport) {
      setState((s) => ({
        ...s,
        selectedRun: s.runs.find((run) => run.id === runId) || s.selectedRun,
        selectedReport: cachedReport,
        selectedSteps: s.selectedRun?.id === runId ? s.selectedSteps : []
      }));
      setRuntimeTab("Agent");
      if (syncUrl && typeof window !== "undefined") window.history.replaceState(null, "", reportUrl(runId));
      return;
    }
    const [runRes, stepsRes, reportRes] = await Promise.all([
      apiClient.getWorkRun(runId),
      apiClient.getWorkRunSteps(runId),
      apiClient.getWorkReport(runId)
    ]);
    if (latestReportRequestRef.current !== runId) return;
    setState((s) => ({
      ...s,
      selectedRun: runRes.run,
      selectedSteps: stepsRes.steps || [],
      selectedReport: reportRes.report,
      reportCache: { ...s.reportCache, [runId]: reportRes.report }
    }));
    setRuntimeTab("Agent");
    if (syncUrl && typeof window !== "undefined") window.history.replaceState(null, "", reportUrl(runId));
  }, [setRuntimeTab, state.reportCache]);

  const refreshInventory = useCallback(async () => {
    const [me, invRes] = await Promise.all([apiClient.getMe(), apiClient.getInventory()]);
    setState((s) => ({
      ...s,
      user: me.user || s.user,
      agent: me.agent || s.agent,
      inventory: invRes.items || [],
      realAssetAgent: (me as any).realAssetAgent || s.realAssetAgent,
      assetBalances: me.assetBalances || s.assetBalances,
      agentWallet: me.agentWallet || s.agentWallet,
      walletPolicy: me.walletPolicy || s.walletPolicy,
      aiCreditBalance: me.aiCreditBalance || s.aiCreditBalance,
      skillCards: (me as any).skillCards || s.skillCards
    }));
  }, []);

  const dispatchAgent = useCallback(async () => {
    if (!state.agent) return;
    const now = new Date().toISOString();
    const runId = `mock_dispatch_${Date.now()}`;
    const run: WorkRun = {
      id: runId,
      agentId: state.agent.id,
      userId: state.user?.id || "user_mock",
      taskId: "agent_dispatch_daily",
      taskKind: "basic",
      executionMode: "simulated",
      rewardEligible: true,
      status: "completed",
      currentStep: 8,
      totalSteps: 8,
      progress: 100,
      estimatedReward: 18,
      estimatedEnergy: 12,
      actualReward: 12,
      actualEnergy: 8,
      riskLevel: "low",
      requiresUserAction: false,
      settled: true,
      researchBriefResult: {
        title: "今日候选机会整理",
        summary: "Agent 已完成一次低风险候选机会整理，结果进入待复核战报。"
      },
      startedAt: now,
      completedAt: now,
      failedReason: null,
      createdAt: now,
      updatedAt: now
    };
    const steps: WorkStep[] = [
      { id: `${runId}_s1`, runId, stepOrder: 1, stepType: "analyze", title: "读取线索", description: "整理今日候选机会。", status: "completed", inputSummary: null, outputSummary: "发现 5 条候选线索。", toolName: null, requiresApproval: false, approvedAt: null, startedAt: now, completedAt: now, errorMessage: null, createdAt: now, updatedAt: now },
      { id: `${runId}_s2`, runId, stepOrder: 2, stepType: "qualify", title: "风险过滤", description: "过滤高风险与不完整线索。", status: "completed", inputSummary: null, outputSummary: "过滤 2 条高风险线索。", toolName: null, requiresApproval: false, approvedAt: null, startedAt: now, completedAt: now, errorMessage: null, createdAt: now, updatedAt: now },
      { id: `${runId}_s3`, runId, stepOrder: 3, stepType: "settle", title: "生成战报", description: "写入本地可验证战报。", status: "completed", inputSummary: null, outputSummary: "战报已生成，等待用户查看。", toolName: null, requiresApproval: false, approvedAt: null, startedAt: now, completedAt: now, errorMessage: null, createdAt: now, updatedAt: now }
    ];
    const selectedBubble = getSelectedBubbleItem(state.inventory);
    const bubbleNo = selectedBubble?.displayNo || selectedBubble?.cardNumber || "GBOT-780552";
    const bubbleSeries = selectedBubble?.series || selectedBubble?.name || "烟灰泥泡泡";
    const report: WorkReport = {
      id: `report_${runId}`,
      runId,
      taskId: run.taskId,
      agentId: state.agent.id,
      reportKind: "work_report",
      overallStatus: "completed",
      input: { topic: "今日候选机会整理", bubbleNo, bubbleSeries },
      execution: { tokenSpent: 8, discovered: 5, filtered: 2, settledG: 12 },
      evidence: [
        { type: "summary", title: "候选机会摘要", status: "verified", createdTime: now },
        { type: "risk_filter", title: "风险过滤记录", status: "verified", createdTime: now }
      ],
      verification: { status: "approved", checkedAt: now, score: 86, notes: "本地预览战报，正式结算以服务端验证为准。" },
      settlement: { status: "settled", settledAt: now, rewardPoints: 12, transactionId: null },
      share: {
        allowed: true,
        text: "我的 GBot 泥泡泡 Agent 完成了一次候选机会整理，战报可查看。",
        blockedReason: null
      },
      createdAt: now,
      updatedAt: now
    };

    setState((s) => {
      const nextAgent = s.agent
        ? {
            ...s.agent,
            energy: Math.max(0, (s.agent.energy || 0) - 8),
            pendingPoints: (s.agent.pendingPoints || 0) + 12,
            dailyRunCount: Math.min(s.agent.dailyRunLimit || 3, (s.agent.dailyRunCount || 0) + 1),
            status: "idle" as const
          }
        : s.agent;
      return {
        ...s,
        agent: nextAgent,
        runs: [run, ...s.runs.filter((item) => item.id !== runId)],
        activeRun: null,
        selectedRun: run,
        selectedSteps: steps,
        selectedReport: report,
        reportCache: { ...s.reportCache, [runId]: report },
        assetBalances: s.assetBalances.map((balance) => balance.asset === "G"
          ? {
              ...balance,
              available: { ...balance.available, amount: String(Number(balance.available.amount || 0) + 12) },
              total: { ...balance.total, amount: String(Number(balance.total.amount || 0) + 12) }
            }
          : balance)
      };
    });
    await apiClient.trackEvent("agent_dispatch_completed", "agent_home", { runId, rewardG: 12, tokenSpent: 8 });
  }, [state.agent, state.inventory, state.user?.id]);

  const createResearchRun = useCallback(async (taskId: string, topic: string, context: string) => {
    await apiClient.createWorkRun(taskId, { input: { type: "research_brief", topic, context } });
    await loadRuntime();
    setRuntimeTab("Explore");
  }, [loadRuntime, setRuntimeTab]);

  const onPrimaryAction = useCallback((kind: WorkspacePrimaryAction["kind"]) => {
    switch (kind) {
      case "claim":
        apiClient.claimAgent().then(loadRuntime).catch((err: unknown) => setState((s) => ({ ...s, error: err instanceof Error ? err.message : "激活 Agent 失败" })));
        return;
      case "energy":
        setRuntimeTab("Nest");
        return;
      case "plan":
        setRuntimeTab("Explore");
        return;
      case "verify":
        setRuntimeTab("Agent");
        return;
      case "tasks":
        setRuntimeTab("Explore");
        return;
      case "report":
        setRuntimeTab("Agent");
        return;
      case "retry":
        setRuntimeTab("Explore");
        return;
    }
  }, [loadRuntime, setRuntimeTab]);

  useEffect(() => {
    telegramAdapter.init();
    telegramAdapter.expand();
    telegramAdapter.setHeaderColor("#030409");
    telegramAdapter.setBackgroundColor("#030409");
    loadRuntime();
  }, [loadRuntime]);

  useEffect(() => {
    if (!loading && pendingRunId) {
      openReport(pendingRunId, false).finally(() => setPendingRunId(null));
    }
  }, [loading, openReport, pendingRunId]);

  const workspaceStats = useMemo(() => getWorkspaceStats(state), [state]);

  const handleExitDemo = () => {
    setMockMode(false);
    loadRuntime();
  };

  const hasExistingData = state.user !== null;
  const isCurrentlyOffline = state.apiStatus === "Offline";
  const isClaimMode = !loading && !isCurrentlyOffline && !state.agent;
  const isAgentHomeMode = !loading && !isCurrentlyOffline && tab === "Agent" && Boolean(state.agent);
  const isMiniHudMode = !loading && !isCurrentlyOffline && Boolean(state.agent) && (tab === "Train" || tab === "Explore" || tab === "Nest" || tab === "Guild");

  const diagnosticInfo = {
    apiStatus: state.apiStatus,
    error: state.error,
    environment,
    isDemoMode,
    timestamp: new Date().toISOString()
  };

  return (
    <div className={`mini-app-desktop-stage${isAgentHomeMode ? " is-agent-home-mode" : ""}${isMiniHudMode ? " is-mini-hud-mode" : ""}`}>
      <div className={`mini-app-shell${isClaimMode ? " is-claim-mode" : ""}${isAgentHomeMode ? " is-agent-home-mode" : ""}${isMiniHudMode ? " is-mini-hud-mode" : ""}`}>
        {isDemoMode && (
          <div className="demo-mode-top-banner">
            <span>预览模式 · 非真实资产</span>
            <button
              onClick={handleExitDemo}
              className="demo-mode-exit-btn"
            >
              退出预览
            </button>
          </div>
        )}

        {isCurrentlyOffline && hasExistingData && (
          <div className="degraded-alert-banner">
            <span style={{display:'inline-flex', alignItems:'center', gap:'6px'}}><AlertTriangle size={14} /> 网络连接不稳定，正在显示最近一次可用数据。</span>
          </div>
        )}

        <header className="premium-hud-header">
          <div>
            <span className="eyebrow">GrowthBot Agent Platform</span>
            <h1>我的 Agent</h1>
          </div>
          <div className="status-pill-indicator">
            <span className={`status-dot ${state.apiStatus.toLowerCase()}`} />
            <span style={{ color: "var(--gb-text-soft)" }}>{state.apiStatus}</span>
          </div>
        </header>

        {isCurrentlyOffline && !hasExistingData ? (
          <OfflineRecoveryPanel
            errorMsg={state.error || "Agent connection temporarily unavailable."}
            onRetry={loadRuntime}
            onEnterDemo={() => {
              setMockMode(true);
              loadRuntime();
            }}
            diagnosticData={diagnosticInfo}
          />
        ) : loading ? (
          <RuntimeSkeleton />
        ) : (
          <div className={`runtime-content${tab === "Agent" && state.agent ? " is-agent-home" : ""}${isMiniHudMode ? " is-mini-hud-mode" : ""}`}>
            {tab === "Agent" && (
              <AgentHomeView
                state={state}
                setTab={setRuntimeTab}
                onPrimaryAction={onPrimaryAction}
                onDispatchAgent={dispatchAgent}
                openReport={openReport}
              />
            )}
            {tab === "Train" && (
              <TrainView
                state={state}
                setTab={setRuntimeTab}
                onInventoryChanged={refreshInventory}
              />
            )}
            {tab === "Explore" && (
              <ExploreView
                state={state}
                createResearchRun={createResearchRun}
              />
            )}
            {tab === "Nest" && (
              <NestView
                state={state}
                setTab={setRuntimeTab}
              />
            )}
            {tab === "Guild" && (
              <GuildView
                state={state}
              />
            )}
          </div>
        )}

        {state.agent && (
          <BottomTabBar
            currentTab={tab}
            onTabChange={setRuntimeTab}
            agentName={state.agent.name || "Agent"}
            agentLevel={state.agent.level || 1}
            gBalance={workspaceStats.gBalance}
          />
        )}
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
