# 🧲 AATM Web API

**AATM Web API** (Amazing Automatic Torrent Maker) est un conteneur Docker avec **interface web** pour créer des fichiers **.torrent** avec **qBittorrent intégré**.

Il permet de naviguer dans vos fichiers, générer des torrents et NFO, et uploader directement vers qBittorrent ou La-Cale.

> 🙏 **Basé sur** [zedeska/aatm](https://github.com/zedeska/aatm) - Merci pour le code original !

---

## ✨ Fonctionnalités

- 🌐 **Interface web** moderne dark mode
- 📁 **Explorateur de fichiers** avec navigation complète
- 🎬 Affichage **MediaInfo** des fichiers vidéo
- 🧲 Création de fichiers `.torrent`
- 📝 Génération de fichiers **NFO**
- ⬆️ Upload automatique vers **qBittorrent** (intégré)
- 🚀 Upload vers **La-Cale** (tracker privé)
- ⚙️ Configuration via interface web
- 📜 Historique des fichiers traités
- 🐳 qBittorrent inclus dans le conteneur

---

## ⚙️ Variables d'environnement

| Variable | Description | Défaut |
|----------|-------------|--------|
| `MEDIA_PATH` | Chemin vers vos médias sur l'hôte | `/` |
| `AATM_API_PORT` | Port de l'interface web | `8085` |
| `AATM_QBIT_PORT` | Port du WebUI qBittorrent | `8086` |
| `TZ` | Timezone | `Europe/Paris` |

---

## 📁 Volumes

| Chemin conteneur | Description |
|------------------|-------------|
| `/userdata` | Système de fichiers hôte (lecture/écriture) |
| `/config` | Base de données et settings |
| `/config/qBittorrent` | Configuration qBittorrent |

---

## 🚀 Exemple docker-compose

```yaml
services:
  aatm-web-api:
    image: loteran/aatm-web-api:latest
    container_name: aatm-web-api
    restart: unless-stopped
    ports:
      - "8080:8080"      # Interface web
      - "8081:8081"      # qBittorrent WebUI
    environment:
      - TZ=Europe/Paris
    volumes:
      - /your/media/path:/userdata    # Vos médias
      - ./config:/config               # Configuration persistante
```

---

## 🖥️ Utilisation

1. Lancez le conteneur
2. Accédez à `http://votre-ip:8085`
3. Naviguez dans `/host` pour trouver vos fichiers
4. Sélectionnez un fichier vidéo
5. Suivez le workflow de création de torrent
6. Upload automatique vers qBittorrent

---

## 🔐 Credentials qBittorrent par défaut

| Paramètre | Valeur |
|-----------|--------|
| URL | `http://localhost:8086` |
| Username | `admin` |
| Password | `adminadmin` |

---

## 📝 Notes

- La configuration est persistante dans `/config`
- qBittorrent est intégré dans le conteneur
- Détection automatique des packs séries
- Support des tags La Cale avec sélection manuelle
- Compatible architectures `amd64` (PC/UNRAID) et `arm64` (Raspberry Pi)

---

## 🔗 Liens

- **GitHub** : https://github.com/loteran/aatm-web-api
- **Basé sur** : https://github.com/zedeska/aatm
