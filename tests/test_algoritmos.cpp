// tests/test_algoritmos.cpp
//
// Suite de pruebas del motor C++ de EuroSky Connect.
// Sin dependencias externas: solo la biblioteca estandar.
//
//   make test
//
// O a mano:
//   g++ -std=c++17 -I. -o build/tests tests/test_algoritmos.cpp \
//       Grafo.cpp Algoritmos.cpp CostoRentabilidad.cpp && ./build/tests

#include <cmath>
#include <iostream>
#include <stdexcept>
#include <string>
#include <unordered_map>
#include <vector>

#include "Grafo.h"
#include "RutaUtils.h"
#include "Algoritmos.h"
#include "greedy.h"
#include "montecarlo.h"
#include "bellmanford.h"
#include "CostoRentabilidad.h"

static int ejecutadas = 0;
static int fallidas = 0;

#define CHECK(cond, mensaje)                                            \
    do {                                                                \
        ejecutadas++;                                                   \
        if (!(cond)) {                                                  \
            fallidas++;                                                 \
            std::cout << "  [FALLO] " << mensaje << "\n"                \
                      << "          " << __FILE__ << ":" << __LINE__    \
                      << "\n";                                          \
        } else {                                                        \
            std::cout << "  [ok]    " << mensaje << "\n";               \
        }                                                               \
    } while (0)

static bool casiIgual(double a, double b, double tol = 1e-6) {
    return std::fabs(a - b) < tol;
}

// ---------------------------------------------------------------------------
// Grafo de prueba
//
//   1 --(10)--> 2 --(10)--> 4
//   |                       ^
//  (1)                     (1)
//   v                       |
//   3 ----------------------+
//
// Ruta mas barata 1 -> 4 : 1 -> 3 -> 4  (costo 2)
// Ruta cara alternativa  : 1 -> 2 -> 4  (costo 20)
// El nodo 4 no tiene aristas salientes: nada es alcanzable desde el.
// ---------------------------------------------------------------------------
static std::unordered_map<int, std::vector<Edge>> grafoDePrueba() {
    return {
        {1, {{2, 10.0}, {3, 1.0}}},
        {2, {{4, 10.0}}},
        {3, {{4, 1.0}}},
        {4, {}}
    };
}

// ---------------------------------------------------------------------------
static void pruebasCosto() {
    std::cout << "\nCosto y rentabilidad\n";

    CHECK(casiIgual(calcularCostoTotal(4800, 1350), 6150.0),
          "calcularCostoTotal suma costo operativo y tasa aeroportuaria");
    CHECK(casiIgual(calcularBeneficioNeto(31030, 6150), 24880.0),
          "calcularBeneficioNeto resta el costo total del ingreso");
    CHECK(calcularBeneficioNeto(1000, 5000) < 0,
          "calcularBeneficioNeto es negativo en una ruta no rentable");
}

// ---------------------------------------------------------------------------
static void pruebasReconstruccion() {
    std::cout << "\nreconstruirRuta\n";

    std::unordered_map<int, int> anterior = {{2, 1}, {3, 2}, {4, 3}};
    std::vector<int> esperada = {1, 2, 3, 4};

    CHECK(reconstruirRuta(anterior, 1, 4) == esperada,
          "reconstruye la cadena completa desde el mapa de predecesores");
    CHECK(reconstruirRuta(anterior, 1, 99).empty(),
          "devuelve vacio si el destino no tiene predecesor");

    auto unico = reconstruirRuta(anterior, 7, 7);
    CHECK(unico.size() == 1 && unico[0] == 7,
          "origen igual a destino devuelve un solo nodo");
}

// ---------------------------------------------------------------------------
static void pruebasDijkstra() {
    std::cout << "\nDijkstra\n";
    auto grafo = grafoDePrueba();

    auto resultado = dijkstra(grafo, 1, 4);
    std::vector<int> esperada = {1, 3, 4};

    CHECK(resultado.first == esperada,
          "elige la ruta barata 1->3->4 y no la directa cara 1->2->4");
    CHECK(casiIgual(resultado.second, 2.0),
          "el costo acumulado de 1->3->4 es 2.0");

    auto mismo = dijkstra(grafo, 1, 1);
    CHECK(mismo.first.size() == 1 && mismo.first[0] == 1,
          "origen igual a destino devuelve una ruta de un solo nodo");

    auto inalcanzable = dijkstra(grafo, 4, 1);
    CHECK(inalcanzable.first.empty(),
          "destino inalcanzable devuelve ruta vacia");
    CHECK(inalcanzable.second >= 1e9,
          "destino inalcanzable devuelve el centinela 1e9 como costo");
}

// ---------------------------------------------------------------------------
static void pruebasBfsDfs() {
    std::cout << "\nBFS y DFS\n";
    auto grafo = grafoDePrueba();

    auto rutaBfs = bfs(grafo, 1, 4);
    CHECK(rutaBfs.size() == 3,
          "BFS encuentra una ruta de 2 saltos (3 nodos) entre 1 y 4");
    CHECK(!rutaBfs.empty() && rutaBfs.front() == 1 && rutaBfs.back() == 4,
          "la ruta de BFS empieza en el origen y termina en el destino");

    auto rutaDfs = dfs(grafo, 1, 4);
    CHECK(!rutaDfs.empty() && rutaDfs.front() == 1 && rutaDfs.back() == 4,
          "DFS encuentra alguna ruta conectada entre 1 y 4");

    CHECK(bfs(grafo, 4, 1).empty(), "BFS devuelve vacio cuando no hay ruta");
    CHECK(dfs(grafo, 4, 1).empty(), "DFS devuelve vacio cuando no hay ruta");
}

// ---------------------------------------------------------------------------
static void pruebasGreedy() {
    std::cout << "\nGreedy\n";
    auto grafo = grafoDePrueba();

    auto resultado = greedy(grafo, 1, 4);
    CHECK(!resultado.first.empty(), "greedy encuentra una ruta entre 1 y 4");
    CHECK(resultado.first.front() == 1 && resultado.first.back() == 4,
          "la ruta de greedy empieza en el origen y termina en el destino");

    auto optimo = dijkstra(grafo, 1, 4);
    CHECK(resultado.second >= optimo.second - 1e-9,
          "greedy nunca es mas barato que Dijkstra");
}

// ---------------------------------------------------------------------------
static void pruebasBellmanFord() {
    std::cout << "\nBellman-Ford\n";
    auto grafo = grafoDePrueba();

    auto bf = bellmanFord(grafo, 1, 4);
    auto dj = dijkstra(grafo, 1, 4);

    CHECK(casiIgual(bf.second, dj.second),
          "coincide con Dijkstra en el costo con pesos positivos");
    CHECK(bf.first == dj.first,
          "coincide con Dijkstra en la ruta con pesos positivos");

    // Ciclo negativo: 1 -> 2 -> 1 suma -5 en cada vuelta
    std::unordered_map<int, std::vector<Edge>> cicloNegativo = {
        {1, {{2, 1.0}}},
        {2, {{1, -6.0}, {3, 1.0}}},
        {3, {}}
    };
    auto ciclo = bellmanFord(cicloNegativo, 1, 3);
    CHECK(ciclo.first.empty() && ciclo.second >= 1e9,
          "detecta el ciclo de peso negativo y no devuelve ruta");
}

// ---------------------------------------------------------------------------
static void pruebasMonteCarlo() {
    std::cout << "\nMonte Carlo\n";
    auto grafo = grafoDePrueba();

    auto resultado = monteCarlo(grafo, 1, 4, 2000);
    CHECK(!resultado.first.empty(),
          "con 2000 iteraciones encuentra una ruta entre 1 y 4");
    CHECK(resultado.first.front() == 1 && resultado.first.back() == 4,
          "la ruta muestreada empieza en el origen y termina en el destino");

    auto optimo = dijkstra(grafo, 1, 4);
    CHECK(resultado.second >= optimo.second - 1e-9,
          "nunca supera al optimo de Dijkstra");

    CHECK(monteCarlo(grafo, 4, 1, 200).first.empty(),
          "devuelve vacio cuando el destino es inalcanzable");
}

// ---------------------------------------------------------------------------
// Regresion CLI-01
//
// imprimirRuta usaba idToNombre.at(), que lanzaba std::out_of_range cuando
// el usuario escribia un ID que no existe, y terminaba el programa.
// Reproducia con: opcion 7 -> origen 999 -> destino 999.
// ---------------------------------------------------------------------------
static void pruebasIdDesconocido() {
    std::cout << "\nRegresion CLI-01: ID desconocido\n";

    std::unordered_map<int, std::string> idToNombre = {{1, "Paris"}, {2, "Madrid"}};

    CHECK(nombreDe(idToNombre, 1) == "Paris",
          "nombreDe devuelve el nombre cuando el ID existe");
    CHECK(nombreDe(idToNombre, 999).find("999") != std::string::npos,
          "nombreDe devuelve una etiqueta legible cuando el ID no existe");

    bool lanzo = false;
    try {
        imprimirRuta("Prueba", {999}, idToNombre);
    } catch (const std::out_of_range&) {
        lanzo = true;
    }
    CHECK(!lanzo, "imprimirRuta no lanza out_of_range con un ID desconocido");

    bool lanzoMixta = false;
    try {
        imprimirRuta("Mixta", {1, 999, 2}, idToNombre);
    } catch (const std::out_of_range&) {
        lanzoMixta = true;
    }
    CHECK(!lanzoMixta, "imprimirRuta tolera un ID desconocido en medio de la ruta");
}

// ---------------------------------------------------------------------------
int main() {
    std::cout << "===========================================\n";
    std::cout << " EuroSky Connect - pruebas del motor C++\n";
    std::cout << "===========================================\n";

    pruebasCosto();
    pruebasReconstruccion();
    pruebasDijkstra();
    pruebasBfsDfs();
    pruebasGreedy();
    pruebasBellmanFord();
    pruebasMonteCarlo();
    pruebasIdDesconocido();

    std::cout << "\n-------------------------------------------\n";
    std::cout << " " << (ejecutadas - fallidas) << "/" << ejecutadas
              << " pruebas pasaron\n";
    if (fallidas > 0) {
        std::cout << " " << fallidas << " FALLARON\n";
        std::cout << "-------------------------------------------\n";
        return 1;
    }
    std::cout << "-------------------------------------------\n";
    return 0;
}
