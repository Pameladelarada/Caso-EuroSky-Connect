// Algorithms.h
#ifndef ALGORITMOS_H
#define ALGORITMOS_H

#include "Grafo.h"
#include "RutaUtils.h"
#include <vector>
#include <unordered_map>
#include <utility>

using namespace std;

// Algoritmos de búsqueda
pair<vector<int>, double> dijkstra(const unordered_map<int, vector<Edge>>& grafo, int inicio, int fin);
vector<int> bfs(const unordered_map<int, vector<Edge>>& grafo, int inicio, int fin);
vector<int> dfs(const unordered_map<int, vector<Edge>>& grafo, int inicio, int fin);

// greedy.h, montecarlo.h y bellmanford.h se incluyen desde donde se usan,
// no desde aquí: incluirlos aquí creaba un ciclo, porque cada uno incluía
// a su vez Algoritmos.h.

// Función para imprimir rutas
void imprimirRuta(const string& algoritmo, const vector<int>& ruta, const unordered_map<int, string>& idToNombre);

#endif
