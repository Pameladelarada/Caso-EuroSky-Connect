#include <fstream>
#include <iostream>
#include <string>
#include <unordered_map>
#include <vector>
#include "json.hpp"
#include "dijkstra.h"
#include "bfs.h"
#include "dfs.h"

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

    unordered_map<int, string> idToNombre;
    for (const auto& aeropuerto : data["aeropuertos"]) {
        idToNombre[aeropuerto["id"]] = aeropuerto["nombre"];
    }

    unordered_map<int, vector<Edge>> grafo;
    for (const auto& ruta : data["rutas"]) {
        double costo = ruta["distancia"].get<double>()
            + ruta["costo_operativo"].get<double>()
            + ruta["tasa_aeroportuaria"].get<double>();

        grafo[ruta["origen"]].push_back({ruta["destino"], costo});
    }

    auto aeronave = data["aeronaves"][0];
    cout << "Aeronave seleccionada: " << aeronave["nombre"]
         << " (Capacidad: " << aeronave["capacidad"] << ")\n";

    int inicio_id = 1;
    int fin_id = 11;

    pair<vector<int>, double> resultadoDijkstra = dijkstra(grafo, inicio_id, fin_id);
    vector<int> rutaDijkstra = resultadoDijkstra.first;
    double costoTotal = resultadoDijkstra.second;
    vector<int> rutaBfs = bfs(grafo, inicio_id, fin_id);
    vector<int> rutaDfs = dfs(grafo, inicio_id, fin_id);

    imprimirRuta("Dijkstra", rutaDijkstra, idToNombre);
    imprimirRuta("BFS", rutaBfs, idToNombre);
    imprimirRuta("DFS", rutaDfs, idToNombre);

    double ingresos = aeronave["capacidad"].get<int>() * 100;
    double rentabilidad = ingresos - costoTotal;

    cout << "Costo total Dijkstra: " << costoTotal
         << "\nIngresos estimados: " << ingresos
         << "\nRentabilidad estimada: " << rentabilidad << endl;

    return 0;
}
