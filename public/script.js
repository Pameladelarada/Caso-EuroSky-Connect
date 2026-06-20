let map;
let dataStore = null;
let airportMarkers = [];
let routeLine = null;
let currentRouteReport = null;

const formatUsd = new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
});

const formatPen = new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
    maximumFractionDigits: 0
});

const formatNumber = new Intl.NumberFormat("es-PE");

window.initMap = function () {
    const europeCenter = { lat: 48.7, lng: 9.2 };
    const mapNode = document.getElementById("map");
    if (!mapNode || !window.google) return;

    map = new google.maps.Map(mapNode, {
        zoom: 4,
        center: europeCenter,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true
    });

    renderAirportMarkers();
    setMessage("Google Maps activo para visualizar aeropuertos y rutas.");
};

async function loadInitialData() {
    try {
        const response = await fetch("/api/data");
        dataStore = await response.json();

        renderStats();
        populateAirportSelects();
        populateDestinationFilter();
        await renderItineraries();
        setDefaultDate();
        renderAirportMarkers();
    } catch (error) {
        console.error(error);
        setMessage("No se pudieron cargar los datos JSON del proyecto.");
    }
}

function setDefaultDate() {
    const input = document.getElementById("fechaVuelo");
    if (!input) return;
    const today = new Date().toISOString().slice(0, 10);
    input.min = today;
    input.value = today;
}

function renderStats() {
    if (!dataStore) return;
    document.getElementById("statAirports").textContent = dataStore.aeropuertos.length;
    document.getElementById("statRoutes").textContent = dataStore.rutas.length;
    document.getElementById("statJourney").textContent = dataStore.configuracion?.jornada_maxima_min || 480;
}

function populateAirportSelects() {
    const inicio = document.getElementById("inicio");
    const fin = document.getElementById("fin");
    if (!inicio || !fin || !dataStore) return;

    const options = dataStore.aeropuertos
        .map((airport) => `<option value="${airport.id}">${airport.ciudad} (${airport.codigo})</option>`)
        .join("");

    inicio.innerHTML = options;
    fin.innerHTML = options;
    inicio.value = dataStore.aeropuertos[0]?.id || "";
    fin.value = dataStore.aeropuertos[2]?.id || dataStore.aeropuertos[1]?.id || dataStore.aeropuertos[0]?.id || "";
}

function populateDestinationFilter() {
    const filtro = document.getElementById("destinoFiltro");
    if (!filtro || !dataStore) return;

    filtro.innerHTML = dataStore.aeropuertos
        .map((airport) => `<option value="${airport.id}">${airport.ciudad} (${airport.codigo})</option>`)
        .join("");

    filtro.onchange = () => renderDestinationDetail(Number(filtro.value));
    renderDestinationDetail(Number(filtro.value || dataStore.aeropuertos[0]?.id));
}

function renderDestinationDetail(airportId) {
    const airport = dataStore?.aeropuertos.find((item) => item.id === airportId);
    const container = document.getElementById("destinoDetalle");
    if (!container) return;

    if (!airport) {
        container.classList.add("empty-state");
        container.textContent = "No se encontro informacion para esta ciudad.";
        return;
    }

    container.classList.remove("empty-state");
    container.innerHTML = `
        <article class="destination-card featured">
            <div class="card-meta">
                <span>${airport.codigo}</span>
                <span>${airport.pais}</span>
            </div>
            <h3>${airport.ciudad}</h3>
            <p><strong>Aeropuerto:</strong> ${airport.nombre}</p>
            <p>${airport.atractivo || "Destino europeo registrado para operaciones y turismo."}</p>
        </article>
    `;
}

function renderAirportMarkers() {
    if (!map || !window.google || !dataStore) return;

    airportMarkers.forEach((marker) => marker.setMap(null));
    airportMarkers = [];

    const bounds = new google.maps.LatLngBounds();

    dataStore.aeropuertos.forEach((airport) => {
        const marker = new google.maps.Marker({
            position: { lat: airport.lat, lng: airport.lng },
            map,
            title: `${airport.ciudad} (${airport.codigo})`
        });

        const info = new google.maps.InfoWindow({
            content: `
                <strong>${airport.ciudad} (${airport.codigo})</strong>
                <p>${airport.atractivo || "Aeropuerto europeo registrado."}</p>
            `
        });

        marker.addListener("click", () => info.open(map, marker));
        airportMarkers.push(marker);
        bounds.extend(marker.getPosition());
    });

    if (airportMarkers.length) map.fitBounds(bounds);
}

async function renderItineraries() {
    const grid = document.getElementById("itinerariosGrid");
    if (!grid) return;

    try {
        const response = await fetch("/api/rutas-sugeridas");
        const itineraries = await response.json();

        grid.innerHTML = itineraries
            .map((itinerary) => {
                const cities = itinerary.resumen.secuencia.map((airport) => airport.ciudad).join(" -> ");
                return `
                    <article class="itinerary-card">
                        <div class="card-meta">
                            <span>${itinerary.dias} dias</span>
                            <span>${itinerary.fuente}</span>
                        </div>
                        <h3>${itinerary.nombre}</h3>
                        <p>${itinerary.descripcion}</p>
                        <p><strong>Secuencia:</strong> ${cities}</p>
                        <p><strong>Escalas:</strong> ${itinerary.resumen.cantidad_escalas}</p>
                    </article>
                `;
            })
            .join("");
    } catch (error) {
        console.error(error);
        grid.innerHTML = `<p class="empty-state">No se pudieron cargar los itinerarios.</p>`;
    }
}

async function calculateRoute() {
    const inicio = document.getElementById("inicio").value;
    const fin = document.getElementById("fin").value;
    const algoritmo = document.getElementById("algoritmo").value;
    const fecha = document.getElementById("fechaVuelo").value;
    const resultBox = document.getElementById("resultadoRuta");

    resultBox.textContent = "Calculando ruta...";

    try {
        const response = await fetch(`/ruta?inicio=${inicio}&fin=${fin}&algoritmo=${algoritmo}&fecha=${fecha}`);
        const result = await response.json();

        if (!response.ok) {
            resultBox.textContent = result.error || "No se pudo calcular la ruta.";
            return;
        }

        currentRouteReport = buildRouteReport(result);

        drawRoute(result.secuencia);
        renderRouteResult(result);
        renderReport(currentRouteReport);
        renderDestinationDetail(Number(fin));
        await renderBestRoutes(inicio, fin, fecha, algoritmo);
    } catch (error) {
        console.error(error);
        resultBox.textContent = "Error al buscar la ruta.";
    }
}

function renderRouteResult(result) {
    const resultBox = document.getElementById("resultadoRuta");
    const path = result.secuencia.map((airport) => `<span>${airport.ciudad}</span>`).join("");
    const stops = result.escalas.length
        ? result.escalas.map((stop) => `${stop.ciudad}, ${stop.pais}`).join(" | ")
        : "Vuelo directo";

    resultBox.classList.remove("empty-state");
    resultBox.innerHTML = `
        <p class="tag">${result.algoritmo}</p>
        <div class="result-path">${path}</div>

        <div class="metric-grid">
            <div class="metric"><span>Fecha de vuelo</span><strong>${result.fecha_vuelo || "No indicada"}</strong></div>
            <div class="metric"><span>Llegada estimada</span><strong>${result.fecha_llegada_estimada || "No indicada"}</strong></div>
            <div class="metric"><span>Distancia</span><strong>${formatNumber.format(result.distancia)} km</strong></div>
            <div class="metric"><span>Tiempo total</span><strong>${minutesToText(result.tiempo_total_min)}</strong></div>
            <div class="metric"><span>Escalas</span><strong>${result.cantidad_escalas}</strong></div>
            <div class="metric"><span>Jornada 8h</span><strong>${result.dentro_jornada ? "Factible" : "Excede"}</strong></div>
            <div class="metric"><span>Costo USD</span><strong>${formatUsd.format(result.costo_total)}</strong></div>
            <div class="metric"><span>Costo soles</span><strong>${formatPen.format(result.costo_total_pen)}</strong></div>
            <div class="metric"><span>Beneficio USD</span><strong>${formatUsd.format(result.beneficio_neto)}</strong></div>
            <div class="metric"><span>Beneficio soles</span><strong>${formatPen.format(result.beneficio_neto_pen)}</strong></div>
        </div>

        <p><strong>Escalas:</strong> ${stops}</p>
    `;
}

function buildRouteReport(result) {
    const sequence = result.secuencia.map((airport, index) => ({
        orden: index + 1,
        codigo: airport.codigo,
        aeropuerto: airport.nombre,
        ciudad: airport.ciudad,
        pais: airport.pais,
        lat: airport.lat,
        lng: airport.lng
    }));

    const segments = result.segmentos.map((segment, index) => {
        const origin = result.secuencia[index];
        const destination = result.secuencia[index + 1];

        return {
            tramo: index + 1,
            origen: origin ? `${origin.ciudad} (${origin.codigo})` : segment.origen,
            destino: destination ? `${destination.ciudad} (${destination.codigo})` : segment.destino,
            distancia_km: segment.distancia,
            tiempo_vuelo_min: segment.tiempo_vuelo_min,
            tiempo_escala_min: segment.tiempo_escala_min,
            costo_operativo_usd: segment.costo_operativo,
            tasa_aeroportuaria_usd: segment.tasa_aeroportuaria,
            ingreso_proyectado_usd: segment.ingreso_proyectado,
            fuente: segment.fuente || "JSON"
        };
    });

    return {
        generado_en: new Date().toISOString(),
        algoritmo: result.algoritmo,
        fecha_vuelo: result.fecha_vuelo || "No indicada",
        fecha_llegada_estimada: result.fecha_llegada_estimada || "No indicada",
        origen: sequence[0],
        destino: sequence[sequence.length - 1],
        secuencia_aeropuertos: sequence,
        tramos: segments,
        escalas: result.escalas,
        resumen: {
            distancia_total_km: result.distancia,
            tiempo_vuelo_min: result.tiempo_vuelo_min,
            tiempo_escala_min: result.tiempo_escala_min,
            tiempo_total_min: result.tiempo_total_min,
            cantidad_escalas: result.cantidad_escalas,
            dentro_jornada: result.dentro_jornada,
            costo_total_usd: result.costo_total,
            costo_total_pen: result.costo_total_pen,
            ingreso_esperado_usd: result.ingreso_total,
            ingreso_esperado_pen: result.ingreso_total_pen,
            beneficio_neto_usd: result.beneficio_neto,
            beneficio_neto_pen: result.beneficio_neto_pen
        }
    };
}

function renderReport(report) {
    const section = document.getElementById("reporte");
    const container = document.getElementById("reportContent");
    const buttons = document.querySelectorAll("[data-export]");

    if (!section || !container) return;

    const sequenceText = report.secuencia_aeropuertos
        .map((airport) => `${airport.ciudad} (${airport.codigo})`)
        .join(" -> ");

    const stopText = report.escalas.length
        ? report.escalas.map((stop) => `${stop.ciudad}, ${stop.pais} (${stop.codigo})`).join(" | ")
        : "Vuelo directo";

    section.classList.remove("hidden");
    container.classList.remove("empty-state");

    container.innerHTML = `
        <div class="report-summary">
            <div>
                <span>Recorrido seleccionado</span>
                <strong>${report.origen?.ciudad || "-"} a ${report.destino?.ciudad || "-"}</strong>
            </div>
            <div>
                <span>Algoritmo</span>
                <strong>${report.algoritmo}</strong>
            </div>
            <div>
                <span>Fecha</span>
                <strong>${report.fecha_vuelo}</strong>
            </div>
        </div>

        <div class="report-kpis">
            <div>
                <span>Costo total</span>
                <strong>${formatUsd.format(report.resumen.costo_total_usd)}</strong>
                <small>${formatPen.format(report.resumen.costo_total_pen)}</small>
            </div>
            <div>
                <span>Ingreso esperado</span>
                <strong>${formatUsd.format(report.resumen.ingreso_esperado_usd)}</strong>
                <small>${formatPen.format(report.resumen.ingreso_esperado_pen)}</small>
            </div>
            <div>
                <span>Beneficio neto</span>
                <strong>${formatUsd.format(report.resumen.beneficio_neto_usd)}</strong>
                <small>${formatPen.format(report.resumen.beneficio_neto_pen)}</small>
            </div>
            <div>
                <span>Tiempo total</span>
                <strong>${minutesToText(report.resumen.tiempo_total_min)}</strong>
                <small>${report.resumen.dentro_jornada ? "Dentro de jornada" : "Excede jornada"}</small>
            </div>
        </div>

        <div class="report-block">
            <h3>Secuencia de aeropuertos visitados</h3>
            <p>${sequenceText}</p>
        </div>

        <div class="report-block">
            <h3>Escalas</h3>
            <p>${stopText}</p>
        </div>
    `;

    buttons.forEach((button) => {
        button.disabled = false;
    });
}

function exportCurrentReport(format) {
    if (!currentRouteReport) return;

    const normalized = String(format || "txt").toLowerCase();
    const fileBase = `reporte_eurosky_${currentRouteReport.origen.codigo}_${currentRouteReport.destino.codigo}_${normalizedDate()}`;

    if (normalized === "json") {
        downloadFile(`${fileBase}.json`, JSON.stringify(currentRouteReport, null, 2), "application/json;charset=utf-8");
        return;
    }

    if (normalized === "csv") {
        downloadFile(`${fileBase}.csv`, buildCsvReport(currentRouteReport), "text/csv;charset=utf-8");
        return;
    }

    downloadFile(`${fileBase}.txt`, buildTextReport(currentRouteReport), "text/plain;charset=utf-8");
}

function buildCsvReport(report) {
    const rows = [
        ["Campo", "Valor"],
        ["Algoritmo", report.algoritmo],
        ["Origen", `${report.origen.ciudad} (${report.origen.codigo})`],
        ["Destino", `${report.destino.ciudad} (${report.destino.codigo})`],
        ["Fecha de vuelo", report.fecha_vuelo],
        ["Llegada estimada", report.fecha_llegada_estimada],
        ["Costo total USD", report.resumen.costo_total_usd],
        ["Ingreso esperado USD", report.resumen.ingreso_esperado_usd],
        ["Beneficio neto USD", report.resumen.beneficio_neto_usd],
        ["Distancia total km", report.resumen.distancia_total_km],
        ["Tiempo total min", report.resumen.tiempo_total_min],
        ["Escalas", report.resumen.cantidad_escalas],
        ["Secuencia", report.secuencia_aeropuertos.map((airport) => `${airport.ciudad} (${airport.codigo})`).join(" -> ")]
    ];

    rows.push([]);
    rows.push(["Tramo", "Origen", "Destino", "Distancia km", "Tiempo vuelo min", "Tiempo escala min", "Costo operativo USD", "Tasa USD", "Ingreso proyectado USD", "Fuente"]);

    report.tramos.forEach((segment) => {
        rows.push([
            segment.tramo,
            segment.origen,
            segment.destino,
            segment.distancia_km,
            segment.tiempo_vuelo_min,
            segment.tiempo_escala_min,
            segment.costo_operativo_usd,
            segment.tasa_aeroportuaria_usd,
            segment.ingreso_proyectado_usd,
            segment.fuente
        ]);
    });

    return rows.map((row) => row.map(csvValue).join(",")).join("\n");
}

function buildTextReport(report) {
    const sequence = report.secuencia_aeropuertos
        .map((airport) => `${airport.orden}. ${airport.ciudad} (${airport.codigo}) - ${airport.aeropuerto}, ${airport.pais}`)
        .join("\n");

    const segments = report.tramos
        .map((segment) => `${segment.tramo}. ${segment.origen} -> ${segment.destino} | ${segment.distancia_km} km | ${segment.tiempo_vuelo_min} min | ingreso ${formatUsd.format(segment.ingreso_proyectado_usd)}`)
        .join("\n");

    return [
        "REPORTE DE RESULTADOS - EUROSKY CONNECT",
        `Generado en: ${report.generado_en}`,
        "",
        "1. Datos generales",
        `Algoritmo: ${report.algoritmo}`,
        `Origen: ${report.origen.ciudad} (${report.origen.codigo})`,
        `Destino: ${report.destino.ciudad} (${report.destino.codigo})`,
        `Fecha de vuelo: ${report.fecha_vuelo}`,
        `Llegada estimada: ${report.fecha_llegada_estimada}`,
        "",
        "2. Indicadores economicos",
        `Costo total: ${formatUsd.format(report.resumen.costo_total_usd)} / ${formatPen.format(report.resumen.costo_total_pen)}`,
        `Ingreso esperado: ${formatUsd.format(report.resumen.ingreso_esperado_usd)} / ${formatPen.format(report.resumen.ingreso_esperado_pen)}`,
        `Beneficio neto: ${formatUsd.format(report.resumen.beneficio_neto_usd)} / ${formatPen.format(report.resumen.beneficio_neto_pen)}`,
        "",
        "3. Indicadores operativos",
        `Distancia total: ${formatNumber.format(report.resumen.distancia_total_km)} km`,
        `Tiempo total: ${minutesToText(report.resumen.tiempo_total_min)}`,
        `Escalas: ${report.resumen.cantidad_escalas}`,
        `Cumple jornada: ${report.resumen.dentro_jornada ? "Si" : "No"}`,
        "",
        "4. Secuencia de aeropuertos visitados",
        sequence,
        "",
        "5. Tramos evaluados",
        segments
    ].join("\n");
}

function csvValue(value) {
    const text = String(value ?? "");
    return `"${text.replace(/"/g, '""')}"`;
}

function normalizedDate() {
    return new Date().toISOString().slice(0, 10);
}

function downloadFile(filename, content, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
}

async function renderBestRoutes(inicio, fin, fecha, algoritmo) {
    const section = document.getElementById("ranking");
    const container = document.getElementById("rankingGrid");
    if (!section || !container) return;

    section.classList.remove("hidden");
    container.classList.add("empty-state");
    container.textContent = "Calculando ranking de las tres mejores rutas para la busqueda...";

    try {
        const params = new URLSearchParams({ inicio, fin, fecha, algoritmo });
        const response = await fetch(`/api/mejores-rutas?${params.toString()}`);
        const groups = await response.json();

        if (!response.ok) {
            container.textContent = groups.error || "No se pudo calcular el ranking.";
            return;
        }

        container.classList.remove("empty-state");
        container.innerHTML = groups.map(renderAlgorithmRanking).join("");
    } catch (error) {
        console.error(error);
        container.textContent = "Error al calcular el ranking.";
    }
}

function renderAlgorithmRanking(group) {
    const cards = group.rutas.length
        ? group.rutas.map((route, index) => renderRankingCard(route, index + 1)).join("")
        : `<p class="empty-state">No hay rutas factibles dentro de la jornada para este algoritmo.</p>`;

    return `
        <article class="ranking-column">
            <h3>${group.nombre}</h3>
            ${cards}
        </article>
    `;
}

function renderRankingCard(route, position) {
    const path = route.secuencia.map((airport) => airport.codigo).join(" -> ");
    const origin = route.secuencia[0]?.ciudad || "-";
    const destination = route.secuencia[route.secuencia.length - 1]?.ciudad || "-";

    return `
        <div class="ranking-card">
            <div class="ranking-position">#${position}</div>
            <div>
                <strong>${origin} a ${destination}</strong>
                <span>${path}</span>
                <small>${route.cantidad_escalas} escalas | ${minutesToText(route.tiempo_total_min)} | ${formatUsd.format(route.costo_total)} | Beneficio ${formatUsd.format(route.beneficio_neto)}</small>
            </div>
        </div>
    `;
}

function drawRoute(sequence) {
    if (!map || !window.google) {
        setMessage("Ruta calculada. Agrega GOOGLE_MAPS_API_KEY en .env para verla dibujada en el mapa.");
        return;
    }

    if (routeLine) routeLine.setMap(null);

    const path = sequence.map((airport) => ({ lat: airport.lat, lng: airport.lng }));

    routeLine = new google.maps.Polyline({
        path,
        geodesic: true,
        strokeColor: "#f59e0b",
        strokeOpacity: 0.95,
        strokeWeight: 4,
        map
    });

    const bounds = new google.maps.LatLngBounds();
    path.forEach((point) => bounds.extend(point));
    map.fitBounds(bounds);
}

function minutesToText(minutes) {
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    if (!hours) return `${rest} min`;
    return `${hours} h ${rest} min`;
}

function setMessage(text) {
    const message = document.getElementById("mensaje");
    if (message) message.textContent = text;
}

async function loadGoogleMapsScript() {
    try {
        const response = await fetch("/api/config");
        const config = await response.json();

        if (!config.googleMapsApiKey) {
            setMessage("No se encontro GOOGLE_MAPS_API_KEY en .env. Los datos y rutas siguen disponibles; el mapa requiere esa clave local.");
            return;
        }

        const script = document.createElement("script");
        script.src = `https://maps.googleapis.com/maps/api/js?key=${config.googleMapsApiKey}&callback=initMap&libraries=places`;
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
    } catch (error) {
        console.error(error);
        setMessage("No se pudo cargar la configuracion de Google Maps.");
    }
}

document.getElementById("routeForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    await calculateRoute();
});

loadInitialData();
loadGoogleMapsScript();

document.querySelectorAll("[data-export]").forEach((button) => {
    button.addEventListener("click", () => exportCurrentReport(button.dataset.export));
});