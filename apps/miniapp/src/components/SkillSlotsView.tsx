import React, { useState, useEffect } from "react";
import { Lock, Unlock, Sparkles, Shield, RefreshCw, AlertTriangle, BookOpen, CheckCircle2, X, ChevronRight } from "lucide-react";
import type { Agent, InventoryItem } from "@growthbot/shared";
import { apiClient } from "../apiClient";
import { telegramAdapter } from "../telegramAdapter";
import { translateRarity } from "../i18n";

interface SkillSlotsViewProps {
  agent: Agent;
  inventory: InventoryItem[];
  onLearnSkill: (inventoryItemId: string, protectionInventoryItemId?: string, protectedLearnedSkillId?: string) => Promise<any>;
  onLockSkill: (learnedSkillId: string) => Promise<void>;
  onUnlockSkill: (learnedSkillId: string) => Promise<void>;
  onRefreshData: () => Promise<void>;
  t: (key: string, fallback: string) => string;
}

interface LearnedSkill {
  id: string;
  skillDefinitionId: string;
  skillCode: string;
  skillName: string;
  skillTier: string;
  skillCategory: string;
  skillDescription: string | null;
  slotIndex: number;
  locked: boolean;
  status: string;
}

interface SkillSlots {
  total: number;
  used: number;
  free: number;
}

interface SkillEvent {
  id: string;
  eventType: string;
  skillDefinitionId: string | null;
  slotIndex: number | null;
  createdAt: string;
}

export function SkillSlotsView({ agent, inventory, onLearnSkill, onLockSkill, onUnlockSkill, onRefreshData, t }: SkillSlotsViewProps) {
  const [skills, setSkills] = useState<LearnedSkill[]>([]);
  const [slots, setSlots] = useState<SkillSlots>({ total: 4, used: 0, free: 4 });
  const [events, setEvents] = useState<SkillEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [showLearnModal, setShowLearnModal] = useState(false);
  const [showReplaceModal, setShowReplaceModal] = useState(false);
  const [selectedCard, setSelectedCard] = useState<InventoryItem | null>(null);
  const [tokenItems, setTokenItems] = useState<InventoryItem[]>([]);
  const [selectedToken, setSelectedToken] = useState<string | null>(null);
  const [learnResult, setLearnResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState(false);
  const [definitions, setDefinitions] = useState<any[]>([]);
  const [runtimeStatusMap, setRuntimeStatusMap] = useState<Record<string, string>>({});

  const skillCards = inventory.filter(i => i.type === "skill_card" && i.status === "available");
  const protectionTokens = inventory.filter(i => i.name === "Skill Protection Token" && i.status === "available");

  const fetchSkills = async () => {
    if (!agent) return;
    setLoading(true);
    try {
      const [res, evtRes, defRes, runtimeRes] = await Promise.all([
        apiClient.getAgentSkills(agent.id),
        apiClient.getSkillEvents(agent.id),
        apiClient.getSkillDefinitions().catch(() => ({ definitions: [] })),
        apiClient.getSkillRuntimeStatus().catch(() => ({ skills: [] })),
      ]);
      if (res) {
        setSkills(res.skills || []);
        setSlots(res.slots || { total: 4, used: 0, free: 4 });
      }
      if (evtRes) setEvents(evtRes.events || []);
      if (defRes) setDefinitions(defRes.definitions || []);
      if (runtimeRes && runtimeRes.skills) {
        const rMap: Record<string, string> = {};
        for (const s of runtimeRes.skills) {
          rMap[s.skillDefinitionId] = s.runtimeStatus;
        }
        setRuntimeStatusMap(rMap);
      }
    } catch (err) {
      console.error("Failed to load skills", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSkills();
  }, [agent]);

  const openLearnModal = () => {
    if (skillCards.length === 0) {
      telegramAdapter.showAlert(t("skills.noCards", "No skill cards available in inventory."));
      return;
    }
    setSelectedCard(null);
    setSelectedToken(null);
    setError(null);
    setLearnResult(null);
    setShowLearnModal(true);
  };

  const handleLearnConfirm = async () => {
    if (!selectedCard) return;
    setLoadingAction(true);
    setError(null);
    try {
      telegramAdapter.hapticImpact("medium");
      const result = await onLearnSkill(selectedCard.id, selectedToken || undefined, undefined);
      setLearnResult(result);
      if (result && result.result) {
        setLearnResult(result.result);
        if (result.result.replacedSkill) {
          telegramAdapter.showAlert(t("skills.replaceSuccess", "Skill replaced!"));
        } else {
          telegramAdapter.showAlert(t("skills.learnSuccess", "Skill learned!"));
        }
      }
      await fetchSkills();
      await onRefreshData();
    } catch (err: any) {
      const msg = err.message || "Failed to learn skill";
      setError(msg);
      telegramAdapter.showAlert(msg);
    } finally {
      setLoadingAction(false);
    }
  };

  const handleLockToggle = async (skill: LearnedSkill) => {
    try {
      telegramAdapter.hapticImpact("medium");
      if (skill.locked) {
        await onUnlockSkill(skill.id);
        telegramAdapter.showAlert(t("skills.unlocked", "Skill unlocked."));
      } else {
        await onLockSkill(skill.id);
        telegramAdapter.showAlert(t("skills.locked", "Skill locked."));
      }
      await fetchSkills();
    } catch (err: any) {
      telegramAdapter.showAlert(err.message || "Lock operation failed.");
    }
  };

  const closeModals = () => {
    setShowLearnModal(false);
    setShowReplaceModal(false);
    setSelectedCard(null);
    setSelectedToken(null);
    setError(null);
    setLearnResult(null);
  };

  const tierLabel = (tier: string): string => {
    switch (tier) {
      case "normal": return t("skills.normal", "Normal");
      case "advanced": return t("skills.advanced", "Advanced");
      case "expert": return t("skills.expert", "Expert");
      default: return tier;
    }
  };

  const categoryLabel = (cat: string): string => {
    const labels: Record<string, string> = { research: "R", content: "C", social: "S", verification: "V", onchain: "O" };
    return labels[cat] || cat;
  };

  if (!agent) {
    return (
      <div className="view-panel text-center" style={{ padding: "40px" }}>
        <p className="muted">{t("skills.noAgent", "Claim an Agent first")}</p>
      </div>
    );
  }

  return (
    <div className="view-panel skill-slots-view animate-fade-in" style={{ paddingBottom: "80px" }}>
      {/* Header */}
      <div className="section-header">
        <h2>{t("skills.title", "Agent Skills")}</h2>
        <p className="muted font-12">{t("skills.subtitle", "Skills boost your Agent's capabilities. Once learned, they cannot be removed for free.")}</p>
      </div>

      {/* Slot status */}
      <div className="skill-slot-status" style={{ display: "flex", gap: "12px", margin: "12px 0" }}>
        <div className="stat-chip" style={{ background: "var(--card-bg)", padding: "8px 12px", borderRadius: "8px", flex: 1 }}>
          <strong className="font-20">{slots.used}/{slots.total}</strong>
          <span className="muted font-10">{t("skills.slotsUsed", "Slots Used")}</span>
        </div>
        <div className="stat-chip" style={{ background: "var(--card-bg)", padding: "8px 12px", borderRadius: "8px", flex: 1 }}>
          <strong className="font-20">{slots.free}</strong>
          <span className="muted font-10">{t("skills.slotsFree", "Free Slots")}</span>
        </div>
      </div>

      {/* Slot grid */}
      <div className="skill-grid" style={{ display: "flex", flexDirection: "column", gap: "8px", margin: "16px 0" }}>
        {Array.from({ length: slots.total }).map((_, idx) => {
          const skill = skills.find(s => s.slotIndex === idx);
          return (
            <div key={idx} className={`skill-slot-card ${skill ? "filled" : "empty"}`}
              style={{
                background: "var(--card-bg)", padding: "12px", borderRadius: "8px",
                border: skill ? "1px solid var(--primary)" : "1px dashed var(--border)"
              }}>
              <div className="flex-row align-center justify-between" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div className="flex-row align-center gap-6" style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                  <span className="font-10 muted">Slot {idx + 1}</span>
                  {skill && (
                    <>
                      <span className={`tier-badge ${skill.skillTier}`}>{tierLabel(skill.skillTier)}</span>
                      <span className="category-badge">{categoryLabel(skill.skillCategory)}</span>
                      <span style={{
                        fontSize: "9px",
                        padding: "2px 6px",
                        borderRadius: "4px",
                        background: (runtimeStatusMap[skill.skillDefinitionId] || "planned") === "active" ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.05)",
                        color: (runtimeStatusMap[skill.skillDefinitionId] || "planned") === "active" ? "#10b981" : "#8e8e93",
                        marginLeft: "6px",
                        fontWeight: "500"
                      }}>
                        {(runtimeStatusMap[skill.skillDefinitionId] || "planned") === "active" ? "Active" : "Planned"}
                      </span>
                    </>
                  )}
                </div>
                {skill && (
                  <button onClick={() => handleLockToggle(skill)} className="icon-btn" title={skill.locked ? "Unlock" : "Lock"}>
                    {skill.locked ? <Lock size={14} className="text-amber" /> : <Unlock size={14} className="muted" />}
                  </button>
                )}
              </div>
              {skill ? (
                <div style={{ marginTop: "4px" }}>
                  <strong className="font-13">{skill.skillName}</strong>
                  {skill.locked && <span className="locked-badge" style={{ fontSize: "10px", color: "var(--amber)", marginLeft: "6px" }}>{t("skills.locked", "Locked")}</span>}
                  {skill.skillDescription && <p className="muted font-11" style={{ margin: "2px 0 0" }}>{skill.skillDescription}</p>}
                </div>
              ) : (
                <p className="muted font-11" style={{ marginTop: "4px" }}>{t("skills.emptySlot", "Empty slot")}</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Learn button */}
      <button className="primary action-btn full-width" onClick={openLearnModal} style={{ marginTop: "8px" }}>
        <BookOpen size={16} /> {t("skills.learnSkill", "Learn Skill from Card")}
      </button>

      {skills.length >= slots.total && (
        <div className="warning-card" style={{ marginTop: "8px", padding: "8px 12px", background: "rgba(255,200,0,0.1)", borderRadius: "8px" }}>
          <AlertTriangle size={14} className="text-amber" />
          <span className="font-11" style={{ marginLeft: "6px" }}>{t("skills.slotsFullWarning", "Slots full! New skills will randomly replace an unlocked skill.")}</span>
        </div>
      )}

      {/* Actions info */}
      <div className="info-section" style={{ marginTop: "16px", padding: "12px", background: "var(--card-bg)", borderRadius: "8px" }}>
        <h4 className="font-12" style={{ marginBottom: "8px" }}>{t("skills.rules", "Skill Rules")}</h4>
        <ul className="font-11 muted" style={{ paddingLeft: "16px", margin: 0, display: "flex", flexDirection: "column", gap: "4px" }}>
          <li>{t("skills.rule1", "Skills are permanently bound to your Agent once learned.")}</li>
          <li>{t("skills.rule2", "When slots are full, new skills randomly replace an unlocked skill.")}</li>
          <li>{t("skills.rule3", "Locked skills cannot be replaced. You can lock 1 skill for free.")}</li>
          <li>{t("skills.rule4", "Replaced skills do not return to inventory.")}</li>
          <li>{t("skills.rule5", "Core modules (Task Scanner, Planner, etc.) are always active and do not use slots.")}</li>
        </ul>
      </div>

      {/* Events log */}
      {events.length > 0 && (
        <div className="events-section" style={{ marginTop: "16px" }}>
          <h4 className="font-12">{t("skills.recentEvents", "Recent Events")}</h4>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "8px", maxHeight: "120px", overflowY: "auto" }}>
            {events.slice(0, 10).map(ev => (
              <div key={ev.id} className="font-11" style={{ borderLeft: "2px solid var(--primary)", paddingLeft: "8px" }}>
                <span className="muted font-9">{new Date(ev.createdAt).toLocaleTimeString()}</span>
                <strong> {ev.eventType}</strong>
                {ev.slotIndex !== null && <span className="muted"> slot {ev.slotIndex}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Learn/Replace Modal */}
      {(showLearnModal || showReplaceModal) && (
        <div className="modal-backdrop active-modal" onClick={closeModals}>
          <div className="modal-content text-left" onClick={(e) => e.stopPropagation()} style={{ maxHeight: "85vh", overflowY: "auto" }}>
            <div className="modal-header" style={{ display: "flex", justifyContent: "space-between" }}>
              <h3>{learnResult ? t("skills.result", "Result") : t("skills.learnSkill", "Learn Skill")}</h3>
              <button className="close-btn" onClick={closeModals}><X size={18} /></button>
            </div>

            {learnResult ? (
              /* Result view */
              <div style={{ padding: "16px 0" }}>
                <div className="success-card" style={{ padding: "12px", background: "rgba(0,200,100,0.1)", borderRadius: "8px", marginBottom: "12px" }}>
                  <CheckCircle2 size={24} className="text-emerald" />
                  <h4 style={{ margin: "8px 0" }}>
                    {learnResult.replacedSkill
                      ? t("skills.replaceComplete", "Skill Replaced")
                      : t("skills.learnComplete", "Skill Learned")}
                  </h4>
                  {learnResult.learnedSkill && (
                    <p className="font-12"><strong>{learnResult.learnedSkill.skillName}</strong> ({tierLabel(learnResult.learnedSkill.skillTier)})</p>
                  )}
                  {learnResult.replacedSkill && (
                    <p className="font-12 muted">{t("skills.replacedSkill", "Replaced")}: <span className="text-danger">{learnResult.replacedSkill.skillName}</span></p>
                  )}
                  <p className="font-11 muted">{t("skills.slotUsed", "Slot")}: {learnResult.skillSlotUsed + 1}</p>
                  {learnResult.consumedProtectionToken && <p className="font-11 text-amber">{t("skills.protectionUsed", "Protection Token consumed.")}</p>}
                </div>
                <button className="secondary full-width" onClick={closeModals}>{t("skills.close", "Close")}</button>
              </div>
            ) : (
              /* Selection view */
              <div style={{ padding: "16px 0" }}>
                {skills.length >= slots.total && (
                  <div className="warning-card" style={{ padding: "8px 12px", background: "rgba(255,200,0,0.1)", borderRadius: "8px", marginBottom: "12px" }}>
                    <AlertTriangle size={14} className="text-amber" />
                    <span className="font-11">{t("skills.slotsFullReplace", "Slots full! An unlocked skill will be randomly replaced.")}</span>
                  </div>
                )}

                <label className="font-12">{t("skills.selectCard", "Select Skill Card")}</label>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", margin: "8px 0" }}>
                  {skillCards.length === 0 && <p className="muted font-11">{t("skills.noCards", "No skill cards available.")}</p>}
                  {skillCards.map(card => (
                    <div key={card.id}
                      className={`selectable-card ${selectedCard?.id === card.id ? "selected" : ""}`}
                      onClick={() => setSelectedCard(card)}
                      style={{
                        padding: "8px 12px", borderRadius: "6px", cursor: "pointer",
                        background: selectedCard?.id === card.id ? "rgba(0,150,255,0.15)" : "var(--card-bg)",
                        border: selectedCard?.id === card.id ? "1px solid var(--primary)" : "1px solid var(--border)"
                      }}>
                      <strong className="font-12">{card.name}</strong>
                      <span className="muted font-10">{card.rarity}</span>
                    </div>
                  ))}
                </div>

                {protectionTokens.length > 0 && (
                  <>
                    <label className="font-12" style={{ marginTop: "12px", display: "block" }}>{t("skills.protectionToken", "Protection Token (optional)")}</label>
                    <p className="font-10 muted">{t("skills.protectionDesc", "Protects one additional unlocked skill from replacement.")}</p>
                    <div style={{ display: "flex", gap: "6px", margin: "8px 0", flexWrap: "wrap" }}>
                      {protectionTokens.map(token => (
                        <div key={token.id}
                          className={`selectable-card ${selectedToken === token.id ? "selected" : ""}`}
                          onClick={() => setSelectedToken(token.id)}
                          style={{
                            padding: "6px 10px", borderRadius: "6px", cursor: "pointer",
                            background: selectedToken === token.id ? "rgba(255,200,0,0.15)" : "var(--card-bg)",
                            border: selectedToken === token.id ? "1px solid var(--amber)" : "1px solid var(--border)"
                          }}>
                          <Shield size={12} /> <span className="font-11">{t("skills.token", "Token")}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {error && <p className="text-danger font-11" style={{ margin: "8px 0" }}>{error}</p>}

                <button className="primary full-width" onClick={handleLearnConfirm} disabled={!selectedCard || loadingAction} style={{ marginTop: "12px" }}>
                  {loadingAction ? t("skills.learning", "Learning...") : t("skills.confirmLearn", "Learn Skill")}
                </button>
                <p className="font-10 muted" style={{ marginTop: "8px", textAlign: "center" }}>
                  {t("skills.irreversible", "Skill learning is irreversible. You cannot get the card back.")}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
