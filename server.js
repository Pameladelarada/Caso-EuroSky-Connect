const fs = require("fs");
const path = require("path");
require("dotenv").config();

const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_PATH = path.join(__dirname, "data.json");
const DATA_SOURCES_PATH = path.join(__dirname, "data_sources");
const PEN_RATE = 3.75;
let cachedDataSources = null;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

function readData() {
    return JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
}

function writeData(data) {
    fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), "utf8");
}

function nextId(items) {
    return items.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0) + 1;
}

function parseDelimitedLine(line, separator = ",") {
    const values = [];
    let current = "";
    let quoted = false;

    for (let i = 0; i < line.length; i += 1) {
        const char = line[i];
        const next = line[i + 1];

        if (char === "\"" && quoted && next === "\"") {
            current += "\"";
            i += 1;
        } else if (char === "\"") {
            quoted = !quoted;
        } else if (char === separator && !quoted) {
            values.push(current);
            current = "";
        } else {
            current += char;
        }
    }

    values.push(current);
    return values;
}

function readLinesIfExists(filePath) {
    if (!fs.existsSync(filePath)) return [];
    return fs.readFileSync(filePath, "utf8").split(/\r?\n/).filter(Boolean);
}

function loadDataSources() {
    if (cachedDataSources) return cachedDataSources;

    const ourAirports = new Map();
    const openFlightsAirports = new Map();
    const openFlightsRoutes = [];

    const ourAirportsLines = readLinesIfExists(path.join(DATA_SOURCES_PATH, "ourairports", "airports.csv"));
    const ourHeaders = ourAirportsLines.length ? parseDelimitedLine(ourAirportsLines[0]) : [];

    ourAirportsLines.slice(1).forEach((line) => {
        const values = parseDelimitedLine(line);
        const row = Object.fromEntries(ourHeaders.map((header, index) => [header, values[index] || ""]));
        const iata = String(row.iata_code || "").trim().toUpperCase();
        if (!iata) return;

        ourAirports.set(iata, {
            codigo: iata,
            nombre: row.name,
            ciudad: row.municipality,
            lat: Number(row.latitude_deg),
            lng: Number(row.longitude_deg),
            tipo: row.type,
            continente: row.continent,
            pais_iso: row.iso_country,
            region_iso: row.iso_region,
            servicio_programado: row.scheduled_service
        });
    });

    readLinesIfExists(path.join(DATA_SOURCES_PATH, "openflights", "airports.dat")).forEach((line) => {
        const values = parseDelimitedLine(line);
        const iata = String(values[4] || "").trim().toUpperCase();
        if (!iata || iata === "\\N") return;

        openFlightsAirports.set(iata, {
            id_openflights: Number(values[0]),
            nombre: values[1],
            ciudad: values[2],
            pais: values[3],
            codigo: iata,
            icao: values[5],
            lat: Number(values[6]),
            lng: Number(values[7])
        });
    });

    readLinesIfExists(path.join(DATA_SOURCES_PATH, "openflights", "routes.dat")).forEach((line) => {
        const values = parseDelimitedLine(line);
        const origen = String(values[2] || "").trim().toUpperCase();
        const destino = String(values[4] || "").trim().toUpperCase();
        if (!origen || !destino || origen === "\\N" || destino === "\\N") return;

        openFlightsRoutes.push({
            aerolinea: values[0],
            origen,
            destino,
            escalas: Number(values[7]) || 0,
            equipo: values[8] || ""
        });
    });

    cachedDataSources = {
        ourAirports,
        openFlightsAirports,
        openFlightsRoutes,
        resumen: {
            ourairports_aeropuertos: ourAirports.size,
            openflights_aeropuertos: openFlightsAirports.size,
            openflights_rutas: openFlightsRoutes.length
        }
    };

    return cachedDataSources;
}

function distanceKm(origin, destination) {
    const toRad = (value) => value * Math.PI / 180;
    const earthKm = 6371;
    const dLat = toRad(destination.lat - origin.lat);
    const dLng = toRad(destination.lng - origin.lng);
    const lat1 = toRad(origin.lat);
    const lat2 = toRad(destination.lat);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return Math.round(earthKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function estimateExternalRoute(routeId, origin, destination, demand, config) {
    const distance = distanceKm(origin, destination);
    const demandFactor = Math.min(1.28, 1 + Math.log10(Math.max(1, demand)) / 12);
    const capacity = Math.min(config.capacidad_maxima_pasajeros || 180, 180);
    const price = config.precio_promedio_boleto || 145;
    const occupiedSeats = Math.round(capacity * Math.min(0.9, 0.58 + Math.log10(Math.max(1, demand)) / 18));

    return {
        id: routeId,
        origen: origin.id,
        destino: destination.id,
        distancia: distance,
        tiempo_vuelo_min: Math.max(35, Math.round((distance / 780) * 60 + 28)),
        tiempo_escala_min: 0,
        costo_operativo: Math.round((1800 + distance * 7.2) / demandFactor),
        tasa_aeroportuaria: Math.round(320 + distance * 0.38),
        ingreso_proyectado: Math.round(occupiedSeats * price * demandFactor),
        fuente: "OpenFlights/data_sources",
        externa: true,
        demanda_externa: demand
    };
}

function readOperationalData() {
    const data = readData();
    const sources = loadDataSources();
    const airportsByCode = new Map(data.aeropuertos.map((airport) => [airport.codigo.toUpperCase(), airport]));
    const routeKeys = new Set(data.rutas.map((route) => `${route.origen}-${route.destino}`));
    const externalDemand = new Map();

    data.aeropuertos = data.aeropuertos.map((airport) => {
        const code = airport.codigo.toUpperCase();
        const our = sources.ourAirports.get(code);
        const open = sources.openFlightsAirports.get(code);

        return {
            ...airport,
            fuente_datos: {
                json: true,
                ourairports: Boolean(our),
                openflights: Boolean(open)
            },
            tipo_aeropuerto: our?.tipo || airport.tipo_aeropuerto || "large_airport",
            servicio_programado: our?.servicio_programado || airport.servicio_programado || "yes",
            lat: Number.isFinite(Number(airport.lat)) ? airport.lat : our?.lat || open?.lat,
            lng: Number.isFinite(Number(airport.lng)) ? airport.lng : our?.lng || open?.lng
        };
    });

    sources.openFlightsRoutes.forEach((route) => {
        const origin = airportsByCode.get(route.origen);
        const destination = airportsByCode.get(route.destino);
        if (!origin || !destination) return;

        const key = `${origin.id}-${destination.id}`;
        externalDemand.set(key, (externalDemand.get(key) || 0) + 1);
    });

    data.rutas = data.rutas.map((route) => {
        const demand = externalDemand.get(`${route.origen}-${route.destino}`) || 0;
        const demandDiscount = demand ? Math.min(0.14, Math.log10(demand + 1) / 30) : 0;
        const adjustedCost = Math.round((route.costo_operativo + route.tasa_aeroportuaria) * (1 - demandDiscount));

        return {
            ...route,
            demanda_externa: demand,
            costo_ajustado: adjustedCost,
            fuente: route.fuente || (demand ? "JSON + OpenFlights/data_sources" : "JSON")
        };
    });

    let nextRouteId = nextId(data.rutas);
    externalDemand.forEach((demand, key) => {
        const [originId, destinationId] = key.split("-").map(Number);
        if (routeKeys.has(key)) return;

        const origin = data.aeropuertos.find((airport) => airport.id === originId);
        const destination = data.aeropuertos.find((airport) => airport.id === destinationId);
        if (!origin || !destination) return;

        data.rutas.push(estimateExternalRoute(nextRouteId, origin, destination, demand, data.configuracion || {}));
        routeKeys.add(key);
        nextRouteId += 1;
    });

    data.fuentes_operativas = {
        data_json: true,
        data_sources: sources.resumen,
        rutas_agregadas_desde_data_sources: data.rutas.filter((route) => route.externa).length,
        rutas_json_con_demanda_externa: data.rutas.filter((route) => !route.externa && route.demanda_externa > 0).length
    };

    return data;
}

function getAirportMap(data) {
    return new Map(data.aeropuertos.map((airport) => [airport.id, airport]));
}

function routeCost(route) {
    return route.costo_ajustado || route.costo_operativo + route.tasa_aeroportuaria;
}

function routeProfit(route) {
    return route.ingreso_proyectado - routeCost(route);
}

function routeScore(route, algorithm) {
    if (algorithm === "bfs") return 1;
    if (algorithm === "dfs") return -routeProfit(route);
    if (algorithm === "bellmanford") {
        return routeCost(route) + (route.tiempo_vuelo_min + route.tiempo_escala_min) * 18;
    }
    return routeCost(route);
}

function buildGraph(data, algorithm = "dijkstra") {
    const graph = new Map(data.aeropuertos.map((airport) => [airport.id, []]));

    data.rutas.forEach((route) => {
        if (!graph.has(route.origen)) graph.set(route.origen, []);
        graph.get(route.origen).push({
            ...route,
            peso: routeScore(route, algorithm)
        });
    });

    if (algorithm === "dfs") {
        graph.forEach((edges) => {
            edges.sort((a, b) => b.distancia - a.distancia);
        });
    }

    if (algorithm === "dijkstra") {
        graph.forEach((edges) => {
            edges.sort((a, b) => a.peso - b.peso);
        });
    }

    if (algorithm === "bfs") {
    graph.forEach((edges) => {
            edges.sort((a, b) => {
                if (a.tiempo_vuelo_min !== b.tiempo_vuelo_min) {
                    return a.tiempo_vuelo_min - b.tiempo_vuelo_min;
                }

                if (a.distancia !== b.distancia) {
                    return a.distancia - b.distancia;
                }

                return routeCost(a) - routeCost(b);
            });
        });
    }

    return graph;
}

function dijkstra(data, startId, endId, flightDate) {
    const graph = buildGraph(data, "dijkstra");
    const distances = new Map();
    const previous = new Map();
    const visited = new Set();
    const queue = [];

    data.aeropuertos.forEach((airport) => distances.set(airport.id, Infinity));
    distances.set(startId, 0);
    queue.push({ id: startId, cost: 0 });

    while (queue.length > 0) {
        queue.sort((a, b) => a.cost - b.cost);
        const current = queue.shift();

        if (visited.has(current.id)) continue;
        visited.add(current.id);
        if (current.id === endId) break;

        const edges = graph.get(current.id) || [];
        edges.forEach((edge) => {
            const nextCost = distances.get(current.id) + edge.peso;
            if (nextCost < distances.get(edge.destino)) {
                distances.set(edge.destino, nextCost);
                previous.set(edge.destino, { id: current.id, edge });
                queue.push({ id: edge.destino, cost: nextCost });
            }
        });
    }

    return buildRouteFromPrevious(data, startId, endId, previous, "Dijkstra", flightDate);
}

function bfs(data, startId, endId, flightDate) {
    const graph = buildGraph(data, "bfs");
    const queue = [{
        id: startId,
        airportIds: [startId],
        segments: []
    }];
    const bestDepth = new Map();
    const candidates = [];

    bestDepth.set(startId, 0);

    while (queue.length > 0) {
        const current = queue.shift();

        if (current.id === endId) {
            candidates.push(current);
            continue;
        }

        const edges = graph.get(current.id) || [];

        edges.forEach((edge) => {
            if (current.airportIds.includes(edge.destino)) return;

            const nextDepth = current.segments.length + 1;
            const knownDepth = bestDepth.get(edge.destino);

            if (knownDepth !== undefined && nextDepth > knownDepth) return;

            bestDepth.set(edge.destino, nextDepth);

            queue.push({
                id: edge.destino,
                airportIds: [...current.airportIds, edge.destino],
                segments: [...current.segments, edge]
            });
        });
    }

    if (!candidates.length) return null;

    candidates.sort((a, b) => {
        const stopsA = Math.max(0, a.airportIds.length - 2);
        const stopsB = Math.max(0, b.airportIds.length - 2);

        if (stopsA !== stopsB) return stopsA - stopsB;

        const timeA = a.segments.reduce(
            (sum, route) => sum + route.tiempo_vuelo_min + route.tiempo_escala_min,
            0
        );
        const timeB = b.segments.reduce(
            (sum, route) => sum + route.tiempo_vuelo_min + route.tiempo_escala_min,
            0
        );

        if (timeA !== timeB) return timeA - timeB;

        const distanceA = a.segments.reduce((sum, route) => sum + route.distancia, 0);
        const distanceB = b.segments.reduce((sum, route) => sum + route.distancia, 0);

        return distanceA - distanceB;
    });

    const selected = candidates[0];

    return summarizeRoute(
        data,
        selected.airportIds,
        selected.segments,
        "BFS - menos escalas y menor tiempo",
        flightDate
    );
}

function dfs(data, startId, endId, flightDate) {
    const graph = buildGraph(data, "dfs");
    const visited = new Set();
    const previous = new Map();
    let found = false;

    function visit(currentId) {
        if (found) return;
        visited.add(currentId);

        if (currentId === endId) {
            found = true;
            return;
        }

        const edges = graph.get(currentId) || [];
        for (const edge of edges) {
            if (!visited.has(edge.destino)) {
                previous.set(edge.destino, { id: currentId, edge });
                visit(edge.destino);
                if (found) return;
            }
        }
    }

    visit(startId);
    return found ? buildRouteFromPrevious(data, startId, endId, previous, "DFS", flightDate) : null;
}

function buildRouteFromPrevious(data, startId, endId, previous, algorithm, flightDate) {
    if (startId === endId) {
        const airport = getAirportMap(data).get(startId);
        return summarizeRoute(data, airport ? [startId] : [], [], algorithm, flightDate);
    }

    if (!previous.has(endId)) return null;

    const airportIds = [];
    const segments = [];
    let currentId = endId;

    airportIds.unshift(currentId);
    while (currentId !== startId) {
        const item = previous.get(currentId);
        if (!item) return null;
        segments.unshift(item.edge);
        currentId = item.id;
        airportIds.unshift(currentId);
    }

    return summarizeRoute(data, airportIds, segments, algorithm, flightDate);
}

function greedy(data, startId, endId, flightDate) {
    const graph = buildGraph(data, "dijkstra");
    const distances = new Map();
    const previous = new Map();
    const visited = new Set();
    const queue = [];

    data.aeropuertos.forEach((airport) => distances.set(airport.id, Infinity));
    distances.set(startId, 0);
    queue.push({ id: startId, cost: 0 });

    while (queue.length > 0) {
        queue.sort((a, b) => a.cost - b.cost);
        const current = queue.shift();

        if (visited.has(current.id)) continue;
        visited.add(current.id);
        if (current.id === endId) break;

        const edges = graph.get(current.id) || [];
        edges.forEach((edge) => {
            const nextCost = distances.get(current.id) + edge.peso;
            if (nextCost < distances.get(edge.destino)) {
                distances.set(edge.destino, nextCost);
                previous.set(edge.destino, { id: current.id, edge });
                queue.push({ id: edge.destino, cost: edge.peso });
            }
        });
    }

    return buildRouteFromPrevious(data, startId, endId, previous, "Greedy", flightDate);
}

function monteCarlo(data, startId, endId, flightDate, iterations = 1000) {
    const graph = buildGraph(data, "dijkstra");
    let bestRouteIds = [];
    let bestSegments = [];
    let bestScore = Infinity;

    for (let i = 0; i < iterations; i++) {
        let currentId = startId;
        let currentCost = 0;
        const airportIds = [startId];
        const segments = [];
        const visited = new Set([startId]);

        while (currentId !== endId) {
            const edges = graph.get(currentId) || [];
            const validEdges = edges.filter(e => !visited.has(e.destino));

            if (validEdges.length === 0) break;

            const sortedEdges = [...validEdges].sort((a, b) => {
                const utilityA = routeCost(a) - routeProfit(a) * 0.35 + a.tiempo_vuelo_min * 12;
                const utilityB = routeCost(b) - routeProfit(b) * 0.35 + b.tiempo_vuelo_min * 12;
                return utilityA - utilityB;
            });
            const candidatePool = sortedEdges.slice(0, Math.min(4, sortedEdges.length));
            const chosenEdge = candidatePool[Math.floor(Math.random() * candidatePool.length)];
            
            airportIds.push(chosenEdge.destino);
            segments.push(chosenEdge);
            visited.add(chosenEdge.destino);
            currentCost += chosenEdge.peso;
            currentId = chosenEdge.destino;
        }

        if (currentId === endId) {
            const income = segments.reduce((sum, route) => sum + route.ingreso_proyectado, 0);
            const time = segments.reduce((sum, route) => sum + route.tiempo_vuelo_min + route.tiempo_escala_min, 0);
            const stops = Math.max(0, airportIds.length - 2);
            const score = currentCost - income * 0.22 + time * 10 + stops * 650;

            if (score < bestScore) {
                bestScore = score;
                bestRouteIds = airportIds;
                bestSegments = segments;
            }
        }
    }

    if (bestRouteIds.length === 0) return null;
    return summarizeRoute(data, bestRouteIds, bestSegments, "Monte Carlo", flightDate);
}

function bellmanFord(data, startId, endId, flightDate) {
    const graph = buildGraph(data, "bellmanford");
    const distances = new Map();
    const previous = new Map();

    data.aeropuertos.forEach((airport) => distances.set(airport.id, Infinity));
    distances.set(startId, 0);

    const V = data.aeropuertos.length;

    for (let i = 1; i < V; i++) {
        graph.forEach((edges, u) => {
            if (distances.get(u) === Infinity) return;
            edges.forEach(edge => {
                const v = edge.destino;
                if (distances.get(u) + edge.peso < distances.get(v)) {
                    distances.set(v, distances.get(u) + edge.peso);
                    previous.set(v, { id: u, edge });
                }
            });
        });
    }

    return buildRouteFromPrevious(data, startId, endId, previous, "Bellman-Ford costo-tiempo", flightDate);
}

function runAlgorithm(data, algorithm, startId, endId, flightDate) {
    const normalized = String(algorithm || "dijkstra").toLowerCase();

    if (normalized === "bfs") return bfs(data, startId, endId, flightDate);
    if (normalized === "dfs") return dfs(data, startId, endId, flightDate);
    if (normalized === "greedy") return greedy(data, startId, endId, flightDate);
    if (normalized === "montecarlo") return monteCarlo(data, startId, endId, flightDate);
    if (normalized === "bellmanford") return bellmanFord(data, startId, endId, flightDate);
    return dijkstra(data, startId, endId, flightDate);
}

const algorithmRegistry = {
    dijkstra: {
        label: "Dijkstra - menor costo",
        run: (data, startId, endId, flightDate) => dijkstra(data, startId, endId, flightDate)
    },
    bfs: {
        label: "BFS - menos escalas",
        run: (data, startId, endId, flightDate) => bfs(data, startId, endId, flightDate)
    },
    dfs: {
        label: "DFS - ruta alternativa profunda",
        run: (data, startId, endId, flightDate) => dfs(data, startId, endId, flightDate)
    },
    greedy: {
        label: "Greedy - búsqueda voraz",
        run: (data, startId, endId, flightDate) => greedy(data, startId, endId, flightDate)
    },
    montecarlo: {
        label: "Monte Carlo - ruta aleatoria",
        run: (data, startId, endId, flightDate) => monteCarlo(data, startId, endId, flightDate)
    },
    bellmanford: {
        label: "Bellman-Ford - menor costo con iteraciones",
        run: (data, startId, endId, flightDate) => bellmanFord(data, startId, endId, flightDate)
    }
};

function addMinutesToDate(dateText, minutes) {
    if (!dateText) return "";
    const date = new Date(`${dateText}T08:00:00`);
    date.setMinutes(date.getMinutes() + minutes);
    return date.toISOString().slice(0, 16).replace("T", " ");
}

function summarizeRoute(data, airportIds, segments, algorithm = "Dijkstra", flightDate = "") {
    const airports = getAirportMap(data);
    const sequence = airportIds.map((id) => airports.get(id)).filter(Boolean);
    const distancia = segments.reduce((sum, route) => sum + route.distancia, 0);
    const tiempoVuelo = segments.reduce((sum, route) => sum + route.tiempo_vuelo_min, 0);
    const tiempoEscalas = segments.reduce((sum, route) => sum + route.tiempo_escala_min, 0);
    const costoTotal = segments.reduce((sum, route) => sum + routeCost(route), 0);
    const ingresoTotal = segments.reduce((sum, route) => sum + route.ingreso_proyectado, 0);
    const beneficioNeto = ingresoTotal - costoTotal;
    const tiempoTotal = tiempoVuelo + tiempoEscalas;
    const escalas = sequence.slice(1, -1).map((airport) => ({
        ciudad: airport.ciudad,
        pais: airport.pais,
        codigo: airport.codigo
    }));

    return {
        algoritmo: algorithm,
        fecha_vuelo: flightDate,
        fecha_llegada_estimada: addMinutesToDate(flightDate, tiempoTotal),
        secuencia: sequence,
        segmentos: segments,
        distancia,
        tiempo_vuelo_min: tiempoVuelo,
        tiempo_escala_min: tiempoEscalas,
        tiempo_total_min: tiempoTotal,
        costo_total: costoTotal,
        costo_total_pen: costoTotal * PEN_RATE,
        ingreso_total: ingresoTotal,
        ingreso_total_pen: ingresoTotal * PEN_RATE,
        beneficio_neto: beneficioNeto,
        beneficio_neto_pen: beneficioNeto * PEN_RATE,
        escalas,
        cantidad_escalas: escalas.length,
        dentro_jornada: tiempoTotal <= data.configuracion.jornada_maxima_min
    };
}

function getSuggestedRoutes(data) {
    return data.itinerarios.map((itinerary) => {
        const airportIds = itinerary.aeropuertos;
        const segments = [];

        for (let i = 0; i < airportIds.length - 1; i += 1) {
            const direct = data.rutas.find(
                (route) => route.origen === airportIds[i] && route.destino === airportIds[i + 1]
            );
            if (direct) segments.push(direct);
        }

        return {
            ...itinerary,
            resumen: summarizeRoute(data, airportIds, segments, "Sugerida")
        };
    });
}

function enumerateCandidateRoutes(data, startId, endId, flightDate = "", maxDepth = 6, maxCandidates = 50) {
    const graph = new Map();
    const airports = getAirportMap(data);
    const target = airports.get(endId);

    data.rutas.forEach((route) => {
        if (!graph.has(route.origen)) graph.set(route.origen, []);
        graph.get(route.origen).push(route);
    });

    graph.forEach((routes) => {
        routes.sort((a, b) => {
            if (a.destino === endId && b.destino !== endId) return -1;
            if (b.destino === endId && a.destino !== endId) return 1;
            if (Boolean(a.externa) !== Boolean(b.externa)) return a.externa ? 1 : -1;
            if ((a.demanda_externa || 0) !== (b.demanda_externa || 0)) {
                return (b.demanda_externa || 0) - (a.demanda_externa || 0);
            }
            if (target) {
                const nextA = airports.get(a.destino);
                const nextB = airports.get(b.destino);
                const heuristicA = nextA ? distanceKm(nextA, target) : 0;
                const heuristicB = nextB ? distanceKm(nextB, target) : 0;
                if (heuristicA !== heuristicB) return heuristicA - heuristicB;
            }
            return routeCost(a) - routeCost(b);
        });
    });

    const candidates = [];

    function visit(currentId, airportIds, segments, visited) {
        if (candidates.length >= maxCandidates) return;
        if (currentId === endId && segments.length) {
            const summary = summarizeRoute(data, airportIds, segments, "Ranking comercial", flightDate);
            if (summary.dentro_jornada) candidates.push(summary);
            return;
        }

        if (segments.length >= maxDepth) return;

        const edges = graph.get(currentId) || [];
        const directEdges = edges.filter((route) => route.destino === endId);
        const limitedEdges = [...directEdges, ...edges.slice(0, 12)]
            .filter((route, index, list) => list.findIndex((item) => item.id === route.id) === index);

        limitedEdges.forEach((route) => {
            if (visited.has(route.destino)) return;
            visited.add(route.destino);
            airportIds.push(route.destino);
            segments.push(route);
            visit(route.destino, airportIds, segments, visited);
            segments.pop();
            airportIds.pop();
            visited.delete(route.destino);
        });
    }

    visit(startId, [startId], [], new Set([startId]));
    return candidates;
}

function sortCandidateRoutes(routes, algorithm = "dijkstra") {
    const normalized = String(algorithm || "dijkstra").toLowerCase();

    return [...routes].sort((a, b) => {
        if (normalized === "bfs") {
            if (a.cantidad_escalas !== b.cantidad_escalas) return a.cantidad_escalas - b.cantidad_escalas;
            if (a.tiempo_total_min !== b.tiempo_total_min) return a.tiempo_total_min - b.tiempo_total_min;
            return a.costo_total - b.costo_total;
        }

        if (normalized === "dfs") {
            if (a.beneficio_neto !== b.beneficio_neto) return b.beneficio_neto - a.beneficio_neto;
            if (a.cantidad_escalas !== b.cantidad_escalas) return b.cantidad_escalas - a.cantidad_escalas;
            return a.costo_total - b.costo_total;
        }

        if (a.costo_total !== b.costo_total) return a.costo_total - b.costo_total;
        if (a.cantidad_escalas !== b.cantidad_escalas) return a.cantidad_escalas - b.cantidad_escalas;
        if (a.tiempo_total_min !== b.tiempo_total_min) return a.tiempo_total_min - b.tiempo_total_min;
        return b.beneficio_neto - a.beneficio_neto;
    });
}

function getBestRoutesBetween(data, startId, endId, flightDate = "", algorithm = "dijkstra") {
    const normalized = String(algorithm || "dijkstra").toLowerCase();
    const config = algorithmRegistry[normalized] || algorithmRegistry.dijkstra;
    const key = algorithmRegistry[normalized] ? normalized : "dijkstra";
    const candidates = enumerateCandidateRoutes(data, startId, endId, flightDate);

    return [{
        algoritmo: key,
        nombre: config.label,
        rutas: sortCandidateRoutes(candidates, key)
            .slice(0, 3)
            .map((route) => ({
                ...route,
                algoritmo: config.label,
                algoritmo_id: key,
                algoritmo_nombre: config.label
            }))
    }];
}

function getBestCommercialRoutes(data, flightDate = "") {
    const airportIds = data.aeropuertos.map((airport) => airport.id);

    return Object.entries(algorithmRegistry).map(([key, config]) => {
        const routes = [];

        airportIds.forEach((startId) => {
            airportIds.forEach((endId) => {
                if (startId === endId) return;

                const result = config.run(data, startId, endId, flightDate);
                if (!result || !result.segmentos.length) return;
                if (!result.dentro_jornada) return;

                routes.push({
                    ...result,
                    algoritmo_id: key,
                    algoritmo_nombre: config.label
                });
            });
        });

        routes.sort((a, b) => {
            if (a.costo_total !== b.costo_total) return a.costo_total - b.costo_total;
            if (a.cantidad_escalas !== b.cantidad_escalas) return a.cantidad_escalas - b.cantidad_escalas;
            return b.beneficio_neto - a.beneficio_neto;
        });

        return {
            algoritmo: key,
            nombre: config.label,
            rutas: routes.slice(0, 3)
        };
    });
}

function compareAlgorithms(data, startId, endId, flightDate = "") {
    const results = Object.entries(algorithmRegistry).map(([key, config]) => {
        const startedAt = Date.now();
        const result = config.run(data, startId, endId, flightDate);
        const executionMs = Date.now() - startedAt;

        if (!result) {
            return {
                algoritmo_id: key,
                algoritmo_nombre: config.label,
                disponible: false,
                tiempo_ejecucion_ms: executionMs
            };
        }

        return {
            algoritmo_id: key,
            algoritmo_nombre: config.label,
            disponible: true,
            secuencia: result.secuencia.map((airport) => airport.codigo),
            secuencia_detalle: result.secuencia,
            costo_total: result.costo_total,
            ingreso_total: result.ingreso_total,
            beneficio_neto: result.beneficio_neto,
            distancia_total_km: result.distancia,
            tiempo_total_min: result.tiempo_total_min,
            cantidad_escalas: result.cantidad_escalas,
            dentro_jornada: result.dentro_jornada,
            tiempo_ejecucion_ms: executionMs
        };
    });

    const available = results.filter((result) => result.disponible);
    const bestCost = available.reduce((best, current) => !best || current.costo_total < best.costo_total ? current : best, null);
    const bestTime = available.reduce((best, current) => !best || current.tiempo_total_min < best.tiempo_total_min ? current : best, null);
    const bestProfit = available.reduce((best, current) => !best || current.beneficio_neto > best.beneficio_neto ? current : best, null);
    const bestStops = available.reduce((best, current) => !best || current.cantidad_escalas < best.cantidad_escalas ? current : best, null);

    return results.map((result) => ({
        ...result,
        destacados: {
            menor_costo: Boolean(bestCost && result.algoritmo_id === bestCost.algoritmo_id),
            menor_tiempo: Boolean(bestTime && result.algoritmo_id === bestTime.algoritmo_id),
            mayor_beneficio: Boolean(bestProfit && result.algoritmo_id === bestProfit.algoritmo_id),
            menos_escalas: Boolean(bestStops && result.algoritmo_id === bestStops.algoritmo_id)
        }
    }));
}

app.get("/api/data", (req, res) => {
    res.json(readOperationalData());
});

app.get("/api/resumen", (req, res) => {
    const data = readOperationalData();
    res.json({
        aeropuertos: data.aeropuertos.length,
        rutas: data.rutas.length,
        aeronaves: data.aeronaves.length,
        jornada_maxima_min: data.configuracion?.jornada_maxima_min || 480,
        fuentes_operativas: data.fuentes_operativas
    });
});

app.get("/api/fuentes", (req, res) => {
    res.json(readOperationalData().fuentes_operativas);
});

app.get("/api/config", (req, res) => {
    res.json({
        googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_API_KEY || ""
    });
});

app.get("/api/aeropuertos", (req, res) => {
    res.json(readOperationalData().aeropuertos);
});

app.post("/api/aeropuertos", (req, res) => {
    const data = readData();
    const { nombre, codigo, pais, ciudad, lat, lng, atractivo = "" } = req.body;

    if (!nombre || !codigo || !pais || !ciudad || Number.isNaN(Number(lat)) || Number.isNaN(Number(lng))) {
        return res.status(400).json({ error: "Nombre, código IATA, país, ciudad, latitud y longitud son obligatorios." });
    }

    const normalizedCode = String(codigo).trim().toUpperCase();
    const exists = data.aeropuertos.some((airport) => airport.codigo.toUpperCase() === normalizedCode);
    if (exists) {
        return res.status(409).json({ error: "Ya existe un aeropuerto con ese código IATA." });
    }

    const airport = {
        id: nextId(data.aeropuertos),
        nombre: String(nombre).trim(),
        codigo: normalizedCode,
        pais: String(pais).trim(),
        ciudad: String(ciudad).trim(),
        lat: Number(lat),
        lng: Number(lng),
        atractivo: String(atractivo || `Destino europeo registrado para operaciones de EuroSky Connect.`).trim()
    };

    data.aeropuertos.push(airport);
    writeData(data);
    res.status(201).json(airport);
});

app.get("/api/aeronaves", (req, res) => {
    res.json(readData().aeronaves || []);
});

app.post("/api/aeronaves", (req, res) => {
    const data = readData();
    const { nombre, capacidad, costo_diario, autonomia_km, restricciones } = req.body;
    const maxCapacity = data.configuracion?.capacidad_maxima_pasajeros || 255;

    if (!nombre || Number.isNaN(Number(capacidad)) || Number.isNaN(Number(costo_diario)) || Number.isNaN(Number(autonomia_km)) || !restricciones) {
        return res.status(400).json({ error: "Nombre, capacidad, costo diario, autonomía y restricciones son obligatorios." });
    }

    if (Number(capacidad) > maxCapacity) {
        return res.status(400).json({ error: `La capacidad no puede superar ${maxCapacity} pasajeros.` });
    }

    const aircraft = {
        id: nextId(data.aeronaves || []),
        nombre: String(nombre).trim(),
        capacidad: Number(capacidad),
        costo_diario: Number(costo_diario),
        autonomia_km: Number(autonomia_km),
        restricciones: String(restricciones).trim()
    };

    data.aeronaves = data.aeronaves || [];
    data.aeronaves.push(aircraft);
    writeData(data);
    res.status(201).json(aircraft);
});

app.get("/api/rutas-sugeridas", (req, res) => {
    res.json(getSuggestedRoutes(readOperationalData()));
});

app.get("/api/mejores-rutas", (req, res) => {
    const data = readOperationalData();
    const fecha = req.query.fecha || "";
    const inicio = Number(req.query.inicio);
    const fin = Number(req.query.fin);
    const algoritmo = req.query.algoritmo || "dijkstra";

    if (inicio && fin) {
        return res.json(getBestRoutesBetween(data, inicio, fin, fecha, algoritmo));
    }

    res.json(getBestCommercialRoutes(data, fecha));
});

app.get("/api/comparacion", (req, res) => {
    const data = readOperationalData();
    const inicio = Number(req.query.inicio);
    const fin = Number(req.query.fin);
    const fecha = req.query.fecha || "";

    if (!inicio || !fin) {
        return res.status(400).json({ error: "Debe enviar inicio y fin." });
    }

    res.json(compareAlgorithms(data, inicio, fin, fecha));
});

app.get("/ruta", (req, res) => {
    const data = readOperationalData();
    const inicio = Number(req.query.inicio);
    const fin = Number(req.query.fin);
    const algoritmo = req.query.algoritmo || "dijkstra";
    const fecha = req.query.fecha || "";

    if (!inicio || !fin) {
        return res.status(400).json({ error: "Debe enviar inicio y fin." });
    }

    const result = runAlgorithm(data, algoritmo, inicio, fin, fecha);
    if (!result) return res.status(404).json({ error: "No existe una ruta conectada." });

    res.json(result);
});

app.listen(PORT, () => {
    console.log(`Servidor en http://localhost:${PORT}`);
});
