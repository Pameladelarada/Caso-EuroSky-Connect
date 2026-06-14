# Script de compilacion para EuroSky Connect (C++)
Write-Host "Compilando modulos C++..."
g++ -O2 -std=c++11 -o dijkstra.exe main.cpp Grafo.cpp Algoritmos.cpp CostoRentabilidad.cpp

if ($?) {
    Write-Host "Compilacion exitosa. Ejecutable: dijkstra.exe creado." -ForegroundColor Green
} else {
    Write-Host "Error en la compilacion." -ForegroundColor Red
}
