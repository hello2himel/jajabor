# Jajabor · যাযাবর

**The train is full. Your journey isn't.**

Jajabor is a split-ticket finder for Bangladesh Railway. It checks every useful
station pair on a train, then stitches available seats into a journey — even
when the direct ticket is sold out.

This is a web GUI reimagining of
[TonmoyNaimur/split-ticket-finder](https://github.com/TonmoyNaimur/split-ticket-finder),
with real timetable data, a playable demo, and an optional live mode.

![Jajabor landing page](docs/hero.png)

## Why split tickets?

Railway seats are sold segment by segment. The direct Dhaka → Rajshahi seat can
be gone while the same train has space from Dhaka → Santahar and another seat
from Santahar → Rajshahi. Jajabor finds those overlaps and lays out the
trade-offs: number of tickets, seats on the tightest leg, fare, and any short
stretches without a reserved seat.

- **All-pairs availability** — checks boarding/alighting combinations around
  your trip, with an optional full-route matrix.
- **A real route finder** — depth-first search over available pairs, ranked by
  gaps, ticket count, extra distance, seats, and fare.
- **Three ways to search** — direct ticket, split tickets, or split tickets with
  a configurable number of unticketed hops.
- **See the whole train** — an interactive seat grid, route timeline, and
  detailed ticket breakdown.
- **Filters and sorting** — max tickets, minimum seats, fully covered only,
  cheapest, or most seats.
- **Shareable searches** — train, stations, date, class, and settings live in the
  URL.
- **Demo mode** — deterministic sample availability, so the site is useful the
  moment it loads.
- **Live mode** — uses your own railway session through a local proxy. No
  passwords, no OTPs, no analytics.

![Scan results](docs/scan.png)

## Try the demo

**Hosted demo:** <https://hello2himel.github.io/jajabor/>

Demo availability is simulated. It is designed to be plausible — long,
hub-to-hub and premium segments sell out more often, short segments stay
available — but it is not live railway data.

The timetable itself is real: **160 trains**, **263 stations**, and the complete
stop list for every train, bundled as static JSON.

## Run locally

Requires **Node.js 20+**.

```bash
git clone https://github.com/hello2himel/jajabor.git
cd jajabor
npm install
npm run live
```

Open <http://localhost:8788>. This builds the frontend, starts the proxy, and
serves both from one origin. Demo mode works immediately.

For development:

```bash
npm run dev
```

This starts Vite on <http://localhost:5173> and the proxy on port `8788`. Vite
forwards `/api` to the proxy.

### Ports

| Service | Default | Override |
| --- | --- | --- |
| Web + proxy (`npm run live`) | `8788` | `PORT=9000 npm start` |
| Vite dev server | `5173` | `npm run dev -- --port 5174` |
| Proxy used by Vite | `8788` | edit `vite.config.ts` |

## Live mode

The search API only accepts requests from its own web origin, so a browser on a
different domain can't call it directly. Jajabor ships a **small local proxy**
for that. The proxy forwards your own session headers to the railway API; it
does not store tokens on disk and does not log them.

### 1. Start the proxy

```bash
npm run live
```

Or, if you only need the proxy for a hosted demo:

```bash
npm install
npm run build
npm start
```

### 2. Connect your session

1. Log in at <https://eticket.railway.gov.bd/>.
2. Open DevTools → Console and run the snippet shown in Jajabor's session modal.
   It reads your own `token`, `uudid`, and `ssdk` values from that site's
   `localStorage` and copies them as JSON.
3. Paste the bundle into **Session** in Jajabor, test the connection, and save.

Leave the proxy field **blank** when you opened Jajabor from
`http://localhost:8788`. Use `http://localhost:8788` when the frontend is served
from somewhere else, such as GitHub Pages.

The session is kept in `sessionStorage` by default and cleared when the tab
closes. Choose **Remember this session** to keep it in `localStorage`. Expired
tokens are rejected; reconnect when that happens.

### How the proxy is secured

- Binds to `127.0.0.1` by default.
- Forwards only the search and public timetable endpoints.
- Validates station names, dates, and seat classes.
- 30-second upstream timeout and a 240-request/minute local rate limit.
- Tokens are never written to disk or included in logs.
- To use it from another origin, set `ALLOWED_ORIGINS` (comma-separated). By
  default it reflects the requesting origin, which is convenient for local use.
  Set an explicit list if you expose the proxy beyond your machine.

```bash
HOST=0.0.0.0 ALLOWED_ORIGINS=https://hello2himel.github.io npm start
```

> **A note on credentials:** a session token is a bearer credential. Only run
> the proxy on a machine you trust, and never deploy it as a public service.
> Jajabor never asks for your railway password or OTP.

## How it works

1. **Pick a train and trip.** Routes and stops come from the bundled timetable
   data. Stops without online ticket sales are marked and skipped as endpoints.
2. **Choose which pairs to check.** Jajabor checks pairs that overlap the
   journey. Tickets may start before you board or end after you alight — you
   simply board and leave at your own stops. The full-matrix option checks every
   sellable pair.
3. **Ask for availability.** Demo mode generates deterministic samples. Live
   mode calls the railway search API through the proxy, two requests at a time
   with a configurable pause.
4. **Stitch and rank.** A DFS combines available pairs, allowing up to the
   chosen number of unticketed hops. Results are ranked by gaps, tickets, extra
   distance, seats on the tightest leg, and fare.
5. **Book on the official site.** Each ticket links to the official railway
   search for that exact segment. Jajabor never buys or holds tickets.

![Ways to make it work](docs/results.png)

On a phone, the seat grid and timeline scroll inside their cards, so the whole
page never runs sideways.

<img src="docs/mobile.png" alt="Jajabor on a phone" width="360" />

### Data and API notes

- Timetable snapshot: **October 2026**.
- Availability API: Shohoz's `search-trips-v2` endpoint, the same one used by the
  official e-ticket site.
- 12 route stops are not present in the station handshake (for example
  `Jamalganj`, `Kushtia`, `Goalanda_Ghat`). They are marked "no online ticket
  sales" and never used as ticket endpoints.
- Demo fares are estimates derived from distance and class. Live fares come from
  the API response.
- Availability changes constantly. Always confirm on the official site before
  paying.

## Project structure

```
src/
  App.tsx                 state, scan orchestration, URL sync
  components/             search, workspace, matrix, results, modal, marketing
  lib/
    engine.ts             split-route DFS, pair selection, demo availability
    scan.ts               live/demo scan runners with progress and retries
    api.ts                railway API client and auth headers
    selection.ts          train/stop resolution
    format.ts             dates, times, fares
    session.ts            session parsing and token inspection
    cache.ts              short-lived client-side pair cache
public/data/              bundled trains, routes, stations
server/index.mjs          local CORS proxy + static frontend server
docs/                     screenshots
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server + proxy |
| `npm run build` | Typecheck and build to `dist/` |
| `npm run live` | Build, then serve web + proxy on `8788` |
| `npm start` | Serve an existing `dist/` + proxy |
| `npm run typecheck` | TypeScript only |
| `npm run preview` | Preview the built frontend (no proxy) |

## Deploying the demo

The included GitHub Actions workflow builds with `BASE_PATH=/jajabor/` and
publishes `dist/` to GitHub Pages. The hosted demo is static and needs no
backend. Live mode still requires the local proxy.

To build for a different Pages path:

```bash
BASE_PATH=/your-repo/ npm run build
```

## Limitations

- Live mode requires a running local proxy and a valid railway session.
- The railway API is unofficial and can change without notice.
- A no-ticket hop means exactly that: no reserved seat for that stretch. Check
  local rules and availability before travelling.
- The route finder optimizes for a sensible combination, not a guaranteed
  seat. Availability can change while you book.
- This is not affiliated with Bangladesh Railway, Shohoz, or the original
  extension's author.

## Credits

- Original extension: [TonmoyNaimur/split-ticket-finder](https://github.com/TonmoyNaimur/split-ticket-finder)
- Timetable and availability data: Bangladesh Railway / Shohoz
- Typeface: Instrument Serif, Manrope, and IBM Plex Mono
- Icons: [Lucide](https://lucide.dev)

## License

MIT © 2026 hello2himel. See [LICENSE](LICENSE).
