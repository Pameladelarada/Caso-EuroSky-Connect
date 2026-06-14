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
<<<<<<< HEAD
    const algoritmo = document.getElementById("algoritmo").value;
=======
<<<<<<< HEAD
    const algoritmo = document.getElementById("algoritmo").value;
=======
>>>>>>> 602cb03e1bf870feaaf09c7f68190256fa41a1ea
>>>>>>> 43ff26426b7ef062d05a8a6588ebaf044254575c
    const resultBox = document.getElementById("resultadoRuta");

    resultBox.textContent = "Calculando ruta optima...";

    try {
<<<<<<< HEAD
        const response = await fetch(`/ruta?inicio=${inicio}&fin=${fin}&algoritmo=${algoritmo}`);
=======
<<<<<<< HEAD
        const response = await fetch(`/ruta?inicio=${inicio}&fin=${fin}&algoritmo=${algoritmo}`);
=======
        const response = await fetch(`/ruta?inicio=${inicio}&fin=${fin}`);
>>>>>>> 602cb03e1bf870feaaf09c7f68190256fa41a1ea
>>>>>>> 43ff26426b7ef062d05a8a6588ebaf044254575c
        const result = await response.json();

        if (!response.ok) {
            resultBox.textContent = result.error || "No se pudo calcular la ruta.";
            return;
        }

        drawRoute(result.secuencia);
        renderRouteResult(result);
<<<<<<< HEAD
        await renderAlgorithmComparison(inicio, fin);
=======
<<<<<<< HEAD
        await renderAlgorithmComparison(inicio, fin);
=======
>>>>>>> 602cb03e1bf870feaaf09c7f68190256fa41a1ea
>>>>>>> 43ff26426b7ef062d05a8a6588ebaf044254575c
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
<<<<<<< HEAD
        <p class="tag">${result.algoritmo}</p>
=======
<<<<<<< HEAD
        <p class="tag">${result.algoritmo}</p>
=======
>>>>>>> 602cb03e1bf870feaaf09c7f68190256fa41a1ea
>>>>>>> 43ff26426b7ef062d05a8a6588ebaf044254575c
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

<<<<<<< HEAD
=======
<<<<<<< HEAD
>>>>>>> 43ff26426b7ef062d05a8a6588ebaf044254575c
async function renderAlgorithmComparison(inicio, fin) {
    const container = document.getElementById("comparacionAlgoritmos");
    const response = await fetch(`/api/comparar?inicio=${inicio}&fin=${fin}`);
    const algorithms = await response.json();

    if (!response.ok) {
        container.innerHTML = "";
        return;
    }

    container.innerHTML = `
        <h3>Comparacion de algoritmos</h3>
        ${algorithms.map((item) => renderAlgorithmCard(item)).join("")}
    `;
}

function renderAlgorithmCard(item) {
    if (!item.resultado) {
        return `
            <article class="algorithm-card">
                <strong>${item.algoritmo}</strong>
                <span>Sin ruta conectada</span>
            </article>
        `;
    }

    const path = item.resultado.secuencia.map((airport) => airport.codigo).join(" -> ");
    return `
        <article class="algorithm-card">
            <strong>${item.algoritmo}</strong>
            <span>${path}</span>
            <small>${item.resultado.cantidad_escalas} escalas | ${minutesToText(item.resultado.tiempo_total_min)} | ${formatCurrency.format(item.resultado.beneficio_neto)}</small>
        </article>
    `;
}

<<<<<<< HEAD
=======
=======
>>>>>>> 602cb03e1bf870feaaf09c7f68190256fa41a1ea
>>>>>>> 43ff26426b7ef062d05a8a6588ebaf044254575c
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
<<<<<<< HEAD

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
=======
>>>>>>> 43ff26426b7ef062d05a8a6588ebaf044254575c
