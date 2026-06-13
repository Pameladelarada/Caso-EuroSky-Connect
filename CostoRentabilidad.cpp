// CostProfit.cpp
#include "CostoRentabilidad.h"

// Función de costo (según el caso de negocio: CT = Ca + Cc + Ta + Cm + Ce + Co)
// En los datos del JSON, los operativos se han agrupado en "costo_operativo" y "tasa_aeroportuaria"
double calcularCostoTotal(double costo_operativo, double tasa_aeroportuaria) {
    return costo_operativo + tasa_aeroportuaria;
}

// Función de rentabilidad (BN = IB - CT)
double calcularBeneficioNeto(double ingreso_proyectado, double costo_total) {
    return ingreso_proyectado - costo_total;
}
