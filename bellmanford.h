#ifndef BELLMANFORD_H
#define BELLMANFORD_H

#include <unordered_map>
#include <vector>
#include "Grafo.h"
#include "RutaUtils.h"

using namespace std;

// algoritmos Bellman-Ford
inline pair<vector<int>, double> bellmanFord(const unordered_map<int, vector<Edge>>& grafo, int inicio, int fin) {
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

#endif
