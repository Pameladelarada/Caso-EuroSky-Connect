const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");
require("dotenv").config();

const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_PATH = path.join(__dirname, "data.json");

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

function readData() {
    return JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
}

function writeData(data) {
    fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), "utf8");
}

function getAirportMap(data) {
    return new Map(data.aeropuertos.map((airport) => [airport.id, airport]));
}

function routeScore(route) {
    const weightedCost = route.costo_operativo + route.tasa_aeroportuaria - route.beneficio_neto * 0.12;
    return Math.max(1, weightedCost);
}

function buildGraph(data) {
    const graph = new Map(data.aeropuertos.map((airport) => [airport.id, []]));

    data.rutas.forEach((route) => {
        if (!graph.has(route.origen)) graph.set(route.origen, []);
        graph.get(route.origen).push({
            ...route,
            peso: routeScore(route)
        });
    });

    return graph;
}

function dijkstra(data, startId, endId) {
    const graph = buildGraph(data);
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

    if (!previous.has(endId) && startId !== endId) return null;

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

    return summarizeRoute(data, airportIds, segments, "Dijkstra");
}

function bfs(data, startId, endId) {
    const graph = buildGraph(data);
    const queue = [startId];
    const visited = new Set([startId]);
    const previous = new Map();

    while (queue.length > 0) {
        const currentId = queue.shift();
        if (currentId === endId) break;

        const edges = graph.get(currentId) || [];
        edges.forEach((edge) => {
            if (!visited.has(edge.destino)) {
                visited.add(edge.destino);
                previous.set(edge.destino, { id: currentId, edge });
                queue.push(edge.destino);
            }
        });
    }

    return buildRouteFromPrevious(data, startId, endId, previous, "BFS");
}

function dfs(data, startId, endId) {
    const graph = buildGraph(data);
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
    return found ? buildRouteFromPrevious(data, startId, endId, previous, "DFS") : null;
}

function buildRouteFromPrevious(data, startId, endId, previous, algoritmo) {
    if (!previous.has(endId) && startId !== endId) return null;

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

    return summarizeRoute(data, airportIds, segments, algoritmo);
}

function runAlgorithm(data, algorithm, startId, endId) {
    const normalized = String(algorithm || "dijkstra").toLowerCase();

    if (startId === endId) {
        const airport = getAirportMap(data).get(startId);
        return summarizeRoute(data, airport ? [startId] : [], [], normalized.toUpperCase());
    }

    if (normalized === "bfs") return bfs(data, startId, endId);
    if (normalized === "dfs") return dfs(data, startId, endId);
    return dijkstra(data, startId, endId);
}

function summarizeRoute(data, airportIds, segments, algoritmo = "Dijkstra") {
    const airports = getAirportMap(data);
    const secuencia = airportIds.map((id) => airports.get(id)).filter(Boolean);
    const distancia = segments.reduce((sum, route) => sum + route.distancia, 0);
    const tiempoVuelo = segments.reduce((sum, route) => sum + route.tiempo_vuelo_min, 0);
    const tiempoEscalas = segments.reduce((sum, route) => sum + route.tiempo_escala_min, 0);
    const costoTotal = segments.reduce(
        (sum, route) => sum + route.costo_operativo + route.tasa_aeroportuaria,
        0
    );
    const ingresoTotal = segments.reduce((sum, route) => sum + route.ingreso_proyectado, 0);
    const beneficioNeto = ingresoTotal - costoTotal;
    const escalas = secuencia.slice(1, -1).map((airport) => ({
        ciudad: airport.ciudad,
        pais: airport.pais,
        codigo: airport.codigo
    }));

    return {
        algoritmo,
        secuencia,
        segmentos: segments,
        distancia,
        tiempo_vuelo_min: tiempoVuelo,
        tiempo_escala_min: tiempoEscalas,
        tiempo_total_min: tiempoVuelo + tiempoEscalas,
        costo_total: costoTotal,
        ingreso_total: ingresoTotal,
        beneficio_neto: beneficioNeto,
        escalas,
        cantidad_escalas: escalas.length,
        dentro_jornada: tiempoVuelo + tiempoEscalas <= data.configuracion.jornada_maxima_min
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
            resumen: summarizeRoute(data, airportIds, segments)
        };
    });
}

function nextId(items) {
    return items.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0) + 1;
}

app.get("/api/data", (req, res) => {
    res.json(readData());
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

    if (!inicio || !fin) {
        return res.status(400).json({ error: "Debe enviar inicio y fin." });
    }

    const result = runAlgorithm(data, algoritmo, inicio, fin);
    if (!result) return res.status(404).json({ error: "No existe una ruta conectada." });

    res.json(result);
});

app.get("/api/comparar", (req, res) => {
    const data = readData();
    const inicio = Number(req.query.inicio);
    const fin = Number(req.query.fin);

    if (!inicio || !fin) {
        return res.status(400).json({ error: "Debe enviar inicio y fin." });
    }

    const resultados = ["dijkstra", "bfs", "dfs"].map((algoritmo) => ({
        algoritmo: algoritmo.toUpperCase(),
        resultado: runAlgorithm(data, algoritmo, inicio, fin)
    }));

    res.json(resultados);
});

app.get("/vuelos", (req, res) => {
    res.json(readData().vuelos || []);
});

app.post("/vuelos", (req, res) => {
    const data = readData();
    const vuelos = data.vuelos || [];
    const { nombre, descripcion, lat, lng, prioridad = "Media" } = req.body;

    if (!nombre || !descripcion || Number.isNaN(Number(lat)) || Number.isNaN(Number(lng))) {
        return res.status(400).json({ error: "Nombre, descripcion, latitud y longitud son obligatorios." });
    }

    const vuelo = {
        id: nextId(vuelos),
        nombre,
        descripcion,
        prioridad,
        lat: Number(lat),
        lng: Number(lng),
        creado_en: new Date().toISOString()
    };

    vuelos.push(vuelo);
    data.vuelos = vuelos;
    writeData(data);
    res.status(201).json(vuelo);
});

app.put("/vuelos/:id", (req, res) => {
    const data = readData();
    const vuelos = data.vuelos || [];
    const id = Number(req.params.id);
    const index = vuelos.findIndex((vuelo) => vuelo.id === id);

    if (index === -1) return res.status(404).json({ error: "Vuelo no encontrado." });

    vuelos[index] = { ...vuelos[index], ...req.body, id };
    data.vuelos = vuelos;
    writeData(data);
    res.json(vuelos[index]);
});

app.delete("/vuelos/:id", (req, res) => {
    const data = readData();
    const id = Number(req.params.id);
    const originalLength = (data.vuelos || []).length;

    data.vuelos = (data.vuelos || []).filter((vuelo) => vuelo.id !== id);
    writeData(data);

    res.json({
        mensaje: originalLength === data.vuelos.length ? "No se encontro el vuelo." : "Vuelo eliminado."
    });
});

app.get("/dijkstra", (req, res) => {
    execFile(path.join(__dirname, "dijkstra.exe"), { cwd: __dirname }, (error, stdout, stderr) => {
        if (error) return res.status(500).send("Error ejecutando Dijkstra");
        if (stderr) return res.status(500).send(stderr);
        res.type("text/plain").send(stdout);
    });
});

app.listen(PORT, () => {
    console.log(`Servidor en http://localhost:${PORT}`);
});
