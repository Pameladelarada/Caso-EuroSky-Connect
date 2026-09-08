# Makefile - EuroSky Connect (motor C++)
#
#   make          compila el binario
#   make run      compila y ejecuta el menu
#   make test     compila y ejecuta las pruebas
#   make clean    borra los artefactos de compilacion
#
# Funciona en Linux, macOS, WSL y Git Bash / MSYS2 en Windows.

CXX      ?= g++
CXXFLAGS := -std=c++17 -O2 -Wall -Wextra -Wpedantic -I.
BUILD    := build

# Fuentes del motor (sin main.cpp, para reutilizarlas en las pruebas)
LIB_SRC  := Grafo.cpp Algoritmos.cpp CostoRentabilidad.cpp

BIN      := $(BUILD)/eurosky
TEST_BIN := $(BUILD)/tests

ifeq ($(OS),Windows_NT)
    BIN      := $(BIN).exe
    TEST_BIN := $(TEST_BIN).exe
endif

.PHONY: all run test clean

all: $(BIN)

$(BUILD):
	@mkdir -p $(BUILD)

$(BIN): main.cpp $(LIB_SRC) | $(BUILD)
	@echo "Compilando el motor..."
	@$(CXX) $(CXXFLAGS) -o $@ main.cpp $(LIB_SRC)
	@echo "Listo: $@"

run: $(BIN)
	@./$(BIN)

$(TEST_BIN): tests/test_algoritmos.cpp $(LIB_SRC) | $(BUILD)
	@echo "Compilando las pruebas..."
	@$(CXX) $(CXXFLAGS) -o $@ tests/test_algoritmos.cpp $(LIB_SRC)

test: $(TEST_BIN)
	@./$(TEST_BIN)

clean:
	@rm -rf $(BUILD)
	@echo "Artefactos eliminados."
