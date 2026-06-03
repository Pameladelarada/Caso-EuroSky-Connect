#include <algorithm>
#include <fstream>
#include <iostream>
#include <queue>
#include <set>
#include <string>
#include <unordered_map>
#include <vector>
#include "json.hpp"

using json = nlohmann::json;
using namespace std;

struct Edge {
    int destino_id;
    double costo;
};

struct Nodo {
    int aeropuerto_id;
    double costo;
    bool operator>(const Nodo& other) const {
        return costo > other.costo;
    }
};

vector<int> reconstruirRuta(
    const unordered_map<int, int>& anterior,
    int inicio,
    int fin
) {
    vector<int> ruta;

    if (inicio == fin) {
        ruta.push_back(inicio);
        return ruta;
    }

    if (!anterior.count(fin)) return ruta;

    int actual = fin;
    while (actual != inicio) {
        ruta.push_back(actual);
        actual = anterior.at(actual);
    }

    ruta.push_back(inicio);
    reverse(ruta.begin(), ruta.end());
    return ruta;
}

pair<vector<int>, double> dijkstra(
    const unordered_map<int, vector<Edge>>& grafo,
    int inicio,
    int fin
) {
    unordered_map<int, double> distancias;
    unordered_map<int, int> anterior;
    set<int> visitados;

    for (const auto& nodo : grafo) distancias[nodo.first] = 1e9;
    distancias[inicio] = 0;

    priority_queue<Nodo, vector<Nodo>, greater<Nodo>> pq;
    pq.push({inicio, 0});

    while (!pq.empty()) {
        Nodo actual = pq.top();
        pq.pop();

        if (visitados.count(actual.aeropuerto_id)) continue;
        visitados.insert(actual.aeropuerto_id);
        if (actual.aeropuerto_id == fin) break;

        if (!grafo.count(actual.aeropuerto_id)) continue;

        for (const Edge& vecino : grafo.at(actual.aeropuerto_id)) {
            double nuevaDist = distancias[actual.aeropuerto_id] + vecino.costo;
            if (nuevaDist < distancias[vecino.destino_id]) {
                distancias[vecino.destino_id] = nuevaDist;
                anterior[vecino.destino_id] = actual.aeropuerto_id;
                pq.push({vecino.destino_id, nuevaDist});
            }
        }
    }

    return {reconstruirRuta(anterior, inicio, fin), distancias[fin]};
}

vector<int> bfs(
    const unordered_map<int, vector<Edge>>& grafo,
    int inicio,
    int fin
) {
    queue<int> cola;
    set<int> visitados;
    unordered_map<int, int> anterior;

    cola.push(inicio);
    visitados.insert(inicio);

    while (!cola.empty()) {
        int actual = cola.front();
        cola.pop();

        if (actual == fin) break;
        if (!grafo.count(actual)) continue;

        for (const Edge& vecino : grafo.at(actual)) {
            if (!visitados.count(vecino.destino_id)) {
                visitados.insert(vecino.destino_id);
                anterior[vecino.destino_id] = actual;
                cola.push(vecino.destino_id);
            }
        }
    }

    return reconstruirRuta(anterior, inicio, fin);
}

bool dfsRecursivo(
    const unordered_map<int, vector<Edge>>& grafo,
    int actual,
    int fin,
    set<int>& visitados,
    unordered_map<int, int>& anterior
) {
    visitados.insert(actual);
    if (actual == fin) return true;
    if (!grafo.count(actual)) return false;

    for (const Edge& vecino : grafo.at(actual)) {
        if (!visitados.count(vecino.destino_id)) {
            anterior[vecino.destino_id] = actual;
            if (dfsRecursivo(grafo, vecino.destino_id, fin, visitados, anterior)) {
                return true;
            }
        }
    }

    return false;
}

vector<int> dfs(
    const unordered_map<int, vector<Edge>>& grafo,
    int inicio,
    int fin
) {
    set<int> visitados;
    unordered_map<int, int> anterior;
    bool encontrado = dfsRecursivo(grafo, inicio, fin, visitados, anterior);

    if (!encontrado) return {};
    return reconstruirRuta(anterior, inicio, fin);
}

void imprimirRuta(
    const string& algoritmo,
    const vector<int>& ruta,
    const unordered_map<int, string>& idToNombre
) {
    cout << algoritmo << ": ";

    if (ruta.empty()) {
        cout << "No se encontro ruta\n";
        return;
    }

    for (size_t i = 0; i < ruta.size(); i++) {
        cout << idToNombre.at(ruta[i]);
        if (i + 1 < ruta.size()) cout << " -> ";
    }
    cout << "\n";
}

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
