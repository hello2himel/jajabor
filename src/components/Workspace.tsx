import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Database,
  KeyRound,
  Loader2,
  Play,
  RotateCcw,
  Share2,
  Sparkles,
  Square,
  Ticket,
  TrainFront,
  Wifi,
  WifiOff,
} from "lucide-react";
import type { Counts, FormState, FoundRoute, Mode, Session, Train, TrainRoute } from "../types";
import { CLASS_BY_CODE, SPEED_MS } from "../types";
import type { ScanFatalError } from "../lib/scan";
import type { ScanProgress } from "../lib/scan";
import { pairKey } from "../lib/engine";
import {
  bdt,
  formatMinutes,
  longDate,
  prettyStation,
  seatsLabel,
} from "../lib/format";
import { scrollIntoView } from "../lib/hooks";
import { Matrix } from "./Matrix";
import { RouteTimeline } from "./RouteTimeline";
import { RouteResults } from "./RouteResults";

export interface ScanMeta {
  train: Train;
  route: TrainRoute;
  form: FormState;
  fi: number;
  ti: number;
  startedAt: number;
  mode: Mode;
  pairTotal: number;
}

interface WorkspaceProps {
  meta: ScanMeta;
  counts: Counts;
  snapshotCounts: Counts;
  routes: FoundRoute[];
  status: "scanning" | "done" | "stopped" | "error";
  progress: ScanProgress;
  error: ScanFatalError | Error | null;
  session: Session | null;
  onStop: () => void;
  onRescan: () => void;
  onOpenSession: () => void;
  onShare: () => void;
  onUseDemo: () => void;
  onUseClass: (cls: string) => void;
  onToast: (message: string, type?: "success" | "error" | "info") => void;
}

export function Workspace({
  meta,
  counts,
  snapshotCounts,
  routes,
  status,
  progress,
  error,
  session,
  onStop,
  onRescan,
  onOpenSession,
  onShare,
  onUseDemo,
  onUseClass,
  onToast,
}: WorkspaceProps) {
  const [now, setNow] = useState(Date.now());
  const { train, route, form, fi, ti } = meta;
  const stops = route.stops;
  const classInfo = CLASS_BY_CODE[form.cls];
  const direct = snapshotCounts[pairKey(fi, ti)];

  useEffect(() => {
    if (status !== "scanning") return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [status]);

  const percent = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;
  const elapsed = Math.max(0, Math.round((now - meta.startedAt) / 1000));
  const remaining = Math.max(0, progress.total - progress.done);
  const eta = Math.ceil((remaining * SPEED_MS[form.speed]) / 1000);
  const availablePairs = useMemo(
    () => Object.values(snapshotCounts).filter((value) => value && value.online > 0).length,
    [snapshotCounts],
  );
  const suspicious =
    error instanceof Error && "code" in error ? (error as ScanFatalError) : null;

  return (
    <section className="workspace section" id="workspace" aria-labelledby="workspace-title">
      <div className="container">
        <div className="workspace__head">
          <div className="workspace__title">
            <span className="eyebrow eyebrow--dark">
              {status === "scanning" ? "Scanning now" : "Your scan"}
            </span>
            <h2 id="workspace-title">
              {train.name} <span className="workspace__route">
                {prettyStation(stops[fi]?.name || form.from)} <ArrowRight size={18} />{" "}
                {prettyStation(stops[ti]?.name || form.to)}
              </span>
            </h2>
            <div className="workspace__chips">
              <span>
                <Clock3 size={13} /> {longDate(form.date)}
              </span>
              <span>
                <Ticket size={13} /> {classInfo?.label || form.cls}
              </span>
              <span>
                <TrainFront size={13} /> {stops.length} stops
              </span>
              <span className={meta.mode === "live" ? "chip-live" : "chip-demo"}>
                {meta.mode === "live" ? <Wifi size={13} /> : <Sparkles size={13} />}
                {meta.mode === "live" ? "Live seats" : "Sample seats"}
              </span>
            </div>
          </div>
          <div className="workspace__actions">
            <button type="button" className="button button--small button--outline" onClick={onShare}>
              <Share2 size={14} /> Share
            </button>
            {status === "scanning" ? (
              <button type="button" className="button button--small button--stop" onClick={onStop}>
                <Square size={13} /> Stop scan
              </button>
            ) : (
              <button type="button" className="button button--small button--green" onClick={onRescan}>
                <RotateCcw size={14} /> Scan again
              </button>
            )}
          </div>
        </div>

        <div className={`scan-panel scan-panel--${status}`}>
          {status === "error" && suspicious ? (
            <ScanErrorPanel
              error={suspicious}
              session={session}
              onOpenSession={onOpenSession}
              onRescan={onRescan}
              onUseDemo={onUseDemo}
              onUseClass={onUseClass}
            />
          ) : (
            <>
              <div className="scan-panel__top">
                <div className="scan-panel__status">
                  <span className={`scan-status-dot scan-status-dot--${status}`} aria-hidden>
                    {status === "scanning" ? (
                      <Loader2 size={16} className="spin" />
                    ) : status === "done" ? (
                      <CheckCircle2 size={17} />
                    ) : (
                      <Square size={14} />
                    )}
                  </span>
                  <div>
                    <strong>
                      {status === "scanning"
                        ? "Checking station pairs"
                        : status === "done"
                          ? "Scan complete"
                          : "Scan stopped"}
                    </strong>
                    <span>
                      {status === "scanning"
                        ? `${progress.current || "Warming up…"} · ${percent}%`
                        : status === "done"
                          ? `${progress.total} pairs checked${progress.errors ? ` · ${progress.errors} lookups failed` : ""}`
                          : `${progress.done} of ${progress.total} pairs checked`}
                    </span>
                  </div>
                </div>
                <div className="scan-panel__stats">
                  <div>
                    <strong>{progress.done}</strong>
                    <span>checked</span>
                  </div>
                  <div>
                    <strong>{availablePairs}</strong>
                    <span>pairs with seats</span>
                  </div>
                  <div>
                    <strong>
                      {status === "scanning" ? (eta > 60 ? formatMinutes(Math.ceil(eta / 60)) : `${eta}s`) : formatMinutes(Math.ceil(elapsed / 60))}
                    </strong>
                    <span>{status === "scanning" ? "left" : "elapsed"}</span>
                  </div>
                  <div>
                    <strong>{direct === undefined ? "—" : direct === null ? "×" : direct.online}</strong>
                    <span>direct seats</span>
                  </div>
                </div>
              </div>

              <div
                className="progress-track"
                role="progressbar"
                aria-label="Station pair scan progress"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={percent}
              >
                <span className="progress-fill" style={{ width: `${Math.max(2, percent)}%` }} />
              </div>

              <div className="scan-panel__foot">
                <span>
                  <Database size={13} />
                  {progress.cached > 0
                    ? `${progress.cached} cached pair${progress.cached === 1 ? "" : "s"} reused · `
                    : ""}
                  {meta.mode === "demo"
                    ? "Simulated seats for exploring the planner"
                    : `Live lookups · ${session ? "your session" : "no session"}`}
                </span>
                <span>
                  {meta.mode === "live" && session ? (
                    <>
                      <Wifi size={13} /> Session loaded
                    </>
                  ) : meta.mode === "live" ? (
                    <>
                      <WifiOff size={13} /> Session needed
                    </>
                  ) : (
                    <>
                      <Sparkles size={13} /> Demo mode
                    </>
                  )}
                </span>
              </div>
            </>
          )}
        </div>

        <div className="workspace__grid">
          <RouteTimeline stops={stops} fi={fi} ti={ti} days={route.days} duration={route.duration} />
          <Matrix
            stops={stops}
            counts={snapshotCounts}
            fi={fi}
            ti={ti}
            pending={status === "scanning"}
          />
        </div>

        <RouteResults
          routes={routes}
          stops={stops}
          counts={snapshotCounts}
          fi={fi}
          ti={ti}
          date={form.date}
          cls={form.cls}
          trainLabel={train.label}
          mode={meta.mode}
          scanning={status === "scanning"}
          stopped={status === "stopped"}
          progress={progress}
          onRescan={onRescan}
          onShare={onShare}
          onToast={onToast}
        />

        {status === "error" && !suspicious && (
          <div className="scan-error">
            <AlertTriangle size={18} />
            <div>
              <strong>Something interrupted the scan.</strong>
              <p>{error instanceof Error ? error.message : String(error)}</p>
            </div>
            <button type="button" className="button button--small button--green" onClick={onRescan}>
              Try again
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

interface ScanErrorPanelProps {
  error: ScanFatalError;
  session: Session | null;
  onOpenSession: () => void;
  onRescan: () => void;
  onUseDemo: () => void;
  onUseClass: (cls: string) => void;
}

function ScanErrorPanel({
  error,
  session,
  onOpenSession,
  onRescan,
  onUseDemo,
  onUseClass,
}: ScanErrorPanelProps) {
  const titles: Record<ScanFatalError["code"], string> = {
    auth: "Your railway session needs a refresh",
    proxy: "The proxy isn't answering",
    "not-running": "This train wasn't found on that date",
    "class-missing": "That class isn't offered here",
  };

  return (
    <div className="scan-error-panel">
      <span className="scan-error-panel__icon">
        {error.code === "class-missing" ? <Ticket size={20} /> : <AlertTriangle size={20} />}
      </span>
      <div className="scan-error-panel__body">
        <strong>{titles[error.code]}</strong>
        <p>{error.message}</p>
        {error.detail && <p className="scan-error-panel__detail">{error.detail}</p>}

        {error.code === "proxy" && (
          <div className="scan-error-panel__code">
            <code>npm install &amp;&amp; npm run live</code>
            <span>then open http://localhost:8788 or set the proxy address in Settings.</span>
          </div>
        )}

        {error.code === "class-missing" && error.classes && error.classes.length > 0 && (
          <div className="class-suggestions">
            <span>Classes on this train:</span>
            {error.classes.map((code) => (
              <button type="button" key={code} onClick={() => onUseClass(code)}>
                {CLASS_BY_CODE[code]?.label || code}
              </button>
            ))}
          </div>
        )}

        {error.code === "not-running" && error.trainNames && error.trainNames.length > 0 && (
          <div className="class-suggestions">
            <span>Trains returned instead:</span>
            {error.trainNames.map((name) => (
              <span className="train-name-chip" key={name}>
                {name}
              </span>
            ))}
          </div>
        )}

        <div className="scan-error-panel__actions">
          {error.code === "auth" || error.code === "proxy" ? (
            <button type="button" className="button button--small button--green" onClick={onOpenSession}>
              <KeyRound size={14} /> {error.code === "auth" ? "Reconnect session" : "Open settings"}
            </button>
          ) : null}
          {error.code === "not-running" && (
            <button
              type="button"
              className="button button--small button--outline"
              onClick={() => scrollIntoView("search")}
            >
              Change date or train
            </button>
          )}
          {error.code === "class-missing" ? (
            <button type="button" className="button button--small button--outline" onClick={() => scrollIntoView("search")}>
              Pick another class
            </button>
          ) : (
            <button type="button" className="button button--small button--outline" onClick={onRescan}>
              <RotateCcw size={14} /> Try again
            </button>
          )}
          <button type="button" className="button button--small button--ghost-dark" onClick={onUseDemo}>
            <Play size={13} /> Use demo instead
          </button>
          {session && error.code === "auth" && (
            <span className="scan-error-panel__hint">The old token is still loaded until you replace it.</span>
          )}
        </div>
      </div>
    </div>
  );
}
