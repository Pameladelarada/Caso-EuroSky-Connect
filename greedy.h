#ifndef GREEDY_H
#define GREEDY_H

#include <queue>
#include <set>
#include <unordered_map>
#include <vector>
#include "Grafo.h"
#include "Algoritmos.h"

using namespace std;

// algoritmos Greedy
inline pair<vector<int>, double> greedy(const unordered_map<int, vector<Edge>>& grafo, int inicio, int fin) {
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

#endif
