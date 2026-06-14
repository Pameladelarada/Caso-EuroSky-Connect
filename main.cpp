#include <iostream>
#include <vector>
#include <string>

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
    cin.ignore();

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
    cin.ignore();

    bool encontrado = false;

    for (int i = 0; i < aeropuertos.size(); i++) {
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
    cout << "LISTA DE AEROPUERTOS: " << endl;

    for (int i = 0; i < aeropuertos.size(); i++) {

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
    cout << "LISTA DE RUTAS: " << endl;

    for (int i = 0; i < aeropuertos.size(); i++) {

        cout << endl;
        cout << "Aeropuerto: " << aeropuertos[i].codigo << endl;

        for (int j = 0; j < aeropuertos[i].rutas.size(); j++) {

            cout << "Destino: "
                 << aeropuertos[i].rutas[j].destino
                 << " | Distancia: "
                 << aeropuertos[i].rutas[j].distancia
                 << " km | Tiempo: "
                 << aeropuertos[i].rutas[j].tiempo
                 << " h | Costo: "
                 << aeropuertos[i].rutas[j].costo
                 << endl;
        }
    }
}

void mostrarGrafo() {
    cout << endl;
    cout << "GRAFO: " << endl;

    for (int i = 0; i < aeropuertos.size(); i++) {

        cout << aeropuertos[i].codigo << " -> ";

        for (int j = 0; j < aeropuertos[i].rutas.size(); j++) {
            cout << aeropuertos[i].rutas[j].destino << " ";
        }

        cout << endl;
    }
}

int main() {

    int opcion;

    do {

        cout << endl;
        cout << "EUROSKY CONNECT: " << endl;
        cout << "1. Registrar aeropuerto" << endl;
        cout << "2. Registrar ruta" << endl;
        cout << "3. Mostrar aeropuertos" << endl;
        cout << "4. Mostrar rutas" << endl;
        cout << "5. Mostrar grafo" << endl;
        cout << "6. Salir" << endl;
        cout << "Seleccione una opcion: ";
        cin >> opcion;
        cin.ignore();

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
            mostrarGrafo();
            break;

        case 6:
            cout << endl << "Programa finalizado." << endl;
            break;

        default:
            cout << endl << "Opcion no valida." << endl;
        }

    } while (opcion != 6);

    return 0;
}