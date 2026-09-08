// RutaUtils.h
// Utilidades compartidas por todos los algoritmos de busqueda.
//
// Existe para romper el ciclo de inclusion que habia entre Algoritmos.h y
// greedy.h / montecarlo.h / bellmanford.h: cada uno incluia al otro y el
// orden de inclusion pasaba a importar.
#ifndef RUTA_UTILS_H
#define RUTA_UTILS_H

#include <string>
#include <unordered_map>
#include <vector>

#include "Grafo.h"

// Reconstruye la ruta completa a partir del mapa de predecesores.
// Devuelve un vector vacio si el destino no es alcanzable.
std::vector<int> reconstruirRuta(const std::unordered_map<int, int>& anterior,
                                 int inicio,
                                 int fin);

// Devuelve el nombre del aeropuerto, o una etiqueta legible si el ID no
// esta registrado. Nunca lanza excepciones: es el unico punto donde se
// traduce un ID a texto, para que un ID desconocido no tumbe el programa.
std::string nombreDe(const std::unordered_map<int, std::string>& idToNombre, int id);

#endif
