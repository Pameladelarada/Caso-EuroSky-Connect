// tests/api.test.js
//
// Pruebas de la API con el runner nativo de Node (node:test).
// Sin dependencias extra: requiere Node 18+.
//
//   npm test
//
// El servidor escribe sobre data.json, asi que la suite hace una copia de
// seguridad antes de arrancar y la restaura al terminar, pase lo que pase.

const test = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const RAIZ = path.join(__dirname, "..");
const DATA = path.join(RAIZ, "data.json");
const RESPALDO = path.join(__dirname, ".data.backup.json");
const PUERTO = 3999;
const BASE = `http://127.0.0.1:${PUERTO}`;

let servidor;

async function esperarServidor(intentos = 40) {
    for (let i = 0; i < intentos; i += 1) {
        try {
            const r = await fetch(`${BASE}/api/resumen`);
            if (r.ok) return;
        } catch {
            // el servidor todavia no levanta
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
    }
    throw new Error("El servidor no respondio a tiempo");
}

test.before(async () => {
    fs.copyFileSync(DATA, RESPALDO);
    servidor = spawn(process.execPath, [path.join(RAIZ, "server.js")], {
        cwd: RAIZ,
        env: { ...process.env, PORT: String(PUERTO) },
        stdio: "ignore"
    });
    await esperarServidor();
});

test.after(() => {
    if (servidor) servidor.kill();
    if (fs.existsSync(RESPALDO)) {
        fs.copyFileSync(RESPALDO, DATA);
        fs.unlinkSync(RESPALDO);
    }
});

// ── lectura ────────────────────────────────────────────────────
test("GET /api/resumen devuelve los conteos del sistema", async () => {
    const res = await fetch(`${BASE}/api/resumen`);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.ok(body.aeropuertos > 0, "debe reportar aeropuertos");
    assert.ok(body.rutas > 0, "debe reportar rutas");
    assert.equal(typeof body.jornada_maxima_min, "number");
});

test("GET /api/aeropuertos devuelve coordenadas y codigos validos", async () => {
    const aeropuertos = await fetch(`${BASE}/api/aeropuertos`).then((r) => r.json());

    assert.ok(Array.isArray(aeropuertos));
    for (const a of aeropuertos) {
        assert.ok(a.lat >= -90 && a.lat <= 90, `latitud fuera de rango en ${a.codigo}`);
        assert.ok(a.lng >= -180 && a.lng <= 180, `longitud fuera de rango en ${a.codigo}`);
        assert.match(a.codigo, /^[A-Z]{3}$/, `codigo IATA invalido: ${a.codigo}`);
    }
});

// ── algoritmos ─────────────────────────────────────────────────
test("GET /ruta con Dijkstra devuelve una ruta coherente", async () => {
    const res = await fetch(`${BASE}/ruta?inicio=1&fin=2&algoritmo=dijkstra`);
    assert.equal(res.status, 200);

    const ruta = await res.json();
    assert.ok(Array.isArray(ruta.secuencia));
    assert.equal(ruta.secuencia[0].id, 1, "debe empezar en el origen");
    assert.equal(ruta.secuencia.at(-1).id, 2, "debe terminar en el destino");
});

test("GET /ruta exige inicio y fin", async () => {
    const res = await fetch(`${BASE}/ruta?inicio=1`);
    assert.equal(res.status, 400);
});

test("GET /ruta rechaza un algoritmo desconocido en vez de usar Dijkstra", async () => {
    const res = await fetch(`${BASE}/ruta?inicio=1&fin=2&algoritmo=no-existe`);
    assert.equal(res.status, 400);

    const body = await res.json();
    assert.match(body.error, /Algoritmo no soportado/);
});

test("GET /ruta acepta los seis algoritmos soportados", async () => {
    const algoritmos = ["dijkstra", "bfs", "dfs", "greedy", "montecarlo", "bellmanford"];

    for (const algoritmo of algoritmos) {
        const res = await fetch(`${BASE}/ruta?inicio=1&fin=2&algoritmo=${algoritmo}`);
        assert.ok(res.status === 200 || res.status === 404,
            `${algoritmo} deberia responder 200 o 404, respondio ${res.status}`);
    }
});

test("GET /api/comparacion evalua los seis algoritmos", async () => {
    const resultados = await fetch(`${BASE}/api/comparacion?inicio=1&fin=20`).then((r) => r.json());

    assert.ok(Array.isArray(resultados));
    assert.equal(resultados.length, 6, "deben compararse los seis algoritmos");

    const ids = resultados.map((r) => r.algoritmo_id).sort();
    assert.deepEqual(ids, ["bellmanford", "bfs", "dfs", "dijkstra", "greedy", "montecarlo"]);

    for (const r of resultados) {
        assert.ok(r.algoritmo_nombre, "cada resultado lleva el nombre del algoritmo");
        assert.equal(typeof r.disponible, "boolean");
    }
});

test("Dijkstra nunca es mas caro que Greedy entre los mismos puntos", async () => {
    const [dijkstra, greedy] = await Promise.all([
        fetch(`${BASE}/ruta?inicio=1&fin=20&algoritmo=dijkstra`).then((r) => r.json()),
        fetch(`${BASE}/ruta?inicio=1&fin=20&algoritmo=greedy`).then((r) => r.json())
    ]);

    if (dijkstra.resumen && greedy.resumen) {
        assert.ok(
            dijkstra.resumen.costo_total_usd <= greedy.resumen.costo_total_usd + 1e-6,
            "Dijkstra debe ser optimo frente a la heuristica greedy"
        );
    }
});

// ── validacion de aeropuertos ──────────────────────────────────
async function crearAeropuerto(cuerpo) {
    return fetch(`${BASE}/api/aeropuertos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cuerpo)
    });
}

const AEROPUERTO_BASE = {
    nombre: "Aeropuerto de Prueba",
    codigo: "ZZZ",
    pais: "Perú",
    ciudad: "Lima",
    lat: -12.02,
    lng: -77.11
};

test("POST /api/aeropuertos acepta un aeropuerto valido", async () => {
    const res = await crearAeropuerto(AEROPUERTO_BASE);
    assert.equal(res.status, 201);

    const creado = await res.json();
    assert.equal(creado.codigo, "ZZZ");
    assert.equal(creado.lat, -12.02);
});

test("POST /api/aeropuertos rechaza un codigo IATA repetido", async () => {
    const existentes = await fetch(`${BASE}/api/aeropuertos`).then((r) => r.json());
    const res = await crearAeropuerto({ ...AEROPUERTO_BASE, codigo: existentes[0].codigo });
    assert.equal(res.status, 409);
});

test("POST /api/aeropuertos rechaza un codigo IATA con formato invalido", async () => {
    for (const codigo of ["AB", "ABCD", "A1B", ""]) {
        const res = await crearAeropuerto({ ...AEROPUERTO_BASE, codigo });
        assert.equal(res.status, 400, `el codigo "${codigo}" deberia rechazarse`);
    }
});

test("POST /api/aeropuertos rechaza latitud y longitud nulas o vacias", async () => {
    // Number(null) y Number("") valen 0, no NaN: sin el arreglo, estos
    // aeropuertos se guardaban en la coordenada (0, 0).
    const casos = [
        { lat: null, lng: 10 },
        { lat: 10, lng: "" },
        { lat: undefined, lng: undefined }
    ];

    for (const caso of casos) {
        const res = await crearAeropuerto({ ...AEROPUERTO_BASE, codigo: "ZZY", ...caso });
        assert.equal(res.status, 400, `${JSON.stringify(caso)} deberia rechazarse`);
    }
});

test("POST /api/aeropuertos rechaza coordenadas fuera de rango", async () => {
    const casos = [{ lat: 999, lng: 10 }, { lat: 10, lng: -5000 }, { lat: -91, lng: 0 }];

    for (const caso of casos) {
        const res = await crearAeropuerto({ ...AEROPUERTO_BASE, codigo: "ZZX", ...caso });
        assert.equal(res.status, 400, `${JSON.stringify(caso)} deberia rechazarse`);
    }
});

test("POST /api/aeropuertos rechaza HTML en los campos de texto", async () => {
    // El frontend renderiza estos valores, asi que aceptarlos seria un XSS
    // almacenado: se ejecutarian en el navegador de cualquier visitante.
    const cargas = [
        { nombre: "<img src=x onerror=alert(1)>" },
        { ciudad: "<script>alert(1)</script>" },
        { atractivo: "<iframe src=//evil.com></iframe>" }
    ];

    for (const carga of cargas) {
        const res = await crearAeropuerto({ ...AEROPUERTO_BASE, codigo: "ZZW", ...carga });
        assert.equal(res.status, 400, `${JSON.stringify(carga)} deberia rechazarse`);
    }
});

// ── validacion de aeronaves ────────────────────────────────────
async function crearAeronave(cuerpo) {
    return fetch(`${BASE}/api/aeronaves`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cuerpo)
    });
}

const AERONAVE_BASE = {
    nombre: "Aeronave de Prueba",
    capacidad: 180,
    costo_diario: 12000,
    autonomia_km: 5000,
    restricciones: "Solo rutas europeas"
};

test("POST /api/aeronaves acepta una aeronave valida", async () => {
    const res = await crearAeronave(AERONAVE_BASE);
    assert.equal(res.status, 201);
});

test("POST /api/aeronaves respeta la capacidad maxima", async () => {
    const res = await crearAeronave({ ...AERONAVE_BASE, capacidad: 9999 });
    assert.equal(res.status, 400);
});

test("POST /api/aeronaves rechaza numeros negativos o cero", async () => {
    const casos = [
        { capacidad: -500 },
        { capacidad: 0 },
        { costo_diario: -1 },
        { autonomia_km: -99 }
    ];

    for (const caso of casos) {
        const res = await crearAeronave({ ...AERONAVE_BASE, ...caso });
        assert.equal(res.status, 400, `${JSON.stringify(caso)} deberia rechazarse`);
    }
});
