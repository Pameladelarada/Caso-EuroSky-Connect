#include <iostream>
#include <fstream>
#include <vector>
#include <queue>
#include <unordered_map>
#include <set>
#include <string>
#include "json.hpp"  // nlohmann/json

using json = nlohmann::json;
using namespace std;

// Estructura de arista
struct Edge {
    int destino_id;
    double costo; // distancia + costo_operativo
};

// Nodo para la cola de prioridad de Dijkstra
struct Nodo {
    int aeropuerto_id;
    double costo;
    bool operator>(const Nodo& other) const { return costo > other.costo; }
};

// Función Dijkstra
pair<vector<int>, double> dijkstra(
    const unordered_map<int, vector<Edge>>& grafo,
    int inicio,
    int fin
) {
    unordered_map<int, double> distancias;
    unordered_map<int, int> anterior;
    set<int> visitados;

    for (auto& nodo : grafo) distancias[nodo.first] = 1e9;
    distancias[inicio] = 0;

    priority_queue<Nodo, vector<Nodo>, greater<Nodo>> pq;
    pq.push({inicio, 0});

    while (!pq.empty()) {
        Nodo actual = pq.top(); pq.pop();

        if (visitados.count(actual.aeropuerto_id)) continue;
        visitados.insert(actual.aeropuerto_id);

        for (const Edge& vecino : grafo.at(actual.aeropuerto_id)) {
            double nuevaDist = distancias[actual.aeropuerto_id] + vecino.costo;
            if (nuevaDist < distancias[vecino.destino_id]) {
                distancias[vecino.destino_id] = nuevaDist;
                anterior[vecino.destino_id] = actual.aeropuerto_id;
                pq.push({vecino.destino_id, nuevaDist});
            }
        }
    }

    // Reconstruir ruta
    vector<int> ruta;
    double costo_total = distancias[fin];
    int actual = fin;
    while (actual != inicio) {
        ruta.push_back(actual);
        actual = anterior[actual];
    }
    ruta.push_back(inicio);
    reverse(ruta.begin(), ruta.end());

    return {ruta, costo_total};
}

// Función principal
int main() {
    // Cargar archivo JSON
    ifstream file("data.json");
    if (!file.is_open()) {
        cerr << "No se pudo abrir el archivo data.json" << endl;
        return 1;
    }

    json data;
    file >> data;
    file.close();

    // Crear map de id a nombre de aeropuerto
    unordered_map<int, string> idToNombre;
    for (auto& a : data["aeropuertos"])
        idToNombre[a["id"]] = a["nombre"];

    // Construir grafo desde JSON
    unordered_map<int, vector<Edge>> grafo;
    for (auto& r : data["rutas"])
        grafo[r["origen"]].push_back({r["destino"], r["distancia"].get<double>() + r["costo_operativo"].get<double>()});

    // Seleccionar primera aeronave
    auto aeronave = data["aeronaves"][0];
    cout << "Aeronave seleccionada: " << aeronave["nombre"]
         << " (Capacidad: " << aeronave["capacidad"] << ")\n";

    // Definir IDs de origen y destino (ajustar según tu JSON)
    int inicio_id = 1; // Ejemplo: Lima
    int fin_id = 5;    // Ejemplo: Moscu

    // Ejecutar Dijkstra
    auto [ruta, costo_total] = dijkstra(grafo, inicio_id, fin_id);

    // Calcular rentabilidad (ejemplo simple)
    double ingresos = aeronave["capacidad"].get<int>() * 100; 
    double rentabilidad = ingresos - costo_total;

    // Mostrar resultados
    cout << "Ruta óptima: ";
    for (int id : ruta) cout << idToNombre[id] << " -> ";
    cout << "\b\b  \nCosto total: " << costo_total
         << "\nIngresos estimados: " << ingresos
         << "\nRentabilidad estimada: " << rentabilidad << endl;

    return 0;
}