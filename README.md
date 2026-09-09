[English](README.md) · [Español](README.es.md)

# EuroSky Connect

A route planner for a European airline that compares **six graph algorithms** over a real network of airports, and scores every route by cost, time, stops and profit.

**This is a four-person university project.** My part is the Node server, the
entire front end, and the JavaScript implementations of Dijkstra, BFS and DFS —
see [Who wrote what](#who-wrote-what).

[![CI](https://github.com/Pameladelarada/Caso-EuroSky-Connect/actions/workflows/ci.yml/badge.svg)](https://github.com/Pameladelarada/Caso-EuroSky-Connect/actions/workflows/ci.yml)
![C++](https://img.shields.io/badge/C%2B%2B-17-00599C)
![Node](https://img.shields.io/badge/Node.js-18%2B-339933)
![License](https://img.shields.io/badge/license-MIT-green)

![The planner: a route computed with Dijkstra over the airport map](docs/planner.png)

![The six algorithms compared for the same origin and destination](docs/algorithm-comparison.png)

---

## The problem

An airline has to decide **which routes to operate and with which aircraft**, under a hard constraint: a crew's working day cannot exceed 480 minutes, flight time plus layovers.

"Find the shortest path" is not a well-posed question here, because *shortest* is ambiguous. Cheapest in operating cost? Fewest stops? Fastest? Most profitable? Those are four different routes, and one of them may not even be legal to fly within the working-day limit.

So instead of picking one algorithm, I implemented six and made the system compare them side by side.

## What I found

I ran all six algorithms over **240 origin-destination pairs** and compared the results. Three of them are worth stating.

**Finding a route is not the same as finding one you can fly.** DFS returns a connected route every time — and **98% of those routes exceed the 480-minute working day**. It averages 12.9 stops against Dijkstra's 0.3, at 31× the cost. Connectivity and operability are different questions, and an algorithm that only answers the first one is useless here.

**Minimising cost is not maximising profit.** Monte Carlo is never cheaper than Dijkstra (0% of pairs — exactly what optimality predicts), yet it returns a *more profitable* route in **90%** of them. Revenue accrues per leg, so the most profitable route is the longest one still inside the working day, which is close to the opposite of the cheapest. Deciding what to optimise is a business decision, not an algorithmic one.

**The heuristic is good enough here — which is why you need the exact one.** Greedy matches Dijkstra's optimal cost in **91%** of pairs. On this network the shortcut almost always works; in the remaining 9% it does not, and without the exact algorithm there is no way to know which case you are in.

Cheapest and fastest also diverge, though less often than I expected: **13%** of pairs.

*Method: `/api/comparacion` over all ordered pairs among the first 16 airports, 240 pairs with a route under all six algorithms. Reproducible from the running server.*

---

## How it works

The network is modelled as a **directed weighted graph**:

- **Nodes** — 36 European airports with real coordinates
- **Edges** — 534 operable routes
- **Weight** — leg cost = `operating cost + airport fees`

| Algorithm | What it guarantees | Complexity |
|---|---|---|
| **Dijkstra** | Minimum real cost (non-negative weights) | `O((V+E) log V)` |
| **Bellman-Ford** | Minimum cost + detects negative cycles | `O(V·E)` |
| **BFS** | Fewest stops | `O(V+E)` |
| **DFS** | Any connected route, not optimal | `O(V+E)` |
| **Greedy** | Heuristic: best immediate leg | `O((V+E) log V)` |
| **Monte Carlo** | Approximation by random sampling | `O(k·V)` |

All six are implemented from scratch, twice — once in C++ and once in JavaScript.
No graph libraries; understanding the real cost of each data structure was the
point. The C++ engine is mostly Carlos Savero's
work; in the JavaScript engine, Dijkstra, BFS and DFS are mine.

### Two engines, one source of truth

```
┌────────────────────────┐      ┌────────────────────────┐
│   C++ engine (CLI)     │      │  Node/Express server   │
│                        │      │                        │
│  The algorithms        │      │  Same logic in JS +    │
│  implemented by hand   │      │  REST API + dates +    │
│                        │      │  currency conversion   │
└───────────┬────────────┘      └───────────┬────────────┘
            │                               │
            └───────────┬───────────────────┘
                        ▼
                  ┌──────────┐
                  │data.json │  ← shared source of truth
                  └──────────┘
                        ▲
            ┌───────────┴────────────┐
            │  OurAirports (9,056)   │  ← enrichment
            │  OpenFlights (67,663)  │
            └────────────────────────┘
```

The C++ binary is the algorithmic core. The Node server exposes the same logic over HTTP for the Google Maps front end. Both read `data.json`, so their results are directly comparable — which is itself a useful property: it cross-checks two independent implementations of the same six algorithms.

---

## Engineering notes

The things worth talking about are not the algorithms — those are textbook. They are what happens at the edges.

### The algorithms were right; the input handling was not

The engine compiles clean under `-Wall -Wextra -Wpedantic` and 26 of 27 algorithm assertions passed on the first run. But the moment the input was not what the code expected, it broke:

- **An airport ID that did not exist terminated the program.** Route printing resolved each node with `unordered_map::at()`, which throws `std::out_of_range` on a missing key. Nothing caught it. Typing `999` at the menu was enough.
- **A non-numeric menu entry caused an infinite loop.** `cin.clear()` plus `cin.ignore()` recovers from a format error but does not detect end of input. With stdin closed, the read failed on every iteration and the menu reprinted forever — **9,705,078 lines and 228 MB in five seconds**.

The lesson I took from this: the interesting failures were never in the algorithm. They were at the boundary between my code and the outside world.

### Stored XSS in the airport registry

`POST /api/aeropuertos` stored `nombre`, `ciudad` and `atractivo` verbatim in `data.json`, and the front end rendered them with `innerHTML`. Posting `<img src=x onerror=...>` as an airport name persisted executable HTML that then ran for every subsequent visitor.

Fixed in both layers, which is the part I would defend in a review: **validation on the server** (reject `<` and `>`, enforce length) *and* **escaping on the client** (36 interpolations moved to escaped output). Either alone leaves a gap; the server cannot know how every future consumer will render the value, and the client cannot stop bad data from being stored.

### Validation that silently accepted impossible data

The check was `Number.isNaN(Number(lat))`. But `Number(null)` is `0` and `Number("")` is `0` — neither is `NaN`, so both passed, and the airport was saved at coordinates (0, 0), in the Gulf of Guinea, 5,000 km from Europe. The aircraft endpoint never checked sign at all, so a capacity of −500 passengers was accepted.

Now every numeric field goes through a range check: latitude in [−90, 90], longitude in [−180, 180], capacity between 1 and the configured maximum, and IATA codes matched against `^[A-Z]{3}$`.

---

## Running it

### Requirements

- **Node.js 18+**
- **g++ 9+** or **clang 10+** with C++17 support
- A Google Maps API key *(optional — everything works without it except the map)*

### Web server

```bash
npm install
cp .env.example .env        # paste your GOOGLE_MAPS_API_KEY
npm start
```

Open **http://localhost:3000**

### C++ engine

```bash
make          # builds build/eurosky
make run      # builds and runs the menu
```

### Tests

```bash
npm test      # 17 API tests
make test     # 30 engine tests
```

---

## API

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/resumen` | Counts of airports, routes, aircraft and loaded sources |
| `GET` | `/api/aeropuertos` | Airports with coordinates |
| `POST` | `/api/aeropuertos` | Registers an airport; validates IATA, coordinate ranges and duplicates |
| `GET` | `/api/aeronaves` | Available fleet |
| `POST` | `/api/aeronaves` | Registers an aircraft; capacity between 1 and 255 |
| `GET` | `/ruta?inicio=1&fin=5&algoritmo=dijkstra` | Optimal route under one algorithm |
| `GET` | `/api/comparacion?inicio=1&fin=5` | All six algorithms compared |
| `GET` | `/api/mejores-rutas` | Commercial ranking of routes |

```bash
curl "http://localhost:3000/api/comparacion?inicio=1&fin=20&fecha=2026-03-15"
```

Returns all six algorithms with their airport sequence, cost, time, stops and net profit, plus a `destacados` block marking which one wins on each criterion.

---

## The business model

**Leg cost**

```
TC = operating_cost + airport_fees
```

**Net profit**

```
NP = projected_revenue − TC
```

**Operational constraint**

```
flight_time + layover_time ≤ 480 min   (maximum working day)
```

Amounts are shown in USD and PEN.

---

## Data sources

| Source | Records | Used for |
|---|---|---|
| [OurAirports](https://ourairports.com/data/) | 9,056 airports | Coordinates, type, ISO country |
| [OpenFlights](https://openflights.org/data.html) | 67,663 routes | Real connectivity between airports |
| `data.json` | 36 airports / 534 routes | The case's operational data |

The case's routes are enriched with real connectivity: 448 additional routes are derived from the external sources, and 42 routes carry demand computed from them.

---

## Testing and CI

47 tests, no dependencies beyond what the project already uses:

- **30 engine tests** — plain assertions and the C++ standard library, covering all six algorithms plus regression tests for the crash and the infinite loop
- **17 API tests** — Node's built-in `node:test` runner against the real server, covering the security fixes and validation ranges

CI runs on every push and pull request: the engine builds and its tests run on **Ubuntu and macOS**, the API is tested against **Node 18, 20 and 22**, and two regression steps drive the compiled binary directly for the two input-handling failures above.

---

## Design decisions

- **No graph libraries.** All six algorithms are hand-written, in both engines.
- **JSON as storage.** Adequate for 36 nodes. Production would need a database: the file is rewritten in full on every `POST`.
- **No front-end framework.** Plain HTML, CSS and JS, to keep the focus on the algorithms rather than the tooling.
- **Validate on the server, escape on the client.** Both, not either.
- **API keys never in the repository.** The Google Maps key is read from `.env`
  and handed to the browser through `/api/config`, where it is restricted by HTTP
  referrer. An earlier version had it hardcoded in `index.html`; that key has been
  revoked. It is still visible in the commit history, which is the honest state of
  things: rotating the credential is what closes the exposure, not rewriting
  history.

## Known limitations

- The graph is **directed**: `A → B` does not imply `B → A`. Pilot routes simulate the return leg by querying both directions.
- Monte Carlo is **non-deterministic**: two runs may return different routes.
- Airports registered from the CLI menu live in a separate structure and are not yet part of the graph the algorithms traverse.
- Expected demand is a figure from the case, not a prediction.

## What I would do next

- Unify the CLI's manually registered airports with the graph, removing the duplicate data model.
- Replace the `1e9` sentinel for "no route" with `std::optional<double>`, so callers cannot confuse it with a real, expensive cost.
- Split `server.js` into routes and services; 1,011 lines in one file is the thing a reviewer comments on first.

---

## Who wrote what

Measured with `git blame` on `main`, before the fixes described in the
engineering notes. 4 101 lines of code, excluding the vendored `json.hpp`.

| Area | Mine | Others |
|---|---|---|
| `public/script.js`, `public/style.css` | **1 438 / 1 438** | — |
| `server.js` | **977 / 1 082** | Carlos 105 |
| `public/index.html` | **178 / 181** | Carlos 3 |
| `main.cpp` (CLI menu) | **317 / 445** | dominith 95, Carlos 33 |
| `Algoritmos.cpp` | 8 / 136 | **Carlos 128** |
| `Grafo.cpp` + `Grafo.h` | 0 / 57 | **Carlos 57** |
| `greedy.h`, `montecarlo.h`, `bellmanford.h` | 3 / 171 | **Carlos 168** |
| `CostoRentabilidad.cpp` + `.h` | 0 / 22 | **Carlos 22** |
| **Total** | **3 469 (85%)** | 632 (15%) |

The split is not uniform, and the honest summary is this: **the web application
is mine, the C++ algorithm engine is largely Carlos Savero's.**

Within the JavaScript engine in `server.js`, which I did write, the ownership is
also mixed:

| Function | Mine | Carlos's |
|---|---|---|
| `dijkstra`, `bfs`, `dfs` | **162 / 162** | — |
| `buildGraph`, `compareAlgorithms` | **102 / 102** | — |
| `runAlgorithm` | 228 / 243 | 15 |
| `monteCarlo` | 19 / 52 | 33 |
| `greedy`, `bellmanFord` | 2 / 59 | **57** |

So the algorithms I can speak to in detail are **Dijkstra, BFS and DFS**, plus
the comparison harness that runs all six and the whole measurement described in
*What I found*.

Also contributing: **dominith** (CLI menu) and **fra2804**.

The regression fixes, the test suites and the CI described above are later work,
after the team project ended.

---

## License

MIT — see [LICENSE](LICENSE).

Data from OurAirports (public domain) and OpenFlights (ODbL).
