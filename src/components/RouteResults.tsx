import { useMemo, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Banknote,
  CheckCircle2,
  ClipboardCheck,
  ExternalLink,
  Filter,
  Footprints,
  Info,
  RotateCcw,
  Sparkles,
  Ticket,
  TicketCheck,
  TrendingUp,
  Users,
} from "lucide-react";
import type { Counts, FoundRoute, Mode, Stop } from "../types";
import { CLASS_BY_CODE } from "../types";
import { pairKey, routeLabel, routeToText, ticketTiming } from "../lib/engine";
import {
  apiDate,
  bdt,
  formatMinutes,
  longDate,
  prettyStation,
  seatsLabel,
} from "../lib/format";
import { useCopy } from "../lib/hooks";
import type { ScanProgress } from "../lib/scan";

interface RouteResultsProps {
  routes: FoundRoute[];
  stops: Stop[];
  counts: Counts;
  fi: number;
  ti: number;
  date: string;
  cls: string;
  trainLabel: string;
  mode: Mode;
  scanning: boolean;
  stopped: boolean;
  progress: ScanProgress;
  onRescan: () => void;
  onShare: () => void;
  onToast: (message: string, type?: "success" | "error" | "info") => void;
}

type SortMode = "best" | "cheap" | "seats";

export function RouteResults({
  routes,
  stops,
  counts,
  fi,
  ti,
  date,
  cls,
  trainLabel,
  mode,
  scanning,
  stopped,
  progress,
  onRescan,
  onShare,
  onToast,
}: RouteResultsProps) {
  const [maxTickets, setMaxTickets] = useState(6);
  const [minSeats, setMinSeats] = useState(1);
  const [hideGaps, setHideGaps] = useState(false);
  const [sort, setSort] = useState<SortMode>("best");
  const direct = counts[pairKey(fi, ti)];
  const classInfo = CLASS_BY_CODE[cls];

  const filtered = useMemo(() => {
    const list = routes.filter(
      (route) => route.tickets <= maxTickets && route.min >= minSeats && (!hideGaps || route.gaps === 0),
    );
    if (sort === "cheap") {
      return [...list].sort((a, b) => a.fare - b.fare || a.gaps - b.gaps || a.tickets - b.tickets);
    }
    if (sort === "seats") {
      return [...list].sort((a, b) => b.min - a.min || a.gaps - b.gaps || a.tickets - b.tickets);
    }
    return list;
  }, [routes, maxTickets, minSeats, hideGaps, sort]);

  const shown = filtered.slice(0, 12);
  const cheapest = filtered.reduce<FoundRoute | null>(
    (best, route) => (!best || route.fare < best.fare ? route : best),
    null,
  );
  const best = filtered[0] || routes[0] || null;
  const hasFilters = maxTickets !== 6 || minSeats !== 1 || hideGaps;

  const openBuy = (from: string, to: string) => {
    const params = new URLSearchParams({
      fromcity: from,
      tocity: to,
      doj: apiDate(date),
      class: cls,
    });
    window.open(
      `https://eticket.railway.gov.bd/booking/train/search?${params.toString()}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  return (
    <section className="results" aria-labelledby="results-title">
      <div className="results__head">
        <div>
          <span className="eyebrow eyebrow--dark">The good part</span>
          <h2 id="results-title">
            {scanning ? "Combinations so far" : stopped ? "Partial results" : "Ways to make it work"}
          </h2>
        </div>
        <div className="results__head-actions">
          <button type="button" className="button button--small button--outline" onClick={onShare}>
            <ClipboardCheck size={14} /> Share this search
          </button>
          <button type="button" className="button button--small button--outline" onClick={onRescan}>
            <RotateCcw size={14} /> Scan again
          </button>
        </div>
      </div>

      {scanning && (
        <div className="partial-banner">
          <Sparkles size={15} />
          <span>
            Live preview from {progress.done} of {progress.total} checked pairs. More combinations
            can appear as the scan continues.
          </span>
        </div>
      )}
      {stopped && !scanning && (
        <div className="partial-banner partial-banner--amber">
          <Info size={15} />
          <span>
            You stopped early, so this only uses the {progress.done} pairs that were checked. Rescan
            to fill in the rest.
          </span>
        </div>
      )}

      <div className="result-summary">
        <div className={`summary-card summary-card--direct ${direct && direct.online > 0 ? "is-good" : ""}`}>
          <span className="summary-card__label">
            <Ticket size={14} /> Direct ticket
          </span>
          {direct === undefined ? (
            <>
              <strong>Not checked</strong>
              <small>The direct pair wasn&apos;t part of this scan.</small>
            </>
          ) : direct === null ? (
            <>
              <strong>No data</strong>
              <small>The lookup failed. Try again.</small>
            </>
          ) : direct.online > 0 ? (
            <>
              <strong>{seatsLabel(direct.online)}</strong>
              <small>
                {bdt(direct.fare)} · {classInfo?.label || cls}
              </small>
              <button
                type="button"
                className="summary-card__link"
                onClick={() => openBuy(stops[fi].name, stops[ti].name)}
              >
                Buy direct <ArrowUpRight size={12} />
              </button>
            </>
          ) : (
            <>
              <strong className="is-bad">Sold out</strong>
              <small>That&apos;s exactly why we split.</small>
            </>
          )}
        </div>

        <div className="summary-card">
          <span className="summary-card__label">
            <TicketCheck size={14} /> Best combination
          </span>
          {best ? (
            <>
              <strong>
                {best.tickets} ticket{best.tickets === 1 ? "" : "s"}
                {best.gaps > 0 && ` + ${best.gaps} hop${best.gaps === 1 ? "" : "s"}`}
              </strong>
              <small>
                {bdt(best.fare)} · {seatsLabel(best.min)} on the tightest leg
              </small>
            </>
          ) : (
            <>
              <strong>—</strong>
              <small>{scanning ? "Still checking…" : "No complete route yet"}</small>
            </>
          )}
        </div>

        <div className="summary-card">
          <span className="summary-card__label">
            <Banknote size={14} /> Cheapest find
          </span>
          {cheapest ? (
            <>
              <strong>{bdt(cheapest.fare)}</strong>
              <small>
                {cheapest.tickets} ticket{cheapest.tickets === 1 ? "" : "s"}
                {cheapest.gaps > 0 ? ` · ${cheapest.gaps} hop${cheapest.gaps === 1 ? "" : "s"}` : " · covered"}
              </small>
            </>
          ) : (
            <>
              <strong>—</strong>
              <small>
                {mode === "demo" ? "Sample availability" : "No route found"}
              </small>
            </>
          )}
        </div>

        <div className="summary-card">
          <span className="summary-card__label">
            <TrendingUp size={14} /> Options found
          </span>
          <strong>{filtered.length.toLocaleString("en-IN")}</strong>
          <small>
            {mode === "demo" ? "Simulated seats · " : "Live lookups · "}
            {progress.done}/{progress.total} pairs
          </small>
        </div>
      </div>

      {routes.length > 0 && (
        <div className="filter-bar">
          <span className="filter-bar__label">
            <Filter size={14} /> Refine
          </span>
          <label>
            Max tickets
            <select value={maxTickets} onChange={(event) => setMaxTickets(Number(event.target.value))}>
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <option value={n} key={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label>
            Min seats
            <select value={minSeats} onChange={(event) => setMinSeats(Number(event.target.value))}>
              {[1, 2, 3, 5, 8, 12].map((n) => (
                <option value={n} key={n}>
                  {n}+
                </option>
              ))}
            </select>
          </label>
          <label className="filter-check">
            <input
              type="checkbox"
              checked={hideGaps}
              onChange={(event) => setHideGaps(event.target.checked)}
            />
            Fully covered only
          </label>
          <label className="filter-sort">
            Sort
            <select value={sort} onChange={(event) => setSort(event.target.value as SortMode)}>
              <option value="best">Best match</option>
              <option value="cheap">Cheapest</option>
              <option value="seats">Most seats</option>
            </select>
          </label>
          {hasFilters && (
            <button
              type="button"
              className="filter-reset"
              onClick={() => {
                setMaxTickets(6);
                setMinSeats(1);
                setHideGaps(false);
              }}
            >
              Reset
            </button>
          )}
        </div>
      )}

      {shown.length > 0 ? (
        <>
          <div className="route-list">
            {shown.map((route, index) => (
              <RouteCard
                key={route.segs.map((seg) => `${seg.type}${seg.a}-${seg.b}`).join("|")}
                route={route}
                rank={index + 1}
                stops={stops}
                fi={fi}
                ti={ti}
                date={date}
                cls={cls}
                trainLabel={trainLabel}
                onBuy={openBuy}
                onToast={onToast}
              />
            ))}
          </div>
          {filtered.length > shown.length && (
            <p className="results__more">
              Showing the best {shown.length} of {filtered.length.toLocaleString("en-IN")} combinations.
              Tighten the filters or scan again later.
            </p>
          )}
          <p className="results__tip">
            <CheckCircle2 size={15} />
            Buy the ticket with the fewest seats first. Seat numbers can differ between tickets,
            and availability can change while you book.
          </p>
        </>
      ) : scanning ? (
        <div className="empty-state">
          <span className="empty-state__icon">
            <Sparkles size={22} />
          </span>
          <h3>Stitching combinations…</h3>
          <p>
            {routes.length === 0
              ? "No complete route has been assembled from the checked pairs yet. Keep the scan running — split options often appear once both halves of a corridor are checked."
              : "No combination matches these filters. Loosen them to see the routes already found."}
          </p>
          {routes.length > 0 && (
            <button type="button" className="button button--green" onClick={() => {
              setMaxTickets(6);
              setMinSeats(1);
              setHideGaps(false);
            }}>
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="empty-state">
          <span className="empty-state__icon empty-state__icon--sad">
            <Footprints size={22} />
          </span>
          <h3>No complete combination found.</h3>
          <p>
            {direct && direct.online > 0
              ? "There are direct seats — the filters may have hidden them."
              : "This train is tight on this date. A few things worth trying:"}
          </p>
          <ul className="empty-list">
            <li>Allow one or two no-ticket hops, if you&apos;re comfortable arranging those legs.</li>
            <li>Try a different seat class — Snigdha and AC often sell out before Shovan Chair.</li>
            <li>Enable the full route matrix in scan settings and run it again.</li>
            <li>Check a nearby date; this train may be less crowded.</li>
          </ul>
          <div className="empty-actions">
            <button type="button" className="button button--green" onClick={onRescan}>
              <RotateCcw size={15} /> Scan again
            </button>
            <button type="button" className="button button--outline" onClick={onShare}>
              Share this search
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

interface RouteCardProps {
  route: FoundRoute;
  rank: number;
  stops: Stop[];
  fi: number;
  ti: number;
  date: string;
  cls: string;
  trainLabel: string;
  onBuy: (from: string, to: string) => void;
  onToast: (message: string, type?: "success" | "error" | "info") => void;
}

function RouteCard({
  route,
  rank,
  stops,
  fi,
  ti,
  date,
  cls,
  trainLabel,
  onBuy,
  onToast,
}: RouteCardProps) {
  const { copied, copy } = useCopy();
  const classInfo = CLASS_BY_CODE[cls];
  const ticketSegments = route.segs.filter((seg) => seg.type === "ticket");
  const best = rank === 1;

  function handleCopy() {
    const text = routeToText(
      route,
      stops,
      fi,
      ti,
      `JAJABOR · ${trainLabel}`,
      longDate(date),
      classInfo?.label || cls,
    );
    void copy(text);
    onToast("Itinerary copied to the clipboard.", "success");
  }

  return (
    <article className={`route-card ${best ? "route-card--best" : ""} ${route.gaps > 0 ? "route-card--gaps" : ""}`}>
      <div className="route-card__head">
        <div className="route-card__rank">
          <span>#{rank}</span>
          {best && (
            <span className="route-card__best">
              <Sparkles size={12} /> Best match
            </span>
          )}
        </div>
        <div className="route-card__labels">
          <h3>{routeLabel(route)}</h3>
          <p>
            {bdt(route.fare)} total · {seatsLabel(route.min)} on the tightest leg
            {route.extra > 0 &&
              ` · paying for ${route.extra} extra stop${route.extra === 1 ? "" : "s"}`}
          </p>
        </div>
        <div className="route-card__actions">
          <button type="button" className="icon-text-button" onClick={handleCopy}>
            {copied ? <CheckCircle2 size={14} /> : <Ticket size={14} />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>

      <div className="route-segments">
        {route.segs.map((seg, index) => {
          if (seg.type === "ticket") {
            const fromStop = stops[seg.a];
            const toStop = stops[seg.b];
            const timing = ticketTiming(stops, seg.a, seg.b);
            return (
              <div className="segment segment--ticket" key={`ticket-${seg.a}-${seg.b}`}>
                <div className="segment__rail" aria-hidden>
                  <span className="segment__dot segment__dot--ticket">
                    <Ticket size={10} />
                  </span>
                  {index < route.segs.length - 1 && <span className="segment__line" />}
                </div>
                <div className="segment__body">
                  <div className="segment__top">
                    <div className="segment__title">
                      <strong>{prettyStation(fromStop.name)}</strong>
                      <ArrowRight size={14} />
                      <strong>{prettyStation(toStop.name)}</strong>
                    </div>
                    <span className="seat-badge">
                      <Users size={12} /> {seatsLabel(seg.info.online)}
                    </span>
                  </div>
                  <div className="segment__meta">
                    <span>
                      {timing.departure || "—"} → {timing.arrival || "—"}
                    </span>
                    <span>{bdt(seg.info.fare)}</span>
                    {seg.info.offline > 0 && <span>{seg.info.offline} at counter</span>}
                  </div>
                  {(seg.a < fi || seg.b > ti) && (
                    <div className="segment__note">
                      {seg.a < fi && (
                        <span>
                          Ticket starts {fi - seg.a} stop{fi - seg.a === 1 ? "" : "s"} before you
                          board — join at {prettyStation(stops[fi].name)}.
                        </span>
                      )}
                      {seg.b > ti && (
                        <span>
                          Ticket runs {seg.b - ti} stop{seg.b - ti === 1 ? "" : "s"} past your stop —
                          get off at {prettyStation(stops[ti].name)}.
                        </span>
                      )}
                    </div>
                  )}
                  <button
                    type="button"
                    className="segment__buy"
                    onClick={() => onBuy(fromStop.name, toStop.name)}
                  >
                    Search this ticket on the railway site <ExternalLink size={12} />
                  </button>
                </div>
              </div>
            );
          }
          return (
            <div className="segment segment--gap" key={`gap-${seg.a}-${seg.b}`}>
              <div className="segment__rail" aria-hidden>
                <span className="segment__dot segment__dot--gap">
                  <Footprints size={10} />
                </span>
                {index < route.segs.length - 1 && <span className="segment__line segment__line--gap" />}
              </div>
              <div className="segment__body">
                <div className="segment__top">
                  <div className="segment__title">
                    <strong>{prettyStation(stops[seg.a].name)}</strong>
                    <ArrowRight size={14} />
                    <strong>{prettyStation(stops[seg.b].name)}</strong>
                  </div>
                  <span className="gap-badge">
                    No ticket · {seg.b - seg.a} stop{seg.b - seg.a === 1 ? "" : "s"}
                  </span>
                </div>
                <p className="segment__gap-note">
                  Arrange this leg separately — a local service or an onboard ticket. Jajabor
                  won&apos;t book it.
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="route-card__foot">
        <div className="route-card__totals">
          <span>
            <TicketCheck size={14} /> {ticketSegments.length} ticket
            {ticketSegments.length === 1 ? "" : "s"}
          </span>
          <span>{classInfo?.label || cls}</span>
          <span>{bdt(route.fare)}</span>
        </div>
        <div className="route-card__buy">
          <span className="route-card__buy-note">
            Opens the official search for each ticket
          </span>
          <button
            type="button"
            className="button button--small button--green"
            onClick={() => ticketSegments[0] && onBuy(stops[ticketSegments[0].a].name, stops[ticketSegments[0].b].name)}
          >
            Buy first ticket <ArrowUpRight size={13} />
          </button>
        </div>
      </div>
    </article>
  );
}
