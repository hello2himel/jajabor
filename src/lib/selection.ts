import type { AppData, FormState, Stop, Train, TrainRoute } from "../types";
import { nextRunningDate, stationKey, trainRunsOn } from "./format";
import { scanPairs } from "./engine";

export function resolveTrain(trains: Train[], input: string): Train | null {
  const raw = input.trim().toLowerCase();
  if (!raw) return null;
  return (
    trains.find((train) => train.number === raw) ||
    trains.find((train) => train.label.toLowerCase() === raw) ||
    trains.find((train) => train.name.toLowerCase() === raw) ||
    trains.find((train) => train.label.toLowerCase().includes(raw)) ||
    trains.find((train) => train.name.toLowerCase().includes(raw)) ||
    null
  );
}

export function findStopIndex(route: TrainRoute | null, station: string): number {
  if (!route) return -1;
  const needle = stationKey(station);
  return route.stops.findIndex((stop) => stationKey(stop.name) === needle);
}

export interface Selection {
  train: Train | null;
  route: TrainRoute | null;
  stops: Stop[];
  sellable: boolean[];
  fi: number;
  ti: number;
  directionValid: boolean;
  stationsValid: boolean;
  runsOnDate: boolean;
  nextRunDate: string | null;
  pairCount: number;
}

export function getSelection(data: AppData, form: FormState): Selection {
  const train = resolveTrain(data.trains, form.train);
  const route = train ? data.routes[train.number] || null : null;
  const stops = route?.stops || [];
  const sellable = stops.map((stop) => stop.sellable);
  const fi = findStopIndex(route, form.from);
  const ti = findStopIndex(route, form.to);
  const directionValid = fi >= 0 && ti >= 0 && fi < ti;
  const runsOnDate = route ? trainRunsOn(form.date, route.days) : false;
  return {
    train,
    route,
    stops,
    sellable,
    fi,
    ti,
    directionValid,
    stationsValid: fi >= 0 && ti >= 0,
    runsOnDate,
    nextRunDate: route ? nextRunningDate(form.date, route.days) : null,
    pairCount: directionValid ? scanPairs(stops.length, sellable, fi, ti, form.deep).length : 0,
  };
}
