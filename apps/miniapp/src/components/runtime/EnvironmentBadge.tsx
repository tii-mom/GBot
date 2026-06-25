import React from "react";
export type RuntimeEnvironment = "Production" | "Staging" | "Local";
export type ApiStatus = "Healthy" | "Degraded" | "Offline";
export function deriveRuntimeEnvironment(hostname = typeof window !== "undefined" ? window.location.hostname : "localhost"): RuntimeEnvironment {
  if (hostname === "localhost" || hostname === "127.0.0.1") return "Local";
  if (hostname.includes("staging") || hostname.includes("pages.dev")) return "Staging";
  return "Production";
}
export function EnvironmentBadge({ environment = deriveRuntimeEnvironment(), apiStatus = "Degraded" }: { environment?: RuntimeEnvironment; apiStatus?: ApiStatus }) {
  return <div className="environment-badge" aria-label={`Environment ${environment}, API ${apiStatus}`}><span>{environment}</span><b>{apiStatus}</b></div>;
}
