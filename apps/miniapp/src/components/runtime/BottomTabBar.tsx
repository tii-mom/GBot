import React from "react";
import type { Tab } from "./runtimeTypes";
import { telegramAdapter } from "../../telegramAdapter";

export interface BottomTabBarProps {
  currentTab: Tab;
  onTabChange: (tab: Tab) => void;
}

export function BottomTabBar({ currentTab, onTabChange }: BottomTabBarProps) {
  const tabsList: Array<{ key: Tab; label: string; icon: string }> = [
    { key: "Workspace", label: "Agent", icon: "🤖" },
    { key: "Tasks", label: "Tasks", icon: "💼" },
    { key: "Run", label: "Run", icon: "⚡" },
    { key: "Reports", label: "Reports", icon: "📊" },
    { key: "Network", label: "Network", icon: "🌐" }
  ];

  return (
    <nav className="bottom-tab-bar" aria-label="Runtime Navigation">
      {tabsList.map((item) => {
        const isActive = currentTab === item.key;
        return (
          <button
            key={item.key}
            className={`tab-bar-item ${isActive ? "active" : ""}`}
            onClick={() => {
              telegramAdapter.hapticImpact("light");
              onTabChange(item.key);
            }}
          >
            {isActive && <div className="tab-active-bubble" />}
            <span style={{ fontSize: "20px", marginBottom: "2px" }}>{item.icon}</span>
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
