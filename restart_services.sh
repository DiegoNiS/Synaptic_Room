#!/bin/bash
# ==============================================================================
# Synaptic Room - Docker Services Manager
# ==============================================================================
# Detiene todos los contenedores de Compose y los vuelve a iniciar reconstruyéndolos.
# ==============================================================================

# Colores para salida en consola
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${RED}🛑 Deteniendo y removiendo contenedores de Synaptic Room...${NC}"
docker-compose down

echo -e "${YELLOW}🧹 Limpiando recursos huérfanos...${NC}"
docker-compose down --remove-orphans

echo -e "${BLUE}🚀 Iniciando y reconstruyendo todos los servicios...${NC}"
docker-compose up -d --build

echo -e "${GREEN}📊 Estado actual de los contenedores:${NC}"
docker-compose ps

echo -e "${GREEN}💡 ¡Servicios listos!${NC}"
echo -e "   - Frontend Cliente: ${BLUE}http://localhost:5173${NC}"
echo -e "   - Backend Servidor: ${BLUE}http://localhost:3001${NC}"
echo -e "   - FastAPI Agentes:  ${BLUE}http://localhost:8000${NC}"
echo -e "\nUsa ${YELLOW}docker-compose logs -f${NC} para ver la salida en vivo de todos los servicios."
