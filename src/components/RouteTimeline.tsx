import { ArrowDown, CircleDot, MapPin, Ticket, TrainFront } from "lucide-react";
import type { Stop } from "../types";
import { prettyStation, stopDuration } from "../lib/format";

interface RouteTimelineProps {
  stops: Stop[];
  fi: number;
  ti: number;
  days: string[];
  duration: string;
}

export function RouteTimeline({ stops, fi, ti, days, duration }: RouteTimelineProps) {
  const daily = days.length === 7;
  return (
    <aside className="timeline-card" aria-labelledby="timeline-title">
      <div className="timeline-card__head">
        <div>
          <span className="eyebrow eyebrow--dark">The route</span>
          <h3 id="timeline-title">
            {stops.length} stops <span>· {stopDuration(duration)}</span>
          </h3>
        </div>
        <span className="timeline-days">{daily ? "Daily" : days.join(" · ")}</span>
      </div>

      <div
        className="timeline"
        role="region"
        aria-label="Full train route — scrollable"
        tabIndex={0}
      >
        {stops.map((stop, index) => {
          const isFrom = index === fi;
          const isTo = index === ti;
          const inside = fi >= 0 && ti >= 0 && index >= fi && index <= ti;
          const time = stop.departure || stop.arrival;
          return (
            <div
              key={`${stop.name}-${index}`}
              className={`timeline-stop ${isFrom ? "is-from" : ""} ${isTo ? "is-to" : ""} ${
                inside ? "is-inside" : ""
              } ${!stop.sellable ? "is-unsellable" : ""}`}
            >
              <div className="timeline-stop__rail" aria-hidden>
                <span className="timeline-stop__dot">
                  {isFrom ? <MapPin size={9} /> : isTo ? <Ticket size={9} /> : null}
                </span>
                {index < stops.length - 1 && <span className="timeline-stop__line" />}
              </div>
              <div className="timeline-stop__body">
                <div className="timeline-stop__name">
                  {prettyStation(stop.name)}
                  {isFrom && <span className="timeline-tag timeline-tag--from">board</span>}
                  {isTo && <span className="timeline-tag timeline-tag--to">alight</span>}
                  {!stop.sellable && <span className="timeline-tag timeline-tag--muted">no online sales</span>}
                </div>
                <div className="timeline-stop__meta">
                  {time ? <span>{time}</span> : <span>—</span>}
                  {stop.halt && stop.halt !== "00" && <span>{stop.halt} min halt</span>}
                  {!stop.sellable && <span className="timeline-stop__note">passes through</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="timeline-foot">
        <span>
          <TrainFront size={13} /> Full train route
        </span>
        <span>
          <CircleDot size={13} /> Grey stops can&apos;t be ticketed online
        </span>
      </div>
      <div className="timeline-scroll-hint" aria-hidden>
        <ArrowDown size={13} /> scroll for all stops
      </div>
    </aside>
  );
}
