import type { AppData } from "../types";

export async function loadAppData(): Promise<AppData> {
  const base = import.meta.env.BASE_URL.endsWith("/")
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`;
  const names = ["trains", "routes", "stations"] as const;
  const responses = await Promise.all(
    names.map((name) => fetch(`${base}data/${name}.json`, { cache: "no-cache" })),
  );
  for (const response of responses) {
    if (!response.ok) throw new Error(`Could not load timetable data (HTTP ${response.status}).`);
  }
  const [trains, routes, stations] = (await Promise.all(
    responses.map((response) => response.json()),
  )) as [AppData["trains"], AppData["routes"], AppData["stations"]];
  return { trains, routes, stations };
}
