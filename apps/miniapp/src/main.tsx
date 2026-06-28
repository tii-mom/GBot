import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
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

function App() {
  const initialRoute = getInitialRoute();
  const [tab, setTab] = useState<RuntimeTab>(initialRoute.tab);
  const [pendingRunId, setPendingRunId] = useState<string | null>(initialRoute.runId);
  const [state, setState] = useState(initialState);
  const [loading, setLoading] = useState(true);
  const latestReportRequestRef = useRef<string | null>(null);
  const environment = deriveRuntimeEnvironment();

  const isDemoMode = getMockMode();

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
    setTab("Agent");
    if (syncUrl && typeof window !== "undefined") window.history.replaceState(null, "", reportUrl(runId));
  }, []);

  const createResearchRun = useCallback(async (taskId: string, topic: string, context: string) => {
    await apiClient.createWorkRun(taskId, { input: { type: "research_brief", topic, context } });
    await loadRuntime();
    setTab("Explore");
  }, [loadRuntime]);

  const onPrimaryAction = useCallback((kind: WorkspacePrimaryAction["kind"]) => {
    switch (kind) {
      case "claim":
        apiClient.claimAgent().then(loadRuntime).catch((err: unknown) => setState((s) => ({ ...s, error: err instanceof Error ? err.message : "激活 Agent 失败" })));
        return;
      case "energy":
        setTab("Nest");
        return;
      case "plan":
      case "verify":
        setTab("Agent");
        return;
      case "tasks":
        setTab("Explore");
        return;
      case "report":
        setTab("Agent");
        return;
      case "retry":
        setTab("Explore");
        return;
    }
  }, [loadRuntime]);

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

  const diagnosticInfo = {
    apiStatus: state.apiStatus,
    error: state.error,
    environment,
    isDemoMode,
    timestamp: new Date().toISOString()
  };

  return (
    <div className="mini-app-desktop-stage">
      <div className="mini-app-shell">
        {isDemoMode && (
          <div className="demo-mode-top-banner">
            <span>Demo Mode · Not real assets</span>
            <button
              onClick={handleExitDemo}
              className="demo-mode-exit-btn"
            >
              Exit Demo
            </button>
          </div>
        )}

        {isCurrentlyOffline && hasExistingData && (
          <div className="degraded-alert-banner">
            ⚠️ Network Offline. Viewing cached snapshot...
          </div>
        )}

        <header className="premium-hud-header">
          <div>
            <span className="eyebrow">Zodiac Familiar Ecosystem</span>
            <h1>My Agent</h1>
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
          <div style={{ flex: 1, overflowY: "auto" }}>
            {tab === "Agent" && (
              <AgentHomeView
                state={state}
                setTab={setTab}
                onPrimaryAction={onPrimaryAction}
                openReport={openReport}
              />
            )}
            {tab === "Train" && (
              <TrainView
                state={state}
                setTab={setTab}
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
                setTab={setTab}
              />
            )}
            {tab === "Guild" && (
              <GuildView
                state={state}
              />
            )}
          </div>
        )}

        <BottomTabBar currentTab={tab} onTabChange={setTab} />
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
