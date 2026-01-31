/**
 * AATM - API Client
 * Fonctions d'appels API centralisées
 */

const ApiClient = {
    /**
     * Effectue une requête GET
     * @param {string} endpoint - Point d'API
     * @param {Object} params - Paramètres de requête
     * @returns {Promise<Object>}
     */
    async get(endpoint, params = {}) {
        const url = new URL(API_BASE + endpoint, window.location.origin);
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                url.searchParams.append(key, value);
            }
        });
        
        const response = await fetch(url.toString());
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return response.json();
    },

    /**
     * Effectue une requête POST
     * @param {string} endpoint - Point d'API
     * @param {Object} data - Données à envoyer
     * @returns {Promise<Object>}
     */
    async post(endpoint, data = {}) {
        const response = await fetch(API_BASE + endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText || `HTTP ${response.status}: ${response.statusText}`);
        }
        return response.json();
    },

    /**
     * Effectue une requête DELETE
     * @param {string} endpoint - Point d'API
     * @returns {Promise<Object>}
     */
    async delete(endpoint) {
        const response = await fetch(API_BASE + endpoint, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return response.json();
    },

    // ===== Fichiers =====
    
    /**
     * Charge la liste des fichiers d'un répertoire
     * @param {string} path - Chemin du répertoire
     * @returns {Promise<Array>}
     */
    async getFiles(path) {
        return this.get('/api/files', { path });
    },

    /**
     * Récupère la taille d'un fichier ou répertoire
     * @param {string} path - Chemin du fichier/répertoire
     * @returns {Promise<Object>}
     */
    async getDirectorySize(path) {
        return this.get('/api/directory-size', { path });
    },

    /**
     * Analyse un répertoire pour détecter s'il s'agit d'un pack série
     * @param {string} path - Chemin du répertoire
     * @returns {Promise<Object>}
     */
    async analyzeDirectory(path) {
        return this.get('/api/analyze-directory', { path });
    },

    /**
     * Récupère les informations MediaInfo
     * @param {string} path - Chemin du fichier
     * @param {string} format - Format de sortie ('text' ou 'json')
     * @returns {Promise<Object>}
     */
    async getMediaInfo(path, format = 'json') {
        return this.get('/api/mediainfo', { path, format });
    },

    // ===== Paramètres =====
    
    /**
     * Charge les paramètres
     * @returns {Promise<Object>}
     */
    async getSettings() {
        return this.get('/api/settings');
    },

    /**
     * Sauvegarde les paramètres
     * @param {Object} settings - Paramètres à sauvegarder
     * @returns {Promise<Object>}
     */
    async saveSettings(settings) {
        return this.post('/api/settings', settings);
    },

    // ===== Torrent =====
    
    /**
     * Crée un torrent
     * @param {Object} options - Options de création
     * @returns {Promise<Object>}
     */
    async createTorrent(options) {
        return this.post('/api/torrent/create', options);
    },

    /**
     * Upload un torrent vers le client
     * @param {string} torrentPath - Chemin du fichier torrent
     * @returns {Promise<Object>}
     */
    async uploadToClient(torrentPath) {
        return this.post('/api/torrent-client/upload', { torrentPath });
    },

    // ===== NFO =====
    
    /**
     * Sauvegarde le NFO
     * @param {Object} options - Options de sauvegarde
     * @returns {Promise<Object>}
     */
    async saveNfo(options) {
        return this.post('/api/nfo/save', options);
    },

    // ===== Hardlinks =====
    
    /**
     * Crée un hardlink
     * @param {Object} options - Options de création
     * @returns {Promise<Object>}
     */
    async createHardlink(options) {
        return this.post('/api/hardlink/create', options);
    },

    // ===== Fichiers traités =====
    
    /**
     * Marque un fichier comme traité
     * @param {string} path - Chemin du fichier
     * @returns {Promise<Object>}
     */
    async markProcessed(path) {
        return this.post('/api/processed/mark', { path });
    },

    /**
     * Récupère la liste des fichiers traités
     * @returns {Promise<Array>}
     */
    async getProcessed() {
        return this.get('/api/processed');
    },

    /**
     * Efface l'historique des fichiers traités
     * @returns {Promise<Object>}
     */
    async clearProcessed() {
        return this.delete('/api/processed');
    },

    // ===== TMDB =====
    
    /**
     * Recherche sur TMDB
     * @param {string} type - Type de recherche ('movie' ou 'tv')
     * @param {string} query - Terme de recherche
     * @returns {Promise<Object>}
     */
    async searchTmdb(type, query) {
        return this.get(`/api/tmdb/search/${type}`, { query, language: 'fr-FR' });
    },

    /**
     * Récupère les détails d'un élément TMDB
     * @param {string} type - Type ('movie' ou 'tv')
     * @param {string} id - ID TMDB
     * @returns {Promise<Object>}
     */
    async getTmdbDetails(type, id) {
        return this.get(`/api/tmdb/${type}/${id}`, { language: 'fr-FR' });
    },

    // ===== Steam =====
    
    /**
     * Recherche sur Steam
     * @param {string} query - Terme de recherche
     * @returns {Promise<Object>}
     */
    async searchSteam(query) {
        return this.get('/api/steam/search', { q: query });
    },

    /**
     * Récupère les détails d'un jeu Steam
     * @param {string} appId - ID Steam
     * @returns {Promise<Object>}
     */
    async getSteamDetails(appId) {
        return this.get('/api/steam/details', { appid: appId });
    },

    // ===== La Cale =====
    
    /**
     * Upload vers La Cale
     * @param {Object} options - Options d'upload
     * @returns {Promise<Object>}
     */
    async uploadToLaCale(options) {
        return this.post('/api/lacale/upload', options);
    },

    /**
     * Prévisualise les tags La Cale
     * @param {Object} options - Options
     * @returns {Promise<Object>}
     */
    async previewLaCaleTags(options) {
        return this.post('/api/lacale/preview-tags', options);
    },

    /**
     * Récupère tous les tags disponibles pour un type de média
     * @param {Object} options - Options {mediaType, releaseInfo}
     * @returns {Promise<Object>} {categories, selectedTags}
     */
    async getAllLaCaleTags(options) {
        return this.post('/api/lacale/all-tags', options);
    },

    // ===== Santé =====
    
    /**
     * Vérifie l'état de l'API
     * @returns {Promise<boolean>}
     */
    async checkHealth() {
        try {
            const response = await fetch(API_BASE + '/health');
            return response.ok;
        } catch {
            return false;
        }
    }
};

// ===== Google Books API (externe) =====

const GoogleBooksApi = {
    /**
     * Recherche sur Google Books
     * @param {string} query - Terme de recherche
     * @returns {Promise<Object>}
     */
    async search(query) {
        const response = await fetch(
            `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=10&langRestrict=fr`
        );
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return response.json();
    },

    /**
     * Récupère les détails d'un livre
     * @param {string} id - ID Google Books
     * @returns {Promise<Object>}
     */
    async getDetails(id) {
        const response = await fetch(`https://www.googleapis.com/books/v1/volumes/${id}`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return response.json();
    }
};

// Export pour utilisation dans d'autres modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ApiClient, GoogleBooksApi };
}
