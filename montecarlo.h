#ifndef MONTECARLO_H
#define MONTECARLO_H

#include <set>
#include <unordered_map>
#include <vector>
#include <random>
#include "Grafo.h"
#include "RutaUtils.h"

using namespace std;

// algoritmos Monte Carlo
inline pair<vector<int>, double> monteCarlo(const unordered_map<int, vector<Edge>>& grafo, int inicio, int fin, int iteraciones = 1000) {
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

#endif
