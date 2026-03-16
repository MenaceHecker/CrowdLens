const apiBase = process.env.EXPO_PUBLIC_API_BASE || "http://localhost:8000";

function toWebSocketBase(httpBase: string) {
  if (httpBase.startsWith("https://")) {
    return httpBase.replace("https://", "wss://");
  }
  if (httpBase.startsWith("http://")) {
    return httpBase.replace("http://", "ws://");
  }
  return httpBase;
}

export const API_BASE = apiBase;
export const WS_BASE = process.env.EXPO_PUBLIC_WS_BASE || toWebSocketBase(apiBase);