import React, { useState, useEffect } from "react";
import { X, Sparkles, Key, Shield, AlertTriangle, Layers, Save, Trash2, CheckCircle2 } from "lucide-react";
import { apiClient } from "../apiClient";
import { telegramAdapter } from "../telegramAdapter";

interface AgentStudioViewProps {
  onClose: () => void;
  t: (key: string, fallback: string) => string;
}

const PROVIDERS = [
  { name: "OpenAI", url: "https://api.openai.com", models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"] },
  { name: "Anthropic", url: "https://api.anthropic.com", models: ["claude-3-5-sonnet-20240620", "claude-3-haiku-20240307"] },
  { name: "DeepSeek", url: "https://api.deepseek.com", models: ["deepseek-chat", "deepseek-coder"] },
  { name: "Groq", url: "https://api.groq.com", models: ["llama3-8b-8192", "llama3-70b-8192", "mixtral-8x7b-32768"] },
  { name: "Aliyuncs DashScope", url: "https://dashscope.aliyuncs.com", models: ["qwen-max", "qwen-plus", "qwen-turbo"] },
  { name: "OpenRouter", url: "https://openrouter.ai", models: ["meta-llama/llama-3.1-70b-instruct", "google/gemini-flash-1.5"] }
];

export function AgentStudioView({ onClose, t }: AgentStudioViewProps) {
  const [useCustomModel, setUseCustomModel] = useState(false);
  const [profileName, setProfileName] = useState("GrowthBot Agent #1");
  const [selectedProvider, setSelectedProvider] = useState("OpenAI");
  const [baseUrl, setBaseUrl] = useState("https://api.openai.com");
  const [modelId, setModelId] = useState("gpt-4o-mini");
  const [apiKey, setApiKey] = useState("");
  const [promptTemplate, setPromptTemplate] = useState(
    "You are an AI Assistant analyzing a task for GrowthBot. Determine steps, check for requirements/rules, and assess risk. Answer only in JSON."
  );
  const [taskPreferences, setTaskPreferences] = useState("social");
  const [riskPreferences, setRiskPreferences] = useState("low");
  const [dailyCallLimit, setDailyCallLimit] = useState(100);
  const [keyLast4, setKeyLast4] = useState<string | null>(null);
  
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [configId, setConfigId] = useState<string | null>(null);

  // Load config on mount
  useEffect(() => {
    async function loadConfig() {
      try {
        const res = await apiClient.getModelConfig();
        if (res && res.config) {
          const cfg = res.config;
          setConfigId(cfg.id);
          setProfileName(cfg.profileName || "GrowthBot Agent #1");
          setSelectedProvider(cfg.provider || "OpenAI");
          setBaseUrl(cfg.baseUrl || "https://api.openai.com");
          setModelId(cfg.modelId || "gpt-4o-mini");
          setPromptTemplate(cfg.promptTemplate || "");
          setTaskPreferences(cfg.taskPreferencesJson || "social");
          setRiskPreferences(cfg.riskPreferencesJson || "low");
          setDailyCallLimit(cfg.dailyCallLimit || 100);
          setKeyLast4(cfg.keyLast4 || null);
          setUseCustomModel(cfg.status === "active");
        }
      } catch (e) {
        console.error("Failed to load model config", e);
      } finally {
        setLoaded(true);
      }
    }
    loadConfig();
  }, []);

  // Update URL and default model when provider changes
  const handleProviderChange = (provName: string) => {
    setSelectedProvider(provName);
    const p = PROVIDERS.find(x => x.name === provName);
    if (p) {
      setBaseUrl(p.url);
      setModelId(p.models[0] || "");
    }
  };

  const handleSave = async () => {
    telegramAdapter.hapticImpact("medium");
    setSaving(true);
    try {
      if (useCustomModel) {
        const payload: any = {
          id: configId,
          profileName,
          provider: selectedProvider,
          baseUrl,
          modelId,
          promptTemplate,
          taskPreferencesJson: taskPreferences,
          riskPreferencesJson: riskPreferences,
          dailyCallLimit: Number(dailyCallLimit),
          isDefault: true
        };
        if (apiKey) {
          payload.apiKey = apiKey;
        }
        
        const res = await apiClient.saveModelConfig(payload);
        if (res.success) {
          setConfigId(res.id);
          setApiKey(""); // Clear input
          // Reload config to refresh last4
          const ref = await apiClient.getModelConfig();
          if (ref.config) {
            setKeyLast4(ref.config.keyLast4);
          }
          telegramAdapter.showAlert("配置已成功保存！");
        }
      } else {
        // If they want to use platform model, we delete custom config
        await apiClient.deleteModelConfig();
        setConfigId(null);
        setKeyLast4(null);
        telegramAdapter.showAlert("已切换回平台默认模型。");
      }
    } catch (e: any) {
      telegramAdapter.showAlert(e.message || "保存配置失败，请检查 Base URL 白名单。");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    telegramAdapter.hapticImpact("heavy");
    if (!window.confirm("确定要删除您的自定义 Agent 配置吗？")) return;
    
    setSaving(true);
    try {
      await apiClient.deleteModelConfig();
      setConfigId(null);
      setKeyLast4(null);
      setApiKey("");
      setUseCustomModel(false);
      telegramAdapter.showAlert("自定义模型配置已删除。");
    } catch (e: any) {
      telegramAdapter.showAlert(e.message || "删除失败");
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) {
    return (
      <div className="glass-modal-overlay">
        <div className="glass-modal-panel text-center">
          <p className="muted">正在加载 Agent Studio...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-modal-overlay animate-fade-in">
      <div className="glass-modal-panel studio-panel animate-pop-in">
        <div className="studio-header">
          <div className="header-title-row">
            <Sparkles className="text-amber glow" size={18} />
            <h3>Agent Bot Studio</h3>
          </div>
          <button className="close-modal-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <p className="studio-sub-desc">
          高级用户自定义模型面板。Agent 将仅作为建议工具协助分析任务、整理步骤及防范风控，绝对无法代操作资金或自动点击交易。
        </p>

        <div className="studio-body">
          {/* Mode Switcher */}
          <div className="studio-section mode-switcher-box">
            <label className="mode-option">
              <input 
                type="radio" 
                name="modelMode" 
                checked={!useCustomModel}
                onChange={() => setUseCustomModel(false)} 
              />
              <div className="option-details">
                <strong>使用平台默认 Agent</strong>
                <span>免配置，智能助手正常引导与分析（免费额度）。</span>
              </div>
            </label>

            <label className="mode-option">
              <input 
                type="radio" 
                name="modelMode" 
                checked={useCustomModel}
                onChange={() => setUseCustomModel(true)} 
              />
              <div className="option-details">
                <strong>使用我的模型 API (BYO Model)</strong>
                <span>使用您专属的服务商 API 密钥，定制 Prompt 规则。</span>
              </div>
            </label>
          </div>

          {useCustomModel && (
            <div className="custom-fields-area animate-slide-down">
              {/* Agent Profile Name */}
              <div className="field-group">
                <label>Agent 智能助手名称</label>
                <input 
                  type="text" 
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  placeholder="例如: My Alpha Sniper"
                />
              </div>

              {/* Provider dropdown */}
              <div className="field-row">
                <div className="field-group flex-1">
                  <label>API 服务商</label>
                  <select 
                    value={selectedProvider} 
                    onChange={(e) => handleProviderChange(e.target.value)}
                  >
                    {PROVIDERS.map(p => (
                      <option key={p.name} value={p.name}>{p.name}</option>
                    ))}
                  </select>
                </div>
                
                <div className="field-group flex-1">
                  <label>模型名称 (Model ID)</label>
                  <select 
                    value={modelId} 
                    onChange={(e) => setModelId(e.target.value)}
                  >
                    {(PROVIDERS.find(p => p.name === selectedProvider)?.models || []).map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Base URL (Readonly showing allowlisted domain origin) */}
              <div className="field-group">
                <label>模型服务基址 (Base URL)</label>
                <input 
                  type="text" 
                  value={baseUrl}
                  readOnly
                  className="bg-readonly"
                  placeholder="https://api.openai.com"
                />
                <span className="field-hint">为了防护 SSRF 安全，Base URL 由系统白名单映射锁死。</span>
              </div>

              {/* API Key */}
              <div className="field-group">
                <label>API 密钥 (API Key)</label>
                <div className="password-input-wrapper">
                  <Key size={14} className="input-icon" />
                  <input 
                    type="password" 
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={keyLast4 ? `**** **** **** ${keyLast4}` : "请输入 API Key (安全加密存储)"}
                  />
                </div>
                {keyLast4 && (
                  <span className="field-hint text-emerald">
                    <CheckCircle2 size={10} className="inline mr-2" />
                    已存储加密密钥 (尾号: {keyLast4})。输入新值可覆盖，留空则保持原密匙。
                  </span>
                )}
              </div>

              {/* Prompt Template */}
              <div className="field-group">
                <label>智能分析 Prompt 模板</label>
                <textarea 
                  value={promptTemplate}
                  onChange={(e) => setPromptTemplate(e.target.value)}
                  rows={3}
                  placeholder="请输入 Prompt 模板"
                />
              </div>

              {/* Limits and Preferences */}
              <div className="field-row">
                <div className="field-group flex-1">
                  <label>日调用上限 (次)</label>
                  <input 
                    type="number" 
                    value={dailyCallLimit}
                    onChange={(e) => setDailyCallLimit(Number(e.target.value))}
                    min={1}
                    max={1000}
                  />
                </div>

                <div className="field-group flex-1">
                  <label>安全风险评级</label>
                  <select value={riskPreferences} onChange={(e) => setRiskPreferences(e.target.value)}>
                    <option value="low">Low (谨慎，极度避险)</option>
                    <option value="medium">Medium (标准，适中偏好)</option>
                    <option value="high">High (积极，激进偏好)</option>
                  </select>
                </div>
              </div>

              <div className="field-group">
                <label>偏好任务分类</label>
                <select value={taskPreferences} onChange={(e) => setTaskPreferences(e.target.value)}>
                  <option value="social">社交宣发 (X, Discord, TG)</option>
                  <option value="survey">白名单与问卷表单 (Forms)</option>
                  <option value="onchain">主网测试与链上交互 (Onchain)</option>
                </select>
              </div>

              <div className="studio-warning-card">
                <AlertTriangle size={14} className="text-warning mr-4" />
                <p>
                  密钥保存在后端经过 AES-GCM 算法加密，不回显明文，且永远无法获取或导出。
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="studio-footer-actions">
          {useCustomModel && configId && (
            <button className="danger flex-center gap-6" onClick={handleDelete} disabled={saving}>
              <Trash2 size={15} /> 删除配置
            </button>
          )}
          <button className="primary flex-center gap-6" onClick={handleSave} disabled={saving}>
            <Save size={15} /> {saving ? "正在保存..." : "保存配置"}
          </button>
        </div>
      </div>
    </div>
  );
}
