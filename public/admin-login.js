document.getElementById("loginForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = document.getElementById("loginMessage");

    try {
        const response = await fetch("/api/admin/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                usuario: document.getElementById("adminUser").value.trim(),
                password: document.getElementById("adminPassword").value
            })
        });

        const result = await response.json();
        if (!response.ok) {
            message.textContent = result.error || "No se pudo iniciar sesion.";
            message.className = "form-message error";
            return;
        }

        sessionStorage.setItem("euroskyAdmin", "true");
        window.location.href = "admin.html";
    } catch (error) {
        console.error(error);
        message.textContent = "Error al iniciar sesion.";
        message.className = "form-message error";
    }
});
