const fs = require("fs");
const path = require("path");
require("dotenv").config();

const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_PATH = path.join(__dirname, "data.json");
const PEN_RATE = 3.75;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

function readData() {
    return JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
}

function getAirportMap(data) {
    return new Map(data.aeropuertos.map((airport) => [airport.id, airport]));
}

function routeScore(route, algorithm) {
    if (algorithm === "bfs") return 1;
    if (algorithm === "dfs") return -route.beneficio_neto;
    return route.costo_operativo + route.tasa_aeroportuaria;
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
    const graph = buildGraph(data);
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

function runAlgorithm(data, algorithm, startId, endId, flightDate) {
    const normalized = String(algorithm || "dijkstra").toLowerCase();

    if (normalized === "bfs") return bfs(data, startId, endId, flightDate);
    if (normalized === "dfs") return dfs(data, startId, endId, flightDate);
    return dijkstra(data, startId, endId, flightDate);
}

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
    const costoTotal = segments.reduce(
        (sum, route) => sum + route.costo_operativo + route.tasa_aeroportuaria,
        0
    );
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

app.get("/api/data", (req, res) => {
    res.json(readData());
});

app.get("/api/config", (req, res) => {
    res.json({
        googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || ""
    });
});

app.get("/api/aeropuertos", (req, res) => {
    res.json(readData().aeropuertos);
});

app.get("/api/rutas-sugeridas", (req, res) => {
    res.json(getSuggestedRoutes(readData()));
});

app.get("/ruta", (req, res) => {
    const data = readData();
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