import type { PairInfo, Session } from "../types";
import { SPEED_MS } from "../types";
import { ApiError, analyseTrain, searchTrips } from "./api";
import { PairCache, pairCacheKey } from "./cache";
import { demoPair, scanPairs } from "./engine";

export type ScanFatalCode = "auth" | "proxy" | "not-running" | "class-missing";

export class ScanFatalError extends Error {
  code: ScanFatalCode;
  detail?: string;
  classes?: string[];
  trainNames?: string[];

  constructor(
    code: ScanFatalCode,
    message: string,
    extra: { detail?: string; classes?: string[]; trainNames?: string[] } = {},
  ) {
    super(message);
    this.name = "ScanFatalError";
    this.code = code;
    this.detail = extra.detail;
    this.classes = extra.classes;
    this.trainNames = extra.trainNames;
  }
}

export interface ScanProgress {
  done: number;
  total: number;
  current: string;
  errors: number;
  cached: number;
}

export interface ScanCallbacks {
  onPair: (i: number, j: number, info: PairInfo | null, reason?: string) => void;
  onProgress: (progress: ScanProgress) => void;
}

interface BaseScanOptions {
  trainNumber: string;
  date: string;
  cls: string;
  stopNames: string[];
  sellable: boolean[];
  fi: number;
  ti: number;
  gap: number;
  deep: boolean;
  speed: keyof typeof SPEED_MS;
  signal: AbortSignal;
}

export interface LiveScanOptions extends BaseScanOptions, ScanCallbacks {
  session: Session;
  apiBase: string;
}

export interface DemoScanOptions extends BaseScanOptions, ScanCallbacks {}

function abortableSleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve();
    const timer = setTimeout(finish, ms);
    function finish() {
      clearTimeout(timer);
      signal.removeEventListener("abort", finish);
      resolve();
    }
    signal.addEventListener("abort", finish, { once: true });
  });
}

function makeController(signal: AbortSignal): AbortController {
  const controller = new AbortController();
  if (signal.aborted) controller.abort();
  else signal.addEventListener("abort", () => controller.abort(), { once: true });
  return controller;
}

function errorIsRetryable(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false;
  return error.code === "network" || error.code === "rate" || error.status >= 500;
}

export async function runLiveScan(
  options: LiveScanOptions,
): Promise<{ aborted: boolean; errors: number; cached: number }> {
  const pairs = scanPairs(
    options.stopNames.length,
    options.sellable,
    options.fi,
    options.ti,
    options.deep,
  );
  const total = pairs.length;
  const interval = SPEED_MS[options.speed];
  const controller = makeController(options.signal);
  const cache = new PairCache();
  let nextSlot = 0;
  let cursor = 0;
  let done = 0;
  let errors = 0;
  let cachedCount = 0;
  let fatal: ScanFatalError | null = null;
  let probeDone = false;

  const progress = (current = "") =>
    options.onProgress({ done, total, current, errors, cached: cachedCount });

  async function waitForSlot() {
    const now = Date.now();
    const wait = Math.max(0, nextSlot - now);
    nextSlot = Math.max(now, nextSlot) + interval;
    if (wait) await abortableSleep(wait, controller.signal);
  }

  function fail(error: ScanFatalError) {
    fatal = error;
    controller.abort();
  }

  function validateProbe(
    i: number,
    j: number,
    trains: Awaited<ReturnType<typeof searchTrips>>,
    analysis: ReturnType<typeof analyseTrain>,
  ) {
    if (probeDone || i !== options.fi || j !== options.ti) return;
    probeDone = true;
    if (!analysis.foundTrain) {
      const names = trains
        .slice(0, 3)
        .map((train) => String(train.trip_number || "?"))
        .filter(Boolean);
      fail(
        new ScanFatalError(
          "not-running",
          `Train ${options.trainNumber} wasn't found for this trip on this date. It may not run that day, or this station pair isn't served.`,
          { trainNames: names },
        ),
      );
      return;
    }
    if (!analysis.hasClass) {
      fail(
        new ScanFatalError(
          "class-missing",
          `This train doesn't offer ${options.cls} on this trip.`,
          { classes: analysis.classes },
        ),
      );
    }
  }

  progress();

  async function worker() {
    while (!controller.signal.aborted) {
      const index = cursor++;
      if (index >= pairs.length) return;
      const [i, j] = pairs[index];
      const from = options.stopNames[i];
      const to = options.stopNames[j];
      const cacheKey = pairCacheKey(options.trainNumber, options.date, options.cls, from, to);

      const cached = cache.get(cacheKey);
      if (cached !== undefined) {
        options.onPair(i, j, cached);
        cachedCount++;
        done++;
        progress(`${from} → ${to}`);
        continue;
      }

      await waitForSlot();
      if (controller.signal.aborted) return;

      const label = `${from} → ${to}`;
      progress(label);

      let attempt = 0;
      let resolved = false;
      while (!controller.signal.aborted && !resolved) {
        try {
          const trains = await searchTrips(
            options.apiBase,
            options.session,
            { from, to, date: options.date, cls: options.cls },
            controller.signal,
          );
          const analysis = analyseTrain(trains, options.trainNumber, options.cls);
          validateProbe(i, j, trains, analysis);
          if (fatal) return;
          cache.set(cacheKey, analysis.pair);
          options.onPair(i, j, analysis.pair);
          done++;
          progress(label);
          resolved = true;
        } catch (error) {
          if (controller.signal.aborted) return;
          if (error instanceof ApiError && error.code === "auth") {
            fail(
              new ScanFatalError(
                "auth",
                "Your railway session has expired or isn't valid. Reconnect it and try again.",
                { detail: error.message },
              ),
            );
            return;
          }
          if (error instanceof ApiError && error.code === "network") {
            if (done === 0 && attempt === 0) {
              attempt++;
              await abortableSleep(1200, controller.signal);
              continue;
            }
            fail(
              new ScanFatalError(
                "proxy",
                "Couldn't reach the Jajabor proxy. Start it with `npm start` and check the proxy address in Settings.",
                { detail: error.message },
              ),
            );
            return;
          }
          if (attempt < 2 && errorIsRetryable(error)) {
            attempt++;
            await abortableSleep(1400 * attempt, controller.signal);
            continue;
          }
          cache.set(cacheKey, null);
          options.onPair(i, j, null, "Lookup failed");
          errors++;
          done++;
          progress(label);
          resolved = true;
        }
      }
    }
  }

  try {
    await Promise.all([worker(), worker()]);
  } finally {
    cache.flush();
  }

  if (fatal) throw fatal;
  return {
    aborted: options.signal.aborted,
    errors,
    cached: cachedCount,
  };
}

export async function runDemoScan(
  options: DemoScanOptions,
): Promise<{ aborted: boolean }> {
  const pairs = scanPairs(
    options.stopNames.length,
    options.sellable,
    options.fi,
    options.ti,
    options.deep,
  );
  const controller = makeController(options.signal);
  const total = pairs.length;
  let done = 0;
  let errors = 0;
  const waves = 18;
  const chunk = Math.max(1, Math.ceil(total / waves));
  const stops = options.stopNames.map((name) => ({
    name,
    arrival: null,
    departure: null,
    halt: null,
    duration: null,
    sellable: true,
  }));
  options.onProgress({ done: 0, total, current: "", errors: 0, cached: 0 });

  for (let index = 0; index < pairs.length; index++) {
    if (controller.signal.aborted) return { aborted: true };
    const [i, j] = pairs[index];
    if (options.sellable[i] && options.sellable[j]) {
      const info = demoPair(
        options.trainNumber,
        options.date,
        options.cls,
        stops,
        i,
        j,
        options.fi,
        options.ti,
      );
      options.onPair(i, j, info);
    }
    done++;
    if (index % chunk === 0 || index === pairs.length - 1) {
      options.onProgress({
        done,
        total,
        current: `${options.stopNames[i]} → ${options.stopNames[j]}`,
        errors,
        cached: 0,
      });
      await abortableSleep(70, controller.signal);
    }
  }

  return { aborted: controller.signal.aborted };
}
