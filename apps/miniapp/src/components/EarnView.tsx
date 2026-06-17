import React from "react";
import { Zap, Award, ShieldAlert, KeyRound, Clock, Pickaxe, HelpCircle, Lock } from "lucide-react";
import type { Task, Agent, InventoryItem } from "@growthbot/shared";
import { telegramAdapter } from "../telegramAdapter";
import { translateAssetName, translateProjectName, translateTaskName } from "../i18n";

interface EarnViewProps {
  tasks: Task[];
  agent: Agent | null;
  inventory: InventoryItem[];
  onExecuteTask: (taskId: string, abilityItemId?: string) => Promise<void>;
  onConnectWallet: () => void;
  hasWallet: boolean;
  t: (key: string, fallback: string) => string;
}

export function EarnView({ tasks, agent, inventory, onExecuteTask, onConnectWallet, hasWallet, t }: EarnViewProps) {
  const handleTaskExecute = async (task: Task) => {
    if (!agent) return;
    telegramAdapter.hapticImpact("medium");

    // 1. Energy Check
    if (agent.energy < task.energyCost) {
      telegramAdapter.showAlert(t("earn.alertNoEnergy", "能量不足！补能或打开启动盒后继续。"));
      return;
    }

    // 2. Wallet Check
    if (task.requiresWallet && !hasWallet) {
      telegramAdapter.showAlert(t("earn.alertWallet", "该任务需要隔离 Agent Wallet。请使用下方开启入口。"));
      return;
    }

    // 3. Ability Check
    let matchingAbilityId: string | undefined;
    if (task.requiredAbility) {
      const matchingAbility = inventory.find(
        (i) => i.type === "ability" && i.name.toLowerCase().includes(task.requiredAbility!.toLowerCase()) && i.status === "available"
      );
      if (!matchingAbility) {
        telegramAdapter.showAlert(`${t("earn.alertAbility", "该任务需要指定技能。请去市场或开盒获取。")} ${translateAssetName(t, task.requiredAbility)}`);
        return;
      }
      matchingAbilityId = matchingAbility.id;
    }

    try {
      await onExecuteTask(task.id, matchingAbilityId);
    } catch (err: any) {
      telegramAdapter.showAlert(err.message || t("earn.failed", "任务执行失败。"));
    }
  };

  if (tasks.length === 0) {
    return (
      <div className="view-panel earn-view text-center pad-40 animate-fade-in">
        <HelpCircle size={40} className="muted" style={{ margin: "0 auto 12px" }} />
        <h3>{t("earn.empty", "当前没有可用任务")}</h3>
        <p className="muted font-12" style={{ marginTop: "4px" }}>
          {t("earn.emptyDesc", "任务已清空，稍后再来看看新的活动。")}
        </p>
      </div>
    );
  }

  return (
    <div className="view-panel earn-view animate-fade-in">
      <div className="view-header">
        <h2>{t("earn.title", "任务")}</h2>
        <p className="muted font-12">{t("earn.desc", "指挥 Agent 执行任务并获得待结算积分。")}</p>
      </div>

      {/* Wallet Onboarding Upgrade Strip (Non-blocking) */}
      {!hasWallet && (
        <div className="wallet-onboarding-banner">
          <KeyRound size={20} className="text-amber" />
          <div className="banner-details">
            <strong>{t("earn.walletTitle", "Agentic Wallet 升级")}</strong>
            <span>{t("earn.walletDesc", "准备隔离、需用户授权的钱包任务入口。")}</span>
          </div>
          <button className="wallet-btn mini" onClick={onConnectWallet}>
            {t("earn.unlock", "开启")}
          </button>
        </div>
      )}

      {/* Task List */}
      <div className="tasks-list">
        {tasks.map((task) => {
          const requiresAbility = !!task.requiredAbility;
          const userHasAbility = !requiresAbility || inventory.some(
            (i) => i.type === "ability" && i.name.toLowerCase().includes(task.requiredAbility!.toLowerCase()) && i.status === "available"
          );
          const walletBlocked = task.requiresWallet && !hasWallet;
          const abilityBlocked = requiresAbility && !userHasAbility;
          const energyBlocked = agent ? agent.energy < task.energyCost : true;
          
          const isBlocked = walletBlocked || abilityBlocked || energyBlocked;

          return (
            <article className={`task-card ${isBlocked ? "locked" : ""}`} key={task.id}>
              <div className="task-header-row">
                <h3 className="flex-center gap-6">
                  {isBlocked && <Lock size={13} className="text-muted" />}
                  {translateTaskName(t, task.name)}
                </h3>
                {task.projectName && <span className="project-badge">{translateProjectName(t, task.projectName)}</span>}
              </div>

              <div className="task-meta-row">
                <div className="meta-item text-amber font-12 font-bold">
                  <Award size={14} /> +{task.basePendingPoints} {t("earn.points", "积分")}
                </div>
                <div className="meta-item text-emerald font-12 font-bold">
                  <Zap size={14} /> {task.energyCost} {t("earn.energy", "能量")}
                </div>
                {task.endsAt && (
                  <div className="meta-item muted font-11">
                    <Clock size={12} /> {t("earn.expiring", "即将结束")}
                  </div>
                )}
              </div>

              {/* Requirement Warnings */}
              {walletBlocked && (
                <div className="requirement-warning text-amber">
                  <ShieldAlert size={14} /> {t("earn.walletRequired", "需要隔离钱包连接以获得分配权重。")}
                </div>
              )}

              {abilityBlocked && (
                <div className="requirement-warning text-purple">
                  <ShieldAlert size={14} /> {t("earn.requiresAbility", "需要技能")}: {translateAssetName(t, task.requiredAbility)}
                </div>
              )}

              {energyBlocked && !walletBlocked && !abilityBlocked && (
                <div className="requirement-warning text-danger">
                  <Zap size={14} /> {t("earn.noEnergy", "能量不足")} ({agent ? agent.energy : 0}/{task.energyCost}).
                </div>
              )}

              <div className="task-actions">
                <button
                  className={isBlocked ? "secondary disabled" : "primary"}
                  onClick={() => handleTaskExecute(task)}
                >
                  {isBlocked ? (
                    <Lock size={14} style={{ marginRight: "4px" }} />
                  ) : (
                    <Pickaxe size={14} style={{ marginRight: "4px" }} />
                  )}
                  {isBlocked ? t("earn.locked", "已锁定") : t("earn.queue", "运行任务")}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
