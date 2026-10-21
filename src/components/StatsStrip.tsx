import { CheckCircle2 } from "lucide-react";
import type { AppData } from "../types";

interface StatsStripProps {
  data: AppData;
}

export function StatsStrip({ data }: StatsStripProps) {
  const stationCount = data.stations.length;
  const stats = [
    { value: String(data.trains.length), label: "trains on the timetable" },
    { value: String(stationCount), label: "stations in the network" },
    { value: "10", label: "seat classes, one scan" },
    { value: "1", label: "clever way to get there" },
  ];
  return (
    <section className="stats-strip" aria-label="Jajabor at a glance">
      <div className="container stats-strip__inner">
        {stats.map((stat) => (
          <div className="stat" key={stat.label}>
            <span className="stat__value">{stat.value}</span>
            <span className="stat__label">{stat.label}</span>
          </div>
        ))}
        <div className="stats-strip__note">
          <CheckCircle2 size={16} />
          <span>Timetable snapshot bundled · seat counts checked at scan time</span>
        </div>
      </div>
    </section>
  );
}
