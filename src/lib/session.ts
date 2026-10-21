import type { Session } from "../types";

const SESSION_KEY = "jajabor.session.v1";

export function defaultProxy(): string {
  if (typeof window === "undefined") return "";
  const host = window.location.hostname;
  if (host === "localhost" || host === "127.0.0.1") return "";
  const configured = import.meta.env.VITE_PROXY_URL as string | undefined;
  return configured || "http://localhost:8788";
}

export function loadSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Session;
    if (!parsed || typeof parsed !== "object") return null;
    return { ...parsed, proxy: parsed.proxy ?? defaultProxy() };
  } catch {
    return null;
  }
}

export function saveSession(session: Session): void {
  const payload = JSON.stringify(session);
  try {
    sessionStorage.setItem(SESSION_KEY, payload);
    if (session.remember) localStorage.setItem(SESSION_KEY, payload);
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    // storage can be unavailable in private browsing — keep the in-memory session
  }
}

export function clearSession(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
}

export function normalizeToken(raw: string): string {
  return raw.trim().replace(/^Bearer\s+/i, "").trim();
}

export interface ParsedSession {
  token: string;
  deviceId?: string;
  deviceKey?: string;
}

export function parseSessionInput(text: string): ParsedSession | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const fromObject = (value: unknown): ParsedSession | null => {
    if (!value || typeof value !== "object") return null;
    const object = value as Record<string, unknown>;
    const nested = object.session as Record<string, unknown> | undefined;
    const source = nested && typeof nested === "object" ? { ...object, ...nested } : object;
    const tokenRaw =
      source.token ?? source.access_token ?? source.authorization ?? source.authToken ?? source.jwt;
    if (typeof tokenRaw !== "string") return null;
    const token = normalizeToken(tokenRaw);
    if (!token) return null;
    const deviceId = source.deviceId ?? source.device_id ?? source["x-device-id"] ?? source.uudid;
    const deviceKey = source.deviceKey ?? source.device_key ?? source["x-device-key"] ?? source.ssdk;
    return {
      token,
      ...(typeof deviceId === "string" && deviceId.trim() ? { deviceId: deviceId.trim() } : {}),
      ...(typeof deviceKey === "string" && deviceKey.trim() ? { deviceKey: deviceKey.trim() } : {}),
    };
  };

  try {
    const parsed = JSON.parse(trimmed);
    return fromObject(parsed);
  } catch {
    // not JSON
  }

  const tokenLine = trimmed.match(/^\s*authorization\s*:\s*(.+)$/im);
  if (tokenLine) {
    return { token: normalizeToken(tokenLine[1]) };
  }

  if (/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(trimmed)) {
    return { token: trimmed };
  }

  return null;
}

export interface TokenInfo {
  expiresAt: number | null;
  expired: boolean;
  subject: string | null;
}

export function decodeToken(token: string): TokenInfo {
  const empty: TokenInfo = { expiresAt: null, expired: false, subject: null };
  if (!token) return empty;
  const parts = token.split(".");
  if (parts.length < 2) return empty;
  try {
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = payload + "=".repeat((4 - (payload.length % 4)) % 4);
    const json = JSON.parse(atob(padded)) as Record<string, unknown>;
    const exp = typeof json.exp === "number" ? json.exp * 1000 : null;
    const subject =
      (typeof json.name === "string" && json.name) ||
      (typeof json.mobile === "string" && json.mobile) ||
      (typeof json.sub === "string" && json.sub) ||
      null;
    return {
      expiresAt: exp,
      expired: exp !== null ? exp < Date.now() : false,
      subject,
    };
  } catch {
    return empty;
  }
}

export function maskToken(token: string): string {
  if (!token) return "";
  if (token.length <= 14) return `${token.slice(0, 4)}…`;
  return `${token.slice(0, 8)}…${token.slice(-6)}`;
}
