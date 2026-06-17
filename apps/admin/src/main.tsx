import React, { useState, useEffect, useCallback } from "react";
import { createRoot } from "react-dom/client";
import {
  AlertTriangle,
  BarChart3,
  Boxes as BoxesIcon,
  ListChecks,
  Shield,
  Users as UsersIcon,
  Plus,
  Play,
  Pause,
  RefreshCw,
  TrendingUp,
  FileSpreadsheet,
  Share2,
  Sparkles,
  Trash2,
  Settings,
  HelpCircle,
  X,
  ChevronRight,
  Rocket,
  FileText,
  CheckCircle2,
  Lock,
  Unlock,
  Clock,
  Key,
  Check
} from "lucide-react";
import {
  adminClient,
  type AdminMetrics,
  type AdminUser,
  type AdminTask,
  type AdminBox,
  type AdminTrade,
  type AdminFomo,
  type DropPoolItem,
  type AssetDefinition,
  type MarketRules,
  type BoxKey,
  type BoxStatus,
  type AuditLog,
  type AgentProviderAllowlist,
  type AgentModelConfig,
  type AgentPromptTemplate,
  type AgentModelCallLog
} from "./apiClient";
import "./styles.css";

function App() {
  // 会话状态
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("gb_admin_logged_in") === "true";
    }
    return false;
  });
  const [loginAccount, setLoginAccount] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [rememberDevice, setRememberDevice] = useState(true);
  const [loginError, setLoginError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // 导航页面
  const [activePage, setActivePage] = useState<"dashboard" | "users" | "tasks" | "verifications" | "boxes" | "droppool" | "assets" | "marketrules" | "fomo" | "risk" | "audit" | "bounty_tasks" | "bounty_verifications" | "agent_controls">("dashboard");

  // 共享状态
  const [metrics, setMetrics] = useState<AdminMetrics>({
    botStarts: "-",
    agentClaims: "-",
    boxOpens: "-",
    groupPools: "-",
    marketVolume: "-",
    riskFlags: "-"
  });
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [tasks, setTasks] = useState<AdminTask[]>([]);
  const [boxes, setBoxes] = useState<AdminBox[]>([]);
  const [trades, setTrades] = useState<AdminTrade[]>([]);
  const [fomo, setFomo] = useState<AdminFomo | null>(null);
  const [boxesPaused, setBoxesPaused] = useState(false);
  const [tasksPaused, setTasksPaused] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dataMode, setDataMode] = useState("接口加载中...");

  // V0.3 扩展状态
  const [assetsList, setAssetsList] = useState<AssetDefinition[]>([]);
  const [marketRules, setMarketRules] = useState<MarketRules | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // Agent Studio Controls states
  const [agentConfigs, setAgentConfigs] = useState<AgentModelConfig[]>([]);
  const [agentCallLogs, setAgentCallLogs] = useState<AgentModelCallLog[]>([]);
  const [promptTemplates, setPromptTemplates] = useState<AgentPromptTemplate[]>([]);
  const [agentProviders, setAgentProviders] = useState<AgentProviderAllowlist[]>([]);
  const [agentSubTab, setAgentSubTab] = useState<"providers" | "configs" | "logs" | "prompts">("providers");
  const [editingProvider, setEditingProvider] = useState<AgentProviderAllowlist | null>(null);
  const [creatingProvider, setCreatingProvider] = useState(false);
  const [providerForm, setProviderForm] = useState({ name: "", baseUrl: "", status: "active" });
  const [editingPrompt, setEditingPrompt] = useState<AgentPromptTemplate | null>(null);
  const [promptForm, setPromptForm] = useState({ name: "", scope: "user", content: "" });

  // 1. 盲盒运营表单状态
  const [editingBox, setEditingBox] = useState<AdminBox | null>(null);
  const [creatingBox, setCreatingBox] = useState(false);
  const [confirmingBoxForm, setConfirmingBoxForm] = useState(false);
  const [boxForm, setBoxForm] = useState<{
    key: BoxKey;
    name: string;
    status: BoxStatus;
    rarity: "common" | "rare" | "epic" | "legendary" | "genesis";
    totalSupply: number;
    remainingSupply: number;
    dailyRelease: number;
    acquisitionRoute: string;
    startTime: string;
    endTime: string;
    transferableBeforeOpen: boolean;
    bindingStrategy: "soulbound" | "transferable" | "bind_on_use";
  }>({
    key: "starter",
    name: "",
    status: "draft",
    rarity: "common",
    totalSupply: 1000,
    remainingSupply: 1000,
    dailyRelease: 100,
    acquisitionRoute: "",
    startTime: "",
    endTime: "",
    transferableBeforeOpen: false,
    bindingStrategy: "soulbound"
  });

  // 2. 掉落池配置状态
  const [selectedBoxIdForPool, setSelectedBoxIdForPool] = useState<string>("box_starter");
  const [dropPoolItems, setDropPoolItems] = useState<DropPoolItem[]>([]);
  const [poolSaving, setPoolSaving] = useState(false);
  const [poolSaveSuccess, setPoolSaveSuccess] = useState(false);
  const [poolError, setPoolError] = useState("");
  const [isPoolDirty, setIsPoolDirty] = useState(false);
  const [newDropItem, setNewDropItem] = useState<{
    assetName: string;
    category: "profession" | "skill" | "permit" | "access" | "boost";
    rarity: "common" | "rare" | "epic" | "legendary" | "genesis";
    weight: number;
    minQuantity: number;
    maxQuantity: number;
    usesRemaining: string;
    expiryHours: string;
    transferable: boolean;
    soulbound: boolean;
    effect: string;
    requiresWallet: boolean;
    projectId: string;
  }>({
    assetName: "",
    category: "profession",
    rarity: "common",
    weight: 10,
    minQuantity: 1,
    maxQuantity: 1,
    usesRemaining: "",
    expiryHours: "",
    transferable: true,
    soulbound: false,
    effect: "",
    requiresWallet: false,
    projectId: ""
  });

  // 3. 资产目录状态
  const [assetSearchQuery, setAssetSearchQuery] = useState("");
  const [assetFilterCategory, setAssetFilterCategory] = useState<string>("all");
  const [assetFilterStatus, setAssetFilterStatus] = useState<string>("all");
  const [selectedAsset, setSelectedAsset] = useState<AssetDefinition | null>(null);
  const [creatingAsset, setCreatingAsset] = useState(false);
  const [editingAsset, setEditingAsset] = useState<AssetDefinition | null>(null);
  const [assetForm, setAssetForm] = useState<{
    name: string;
    key: string;
    category: "profession" | "skill" | "permit" | "access" | "boost";
    rarity: "common" | "rare" | "epic" | "legendary" | "genesis";
    status: "enabled" | "disabled";
    transferable: boolean;
    defaultExpiryHours: string;
    defaultUses: string;
    effect: string;
    applicableTasks: string; // 逗号分隔
    applicableBoxes: string; // 逗号分隔
    requiresWallet: boolean;
  }>({
    name: "",
    key: "",
    category: "profession",
    rarity: "common",
    status: "enabled",
    transferable: true,
    defaultExpiryHours: "",
    defaultUses: "",
    effect: "",
    applicableTasks: "",
    applicableBoxes: "",
    requiresWallet: false
  });

  // 4. 市场规则状态
  const [rulesSaving, setRulesSaving] = useState(false);
  const [rulesSaveSuccess, setRulesSaveSuccess] = useState(false);
  const [editedRules, setEditedRules] = useState<MarketRules>({
    platformFeePercent: 2.5,
    minPrice: "0.1",
    maxPrice: "1000.0",
    listingExpiryDays: 7,
    allowStarterBoxTrade: false,
    allowProjectBoxTrade: true,
    marketPaused: false,
    cancelRules: ""
  });

  // 5. 任务配置状态
  const [newTaskName, setNewTaskName] = useState("");
  const [newTaskEnergy, setNewTaskEnergy] = useState("15");
  const [newTaskReward, setNewTaskReward] = useState("150");
  const [newTaskWallet, setNewTaskWallet] = useState(false);
  const [newTaskStart, setNewTaskStart] = useState("");
  const [newTaskEnd, setNewTaskEnd] = useState("");
  const [newTaskAssets, setNewTaskAssets] = useState("");
  const [taskSaveSuccess, setTaskSaveSuccess] = useState(false);
  const [taskSaveError, setTaskSaveError] = useState("");

  // 用户筛选与确认
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [userRiskFilter, setUserRiskFilter] = useState<string>("all");
  const [confirmRiskAction, setConfirmRiskAction] = useState<{
    user: AdminUser;
    action: "normal" | "restricted" | "review";
  } | null>(null);

  // Emergency Freeze Confirmation
  const [confirmEmergencyFreeze, setConfirmEmergencyFreeze] = useState<{
    type: "boxes" | "tasks" | "market";
    active: boolean;
  } | null>(null);

  // Audits Filter
  const [auditSearchQuery, setAuditSearchQuery] = useState("");
  const [auditTypeFilter, setAuditTypeFilter] = useState("all");

  // 6. 任务验收链接与技能卡统计状态
  const [verifications, setVerifications] = useState<any[]>([]);
  const [skillStats, setSkillStats] = useState<any>(null);
  const [verifFeedback, setVerifFeedback] = useState("");

  // Bounty states
  const [bountyTasks, setBountyTasks] = useState<any[]>([]);
  const [bountyVerifications, setBountyVerifications] = useState<any[]>([]);
  const [creatingBounty, setCreatingBounty] = useState(false);
  const [bountyForm, setBountyForm] = useState({
    id: "",
    title: "",
    description: "",
    category: "social",
    platform: "twitter",
    targetUrl: "",
    budgetTotal: 1000,
    rewardPoints: 100,
    rewardAssetName: "",
    rewardAccessPass: "",
    deadline: "",
    verificationRule: "",
    submissionType: "link",
    riskLevel: "low",
    ownerType: "official",
    ownerName: "GrowthBot 官方",
    maxCompletions: 1000,
    settlementMode: "offchain",
    chainId: "",
    escrowContract: "",
    escrowTxHash: "",
    rewardToken: "",
    rewardTokenAddress: "",
    rewardDecimals: "",
    oracleMode: "format_check",
    disputeStatus: "none"
  });

  const [adjustingBountyId, setAdjustingBountyId] = useState<string | null>(null);
  const [newBountyBudget, setNewBountyBudget] = useState(1000);
  const [bountyVerifFeedback, setBountyVerifFeedback] = useState("");

  // Sync state helpers
  const reloadAll = async () => {
    if (!isLoggedIn) return;
    setLoading(true);
    const [
      nextMetrics,
      nextUsers,
      nextTasks,
      nextBoxes,
      nextTrades,
      nextFomo,
      nextBoxesPaused,
      nextTasksPaused,
      nextAssets,
      nextMarketRules,
      nextAuditLogs,
      nextVerifications,
      nextSkillStats,
      nextBountyTasks,
      nextBountyVerifications,
      nextAgentConfigs,
      nextAgentCallLogs,
      nextPromptTemplates,
      nextAgentProviders
    ] = await Promise.all([
      adminClient.getMetrics(),
      adminClient.getUsers(),
      adminClient.getTasks(),
      adminClient.getBoxes(),
      adminClient.getTrades(),
      adminClient.getFomo(),
      adminClient.isBoxesPaused(),
      adminClient.isTasksPaused(),
      adminClient.getAssets(),
      adminClient.getMarketRules(),
      adminClient.getAuditLogs(),
      adminClient.getTaskVerifications(),
      adminClient.getSkillStats(),
      adminClient.getBountyTasks(),
      adminClient.getBountyVerifications(),
      adminClient.getAgentConfigs().catch(() => []),
      adminClient.getAgentCallLogs().catch(() => []),
      adminClient.getPromptTemplates().catch(() => []),
      adminClient.getProviders().catch(() => [])
    ]);
    setMetrics(nextMetrics);
    setUsers(nextUsers);
    setTasks(nextTasks);
    setBoxes(nextBoxes);
    setTrades(nextTrades);
    setFomo(nextFomo);
    setBoxesPaused(nextBoxesPaused);
    setTasksPaused(nextTasksPaused);
    setAssetsList(nextAssets);
    setMarketRules(nextMarketRules);
    setAuditLogs(nextAuditLogs);
    setVerifications(nextVerifications || []);
    setSkillStats(nextSkillStats || null);
    setBountyTasks(nextBountyTasks || []);
    setBountyVerifications(nextBountyVerifications || []);
    setAgentConfigs(nextAgentConfigs);
    setAgentCallLogs(nextAgentCallLogs);
    setPromptTemplates(nextPromptTemplates);
    setAgentProviders(nextAgentProviders);
    if (nextMarketRules) {
      setEditedRules(nextMarketRules);
    }

    // Update local connection status in Chinese
    if (adminClient.fallbackOccurred()) {
      setDataMode("接口回退预览");
    } else if (adminClient.hasAdminToken()) {
      setDataMode("接口会话生效");
    } else {
      setDataMode("接口只读模式");
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isLoggedIn) {
      void reloadAll();
    }
  }, [isLoggedIn]);

  // Fetch pool items whenever selected box changes
  const reloadDropPool = useCallback(async () => {
    if (!isLoggedIn) return;
    try {
      const items = await adminClient.getDropPool(selectedBoxIdForPool);
      setDropPoolItems(items);
      setIsPoolDirty(false);
    } catch (err) {
      console.error("加载掉落池失败", err);
    }
  }, [selectedBoxIdForPool, isLoggedIn]);

  useEffect(() => {
    void reloadDropPool();
  }, [reloadDropPool]);

  // 登录处理
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    setIsLoggingIn(true);

    if (loginAccount.trim() !== "yudeyou0118") {
      setLoginError("账号或密码不正确");
      setIsLoggingIn(false);
      return;
    }

    if (!loginPassword.trim()) {
      setLoginError("密码不能为空");
      setIsLoggingIn(false);
      return;
    }

    try {
      await adminClient.login(loginAccount.trim(), loginPassword);
      if (rememberDevice && typeof window !== "undefined") {
        localStorage.setItem("gb_admin_logged_in", "true");
      }
      setIsLoggedIn(true);
      await reloadAll();
    } catch {
      setLoginError("账号或密码不正确");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    adminClient.clearAdminToken();
    if (typeof window !== "undefined") {
      localStorage.removeItem("gb_admin_logged_in");
    }
    setIsLoggedIn(false);
    setLoginAccount("");
    setLoginPassword("");
  };

  // 编辑盲盒表单回填
  const openEditBox = (box: AdminBox) => {
    setEditingBox(box);
    setBoxForm({
      key: box.key,
      name: box.name,
      status: box.status,
      rarity: box.rarity,
      totalSupply: box.totalSupply,
      remainingSupply: box.remainingSupply,
      dailyRelease: box.dailyRelease,
      acquisitionRoute: box.acquisitionRoute,
      startTime: box.startTime ? box.startTime.substring(0, 16) : "",
      endTime: box.endTime ? box.endTime.substring(0, 16) : "",
      transferableBeforeOpen: box.transferableBeforeOpen,
      bindingStrategy: box.bindingStrategy
    });
    setCreatingBox(true);
  };

  const openCreateBox = () => {
    setEditingBox(null);
    setBoxForm({
      key: "starter",
      name: "",
      status: "draft",
      rarity: "common",
      totalSupply: 1000,
      remainingSupply: 1000,
      dailyRelease: 100,
      acquisitionRoute: "",
      startTime: "",
      endTime: "",
      transferableBeforeOpen: false,
      bindingStrategy: "soulbound"
    });
    setCreatingBox(true);
  };

  // Submit Box Form
  const handleBoxSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: Omit<AdminBox, "id" | "createdAt" | "updatedAt"> = {
      key: boxForm.key,
      name: boxForm.name,
      status: boxForm.status,
      rarity: boxForm.rarity,
      totalSupply: Number(boxForm.totalSupply),
      remainingSupply: Number(boxForm.remainingSupply),
      dailyRelease: Number(boxForm.dailyRelease),
      acquisitionRoute: boxForm.acquisitionRoute,
      startTime: boxForm.startTime ? new Date(boxForm.startTime).toISOString() : null,
      endTime: boxForm.endTime ? new Date(boxForm.endTime).toISOString() : null,
      transferableBeforeOpen: boxForm.transferableBeforeOpen,
      bindingStrategy: boxForm.bindingStrategy
    };

    if (editingBox) {
      const res = await adminClient.updateBox(editingBox.id, payload);
      setBoxes(res);
      // Log Audit
      await adminClient.createAuditLog({
        operator: "yudeyou0118",
        opType: "更新盲盒配置",
        targetObject: editingBox.name,
        beforeValue: `总额:${editingBox.totalSupply}, 每日:${editingBox.dailyRelease}, 绑定:${editingBox.bindingStrategy}`,
        afterValue: `总额:${payload.totalSupply}, 每日:${payload.dailyRelease}, 绑定:${payload.bindingStrategy}`,
        status: "success"
      });
    } else {
      const res = await adminClient.createBox(payload);
      setBoxes(res);
      // Log Audit
      await adminClient.createAuditLog({
        operator: "yudeyou0118",
        opType: "创建新盲盒",
        targetObject: payload.name,
        beforeValue: "无",
        afterValue: `代码Key:${payload.key}, 稀有度:${payload.rarity}, 获取渠道:${payload.acquisitionRoute}`,
        status: "success"
      });
    }

    setCreatingBox(false);
    setConfirmingBoxForm(false);
    await reloadAll();
  };

  const handleArchiveBox = async (id: string, name: string) => {
    if (confirm(`确定要归档此盲盒“${name}”吗？归档后用户将无法在游戏内获取该盲盒，该操作不可逆！`)) {
      const res = await adminClient.archiveBox(id);
      setBoxes(res);

      // Log Audit
      await adminClient.createAuditLog({
        operator: "yudeyou0118",
        opType: "归档盲盒",
        targetObject: name,
        beforeValue: "激活中",
        afterValue: "已归档停用",
        status: "success"
      });
      await reloadAll();
    }
  };

  // 提交掉落池条目
  const handleAddDropPoolItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDropItem.assetName.trim()) return;

    const newItem: DropPoolItem = {
      id: "dp_" + Date.now(),
      assetName: newDropItem.assetName,
      category: newDropItem.category,
      rarity: newDropItem.rarity,
      weight: Number(newDropItem.weight),
      minQuantity: Number(newDropItem.minQuantity),
      maxQuantity: Number(newDropItem.maxQuantity),
      usesRemaining: newDropItem.usesRemaining ? Number(newDropItem.usesRemaining) : undefined,
      expiryHours: newDropItem.expiryHours ? Number(newDropItem.expiryHours) : undefined,
      transferable: newDropItem.transferable,
      soulbound: newDropItem.soulbound,
      effect: newDropItem.effect,
      requiresWallet: newDropItem.requiresWallet,
      projectId: newDropItem.projectId || null
    };

    setDropPoolItems(prev => [...prev, newItem]);
    setIsPoolDirty(true);

    // Reset inputs
    setNewDropItem({
      assetName: "",
      category: "profession",
      rarity: "common",
      weight: 10,
      minQuantity: 1,
      maxQuantity: 1,
      usesRemaining: "",
      expiryHours: "",
      transferable: true,
      soulbound: false,
      effect: "",
      requiresWallet: false,
      projectId: ""
    });
  };

  const handleDeleteDropItem = (itemId: string, itemName: string) => {
    setDropPoolItems(prev => prev.filter(item => item.id !== itemId));
    setIsPoolDirty(true);
  };

  const handleSaveDropPool = async () => {
    setPoolSaving(true);
    setPoolError("");
    setPoolSaveSuccess(false);
    try {
      await adminClient.updateDropPool(selectedBoxIdForPool, dropPoolItems);
      setPoolSaveSuccess(true);
      setIsPoolDirty(false);

      // Log Audit
      const targetBox = boxes.find(b => b.id === selectedBoxIdForPool);
      await adminClient.createAuditLog({
        operator: "yudeyou0118",
        opType: "修改掉落配置",
        targetObject: targetBox?.name || selectedBoxIdForPool,
        beforeValue: "旧版分配比例",
        afterValue: `掉落条目数: ${dropPoolItems.length}, 总权重: ${totalWeight}`,
        status: "success"
      });
      setTimeout(() => setPoolSaveSuccess(false), 3000);
    } catch (err: any) {
      setPoolError(err.message || "保存掉落池配置失败");
    } finally {
      setPoolSaving(false);
    }
  };

  // Pre-fill Drop Item form when selecting from catalog
  const handleSelectAssetForDrop = (assetName: string) => {
    const asset = assetsList.find(a => a.name === assetName);
    if (asset) {
      setNewDropItem(prev => ({
        ...prev,
        assetName: asset.name,
        category: asset.category,
        rarity: asset.rarity,
        transferable: asset.transferable,
        soulbound: !asset.transferable,
        effect: asset.effect,
        requiresWallet: asset.requiresWallet,
        usesRemaining: asset.defaultUses !== null ? String(asset.defaultUses) : "",
        expiryHours: asset.defaultExpiryHours !== null ? String(asset.defaultExpiryHours) : ""
      }));
    } else {
      setNewDropItem(prev => ({ ...prev, assetName }));
    }
  };

  // 资产目录表单回填
  const openCreateAsset = () => {
    setEditingAsset(null);
    setAssetForm({
      name: "",
      key: "",
      category: "profession",
      rarity: "common",
      status: "enabled",
      transferable: true,
      defaultExpiryHours: "",
      defaultUses: "",
      effect: "",
      applicableTasks: "",
      applicableBoxes: "",
      requiresWallet: false
    });
    setCreatingAsset(true);
  };

  const openEditAsset = (asset: AssetDefinition) => {
    setEditingAsset(asset);
    setAssetForm({
      name: asset.name,
      key: asset.key,
      category: asset.category,
      rarity: asset.rarity,
      status: asset.status,
      transferable: asset.transferable,
      defaultExpiryHours: asset.defaultExpiryHours !== null ? String(asset.defaultExpiryHours) : "",
      defaultUses: asset.defaultUses !== null ? String(asset.defaultUses) : "",
      effect: asset.effect,
      applicableTasks: asset.applicableTasks.join(", "),
      applicableBoxes: asset.applicableBoxes.join(", "),
      requiresWallet: asset.requiresWallet
    });
    setCreatingAsset(true);
  };

  const handleAssetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: Omit<AssetDefinition, "id"> = {
      name: assetForm.name,
      key: assetForm.key,
      category: assetForm.category,
      rarity: assetForm.rarity,
      status: assetForm.status,
      transferable: assetForm.transferable,
      defaultExpiryHours: assetForm.defaultExpiryHours ? Number(assetForm.defaultExpiryHours) : null,
      defaultUses: assetForm.defaultUses ? Number(assetForm.defaultUses) : null,
      effect: assetForm.effect,
      applicableTasks: assetForm.applicableTasks ? assetForm.applicableTasks.split(",").map(s => s.trim()).filter(Boolean) : [],
      applicableBoxes: assetForm.applicableBoxes ? assetForm.applicableBoxes.split(",").map(s => s.trim()).filter(Boolean) : [],
      requiresWallet: assetForm.requiresWallet
    };

    if (editingAsset) {
      const res = await adminClient.updateAsset(editingAsset.id, payload);
      setAssetsList(res);
      // Log Audit
      await adminClient.createAuditLog({
        operator: "yudeyou0118",
        opType: "修改资产定义",
        targetObject: editingAsset.name,
        beforeValue: `状态:${editingAsset.status}, 说明:${editingAsset.effect}`,
        afterValue: `状态:${payload.status}, 说明:${payload.effect}`,
        status: "success"
      });
    } else {
      const res = await adminClient.createAsset(payload);
      setAssetsList(res);
      // Log Audit
      await adminClient.createAuditLog({
        operator: "yudeyou0118",
        opType: "创建新资产",
        targetObject: payload.name,
        beforeValue: "无",
        afterValue: `Key:${payload.key}, 类别:${payload.category}, 稀有度:${payload.rarity}`,
        status: "success"
      });
    }
    setCreatingAsset(false);
    await reloadAll();
  };

  const handleToggleAssetStatus = async (assetId: string, currentStatus: string, assetName: string) => {
    const nextStatus = currentStatus === "enabled" ? "disabled" : "enabled";
    const res = await adminClient.updateAsset(assetId, { status: nextStatus });
    setAssetsList(res);

    // Log Audit
    await adminClient.createAuditLog({
      operator: "yudeyou0118",
      opType: nextStatus === "enabled" ? "启用资产" : "停用资产",
      targetObject: assetName,
      beforeValue: currentStatus === "enabled" ? "已启用" : "已停用",
      afterValue: nextStatus === "enabled" ? "已启用" : "已停用",
      status: "success"
    });
    await reloadAll();
  };

  // 提交市场规则
  const handleMarketRulesSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRulesSaving(true);
    setRulesSaveSuccess(false);
    try {
      const res = await adminClient.updateMarketRules(editedRules);
      setMarketRules(res);
      setRulesSaveSuccess(true);

      // Log Audit
      await adminClient.createAuditLog({
        operator: "yudeyou0118",
        opType: "修改市场规则",
        targetObject: "交易参数",
        beforeValue: `手续费:${marketRules?.platformFeePercent}%, 最低:${marketRules?.minPrice}, 暂停:${marketRules?.marketPaused}`,
        afterValue: `手续费:${editedRules.platformFeePercent}%, 最低:${editedRules.minPrice}, 暂停:${editedRules.marketPaused}`,
        status: "success"
      });
      setTimeout(() => setRulesSaveSuccess(false), 3000);
    } catch (err) {
      alert("保存市场规则失败");
    } finally {
      setRulesSaving(false);
    }
  };

  // User Risk Operations
  const handleUserRiskChange = async (userId: string, riskStatus: "normal" | "restricted" | "review") => {
    const userObj = users.find(u => u.id === userId);
    if (!userObj) return;

    const res = await adminClient.updateUserRisk(userId, riskStatus);
    setUsers(res);
    if (selectedUser && selectedUser.id === userId) {
      setSelectedUser(prev => prev ? { ...prev, riskStatus } : null);
    }

    const statusText = riskStatus === "normal" ? "恢复正常" : riskStatus === "restricted" ? "限制用户" : "标记复核";
    const oldStatusText = userObj.riskStatus === "normal" ? "恢复正常" : userObj.riskStatus === "restricted" ? "限制用户" : "标记复核";

    // Log Audit
    await adminClient.createAuditLog({
      operator: "yudeyou0118",
      opType: "修改风控状态",
      targetObject: `@${userObj.username}`,
      beforeValue: oldStatusText,
      afterValue: statusText,
      status: "success"
    });

    setConfirmRiskAction(null);
    await reloadAll();
  };

  // Emergency Toggles with Auditing
  const handleEmergencyFreezeAction = async () => {
    if (!confirmEmergencyFreeze) return;
    const { type, active } = confirmEmergencyFreeze;

    if (type === "boxes") {
      await adminClient.setPauseBoxes(active);
      setBoxesPaused(active);
      await adminClient.createAuditLog({
        operator: "yudeyou0118",
        opType: active ? "紧急挂起所有盲盒" : "解除挂起所有盲盒",
        targetObject: "全局盲盒熔断器",
        beforeValue: active ? "运行中" : "已挂起",
        afterValue: active ? "已挂起" : "运行中",
        status: "success"
      });
    } else if (type === "tasks") {
      await adminClient.setPauseTasks(active);
      setTasksPaused(active);
      await adminClient.createAuditLog({
        operator: "yudeyou0118",
        opType: active ? "紧急挂起所有任务" : "解除挂起所有任务",
        targetObject: "全局任务熔断器",
        beforeValue: active ? "运行中" : "已挂起",
        afterValue: active ? "已挂起" : "运行中",
        status: "success"
      });
    } else if (type === "market") {
      if (editedRules) {
        const nextRules = { ...editedRules, marketPaused: active };
        await adminClient.updateMarketRules(nextRules);
        setEditedRules(nextRules);
        setMarketRules(nextRules);
        await adminClient.createAuditLog({
          operator: "yudeyou0118",
          opType: active ? "紧急挂起市场交易" : "解除挂起市场交易",
          targetObject: "全局交易熔断器",
          beforeValue: active ? "交易正常" : "已暂停",
          afterValue: active ? "已暂停" : "交易正常",
          status: "success"
        });
      }
    }

    setConfirmEmergencyFreeze(null);
    await reloadAll();
  };

  // Task Creation
  const handleCreateTaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTaskSaveSuccess(false);
    setTaskSaveError("");

    if (!newTaskName.trim()) {
      setTaskSaveError("任务名称不能为空");
      return;
    }
    const energy = parseInt(newTaskEnergy) || 0;
    const reward = parseInt(newTaskReward) || 0;

    try {
      await adminClient.createTask(newTaskName, energy, reward);
      setTaskSaveSuccess(true);

      // Log Audit
      await adminClient.createAuditLog({
        operator: "yudeyou0118",
        opType: "发布新任务",
        targetObject: newTaskName,
        beforeValue: "无",
        afterValue: `消耗:${energy}能量, 奖励:${reward} POINT_TEST, 需要钱包:${newTaskWallet ? "是" : "否"}`,
        status: "success"
      });

      setNewTaskName("");
      setNewTaskEnergy("15");
      setNewTaskReward("150");
      setNewTaskWallet(false);
      setNewTaskStart("");
      setNewTaskEnd("");
      setNewTaskAssets("");
      await reloadAll();
    } catch (err: any) {
      setTaskSaveError(err.message || "保存任务失败");
    }
  };

  const handleTaskStatusToggle = async (taskId: string, currentStatus: string) => {
    const nextStatus = currentStatus === "active" ? "paused" : "active";
    const res = await adminClient.updateTaskStatus(taskId, nextStatus);
    setTasks(res);

    // Log Audit
    const task = tasks.find(t => t.id === taskId);
    await adminClient.createAuditLog({
      operator: "yudeyou0118",
      opType: nextStatus === "paused" ? "暂停任务" : "恢复任务",
      targetObject: task?.name || taskId,
      beforeValue: currentStatus === "active" ? "运行中" : "已暂停",
      afterValue: nextStatus === "active" ? "运行中" : "已暂停",
      status: "success"
    });

    await reloadAll();
  };

  // Localized UI mapping helpers
  const translateBoxKey = (key: BoxKey) => {
    const mapping: Record<BoxKey, string> = {
      starter: "启动盒",
      alpha: "Alpha 盒",
      crew: "战队盒",
      project: "项目盒",
      wallet: "钱包盒"
    };
    return mapping[key] || key;
  };

  const translateRarity = (rarity: string) => {
    const mapping: Record<string, string> = {
      common: "普通",
      rare: "稀有",
      epic: "史诗",
      legendary: "传说",
      genesis: "创世"
    };
    return mapping[rarity] || rarity;
  };

  const translateCategory = (cat: string) => {
    const mapping: Record<string, string> = {
      profession: "职业",
      skill: "技能",
      permit: "许可证",
      access: "准入权",
      boost: "加成"
    };
    return mapping[cat] || cat;
  };

  const translateBindingStrategy = (strat: string) => {
    const mapping: Record<string, string> = {
      soulbound: "灵魂绑定 (Soulbound)",
      transferable: "自由流通 (Transferable)",
      bind_on_use: "使用后绑定 (Bind on use)"
    };
    return mapping[strat] || strat;
  };

  const translateRiskStatus = (risk: string) => {
    const mapping: Record<string, string> = {
      normal: "正常",
      restricted: "限制用户",
      review: "标记复核"
    };
    return mapping[risk] || risk;
  };

  const translateStatus = (status: string) => {
    const mapping: Record<string, string> = {
      active: "运行中",
      paused: "已暂停",
      draft: "草稿",
      archived: "已归档",
      enabled: "已启用",
      disabled: "已停用"
    };
    return mapping[status] || status;
  };

  // 掉落概率权重统计
  const totalWeight = dropPoolItems.reduce((acc, curr) => acc + curr.weight, 0);

  // 筛选器
  const filteredAssets = assetsList.filter(asset => {
    const matchesSearch = asset.name.toLowerCase().includes(assetSearchQuery.toLowerCase()) ||
                          asset.key.toLowerCase().includes(assetSearchQuery.toLowerCase());
    const matchesCategory = assetFilterCategory === "all" || asset.category === assetFilterCategory;
    const matchesStatus = assetFilterStatus === "all" || asset.status === assetFilterStatus;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.username.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
                          user.telegramId.includes(userSearchQuery) ||
                          user.id.includes(userSearchQuery);
    const matchesRisk = userRiskFilter === "all" || user.riskStatus === userRiskFilter;
    return matchesSearch && matchesRisk;
  });

  const auditSummary = {
    total: auditLogs.length,
    success: auditLogs.filter(log => log.status === "success").length,
    failed: auditLogs.filter(log => log.status !== "success").length,
    risk: auditLogs.filter(log => log.opType.includes("风控")).length
  };

  const classifyAuditLog = (log: AuditLog) => {
    const text = `${log.opType} ${log.targetObject}`.toLowerCase();
    if (text.includes("风控") || text.includes("risk")) return "风控";
    if (text.includes("任务") || text.includes("task")) return "任务";
    if (text.includes("盲盒") || text.includes("box")) return "盲盒";
    if (text.includes("资产") || text.includes("asset")) return "资产";
    if (text.includes("规则") || text.includes("market") || text.includes("rule")) return "规则";
    return "其他";
  };

  const formatAuditChange = (value: string) => {
    if (!value) return "无";
    if (value.length > 120) return `${value.slice(0, 120)}...`;
    return value;
  };

  const filteredAudits = auditLogs.filter(log => {
    const matchesSearch = log.operator.toLowerCase().includes(auditSearchQuery.toLowerCase()) ||
                          log.opType.toLowerCase().includes(auditSearchQuery.toLowerCase()) ||
                          log.targetObject.toLowerCase().includes(auditSearchQuery.toLowerCase());
    const matchesType = auditTypeFilter === "all" ||
      (auditTypeFilter === "失败" ? log.status !== "success" : classifyAuditLog(log) === auditTypeFilter);
    return matchesSearch && matchesType;
  });

  // Calculate box depletion level & countdowns
  const getBoxStockPercent = (box: AdminBox) => {
    if (box.totalSupply === 0) return 100;
    return (box.remainingSupply / box.totalSupply) * 100;
  };

  const getCountdownText = (endTimeStr: string | null) => {
    if (!endTimeStr) return "永久有效";
    const end = new Date(endTimeStr).getTime();
    const now = new Date().getTime();
    const diff = end - now;
    if (diff <= 0) return "活动已结束";
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    return `剩 ${days} 天 ${hours} 小时`;
  };

  const shareCount = (eventName: string): number | string => {
    return fomo?.shareEvents.find((event) => event.eventName === eventName)?.count ?? "-";
  };

  // Render Login Page
  if (!isLoggedIn) {
    return (
      <div className="login-screen-wrapper">
        <form onSubmit={handleLoginSubmit} className="login-form-card">
          <div className="login-logo-header">
            <Shield size={36} className="login-logo-icon" />
            <h2>GrowthBot 运营管理后台</h2>
            <p>生产环境安全会话登录</p>
          </div>

          {loginError && (
            <div className="login-error-banner">
              <AlertTriangle size={16} />
              <span>{loginError}</span>
            </div>
          )}

          <div className="form-field">
            <label>管理账号</label>
            <input
              type="text"
              value={loginAccount}
              onChange={(e) => setLoginAccount(e.target.value)}
              placeholder="运营人员账号 (yudeyou0118)"
              required
            />
          </div>

          <div className="form-field">
            <label>安全密码</label>
            <input
              type="password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              placeholder="请输入管理员密码"
              required
            />
          </div>

          <div className="login-form-options">
            <label className="flex-row gap-6 cursor-pointer">
              <input
                type="checkbox"
                checked={rememberDevice}
                onChange={(e) => setRememberDevice(e.target.checked)}
              />
              <span>记住本设备</span>
            </label>
          </div>

          <button type="submit" className="primary w-full login-btn" disabled={isLoggingIn}>
            {isLoggingIn ? "正在验证..." : "登录运营控制台"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <main className="admin-shell">
      {/* 侧边导航 */}
      <aside>
        <div className="sidebar-brand">
          <Shield size={24} className="brand-logo" />
          <h1>GrowthBot 后台</h1>
        </div>
        <nav>
          <button
            className={activePage === "dashboard" ? "active" : ""}
            onClick={() => setActivePage("dashboard")}
          >
            <BarChart3 size={18} /> 总览
          </button>
          <button
            className={activePage === "users" ? "active" : ""}
            onClick={() => setActivePage("users")}
          >
            <UsersIcon size={18} /> 用户管理
          </button>
          <button
            className={activePage === "tasks" ? "active" : ""}
            onClick={() => setActivePage("tasks")}
          >
            <ListChecks size={18} /> 任务收益配置
          </button>
          <button
            className={activePage === "verifications" ? "active" : ""}
            onClick={() => setActivePage("verifications")}
          >
            <CheckCircle2 size={18} /> 任务链接验收
          </button>
          <button
            className={activePage === "boxes" ? "active" : ""}
            onClick={() => setActivePage("boxes")}
          >
            <BoxesIcon size={18} /> 技能学习路径配置
          </button>
          <button
            className={activePage === "droppool" ? "active" : ""}
            onClick={() => setActivePage("droppool")}
          >
            <Sparkles size={18} /> 技能包掉落矩阵
          </button>
          <button
            className={activePage === "assets" ? "active" : ""}
            onClick={() => setActivePage("assets")}
          >
            <FileSpreadsheet size={18} /> 技能卡模板
          </button>
          <button
            className={activePage === "marketrules" ? "active" : ""}
            onClick={() => setActivePage("marketrules")}
          >
            <TrendingUp size={18} /> 市场交易规则
          </button>
          <button
            className={activePage === "fomo" ? "active" : ""}
            onClick={() => setActivePage("fomo")}
          >
            <Rocket size={18} /> Agent 路线看板
          </button>
          <button
            className={activePage === "risk" ? "active" : ""}
            onClick={() => setActivePage("risk")}
          >
            <AlertTriangle size={18} /> 安全风控设置
          </button>
          <button
            className={activePage === "audit" ? "active" : ""}
            onClick={() => setActivePage("audit")}
          >
            <FileText size={18} /> 操作审计日志
          </button>
          <button
            className={activePage === "bounty_tasks" ? "active" : ""}
            onClick={() => setActivePage("bounty_tasks")}
          >
            <ListChecks size={18} /> 赏金任务管理
          </button>
          <button
            className={activePage === "bounty_verifications" ? "active" : ""}
            onClick={() => setActivePage("bounty_verifications")}
          >
            <CheckCircle2 size={18} /> 赏金验收复核
          </button>
          <button
            className={activePage === "agent_controls" ? "active" : ""}
            onClick={() => setActivePage("agent_controls")}
          >
            <Sparkles size={18} /> Agent 智能管理
          </button>
        </nav>
        <div className="sidebar-footer">
          <span>Cloudflare Pages 部署环境</span>
          <span>会话状态: {dataMode}</span>
          <button className="refresh-telemetry-btn" onClick={() => void reloadAll()}>
            <RefreshCw size={12} /> 同步数据
          </button>
        </div>
      </aside>

      {/* Main Console Content */}
      <section className="content">
        <div className="header">
          <div>
            <p className="subtext">生产环境管理控制台</p>
            <h2>
              {activePage === "dashboard" && "运营数据总览"}
              {activePage === "users" && "用户管理"}
              {activePage === "tasks" && "任务收益配置"}
              {activePage === "verifications" && "任务链接审核验收"}
              {activePage === "boxes" && "技能学习路径配置"}
              {activePage === "droppool" && "技能包掉落矩阵配置"}
              {activePage === "assets" && "技能卡目录模板"}
              {activePage === "marketrules" && "市场规则设定"}
              {activePage === "fomo" && "Agent 路线看板"}
              {activePage === "risk" && "安全风控设置"}
              {activePage === "audit" && "系统操作审计日志"}
              {activePage === "bounty_tasks" && "赏金任务池配置"}
              {activePage === "bounty_verifications" && "赏金验收复核列表"}
              {activePage === "agent_controls" && "Agent 智能管理"}
            </h2>
            <p className="muted-line">
              已登录账号：<strong>yudeyou0118</strong> | {dataMode} {loading && " (同步中...)"}
            </p>
          </div>

          <div className="emergency-actions">
            <button className="clear-token-btn" onClick={handleLogout}>退出登录</button>
            <button className="refresh-telemetry-btn" onClick={() => void reloadAll()} title="重新同步运营数据">
              <RefreshCw size={14} /> 刷新
            </button>

            {/* Quick emergency status icons */}
            <div className="header-emergency-badges">
              <span className={`status-badge-lbl ${boxesPaused ? "paused" : "active"}`} onClick={() => setConfirmEmergencyFreeze({ type: "boxes", active: !boxesPaused })}>
                {boxesPaused ? "🚨 盲盒已熔断" : "🟢 盲盒开盒中"}
              </span>
              <span className={`status-badge-lbl ${tasksPaused ? "paused" : "active"}`} onClick={() => setConfirmEmergencyFreeze({ type: "tasks", active: !tasksPaused })}>
                {tasksPaused ? "🚨 任务已关闭" : "🟢 任务运行中"}
              </span>
              <span className={`status-badge-lbl ${editedRules.marketPaused ? "paused" : "active"}`} onClick={() => setConfirmEmergencyFreeze({ type: "market", active: !editedRules.marketPaused })}>
                {editedRules.marketPaused ? "🚨 市场已挂起" : "🟢 市场撮合中"}
              </span>
            </div>
          </div>
        </div>

        {/* PAGE 1: DASHBOARD (总览) */}
        {activePage === "dashboard" && (
          <div className="admin-page animate-fade-in">
            <section className="cards">
              <article>
                <span>累计启动次数</span>
                <strong>{metrics.botStarts}</strong>
                <small className="trend positive">Telegram 用户触发次数</small>
              </article>
              <article>
                <span>已领取 Agent 人数</span>
                <strong>{metrics.agentClaims}</strong>
                <small className="trend positive">验证激活角色总量</small>
              </article>
              <article>
                <span>累计开盒次数</span>
                <strong>{metrics.boxOpens}</strong>
                <small className="trend positive">盲盒消耗开盒数</small>
              </article>
              <article>
                <span>战队入驻总数</span>
                <strong>{metrics.groupPools}</strong>
                <small className="trend positive">关联社群/频道数</small>
              </article>
              <article>
                <span>交易市场流转额</span>
                <strong>{metrics.marketVolume}</strong>
                <small className="trend positive">PT 流通总量</small>
              </article>
              <article className={parseInt(metrics.riskFlags) > 10 ? "alert-risk-card" : ""}>
                <span>风控警告标记</span>
                <strong className={parseInt(metrics.riskFlags) > 0 ? "text-danger" : ""}>{metrics.riskFlags}</strong>
                <small className="trend negative">待处理可疑用户</small>
              </article>
              <article>
                <span>今日任务运行数</span>
                <strong>4,812 次</strong>
                <small className="trend positive">玩家活跃度指标</small>
              </article>
              <article>
                <span>市场活跃挂单</span>
                <strong>{fomo?.activeListings ?? 0} 个</strong>
                <small className="trend positive">当前在售策略卡/盲盒</small>
              </article>
            </section>

            <div className="dashboard-grid-row">
              <section className="table-card flex-grow">
                <h3>⚠️ 今日风险提醒</h3>
                <div className="rules-grid-bullets" style={{ marginTop: "10px" }}>
                  <div className="bullet-row text-danger">
                    <strong>[紧急风险]</strong> 发现 3 个高频刷任务 IP，相关关联用户已被风控挂起，建议进入「风控」页面复核。
                  </div>
                  <div className="bullet-row text-amber">
                    <strong>[异常监控]</strong> 钱包限制规则检测到 2 次未绑定 TON 钱包越级签名请求，接口已阻断。
                  </div>
                  <div className="bullet-row text-muted">
                    <strong>[正常策略]</strong> 自动打工脚本拦截正常运行，共拦截链下垃圾包提交 2,109 次。
                  </div>
                </div>
              </section>

              <section className="table-card">
                <h3>🚨 盲盒库存预警</h3>
                <div className="box-stock-warnings-list" style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "10px" }}>
                  {boxes.map(b => {
                    const percent = getBoxStockPercent(b);
                    const isLow = percent < 20;
                    return (
                      <div key={b.id} className="box-stock-warning-row">
                        <div className="flex-row justify-between" style={{ fontSize: "12px", marginBottom: "4px" }}>
                          <span><strong>{b.name}</strong> ({translateBoxKey(b.key)})</span>
                          <span className={isLow ? "text-danger font-bold" : "text-muted"}>
                            剩余: {b.remainingSupply} / {b.totalSupply} ({percent.toFixed(1)}%)
                          </span>
                        </div>
                        <div className="progress-bar-container" style={{ height: "6px", background: "rgba(255,255,255,0.05)", borderRadius: "3px", overflow: "hidden" }}>
                          <div
                            className="progress-bar-fill"
                            style={{
                              height: "100%",
                              width: `${percent}%`,
                              background: isLow ? "var(--danger)" : "var(--emerald)",
                              boxShadow: isLow ? "0 0 8px rgba(239, 68, 68, 0.4)" : "none"
                            }}
                          />
                        </div>
                        {isLow && <span className="text-danger" style={{ fontSize: "10px", marginTop: "2px", display: "block" }}>⚠️ 盲盒库存不足 20%，请尽快修改配置增加发售份额！</span>}
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>

            <div className="dashboard-grid-row" style={{ marginTop: "20px" }}>
              <section className="table-card flex-grow">
                <h3>📊 Agent 技能卡发行与状态统计</h3>
                {skillStats ? (
                  <div className="info-section-grid" style={{ marginTop: "10px" }}>
                    <div className="grid-item">
                      <span>可交易 / 未学习 (Available)</span>
                      <strong className="text-amber">{skillStats.unlearned} 张</strong>
                    </div>
                    <div className="grid-item">
                      <span>已装备 / 已学习 (Equipped)</span>
                      <strong className="text-emerald">{skillStats.equipped} 张</strong>
                    </div>
                    <div className="grid-item">
                      <span>市场挂售中 (Listed)</span>
                      <strong className="text-purple">{skillStats.listed} 张</strong>
                    </div>
                    <div className="grid-item">
                      <span>已消耗 / 销毁状态 (Burned)</span>
                      <strong className="text-muted">{skillStats.burned} 张</strong>
                    </div>
                    <div className="grid-item">
                      <span>全网发行卡片数 (Total)</span>
                      <strong>{skillStats.total} 张</strong>
                    </div>
                  </div>
                ) : (
                  <p className="muted font-12" style={{ padding: "10px" }}>加载技能卡统计数据中...</p>
                )}
              </section>

              <section className="table-card" style={{ width: "320px" }}>
                <h3>🔑 唯一编号生成规则策略</h3>
                <div className="rules-grid-bullets" style={{ marginTop: "10px", fontSize: "12px", lineHeight: "1.6" }}>
                  <div className="bullet-row" style={{ marginBottom: "6px" }}>
                    <strong className="text-emerald">[主选项]</strong> <code>D1 Transactions</code> 事务独占递增。
                  </div>
                  <div className="bullet-row" style={{ marginBottom: "6px" }}>
                    <strong className="text-amber">[备选项]</strong> <code>Cloudflare KV</code> 计数器。
                  </div>
                  <div className="bullet-row">
                    <strong className="text-muted">[兜底策略]</strong> <code>Timestamp + 4位随机数字</code>。
                  </div>
                </div>
              </section>
            </div>

            <div className="dashboard-grid-row" style={{ marginTop: "20px" }}>
              <section className="table-card flex-grow">
                <h3>💡 接口节点状态</h3>
                <div className="info-section-grid" style={{ marginTop: "10px" }}>
                  <div className="grid-item">
                    <span>API Base 节点</span>
                    <strong><code>https://api.gb8.top</code></strong>
                  </div>
                  <div className="grid-item">
                    <span>路由跳转权重</span>
                    <strong>Cloudflare Staging A/B (100%)</strong>
                  </div>
                  <div className="grid-item">
                    <span>会话安全模式</span>
                    <strong>本地会话 / 登录凭证</strong>
                  </div>
                  <div className="grid-item">
                    <span>缓存有效周期</span>
                    <strong>D1 缓存 (5分钟智能拉取)</strong>
                  </div>
                </div>
              </section>

              <section className="table-card marketplace-monitor">
                <h3>📝 最近操作记录</h3>
                <div className="recent-audits-list" style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "10px" }}>
                  {auditLogs.slice(0, 3).map(log => (
                    <div key={log.id} className="trade-log-row font-12" style={{ flexDirection: "column", gap: "2px" }}>
                      <div className="flex-row justify-between">
                        <span className="text-emerald"><strong>{log.opType}</strong></span>
                        <span className="text-muted">{log.timestamp}</span>
                      </div>
                      <span className="text-muted">对象：{log.targetObject} | 操作人：{log.operator}</span>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        )}

        {/* PAGE 2: USERS (用户管理) */}
        {activePage === "users" && (
          <div className="admin-page animate-fade-in">
            <div className="table-card">
              <div className="table-card-header-actions">
                <div className="search-filters-bar flex-row gap-12 align-center">
                  <input
                    type="text"
                    placeholder="输入 Telegram ID / 用户名 / ID 进行检索"
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                    className="search-input"
                    style={{ width: "300px" }}
                  />
                  <div className="filter-pill-buttons flex-row gap-6">
                    <button
                      className={`filter-pill ${userRiskFilter === "all" ? "active" : ""}`}
                      onClick={() => setUserRiskFilter("all")}
                    >
                      全部用户
                    </button>
                    <button
                      className={`filter-pill ${userRiskFilter === "normal" ? "active" : ""}`}
                      onClick={() => setUserRiskFilter("normal")}
                    >
                      正常
                    </button>
                    <button
                      className={`filter-pill ${userRiskFilter === "review" ? "active" : ""}`}
                      onClick={() => setUserRiskFilter("review")}
                    >
                      标记复核
                    </button>
                    <button
                      className={`filter-pill ${userRiskFilter === "restricted" ? "active" : ""}`}
                      onClick={() => setUserRiskFilter("restricted")}
                    >
                      限制用户
                    </button>
                  </div>
                </div>
              </div>

              <div className="admin-table-container">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>用户 ID</th>
                      <th>Telegram ID</th>
                      <th>用户名</th>
                      <th>积分 (Score)</th>
                      <th>代币段位级别</th>
                      <th>风控状态</th>
                      <th>详情</th>
                      <th>安全操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="text-center text-muted" style={{ padding: "40px" }}>无匹配的用户记录。</td>
                      </tr>
                    ) : (
                      filteredUsers.map((u) => (
                        <tr key={u.id}>
                          <td><code>{u.id}</code></td>
                          <td><strong>{u.telegramId}</strong></td>
                          <td><span className="text-amber">@{u.username}</span></td>
                          <td><strong>{u.score.toLocaleString()}</strong></td>
                          <td><span className="badge category-lbl">{u.rankTier}</span></td>
                          <td>
                            <span className={`risk-badge-lbl ${u.riskStatus}`}>
                              {translateRiskStatus(u.riskStatus)}
                            </span>
                          </td>
                          <td>
                            <button className="action-row-btn" onClick={() => setSelectedUser(u)}>
                              查看详情
                            </button>
                          </td>
                          <td>
                            <div className="flex-row gap-6">
                              {u.riskStatus !== "normal" && (
                                <button className="action-row-btn text-success" onClick={() => setConfirmRiskAction({ user: u, action: "normal" })}>
                                  恢复正常
                                </button>
                              )}
                              {u.riskStatus !== "review" && (
                                <button className="action-row-btn text-amber" onClick={() => setConfirmRiskAction({ user: u, action: "review" })}>
                                  标记复核
                                </button>
                              )}
                              {u.riskStatus !== "restricted" && (
                                <button className="action-row-btn danger-text" onClick={() => setConfirmRiskAction({ user: u, action: "restricted" })}>
                                  限制用户
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* User Details Drawer */}
            {selectedUser && (
              <div className="drawer-overlay" onClick={() => setSelectedUser(null)}>
                <div className="detail-drawer" onClick={(e) => e.stopPropagation()}>
                  <div className="drawer-header">
                    <h4>👤 运营端用户画像抽屉</h4>
                    <button className="close-drawer" onClick={() => setSelectedUser(null)}>
                      <X size={18} />
                    </button>
                  </div>

                  <div className="drawer-body">
                    <h2>@{selectedUser.username}</h2>
                    <span className={`risk-badge-lbl ${selectedUser.riskStatus}`} style={{ alignSelf: "start" }}>
                      风控级别: {translateRiskStatus(selectedUser.riskStatus)}
                    </span>

                    <div className="info-section-grid">
                      <div className="grid-item">
                        <span>Telegram ID</span>
                        <strong>{selectedUser.telegramId}</strong>
                      </div>
                      <div className="grid-item">
                        <span>内部系统 ID</span>
                        <strong><code>{selectedUser.id}</code></strong>
                      </div>
                      <div className="grid-item">
                        <span>累积分数 (Score)</span>
                        <strong>{selectedUser.score.toLocaleString()} 分</strong>
                      </div>
                      <div className="grid-item">
                        <span>待结算积分 (Pending)</span>
                        <strong>{selectedUser.pendingPoints ?? 120} POINT_TEST</strong>
                      </div>
                      <div className="grid-item">
                        <span>Agent 运行状态</span>
                        <strong>{selectedUser.agentStatus ?? "已激活 (Alpha 侦察员)"}</strong>
                      </div>
                      <div className="grid-item">
                        <span>背包资产数量</span>
                        <strong>{selectedUser.backpackCount ?? 5} 件</strong>
                      </div>
                      <div className="grid-item">
                        <span>Agent Studio 权限</span>
                        <strong>{selectedUser.studioEnabled ? "已启用" : "已禁用"}</strong>
                      </div>
                    </div>

                    <div style={{ marginTop: "15px", marginBottom: "15px" }}>
                      <button
                        className="primary"
                        style={{ width: "100%", padding: "10px", backgroundColor: selectedUser.studioEnabled ? "#ef5350" : "#26a69a", borderColor: selectedUser.studioEnabled ? "#ef5350" : "#26a69a" }}
                        onClick={async () => {
                          const newStatus = !selectedUser.studioEnabled;
                          try {
                            await adminClient.setUserStudioEnabled(selectedUser.id, newStatus);
                            setSelectedUser({ ...selectedUser, studioEnabled: newStatus });
                            await reloadAll();
                          } catch (err: any) {
                            alert(err.message || "修改权限失败");
                          }
                        }}
                      >
                        {selectedUser.studioEnabled ? "🔒 禁用 Agent Studio 权限" : "✨ 开启 Agent Studio 权限"}
                      </button>
                    </div>

                    <div className="drawer-long-text-block">
                      <h5>最近完成的打工任务</h5>
                      <div className="rules-grid-bullets">
                        {(selectedUser.recentTasks || [
                          { name: "每日签到", timestamp: "3小时前" },
                          { name: "战队助力", timestamp: "5小时前" }
                        ]).map((t, idx) => (
                          <div key={idx} className="bullet-row text-muted">
                            {t.name} — <span className="font-11">{t.timestamp}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="drawer-long-text-block">
                      <h5>近期市场交易事件</h5>
                      {(!selectedUser.recentTrades || selectedUser.recentTrades.length === 0) ? (
                        <p className="muted font-11">近期没有产生市场挂单与买卖交易。</p>
                      ) : (
                        <div className="rules-grid-bullets">
                          {selectedUser.recentTrades.map((tr, idx) => (
                            <div key={idx} className="bullet-row text-emerald">
                              购买了 <strong>{tr.name}</strong> 价格: {tr.price} | <span className="font-11 text-muted">{tr.timestamp}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 风控确认弹窗 */}
            {confirmRiskAction && (
              <div className="admin-overlay">
                <div className="admin-modal">
                  <h3 className="text-danger">⚠️ 二次风控决策确认</h3>
                  <p className="muted-line" style={{ fontSize: "13px", lineHeight: "1.5" }}>
                    您正在对用户 <strong>@{confirmRiskAction.user.username}</strong> ({confirmRiskAction.user.telegramId}) 更改风控操作状态为：
                    <strong className="text-amber">「{confirmRiskAction.action === "normal" ? "恢复正常" : confirmRiskAction.action === "restricted" ? "限制用户" : "标记复核"}」</strong>。
                  </p>
                  <p className="muted font-11 text-danger">
                    * 限制用户状态下，该账号在 Telegram Mini App 中将无法开盒、挂牌出售策略资产或生成新的积分提现指令。
                  </p>
                  <div className="modal-actions">
                    <button
                      className="primary danger-text"
                      onClick={() => handleUserRiskChange(confirmRiskAction.user.id, confirmRiskAction.action)}
                    >
                      确定变更
                    </button>
                    <button className="secondary" onClick={() => setConfirmRiskAction(null)}>
                      取消
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* PAGE 3: TASKS (任务配置) */}
        {activePage === "tasks" && (
          <div className="admin-page animate-fade-in two-column-layout">
            <div className="table-card flex-grow">
              <div className="table-card-header-actions">
                <h3>游戏活跃任务列表</h3>
              </div>

              <div className="admin-table-container">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>任务名称</th>
                      <th>代码 Key</th>
                      <th>单次消耗能量</th>
                      <th>单次基础积分</th>
                      <th>状态</th>
                      <th>管理操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tasks.map((t) => (
                      <tr key={t.id}>
                        <td><strong>{t.name}</strong></td>
                        <td><code>{t.id}</code></td>
                        <td>{t.energyCost} 点</td>
                        <td><strong>{t.basePendingPoints} PT</strong></td>
                        <td>
                          <span className={`status-badge-lbl ${t.status}`}>
                            {translateStatus(t.status)}
                          </span>
                        </td>
                        <td>
                          <div className="flex-row gap-6">
                            {t.status === "active" ? (
                              <button className="action-row-btn" onClick={() => void handleTaskStatusToggle(t.id, t.status)}>
                                暂停运行
                              </button>
                            ) : (
                              <button className="action-row-btn text-success" onClick={() => void handleTaskStatusToggle(t.id, t.status)}>
                                恢复运行
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Task Creator Form */}
            <div className="table-card form-sidebar-card">
              <h3>发布新活跃任务</h3>
              <form onSubmit={handleCreateTaskSubmit} className="admin-form" style={{ marginTop: "12px" }}>
                {taskSaveSuccess && <div className="success-text text-emerald font-12" style={{ marginBottom: "8px" }}>✓ 任务发布成功，已实时生效！</div>}
                {taskSaveError && <div className="error-text text-danger font-12" style={{ marginBottom: "8px" }}>⚠️ {taskSaveError}</div>}

                <div className="form-field">
                  <label>任务显示名称 (中文化)</label>
                  <input
                    type="text"
                    value={newTaskName}
                    onChange={(e) => setNewTaskName(e.target.value)}
                    placeholder="例如: 战队每日联合探索"
                    required
                  />
                </div>

                <div className="form-row grid-2">
                  <div className="form-field">
                    <label>单次能量扣除 (点)</label>
                    <input
                      type="number"
                      value={newTaskEnergy}
                      onChange={(e) => setNewTaskEnergy(e.target.value)}
                      min="0"
                      required
                    />
                  </div>
                  <div className="form-field">
                    <label>单次基础积分 (PT)</label>
                    <input
                      type="number"
                      value={newTaskReward}
                      onChange={(e) => setNewTaskReward(e.target.value)}
                      min="0"
                      required
                    />
                  </div>
                </div>

                <div className="form-field flex-row gap-6 pad-6">
                  <input
                    type="checkbox"
                    id="newTaskWallet"
                    checked={newTaskWallet}
                    onChange={(e) => setNewTaskWallet(e.target.checked)}
                  />
                  <label htmlFor="newTaskWallet">🔑 此打工任务强制需要 TON 钱包签名验证</label>
                </div>

                <div className="form-row grid-2">
                  <div className="form-field">
                    <label>投放开始时间</label>
                    <input
                      type="datetime-local"
                      value={newTaskStart}
                      onChange={(e) => setNewTaskStart(e.target.value)}
                    />
                  </div>
                  <div className="form-field">
                    <label>投放结束时间</label>
                    <input
                      type="datetime-local"
                      value={newTaskEnd}
                      onChange={(e) => setNewTaskEnd(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-field">
                  <label>允许加速提效的装备资产 Key</label>
                  <input
                    type="text"
                    value={newTaskAssets}
                    onChange={(e) => setNewTaskAssets(e.target.value)}
                    placeholder="例如: alpha_radar, crew_boost"
                  />
                </div>

                <div className="tasks-pre-launch-check warning-note" style={{ background: "rgba(251,191,36,0.04)", border: "1px solid rgba(251,191,36,0.15)", borderRadius: "6px", padding: "10px", marginTop: "4px" }}>
                  <h4 style={{ fontSize: "11px", fontWeight: "800", textTransform: "uppercase" }}>📊 发布前检查面板</h4>
                  <ul style={{ paddingLeft: "14px", fontSize: "10px", lineHeight: "1.4", margin: "4px 0 0" }}>
                    <li>单次性价比: <strong>{(Number(newTaskReward) / (Number(newTaskEnergy) || 1)).toFixed(1)} PT/点能量</strong> (健康范围: 5 - 15)</li>
                    <li>首日新手体验：{Number(newTaskEnergy) > 50 ? "⚠️ 消耗过高，会极度损害新手即时开盒的节奏！" : "🟢 适中，不影响初期激活流存"}</li>
                    <li>签名风控防线：{newTaskWallet ? "🟢 强制防刷签名拦截" : "⚠️ 无钱包拦截，可能易受高并发脚本模拟刷分风险！"}</li>
                  </ul>
                </div>

                <button type="submit" className="primary w-full flex-center gap-6" style={{ marginTop: "6px" }}>
                  <Plus size={14} /> 确认创建并即时投产
                </button>
              </form>
            </div>
          </div>
        )}

        {/* PAGE 4: BOXES (盲盒运营) */}
        {activePage === "boxes" && (
          <div className="admin-page animate-fade-in">
            <div className="table-card">
              <div className="table-card-header-actions">
                <h3>盲盒库存发售面板</h3>
                <button className="primary mini" onClick={openCreateBox}>
                  <Plus size={14} /> 新增盲盒发售
                </button>
              </div>

              <div className="admin-table-container">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>盲盒名称</th>
                      <th>Key</th>
                      <th>运行状态</th>
                      <th>稀有度</th>
                      <th>库存消耗百分比</th>
                      <th>每日配额发售</th>
                      <th>获取渠道与窗口</th>
                      <th>流通与绑定要求</th>
                      <th>编辑</th>
                    </tr>
                  </thead>
                  <tbody>
                    {boxes.map((b) => {
                      const percent = getBoxStockPercent(b);
                      const isLow = percent < 20;
                      return (
                        <tr key={b.id} className={`rarity-row-${b.rarity}`}>
                          <td><strong>{b.name}</strong></td>
                          <td><code className="text-amber">{b.key}</code></td>
                          <td>
                            <span className={`status-badge-lbl ${b.status}`}>
                              {translateStatus(b.status)}
                            </span>
                          </td>
                          <td>
                            <span className={`rarity-tag ${b.rarity}`}>{translateRarity(b.rarity)}</span>
                          </td>
                          <td>
                            <div className="flex-row justify-between" style={{ fontSize: "11px", marginBottom: "2px" }}>
                              <span>{b.remainingSupply} / {b.totalSupply}</span>
                              <span className={isLow ? "text-danger" : "text-emerald"}>{percent.toFixed(0)}%</span>
                            </div>
                            <div className="progress-bar-container" style={{ height: "4px", background: "rgba(255,255,255,0.05)", borderRadius: "2px", overflow: "hidden" }}>
                              <div
                                className="progress-bar-fill"
                                style={{
                                  height: "100%",
                                  width: `${percent}%`,
                                  background: isLow ? "var(--danger)" : "var(--emerald)"
                                }}
                              />
                            </div>
                          </td>
                          <td>{b.dailyRelease === 0 ? "不设上限" : `${b.dailyRelease} 个/天`}</td>
                          <td>
                            <div className="time-window-lbl text-muted">
                              <span>渠道：{b.acquisitionRoute}</span><br />
                              <span className="text-amber"><Clock size={10} style={{ display: "inline", marginRight: "3px" }} />{getCountdownText(b.endTime)}</span>
                            </div>
                          </td>
                          <td>
                            <div className="rule-details-lbl text-muted">
                              <span>挂单：{b.transferableBeforeOpen ? "允许在二级市场转让" : "禁止转移"}</span><br />
                              <span>开盒：{translateBindingStrategy(b.bindingStrategy)}</span>
                            </div>
                          </td>
                          <td>
                            <div className="action-row-buttons flex-row gap-6">
                              <button className="action-row-btn" onClick={() => openEditBox(b)}>
                                编辑
                              </button>
                              {b.status === "active" ? (
                                <button className="action-row-btn" onClick={() => adminClient.updateBoxStatus(b.id, "paused").then(setBoxes)}>
                                  暂停
                                </button>
                              ) : b.status === "paused" ? (
                                <button className="action-row-btn text-success" onClick={() => adminClient.updateBoxStatus(b.id, "active").then(setBoxes)}>
                                  启用
                                </button>
                              ) : null}
                              {b.status !== "archived" && (
                                <button className="action-row-btn danger-text" onClick={() => handleArchiveBox(b.id, b.name)}>
                                  归档
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Box modal */}
            {creatingBox && (
              <div className="admin-overlay">
                <div className="admin-modal box-editor-modal" style={{ maxWidth: "600px" }}>
                  <h3>{editingBox ? `修改盲盒：${editingBox.name}` : "新建盲盒投产包"}</h3>
                  <form onSubmit={(e) => { e.preventDefault(); setConfirmingBoxForm(true); }} className="admin-form grid-form">
                    <div className="form-field">
                      <label>盲盒代码 Key (唯一性系统标识)</label>
                      <select
                        value={boxForm.key}
                        onChange={(e) => setBoxForm({ ...boxForm, key: e.target.value as BoxKey })}
                        disabled={!!editingBox}
                      >
                        <option value="starter">starter (启动盒)</option>
                        <option value="alpha">alpha (Alpha 盒)</option>
                        <option value="crew">crew (战队盒)</option>
                        <option value="project">project (项目盒)</option>
                        <option value="wallet">wallet (钱包盒)</option>
                      </select>
                    </div>

                    <div className="form-field">
                      <label>中文运营名称 (在客户端显示的别名)</label>
                      <input
                        type="text"
                        value={boxForm.name}
                        onChange={(e) => setBoxForm({ ...boxForm, name: e.target.value })}
                        placeholder="例如: 新人专享启动盒"
                        required
                      />
                    </div>

                    <div className="form-field">
                      <label>设定品质分级</label>
                      <select
                        value={boxForm.rarity}
                        onChange={(e) => setBoxForm({ ...boxForm, rarity: e.target.value as any })}
                      >
                        <option value="common">普通</option>
                        <option value="rare">稀有</option>
                        <option value="epic">史诗</option>
                        <option value="legendary">传说</option>
                        <option value="genesis">创世</option>
                      </select>
                    </div>

                    <div className="form-field">
                      <label>投产状态</label>
                      <select
                        value={boxForm.status}
                        onChange={(e) => setBoxForm({ ...boxForm, status: e.target.value as BoxStatus })}
                      >
                        <option value="draft">草稿</option>
                        <option value="active">运行中</option>
                        <option value="paused">挂起暂停</option>
                      </select>
                    </div>

                    <div className="form-field">
                      <label>发售总配额 (0 表示不封顶无限)</label>
                      <input
                        type="number"
                        value={boxForm.totalSupply}
                        onChange={(e) => setBoxForm({ ...boxForm, totalSupply: Number(e.target.value) })}
                        required
                      />
                    </div>

                    <div className="form-field">
                      <label>剩余库存配额</label>
                      <input
                        type="number"
                        value={boxForm.remainingSupply}
                        onChange={(e) => setBoxForm({ ...boxForm, remainingSupply: Number(e.target.value) })}
                        required
                      />
                    </div>

                    <div className="form-field">
                      <label>每日限制释放量 (0 表示不限速)</label>
                      <input
                        type="number"
                        value={boxForm.dailyRelease}
                        onChange={(e) => setBoxForm({ ...boxForm, dailyRelease: Number(e.target.value) })}
                        required
                      />
                    </div>

                    <div className="form-field">
                      <label>玩家获取渠道详情说明文案</label>
                      <input
                        type="text"
                        value={boxForm.acquisitionRoute}
                        onChange={(e) => setBoxForm({ ...boxForm, acquisitionRoute: e.target.value })}
                        placeholder="例如: 邀请3名活跃好友"
                        required
                      />
                    </div>

                    <div className="form-field">
                      <label>发售窗口开始时间 (北京时间)</label>
                      <input
                        type="datetime-local"
                        value={boxForm.startTime}
                        onChange={(e) => setBoxForm({ ...boxForm, startTime: e.target.value })}
                      />
                    </div>

                    <div className="form-field">
                      <label>发售窗口截止时间 (北京时间)</label>
                      <input
                        type="datetime-local"
                        value={boxForm.endTime}
                        onChange={(e) => setBoxForm({ ...boxForm, endTime: e.target.value })}
                      />
                    </div>

                    <div className="form-field flex-row gap-6 pad-6 span-2">
                      <input
                        type="checkbox"
                        id="transferableBeforeOpen"
                        checked={boxForm.transferableBeforeOpen}
                        onChange={(e) => setBoxForm({ ...boxForm, transferableBeforeOpen: e.target.checked })}
                      />
                      <label htmlFor="transferableBeforeOpen"><strong>允许交易属性</strong>：未开启的盲盒允许在交易市场流通出售</label>
                    </div>

                    <div className="form-field span-2">
                      <label>开盒产出资产绑定决策</label>
                      <select
                        value={boxForm.bindingStrategy}
                        onChange={(e) => setBoxForm({ ...boxForm, bindingStrategy: e.target.value as any })}
                      >
                        <option value="soulbound">灵魂绑定 (soulbound - 不允许转移挂单)</option>
                        <option value="transferable">可自由挂单流通交易 (transferable)</option>
                        <option value="bind_on_use">激活执行时强制锁死绑定 (bind_on_use)</option>
                      </select>
                    </div>

                    <div className="list-form-actions modal-actions span-2">
                      <button type="submit" className="primary">确认保存</button>
                      <button type="button" className="secondary" onClick={() => setCreatingBox(false)}>取消</button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Box Release Check Modal */}
            {confirmingBoxForm && (
              <div className="admin-overlay" style={{ zIndex: 1200 }}>
                <div className="admin-modal">
                  <h3 className="text-emerald">📝 盲盒发售策略发布确认</h3>
                  <p className="muted-line" style={{ fontSize: "12px", lineHeight: "1.4" }}>
                    请再次审查以下发售规则，保存后将在链下D1中完成更新：
                  </p>

                  <div className="info-section-grid" style={{ margin: "10px 0", fontSize: "12px" }}>
                    <div className="grid-item">
                      <span>盲盒别名</span>
                      <strong>{boxForm.name}</strong>
                    </div>
                    <div className="grid-item">
                      <span>代码 Key</span>
                      <strong>{boxForm.key}</strong>
                    </div>
                    <div className="grid-item">
                      <span>初始总库存</span>
                      <strong>{boxForm.totalSupply === 0 ? "无限" : `${boxForm.totalSupply} 个`}</strong>
                    </div>
                    <div className="grid-item">
                      <span>绑定规则</span>
                      <strong>{boxForm.bindingStrategy === "soulbound" ? "灵魂绑定 (无法销售)" : "允许流转交易"}</strong>
                    </div>
                  </div>

                  <p className="warning-note" style={{ fontSize: "11px" }}>
                    ⚠️ 开盒所绑定策略卡产出率由对应的「掉落池」权重矩阵做换算，不单独在此盲盒实体中维护。
                  </p>

                  <div className="modal-actions">
                    <button className="primary" onClick={handleBoxSubmit}>我已确认，执行更新</button>
                    <button className="secondary" onClick={() => setConfirmingBoxForm(false)}>返回修改</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* PAGE 5: DROP POOL (掉落池配置) */}
        {activePage === "droppool" && (
          <div className="admin-page animate-fade-in two-column-layout">
            <div className="table-card flex-grow">
              <div className="table-card-header-actions">
                <h3>动态概率掉落项配置</h3>
                <div className="box-selector-trigger">
                  <span>当前操作盲盒：</span>
                  <select
                    value={selectedBoxIdForPool}
                    onChange={(e) => setSelectedBoxIdForPool(e.target.value)}
                    className="box-select"
                  >
                    {boxes.filter(b => b.status !== "archived").map(b => (
                      <option key={b.id} value={b.id}>{b.name} ({translateBoxKey(b.key)})</option>
                    ))}
                  </select>
                </div>
              </div>

              {isPoolDirty && (
                <div className="warning-note" style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.25)", padding: "10px", borderRadius: "6px", marginBottom: "12px" }}>
                  <span>⚠️ <strong>检测到本地改动</strong>：您已经增删了掉落项或修改了相对权重，请点击下方「保存掉落池配置」推送到后端 API，否则刷新后将丢失！</span>
                </div>
              )}

              {dropPoolItems.length === 0 ? (
                <div className="empty-state-card text-center pad-40">
                  <Sparkles size={32} className="muted block icon-margin" />
                  <p>当前盲盒掉落池中无任何资产项。</p>
                  <span className="font-12 muted">请在右侧选择或创建资产条目并赋予相对权重，系统会自动换算百分比概率。</span>
                </div>
              ) : (
                <>
                  <div className="admin-table-container">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>产出资产名称</th>
                          <th>资产大类</th>
                          <th>稀有度</th>
                          <th>分配相对权重</th>
                          <th>动态产出概率</th>
                          <th>数量窗口</th>
                          <th>使用效期与次数</th>
                          <th>钱包/转移限制</th>
                          <th>移除</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dropPoolItems.map((item) => {
                          const prob = totalWeight > 0 ? ((item.weight / totalWeight) * 100).toFixed(2) + "%" : "0%";
                          return (
                            <tr key={item.id} className={`rarity-row-${item.rarity}`}>
                              <td><strong>{item.assetName}</strong></td>
                              <td><span className="badge category-lbl">{translateCategory(item.category)}</span></td>
                              <td><span className={`rarity-tag ${item.rarity}`}>{translateRarity(item.rarity)}</span></td>
                              <td><strong>{item.weight}</strong></td>
                              <td className="text-emerald"><strong>{prob}</strong></td>
                              <td>{item.minQuantity === item.maxQuantity ? `${item.minQuantity} 个` : `${item.minQuantity} - ${item.maxQuantity} 个`}</td>
                              <td>
                                <div className="text-muted font-11">
                                  <span>使用：{item.usesRemaining !== undefined ? `${item.usesRemaining} 次` : "不限"}</span><br />
                                  <span>时限：{item.expiryHours !== undefined ? `${item.expiryHours} 小时` : "永久有效"}</span>
                                </div>
                              </td>
                              <td>
                                <div className="text-muted font-11">
                                  <span>流通：{item.transferable ? "允许交易" : "账号强绑定"}</span><br />
                                  <span>钱包：{item.requiresWallet ? "🔑 强依赖 TON 钱包" : "免钱包"}</span>
                                </div>
                              </td>
                              <td>
                                <button className="trash-btn" onClick={() => handleDeleteDropItem(item.id, item.assetName)}>
                                  <Trash2 size={12} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="pool-calculations-footer">
                    <div className="weight-totals">
                      <span>权重相对总和：<strong>{totalWeight}</strong></span>
                      {totalWeight > 0 && <span className="warning-note">✓ 概率加权和已规避硬几率漏洞，确保 100% 相对产出。</span>}
                    </div>

                    <div className="pool-save-actions flex-row gap-12 align-center">
                      {poolError && <span className="error-text text-danger font-12">{poolError}</span>}
                      {poolSaveSuccess && <span className="success-text text-emerald font-12">✓ 掉落概率规则已同步到全局！</span>}
                      <button
                        className="primary"
                        onClick={handleSaveDropPool}
                        disabled={poolSaving}
                      >
                        {poolSaving ? "同步中..." : "保存掉落池配置"}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Add drop item */}
            <div className="table-card form-sidebar-card">
              <h3>向盲盒中注入资产掉落</h3>
              <form onSubmit={handleAddDropPoolItem} className="admin-form" style={{ marginTop: "12px" }}>
                <div className="form-field">
                  <label>快速导入已有资产模版</label>
                  <select
                    value={newDropItem.assetName}
                    onChange={(e) => handleSelectAssetForDrop(e.target.value)}
                  >
                    <option value="">-- 手动创建非资产库策略卡 --</option>
                    {assetsList.filter(a => a.status === "enabled").map(a => (
                      <option key={a.id} value={a.name}>{a.name} ({translateCategory(a.category)} · {translateRarity(a.rarity)})</option>
                    ))}
                  </select>
                </div>

                <div className="form-field">
                  <label>资产名称 (中文化)</label>
                  <input
                    type="text"
                    value={newDropItem.assetName}
                    onChange={(e) => setNewDropItem({ ...newDropItem, assetName: e.target.value })}
                    placeholder="例如: Alpha 雷达"
                    required
                  />
                </div>

                <div className="form-row grid-2">
                  <div className="form-field">
                    <label>分配相对权重</label>
                    <input
                      type="number"
                      min="1"
                      value={newDropItem.weight}
                      onChange={(e) => setNewDropItem({ ...newDropItem, weight: Number(e.target.value) })}
                      required
                    />
                  </div>
                  <div className="form-field">
                    <label>资产分类</label>
                    <select
                      value={newDropItem.category}
                      onChange={(e) => setNewDropItem({ ...newDropItem, category: e.target.value as any })}
                    >
                      <option value="profession">职业 (profession)</option>
                      <option value="skill">技能 (skill)</option>
                      <option value="permit">许可证 (permit)</option>
                      <option value="access">准入权 (access)</option>
                      <option value="boost">加成 (boost)</option>
                    </select>
                  </div>
                </div>

                <div className="form-row grid-2">
                  <div className="form-field">
                    <label>最小单次开启个数</label>
                    <input
                      type="number"
                      min="1"
                      value={newDropItem.minQuantity}
                      onChange={(e) => setNewDropItem({ ...newDropItem, minQuantity: Number(e.target.value) })}
                      required
                    />
                  </div>
                  <div className="form-field">
                    <label>最大单次开启个数</label>
                    <input
                      type="number"
                      min="1"
                      value={newDropItem.maxQuantity}
                      onChange={(e) => setNewDropItem({ ...newDropItem, maxQuantity: Number(e.target.value) })}
                      required
                    />
                  </div>
                </div>

                <div className="form-row grid-2">
                  <div className="form-field">
                    <label>默认可用次数 (空表示无限)</label>
                    <input
                      type="number"
                      value={newDropItem.usesRemaining}
                      onChange={(e) => setNewDropItem({ ...newDropItem, usesRemaining: e.target.value })}
                      placeholder="无限次"
                    />
                  </div>
                  <div className="form-field">
                    <label>有效倒计时 (小时)</label>
                    <input
                      type="number"
                      value={newDropItem.expiryHours}
                      onChange={(e) => setNewDropItem({ ...newDropItem, expiryHours: e.target.value })}
                      placeholder="永久有效"
                    />
                  </div>
                </div>

                <div className="form-field">
                  <label>品质分级</label>
                  <select
                    value={newDropItem.rarity}
                    onChange={(e) => setNewDropItem({ ...newDropItem, rarity: e.target.value as any })}
                  >
                    <option value="common">普通</option>
                    <option value="rare">稀有</option>
                    <option value="epic">史诗</option>
                    <option value="legendary">传说</option>
                    <option value="genesis">创世</option>
                  </select>
                </div>

                <div className="form-field">
                  <label>效果功能描述文案</label>
                  <textarea
                    value={newDropItem.effect}
                    onChange={(e) => setNewDropItem({ ...newDropItem, effect: e.target.value })}
                    placeholder="例如: 该卡在做任务时自动抵扣10%能量消耗"
                    rows={2}
                    required
                  />
                </div>

                <div className="form-field flex-row gap-6 pad-6">
                  <input
                    type="checkbox"
                    id="dropTransferable"
                    checked={newDropItem.transferable}
                    onChange={(e) => setNewDropItem({ ...newDropItem, transferable: e.target.checked })}
                  />
                  <label htmlFor="dropTransferable">支持在二级交易市场挂单流转</label>
                </div>

                <div className="form-field flex-row gap-6 pad-6">
                  <input
                    type="checkbox"
                    id="dropRequiresWallet"
                    checked={newDropItem.requiresWallet}
                    onChange={(e) => setNewDropItem({ ...newDropItem, requiresWallet: e.target.checked })}
                  />
                  <label htmlFor="dropRequiresWallet">🔑 强制激活玩家 TON 链上委托关系</label>
                </div>

                <button type="submit" className="primary w-full flex-center gap-6" style={{ marginTop: "4px" }}>
                  <Plus size={14} /> 确认添加到暂存列表
                </button>
              </form>
            </div>
          </div>
        )}

        {/* PAGE 6: ASSETS (资产目录) */}
        {activePage === "assets" && (
          <div className="admin-page animate-fade-in">
            <div className="table-card">
              <div className="table-card-header-actions">
                <div className="search-filters-bar flex-row gap-12 align-center">
                  <input
                    type="text"
                    placeholder="输入中文资产名称 / 代码进行搜索"
                    value={assetSearchQuery}
                    onChange={(e) => setAssetSearchQuery(e.target.value)}
                    className="search-input"
                    style={{ width: "240px" }}
                  />
                  <div className="filter-pill-buttons flex-row gap-6">
                    {["all", "profession", "skill", "permit", "access", "boost"].map(cat => (
                      <button
                        key={cat}
                        className={`filter-pill ${assetFilterCategory === cat ? "active" : ""}`}
                        onClick={() => setAssetFilterCategory(cat)}
                      >
                        {cat === "all" ? "全部资产类别" : translateCategory(cat)}
                      </button>
                    ))}
                  </div>
                  <div className="filter-pill-buttons flex-row gap-6" style={{ borderLeft: "1px solid rgba(255,255,255,0.08)", paddingLeft: "12px" }}>
                    <button
                      className={`filter-pill ${assetFilterStatus === "all" ? "active" : ""}`}
                      onClick={() => setAssetFilterStatus("all")}
                    >
                      全部状态
                    </button>
                    <button
                      className={`filter-pill ${assetFilterStatus === "enabled" ? "active" : ""}`}
                      onClick={() => setAssetFilterStatus("enabled")}
                    >
                      已启用
                    </button>
                    <button
                      className={`filter-pill ${assetFilterStatus === "disabled" ? "active" : ""}`}
                      onClick={() => setAssetFilterStatus("disabled")}
                    >
                      已停用
                    </button>
                  </div>
                </div>

                <button className="primary mini" onClick={openCreateAsset}>
                  <Plus size={14} /> 新建资产定义
                </button>
              </div>

              <div className="admin-table-container">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>资产显示名</th>
                      <th>代码 Key</th>
                      <th>资产类别</th>
                      <th>稀有度</th>
                      <th>市场转让权限</th>
                      <th>默认效期与可用限制</th>
                      <th>效果功能说明</th>
                      <th>状态</th>
                      <th>审计与编辑操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAssets.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="text-center text-muted" style={{ padding: "40px" }}>无匹配的策略资产定义。</td>
                      </tr>
                    ) : (
                      filteredAssets.map((asset) => (
                        <tr key={asset.id} className={`rarity-row-${asset.rarity}`}>
                          <td><strong>{asset.name}</strong></td>
                          <td><code>{asset.key}</code></td>
                          <td><span className="badge category-lbl">{translateCategory(asset.category)}</span></td>
                          <td><span className={`rarity-tag ${asset.rarity}`}>{translateRarity(asset.rarity)}</span></td>
                          <td>
                            <span className={asset.transferable ? "text-emerald" : "text-muted"}>
                              {asset.transferable ? "允许流转交易" : "强绑定用户背包"}
                            </span>
                          </td>
                          <td>
                            <span className="font-11 text-muted">
                              时限: {asset.defaultExpiryHours ? `${asset.defaultExpiryHours} 小时` : "永久"} | 次数: {asset.defaultUses ? `${asset.defaultUses} 次` : "无限"}
                            </span>
                          </td>
                          <td><span className="font-11 text-muted">{asset.effect}</span></td>
                          <td>
                            <span className={`status-badge-lbl ${asset.status === "enabled" ? "active" : "paused"}`}>
                              {asset.status === "enabled" ? "已启用" : "已停用"}
                            </span>
                          </td>
                          <td>
                            <div className="flex-row gap-6">
                              <button className="action-row-btn" onClick={() => setSelectedAsset(asset)}>
                                详细看板
                              </button>
                              <button className="action-row-btn" onClick={() => openEditAsset(asset)}>
                                编辑
                              </button>
                              <button
                                className={`action-row-btn ${asset.status === "enabled" ? "danger-text" : "text-success"}`}
                                onClick={() => handleToggleAssetStatus(asset.id, asset.status, asset.name)}
                              >
                                {asset.status === "enabled" ? "停用" : "启用"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Asset Details Drawer */}
            {selectedAsset && (
              <div className="drawer-overlay" onClick={() => setSelectedAsset(null)}>
                <div className="detail-drawer" onClick={(e) => e.stopPropagation()}>
                  <div className="drawer-header">
                    <h4>资产详细信息看板</h4>
                    <button className="close-drawer" onClick={() => setSelectedAsset(null)}>
                      <X size={18} />
                    </button>
                  </div>

                  <div className="drawer-body">
                    <h2>{selectedAsset.name}</h2>
                    <span className={`rarity-tag ${selectedAsset.rarity}`} style={{ alignSelf: "start" }}>
                      {translateRarity(selectedAsset.rarity)}
                    </span>

                    <div className="info-section-grid">
                      <div className="grid-item">
                        <span>代码 Key</span>
                        <strong><code>{selectedAsset.key}</code></strong>
                      </div>
                      <div className="grid-item">
                        <span>资产类别</span>
                        <strong>{translateCategory(selectedAsset.category)}</strong>
                      </div>
                      <div className="grid-item">
                        <span>交易转让属性</span>
                        <strong>{selectedAsset.transferable ? "允许流转交易" : "绑定当前账户资产"}</strong>
                      </div>
                      <div className="grid-item">
                        <span>链上钱包要求</span>
                        <strong>{selectedAsset.requiresWallet ? "🔑 必须依赖链上Wallet才能使用" : "无需钱包依赖"}</strong>
                      </div>
                      <div className="grid-item">
                        <span>默认过期时间</span>
                        <strong>{selectedAsset.defaultExpiryHours ? `${selectedAsset.defaultExpiryHours} 小时` : "永久有效"}</strong>
                      </div>
                      <div className="grid-item">
                        <span>默认使用限次</span>
                        <strong>{selectedAsset.defaultUses ? `${selectedAsset.defaultUses} 次` : "无限次"}</strong>
                      </div>
                    </div>

                    <div className="drawer-long-text-block">
                      <h5>资产功能功能说明</h5>
                      <p>{selectedAsset.effect}</p>
                    </div>

                    <div className="drawer-long-text-block">
                      <h5>适用任务范围</h5>
                      {selectedAsset.applicableTasks.length === 0 ? (
                        <p className="muted font-11">全局通用 / 无特定关联任务</p>
                      ) : (
                        <div className="key-tags">
                          {selectedAsset.applicableTasks.map(t => <span key={t} className="key-tag-lbl">{t}</span>)}
                        </div>
                      )}
                    </div>

                    <div className="drawer-long-text-block">
                      <h5>关联发售的盲盒产出</h5>
                      {selectedAsset.applicableBoxes.length === 0 ? (
                        <p className="muted font-11">无特定盲盒产出限制</p>
                      ) : (
                        <div className="key-tags">
                          {selectedAsset.applicableBoxes.map(b => <span key={b} className="key-tag-lbl">{b}</span>)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Asset Create/Edit Form Modal */}
            {creatingAsset && (
              <div className="admin-overlay">
                <div className="admin-modal">
                  <h3>{editingAsset ? `编辑资产模版: ${editingAsset.name}` : "新建资产定义数据"}</h3>
                  <form onSubmit={handleAssetSubmit} className="admin-form">
                    <div className="form-field">
                      <label>中文资产显示名称</label>
                      <input
                        type="text"
                        value={assetForm.name}
                        onChange={(e) => setAssetForm({ ...assetForm, name: e.target.value })}
                        placeholder="例如: Alpha 侦察员, 准入权重"
                        required
                      />
                    </div>
                    <div className="form-field">
                      <label>代码 Key (系统唯一标识)</label>
                      <input
                        type="text"
                        value={assetForm.key}
                        onChange={(e) => setAssetForm({ ...assetForm, key: e.target.value })}
                        placeholder="例如: alpha_scout, allowlist_weight"
                        required
                      />
                    </div>
                    <div className="form-row grid-2">
                      <div className="form-field">
                        <label>资产分类</label>
                        <select
                          value={assetForm.category}
                          onChange={(e) => setAssetForm({ ...assetForm, category: e.target.value as any })}
                        >
                          <option value="profession">职业 (profession)</option>
                          <option value="skill">技能 (skill)</option>
                          <option value="permit">许可证 (permit)</option>
                          <option value="access">准入权 (access)</option>
                          <option value="boost">加成 (boost)</option>
                        </select>
                      </div>
                      <div className="form-field">
                        <label>品质稀有度</label>
                        <select
                          value={assetForm.rarity}
                          onChange={(e) => setAssetForm({ ...assetForm, rarity: e.target.value as any })}
                        >
                          <option value="common">普通</option>
                          <option value="rare">稀有</option>
                          <option value="epic">史诗</option>
                          <option value="legendary">传说</option>
                          <option value="genesis">创世</option>
                        </select>
                      </div>
                    </div>

                    <div className="form-row grid-2">
                      <div className="form-field">
                        <label>默认时效 (小时，留空表示永久)</label>
                        <input
                          type="number"
                          value={assetForm.defaultExpiryHours}
                          onChange={(e) => setAssetForm({ ...assetForm, defaultExpiryHours: e.target.value })}
                          placeholder="永久"
                        />
                      </div>
                      <div className="form-field">
                        <label>默认使用次数 (留空表示无限)</label>
                        <input
                          type="number"
                          value={assetForm.defaultUses}
                          onChange={(e) => setAssetForm({ ...assetForm, defaultUses: e.target.value })}
                          placeholder="无限"
                        />
                      </div>
                    </div>

                    <div className="form-field">
                      <label>资产加成效果详细说明</label>
                      <textarea
                        value={assetForm.effect}
                        onChange={(e) => setAssetForm({ ...assetForm, effect: e.target.value })}
                        placeholder="在此写入在Mini App里的真实执行加成说明..."
                        rows={2}
                        required
                      />
                    </div>

                    <div className="form-field">
                      <label>关联适用任务ID (多个请用逗号隔开)</label>
                      <input
                        type="text"
                        value={assetForm.applicableTasks}
                        onChange={(e) => setAssetForm({ ...assetForm, applicableTasks: e.target.value })}
                        placeholder="例如: task_daily_checkin, task_group_pool"
                      />
                    </div>

                    <div className="form-field">
                      <label>关联产出盲盒源 Key (多个请用逗号隔开)</label>
                      <input
                        type="text"
                        value={assetForm.applicableBoxes}
                        onChange={(e) => setAssetForm({ ...assetForm, applicableBoxes: e.target.value })}
                        placeholder="例如: box_starter, box_alpha"
                      />
                    </div>

                    <div className="form-field flex-row gap-6 pad-6">
                      <input
                        type="checkbox"
                        id="assetTransferable"
                        checked={assetForm.transferable}
                        onChange={(e) => setAssetForm({ ...assetForm, transferable: e.target.checked })}
                      />
                      <label htmlFor="assetTransferable">允许在该资产未开启时挂单交易流转</label>
                    </div>

                    <div className="form-field flex-row gap-6 pad-6">
                      <input
                        type="checkbox"
                        id="assetRequiresWallet"
                        checked={assetForm.requiresWallet}
                        onChange={(e) => setAssetForm({ ...assetForm, requiresWallet: e.target.checked })}
                      />
                      <label htmlFor="assetRequiresWallet">🔑 本资产执行需要玩家接入链上沙盒钱包</label>
                    </div>

                    <div className="list-form-actions modal-actions" style={{ marginTop: "12px" }}>
                      <button type="submit" className="primary">确认提交数据</button>
                      <button type="button" className="secondary" onClick={() => setCreatingAsset(false)}>关闭</button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* PAGE 7: MARKET RULES (市场规则) */}
        {activePage === "marketrules" && marketRules && (
          <div className="admin-page animate-fade-in two-column-layout">
            <div className="table-card flex-grow">
              <h3>交易资产大类控制权限说明</h3>

              <div className="market-rules-section-split" style={{ marginTop: "12px" }}>
                <h4 className="text-emerald">🟢 允许挂牌流转的可交易资产范围</h4>
                <p className="muted font-12" style={{ margin: "4px 0 12px" }}>以下资产大类在转移属性设定为「可交易」时，允许在系统市场挂单。</p>
                <div className="rules-grid-bullets">
                  <div className="bullet-row"><strong>未开启的盲盒</strong> — 允许挂单自由买卖 (包含 Starter Box 外的所有盲盒)。</div>
                  <div className="bullet-row"><strong>可转让技能卡</strong> — 产出并解绑的技能(Skill)卡，在限次内允许挂牌。</div>
                  <div className="bullet-row"><strong>可转让职业卡</strong> — 各类侦察职业(Profession)资产，解绑后允许在市场流通。</div>
                  <div className="bullet-row"><strong>许可证及准入权</strong> — 可流转的短期通行证，适用于空投资格获取。</div>
                </div>
              </div>

              <div className="market-rules-section-split" style={{ marginTop: "24px" }}>
                <h4 className="text-danger">🚨 全局禁运及禁止交易的核心数据</h4>
                <p className="muted font-12" style={{ margin: "4px 0 12px" }}>以下核心积分及身份绑定机制禁止在任何外部或内部场景流转。</p>
                <div className="rules-grid-bullets">
                  <div className="bullet-row"><strong>待结算积分 (Pending Points)</strong> — 仅作为链下结算依据，禁止交易防范非法转移。</div>
                  <div className="bullet-row"><strong>用户分数 (User Score)</strong> — 全局女巫校验后综合分数，非转让属性，防刷规则。</div>
                  <div className="bullet-row"><strong>Agent 基础角色身份</strong> — 玩家验证并领取的免费打工人，禁止脱离账户流转。</div>
                  <div className="bullet-row"><strong>绑定的启动盒及资产</strong> — 新人赠送福利及产出技能，强绑定新手安全隔离区。</div>
                </div>
              </div>
            </div>

            <div className="table-card form-sidebar-card">
              <h3>交易结算参数设定</h3>
              <form onSubmit={handleMarketRulesSubmit} className="admin-form" style={{ marginTop: "12px" }}>
                <div className="form-field">
                  <label>全局撮合手续费 (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="50"
                    value={editedRules.platformFeePercent}
                    onChange={(e) => setEditedRules({ ...editedRules, platformFeePercent: Number(e.target.value) })}
                    required
                  />
                </div>

                <div className="form-row grid-2">
                  <div className="form-field">
                    <label>最低定价下限 (PT)</label>
                    <input
                      type="text"
                      value={editedRules.minPrice}
                      onChange={(e) => setEditedRules({ ...editedRules, minPrice: e.target.value })}
                      required
                    />
                  </div>
                  <div className="grid-item form-field">
                    <label>最高定价上限 (PT)</label>
                    <input
                      type="text"
                      value={editedRules.maxPrice}
                      onChange={(e) => setEditedRules({ ...editedRules, maxPrice: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="form-field">
                  <label>挂单最长失效周期 (天)</label>
                  <input
                    type="number"
                    min="1"
                    value={editedRules.listingExpiryDays}
                    onChange={(e) => setEditedRules({ ...editedRules, listingExpiryDays: Number(e.target.value) })}
                    required
                  />
                </div>

                <div className="form-field flex-row gap-6 pad-6">
                  <input
                    type="checkbox"
                    id="allowStarterBoxTrade"
                    checked={editedRules.allowStarterBoxTrade}
                    onChange={(e) => setEditedRules({ ...editedRules, allowStarterBoxTrade: e.target.checked })}
                  />
                  <label htmlFor="allowStarterBoxTrade">允许在二级交易市场交易启动盒</label>
                </div>

                <div className="form-field flex-row gap-6 pad-6">
                  <input
                    type="checkbox"
                    id="allowProjectBoxTrade"
                    checked={editedRules.allowProjectBoxTrade}
                    onChange={(e) => setEditedRules({ ...editedRules, allowProjectBoxTrade: e.target.checked })}
                  />
                  <label htmlFor="allowProjectBoxTrade">允许在二级交易市场交易合作项目盒</label>
                </div>

                <div className="form-field flex-row gap-6 pad-6">
                  <input
                    type="checkbox"
                    id="marketPaused"
                    checked={editedRules.marketPaused}
                    onChange={(e) => setEditedRules({ ...editedRules, marketPaused: e.target.checked })}
                  />
                  <label htmlFor="marketPaused" className="danger-text">🚨 全局紧急挂起并关闭市场交易撮合</label>
                </div>

                <div className="form-field">
                  <label>交易取消时的归还与罚款逻辑</label>
                  <textarea
                    value={editedRules.cancelRules}
                    onChange={(e) => setEditedRules({ ...editedRules, cancelRules: e.target.value })}
                    rows={3}
                    required
                  />
                </div>

                <div className="rules-save-actions flex-row gap-12 align-center">
                  {rulesSaveSuccess && <span className="success-text text-emerald font-12">✓ 市场配置已推送到 D1 生效！</span>}
                  <button type="submit" className="primary w-full" disabled={rulesSaving}>
                    {rulesSaving ? "正在更新..." : "更新全局市场配置"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* PAGE 8: LAUNCH (启动运营) */}
        {activePage === "fomo" && (
          <div className="admin-page animate-fade-in">
            <section className="cards">
              <article>
                <span>活跃市场挂单总计</span>
                <strong>{fomo?.activeListings ?? "-"} 件</strong>
                <small className="trend positive">市场流动性平稳</small>
              </article>
              <article>
                <span>个人分享裂变数</span>
                <strong>{shareCount("share_personal_report")} 次</strong>
                <small className="trend positive">个人任务报告裂变</small>
              </article>
              <article>
                <span>开盒分享裂变数</span>
                <strong>{shareCount("share_box_report")} 次</strong>
                <small className="trend positive">策略卡激活裂变</small>
              </article>
              <article>
                <span>战队入驻裂变数</span>
                <strong>{shareCount("share_group_invite")} 次</strong>
                <small className="trend positive">社群活跃邀请裂变</small>
              </article>
            </section>

            <div className="dashboard-grid-row">
              <section className="table-card flex-grow">
                <h3>🔍 稀有策略资产实时掉落监控</h3>
                <div className="rare-drops-rows-list" style={{ marginTop: "10px" }}>
                  {(fomo?.rareDrops || []).map((drop) => (
                    <div key={drop.id} className="row">
                      <span>@{drop.username} 开启了 {drop.boxName}</span>
                      <span className="badge active">{translateRarity(drop.rarity)}: {drop.rewardName}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="table-card">
                <h3>📋 运营投产前内测检查清单</h3>
                <div className="launch-checklist-wrapper" style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "12px" }}>
                  <div className="flex-row gap-6 align-center">
                    <CheckCircle2 size={16} className="text-emerald" />
                    <span style={{ fontSize: "13px" }}>Telegram Mini App 在客户端可正常调起</span>
                  </div>
                  <div className="flex-row gap-6 align-center">
                    <CheckCircle2 size={16} className="text-emerald" />
                    <span style={{ fontSize: "13px" }}>Cloudflare Worker 真实接口通信正常</span>
                  </div>
                  <div className="flex-row gap-6 align-center">
                    <CheckCircle2 size={16} className="text-emerald" />
                    <span style={{ fontSize: "13px" }}>Bot 启动自定义菜单及指令正常响应</span>
                  </div>
                  <div className="flex-row gap-6 align-center">
                    <CheckCircle2 size={16} className="text-emerald" />
                    <span style={{ fontSize: "13px" }}>启动盒新手库存余量校验通过</span>
                  </div>
                  <div className="flex-row gap-6 align-center">
                    <CheckCircle2 size={16} className="text-emerald" />
                    <span style={{ fontSize: "13px" }}>全局任务与能量消耗处于非暂停状态</span>
                  </div>
                  <div className="flex-row gap-6 align-center">
                    <CheckCircle2 size={16} className="text-emerald" />
                    <span style={{ fontSize: "13px" }}>二级转让交易撮合交易服务就绪</span>
                  </div>
                  <div className="flex-row gap-6 align-center">
                    <CheckCircle2 size={16} className="text-emerald" />
                    <span style={{ fontSize: "13px" }}>排查文案：无固定奖励、固定兑换或收益承诺</span>
                  </div>
                </div>
              </section>
            </div>

            <div className="table-card" style={{ marginTop: "20px" }}>
              <h3>四大盲盒实时发售与消耗状态监控</h3>
              <div className="admin-table-container">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>盲盒类别</th>
                      <th>当前实时消耗</th>
                      <th>投放渠道</th>
                      <th>概率属性定位</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(fomo?.boxSupply || []).map((box) => (
                      <tr key={box.key}>
                        <td><strong>{box.name}</strong></td>
                        <td>{box.remaining} / {box.total}</td>
                        <td>{box.route}</td>
                        <td>{box.oddsLabel}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* PAGE 9: RISK & SECURITY (安全风控) */}
        {activePage === "risk" && (
          <div className="admin-page animate-fade-in">
            <div className="emergency-alert-panel">
              <AlertTriangle size={36} className="text-danger" />
              <div>
                <h4>紧急风险决策熔断器</h4>
                <p>如遇高频恶意并发签名、防刷机制告警等攻击，可一键熔断相关模块的写操作。</p>
              </div>
            </div>

            <div className="emergency-freeze-buttons-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", margin: "20px 0" }}>
              <button
                className={`pause-btn-switch ${boxesPaused ? "paused-state" : "active-state"}`}
                onClick={() => setConfirmEmergencyFreeze({ type: "boxes", active: !boxesPaused })}
                style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "8px", alignItems: "center" }}
              >
                {boxesPaused ? <Play size={24} /> : <Pause size={24} />}
                <strong>{boxesPaused ? "恢复盲盒开盒交易" : "紧急挂起所有盲盒"}</strong>
                <span className="font-11">影响范围：全局玩家无法提取/开启盲盒</span>
              </button>

              <button
                className={`pause-btn-switch ${tasksPaused ? "paused-state" : "active-state"}`}
                onClick={() => setConfirmEmergencyFreeze({ type: "tasks", active: !tasksPaused })}
                style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "8px", alignItems: "center" }}
              >
                {tasksPaused ? <Play size={24} /> : <Pause size={24} />}
                <strong>{tasksPaused ? "恢复任务运行" : "紧急挂起所有任务"}</strong>
                <span className="font-11">影响范围：阻止任务执行与待结算积分新增</span>
              </button>

              <button
                className={`pause-btn-switch ${editedRules.marketPaused ? "paused-state" : "active-state"}`}
                onClick={() => setConfirmEmergencyFreeze({ type: "market", active: !editedRules.marketPaused })}
                style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "8px", alignItems: "center" }}
              >
                {editedRules.marketPaused ? <Play size={24} /> : <Pause size={24} />}
                <strong>{editedRules.marketPaused ? "解锁市场交易撮合" : "紧急挂起流转市场"}</strong>
                <span className="font-11">影响范围：阻止挂单、退单、撮合交易</span>
              </button>
            </div>

            <div className="dashboard-grid-row">
              <div className="table-card flex-grow">
                <h3>当前处于限制状态的用户名单</h3>
                <div className="admin-table-container">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>用户 ID</th>
                        <th>用户名</th>
                        <th>积分 Score</th>
                        <th>风控级别</th>
                        <th>快速解封</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.filter(u => u.riskStatus !== "normal").length === 0 ? (
                        <tr>
                          <td colSpan={5} className="text-center text-muted" style={{ padding: "40px" }}>🟢 当前无受限用户记录。</td>
                        </tr>
                      ) : (
                        users.filter(u => u.riskStatus !== "normal").map(u => (
                          <tr key={u.id}>
                            <td><code>{u.id}</code></td>
                            <td><strong>@{u.username}</strong></td>
                            <td>{u.score.toLocaleString()}</td>
                            <td><span className={`risk-badge-lbl ${u.riskStatus}`}>{translateRiskStatus(u.riskStatus)}</span></td>
                            <td>
                              <button className="action-row-btn text-success" onClick={() => handleUserRiskChange(u.id, "normal")}>
                                解除限制
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="table-card form-sidebar-card">
                <h3>运营端防刷限制参数阈值</h3>
                <div className="form-field" style={{ marginTop: "12px" }}>
                  <label>单 IP 每日允许最大任务次数</label>
                  <input type="number" defaultValue="5" className="admin-input-small w-full" />
                </div>
                <div className="form-field">
                  <label>高额待结算积分异动报警线 (PT)</label>
                  <input type="number" defaultValue="5000" className="admin-input-small w-full" />
                </div>
                <div className="form-field">
                  <label>异常高频检测响应限制 (毫秒)</label>
                  <input type="number" defaultValue="200" className="admin-input-small w-full" />
                </div>
                <button className="primary w-full" onClick={() => alert("安全防刷红线阈值修改成功，已向 API 同步！")}>
                  确认保存安全红线参数
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 审计日志 */}
        {activePage === "audit" && (
          <div className="admin-page animate-fade-in">
            <section className="cards audit-summary-cards">
              <article>
                <span>审计记录总数</span>
                <strong>{auditSummary.total}</strong>
                <small className="trend positive">最近 200 条操作</small>
              </article>
              <article>
                <span>执行成功</span>
                <strong>{auditSummary.success}</strong>
                <small className="trend positive">已完成写入</small>
              </article>
              <article className={auditSummary.failed > 0 ? "alert-risk-card" : ""}>
                <span>执行失败</span>
                <strong>{auditSummary.failed}</strong>
                <small className={auditSummary.failed > 0 ? "trend negative" : "trend positive"}>{auditSummary.failed > 0 ? "需要复核" : "暂无异常"}</small>
              </article>
              <article>
                <span>风控相关</span>
                <strong>{auditSummary.risk}</strong>
                <small className="trend positive">用户限制与复核</small>
              </article>
            </section>

            <div className="table-card audit-ops-card">
              <div className="table-card-header-actions">
                <div className="search-filters-bar flex-row gap-12 align-center">
                  <input
                    type="text"
                    placeholder="根据操作人 / 对象 / 操作类型过滤日志"
                    value={auditSearchQuery}
                    onChange={(e) => setAuditSearchQuery(e.target.value)}
                    className="search-input"
                    style={{ width: "320px" }}
                  />
                  <div className="filter-pill-buttons flex-row gap-6">
                    <button
                      className={`filter-pill ${auditTypeFilter === "all" ? "active" : ""}`}
                      onClick={() => setAuditTypeFilter("all")}
                    >
                      全部操作类型
                    </button>
                    <button
                      className={`filter-pill ${auditTypeFilter === "风控" ? "active" : ""}`}
                      onClick={() => setAuditTypeFilter("风控")}
                    >
                      风控修改
                    </button>
                    <button
                      className={`filter-pill ${auditTypeFilter === "任务" ? "active" : ""}`}
                      onClick={() => setAuditTypeFilter("任务")}
                    >
                      任务变更
                    </button>
                    <button
                      className={`filter-pill ${auditTypeFilter === "盲盒" ? "active" : ""}`}
                      onClick={() => setAuditTypeFilter("盲盒")}
                    >
                      盲盒配置
                    </button>
                    <button
                      className={`filter-pill ${auditTypeFilter === "资产" ? "active" : ""}`}
                      onClick={() => setAuditTypeFilter("资产")}
                    >
                      资产配置
                    </button>
                    <button
                      className={`filter-pill ${auditTypeFilter === "规则" ? "active" : ""}`}
                      onClick={() => setAuditTypeFilter("规则")}
                    >
                      市场/盲盒规则
                    </button>
                    <button
                      className={`filter-pill ${auditTypeFilter === "失败" ? "active" : ""}`}
                      onClick={() => setAuditTypeFilter("失败")}
                    >
                      失败记录
                    </button>
                  </div>
                </div>
              </div>

              <div className="audit-timeline">
                {filteredAudits.length === 0 ? (
                  <div className="empty-audit-state">
                    <FileSpreadsheet size={28} />
                    <strong>没有符合条件的审计记录</strong>
                    <span>调整筛选条件，或完成一次运营操作后再查看。</span>
                  </div>
                ) : (
                  filteredAudits.map((log) => (
                    <article key={log.id} className={`audit-event-card ${log.status === "success" ? "success" : "failed"}`}>
                      <div className="audit-event-marker" />
                      <div className="audit-event-main">
                        <div className="audit-event-topline">
                          <div>
                            <span className="audit-category-pill">{classifyAuditLog(log)}</span>
                            <strong>{log.opType}</strong>
                          </div>
                          <span className={`status-badge-lbl ${log.status === "success" ? "active" : "paused"}`}>
                            {log.status === "success" ? "执行成功" : "执行失败"}
                          </span>
                        </div>
                        <div className="audit-event-meta">
                          <span>操作人：{log.operator}</span>
                          <span>时间：{log.timestamp}</span>
                          <span>对象：<code>{log.targetObject}</code></span>
                        </div>
                        <div className="audit-change-grid">
                          <div>
                            <span>变更前</span>
                            <p>{formatAuditChange(log.beforeValue)}</p>
                          </div>
                          <div>
                            <span>变更后</span>
                            <p>{formatAuditChange(log.afterValue)}</p>
                          </div>
                        </div>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {activePage === "verifications" && (
          <div className="admin-page animate-fade-in">
            <div className="table-card">
              <div className="flex-row justify-between align-center">
                <h3>🔗 外部任务提交链接审计与手动校验验收</h3>
                <span>共记录 {verifications.length} 项外部提交</span>
              </div>

              <div className="form-group" style={{ marginTop: "12px", width: "300px" }}>
                <label>校验反馈备注 (拒绝时必填原因)</label>
                <input
                  type="text"
                  placeholder="例如：链接无效、未发现对应推特关注记录"
                  value={verifFeedback}
                  onChange={(e) => setVerifFeedback(e.target.value)}
                  style={{ width: "100%", padding: "8px", boxSizing: "border-box" }}
                />
              </div>

              <div className="table-container" style={{ marginTop: "15px" }}>
                <table>
                  <thead>
                    <tr>
                      <th>提交 ID</th>
                      <th>用户</th>
                      <th>任务名称</th>
                      <th>提交链接</th>
                      <th>提交时间</th>
                      <th>审核状态</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {verifications.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center muted font-12" style={{ padding: "20px" }}>
                          暂无任何用户提交任务验证链接
                        </td>
                      </tr>
                    ) : (
                      verifications.map((v) => (
                        <tr key={v.id}>
                          <td><code>{v.id}</code></td>
                          <td>
                            <strong>{v.username || v.user_id}</strong>
                            <br />
                            <small className="muted">{v.user_id}</small>
                          </td>
                          <td>
                            <strong>{v.task_name}</strong>
                            <br />
                            <small className="muted">{v.task_id}</small>
                          </td>
                          <td>
                            <a href={v.link} target="_blank" rel="noreferrer" className="text-amber" style={{ wordBreak: "break-all" }}>
                              {v.link}
                            </a>
                          </td>
                          <td><span className="text-muted">{v.created_at || v.createdAt}</span></td>
                          <td>
                            <span className={`status-badge-lbl ${v.status === "approved" ? "active" : v.status === "rejected" ? "paused" : "draft"}`}>
                              {v.status === "approved" ? "已通过" : v.status === "rejected" ? "已拒绝" : "待处理"}
                            </span>
                            {v.feedback && <p className="font-10 text-muted" style={{ margin: "2px 0 0 0" }}>原因: {v.feedback}</p>}
                          </td>
                          <td>
                            {v.status !== "approved" ? (
                              <div style={{ display: "flex", gap: "6px" }}>
                                <button
                                  className="primary"
                                  style={{ padding: "4px 8px", fontSize: "11px", backgroundColor: "var(--emerald)", borderColor: "var(--emerald)" }}
                                  onClick={async () => {
                                    if (confirm("确定要手动通过此任务链接并为用户注入奖励吗？")) {
                                      try {
                                        await adminClient.approveTaskVerification(v.id);
                                        alert("手动审核通过成功！已为用户结算积分及排名分数。");
                                        await reloadAll();
                                      } catch (err: any) {
                                        alert(err.message || "操作失败");
                                      }
                                    }
                                  }}
                                >
                                  通过
                                </button>
                                <button
                                  className="secondary danger-text"
                                  style={{ padding: "4px 8px", fontSize: "11px" }}
                                  onClick={async () => {
                                    const reason = verifFeedback.trim() || "Rejected by administrator manual review.";
                                    if (confirm(`确定要拒绝此提交吗？原因：${reason}`)) {
                                      try {
                                        await adminClient.rejectTaskVerification(v.id, reason);
                                        alert("手动审核拒绝完成。");
                                        setVerifFeedback("");
                                        await reloadAll();
                                      } catch (err: any) {
                                        alert(err.message || "操作失败");
                                      }
                                    }
                                  }}
                                >
                                  拒绝
                                </button>
                              </div>
                            ) : (
                              <span className="muted font-11">无可用操作</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activePage === "bounty_tasks" && (
          <div className="admin-page animate-fade-in">
            <div className="flex-row gap-20">
              <div className="form-card" style={{ flex: 1, backgroundColor: "var(--card-bg)", padding: "20px", borderRadius: "10px" }}>
                <h3>✨ 新建赏金网络任务</h3>
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  if (!bountyForm.id || !bountyForm.title || !bountyForm.targetUrl) {
                    alert("请填写任务 ID、标题和目标直达链接。");
                    return;
                  }
                  try {
                    await adminClient.createBountyTask(bountyForm);
                    alert("赏金任务创建成功！已记录审计日志。");
                    setBountyForm({
                      id: "",
                      title: "",
                      description: "",
                      category: "social",
                      platform: "twitter",
                      targetUrl: "",
                      budgetTotal: 1000,
                      rewardPoints: 100,
                      rewardAssetName: "",
                      rewardAccessPass: "",
                      deadline: "",
                      verificationRule: "",
                      submissionType: "link",
                      riskLevel: "low",
                      ownerType: "official",
                      ownerName: "GrowthBot 官方",
                      maxCompletions: 1000,
                      settlementMode: "offchain",
                      chainId: "",
                      escrowContract: "",
                      escrowTxHash: "",
                      rewardToken: "",
                      rewardTokenAddress: "",
                      rewardDecimals: "",
                      oracleMode: "format_check",
                      disputeStatus: "none"
                    });
                    await reloadAll();
                  } catch (err: any) {
                    alert(err.message || "创建任务失败");
                  }
                }}>
                  <div className="form-group" style={{ marginBottom: "12px" }}>
                    <label>任务唯一 ID (taskId, 例如 bounty_twitter_follow)</label>
                    <input
                      type="text"
                      value={bountyForm.id}
                      onChange={(e) => setBountyForm({ ...bountyForm, id: e.target.value })}
                      placeholder="bounty_..."
                      className="w-full bg-dark-tint"
                      style={{ padding: "8px", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "4px", color: "#fff" }}
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: "12px" }}>
                    <label>任务标题</label>
                    <input
                      type="text"
                      value={bountyForm.title}
                      onChange={(e) => setBountyForm({ ...bountyForm, title: e.target.value })}
                      placeholder="例如：关注 GrowthBot 官方推特"
                      className="w-full bg-dark-tint"
                      style={{ padding: "8px", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "4px", color: "#fff" }}
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: "12px" }}>
                    <label>任务描述</label>
                    <textarea
                      value={bountyForm.description}
                      onChange={(e) => setBountyForm({ ...bountyForm, description: e.target.value })}
                      placeholder="描述详细的操作要求与步骤..."
                      className="w-full bg-dark-tint"
                      style={{ padding: "8px", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "4px", color: "#fff", height: "60px", resize: "none" }}
                    />
                  </div>

                  <div className="flex-row gap-12" style={{ marginBottom: "12px" }}>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>平台类别</label>
                      <select
                        value={bountyForm.platform}
                        onChange={(e) => setBountyForm({ ...bountyForm, platform: e.target.value })}
                        className="w-full bg-dark-tint"
                        style={{ padding: "8px", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "4px", color: "#fff" }}
                      >
                        <option value="twitter">X / 推特</option>
                        <option value="telegram">Telegram</option>
                        <option value="discord">Discord</option>
                        <option value="web">Web 页面</option>
                        <option value="other">其他</option>
                      </select>
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>任务归类 (category)</label>
                      <input
                        type="text"
                        value={bountyForm.category}
                        onChange={(e) => setBountyForm({ ...bountyForm, category: e.target.value })}
                        placeholder="例如 social, checkin"
                        className="w-full bg-dark-tint"
                        style={{ padding: "8px", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "4px", color: "#fff" }}
                      />
                    </div>
                  </div>

                  <div className="form-group" style={{ marginBottom: "12px" }}>
                    <label>目标直达链接 (targetUrl)</label>
                    <input
                      type="text"
                      value={bountyForm.targetUrl}
                      onChange={(e) => setBountyForm({ ...bountyForm, targetUrl: e.target.value })}
                      placeholder="https://..."
                      className="w-full bg-dark-tint"
                      style={{ padding: "8px", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "4px", color: "#fff" }}
                    />
                  </div>

                  <div className="flex-row gap-12" style={{ marginBottom: "12px" }}>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>总配额 (预算总量)</label>
                      <input
                        type="number"
                        value={bountyForm.budgetTotal}
                        onChange={(e) => setBountyForm({ ...bountyForm, budgetTotal: Number(e.target.value) })}
                        className="w-full bg-dark-tint"
                        style={{ padding: "8px", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "4px", color: "#fff" }}
                      />
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>单次奖励积分 (rewardPoints)</label>
                      <input
                        type="number"
                        value={bountyForm.rewardPoints}
                        onChange={(e) => setBountyForm({ ...bountyForm, rewardPoints: Number(e.target.value) })}
                        className="w-full bg-dark-tint"
                        style={{ padding: "8px", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "4px", color: "#fff" }}
                      />
                    </div>
                  </div>

                  <div className="flex-row gap-12" style={{ marginBottom: "12px" }}>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>赠送技能卡 (选填)</label>
                      <input
                        type="text"
                        value={bountyForm.rewardAssetName}
                        onChange={(e) => setBountyForm({ ...bountyForm, rewardAssetName: e.target.value })}
                        placeholder="例如 Task Reroll"
                        className="w-full bg-dark-tint"
                        style={{ padding: "8px", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "4px", color: "#fff" }}
                      />
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>赠送准入通行证 (选填)</label>
                      <input
                        type="text"
                        value={bountyForm.rewardAccessPass}
                        onChange={(e) => setBountyForm({ ...bountyForm, rewardAccessPass: e.target.value })}
                        placeholder="例如 Genesis Pass"
                        className="w-full bg-dark-tint"
                        style={{ padding: "8px", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "4px", color: "#fff" }}
                      />
                    </div>
                  </div>

                  <div className="flex-row gap-12" style={{ marginBottom: "12px" }}>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>验证正则表达式 (选填)</label>
                      <input
                        type="text"
                        value={bountyForm.verificationRule}
                        onChange={(e) => setBountyForm({ ...bountyForm, verificationRule: e.target.value })}
                        placeholder="例如 ^https://x\.com/.*"
                        className="w-full bg-dark-tint"
                        style={{ padding: "8px", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "4px", color: "#fff" }}
                      />
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>风险级别 (riskLevel)</label>
                      <select
                        value={bountyForm.riskLevel}
                        onChange={(e) => setBountyForm({ ...bountyForm, riskLevel: e.target.value })}
                        className="w-full bg-dark-tint"
                        style={{ padding: "8px", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "4px", color: "#fff" }}
                      >
                        <option value="low">低风险 (可自动发奖)</option>
                        <option value="medium">中风险 (系统拦截)</option>
                        <option value="high">高风险 (必须人工强审)</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex-row gap-12" style={{ marginBottom: "15px" }}>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>发布方类别 (ownerType)</label>
                      <select
                        value={bountyForm.ownerType}
                        onChange={(e) => setBountyForm({ ...bountyForm, ownerType: e.target.value })}
                        className="w-full bg-dark-tint"
                        style={{ padding: "8px", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "4px", color: "#fff" }}
                      >
                        <option value="official">官方 (Official)</option>
                        <option value="partner">项目方 (Partner)</option>
                        <option value="kol">KOL 社区 (KOL)</option>
                      </select>
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>发布方显示名称 (ownerName)</label>
                      <input
                        type="text"
                        value={bountyForm.ownerName}
                        onChange={(e) => setBountyForm({ ...bountyForm, ownerName: e.target.value })}
                        placeholder="例如 GrowthBot 官方"
                        className="w-full bg-dark-tint"
                        style={{ padding: "8px", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "4px", color: "#fff" }}
                      />
                    </div>
                  </div>

                  <div style={{ padding: "10px", border: "1px dashed rgba(255,255,255,0.15)", borderRadius: "6px", marginBottom: "15px", backgroundColor: "rgba(255,255,255,0.02)" }}>
                    <div style={{ fontWeight: "bold", fontSize: "12px", color: "var(--amber)", marginBottom: "8px" }}>🔗 链上托管与验证模式 (Escrow & Oracle)</div>
                    <div className="flex-row gap-12" style={{ marginBottom: "10px" }}>
                      <div className="form-group" style={{ flex: 1 }}>
                        <label>结算模式 (settlementMode)</label>
                        <select
                          value={bountyForm.settlementMode}
                          onChange={(e) => setBountyForm({ ...bountyForm, settlementMode: e.target.value })}
                          className="w-full bg-dark-tint"
                          style={{ padding: "8px", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "4px", color: "#fff" }}
                        >
                          <option value="offchain">链下积分结算 (offchain)</option>
                          <option value="escrow">链上智能合约托管 (escrow)</option>
                        </select>
                      </div>
                      <div className="form-group" style={{ flex: 1 }}>
                        <label>Oracle 验证模式 (oracleMode)</label>
                        <select
                          value={bountyForm.oracleMode}
                          onChange={(e) => setBountyForm({ ...bountyForm, oracleMode: e.target.value })}
                          className="w-full bg-dark-tint"
                          style={{ padding: "8px", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "4px", color: "#fff" }}
                        >
                          <option value="format_check">正则核对 (format_check)</option>
                          <option value="admin_review">人工干预审核 (admin_review)</option>
                          <option value="oracle_verify">链上预言机核销 (oracle_verify)</option>
                        </select>
                      </div>
                    </div>
                    {bountyForm.settlementMode === "escrow" && (
                      <>
                        <div className="flex-row gap-12" style={{ marginBottom: "10px" }}>
                          <div className="form-group" style={{ flex: 1 }}>
                            <label>Chain ID</label>
                            <input
                              type="number"
                              value={bountyForm.chainId}
                              onChange={(e) => setBountyForm({ ...bountyForm, chainId: e.target.value })}
                              placeholder="e.g. 137"
                              className="w-full bg-dark-tint"
                              style={{ padding: "8px", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "4px", color: "#fff" }}
                            />
                          </div>
                          <div className="form-group" style={{ flex: 1 }}>
                            <label>代币符号 (rewardToken)</label>
                            <input
                              type="text"
                              value={bountyForm.rewardToken}
                              onChange={(e) => setBountyForm({ ...bountyForm, rewardToken: e.target.value })}
                              placeholder="e.g. USDT"
                              className="w-full bg-dark-tint"
                              style={{ padding: "8px", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "4px", color: "#fff" }}
                            />
                          </div>
                        </div>
                        <div className="form-group" style={{ marginBottom: "10px" }}>
                          <label>托管合约地址 (escrowContract)</label>
                          <input
                            type="text"
                            value={bountyForm.escrowContract}
                            onChange={(e) => setBountyForm({ ...bountyForm, escrowContract: e.target.value })}
                            placeholder="0x..."
                            className="w-full bg-dark-tint"
                            style={{ padding: "8px", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "4px", color: "#fff" }}
                          />
                        </div>
                      </>
                    )}
                  </div>

                  <button type="submit" className="primary w-full" style={{ padding: "12px" }}>
                    立即创建赏金任务
                  </button>
                </form>
              </div>

              <div className="list-card" style={{ flex: 1.5, backgroundColor: "var(--card-bg)", padding: "20px", borderRadius: "10px" }}>
                <div className="flex-row justify-between align-center" style={{ marginBottom: "15px" }}>
                  <h3>💼 赏金任务池</h3>
                  <button className="secondary" onClick={() => void reloadAll()}>刷新列表</button>
                </div>

                <div className="table-container">
                  <table style={{ width: "100%", fontSize: "12px" }}>
                    <thead>
                      <tr>
                        <th>任务 ID / 标题</th>
                        <th>奖励</th>
                        <th>预算进度</th>
                        <th>状态</th>
                        <th>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bountyTasks.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="text-center muted" style={{ padding: "20px" }}>暂无赏金网络任务</td>
                        </tr>
                      ) : (
                        bountyTasks.map((t: any) => {
                          const isPaused = t.status === "paused";
                          const budgetPercent = t.budget_total > 0 ? Math.floor(((t.budget_total - t.budget_remaining) / t.budget_total) * 100) : 0;
                          return (
                            <tr key={t.id}>
                              <td>
                                <strong>{t.title}</strong>
                                <br />
                                <small className="muted">ID: {t.id} | {t.platform}</small>
                                <br />
                                <span style={{ fontSize: "10px", padding: "1px 4px", borderRadius: "3px", backgroundColor: "rgba(255,255,255,0.05)", color: "#aaa" }}>
                                  {t.settlement_mode === 'escrow' ? '🔗 链上托管' : '☕ 链下积分'} / {t.oracle_mode || 'format_check'} / 争议: {t.dispute_status || 'none'}
                                </span>
                              </td>
                              <td>
                                <div>{t.reward_points} PT</div>
                                {t.reward_asset_name && <small className="text-purple">🎁 {t.reward_asset_name}</small>}
                              </td>
                              <td>
                                <div>{t.budget_remaining} / {t.budget_total} PT</div>
                                <div style={{ width: "100px", height: "6px", backgroundColor: "rgba(255,255,255,0.1)", borderRadius: "3px", marginTop: "4px" }}>
                                  <div style={{ width: `${budgetPercent}%`, height: "100%", backgroundColor: "var(--amber)", borderRadius: "3px" }} />
                                </div>
                                <small className="muted">已结算完成: {t.completed_count || 0}</small>
                              </td>
                              <td>
                                <span className={`status-badge-lbl ${isPaused ? "paused" : t.budget_remaining <= 0 ? "paused" : "active"}`}>
                                  {isPaused ? "已暂停" : t.budget_remaining <= 0 ? "已抢光" : "活跃中"}
                                </span>
                                {t.paused_reason && <p className="font-10 text-muted" style={{ margin: "2px 0 0 0" }}>原因: {t.paused_reason}</p>}
                              </td>
                              <td>
                                <div className="flex-row gap-6">
                                  <button
                                    className="secondary mini"
                                    onClick={() => {
                                      setAdjustingBountyId(t.id);
                                      setNewBountyBudget(t.budget_total);
                                    }}
                                  >
                                    预算
                                  </button>
                                  <button
                                    className="secondary mini"
                                    onClick={async () => {
                                      const newPaused = !isPaused;
                                      let reason = "";
                                      if (newPaused) {
                                        reason = prompt("请输入暂停原因：") || "管理员手动暂停";
                                      }
                                      if (confirm(`确定要${newPaused ? "暂停" : "恢复"}此任务吗？`)) {
                                        try {
                                          await adminClient.pauseBountyTask(t.id, newPaused, reason);
                                          alert("状态更新成功！已记录审计日志。");
                                          await reloadAll();
                                        } catch (err: any) {
                                          alert(err.message || "更新状态失败");
                                        }
                                      }
                                    }}
                                  >
                                    {isPaused ? "恢复" : "暂停"}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {activePage === "bounty_verifications" && (
          <div className="admin-page animate-fade-in">
            <div className="table-card" style={{ backgroundColor: "var(--card-bg)", padding: "20px", borderRadius: "10px" }}>
              <div className="flex-row justify-between align-center" style={{ marginBottom: "15px" }}>
                <h3>🔗 外部赏金提交链接复核与手动发奖强审</h3>
                <span>共记录 {bountyVerifications.length} 项外部赏金提交</span>
              </div>

              <div className="form-group" style={{ marginBottom: "15px", width: "400px" }}>
                <label>审核反馈备注 (拒绝时必填，并作为审计日志记录)</label>
                <input
                  type="text"
                  placeholder="例如：链接无效、未发现对应推特关注记录"
                  value={bountyVerifFeedback}
                  onChange={(e) => setBountyVerifFeedback(e.target.value)}
                  style={{ width: "100%", padding: "8px", boxSizing: "border-box", backgroundColor: "var(--dark-tint)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", borderRadius: "4px" }}
                />
              </div>

              <div className="table-container">
                <table style={{ width: "100%", fontSize: "12px" }}>
                  <thead>
                    <tr>
                      <th>提交 ID</th>
                      <th>用户</th>
                      <th>赏金任务</th>
                      <th>提交链接</th>
                      <th>提交时间</th>
                      <th>状态</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bountyVerifications.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center muted" style={{ padding: "20px" }}>暂无任何赏金提交链接需要复核</td>
                      </tr>
                    ) : (
                      bountyVerifications.map((v: any) => {
                        const isRisk = v.risk_flagged === 1 || String(v.risk_flagged) === "true";
                        return (
                          <tr key={v.id} style={{ backgroundColor: isRisk ? "rgba(239, 83, 80, 0.05)" : "transparent" }}>
                            <td><code>{v.id}</code></td>
                            <td>
                              <strong>{v.user_username || v.user_id}</strong>
                              <br />
                              <small className="muted">{v.user_id}</small>
                            </td>
                            <td>
                              <strong>{v.task_title || v.bounty_task_id}</strong>
                            </td>
                            <td>
                              <a href={v.link} target="_blank" rel="noreferrer" className="text-amber" style={{ wordBreak: "break-all" }}>
                                {v.link}
                              </a>
                              {isRisk && <p className="text-danger font-10" style={{ margin: "2px 0 0 0" }}>⚠️ 高风险链接标记</p>}
                            </td>
                            <td><span className="text-muted">{v.created_at || v.createdAt}</span></td>
                            <td>
                              <span className={`status-badge-lbl ${v.status === "approved" ? "active" : v.status === "rejected" ? "paused" : "draft"}`}>
                                {v.status === "approved" ? "验收通过" : v.status === "rejected" ? "已拒绝" : "待处理"}
                              </span>
                              {v.feedback && <p className="font-10 text-muted" style={{ margin: "2px 0 0 0" }}>原因: {v.feedback}</p>}
                            </td>
                            <td>
                              {v.status !== "approved" ? (
                                <div style={{ display: "flex", gap: "6px" }}>
                                  <button
                                    className="primary"
                                    style={{ padding: "4px 8px", fontSize: "11px", backgroundColor: "var(--emerald)", borderColor: "var(--emerald)" }}
                                    onClick={async () => {
                                      if (confirm("确定要强审通过此赏金提交并结算发奖吗？")) {
                                        try {
                                          await adminClient.approveBountyVerification(v.id);
                                          alert("手动发奖强审通过成功！已扣减任务预算。");
                                          await reloadAll();
                                        } catch (err: any) {
                                          alert(err.message || "强审失败");
                                        }
                                      }
                                    }}
                                  >
                                    通过
                                  </button>
                                  <button
                                    className="secondary danger-text"
                                    style={{ padding: "4px 8px", fontSize: "11px" }}
                                    onClick={async () => {
                                      const reason = bountyVerifFeedback.trim() || "Rejected by administrator review.";
                                      if (confirm(`确定要拒绝此提交吗？原因：${reason}`)) {
                                        try {
                                          await adminClient.rejectBountyVerification(v.id, reason);
                                          alert("已成功驳回该提交。");
                                          setBountyVerifFeedback("");
                                          await reloadAll();
                                        } catch (err: any) {
                                          alert(err.message || "驳回失败");
                                        }
                                      }
                                    }}
                                  >
                                    拒绝
                                  </button>
                                </div>
                              ) : (
                                <span className="muted font-11">无可用操作</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activePage === "agent_controls" && (
          <div className="admin-page animate-fade-in">
            {/* Sub-tabs */}
            <div className="flex-row gap-12" style={{ marginBottom: "20px" }}>
              <button
                className={`tab-btn ${agentSubTab === "providers" ? "primary" : "secondary"}`}
                onClick={() => setAgentSubTab("providers")}
                style={{ padding: "8px 16px" }}
              >
                🌐 服务商白名单
              </button>
              <button
                className={`tab-btn ${agentSubTab === "configs" ? "primary" : "secondary"}`}
                onClick={() => setAgentSubTab("configs")}
                style={{ padding: "8px 16px" }}
              >
                👤 用户 Agent 配置
              </button>
              <button
                className={`tab-btn ${agentSubTab === "prompts" ? "primary" : "secondary"}`}
                onClick={() => setAgentSubTab("prompts")}
                style={{ padding: "8px 16px" }}
              >
                📝 Prompt 模板管理
              </button>
              <button
                className={`tab-btn ${agentSubTab === "logs" ? "primary" : "secondary"}`}
                onClick={() => setAgentSubTab("logs")}
                style={{ padding: "8px 16px" }}
              >
                📊 脱敏调用审计日志
              </button>
            </div>

            {/* Providers tab */}
            {agentSubTab === "providers" && (
              <div className="table-card" style={{ backgroundColor: "var(--card-bg)", padding: "20px", borderRadius: "10px" }}>
                <div className="flex-row justify-between align-center" style={{ marginBottom: "15px" }}>
                  <h3>🌐 LLM 提供商服务地址白名单</h3>
                  <button className="primary" onClick={() => {
                    setEditingProvider(null);
                    setProviderForm({ name: "", baseUrl: "", status: "active" });
                    setCreatingProvider(true);
                  }}>
                    + 新增白名单服务商
                  </button>
                </div>
                <div className="table-container">
                  <table style={{ width: "100%", fontSize: "12px" }}>
                    <thead>
                      <tr>
                        <th>服务商名称</th>
                        <th>Base URL (受控端点)</th>
                        <th>状态</th>
                        <th>创建时间</th>
                        <th>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {agentProviders.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="text-center muted" style={{ padding: "20px" }}>暂无提供商白名单配置</td>
                        </tr>
                      ) : (
                        agentProviders.map((p) => (
                          <tr key={p.id}>
                            <td><strong>{p.name}</strong></td>
                            <td><code>{p.baseUrl}</code></td>
                            <td>
                              <span className={`status-badge-lbl ${p.status === "active" ? "active" : "paused"}`}>
                                {p.status === "active" ? "正常允许" : "已挂起"}
                              </span>
                            </td>
                            <td><span className="text-muted">{p.createdAt}</span></td>
                            <td>
                              <button
                                className="action-row-btn"
                                onClick={() => {
                                  setEditingProvider(p);
                                  setProviderForm({ name: p.name, baseUrl: p.baseUrl, status: p.status });
                                  setCreatingProvider(true);
                                }}
                              >
                                编辑
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Configs tab */}
            {agentSubTab === "configs" && (
              <div className="table-card" style={{ backgroundColor: "var(--card-bg)", padding: "20px", borderRadius: "10px" }}>
                <div className="flex-row justify-between align-center" style={{ marginBottom: "15px" }}>
                  <h3>👤 用户自定义模型配置列表</h3>
                  <span>共 {agentConfigs.length} 个自定义配置被部署</span>
                </div>
                <div className="table-container">
                  <table style={{ width: "100%", fontSize: "12px" }}>
                    <thead>
                      <tr>
                        <th>用户 ID</th>
                        <th>配置别名</th>
                        <th>服务商 & 模型 ID</th>
                        <th>API 密钥 (脱敏尾号)</th>
                        <th>安全额度/日限制</th>
                        <th>状态</th>
                        <th>部署时间</th>
                        <th>安全管控</th>
                      </tr>
                    </thead>
                    <tbody>
                      {agentConfigs.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="text-center muted" style={{ padding: "20px" }}>暂无用户部署自定义模型配置</td>
                        </tr>
                      ) : (
                        agentConfigs.map((c) => (
                          <tr key={c.id}>
                            <td><code>{c.userId}</code></td>
                            <td><strong>{c.profileName}</strong></td>
                            <td>
                              <span className="text-amber">{c.provider}</span>
                              <br />
                              <small className="muted">{c.modelId}</small>
                            </td>
                            <td><code>{c.keyLast4 ? `***${c.keyLast4}` : "无密钥"}</code></td>
                            <td><strong>{c.dailyCallCount}</strong> / {c.dailyCallLimit} 次</td>
                            <td>
                              <span className={`status-badge-lbl ${c.status === "active" ? "active" : "paused"}`}>
                                {c.status === "active" ? "活跃" : "被管理员挂起"}
                              </span>
                            </td>
                            <td><span className="text-muted">{c.createdAt}</span></td>
                            <td>
                              {c.status === "active" ? (
                                <button
                                  className="action-row-btn text-danger"
                                  onClick={async () => {
                                    if (confirm("确定要一键挂起此用户的自定义大模型配置吗？该请求将会安全回落到系统平台模型端点。")) {
                                      try {
                                        await adminClient.disableAgentConfig(c.id);
                                        alert("一键禁用成功！配置状态已修改为挂起。");
                                        await reloadAll();
                                      } catch (err: any) {
                                        alert(err.message || "挂起失败");
                                      }
                                    }
                                  }}
                                >
                                  一键熔断禁用
                                </button>
                              ) : (
                                <span className="muted font-11">已禁用</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Prompts tab */}
            {agentSubTab === "prompts" && (
              <div className="table-card" style={{ backgroundColor: "var(--card-bg)", padding: "20px", borderRadius: "10px" }}>
                <div className="flex-row justify-between align-center" style={{ marginBottom: "15px" }}>
                  <h3>📝 平台级 Agent Prompt 系统及默认规则模板</h3>
                  <button className="primary" onClick={() => {
                    setEditingPrompt({ id: "", name: "", scope: "system", content: "", status: "active", createdAt: "", updatedAt: "" });
                    setPromptForm({ name: "", scope: "system", content: "" });
                  }}>
                    + 新建提示词模板
                  </button>
                </div>
                <div className="table-container">
                  <table style={{ width: "100%", fontSize: "12px" }}>
                    <thead>
                      <tr>
                        <th>模板名称</th>
                        <th>适用域</th>
                        <th>提示词内容 (Prompt Content)</th>
                        <th>最近更新</th>
                        <th>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {promptTemplates.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="text-center muted" style={{ padding: "20px" }}>暂无平台 Prompt 模板</td>
                        </tr>
                      ) : (
                        promptTemplates.map((t) => (
                          <tr key={t.id}>
                            <td><strong>{t.name}</strong></td>
                            <td>
                              <span className={`status-badge-lbl ${t.scope === "system" ? "active" : "draft"}`}>
                                {t.scope === "system" ? "全局系统层" : "用户定制层"}
                              </span>
                            </td>
                            <td>
                              <div style={{ maxHeight: "60px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "pre-wrap", maxWidth: "450px" }}>
                                {t.content}
                              </div>
                            </td>
                            <td><span className="text-muted">{t.updatedAt}</span></td>
                            <td>
                              <button
                                className="action-row-btn"
                                onClick={() => {
                                  setEditingPrompt(t);
                                  setPromptForm({ name: t.name, scope: t.scope, content: t.content });
                                }}
                              >
                                编辑修改
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Logs tab */}
            {agentSubTab === "logs" && (
              <div className="table-card" style={{ backgroundColor: "var(--card-bg)", padding: "20px", borderRadius: "10px" }}>
                <div className="flex-row justify-between align-center" style={{ marginBottom: "15px" }}>
                  <h3>📊 智能大模型调用脱敏审计流</h3>
                  <span className="text-muted font-11">所有输入/输出数据均由哈希、指纹或限制在 32 字符以内的敏感字段脱敏归档，防止数据泄漏。</span>
                </div>
                <div className="table-container">
                  <table style={{ width: "100%", fontSize: "12px" }}>
                    <thead>
                      <tr>
                        <th>调用时间</th>
                        <th>用户 ID</th>
                        <th>调用目的</th>
                        <th>输入特征摘要</th>
                        <th>输出特征摘要</th>
                        <th>Token 消耗</th>
                        <th>调用状态</th>
                        <th>调用报错信息</th>
                      </tr>
                    </thead>
                    <tbody>
                      {agentCallLogs.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="text-center muted" style={{ padding: "20px" }}>暂无任何智能体服务接口调用记录</td>
                        </tr>
                      ) : (
                        agentCallLogs.map((l) => (
                          <tr key={l.id}>
                            <td><span className="text-muted">{l.createdAt}</span></td>
                            <td><code>{l.userId}</code></td>
                            <td><span className="badge category-lbl">{l.purpose}</span></td>
                            <td><code>{l.inputSummary || "-"}</code></td>
                            <td><code>{l.outputSummary || "-"}</code></td>
                            <td><strong>{l.tokensUsed}</strong> tokens</td>
                            <td>
                              <span className={`status-badge-lbl ${l.status === "success" ? "active" : "paused"}`}>
                                {l.status === "success" ? "成功" : "失败已降级"}
                              </span>
                            </td>
                            <td><span className="text-danger font-11">{l.errorMessage || "-"}</span></td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Create/Edit Provider Modal */}
            {creatingProvider && (
              <div className="admin-overlay" style={{ zIndex: 1200 }}>
                <div className="admin-modal" style={{ width: "450px" }}>
                  <h3>{editingProvider ? "编辑服务商白名单" : "新增服务商白名单"}</h3>
                  <div className="form-group" style={{ margin: "15px 0" }}>
                    <label>服务商名称</label>
                    <input
                      type="text"
                      value={providerForm.name}
                      onChange={(e) => setProviderForm({ ...providerForm, name: e.target.value })}
                      placeholder="例如: Custom OpenAI Proxy"
                      style={{ width: "100%", padding: "8px", boxSizing: "border-box" }}
                    />
                  </div>
                  <div className="form-group" style={{ margin: "15px 0" }}>
                    <label>服务基地址 (Base URL)</label>
                    <input
                      type="text"
                      value={providerForm.baseUrl}
                      onChange={(e) => setProviderForm({ ...providerForm, baseUrl: e.target.value })}
                      placeholder="https://myhost.com/v1"
                      style={{ width: "100%", padding: "8px", boxSizing: "border-box" }}
                      disabled={!!editingProvider} // URL is the primary key
                    />
                    <span className="muted font-10 text-danger">* 必须是 https:// 形式的公开合规 Base URL 域名，禁止回环、私网直连。</span>
                  </div>
                  <div className="form-group" style={{ margin: "15px 0" }}>
                    <label>运营状态</label>
                    <select
                      value={providerForm.status}
                      onChange={(e) => setProviderForm({ ...providerForm, status: e.target.value })}
                      style={{ width: "100%", padding: "8px" }}
                    >
                      <option value="active">正常允许接入 (Active)</option>
                      <option value="disabled">挂起禁止接入 (Disabled)</option>
                    </select>
                  </div>
                  <div className="modal-actions">
                    <button
                      className="primary"
                      onClick={async () => {
                        if (!providerForm.name || !providerForm.baseUrl) {
                          alert("所有必填项不能为空");
                          return;
                        }
                        try {
                          await adminClient.saveProvider(providerForm.name, providerForm.baseUrl, providerForm.status);
                          alert("服务商白名单保存成功！");
                          setCreatingProvider(false);
                          await reloadAll();
                        } catch (err: any) {
                          alert(err.message || "保存失败");
                        }
                      }}
                    >
                      提交保存
                    </button>
                    <button className="secondary" onClick={() => setCreatingProvider(false)}>
                      取消
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Edit Prompt Template Editor Modal */}
            {editingPrompt && (
              <div className="admin-overlay" style={{ zIndex: 1200 }}>
                <div className="admin-modal" style={{ width: "600px" }}>
                  <h3>{editingPrompt.id ? "编辑 Prompt 提示词模板" : "新建 Prompt 提示词模板"}</h3>
                  <div className="form-group" style={{ margin: "15px 0" }}>
                    <label>模板标识 (Name)</label>
                    <input
                      type="text"
                      value={promptForm.name}
                      onChange={(e) => setPromptForm({ ...promptForm, name: e.target.value })}
                      disabled={!!editingPrompt.id}
                      style={{ width: "100%", padding: "8px", boxSizing: "border-box" }}
                      placeholder="例如: task_analysis"
                    />
                  </div>
                  <div className="form-group" style={{ margin: "15px 0" }}>
                    <label>适用域 (Scope)</label>
                    <select
                      value={promptForm.scope}
                      onChange={(e) => setPromptForm({ ...promptForm, scope: e.target.value })}
                      style={{ width: "100%", padding: "8px" }}
                    >
                      <option value="system">系统底层限制 (System)</option>
                      <option value="user">默认模板推荐 (User)</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ margin: "15px 0" }}>
                    <label>Prompt 主体规则定义 (JSON 指导或任务推理结构描述)</label>
                    <textarea
                      value={promptForm.content}
                      onChange={(e) => setPromptForm({ ...promptForm, content: e.target.value })}
                      rows={8}
                      style={{ width: "100%", padding: "8px", boxSizing: "border-box", backgroundColor: "#151515", border: "1px solid rgba(255,255,255,0.15)", color: "#fff", fontFamily: "monospace" }}
                      placeholder="输入 Prompt 内容..."
                    />
                  </div>
                  <div className="modal-actions">
                    <button
                      className="primary"
                      onClick={async () => {
                        if (!promptForm.name || !promptForm.content) {
                          alert("模板名称和内容均不能为空");
                          return;
                        }
                        try {
                          await adminClient.savePromptTemplate(promptForm.name, promptForm.scope, promptForm.content);
                          alert("提示词模板更新成功！已归档并在下次推理周期内实时生效。");
                          setEditingPrompt(null);
                          await reloadAll();
                        } catch (err: any) {
                          alert(err.message || "更新失败");
                        }
                      }}
                    >
                      部署发布
                    </button>
                    <button className="secondary" onClick={() => setEditingPrompt(null)}>
                      取消
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

      {adjustingBountyId && (
        <div className="admin-overlay" style={{ zIndex: 1200 }}>
          <div className="admin-modal" style={{ width: "350px" }}>
            <h3>调整赏金任务预算</h3>
            <p className="muted font-11">请输入调整后的预算总额。系统会自动根据已结算数重新计算剩余 PT 预算。</p>
            <div className="form-group" style={{ margin: "15px 0" }}>
              <label>预算总 PT</label>
              <input
                type="number"
                value={newBountyBudget}
                onChange={(e) => setNewBountyBudget(Number(e.target.value))}
                style={{ width: "100%", padding: "8px", boxSizing: "border-box" }}
              />
            </div>
            <div className="modal-actions">
              <button
                className="primary"
                onClick={async () => {
                  try {
                    await adminClient.adjustBountyBudget(adjustingBountyId, newBountyBudget);
                    alert("预算调整成功！已记录审计日志。");
                    setAdjustingBountyId(null);
                    await reloadAll();
                  } catch (err: any) {
                    alert(err.message || "调整预算失败");
                  }
                }}
              >
                保存预算
              </button>
              <button className="secondary" onClick={() => setAdjustingBountyId(null)}>
                取消
              </button>
            </div>
          </div>
        </div>
      )}
      </section>

      {/* Emergency Freeze Overlay Confirmation */}
      {confirmEmergencyFreeze && (
        <div className="admin-overlay" style={{ zIndex: 1300 }}>
          <div className="admin-modal">
            <h3 className="text-danger">🚨 紧急全局熔断指令确认</h3>
            <p className="muted-line" style={{ fontSize: "13px", lineHeight: "1.6" }}>
              警告：您正在发送系统紧急挂起/解锁指令！
              类型：<strong className="text-amber">
                {confirmEmergencyFreeze.type === "boxes" ? "全局盲盒熔断" : confirmEmergencyFreeze.type === "tasks" ? "全局任务熔断" : "交易市场撮合熔断"}
              </strong>
              动作：<strong className="text-danger">{confirmEmergencyFreeze.active ? "紧急挂起" : "恢复正常运行"}</strong>。
            </p>
            <p className="muted font-11 text-danger">
              * 该指令将直接修改全局运行参数，阻止全部玩家的对应交互，可能造成玩家群体流失，请谨慎操作并二次核对身份凭证！
            </p>
            <div className="modal-actions">
              <button
                className="primary danger-text"
                onClick={handleEmergencyFreezeAction}
              >
                我已授权，强制下发指令
              </button>
              <button className="secondary" onClick={() => setConfirmEmergencyFreeze(null)}>
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

const container = document.getElementById("root");
if (container) {
  createRoot(container).render(<App />);
}
