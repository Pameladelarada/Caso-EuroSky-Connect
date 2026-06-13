// main.cpp
#include <iostream>
#include <fstream>
#include "json.hpp"
#include "Grafo.h"
#include "CostoRentabilidad.h"
#include "Algoritmos.h"

using json = nlohmann::json;
using namespace std;

int main() {
    ifstream file("data.json");
    if (!file.is_open()) {
        cerr << "No se pudo abrir el archivo data.json" << endl;
        return 1;
    }

    json data;
    file >> data;
    file.close();

    // 1. Obtener mapeo de nombres para impresión
    unordered_map<int, string> idToNombre = obtenerMapeoNombres(data);

    // 2. Construir grafo y aplicar función de costo y rentabilidad
    unordered_map<int, vector<Edge>> grafo = construirGrafo(data);

    // Seleccionar aeronave base
    auto aeronave = data["aeronaves"][0];
    cout << "Aeronave seleccionada: " << aeronave["nombre"]
         << " (Capacidad: " << aeronave["capacidad"] << ")\n";

    // Variables de prueba
    int inicio_id = 1; // Paris
    int fin_id = 11;   // Barcelona

    // 3. Uso de Algoritmos
    pair<vector<int>, double> resultadoDijkstra = dijkstra(grafo, inicio_id, fin_id);
    vector<int> rutaDijkstra = resultadoDijkstra.first;
    double costoTotal = resultadoDijkstra.second;
    
    vector<int> rutaBfs = bfs(grafo, inicio_id, fin_id);
    vector<int> rutaDfs = dfs(grafo, inicio_id, fin_id);

    // Imprimir Resultados
    imprimirRuta("Dijkstra", rutaDijkstra, idToNombre);
    imprimirRuta("BFS", rutaBfs, idToNombre);
    imprimirRuta("DFS", rutaDfs, idToNombre);

    // Cálculo de rentabilidad
    double ingresos = aeronave["capacidad"].get<int>() * data["configuracion"]["precio_promedio_boleto"].get<double>();
    double rentabilidad = calcularBeneficioNeto(ingresos, costoTotal);

    cout << "Costo total Dijkstra: " << costoTotal << "\n"
         << "Ingresos estimados: " << ingresos << "\n"
         << "Rentabilidad estimada (Beneficio Neto): " << rentabilidad << endl;

    return 0;
}
