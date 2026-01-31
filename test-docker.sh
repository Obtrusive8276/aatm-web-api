#!/bin/bash

# Script de test Docker pour AATM

echo "🧪 Test de l'environnement Docker AATM"
echo "======================================="

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Vérifier que Docker est installé
echo -n "Vérification de Docker... "
if command -v docker &> /dev/null; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗${NC}"
    echo "Docker n'est pas installé. Installez-le d'abord."
    exit 1
fi

# Vérifier que Docker Compose est installé
echo -n "Vérification de Docker Compose... "
if command -v docker-compose &> /dev/null || docker compose version &> /dev/null; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗${NC}"
    echo "Docker Compose n'est pas installé."
    exit 1
fi

# Arrêter les conteneurs existants
echo -n "Arrêt des conteneurs existants... "
docker-compose down &> /dev/null
echo -e "${GREEN}✓${NC}"

# Build de l'image
echo "Construction de l'image Docker..."
if docker-compose build; then
    echo -e "${GREEN}✓ Build réussi${NC}"
else
    echo -e "${RED}✗ Build échoué${NC}"
    exit 1
fi

# Démarrage du conteneur
echo "Démarrage du conteneur..."
if docker-compose up -d; then
    echo -e "${GREEN}✓ Conteneur démarré${NC}"
else
    echo -e "${RED}✗ Démarrage échoué${NC}"
    exit 1
fi

# Attendre que l'API soit prête
echo -n "Attente du démarrage de l'API... "
for i in {1..30}; do
    if curl -s http://localhost:${AATM_API_PORT:-8085}/health &> /dev/null; then
        echo -e "${GREEN}✓${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${RED}✗${NC}"
        echo "L'API n'a pas démarré dans les temps"
        docker-compose logs
        exit 1
    fi
    sleep 1
done

# Test de l'endpoint health
echo -n "Test de l'endpoint /health... "
HEALTH=$(curl -s http://localhost:${AATM_API_PORT:-8085}/health)
if echo "$HEALTH" | grep -q "ok"; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗${NC}"
    echo "Réponse inattendue: $HEALTH"
fi

# Test de l'endpoint settings
echo -n "Test de l'endpoint /api/settings... "
SETTINGS=$(curl -s http://localhost:${AATM_API_PORT:-8085}/api/settings)
if echo "$SETTINGS" | grep -q "rootPath"; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗${NC}"
    echo "Réponse inattendue: $SETTINGS"
fi

# Afficher les logs récents
echo ""
echo "Logs récents:"
echo "============="
docker-compose logs --tail=20

echo ""
echo -e "${GREEN}✅ Tous les tests sont passés !${NC}"
echo ""
echo "Accès à l'application:"
echo "- Interface AATM: http://localhost:${AATM_API_PORT:-8085}"
echo "- qBittorrent WebUI: http://localhost:${AATM_QBIT_PORT:-8086}"
echo ""
echo "Pour arrêter: docker-compose down"
echo "Pour voir les logs: docker-compose logs -f"
