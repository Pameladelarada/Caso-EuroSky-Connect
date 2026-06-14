// main.cpp
#include <iostream>
#include <fstream>
#include <vector>
#include <string>
#include <unordered_map>
#include <limits>

#include "json.hpp"
#include "Grafo.h"
#include "CostoRentabilidad.h"
#include "Algoritmos.h"

using json = nlohmann::json;
using namespace std;

struct Ruta {
    string destino;
    double distancia;
    double tiempo;
    double costo;
    double tasa;
    int demanda;
};

struct Aeropuerto {
    string nombre;
    string codigo;
    string pais;
    string ciudad;
    double latitud;
    double longitud;
    vector<Ruta> rutas;
};

vector<Aeropuerto> aeropuertos;

void limpiarEntrada() {
    cin.clear();
    cin.ignore(numeric_limits<streamsize>::max(), '\n');
}

void registrarAeropuerto() {
    Aeropuerto a;

    cout << endl << "Nombre del aeropuerto: ";
    getline(cin, a.nombre);

    cout << "Codigo IATA: ";
    getline(cin, a.codigo);

    cout << "Pais: ";
    getline(cin, a.pais);

    cout << "Ciudad: ";
    getline(cin, a.ciudad);

    cout << "Latitud: ";
    cin >> a.latitud;

    cout << "Longitud: ";
    cin >> a.longitud;
    limpiarEntrada();

    aeropuertos.push_back(a);

    cout << endl << "Aeropuerto registrado correctamente." << endl;
}

void registrarRuta() {
    string origen;
    Ruta r;

    cout << endl << "Codigo del aeropuerto de origen: ";
    getline(cin, origen);

    cout << "Codigo del aeropuerto destino: ";
    getline(cin, r.destino);

    cout << "Distancia (km): ";
    cin >> r.distancia;

    cout << "Tiempo estimado de vuelo (horas): ";
    cin >> r.tiempo;

    cout << "Costo operativo: ";
    cin >> r.costo;

    cout << "Tasa aeroportuaria: ";
    cin >> r.tasa;

    cout << "Demanda esperada: ";
    cin >> r.demanda;
    limpiarEntrada();

    bool encontrado = false;

    for (size_t i = 0; i < aeropuertos.size(); i++) {
        if (aeropuertos[i].codigo == origen) {
            aeropuertos[i].rutas.push_back(r);
            encontrado = true;
            break;
        }
    }

    if (encontrado) {
        cout << endl << "Ruta registrada correctamente." << endl;
    } else {
        cout << endl << "No se encontro el aeropuerto de origen." << endl;
    }
}

void mostrarAeropuertos() {
    cout << endl;
    cout << "LISTA DE AEROPUERTOS REGISTRADOS MANUALMENTE:" << endl;

    if (aeropuertos.empty()) {
        cout << "No hay aeropuertos registrados." << endl;
        return;
    }

    for (size_t i = 0; i < aeropuertos.size(); i++) {
        cout << endl;
        cout << "Codigo: " << aeropuertos[i].codigo << endl;
        cout << "Nombre: " << aeropuertos[i].nombre << endl;
        cout << "Pais: " << aeropuertos[i].pais << endl;
        cout << "Ciudad: " << aeropuertos[i].ciudad << endl;
        cout << "Latitud: " << aeropuertos[i].latitud << endl;
        cout << "Longitud: " << aeropuertos[i].longitud << endl;
    }
}

void mostrarRutas() {
    cout << endl;
    cout << "LISTA DE RUTAS REGISTRADAS MANUALMENTE:" << endl;

    if (aeropuertos.empty()) {
        cout << "No hay aeropuertos registrados." << endl;
        return;
    }

    for (size_t i = 0; i < aeropuertos.size(); i++) {
        cout << endl;
        cout << "Aeropuerto: " << aeropuertos[i].codigo << endl;

        if (aeropuertos[i].rutas.empty()) {
            cout << "Sin rutas registradas." << endl;
        }

        for (size_t j = 0; j < aeropuertos[i].rutas.size(); j++) {
            cout << "Destino: "
                 << aeropuertos[i].rutas[j].destino
                 << " | Distancia: "
                 << aeropuertos[i].rutas[j].distancia
                 << " km | Tiempo: "
                 << aeropuertos[i].rutas[j].tiempo
                 << " h | Costo: "
                 << aeropuertos[i].rutas[j].costo
                 << " | Tasa: "
                 << aeropuertos[i].rutas[j].tasa
                 << " | Demanda: "
                 << aeropuertos[i].rutas[j].demanda
                 << endl;
        }
    }
}

void mostrarGrafoManual() {
    cout << endl;
    cout << "GRAFO MANUAL:" << endl;

    if (aeropuertos.empty()) {
        cout << "No hay aeropuertos registrados." << endl;
        return;
    }

    for (size_t i = 0; i < aeropuertos.size(); i++) {
        cout << aeropuertos[i].codigo << " -> ";

        for (size_t j = 0; j < aeropuertos[i].rutas.size(); j++) {
            cout << aeropuertos[i].rutas[j].destino << " ";
        }

        cout << endl;
    }
}

void mostrarAeropuertosJson(const json& data) {
    cout << endl;
    cout << "AEROPUERTOS DE data.json:" << endl;

    for (const auto& aeropuerto : data["aeropuertos"]) {
        cout << aeropuerto["id"] << ". "
             << aeropuerto["nombre"] << " - "
             << aeropuerto["codigo"] << " - "
             << aeropuerto["ciudad"] << ", "
             << aeropuerto["pais"] << endl;
    }
}

void ejecutarAlgoritmos(const json& data,
                        const unordered_map<int, vector<Edge>>& grafo,
                        const unordered_map<int, string>& idToNombre) {
    int inicioId;
    int finId;

    mostrarAeropuertosJson(data);

    cout << endl << "Ingrese ID de aeropuerto origen: ";
    cin >> inicioId;

    cout << "Ingrese ID de aeropuerto destino: ";
    cin >> finId;
    limpiarEntrada();

    pair<vector<int>, double> resultadoDijkstra = dijkstra(grafo, inicioId, finId);
    vector<int> rutaDijkstra = resultadoDijkstra.first;
    double costoTotal = resultadoDijkstra.second;

    vector<int> rutaBfs = bfs(grafo, inicioId, finId);
    vector<int> rutaDfs = dfs(grafo, inicioId, finId);

    cout << endl << "RESULTADOS DE ALGORITMOS:" << endl;
    imprimirRuta("Dijkstra", rutaDijkstra, idToNombre);
    imprimirRuta("BFS", rutaBfs, idToNombre);
    imprimirRuta("DFS", rutaDfs, idToNombre);

    if (!rutaDijkstra.empty()) {
        auto aeronave = data["aeronaves"][0];
        double ingresos = aeronave["capacidad"].get<int>() *
                          data["configuracion"]["precio_promedio_boleto"].get<double>();
        double rentabilidad = calcularBeneficioNeto(ingresos, costoTotal);

        cout << endl;
        cout << "Aeronave seleccionada: " << aeronave["nombre"]
             << " (Capacidad: " << aeronave["capacidad"] << ")" << endl;
        cout << "Costo total Dijkstra: " << costoTotal << endl;
        cout << "Ingresos estimados: " << ingresos << endl;
        cout << "Rentabilidad estimada (Beneficio Neto): " << rentabilidad << endl;
    }
}

int main() {
    ifstream file("data.json");
    if (!file.is_open()) {
        cerr << "No se pudo abrir el archivo data.json" << endl;
        return 1;
    }

    json data;
    file >> data;
    file.close();

    unordered_map<int, string> idToNombre = obtenerMapeoNombres(data);
    unordered_map<int, vector<Edge>> grafo = construirGrafo(data);

    int opcion;

    do {
        cout << endl;
        cout << "EUROSKY CONNECT" << endl;
        cout << "1. Registrar aeropuerto manual" << endl;
        cout << "2. Registrar ruta manual" << endl;
        cout << "3. Mostrar aeropuertos manuales" << endl;
        cout << "4. Mostrar rutas manuales" << endl;
        cout << "5. Mostrar grafo manual" << endl;
        cout << "6. Mostrar aeropuertos de data.json" << endl;
        cout << "7. Ejecutar Dijkstra, BFS y DFS con data.json" << endl;
        cout << "8. Salir" << endl;
        cout << "Seleccione una opcion: ";

        cin >> opcion;
        limpiarEntrada();

        switch (opcion) {
        case 1:
            registrarAeropuerto();
            break;
        case 2:
            registrarRuta();
            break;
        case 3:
            mostrarAeropuertos();
            break;
        case 4:
            mostrarRutas();
            break;
        case 5:
            mostrarGrafoManual();
            break;
        case 6:
            mostrarAeropuertosJson(data);
            break;
        case 7:
            ejecutarAlgoritmos(data, grafo, idToNombre);
            break;
        case 8:
            cout << endl << "Programa finalizado." << endl;
            break;
        default:
            cout << endl << "Opcion no valida." << endl;
        }

    } while (opcion != 8);

    return 0;
}