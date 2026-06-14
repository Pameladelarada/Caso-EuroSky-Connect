let map;
let dataStore = null;
let airportMarkers = [];
let routeLine = null;

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

window.initMap = async function () {
    const europeCenter = { lat: 48.7, lng: 9.2 };

    map = new google.maps.Map(document.getElementById("map"), {
        zoom: 4,
        center: europeCenter,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true
    });

    await loadInitialData();
};

async function loadInitialData() {
    const response = await fetch("/api/data");
    dataStore = await response.json();

    renderStats();
    populateAirportSelects();
    populateDestinationFilter();
    renderAirportMarkers();
    renderItineraries();
    setDefaultDate();
    setMessage("Google Maps activo para visualizar aeropuertos y rutas.");
}

function setDefaultDate() {
    const input = document.getElementById("fechaVuelo");
    const today = new Date().toISOString().slice(0, 10);
    input.min = today;
    input.value = today;
}

function renderStats() {
    document.getElementById("statAirports").textContent = dataStore.aeropuertos.length;
    document.getElementById("statRoutes").textContent = dataStore.rutas.length;
}

function populateAirportSelects() {
    const inicio = document.getElementById("inicio");
    const fin = document.getElementById("fin");
    const options = dataStore.aeropuertos
        .map((airport) => `<option value="${airport.id}">${airport.ciudad} (${airport.codigo})</option>`)
        .join("");

    inicio.innerHTML = options;
    fin.innerHTML = options;
    fin.value = dataStore.aeropuertos[2]?.id || dataStore.aeropuertos[0]?.id;
}

function populateDestinationFilter() {
    const filtro = document.getElementById("destinoFiltro");
    filtro.innerHTML = dataStore.aeropuertos
        .map((airport) => `<option value="${airport.id}">${airport.ciudad} (${airport.codigo})</option>`)
        .join("");

    filtro.addEventListener("change", () => renderDestinationDetail(Number(filtro.value)));
    renderDestinationDetail(Number(filtro.value));
}

function renderDestinationDetail(airportId) {
    const airport = dataStore.aeropuertos.find((item) => item.id === airportId);
    const container = document.getElementById("destinoDetalle");

    if (!airport) {
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
            <p>${airport.atractivo}</p>
        </article>
    `;
}

function renderAirportMarkers() {
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
                <p>${airport.atractivo}</p>
            `
        });

        marker.addListener("click", () => info.open(map, marker));
        airportMarkers.push(marker);
        bounds.extend(marker.getPosition());
    });

    map.fitBounds(bounds);
}

async function renderItineraries() {
    const response = await fetch("/api/rutas-sugeridas");
    const itineraries = await response.json();
    const grid = document.getElementById("itinerariosGrid");

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
}

document.getElementById("routeForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    await calculateRoute();
});

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

        drawRoute(result.secuencia);
        renderRouteResult(result);
        renderDestinationDetail(Number(fin));
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

function drawRoute(sequence) {
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
    document.getElementById("mensaje").textContent = text;
}

async function loadGoogleMapsScript() {
    try {
        const response = await fetch("/api/config");
        const config = await response.json();

        if (!config.googleMapsApiKey) {
            setMessage("No se encontro GOOGLE_MAPS_API_KEY en el archivo .env.");
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

loadGoogleMapsScript();