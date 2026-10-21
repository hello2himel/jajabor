import type { Counts, FoundRoute, Segment, Stop } from "../types";
import { CLASS_BY_CODE } from "../types";

export function pairKey(i: number, j: number): string {
  return `${i},${j}`;
}

export function getPair(counts: Counts, i: number, j: number) {
  return counts[pairKey(i, j)];
}

/**
 * Port of the original extension's route finder.
 *
 * fi / ti are the indices of your boarding and alighting stops in the full
 * train route. A ticket is allowed to start before fi and end after ti — you
 * simply board / get off where you actually are. Gaps are stretches travelled
 * without a reserved ticket (max `maxGap` of them).
 */
export function findRoutes(
  stations: string[],
  counts: Counts,
  fi: number,
  ti: number,
  maxGap: number,
): FoundRoute[] {
  if (fi < 0 || ti < 0 || fi >= ti || ti >= stations.length) return [];
  const last = stations.length - 1;
  const out: FoundRoute[] = [];
  const seen = new Set<string>();
  let budget = 500_000;

  function pushRoute(segs: Segment[], gaps: number) {
    if (!segs.some((s) => s.type === "ticket")) return;
    const signature = segs.map((s) => `${s.type}${s.a}-${s.b}`).join("|");
    if (seen.has(signature)) return;
    seen.add(signature);
    const tickets = segs.filter((s): s is Extract<Segment, { type: "ticket" }> => s.type === "ticket");
    out.push({
      segs: segs.map((s) => ({ ...s })),
      tickets: tickets.length,
      gaps,
      min: Math.min(...tickets.map((s) => s.info.online)),
      fare: tickets.reduce((sum, s) => sum + (Number(s.info.fare) || 0), 0),
      extra: tickets.reduce(
        (sum, s) => sum + Math.max(0, fi - s.a) + Math.max(0, s.b - ti),
        0,
      ),
    });
  }

  function dfs(p: number, segs: Segment[], gaps: number) {
    if (budget-- <= 0 || out.length >= 20_000) return;
    if (p >= ti) {
      pushRoute(segs, gaps);
      return;
    }
    const first = segs.length === 0;
    for (let q = last; q > p; q--) {
      const lo = first ? 0 : p;
      for (let s = lo; s <= p; s++) {
        const c = getPair(counts, s, q);
        if (c && c.online >= 1) {
          segs.push({ type: "ticket", a: s, b: q, info: c });
          dfs(q, segs, gaps);
          segs.pop();
        }
      }
    }
    if (gaps < maxGap) {
      const prev = segs[segs.length - 1];
      if (prev && prev.type === "gap") {
        const oldB = prev.b;
        prev.b = p + 1;
        dfs(p + 1, segs, gaps + 1);
        prev.b = oldB;
      } else {
        segs.push({ type: "gap", a: p, b: p + 1 });
        dfs(p + 1, segs, gaps + 1);
        segs.pop();
      }
    }
  }

  dfs(fi, [], 0);
  out.sort(
    (a, b) =>
      a.gaps - b.gaps ||
      a.tickets - b.tickets ||
      a.extra - b.extra ||
      b.min - a.min ||
      a.fare - b.fare,
  );
  return out;
}

/**
 * Pairs worth checking. A ticket that ends at or before your boarding stop, or
 * starts at or after your alighting stop, can never be part of a journey.
 */
export function scanPairs(
  stopCount: number,
  sellable: boolean[],
  fi: number,
  ti: number,
  deep = false,
): Array<[number, number]> {
  const pairs: Array<[number, number]> = [];
  for (let i = 0; i < stopCount - 1; i++) {
    for (let j = i + 1; j < stopCount; j++) {
      if (!sellable[i] || !sellable[j]) continue;
      if (!deep && (j <= fi || i >= ti)) continue;
      pairs.push([i, j]);
    }
  }
  pairs.sort(([ai, aj], [bi, bj]) => {
    const score = (i: number, j: number) => {
      if (i === fi && j === ti) return 0;
      if (i <= fi && j >= ti) return 1;
      if (j - i >= (ti - fi) / 2) return 2;
      return 3;
    };
    return score(ai, aj) - score(bi, bj) || bj - bi - (aj - ai);
  });
  return pairs;
}

export function routeSignature(route: FoundRoute): string {
  return route.segs.map((s) => `${s.type}${s.a}-${s.b}`).join("|");
}

export function routeLabel(route: FoundRoute): string {
  if (route.gaps === 0 && route.tickets === 1) return "One ticket, one seat the whole way";
  if (route.gaps === 0) return `${route.tickets} tickets, fully covered`;
  return `${route.tickets} ticket${route.tickets === 1 ? "" : "s"} + ${route.gaps} hop${
    route.gaps === 1 ? "" : "s"
  } without a ticket`;
}

export interface TicketTiming {
  departure: string | null;
  arrival: string | null;
}

export function ticketTiming(stops: Stop[], a: number, b: number): TicketTiming {
  return {
    departure: stops[a]?.departure || stops[a]?.arrival || null,
    arrival: stops[b]?.arrival || stops[b]?.departure || null,
  };
}

export function estimateFare(stops: Stop[], i: number, j: number, cls: string): number {
  const seat = CLASS_BY_CODE[cls];
  const factor = seat?.factor ?? 1;
  const distance = Math.max(1, j - i);
  const routeScale = 1 + stops.length * 0.004;
  return Math.max(15, Math.round((distance * 21 + 12) * factor * routeScale));
}

const HUBS = new Set(
  [
    "Dhaka",
    "Chattogram",
    "Sylhet",
    "Rajshahi",
    "Khulna",
    "Rangpur",
    "Dinajpur",
    "Mymensingh",
    "Cumilla",
    "Cox's Bazar",
    "Bogura",
    "Jashore",
    "Narayanganj",
    "Parbatipur",
    "Santahar",
    "Tongi",
  ].map((s) => s.toLowerCase()),
);

function hashString(input: string): number {
  let hash = 2_166_136_261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/**
 * Deterministic, plausible sample availability. Long, hub-to-hub and premium
 * segments sell out more often; short segments stay available — which is the
 * exact situation split ticketing is for.
 */
export function demoPair(
  trainNumber: string,
  date: string,
  cls: string,
  stops: Stop[],
  i: number,
  j: number,
  fi: number,
  ti: number,
  directBias = true,
): { online: number; offline: number; fare: number } {
  const rnd = mulberry32(hashString(`${trainNumber}|${date}|${cls}|${i}|${j}|jajabor`));
  const span = j - i;
  const tripSpan = Math.max(1, ti - fi);
  const routeSpan = Math.max(1, stops.length - 1);
  const hub = HUBS.has(stops[i].name.toLowerCase()) || HUBS.has(stops[j].name.toLowerCase());
  let soldOutChance = 0.11 + (span / routeSpan) * 0.28 + (hub ? 0.1 : 0);
  if (span >= tripSpan * 0.65) soldOutChance += 0.34;
  if (span >= tripSpan * 0.9) soldOutChance += 0.14;
  if (["AC_B", "AC_S", "SNIGDHA", "F_BERTH"].includes(cls)) soldOutChance += 0.06;
  if (span <= Math.max(2, tripSpan * 0.22)) soldOutChance -= 0.12;
  if (directBias && i === fi && j === ti) soldOutChance += 0.5;

  const isSoldOut = rnd() < Math.min(0.93, Math.max(0.04, soldOutChance));
  const online = isSoldOut ? 0 : 1 + Math.floor(Math.pow(rnd(), 1.65) * 27);
  const offline = Math.floor(rnd() * 18);
  return { online, offline, fare: estimateFare(stops, i, j, cls) };
}

export function routeToText(
  route: FoundRoute,
  stops: Stop[],
  fi: number,
  ti: number,
  title: string,
  dateLabel: string,
  clsLabel: string,
): string {
  const lines = [
    `${title}`,
    `${stops[fi].name.replace(/_/g, " ")} → ${stops[ti].name.replace(/_/g, " ")} · ${dateLabel} · ${clsLabel}`,
    "",
  ];
  route.segs.forEach((seg, index) => {
    const from = stops[seg.a].name.replace(/_/g, " ");
    const to = stops[seg.b].name.replace(/_/g, " ");
    if (seg.type === "ticket") {
      const notes: string[] = [];
      if (seg.a < fi) notes.push(`board at ${stops[fi].name.replace(/_/g, " ")}`);
      if (seg.b > ti) notes.push(`get off at ${stops[ti].name.replace(/_/g, " ")}`);
      lines.push(
        `${index + 1}. TICKET  ${from} → ${to} · ${seg.info.online} seats · ৳${Math.round(
          seg.info.fare,
        )}${notes.length ? ` (${notes.join(", ")})` : ""}`,
      );
    } else {
      lines.push(`${index + 1}. NO TICKET  ${from} → ${to} (${seg.b - seg.a} stops)`);
    }
  });
  lines.push("", `Total fare ≈ ৳${Math.round(route.fare)}`);
  lines.push("Check availability and buy on eticket.railway.gov.bd.");
  return lines.join("\n");
}
