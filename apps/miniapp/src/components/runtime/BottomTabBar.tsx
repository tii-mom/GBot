import React, { useState } from "react";
import type { Tab } from "./runtimeTypes";
import { telegramAdapter } from "../../telegramAdapter";
import { Bot, Castle, Coins, Menu, Sparkles, Wallet, X } from "lucide-react";

export interface BottomTabBarProps {
  currentTab: Tab;
  onTabChange: (tab: Tab) => void;
  agentName?: string;
  agentLevel?: number;
  gBalance?: string;
}

export function BottomTabBar({ currentTab, onTabChange, agentName = "Agent", agentLevel = 1, gBalance = "0" }: BottomTabBarProps) {
  const [open, setOpen] = useState(false);
  const tabsList: Array<{ key: Tab; label: string; hint: string; icon: React.ReactNode }> = [
    { key: "Agent", label: "Agent 主屏", hint: "状态与装备", icon: <Bot size={20} /> },
    { key: "Train", label: "技能商店", hint: "购买与装配", icon: <Sparkles size={20} /> },
    { key: "Explore", label: "去赚钱", hint: "派遣任务", icon: <Coins size={20} /> },
    { key: "Nest", label: "小金库", hint: "预算与回款", icon: <Wallet size={20} /> },
    { key: "Guild", label: "公会", hint: "协作与排名", icon: <Castle size={20} /> }
  ];

  const selectTab = (nextTab: Tab) => {
    telegramAdapter.hapticImpact("light");
    onTabChange(nextTab);
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        className={`side-nav-trigger${open ? " is-open" : ""}`}
        onClick={() => {
          telegramAdapter.hapticImpact("light");
          setOpen((value) => !value);
        }}
        aria-expanded={open}
        aria-label={open ? "关闭菜单" : "打开菜单"}
      >
        {open ? <X size={22} /> : <Menu size={22} />}
      </button>

      {open && <button type="button" className="side-nav-scrim" aria-label="点击空白关闭菜单" onClick={() => setOpen(false)} />}

      <aside className={`side-nav-drawer${open ? " is-open" : ""}`} aria-hidden={!open}>
        <div className="side-nav-profile">
          <div className="side-nav-avatar">
            <Bot size={24} />
          </div>
          <div>
            <strong>{agentName}</strong>
            <span>Lv.{agentLevel} · {gBalance} G</span>
          </div>
        </div>

        <nav className="side-nav-list" aria-label="游戏导航">
          {tabsList.map((item) => {
            const isActive = currentTab === item.key;
            return (
              <button
                key={item.key}
                className={`side-nav-item${isActive ? " is-active" : ""}`}
                onClick={() => selectTab(item.key)}
                type="button"
              >
                <span className="side-nav-item__icon">{item.icon}</span>
                <span>
                  <strong>{item.label}</strong>
                  <small>{item.hint}</small>
                </span>
              </button>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
