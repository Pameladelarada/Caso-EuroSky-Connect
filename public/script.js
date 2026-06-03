let map;
let dataStore = null;
let selectedLat = null;
let selectedLng = null;
let tempMarker = null;
let airportMarkers = [];
let savedMarkers = [];
let routeLine = null;
let distanceMatrixService = null;

const formatCurrency = new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "USD",
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

    distanceMatrixService = new google.maps.DistanceMatrixService();

    map.addListener("click", (event) => {
        selectedLat = event.latLng.lat();
        selectedLng = event.latLng.lng();

        if (tempMarker) tempMarker.setMap(null);
        tempMarker = new google.maps.Marker({
            position: { lat: selectedLat, lng: selectedLng },
            map,
            title: "Punto operativo seleccionado"
        });

        setMessage("Ubicacion seleccionada. Completa el formulario para guardarla en data.json.");
    });

    await loadInitialData();
};

async function loadInitialData() {
    const response = await fetch("/api/data");
    dataStore = await response.json();

    renderStats();
    populateAirportSelects();
    renderAirportCards();
    renderAirportMarkers();
    renderItineraries();
    await loadSavedFlights();
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

function renderAirportCards() {
    const grid = document.getElementById("destinosGrid");
    grid.innerHTML = dataStore.aeropuertos
        .map((airport) => `
            <article class="destination-card">
                <div class="card-meta">
                    <span>${airport.codigo}</span>
                    <span>${airport.pais}</span>
                </div>
                <h3>${airport.ciudad}</h3>
                <p>${airport.atractivo}</p>
            </article>
        `)
        .join("");
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
    const resultBox = document.getElementById("resultadoRuta");

    resultBox.textContent = "Calculando ruta optima...";

    try {
        const response = await fetch(`/ruta?inicio=${inicio}&fin=${fin}`);
        const result = await response.json();

        if (!response.ok) {
            resultBox.textContent = result.error || "No se pudo calcular la ruta.";
            return;
        }

        drawRoute(result.secuencia);
        renderRouteResult(result);
        requestGoogleDistanceReference(result.secuencia);
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
        <div class="result-path">${path}</div>
        <div class="metric-grid">
            <div class="metric"><span>Distancia</span><strong>${formatNumber.format(result.distancia)} km</strong></div>
            <div class="metric"><span>Tiempo total</span><strong>${minutesToText(result.tiempo_total_min)}</strong></div>
            <div class="metric"><span>Escalas</span><strong>${result.cantidad_escalas}</strong></div>
            <div class="metric"><span>Beneficio neto</span><strong>${formatCurrency.format(result.beneficio_neto)}</strong></div>
            <div class="metric"><span>Costo total</span><strong>${formatCurrency.format(result.costo_total)}</strong></div>
            <div class="metric"><span>Jornada 8h</span><strong>${result.dentro_jornada ? "Factible" : "Excede"}</strong></div>
        </div>
        <p><strong>Escalas:</strong> ${stops}</p>
        <p id="googleReference" class="empty-state">Consultando referencia de tiempo/distancia con Google Distance Matrix...</p>
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

function requestGoogleDistanceReference(sequence) {
    const reference = document.getElementById("googleReference");
    if (!distanceMatrixService || sequence.length < 2 || !reference) return;

    const origin = sequence[0];
    const destination = sequence[sequence.length - 1];

    distanceMatrixService.getDistanceMatrix(
        {
            origins: [{ lat: origin.lat, lng: origin.lng }],
            destinations: [{ lat: destination.lat, lng: destination.lng }],
            travelMode: google.maps.TravelMode.DRIVING,
            unitSystem: google.maps.UnitSystem.METRIC
        },
        (response, status) => {
            if (status !== "OK") {
                reference.textContent = "Google Distance Matrix no devolvio referencia para este par de ciudades.";
                return;
            }

            const element = response.rows?.[0]?.elements?.[0];
            if (!element || element.status !== "OK") {
                reference.textContent = "Google Distance Matrix no encontro una referencia terrestre comparable.";
                return;
            }

            reference.textContent = `Referencia Google terrestre: ${element.distance.text}, ${element.duration.text}. El calculo principal mantiene datos aereos del JSON.`;
        }
    );
}

document.getElementById("form").addEventListener("submit", async (event) => {
    event.preventDefault();

    if (selectedLat === null || selectedLng === null) {
        setMessage("Selecciona primero una ubicacion en el mapa.");
        return;
    }

    const payload = {
        nombre: document.getElementById("nombre").value.trim(),
        descripcion: document.getElementById("descripcion").value.trim(),
        prioridad: document.getElementById("prioridad").value,
        lat: selectedLat,
        lng: selectedLng
    };

    try {
        const response = await fetch("/vuelos", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error("No se pudo guardar el punto.");

        document.getElementById("form").reset();
        selectedLat = null;
        selectedLng = null;
        if (tempMarker) tempMarker.setMap(null);
        setMessage("Punto operativo guardado en data.json.");
        await loadSavedFlights();
    } catch (error) {
        console.error(error);
        setMessage("Error al guardar el punto operativo.");
    }
});

async function loadSavedFlights() {
    const response = await fetch("/vuelos");
    const flights = await response.json();
    const list = document.getElementById("lista");

    savedMarkers.forEach((marker) => marker.setMap(null));
    savedMarkers = [];

    if (!flights.length) {
        list.innerHTML = `<li><p>No hay puntos guardados todavia.</p></li>`;
        return;
    }

    list.innerHTML = flights
        .map((flight) => `
            <li>
                <div>
                    <strong>${flight.nombre}</strong>
                    <p>${flight.prioridad} - ${flight.descripcion}</p>
                </div>
                <button class="btn-eliminar" onclick="deleteFlight(${flight.id})" aria-label="Eliminar ${flight.nombre}">X</button>
            </li>
        `)
        .join("");

    flights.forEach((flight) => {
        const marker = new google.maps.Marker({
            position: { lat: flight.lat, lng: flight.lng },
            map,
            title: flight.nombre,
            icon: "http://maps.google.com/mapfiles/ms/icons/green-dot.png"
        });

        const info = new google.maps.InfoWindow({
            content: `<strong>${flight.nombre}</strong><p>${flight.descripcion}</p><p>Prioridad: ${flight.prioridad}</p>`
        });

        marker.addListener("click", () => info.open(map, marker));
        savedMarkers.push(marker);
    });
}

async function deleteFlight(id) {
    await fetch(`/vuelos/${id}`, { method: "DELETE" });
    await loadSavedFlights();
    setMessage("Punto operativo eliminado de data.json.");
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
