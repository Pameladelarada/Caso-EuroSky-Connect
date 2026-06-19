if (sessionStorage.getItem("euroskyAdmin") !== "true") {
    window.location.href = "admin-login.html";
}

document.getElementById("logoutButton").addEventListener("click", () => {
    sessionStorage.removeItem("euroskyAdmin");
    window.location.href = "index.html";
});

document.getElementById("airportForm").addEventListener("submit", handleAirportSubmit);
document.getElementById("aircraftForm").addEventListener("submit", handleAircraftSubmit);

async function loadAdminSummary() {
    try {
        const response = await fetch("/api/resumen");
        const summary = await response.json();
        document.getElementById("adminAirports").textContent = summary.aeropuertos;
        document.getElementById("adminRoutes").textContent = summary.rutas;
        document.getElementById("adminAircraft").textContent = summary.aeronaves;
    } catch (error) {
        console.error(error);
    }
}

async function handleAirportSubmit(event) {
    event.preventDefault();

    const payload = {
        nombre: document.getElementById("airportName").value.trim(),
        codigo: document.getElementById("airportCode").value.trim(),
        pais: document.getElementById("airportCountry").value.trim(),
        ciudad: document.getElementById("airportCity").value.trim(),
        lat: Number(document.getElementById("airportLat").value),
        lng: Number(document.getElementById("airportLng").value),
        atractivo: document.getElementById("airportAttraction").value.trim()
    };

    const ok = await submitAdminRecord("/api/aeropuertos", payload, "airportMessage", "Aeropuerto registrado correctamente.");
    if (ok) {
        event.target.reset();
        await loadAdminSummary();
    }
}

async function handleAircraftSubmit(event) {
    event.preventDefault();

    const payload = {
        nombre: document.getElementById("aircraftName").value.trim(),
        capacidad: Number(document.getElementById("aircraftCapacity").value),
        costo_diario: Number(document.getElementById("aircraftCost").value),
        autonomia_km: Number(document.getElementById("aircraftRange").value),
        restricciones: document.getElementById("aircraftRestrictions").value.trim()
    };

    const ok = await submitAdminRecord("/api/aeronaves", payload, "aircraftMessage", "Aeronave registrada correctamente.");
    if (ok) {
        event.target.reset();
        await loadAdminSummary();
    }
}

async function submitAdminRecord(url, payload, messageId, successText) {
    const message = document.getElementById(messageId);

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        const result = await response.json();

        if (!response.ok) {
            message.textContent = result.error || "No se pudo guardar el registro.";
            message.className = "form-message error";
            return false;
        }

        message.textContent = successText;
        message.className = "form-message success";
        return true;
    } catch (error) {
        console.error(error);
        message.textContent = "Error al guardar el registro.";
        message.className = "form-message error";
        return false;
    }
}

loadAdminSummary();
