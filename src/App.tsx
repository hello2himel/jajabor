import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import type {
  AppData,
  Counts,
  FormState,
  FoundRoute,
  Mode,
  ScanSpeed,
  Session,
} from "./types";
import { CLASS_BY_CODE } from "./types";
import { loadAppData } from "./lib/data";
import { findRoutes, pairKey } from "./lib/engine";
import {
  addDaysISO,
  bookingLimitISO,
  nextRunningDate,
  prettyStation,
  stationKey,
  todayISO,
  trainRunsOn,
} from "./lib/format";
import { getSelection, resolveTrain } from "./lib/selection";
import { runDemoScan, runLiveScan, ScanFatalError, type ScanProgress } from "./lib/scan";
import { apiErrorMessage, resolveApiBase, apiHealth } from "./lib/api";
import { clearSession, decodeToken, loadSession, saveSession } from "./lib/session";
import { scrollIntoView } from "./lib/hooks";
import { Header, BrandMark } from "./components/Header";
import { Hero } from "./components/Hero";
import { SearchCard } from "./components/SearchCard";
import { StatsStrip } from "./components/StatsStrip";
import { Workspace, type ScanMeta } from "./components/Workspace";
import { WhySplit, HowItWorks, FAQ } from "./components/HowItWorks";
import { Footer } from "./components/Footer";
import { SessionModal } from "./components/SessionModal";
import { Toast, type ToastMessage } from "./components/Toast";

type ScanStatus = "idle" | "scanning" | "done" | "stopped" | "error";

const EMPTY_PROGRESS: ScanProgress = {
  done: 0,
  total: 0,
  current: "",
  errors: 0,
  cached: 0,
};

function baseForm(): FormState {
  const tomorrow = addDaysISO(todayISO(), 1);
  return {
    train: "734",
    from: "Saidpur",
    to: "Rajshahi",
    date: tomorrow,
    cls: "SNIGDHA",
    gap: 2,
    speed: "balanced",
    deep: false,
  };
}

function readModeParam(): Mode {
  if (typeof window === "undefined") return "demo";
  return new URLSearchParams(window.location.search).get("mode") === "live" ? "live" : "demo";
}

function initialForm(data: AppData, base: FormState): FormState {
  const params = new URLSearchParams(window.location.search);
  const requestedTrain = params.get("train") || base.train;
  const train =
    resolveTrain(data.trains, requestedTrain) ||
    resolveTrain(data.trains, base.train) ||
    data.trains.find((item) => data.routes[item.number]?.stops.length > 1) ||
    data.trains[0];
  if (!train) return base;
  const route = data.routes[train.number];
  if (!route || route.stops.length < 2) return { ...base, train: train.number };

  const findStop = (value: string | null, fallbackName: string, fallbackIndex: number) => {
    const candidates = [value, fallbackName].filter((entry): entry is string => Boolean(entry));
    for (const candidate of candidates) {
      const index = route.stops.findIndex((stop) => stationKey(stop.name) === stationKey(candidate));
      if (index >= 0) return route.stops[index].name;
    }
    return route.stops[fallbackIndex].name;
  };

  const from = prettyStation(findStop(params.get("from"), base.from, 0));
  const to = prettyStation(findStop(params.get("to"), base.to, route.stops.length - 1));

  let date = params.get("date") || base.date;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) date = base.date;
  if (date < todayISO() || date > bookingLimitISO()) date = addDaysISO(todayISO(), 1);
  if (!trainRunsOn(date, route.days)) {
    date = nextRunningDate(date, route.days) || date;
  }

  const rawClass = params.get("class") || base.cls;
  const cls = CLASS_BY_CODE[rawClass] ? rawClass : base.cls;
  const gapParam = Number(params.get("gap"));
  const gap =
    params.has("gap") && Number.isFinite(gapParam)
      ? Math.min(5, Math.max(0, Math.round(gapParam)))
      : base.gap;
  const speedParam = params.get("speed") as ScanSpeed | null;
  const speed: ScanSpeed =
    speedParam === "gentle" || speedParam === "balanced" || speedParam === "fast"
      ? speedParam
      : base.speed;

  return {
    train: train.number,
    from,
    to,
    date,
    cls,
    gap,
    speed,
    deep: params.get("deep") === "1",
  };
}

export default function App() {
  const [data, setData] = useState<AppData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [form, setForm] = useState<FormState>(baseForm);
  const [mode, setMode] = useState<Mode>(readModeParam);
  const [session, setSession] = useState<Session | null>(() => loadSession());
  const [sessionOnline, setSessionOnline] = useState<boolean | null>(null);
  const [sessionOpen, setSessionOpen] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [scanStatus, setScanStatus] = useState<ScanStatus>("idle");
  const [scanMeta, setScanMeta] = useState<ScanMeta | null>(null);
  const [counts, setCounts] = useState<Counts>({});
  const [snapshotCounts, setSnapshotCounts] = useState<Counts>({});
  const [progress, setProgress] = useState<ScanProgress>(EMPTY_PROGRESS);
  const [scanError, setScanError] = useState<ScanFatalError | Error | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const runIdRef = useRef(0);
  const halfSnapshotRef = useRef(false);

  const showToast = useCallback(
    (message: string, type: "success" | "error" | "info" = "info") =>
      setToast({ id: Date.now(), type, message }),
    [],
  );

  useEffect(() => {
    let cancelled = false;
    setLoadError(null);
    loadAppData()
      .then((loaded) => {
        if (cancelled) return;
        setData(loaded);
        setForm((current) => initialForm(loaded, current));
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setLoadError(error instanceof Error ? error.message : String(error));
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  useEffect(() => {
    if (!session?.token) {
      setSessionOnline(null);
      return;
    }
    let cancelled = false;
    setSessionOnline(null);
    const timer = window.setTimeout(() => {
      apiHealth(resolveApiBase(session)).then((health) => {
        if (!cancelled) setSessionOnline(health.ok);
      });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [session]);

  useEffect(() => {
    if (!scanMeta) return;
    if (scanStatus !== "scanning") {
      setSnapshotCounts(counts);
      halfSnapshotRef.current = false;
      return;
    }
    if (
      !halfSnapshotRef.current &&
      progress.total > 0 &&
      progress.done >= Math.floor(progress.total / 2)
    ) {
      halfSnapshotRef.current = true;
      setSnapshotCounts(counts);
    }
  }, [scanStatus, counts, progress.done, progress.total, scanMeta]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const selection = useMemo(() => (data ? getSelection(data, form) : null), [data, form]);

  const routes: FoundRoute[] = useMemo(() => {
    if (!scanMeta) return [];
    return findRoutes(
      scanMeta.route.stops.map((stop) => stop.name),
      snapshotCounts,
      scanMeta.fi,
      scanMeta.ti,
      scanMeta.form.gap,
    );
  }, [scanMeta, snapshotCounts]);

  function handleFormChange(patch: Partial<FormState>) {
    setForm((current) => {
      const next = { ...current, ...patch };
      if (patch.gap !== undefined) next.gap = Math.min(5, Math.max(0, patch.gap));
      return next;
    });
  }

  function handleTrainChange(number: string) {
    if (!data) return;
    const train = data.trains.find((item) => item.number === number);
    const route = data.routes[number];
    if (!train || !route) {
      handleFormChange({ train: number });
      return;
    }
    const fromValid = route.stops.some((stop) => stationKey(stop.name) === stationKey(form.from));
    const toValid = route.stops.some((stop) => stationKey(stop.name) === stationKey(form.to));
    let date = form.date;
    if (!trainRunsOn(date, route.days)) {
      date = nextRunningDate(date, route.days) || date;
    }
    setForm((current) => ({
      ...current,
      train: number,
      from: fromValid ? current.from : prettyStation(route.stops[0].name),
      to: toValid ? current.to : prettyStation(route.stops[route.stops.length - 1].name),
      date,
    }));
    if (date !== form.date) {
      showToast(`That train doesn't run on the selected day — moved to ${date}.`, "info");
    }
  }

  function handleSwap() {
    setForm((current) => ({ ...current, from: current.to, to: current.from }));
  }

  function handleModeChange(next: Mode) {
    setMode(next);
    if (next === "live") {
      const expired = Boolean(session?.token && decodeToken(session.token).expired);
      if (!session?.token || expired) {
        setSessionError(
          expired
            ? "That railway session has expired. Log in again and paste a fresh session to scan live."
            : null,
        );
        setSessionOpen(true);
      }
    }
  }

  function openSession(message?: string) {
    setSessionError(message || null);
    setSessionOpen(true);
  }

  function handleSaveSession(value: Session) {
    setSession(value);
    saveSession(value);
    setMode("live");
    setSessionOpen(false);
    setSessionError(null);
    showToast("Session saved. Live mode is ready.", "success");
  }

  function handleClearSession() {
    clearSession();
    setSession(null);
    setSessionOnline(null);
    setMode("demo");
    showToast("Session removed. Back to demo mode.", "info");
  }

  function writeUrl(meta: ScanMeta, scanMode: Mode) {
    const params = new URLSearchParams();
    params.set("train", meta.train.number);
    params.set("from", prettyStation(meta.route.stops[meta.fi].name));
    params.set("to", prettyStation(meta.route.stops[meta.ti].name));
    params.set("date", meta.form.date);
    params.set("class", meta.form.cls);
    params.set("gap", String(meta.form.gap));
    params.set("speed", meta.form.speed);
    params.set("mode", scanMode);
    if (meta.form.deep) params.set("deep", "1");
    const next = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState(null, "", next);
  }

  async function startScan(overrideMode?: Mode) {
    if (!data || scanStatus === "scanning") return;
    const scanMode = overrideMode || mode;
    const current = getSelection(data, form);

    if (!current.train) {
      showToast("Pick a train from the list first.", "error");
      scrollIntoView("search");
      return;
    }
    if (!current.route) {
      showToast("The timetable for that train is missing. Try another train.", "error");
      return;
    }
    if (!current.stationsValid) {
      showToast("One of those stations isn't a stop on this train.", "error");
      scrollIntoView("search");
      return;
    }
    if (!current.directionValid) {
      showToast(
        `This train runs ${prettyStation(current.stops[0].name)} → ${prettyStation(
          current.stops[current.stops.length - 1].name,
        )}. Swap your stations or pick the return train.`,
        "error",
      );
      return;
    }
    if (!form.date) {
      showToast("Pick a journey date.", "error");
      return;
    }
    if (form.date < todayISO() || form.date > bookingLimitISO()) {
      showToast("The railway opens bookings 10 days ahead. Pick a closer date.", "error");
      return;
    }
    if (!trainRunsOn(form.date, current.route.days)) {
      const next = nextRunningDate(form.date, current.route.days);
      showToast(
        next
          ? `This train doesn't run that day. Next run: ${next}.`
          : "This train doesn't run on the selected day.",
        "error",
      );
      return;
    }
    if (current.pairCount === 0) {
      showToast("No sellable station pairs around this trip. Try another class or trip.", "error");
      return;
    }
    if (scanMode === "live" && !session?.token) {
      openSession("Live mode needs a railway session. Connect one, or switch to demo.");
      return;
    }
    if (scanMode === "live" && session?.token) {
      const token = decodeToken(session.token);
      if (token.expired) {
        openSession(
          "That railway session has expired. Log in again and paste a fresh session to scan live.",
        );
        return;
      }
    }
    if (!current.stops[current.fi].sellable || !current.stops[current.ti].sellable) {
      showToast(
        "Tickets aren't sold online at one of those stops. You can still board there — Jajabor will buy around it.",
        "info",
      );
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const runId = ++runIdRef.current;
    halfSnapshotRef.current = false;

    const resolvedForm: FormState = {
      ...form,
      train: current.train.number,
      from: prettyStation(current.stops[current.fi].name),
      to: prettyStation(current.stops[current.ti].name),
      cls: CLASS_BY_CODE[form.cls] ? form.cls : "SNIGDHA",
    };
    setForm(resolvedForm);

    const meta: ScanMeta = {
      train: current.train,
      route: current.route,
      form: resolvedForm,
      fi: current.fi,
      ti: current.ti,
      startedAt: Date.now(),
      mode: scanMode,
      pairTotal: current.pairCount,
    };

    setScanMeta(meta);
    setCounts({});
    setSnapshotCounts({});
    setProgress({ ...EMPTY_PROGRESS, total: current.pairCount });
    setScanError(null);
    setScanStatus("scanning");
    setMode(scanMode);
    writeUrl(meta, scanMode);
    scrollIntoView("workspace");

    const onPair = (i: number, j: number, info: Counts[string]) => {
      setCounts((previous) => ({ ...previous, [pairKey(i, j)]: info }));
    };
    const onProgress = (next: ScanProgress) => setProgress(next);

    try {
      if (scanMode === "demo") {
        await runDemoScan({
          trainNumber: current.train.number,
          date: resolvedForm.date,
          cls: resolvedForm.cls,
          stopNames: current.stops.map((stop) => stop.name),
          sellable: current.sellable,
          fi: current.fi,
          ti: current.ti,
          gap: resolvedForm.gap,
          deep: resolvedForm.deep,
          speed: resolvedForm.speed,
          signal: controller.signal,
          onPair,
          onProgress,
        });
      } else {
        await runLiveScan({
          trainNumber: current.train.number,
          date: resolvedForm.date,
          cls: resolvedForm.cls,
          stopNames: current.stops.map((stop) => stop.name),
          sellable: current.sellable,
          fi: current.fi,
          ti: current.ti,
          gap: resolvedForm.gap,
          deep: resolvedForm.deep,
          speed: resolvedForm.speed,
          signal: controller.signal,
          session: session!,
          apiBase: resolveApiBase(session),
          onPair,
          onProgress,
        });
      }

      if (runId !== runIdRef.current) return;
      if (controller.signal.aborted) {
        setScanStatus("stopped");
        showToast("Scan stopped. Showing the pairs checked so far.", "info");
      } else {
        setScanStatus("done");
        showToast("Scan complete. Here are the best combinations.", "success");
      }
    } catch (caught) {
      if (runId !== runIdRef.current) return;
      if (controller.signal.aborted) {
        setScanStatus("stopped");
        return;
      }
      const error = caught instanceof Error ? caught : new Error(String(caught));
      setScanError(error);
      setScanStatus("error");
      if (error instanceof ScanFatalError && error.code === "auth") {
        setSessionError(error.message);
      }
      if (!(error instanceof ScanFatalError)) {
        showToast(apiErrorMessage(error), "error");
      }
    } finally {
      if (runId === runIdRef.current) abortRef.current = null;
    }
  }

  function stopScan() {
    abortRef.current?.abort();
  }

  async function handleShare() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      showToast("Search link copied to the clipboard.", "success");
    } catch {
      showToast("Couldn't copy the link — you can copy it from the address bar.", "error");
    }
  }

  function useClass(code: string) {
    handleFormChange({ cls: code });
    showToast(`Class changed to ${CLASS_BY_CODE[code]?.label || code}. Scan again when ready.`, "info");
    scrollIntoView("search");
  }

  if (!data) {
    return (
      <div className="boot">
        <div className="boot__mark">
          <BrandMark size={54} />
        </div>
        {loadError ? (
          <>
            <h1>We lost the timetable.</h1>
            <p>{loadError}</p>
            <button
              type="button"
              className="button button--green"
              onClick={() => setReloadKey((key) => key + 1)}
            >
              <RefreshCw size={15} /> Try again
            </button>
            <div className="boot__error">
              <AlertTriangle size={14} /> If this is a static deployment, check that{" "}
              <code>data/*.json</code> was deployed with the site.
            </div>
          </>
        ) : (
          <>
            <h1>Reading the timetable…</h1>
            <p>Loading every train, stop, and station pair.</p>
            <Loader2 size={22} className="spin boot__spinner" />
          </>
        )}
      </div>
    );
  }

  const stationCount = new Set(data.stations.map((station) => station.city_name)).size;

  return (
    <>
      <Header
        mode={mode}
        session={session}
        sessionOnline={sessionOnline}
        onModeChange={handleModeChange}
        onOpenSession={() => openSession()}
        onHome={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      />

      <main>
        <Hero
          onStart={() => scrollIntoView("search")}
          onHow={() => scrollIntoView("why")}
          trainCount={data.trains.length}
          stationCount={stationCount}
        />

        <div className="container search-overlap">
          <SearchCard
            data={data}
            form={form}
            mode={mode}
            session={session}
            sessionOnline={sessionOnline}
            scanning={scanStatus === "scanning"}
            onFormChange={handleFormChange}
            onTrainChange={handleTrainChange}
            onModeChange={handleModeChange}
            onOpenSession={() => openSession()}
            onScan={() => void startScan()}
            onSwap={handleSwap}
          />
        </div>

        <StatsStrip data={data} />

        {scanMeta && (
          <Workspace
            meta={scanMeta}
            counts={counts}
            snapshotCounts={snapshotCounts}
            routes={routes}
            status={scanStatus === "idle" ? "stopped" : scanStatus}
            progress={progress}
            error={scanError}
            session={session}
            onStop={stopScan}
            onRescan={() => void startScan()}
            onOpenSession={() => {
              setSessionError(scanError instanceof Error ? scanError.message : null);
              setSessionOpen(true);
            }}
            onShare={() => void handleShare()}
            onUseDemo={() => {
              setMode("demo");
              void startScan("demo");
            }}
            onUseClass={useClass}
            onToast={showToast}
          />
        )}

        <WhySplit />
        <HowItWorks />
        <FAQ />
      </main>

      <Footer />

      <SessionModal
        open={sessionOpen}
        onClose={() => setSessionOpen(false)}
        session={session}
        sessionOnline={sessionOnline}
        initialError={sessionError}
        onSave={handleSaveSession}
        onClear={handleClearSession}
      />

      <Toast toast={toast} onClose={() => setToast(null)} />
    </>
  );
}
