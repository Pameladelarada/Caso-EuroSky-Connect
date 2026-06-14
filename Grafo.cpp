// Graph.cpp
#include "Grafo.h"
#include "CostoRentabilidad.h"

unordered_map<int, vector<Edge>> construirGrafo(const json& data) {
    unordered_map<int, vector<Edge>> grafo;
    
    for (const auto& ruta : data["rutas"]) {
        double costo_operativo = ruta["costo_operativo"].get<double>();
        double tasa_aeroportuaria = ruta["tasa_aeroportuaria"].get<double>();
        
        // Aquí hacemos el llamado a la función de Costo y Rentabilidad (.h)
        double costo_total = calcularCostoTotal(costo_operativo, tasa_aeroportuaria);
        
        // Agregamos la ruta al grafo, utilizando el costo total como peso
        grafo[ruta["origen"]].push_back({ruta["destino"], costo_total});
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
