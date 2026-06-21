#include "Algoritmos.h"
#include <iostream>
#include <queue>
#include <set>
#include <algorithm>

vector<int> reconstruirRuta(const unordered_map<int, int>& anterior, int inicio, int fin) {
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

pair<vector<int>, double> dijkstra(const unordered_map<int, vector<Edge>>& grafo, int inicio, int fin) {
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

vector<int> bfs(const unordered_map<int, vector<Edge>>& grafo, int inicio, int fin) {
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

bool dfsRecursivo(const unordered_map<int, vector<Edge>>& grafo, int actual, int fin, set<int>& visitados, unordered_map<int, int>& anterior) {
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

vector<int> dfs(const unordered_map<int, vector<Edge>>& grafo, int inicio, int fin) {
    set<int> visitados;
    unordered_map<int, int> anterior;
    bool encontrado = dfsRecursivo(grafo, inicio, fin, visitados, anterior);

    if (!encontrado) return {};
    return reconstruirRuta(anterior, inicio, fin);
}

void dfsRestriccion(
    const unordered_map<int, vector<Edge>>& grafo,
    int actual,
    int fin,
    int tiempoActual,
    int maxTiempo,
    double costoActual,
    vector<int>& rutaActual,
    set<int>& visitados,
    vector<int>& mejorRuta,
    double& mejorCosto
) {
    if (actual == fin) {
        if (costoActual < mejorCosto) {
            mejorCosto = costoActual;
            mejorRuta = rutaActual;
        }
        return;
    }

    if (!grafo.count(actual)) return;

    for (const Edge& vecino : grafo.at(actual)) {
        if (!visitados.count(vecino.destino_id)) {
            int nuevoTiempo = tiempoActual + vecino.tiempo_vuelo_min;
            if (vecino.destino_id != fin) {
                nuevoTiempo += vecino.tiempo_escala_min;
            }
            
            if (nuevoTiempo <= maxTiempo) {
                visitados.insert(vecino.destino_id);
                rutaActual.push_back(vecino.destino_id);

                dfsRestriccion(grafo, vecino.destino_id, fin, nuevoTiempo, maxTiempo, costoActual + vecino.costo, rutaActual, visitados, mejorRuta, mejorCosto);

                rutaActual.pop_back();
                visitados.erase(vecino.destino_id);
            }
        }
    }
}

pair<vector<int>, double> rutaOptimaConRestricciones(
    const unordered_map<int, vector<Edge>>& grafo, 
    int inicio, 
    int fin, 
    int maxMinutosJornada
) {
    vector<int> mejorRuta;
    double mejorCosto = 1e9;
    
    set<int> visitados;
    vector<int> rutaActual;
    
    visitados.insert(inicio);
    rutaActual.push_back(inicio);
    
    dfsRestriccion(grafo, inicio, fin, 0, maxMinutosJornada, 0.0, rutaActual, visitados, mejorRuta, mejorCosto);
    
    if (mejorRuta.empty()) {
        return {{}, 1e9};
    }
    
    return {mejorRuta, mejorCosto};
}

void imprimirRuta(const string& algoritmo, const vector<int>& ruta, const unordered_map<int, string>& idToNombre) {
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
