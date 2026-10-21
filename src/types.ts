export type Mode = "demo" | "live";

export type ScanSpeed = "gentle" | "balanced" | "fast";

export interface Train {
  number: string;
  name: string;
  label: string;
  origin: string;
  destination: string;
  days: string[];
  duration: string;
  stopCount: number;
}

export interface Stop {
  name: string;
  arrival: string | null;
  departure: string | null;
  halt: string | null;
  duration: string | null;
  sellable: boolean;
}

export interface TrainRoute {
  name: string;
  days: string[];
  duration: string;
  stops: Stop[];
}

export type RoutesData = Record<string, TrainRoute>;

export interface Station {
  city_id: number;
  city_name: string;
  city_sequence: number;
  is_top_city: boolean;
  is_enable_for_from: number;
}

export interface SeatClass {
  code: string;
  label: string;
  bn: string;
  short: string;
  ac: boolean;
  factor: number;
}

export interface PairInfo {
  online: number;
  offline: number;
  fare: number;
}

export type Counts = Record<string, PairInfo | null | undefined>;

export type Segment =
  | { type: "ticket"; a: number; b: number; info: PairInfo }
  | { type: "gap"; a: number; b: number };

export interface FoundRoute {
  segs: Segment[];
  tickets: number;
  gaps: number;
  min: number;
  fare: number;
  extra: number;
}

export interface Session {
  token: string;
  deviceId?: string;
  deviceKey?: string;
  proxy: string;
  remember?: boolean;
}

export interface FormState {
  train: string;
  from: string;
  to: string;
  date: string;
  cls: string;
  gap: number;
  speed: ScanSpeed;
  deep: boolean;
}

export interface AppData {
  trains: Train[];
  routes: RoutesData;
  stations: Station[];
}

export const SEAT_CLASSES: SeatClass[] = [
  { code: "SNIGDHA", label: "Snigdha", short: "Snigdha", bn: "স্নিগ্ধা", ac: true, factor: 1.55 },
  { code: "AC_S", label: "AC Seat", short: "AC Seat", bn: "এসি সিট", ac: true, factor: 2.65 },
  { code: "AC_B", label: "AC Berth", short: "AC Berth", bn: "এসি বার্থ", ac: true, factor: 3.55 },
  { code: "AC_CHAIR", label: "AC Chair", short: "AC Chair", bn: "এসি চেয়ার", ac: true, factor: 3.05 },
  { code: "S_CHAIR", label: "Shovan Chair", short: "S. Chair", bn: "শো. চেয়ার", ac: false, factor: 1 },
  { code: "SHOVAN", label: "Shovan", short: "Shovan", bn: "শোভন", ac: false, factor: 0.8 },
  { code: "F_SEAT", label: "First Seat", short: "First Seat", bn: "এফ সিট", ac: false, factor: 1.9 },
  { code: "F_BERTH", label: "First Berth", short: "First Berth", bn: "এফ বার্থ", ac: false, factor: 2.6 },
  { code: "F_CHAIR", label: "First Chair", short: "First Chair", bn: "এফ চেয়ার", ac: false, factor: 1.8 },
  { code: "SHULOV", label: "Shulov", short: "Shulov", bn: "সুলভ", ac: false, factor: 0.65 },
];

export const CLASS_BY_CODE = Object.fromEntries(SEAT_CLASSES.map((c) => [c.code, c]));

export const SPEED_MS: Record<ScanSpeed, number> = {
  gentle: 1800,
  balanced: 1200,
  fast: 700,
};
