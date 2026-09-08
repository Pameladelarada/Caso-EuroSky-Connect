# Script de compilacion para EuroSky Connect (C++)
New-Item -ItemType Directory -Force -Path build | Out-Null
Write-Host "Compilando modulos C++..."
g++ -O2 -std=c++17 -Wall -Wextra -o build\eurosky.exe main.cpp Grafo.cpp Algoritmos.cpp CostoRentabilidad.cpp

if ($?) {
    Write-Host "Compilacion exitosa. Ejecutable: build\eurosky.exe creado." -ForegroundColor Green
} else {
    Write-Host "Error en la compilacion." -ForegroundColor Red
}
