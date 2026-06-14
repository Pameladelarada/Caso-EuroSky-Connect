#ifndef BFS_H
#define BFS_H

#include <queue>
#include <set>
#include <unordered_map>
#include <vector>
#include "dijkstra.h"

using namespace std;

inline vector<int> bfs(
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

#endif
