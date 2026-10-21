#!/usr/bin/env node
/**
 * Jajabor live-mode proxy.
 *
 * The railway search API only accepts requests from its own web origin, so the
 * browser can't call it directly. This tiny server forwards the user's own
 * session headers to the upstream API and serves the built frontend.
 *
 * It never writes tokens to disk or logs them.
 */
import express from "express";
import compression from "compression";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const PORT = Number(process.env.PORT || 8788);
const HOST = process.env.HOST || "127.0.0.1";
const UPSTREAM = (process.env.RAILWAY_API_BASE || "https://railspaapi.shohoz.com/v1.0/web").replace(
  /\/+$/,
  "",
);
const UPSTREAM_TIMEOUT = 30_000;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const VERSION = JSON.parse(await readFile(path.join(root, "package.json"), "utf8")).version;
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

const app = express();
app.disable("x-powered-by");
app.use(compression());
app.use(express.json({ limit: "32kb" }));

/* ------------------------------------------------------------------ */
/* CORS — the demo may be hosted anywhere while the proxy stays local. */
/* ------------------------------------------------------------------ */
app.use((req, res, next) => {
  const origin = req.get("origin");
  if (!origin) {
    res.setHeader("Access-Control-Allow-Origin", "*");
  } else if (!ALLOWED_ORIGINS.length) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  } else if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Authorization,Content-Type,Accept,X-Device-Id,X-Device-Key,X-Requested-With",
  );
  res.setHeader("Access-Control-Max-Age", "86400");
  if (req.get("access-control-request-private-network") === "true") {
    res.setHeader("Access-Control-Allow-Private-Network", "true");
  }
  if (req.method === "OPTIONS") return res.status(204).end();
  next();
});

/* --------------------------------------------------- */
/* A gentle local rate limit. Normal scans stay well    */
/* below this; a runaway loop gets stopped.             */
/* --------------------------------------------------- */
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 240;
const rate = new Map();

function rateLimited(req) {
  const ip = req.socket.remoteAddress || "local";
  const now = Date.now();
  const entry = rate.get(ip);
  if (!entry || now - entry.start > WINDOW_MS) {
    rate.set(ip, { start: now, count: 1 });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_PER_WINDOW;
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rate) {
    if (now - entry.start > WINDOW_MS * 2) rate.delete(ip);
  }
}, WINDOW_MS).unref();

app.use("/api", (req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  if (rateLimited(req)) {
    return res.status(429).json({
      error: { code: 429, messages: ["Too many requests to the local proxy. Wait a moment."] },
    });
  }
  next();
});

/* ------------------ */
/* Upstream utilities */
/* ------------------ */
function cleanHeader(value) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function authHeaders(req) {
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
    "X-Requested-With": "XMLHttpRequest",
    Origin: "https://eticket.railway.gov.bd",
    Referer: "https://eticket.railway.gov.bd/",
    "User-Agent":
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36",
  };
  const authorization = cleanHeader(req.get("authorization"));
  const deviceId = cleanHeader(req.get("x-device-id"));
  const deviceKey = cleanHeader(req.get("x-device-key"));
  if (authorization) {
    headers.Authorization = /^Bearer\s+/i.test(authorization)
      ? authorization
      : `Bearer ${authorization}`;
  }
  if (deviceId) headers["X-Device-Id"] = deviceId;
  if (deviceKey) headers["X-Device-Key"] = deviceKey;
  return headers;
}

async function forward(req, res, path, init = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT);
  try {
    const response = await fetch(`${UPSTREAM}${path}`, {
      ...init,
      headers: authHeaders(req),
      signal: controller.signal,
    });
    const text = await response.text();
    res.status(response.status);
    res.type(response.headers.get("content-type") || "application/json");
    res.send(text);
  } catch (error) {
    const timedOut = error?.name === "AbortError";
    res.status(timedOut ? 504 : 502).json({
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

/* ------------- */
/* Health check  */
/* ------------- */
app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    version: VERSION,
    upstream: new URL(UPSTREAM).host,
    cors: ALLOWED_ORIGINS.length ? ALLOWED_ORIGINS : "any origin",
    time: new Date().toISOString(),
  });
});

/* ------------------------------------------- */
/* Seat availability for one station pair      */
/* ------------------------------------------- */
app.get("/api/search", (req, res) => {
  const { from_city, to_city, date_of_journey, seat_class } = req.query;
  const from = typeof from_city === "string" ? from_city.trim() : "";
  const to = typeof to_city === "string" ? to_city.trim() : "";
  const date = typeof date_of_journey === "string" ? date_of_journey.trim() : "";
  const cls = typeof seat_class === "string" ? seat_class.trim() : "";

  if (!from || !to || !date || !cls) {
    return res.status(400).json({
      error: {
        code: 400,
        messages: ["from_city, to_city, date_of_journey and seat_class are all required."],
      },
    });
  }
  if (from.length > 80 || to.length > 80) {
    return res
      .status(400)
      .json({ error: { code: 400, messages: ["Station names are too long."] } });
  }
  if (!/^\d{1,2}-[A-Za-z]{3}-\d{4}$/.test(date)) {
    return res.status(400).json({
      error: { code: 400, messages: ["date_of_journey must look like 04-Nov-2026."] },
    });
  }
  if (!CLASSES.has(cls)) {
    return res
      .status(400)
      .json({ error: { code: 400, messages: [`Unknown seat class "${cls}".`] } });
  }
  if (!cleanHeader(req.get("authorization"))) {
    return res.status(401).json({
      error: { code: 401, messages: ["No railway session was sent. Connect one in Jajabor."] },
    });
  }

  const query = new URLSearchParams({
    from_city: from,
    to_city: to,
    date_of_journey: date,
    seat_class: cls,
  });
  void forward(req, res, `/bookings/search-trips-v2?${query.toString()}`);
});

/* ---------------------------- */
/* Public timetable endpoints   */
/* ---------------------------- */
const routeCache = new Map();
const handshakeCache = { value: null, time: 0 };
const ROUTE_TTL = 24 * 60 * 60 * 1000;
const HANDSHAKE_TTL = 10 * 60 * 1000;

app.post("/api/train-route", async (req, res) => {
  const model = String(req.body?.model ?? "").trim();
  if (!/^\d{1,6}$/.test(model)) {
    return res
      .status(400)
      .json({ error: { code: 400, messages: ["model must be a train number, e.g. 734."] } });
  }
  const hit = routeCache.get(model);
  if (hit && Date.now() - hit.time < ROUTE_TTL) {
    res.setHeader("X-Jajabor-Cache", "hit");
    return res.status(200).json(hit.value);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT);
  try {
    const response = await fetch(`${UPSTREAM}/train-routes`, {
      method: "POST",
      headers: authHeaders(req),
      body: JSON.stringify({ model }),
      signal: controller.signal,
    });
    const text = await response.text();
    if (response.ok) {
      try {
        const value = JSON.parse(text);
        routeCache.set(model, { value, time: Date.now() });
        if (routeCache.size > 250) routeCache.delete(routeCache.keys().next().value);
      } catch {
        /* forward malformed JSON untouched */
      }
    }
    res.status(response.status);
    res.type(response.headers.get("content-type") || "application/json");
    res.send(text);
  } catch (error) {
    res.status(error?.name === "AbortError" ? 504 : 502).json({
      error: {
        code: 502,
        messages: ["Couldn't load the train route. Try again."],
      },
    });
  } finally {
    clearTimeout(timer);
  }
});

app.post("/api/handshake", async (req, res) => {
  if (handshakeCache.value && Date.now() - handshakeCache.time < HANDSHAKE_TTL) {
    res.setHeader("X-Jajabor-Cache", "hit");
    return res.status(200).json(handshakeCache.value);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT);
  try {
    const response = await fetch(`${UPSTREAM}/handshake`, {
      method: "POST",
      headers: authHeaders(req),
      body: JSON.stringify({}),
      signal: controller.signal,
    });
    const text = await response.text();
    if (response.ok) {
      try {
        const value = JSON.parse(text);
        handshakeCache.value = value;
        handshakeCache.time = Date.now();
      } catch {
        /* ignore */
      }
    }
    res.status(response.status);
    res.type(response.headers.get("content-type") || "application/json");
    res.send(text);
  } catch (error) {
    res.status(error?.name === "AbortError" ? 504 : 502).json({
      error: {
        code: 502,
        messages: ["Couldn't reach the railway API handshake. Try again."],
      },
    });
  } finally {
    clearTimeout(timer);
  }
});

/* ---------------------- */
/* Static frontend + SPA  */
/* ---------------------- */
const dist = path.join(root, "dist");
if (existsSync(dist)) {
  app.use(
    express.static(dist, {
      index: false,
      maxAge: "1h",
      setHeaders(res, filePath) {
        if (filePath.endsWith("index.html")) res.setHeader("Cache-Control", "no-cache");
        if (filePath.includes(`${path.sep}data${path.sep}`)) {
          res.setHeader("Cache-Control", "public, max-age=300");
        }
      },
    }),
  );
  app.get("*", (req, res) => {
    if (req.path.startsWith("/api/")) {
      return res.status(404).json({ error: { code: 404, messages: ["Not found."] } });
    }
    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(path.join(dist, "index.html"));
  });
} else {
  app.get("*", (req, res) => {
    res
      .status(503)
      .type("text/plain")
      .send("Jajabor's frontend hasn't been built yet.\nRun `npm run build` then restart, or use `npm run live`.\n");
  });
}

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  console.error(`[jajabor] ${req.method} ${req.path} -> ${error?.message || error}`);
  res.status(500).json({ error: { code: 500, messages: ["The local proxy hit an error."] } });
});

const server = app.listen(PORT, HOST, () => {
  console.log(`\n  Jajabor proxy v${VERSION}`);
  console.log(`  Local:    http://${HOST === "0.0.0.0" ? "localhost" : HOST}:${PORT}`);
  console.log(`  Upstream: ${UPSTREAM}`);
  console.log(`  CORS:     ${ALLOWED_ORIGINS.length ? ALLOWED_ORIGINS.join(", ") : "any origin"}`);
  console.log(`  Press Ctrl+C to stop.\n`);
});

for (const event of ["SIGINT", "SIGTERM"]) {
  process.on(event, () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 1500).unref();
  });
}
