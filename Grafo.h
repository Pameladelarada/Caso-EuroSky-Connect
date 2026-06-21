#ifndef GRAFO_H
#define GRAFO_H

#include <vector>
#include <unordered_map>
#include <string>
#include "json.hpp"

using json = nlohmann::json;
using namespace std;

struct Edge {
    int destino_id;
    double costo; // Representará el costo total o peso de la ruta
    int tiempo_vuelo_min;
    int tiempo_escala_min;
};

struct Nodo {
    int aeropuerto_id;
    double costo;
    bool operator>(const Nodo& other) const {
        return costo > other.costo;
    }
};

// Declaración de funciones de construcción de grafos
unordered_map<int, vector<Edge>> construirGrafo(const json& data);
unordered_map<int, string> obtenerMapeoNombres(const json& data);

#endif
