/**
 * AATM - MediaFactory
 * Factory pour créer le bon type de média selon le contexte
 */

const MediaFactory = {
    /**
     * Crée un objet Media approprié en analysant le chemin et les données
     * @param {Object} options - Options de création
     * @param {string} options.path - Chemin du fichier/dossier
     * @param {boolean} options.isDirectory - Est-ce un dossier
     * @param {Object} options.releaseInfo - Infos parsées du nom de fichier
     * @param {Object} options.mediaInfo - Infos MediaInfo parsées
     * @param {Object} options.directoryAnalysis - Résultat de l'analyse du répertoire
     * @param {string} options.forcedType - Type forcé par l'utilisateur ('movie', 'season', 'episode', 'ebook', 'game')
     * @returns {Film|Serie|null}
     */
    create(options = {}) {
        const {
            path = '',
            isDirectory = false,
            releaseInfo = {},
            mediaInfo = {},
            directoryAnalysis = null,
            forcedType = null
        } = options;
        
        // Déterminer le type de média
        const detectedType = forcedType || this.detectType(path, releaseInfo, directoryAnalysis);
        
        // Créer l'objet approprié
        let media;
        
        switch (detectedType) {
            case 'movie':
                media = new Film({ path });
                break;
                
            case 'season':
            case 'episode':
                media = new Serie({ path });
                media.isPack = (detectedType === 'season');
                break;
                
            // TODO: Ajouter Game et Ebook quand implémentés
            // case 'game':
            //     media = new Game({ path });
            //     break;
            // case 'ebook':
            //     media = new Ebook({ path });
            //     break;
                
            default:
                // Par défaut, créer un Film
                media = new Film({ path });
        }
        
        // Appliquer les infos de release (titre, année, source, etc.)
        if (releaseInfo && Object.keys(releaseInfo).length > 0) {
            media.applyReleaseInfo(releaseInfo);
            
            // Pour les séries, extraire saison/épisode
            if (media instanceof Serie) {
                if (releaseInfo.season) media.season = releaseInfo.season;
                if (releaseInfo.episode) media.episode = releaseInfo.episode;
            }
        }
        
        // Appliquer les infos MediaInfo
        if (mediaInfo && Object.keys(mediaInfo).length > 0) {
            media.applyMediaInfo(mediaInfo);
        }
        
        // Appliquer l'analyse du répertoire pour les séries
        if (directoryAnalysis && media instanceof Serie) {
            media.applyDirectoryAnalysis(directoryAnalysis);
        }
        
        return media;
    },
    
    /**
     * Détecte le type de média en analysant le chemin et les infos
     * @param {string} path - Chemin du fichier/dossier
     * @param {Object} releaseInfo - Infos parsées
     * @param {Object} directoryAnalysis - Analyse du répertoire
     * @returns {string} 'movie', 'season', 'episode', 'ebook', 'game'
     */
    detectType(path, releaseInfo = {}, directoryAnalysis = null) {
        const pathLower = path.toLowerCase();
        const name = path.split(/[/\\]/).pop() || '';
        const nameLower = name.toLowerCase();
        
        // 1. Analyse du répertoire (plus fiable pour les packs)
        if (directoryAnalysis) {
            if (directoryAnalysis.isPack) {
                return 'season';
            }
            if (directoryAnalysis.episodeCount === 1) {
                // Un seul épisode, mais vérifions s'il y a des patterns série
                if (releaseInfo.season || releaseInfo.episode) {
                    return 'episode';
                }
            }
        }
        
        // 2. Patterns ebook
        const ebookPatterns = /\.(epub|pdf|mobi|azw3?|cbr|cbz)$/i;
        if (ebookPatterns.test(pathLower)) {
            return 'ebook';
        }
        
        // 3. Patterns jeu
        const gamePatterns = /(setup|install|crack|keygen|plaza|codex|skidrow|fitgirl|gog|drm.?free)/i;
        if (gamePatterns.test(nameLower)) {
            return 'game';
        }
        
        // 4. Patterns série (saison complète)
        const seasonPackPatterns = [
            /\bS\d{1,2}\b(?!E)/i,           // S01 sans E
            /\bSaison\s?\d{1,2}\b/i,         // Saison 01
            /\bSeason\s?\d{1,2}\b/i,         // Season 01
            /\bComplete\b/i,                  // Complete
            /\bIntegrale\b/i,                 // Intégrale
            /\bS\d{1,2}\.?COMPLETE\b/i       // S01.COMPLETE
        ];
        
        for (const pattern of seasonPackPatterns) {
            if (pattern.test(name)) {
                return 'season';
            }
        }
        
        // 5. Patterns série (épisode unique)
        const episodePatterns = [
            /\bS\d{1,2}E\d{1,3}\b/i,         // S01E01
            /\b\d{1,2}x\d{2,3}\b/i,          // 1x01
            /\bE\d{1,3}\b/i,                  // E01
            /Episode\s?\d{1,3}/i              // Episode 01
        ];
        
        for (const pattern of episodePatterns) {
            if (pattern.test(name)) {
                return 'episode';
            }
        }
        
        // 6. Infos de release
        if (releaseInfo.season && releaseInfo.episode) {
            return 'episode';
        }
        if (releaseInfo.season && !releaseInfo.episode) {
            return 'season';
        }
        
        // 7. Par défaut, c'est un film
        return 'movie';
    },
    
    /**
     * Crée un Film directement
     * @param {Object} options 
     * @returns {Film}
     */
    createFilm(options = {}) {
        const film = new Film(options);
        if (options.releaseInfo) film.applyReleaseInfo(options.releaseInfo);
        if (options.mediaInfo) film.applyMediaInfo(options.mediaInfo);
        if (options.tmdbData) film.applyTmdbData(options.tmdbData);
        return film;
    },
    
    /**
     * Crée une Serie directement
     * @param {Object} options 
     * @returns {Serie}
     */
    createSerie(options = {}) {
        const serie = new Serie(options);
        if (options.releaseInfo) {
            serie.applyReleaseInfo(options.releaseInfo);
            if (options.releaseInfo.season) serie.season = options.releaseInfo.season;
            if (options.releaseInfo.episode) serie.episode = options.releaseInfo.episode;
        }
        if (options.mediaInfo) serie.applyMediaInfo(options.mediaInfo);
        if (options.tmdbData) serie.applyTmdbData(options.tmdbData);
        if (options.directoryAnalysis) serie.applyDirectoryAnalysis(options.directoryAnalysis);
        return serie;
    },
    
    /**
     * Reconstruit un objet Media depuis un JSON (pour restaurer depuis le state)
     * @param {Object} json - Objet JSON sérialisé
     * @returns {Film|Serie|null}
     */
    fromJSON(json) {
        if (!json || !json.type) return null;
        
        switch (json.type) {
            case 'movie':
                const film = new Film(json);
                if (json.selectedTagIds) {
                    film.selectedTagIds = new Set(json.selectedTagIds);
                }
                return film;
                
            case 'season':
            case 'episode':
                const serie = new Serie(json);
                serie.isPack = (json.type === 'season');
                if (json.selectedTagIds) {
                    serie.selectedTagIds = new Set(json.selectedTagIds);
                }
                return serie;
                
            default:
                return null;
        }
    },
    
    /**
     * Retourne les types de média supportés
     * @returns {Array<{value: string, label: string}>}
     */
    getSupportedTypes() {
        return [
            { value: 'movie', label: 'Film' },
            { value: 'season', label: 'Série (Saison)' },
            { value: 'episode', label: 'Série (Épisode)' },
            // { value: 'ebook', label: 'Ebook' },
            // { value: 'game', label: 'Jeu' }
        ];
    }
};

// Export pour ES modules et Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { MediaFactory };
}
