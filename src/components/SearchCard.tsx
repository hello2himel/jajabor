import { useMemo } from "react";
import {
  ArrowLeftRight,
  ArrowRight,
  CalendarDays,
  ChevronDown,
  Clock3,
  Info,
  KeyRound,
  Minus,
  Plus,
  Settings2,
  Sparkles,
  Ticket,
  TrainFront,
  Wifi,
  WifiOff,
  Zap,
} from "lucide-react";
import type { AppData, FormState, Mode, Session } from "../types";
import { SPEED_MS } from "../types";
import { ClassPicker } from "./ClassPicker";
import { Combobox } from "./Combobox";
import { getSelection } from "../lib/selection";
import { decodeToken } from "../lib/session";
import {
  bookingLimitISO,
  dayShort,
  formatMinutes,
  mediumDate,
  minutesBetween,
  prettyStation,
  stopDuration,
  todayISO,
} from "../lib/format";

interface SearchCardProps {
  data: AppData;
  form: FormState;
  mode: Mode;
  session: Session | null;
  sessionOnline: boolean | null;
  scanning: boolean;
  onFormChange: (patch: Partial<FormState>) => void;
  onTrainChange: (number: string) => void;
  onModeChange: (mode: Mode) => void;
  onOpenSession: () => void;
  onScan: () => void;
  onSwap: () => void;
}

const DAY_ORDER = ["Fri", "Sat", "Sun", "Mon", "Tue", "Wed", "Thu"];

export function SearchCard({
  data,
  form,
  mode,
  session,
  sessionOnline,
  scanning,
  onFormChange,
  onTrainChange,
  onModeChange,
  onOpenSession,
  onScan,
  onSwap,
}: SearchCardProps) {
  const selection = useMemo(() => getSelection(data, form), [data, form]);
  const { train, route, stops, fi, ti, directionValid, stationsValid, runsOnDate } = selection;
  const tokenInfo = session?.token ? decodeToken(session.token) : null;
  const pairCount = selection.pairCount;
  const estimateSeconds = mode === "demo" ? 2 : Math.ceil((pairCount * SPEED_MS[form.speed]) / 1000);
  const bookingMax = bookingLimitISO();
  const dateInWindow = form.date >= todayISO() && form.date <= bookingMax;

  const trainOptions = useMemo(
    () => data.trains.filter((item) => data.routes[item.number]?.stops.length > 1).map((item) => item.number),
    [data],
  );
  const stationOptions = useMemo(() => {
    if (route) return route.stops.filter((stop) => stop.sellable).map((stop) => stop.name);
    return data.stations.map((station) => station.city_name);
  }, [route, data.stations]);

  const trainMeta = (number: string) => {
    const item = data.trains.find((candidate) => candidate.number === number);
    if (!item) return "";
    return `${item.number} · ${prettyStation(item.origin)} → ${prettyStation(item.destination)} · ${item.stopCount} stops`;
  };

  const stationMeta = (name: string) => {
    const stop = stops.find((candidate) => candidate.name === name);
    if (stop) return stop.sellable ? "Tickets sold online" : "No online ticket sales here";
    return "Station";
  };

  const fromStop = fi >= 0 ? stops[fi] : null;
  const toStop = ti >= 0 ? stops[ti] : null;
  const tripMinutes =
    fromStop && toStop ? minutesBetween(fromStop.departure || fromStop.arrival, toStop.arrival) : null;
  const fromNotSellable = fromStop && !fromStop.sellable;
  const toNotSellable = toStop && !toStop.sellable;

  const sessionLabel =
    mode === "demo"
      ? "Sample availability"
      : tokenInfo?.expired
        ? "Live · session expired"
        : session
          ? sessionOnline === false
            ? "Proxy offline"
            : sessionOnline === true
              ? "Live · connected"
              : "Live · session loaded"
          : "Live · connect session";

  return (
    <section className="search-card" id="search" aria-labelledby="search-heading">
      <div className="search-card__top">
        <div className="search-card__heading">
          <span className="eyebrow eyebrow--dark">Plan a journey</span>
          <h2 id="search-heading">Where are you going?</h2>
        </div>
        <div className="search-card__controls">
          <div className="mode-switch" role="tablist" aria-label="Availability source">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "demo"}
              className={mode === "demo" ? "is-active" : ""}
              onClick={() => onModeChange("demo")}
              title="Explore with realistic sample availability"
            >
              <Sparkles size={13} /> Demo
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "live"}
              className={mode === "live" ? "is-active" : ""}
              onClick={() => onModeChange("live")}
              title="Check live seats with your own railway session"
            >
              <Wifi size={13} /> Live
            </button>
          </div>
          <button
            type="button"
            className={`session-chip ${
              mode === "demo"
                ? "session-chip--demo"
                : tokenInfo?.expired
                  ? "session-chip--bad"
                  : session
                    ? sessionOnline === false
                      ? "session-chip--bad"
                      : "session-chip--good"
                    : "session-chip--warn"
            }`}
            onClick={onOpenSession}
            title={
              tokenInfo?.expiresAt
                ? `Session expires ${new Date(tokenInfo.expiresAt).toLocaleString()}`
                : "Open session settings"
            }
          >
            {mode === "demo" ? (
              <Sparkles size={13} />
            ) : session ? (
              sessionOnline === false ? (
                <WifiOff size={13} />
              ) : (
                <Wifi size={13} />
              )
            ) : (
              <KeyRound size={13} />
            )}
            {sessionLabel}
          </button>
        </div>
      </div>

      <div className="search-grid">
        <div className="field field--train">
          <label htmlFor="train-input">Train</label>
          <Combobox
            id="train-input"
            value={train?.number || form.train}
            displayValue={train?.label || form.train}
            placeholder="Name or number, e.g. Titumir or 734"
            options={trainOptions}
            labelFor={(number) =>
              data.trains.find((item) => item.number === number)?.name || number
            }
            metaFor={trainMeta}
            onInput={(text) => onFormChange({ train: text })}
            onSelect={(number) => onTrainChange(number)}
            invalid={!train && Boolean(form.train)}
            noResults="No train matches. Try a number like 734."
          />
        </div>

        <div className="field field--date">
          <label htmlFor="date-input">Journey date</label>
          <div className="input-wrap">
            <CalendarDays size={15} className="input-icon" aria-hidden />
            <input
              id="date-input"
              className="text-input"
              type="date"
              value={form.date}
              min={todayISO()}
              max={bookingMax}
              onChange={(event) => onFormChange({ date: event.target.value })}
            />
          </div>
          <span className="field-hint">Bookings open 10 days ahead</span>
        </div>

        <div className="field field--class">
          <label htmlFor="class-picker">Class</label>
          <ClassPicker value={form.cls} onChange={(cls) => onFormChange({ cls })} />
          <span className="field-hint">One class per scan</span>
        </div>

        <div className="field field--from">
          <label htmlFor="from-input">From</label>
          <Combobox
            id="from-input"
            value={form.from}
            displayValue={prettyStation(form.from)}
            placeholder="Boarding station"
            options={stationOptions}
            labelFor={prettyStation}
            metaFor={stationMeta}
            onInput={(text) => onFormChange({ from: text })}
            onSelect={(name) => onFormChange({ from: prettyStation(name) })}
            invalid={Boolean(form.from) && !stationsValid}
          />
        </div>

        <div className="swap-cell">
          <button
            type="button"
            className="swap-button"
            onClick={onSwap}
            aria-label="Swap boarding and destination stations"
            title="Swap stations"
          >
            <ArrowLeftRight size={16} />
          </button>
        </div>

        <div className="field field--to">
          <label htmlFor="to-input">To</label>
          <Combobox
            id="to-input"
            value={form.to}
            displayValue={prettyStation(form.to)}
            placeholder="Destination station"
            options={stationOptions}
            labelFor={prettyStation}
            metaFor={stationMeta}
            onInput={(text) => onFormChange({ to: text })}
            onSelect={(name) => onFormChange({ to: prettyStation(name) })}
            invalid={Boolean(form.to) && !stationsValid}
          />
        </div>

        <div className="field field--gap">
          <label htmlFor="gap-value">No-ticket hops</label>
          <div className="stepper">
            <button
              type="button"
              aria-label="Fewer no-ticket hops"
              disabled={form.gap <= 0}
              onClick={() => onFormChange({ gap: Math.max(0, form.gap - 1) })}
            >
              <Minus size={14} />
            </button>
            <output id="gap-value" aria-live="polite">
              <strong>{form.gap}</strong>
              <span>{form.gap === 0 ? "fully covered" : "allowed"}</span>
            </output>
            <button
              type="button"
              aria-label="More no-ticket hops"
              disabled={form.gap >= 5}
              onClick={() => onFormChange({ gap: Math.min(5, form.gap + 1) })}
            >
              <Plus size={14} />
            </button>
          </div>
          <span className="field-hint">Stretches without a reserved seat</span>
        </div>

        <div className="scan-cell">
          <button
            type="button"
            className={`scan-button ${scanning ? "is-busy" : ""}`}
            onClick={onScan}
            disabled={scanning}
          >
            {scanning ? (
              <>
                <span className="scan-button__pulse" aria-hidden /> Scanning…
              </>
            ) : (
              <>
                Find split tickets <ArrowRight size={18} />
              </>
            )}
          </button>
        </div>
      </div>

      <div className="search-subrow">
        <details className="advanced">
          <summary>
            <Settings2 size={14} /> Scan settings <ChevronDown size={14} className="advanced__chev" />
          </summary>
          <div className="advanced__body">
            <div className="advanced__group">
              <span className="mini-label">Request pace</span>
              <div className="speed-switch" role="group" aria-label="Request pace">
                {(
                  [
                    ["gentle", "Gentle"],
                    ["balanced", "Balanced"],
                    ["fast", "Fast"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    type="button"
                    key={value}
                    className={form.speed === value ? "is-active" : ""}
                    onClick={() => onFormChange({ speed: value })}
                  >
                    {value === "fast" && <Zap size={12} />}
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <label className="checkline">
              <input
                type="checkbox"
                checked={form.deep}
                onChange={(event) => onFormChange({ deep: event.target.checked })}
              />
              <span>
                Check the full route matrix
                <small>Pairs outside your trip too. Slower, but shows every seat on the train.</small>
              </span>
            </label>
            <p className="advanced__note">
              Jajabor asks for one station pair at a time, with a polite pause between requests.
              Faster paces may hit railway rate limits.
            </p>
          </div>
        </details>

        <div className="scan-estimate">
          <Clock3 size={14} />
          {selection.pairCount === 0 ? (
            <span>No station pairs to check yet</span>
          ) : mode === "demo" ? (
            <span>{selection.pairCount} sample pairs · instant</span>
          ) : (
            <span>
              {selection.pairCount} pairs · about{" "}
              {estimateSeconds < 60
                ? `${estimateSeconds}s`
                : formatMinutes(Math.ceil(estimateSeconds / 60))}
            </span>
          )}
        </div>
      </div>

      {train && route && (
        <div className="route-preview">
          <div className="route-preview__top">
            <div className="route-preview__title">
              <span className="train-badge">
                <TrainFront size={14} /> {train.number}
              </span>
              <strong>
                {stationsValid ? prettyStation(stops[fi]?.name || form.from) : prettyStation(form.from)}
                <ArrowRight size={14} />
                {stationsValid ? prettyStation(stops[ti]?.name || form.to) : prettyStation(form.to)}
              </strong>
              {!stationsValid && <span className="route-preview__muted">not a stop</span>}
            </div>
            <div className="route-preview__meta">
              <span>{stops.length} stops</span>
              <span>{stopDuration(route.duration)}</span>
              {directionValid && tripMinutes !== null && <span>{formatMinutes(tripMinutes)} on board</span>}
            </div>
          </div>

          <div className="day-row" aria-label="Days this train runs">
            <span className="day-row__label">Runs</span>
            {DAY_ORDER.map((day) => {
              const active = route.days.includes(day);
              return (
                <span key={day} className={`day-chip ${active ? "is-active" : ""}`} title={`${day}: ${active ? "runs" : "no service"}`}>
                  {day}
                </span>
              );
            })}
            <span className={`day-row__date ${runsOnDate ? "is-good" : "is-bad"}`}>
              {runsOnDate ? `Runs ${dayShort(form.date)}` : `No ${dayShort(form.date)} service`}
            </span>
          </div>

          <div className="micro-route" aria-hidden>
            {stops.map((stop, index) => (
              <span
                key={`${stop.name}-${index}`}
                className={`micro-stop ${index === fi ? "is-from" : ""} ${
                  index === ti ? "is-to" : ""
                } ${!stop.sellable ? "is-unsellable" : ""} ${
                  index >= fi && index <= ti && fi >= 0 && ti >= 0 ? "is-inside" : ""
                }`}
                title={`${prettyStation(stop.name)}${stop.sellable ? "" : " · no online tickets"}`}
              >
                <span className="micro-stop__dot" />
              </span>
            ))}
          </div>

          <div className="route-preview__warnings">
            {!stationsValid && (
              <div className="mini-warning">
                <Info size={14} />
                <span>
                  <strong>{prettyStation(!fromStop ? form.from : form.to)}</strong> isn&apos;t a stop on{" "}
                  {train.name}. Pick one from the list.
                </span>
              </div>
            )}
            {stationsValid && !directionValid && (
              <div className="mini-warning">
                <Info size={14} />
                <span>
                  This train runs {prettyStation(stops[0].name)} →{" "}
                  {prettyStation(stops[stops.length - 1].name)} — the other way round.
                </span>
              </div>
            )}
            {!runsOnDate && selection.nextRunDate && (
              <div className="mini-warning mini-warning--date">
                <CalendarDays size={14} />
                <span>
                  No {dayShort(form.date)} service. Next run: {mediumDate(selection.nextRunDate)}.
                </span>
                <button
                  type="button"
                  className="mini-action"
                  onClick={() => onFormChange({ date: selection.nextRunDate || form.date })}
                >
                  Use {mediumDate(selection.nextRunDate)}
                </button>
              </div>
            )}
            {!dateInWindow && (
              <div className="mini-warning">
                <Info size={14} />
                <span>The railway opens bookings 10 days ahead. Pick a date before {mediumDate(bookingMax)}.</span>
              </div>
            )}
            {(fromNotSellable || toNotSellable) && (
              <div className="mini-warning mini-warning--soft">
                <Ticket size={14} />
                <span>
                  {fromNotSellable ? prettyStation(fromStop?.name || "") : prettyStation(toStop?.name || "")}{" "}
                  has no online ticket sales. You can still board or alight there — Jajabor will buy
                  around it.
                </span>
              </div>
            )}
          </div>

          {directionValid && (
            <div className="route-preview__summary">
              <span>
                {selection.pairCount} station pair{selection.pairCount === 1 ? "" : "s"} to check
              </span>
              <span aria-hidden>·</span>
              <span>
                {fi > 0 && (
                  <>
                    {fi} stop{fi === 1 ? "" : "s"} before you board can be used too{" "}
                  </>
                )}
                {ti < stops.length - 1 && (
                  <>
                    {stops.length - 1 - ti} after you alight
                  </>
                )}
              </span>
            </div>
          )}
        </div>
      )}

      <div className="search-card__foot">
        <span>
          <Ticket size={13} /> No booking, no payment — Jajabor only finds the combinations.
        </span>
        <a href="#how" className="text-link">
          How split ticketing works <ArrowRight size={13} />
        </a>
      </div>
    </section>
  );
}
