import type { PairInfo, Session } from "../types";
import { apiDate, addDaysISO, todayISO } from "./format";

export interface ApiSeatType {
  type?: string;
  seat_counts?: { online?: number | string; offline?: number | string };
  fare?: number | string;
  origin_city_seq?: number;
  destination_city_seq?: number;
}

export interface ApiTrain {
  trip_number?: string;
  seat_types?: ApiSeatType[];
  parent_route?: {
    origin_city_name?: string;
    destination_city_name?: string;
  };
}

export interface TrainAnalysis {
  foundTrain: boolean;
  hasClass: boolean;
  pair: PairInfo | null;
  classes: string[];
  trainLabel: string | null;
}

export class ApiError extends Error {
  status: number;
  code: "auth" | "rate" | "http" | "network" | "parse";

  constructor(message: string, status = 0, code: ApiError["code"] = "http") {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export function resolveApiBase(session: Session | null): string {
  const proxy = session?.proxy?.trim();
  return proxy ? proxy.replace(/\/+$/, "") : "";
}

export function authHeaders(session: Session | null): Record<string, string> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (session?.token) headers.Authorization = `Bearer ${session.token.replace(/^Bearer\s+/i, "")}`;
  if (session?.deviceId) headers["X-Device-Id"] = session.deviceId;
  if (session?.deviceKey) headers["X-Device-Key"] = session.deviceKey;
  return headers;
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text();
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new ApiError(
      response.ok
        ? "The railway API returned something unexpected."
        : `The railway API returned HTTP ${response.status}.`,
      response.status,
      "parse",
    );
  }
}

function errorMessage(payload: Record<string, unknown>): string {
  const error = payload.error as { messages?: unknown } | undefined;
  if (error && Array.isArray(error.messages) && error.messages.length) {
    return String(error.messages[0]);
  }
  const message = payload.message;
  return typeof message === "string" ? message : "";
}

export async function apiHealth(
  base: string,
  timeoutMs = 4000,
): Promise<{ ok: boolean; version?: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${base}/api/health`, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) return { ok: false };
    const json = (await response.json()) as { ok?: boolean; version?: string };
    return { ok: Boolean(json.ok), version: json.version };
  } catch {
    return { ok: false };
  } finally {
    clearTimeout(timer);
  }
}

export interface SearchParams {
  from: string;
  to: string;
  date: string;
  cls: string;
}

export async function searchTrips(
  base: string,
  session: Session | null,
  params: SearchParams,
  signal?: AbortSignal,
): Promise<ApiTrain[]> {
  const query = new URLSearchParams({
    from_city: params.from,
    to_city: params.to,
    date_of_journey: apiDate(params.date),
    seat_class: params.cls,
  });
  let response: Response;
  try {
    response = await fetch(`${base}/api/search?${query.toString()}`, {
      headers: authHeaders(session),
      signal,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new ApiError(
      "Couldn't reach the Jajabor proxy. Locally, run npm run live; on Netlify, redeploy so the API functions are available.",
      0,
      "network",
    );
  }

  const payload = await readJson(response);
  if (response.status === 401 || response.status === 403) {
    throw new ApiError(
      errorMessage(payload) || "Your railway session is missing or has expired. Reconnect it in Settings.",
      response.status,
      "auth",
    );
  }
  if (response.status === 429) {
    throw new ApiError(
      "The railway server is rate-limiting requests. Wait a minute, then resume with a gentler speed.",
      429,
      "rate",
    );
  }
  if (!response.ok) {
    throw new ApiError(
      errorMessage(payload) || `Railway API error (HTTP ${response.status}).`,
      response.status,
      "http",
    );
  }

  const data = payload.data as { trains?: ApiTrain[] } | undefined;
  return Array.isArray(data?.trains) ? data.trains : [];
}

function tripNumber(train: ApiTrain): string {
  const raw = String(train.trip_number || "");
  const parenthesised = raw.match(/\((\d+)\)/);
  if (parenthesised) return parenthesised[1];
  const digits = raw.match(/\d+/);
  return digits ? digits[0] : "";
}

export function analyseTrain(
  trains: ApiTrain[],
  wantedNumber: string,
  cls: string,
): TrainAnalysis {
  const wanted = String(wantedNumber).replace(/\D/g, "");
  const train = trains.find((candidate) => tripNumber(candidate) === wanted) || null;
  const classes = train
    ? Array.from(new Set((train.seat_types || []).map((seat) => String(seat.type || "")))).filter(
        Boolean,
      )
    : Array.from(
        new Set(
          trains.flatMap((candidate) =>
            (candidate.seat_types || []).map((seat) => String(seat.type || "")),
          ),
        ),
      ).filter(Boolean);
  if (!train) {
    return { foundTrain: false, hasClass: false, pair: null, classes, trainLabel: null };
  }
  const seat = (train.seat_types || []).find((candidate) => candidate.type === cls);
  if (!seat) {
    return {
      foundTrain: true,
      hasClass: false,
      pair: null,
      classes,
      trainLabel: String(train.trip_number || wanted),
    };
  }
  return {
    foundTrain: true,
    hasClass: true,
    pair: {
      online: Number(seat.seat_counts?.online) || 0,
      offline: Number(seat.seat_counts?.offline) || 0,
      fare: Number(seat.fare) || 0,
    },
    classes,
    trainLabel: String(train.trip_number || wanted),
  };
}

export async function probeSession(session: Session, signal?: AbortSignal): Promise<void> {
  const base = resolveApiBase(session);
  await searchTrips(
    base,
    session,
    {
      from: "Dhaka",
      to: "Chattogram",
      date: addDaysISO(todayISO(), 1),
      cls: "S_CHAIR",
    },
    signal,
  );
}

export function apiErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return String(error);
}
