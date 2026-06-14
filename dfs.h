#ifndef DFS_H
#define DFS_H

#include <set>
#include <unordered_map>
#include <vector>
#include "dijkstra.h"

using namespace std;

inline bool dfsRecursivo(
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

inline vector<int> dfs(
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

#endif
