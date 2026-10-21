import { useMemo, useState } from "react";
import { Info } from "lucide-react";
import type { Counts, Stop } from "../types";
import { pairKey } from "../lib/engine";
import { bdt, prettyStation, seatsLabel } from "../lib/format";

interface MatrixProps {
  stops: Stop[];
  counts: Counts;
  fi: number;
  ti: number;
  pending: boolean;
}

function shortName(name: string): string {
  const pretty = prettyStation(name);
  if (pretty.length <= 12) return pretty;
  return `${pretty.slice(0, 11)}…`;
}

export function Matrix({ stops, counts, fi, ti, pending }: MatrixProps) {
  const [selected, setSelected] = useState<{ i: number; j: number } | null>(null);
  const selectedInfo = useMemo(() => {
    if (!selected) return null;
    return {
      ...selected,
      from: stops[selected.i]?.name || "",
      to: stops[selected.j]?.name || "",
      info: counts[pairKey(selected.i, selected.j)],
    };
  }, [selected, counts, stops]);

  return (
    <section className="matrix-card" aria-labelledby="matrix-title">
      <div className="matrix-card__head">
        <div>
          <span className="eyebrow eyebrow--dark">Seat grid</span>
          <h3 id="matrix-title">Every pair, at a glance</h3>
        </div>
        <span className="matrix-count">
          {stops.length} × {stops.length} stops
        </span>
      </div>

      <div className="matrix-detail" aria-live="polite">
        {selectedInfo ? (
          <>
            <strong>
              {prettyStation(selectedInfo.from)} → {prettyStation(selectedInfo.to)}
            </strong>
            {selectedInfo.info === undefined ? (
              <span>Not checked yet.</span>
            ) : selectedInfo.info === null ? (
              <span className="is-bad">No seats found / lookup failed.</span>
            ) : (
              <>
                <span className={selectedInfo.info.online > 0 ? "is-good" : "is-bad"}>
                  {selectedInfo.info.online > 0
                    ? `${seatsLabel(selectedInfo.info.online)} online`
                    : "Sold out online"}
                </span>
                <span>Fare {bdt(selectedInfo.info.fare)}</span>
                <span>Counter seats {selectedInfo.info.offline}</span>
                {selectedInfo.i === fi && selectedInfo.j === ti && <span className="is-good">Direct ticket</span>}
              </>
            )}
          </>
        ) : (
          <span>
            <Info size={13} /> Click any cell to inspect that pair. Rows are boarding stops; columns
            are alighting stops.
          </span>
        )}
      </div>

      <div
        className="matrix-scroll"
        role="region"
        aria-label="Seat availability matrix — scrollable"
        tabIndex={0}
      >
        <table className="matrix">
          <thead>
            <tr>
              <th className="matrix__corner" scope="col">
                From \ To
              </th>
              {stops.map((stop, j) => (
                <th
                  key={`${stop.name}-${j}`}
                  scope="col"
                  className={`${j === ti ? "is-to" : ""} ${j === fi ? "is-from" : ""} ${
                    !stop.sellable ? "is-unsellable" : ""
                  }`}
                  title={`${prettyStation(stop.name)}${stop.sellable ? "" : " — no online ticket sales"}`}
                >
                  <span>{shortName(stop.name)}</span>
                  {j === ti && <small>you alight</small>}
                  {j === fi && <small>you board</small>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {stops.map((rowStop, i) => (
              <tr key={`${rowStop.name}-${i}`}>
                <th
                  scope="row"
                  className={`matrix__rowhead ${i === fi ? "is-from" : ""} ${i === ti ? "is-to" : ""} ${
                    !rowStop.sellable ? "is-unsellable" : ""
                  }`}
                  title={`${prettyStation(rowStop.name)}${rowStop.sellable ? "" : " — no online ticket sales"}`}
                >
                  <span>{prettyStation(rowStop.name)}</span>
                  {i === fi && <small>you board</small>}
                  {i === ti && <small>you alight</small>}
                </th>
                {stops.map((colStop, j) => {
                  if (j <= i) {
                    return <td key={j} className="matrix__cell matrix__cell--blank" aria-label="—" />;
                  }
                  const unsellable = !rowStop.sellable || !colStop.sellable;
                  if (unsellable) {
                    return (
                      <td
                        key={j}
                        className="matrix__cell matrix__cell--unsellable"
                        title="No online ticket sales at this station"
                      >
                        ·
                      </td>
                    );
                  }
                  const info = counts[pairKey(i, j)];
                  const cover = i <= fi && j >= ti;
                  const isSelected = selected?.i === i && selected.j === j;
                  if (info === undefined) {
                    return (
                      <td
                        key={j}
                        className={`matrix__cell matrix__cell--pending ${cover ? "is-cover" : ""} ${
                          isSelected ? "is-selected" : ""
                        } ${pending ? "is-scanning" : ""}`}
                        title={`${prettyStation(rowStop.name)} → ${prettyStation(colStop.name)} — not checked yet`}
                        onClick={() => setSelected({ i, j })}
                      >
                        {pending ? "·" : "–"}
                      </td>
                    );
                  }
                  if (info === null) {
                    return (
                      <td
                        key={j}
                        className={`matrix__cell matrix__cell--none ${cover ? "is-cover" : ""} ${
                          isSelected ? "is-selected" : ""
                        }`}
                        title={`${prettyStation(rowStop.name)} → ${prettyStation(colStop.name)} — no seats / lookup failed`}
                        onClick={() => setSelected({ i, j })}
                      >
                        ×
                      </td>
                    );
                  }
                  const tone = info.online === 0 ? "zero" : info.online <= 5 ? "low" : "ok";
                  return (
                    <td
                      key={j}
                      className={`matrix__cell matrix__cell--${tone} ${cover ? "is-cover" : ""} ${
                        isSelected ? "is-selected" : ""
                      }`}
                      title={`${prettyStation(rowStop.name)} → ${prettyStation(colStop.name)} · ${seatsLabel(
                        info.online,
                      )} · fare ${bdt(info.fare)} · counter seats ${info.offline}`}
                      onClick={() => setSelected({ i, j })}
                    >
                      {info.online}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="matrix-legend">
        <span className="legend-item">
          <span className="legend-swatch legend-swatch--ok" /> 6+ seats
        </span>
        <span className="legend-item">
          <span className="legend-swatch legend-swatch--low" /> 1–5 seats
        </span>
        <span className="legend-item">
          <span className="legend-swatch legend-swatch--zero" /> sold out
        </span>
        <span className="legend-item">
          <span className="legend-swatch legend-swatch--none" /> no lookup
        </span>
        <span className="legend-item">
          <span className="legend-swatch legend-swatch--cover" /> covers your trip
        </span>
      </div>
    </section>
  );
}
