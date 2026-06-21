// Graph.cpp
#include "Grafo.h"
#include "CostoRentabilidad.h"

unordered_map<int, vector<Edge>> construirGrafo(const json& data) {
    unordered_map<int, vector<Edge>> grafo;
    
    for (const auto& ruta : data["rutas"]) {
        double costo_operativo = ruta["costo_operativo"].get<double>();
        double tasa_aeroportuaria = ruta["tasa_aeroportuaria"].get<double>();
        
        double costo_total = calcularCostoTotal(costo_operativo, tasa_aeroportuaria);
        int tiempo_vuelo = ruta["tiempo_vuelo_min"].get<int>();
        int tiempo_escala = ruta["tiempo_escala_min"].get<int>();
        
        // Agregamos la ruta al grafo, utilizando el costo total como peso y agregando los tiempos
        grafo[ruta["origen"]].push_back({ruta["destino"], costo_total, tiempo_vuelo, tiempo_escala});
    }
    
    return grafo;
}

unordered_map<int, string> obtenerMapeoNombres(const json& data) {
    unordered_map<int, string> idToNombre;
    for (const auto& aeropuerto : data["aeropuertos"]) {
        idToNombre[aeropuerto["id"]] = aeropuerto["nombre"];
    }
    return idToNombre;
}
