/**
 * AATM - State Management
 * Gestion centralisée de l'état de l'application
 */

const AppState = {
    // Navigation
    currentPage: 'files',
    
    // Explorateur de fichiers
    currentPath: '',
    currentFiles: [],
    selectedFile: null,
    selectedIsDir: false,
    selectedMediaType: '',
    
    // Paramètres
    settings: {
        rootPath: '/',
        showProcessed: false,
        showNotProcessed: true
    },
    
    // Workflow
    workflowStep: 1,
    mediaType: 'movie',
    
    /**
     * L'objet Media actuel (Film, Serie, etc.)
     * @type {Film|Serie|null}
     */
    currentMedia: null,
    
    // Legacy: releaseInfo pour compatibilité
    releaseInfo: {},
    torrentName: '',
    
    // Fichiers créés
    createdTorrentPath: null,
    createdNfoPath: null,
    
    // Métadonnées génériques
    metadataId: '',
    metadataData: null,
    
    // TMDB (films/séries)
    tmdbId: '',
    tmdbData: null,
    
    // Google Books (ebooks)
    bookId: '',
    bookData: null,
    
    // Steam (jeux)
    steamId: '',
    gameData: null,
    
    // NFO
    nfoContent: '',
    
    // Tags La Cale sélectionnés
    selectedTagIds: new Set(),
    
    // Présentation BBCode (modifiable)
    presentationBBCode: '',
    
    /**
     * Réinitialise l'état du workflow
     */
    resetWorkflow() {
        this.workflowStep = 1;
        this.currentMedia = null;
        this.releaseInfo = {};
        this.torrentName = '';
        this.createdTorrentPath = null;
        this.createdNfoPath = null;
        this.metadataId = '';
        this.metadataData = null;
        this.tmdbId = '';
        this.tmdbData = null;
        this.bookId = '';
        this.bookData = null;
        this.steamId = '';
        this.gameData = null;
        this.nfoContent = '';
        this.selectedTagIds = new Set();
        this.presentationBBCode = '';
    },
    
    /**
     * Initialise un nouveau média pour le workflow
     * @param {Object} options - Options pour MediaFactory.create
     * @returns {Film|Serie|null}
     */
    initMedia(options) {
        this.currentMedia = MediaFactory.create(options);
        if (this.currentMedia) {
            this.mediaType = this.currentMedia.type;
            // Synchroniser releaseInfo pour compatibilité
            this.syncFromMedia();
        }
        return this.currentMedia;
    },
    
    /**
     * Synchronise releaseInfo depuis currentMedia (pour compatibilité)
     */
    syncFromMedia() {
        if (!this.currentMedia) return;
        
        this.releaseInfo = {
            title: this.currentMedia.title,
            year: this.currentMedia.year,
            resolution: this.currentMedia.resolution,
            codec: this.currentMedia.codec,
            source: this.currentMedia.source,
            releaseGroup: this.currentMedia.releaseGroup,
            edition: this.currentMedia.edition,
            info: this.currentMedia.info,
            hdr: this.currentMedia.hdr,
            audioCodecs: this.currentMedia.audioCodecs,
            audioChannels: this.currentMedia.audioChannels,
            audioLanguages: this.currentMedia.audioLanguages,
            audioTracks: this.currentMedia.audioTracks,
            subtitleLanguages: this.currentMedia.subtitleLanguages,
            language: this.currentMedia.language,
            isVOSTFR: this.currentMedia.isVOSTFR,
            container: this.currentMedia.container
        };
        
        // Propriétés spécifiques aux séries
        if (this.currentMedia instanceof Serie) {
            this.releaseInfo.season = this.currentMedia.season;
            this.releaseInfo.episode = this.currentMedia.episode;
            this.releaseInfo.episodeCount = this.currentMedia.episodeCount;
        }
    },
    
    /**
     * Synchronise currentMedia depuis releaseInfo (pour compatibilité inverse)
     */
    syncToMedia() {
        if (!this.currentMedia) return;
        
        this.currentMedia.applyReleaseInfo(this.releaseInfo);
        
        if (this.currentMedia instanceof Serie) {
            if (this.releaseInfo.season) this.currentMedia.season = this.releaseInfo.season;
            if (this.releaseInfo.episode) this.currentMedia.episode = this.releaseInfo.episode;
        }
    },
    
    /**
     * Génère le nom de release depuis l'objet Media
     * @returns {string}
     */
    generateMediaName() {
        if (this.currentMedia) {
            return this.currentMedia.generateName();
        }
        // Fallback à l'ancienne méthode
        return generateReleaseName(this.releaseInfo, this.mediaType);
    },
    
    /**
     * Réinitialise les métadonnées
     */
    resetMetadata() {
        this.metadataId = '';
        this.metadataData = null;
        this.tmdbId = '';
        this.tmdbData = null;
        this.bookId = '';
        this.bookData = null;
        this.steamId = '';
        this.gameData = null;
    },
    
    /**
     * Récupère les données de métadonnées actuelles selon le type de média
     * @returns {Object|null}
     */
    getCurrentMetadata() {
        switch (this.mediaType) {
            case MEDIA_TYPES.EBOOK:
                return this.bookData;
            case MEDIA_TYPES.GAME:
                return this.gameData;
            default:
                return this.tmdbData;
        }
    },
    
    /**
     * Récupère l'ID de métadonnées actuel selon le type de média
     * @returns {string}
     */
    getCurrentMetadataId() {
        switch (this.mediaType) {
            case MEDIA_TYPES.EBOOK:
                return this.bookId;
            case MEDIA_TYPES.GAME:
                return this.steamId;
            default:
                return this.tmdbId;
        }
    },
    
    /**
     * Définit les données de métadonnées selon le type de média
     * @param {string} id 
     * @param {Object} data 
     */
    setMetadata(id, data) {
        this.metadataId = id;
        this.metadataData = data;
        
        switch (this.mediaType) {
            case MEDIA_TYPES.EBOOK:
                this.bookId = id;
                this.bookData = data;
                break;
            case MEDIA_TYPES.GAME:
                this.steamId = id;
                this.gameData = data;
                break;
            default:
                this.tmdbId = id;
                this.tmdbData = data;
        }
    }
};

// Export pour utilisation dans d'autres modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AppState };
}
