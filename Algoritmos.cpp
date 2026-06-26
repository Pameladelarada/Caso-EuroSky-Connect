#include "Algoritmos.h"
#include <iostream>
#include <queue>
#include <set>
#include <algorithm>
#include <random>

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

// algoritmos Greedy
pair<vector<int>, double> greedy(const unordered_map<int, vector<Edge>>& grafo, int inicio, int fin) {
    unordered_map<int, double> distancias;
    unordered_map<int, int> anterior;
    set<int> visitados;

    for (const auto& nodo : grafo) distancias[nodo.first] = 1e9;
    distancias[inicio] = 0;

    // A diferencia de Dijkstra que usa la distancia total acumulada, Greedy usa solo el costo de la arista inmediata (peso).
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
            if (!visitados.count(vecino.destino_id)) {
                double nuevaDist = distancias[actual.aeropuerto_id] + vecino.costo;
                // En Greedy, decidimos la exploración basándonos solo en la mejor arista disponible hacia adelante
                if (nuevaDist < distancias[vecino.destino_id]) {
                    distancias[vecino.destino_id] = nuevaDist;
                    anterior[vecino.destino_id] = actual.aeropuerto_id;
                    pq.push({vecino.destino_id, vecino.costo}); // Heuristica basada puramente en el menor costo al siguiente paso
                }
            }
        }
    }

    return {reconstruirRuta(anterior, inicio, fin), distancias[fin]};
}

// algoritmos Monte Carlo
pair<vector<int>, double> monteCarlo(const unordered_map<int, vector<Edge>>& grafo, int inicio, int fin, int iteraciones) {
    vector<int> mejorRuta;
    double mejorCosto = 1e9;

    random_device rd;
    mt19937 gen(rd());

    for (int i = 0; i < iteraciones; ++i) {
        int actual = inicio;
        double costoActual = 0;
        vector<int> rutaTemp = {inicio};
        set<int> visitadosTemp = {inicio};

        while (actual != fin) {
            if (!grafo.count(actual) || grafo.at(actual).empty()) {
                break; // Callejón sin salida
            }

            vector<Edge> vecinosValidos;
            for (const auto& vecino : grafo.at(actual)) {
                if (!visitadosTemp.count(vecino.destino_id)) {
                    vecinosValidos.push_back(vecino);
                }
            }

            if (vecinosValidos.empty()) {
                break; // No hay más opciones no visitadas
            }

            // Elegir un vecino aleatoriamente
            uniform_int_distribution<> dis(0, vecinosValidos.size() - 1);
            Edge elegido = vecinosValidos[dis(gen)];

            rutaTemp.push_back(elegido.destino_id);
            visitadosTemp.insert(elegido.destino_id);
            costoActual += elegido.costo;
            actual = elegido.destino_id;
        }

        if (actual == fin && costoActual < mejorCosto) {
            mejorCosto = costoActual;
            mejorRuta = rutaTemp;
        }
    }

    return {mejorRuta, mejorCosto};
}

// algoritmos Bellman-Ford
pair<vector<int>, double> bellmanFord(const unordered_map<int, vector<Edge>>& grafo, int inicio, int fin) {
    unordered_map<int, double> distancias;
    unordered_map<int, int> anterior;

    // Inicializar distancias
    for (const auto& nodo : grafo) distancias[nodo.first] = 1e9;
    distancias[inicio] = 0;

    int V = grafo.size();

    // Relajar todas las aristas V - 1 veces
    for (int i = 1; i <= V - 1; i++) {
        for (const auto& par : grafo) {
            int u = par.first;
            if (distancias[u] == 1e9) continue;

            for (const Edge& vecino : par.second) {
                int v = vecino.destino_id;
                double peso = vecino.costo;
                if (distancias[u] + peso < distancias[v]) {
                    distancias[v] = distancias[u] + peso;
                    anterior[v] = u;
                }
            }
        }
    }

    // Comprobar ciclos de peso negativo
    for (const auto& par : grafo) {
        int u = par.first;
        if (distancias[u] == 1e9) continue;

        for (const Edge& vecino : par.second) {
            int v = vecino.destino_id;
            double peso = vecino.costo;
            if (distancias[u] + peso < distancias[v]) {
                // Hay un ciclo negativo, aunque en este contexto probablemente no ocurra.
                return {{}, 1e9};
            }
        }
    }

    return {reconstruirRuta(anterior, inicio, fin), distancias[fin]};
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
