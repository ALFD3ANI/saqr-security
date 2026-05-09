const base = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

export const API_BASE = base + "/api/v1";

export const WS_ORIGIN = base
  ? base.replace("https://", "wss://").replace("http://", "ws://")
  : "ws://localhost:8000";
