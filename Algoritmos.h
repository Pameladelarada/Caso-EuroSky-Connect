// Algorithms.h
#ifndef ALGORITMOS_H
#define ALGORITMOS_H

#include "Grafo.h"
#include <vector>
#include <unordered_map>
#include <utility>

using namespace std;

// Función auxiliar para reconstruir el camino
vector<int> reconstruirRuta(const unordered_map<int, int>& anterior, int inicio, int fin);

// Algoritmos de búsqueda
pair<vector<int>, double> dijkstra(const unordered_map<int, vector<Edge>>& grafo, int inicio, int fin);
vector<int> bfs(const unordered_map<int, vector<Edge>>& grafo, int inicio, int fin);
vector<int> dfs(const unordered_map<int, vector<Edge>>& grafo, int inicio, int fin);

// algoritmos Greedy
pair<vector<int>, double> greedy(const unordered_map<int, vector<Edge>>& grafo, int inicio, int fin);

// algoritmos Monte Carlo
pair<vector<int>, double> monteCarlo(const unordered_map<int, vector<Edge>>& grafo, int inicio, int fin, int iteraciones = 1000);

// algoritmos Bellman-Ford
pair<vector<int>, double> bellmanFord(const unordered_map<int, vector<Edge>>& grafo, int inicio, int fin);

// Función para imprimir rutas
void imprimirRuta(const string& algoritmo, const vector<int>& ruta, const unordered_map<int, string>& idToNombre);

#endif
