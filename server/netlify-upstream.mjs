/**
 * Netlify Functions version of Jajabor's live proxy.
 *
 * The browser only talks to this origin, so no local server is needed on
 * Netlify. Tokens are forwarded from the request to the railway API and never
 * logged or persisted.
 */
const UPSTREAM = (process.env.RAILWAY_API_BASE || "https://railspaapi.shohoz.com/v1.0/web").replace(
  /\/+$/,
  "",
);
const VERSION = process.env.npm_package_version || "1.0.0";
const UPSTREAM_TIMEOUT = Math.max(
  1_000,
  Number(process.env.UPSTREAM_TIMEOUT_MS || 8_000) || 8_000,
);
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim().replace(/\/+$/, ""))
  .filter(Boolean);

const CLASSES = new Set([
  "S_CHAIR",
  "SHOVAN",
  "SNIGDHA",
  "F_SEAT",
  "F_BERTH",
  "F_CHAIR",
  "AC_S",
  "AC_B",
  "AC_CHAIR",
  "SHULOV",
]);

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 240;
const routeCache = new Map();
const handshakeCache = { value: null, time: 0 };
const ROUTE_TTL = 24 * 60 * 60 * 1000;
const HANDSHAKE_TTL = 10 * 60 * 1000;

function header(event, name) {
  const headers = event.headers || {};
  const wanted = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === wanted) return Array.isArray(value) ? value[0] : String(value || "");
  }
  return "";
}

function clientIp(event) {
  return (
    header(event, "x-nf-client-connection-ip") ||
    header(event, "x-forwarded-for").split(",")[0].trim() ||
    "netlify"
  );
}

const rate = new Map();

function rateLimited(event) {
  const key = clientIp(event);
  const now = Date.now();
  const entry = rate.get(key);
  if (!entry || now - entry.start > WINDOW_MS) {
    rate.set(key, { start: now, count: 1 });
  } else {
    entry.count += 1;
    if (entry.count > MAX_PER_WINDOW) return true;
  }
  if (rate.size > 400) {
    for (const [ip, value] of rate) {
      if (now - value.start > WINDOW_MS * 2) rate.delete(ip);
    }
  }
  return false;
}

function originAllowed(event, origin) {
  if (process.env.ALLOW_ANY_ORIGIN === "true") return true;
  if (ALLOWED_ORIGINS.includes(origin)) return true;

  const host = header(event, "x-forwarded-host") || header(event, "host");
  if (!host) return false;
  try {
    const parsed = new URL(origin);
    return parsed.host === host;
  } catch {
    return false;
  }
}

function corsHeaders(event) {
  const headers = { Vary: "Origin" };
  const origin = header(event, "origin");
  if (origin && originAllowed(event, origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

function json(event, statusCode, payload, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Jajabor-Proxy": "netlify",
      ...corsHeaders(event),
      ...extraHeaders,
    },
    body: JSON.stringify(payload),
  };
}

function preflight(event) {
  return {
    statusCode: 204,
    headers: {
      ...corsHeaders(event),
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers":
        "Authorization,Content-Type,Accept,X-Device-Id,X-Device-Key,X-Requested-With",
      "Access-Control-Max-Age": "86400",
      "Cache-Control": "no-store",
      "X-Jajabor-Proxy": "netlify",
    },
    body: "",
  };
}

export function guard(event) {
  if (event.httpMethod === "OPTIONS") return preflight(event);
  if (rateLimited(event)) {
    return json(event, 429, {
      error: {
        code: 429,
        messages: ["Too many requests to the Jajabor proxy. Wait a moment."],
      },
    });
  }
  return null;
}

function cleanHeader(value) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function upstreamHeaders(event) {
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
    "X-Requested-With": "XMLHttpRequest",
    Origin: "https://eticket.railway.gov.bd",
    Referer: "https://eticket.railway.gov.bd/",
    "User-Agent":
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36",
  };
  const authorization = cleanHeader(header(event, "authorization"));
  const deviceId = cleanHeader(header(event, "x-device-id"));
  const deviceKey = cleanHeader(header(event, "x-device-key"));
  if (authorization) {
    headers.Authorization = /^Bearer\s+/i.test(authorization)
      ? authorization
      : `Bearer ${authorization}`;
  }
  if (deviceId) headers["X-Device-Id"] = deviceId;
  if (deviceKey) headers["X-Device-Key"] = deviceKey;
  return headers;
}

async function forward(event, path, init = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT);
  try {
    const response = await fetch(`${UPSTREAM}${path}`, {
      ...init,
      headers: upstreamHeaders(event),
      signal: controller.signal,
    });
    const text = await response.text();
    return {
      statusCode: response.status,
      headers: {
        "Content-Type": response.headers.get("content-type") || "application/json",
        "Cache-Control": "no-store",
        "X-Jajabor-Proxy": "netlify",
        ...corsHeaders(event),
      },
      body: text,
    };
  } catch (error) {
    const timedOut = error?.name === "AbortError";
    return json(event, timedOut ? 504 : 502, {
      error: {
        code: timedOut ? 504 : 502,
        messages: [
          timedOut
            ? "The railway API took too long to answer. Try again."
            : `Couldn't reach the railway API${error?.message ? `: ${error.message}` : "."}`,
        ],
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

function query(event) {
  if (event.rawQuery) return new URLSearchParams(event.rawQuery);
  const raw = event.queryStringParameters || {};
  return new URLSearchParams(raw);
}

function body(event) {
  if (!event.body) return {};
  if (typeof event.body === "string" && event.body.length > 44_000) {
    throw new Error("body-too-large");
  }
  const raw = event.isBase64Encoded
    ? Buffer.from(event.body, "base64").toString("utf8")
    : event.body;
  if (raw.length > 32_768) throw new Error("body-too-large");
  return JSON.parse(raw);
}

export function handleHealth(event) {
  return json(event, 200, {
    ok: true,
    version: VERSION,
    runtime: "netlify-functions",
    upstream: new URL(UPSTREAM).host,
    cors: ALLOWED_ORIGINS.length ? ALLOWED_ORIGINS : "same origin",
    time: new Date().toISOString(),
  });
}

export async function handleSearch(event) {
  if (event.httpMethod !== "GET") {
    return json(event, 405, {
      error: { code: 405, messages: ["Use GET for seat searches."] },
    });
  }

  const params = query(event);
  const from = (params.get("from_city") || "").trim();
  const to = (params.get("to_city") || "").trim();
  const date = (params.get("date_of_journey") || "").trim();
  const cls = (params.get("seat_class") || "").trim();

  if (!from || !to || !date || !cls) {
    return json(event, 400, {
      error: {
        code: 400,
        messages: ["from_city, to_city, date_of_journey and seat_class are all required."],
      },
    });
  }
  if (from.length > 80 || to.length > 80) {
    return json(event, 400, {
      error: { code: 400, messages: ["Station names are too long."] },
    });
  }
  if (!/^\d{1,2}-[A-Za-z]{3}-\d{4}$/.test(date)) {
    return json(event, 400, {
      error: { code: 400, messages: ["date_of_journey must look like 04-Nov-2026."] },
    });
  }
  if (!CLASSES.has(cls)) {
    return json(event, 400, {
      error: { code: 400, messages: [`Unknown seat class "${cls}".`] },
    });
  }
  if (!cleanHeader(header(event, "authorization"))) {
    return json(event, 401, {
      error: { code: 401, messages: ["No railway session was sent. Connect one in Jajabor."] },
    });
  }

  const searchParams = new URLSearchParams({
    from_city: from,
    to_city: to,
    date_of_journey: date,
    seat_class: cls,
  });
  return forward(event, `/bookings/search-trips-v2?${searchParams.toString()}`);
}

export async function handleTrainRoute(event) {
  if (event.httpMethod !== "POST") {
    return json(event, 405, {
      error: { code: 405, messages: ["Use POST with a JSON model field."] },
    });
  }

  let payload;
  try {
    payload = body(event);
  } catch {
    return json(event, 400, {
      error: { code: 400, messages: ["Couldn't read the request body."] },
    });
  }
  const model = String(payload?.model ?? "").trim();
  if (!/^\d{1,6}$/.test(model)) {
    return json(event, 400, {
      error: { code: 400, messages: ["model must be a train number, e.g. 734."] },
    });
  }

  const hit = routeCache.get(model);
  if (hit && Date.now() - hit.time < ROUTE_TTL) {
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Jajabor-Proxy": "netlify",
        "X-Jajabor-Cache": "hit",
        ...corsHeaders(event),
      },
      body: hit.body,
    };
  }

  const result = await forward(event, "/train-routes", {
    method: "POST",
    body: JSON.stringify({ model }),
  });
  if (result.statusCode === 200) {
    try {
      JSON.parse(result.body);
      routeCache.set(model, {
        body: result.body,
        time: Date.now(),
      });
      if (routeCache.size > 250) routeCache.delete(routeCache.keys().next().value);
    } catch {
      /* forward malformed JSON untouched */
    }
  }
  return result;
}

export async function handleHandshake(event) {
  if (event.httpMethod !== "POST") {
    return json(event, 405, {
      error: { code: 405, messages: ["Use POST for the handshake."] },
    });
  }

  if (handshakeCache.value && Date.now() - handshakeCache.time < HANDSHAKE_TTL) {
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Jajabor-Proxy": "netlify",
        "X-Jajabor-Cache": "hit",
        ...corsHeaders(event),
      },
      body: handshakeCache.value,
    };
  }

  const result = await forward(event, "/handshake", {
    method: "POST",
    body: JSON.stringify({}),
  });
  if (result.statusCode === 200) {
    try {
      JSON.parse(result.body);
      handshakeCache.value = result.body;
      handshakeCache.time = Date.now();
    } catch {
      /* forward malformed JSON untouched */
    }
  }
  return result;
}
