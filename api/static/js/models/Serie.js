/**
 * AATM - Serie Class
 * Représente une série TV (season ou episode)
 */

class Serie extends Media {
    /**
     * @param {Object} options - Options de construction
     */
    constructor(options = {}) {
        super(options);
        
        // Spécifique séries
        this.season = options.season || '';
        this.episode = options.episode || '';
        this.episodeTitle = options.episodeTitle || '';
        this.isPack = options.isPack || false;
        this.episodeCount = options.episodeCount || 0;
        this.isComplete = options.isComplete || false;
        
        // TMDB
        this.tmdbId = options.tmdbId || '';
        this.genres = options.genres || [];
        this.overview = options.overview || '';
        this.posterUrl = options.posterUrl || '';
        this.rating = options.rating || '';
        this.network = options.network || '';
        this.status = options.status || ''; // "Ended", "Returning Series", etc.
    }
    
    /**
     * @returns {string}
     */
    get type() {
        // Retourne 'season' pour un pack, 'episode' sinon
        return this.isPack ? 'season' : 'episode';
    }
    
    /**
     * Génère le nom de release selon les règles La Cale
     * @returns {string}
     */
    generateName() {
        const parts = [];

        // 1. Titre
        if (this.title) parts.push(Media.normalizeTitle(this.title));

        // 2. 3D
        if (this.threeD) parts.push('3D');
        if (this.threeDType) parts.push(this.threeDType);

        // 3. Année
        if (this.year) parts.push(this.year);

        // 4. SaisonEpisode
        if (this.isPack) {
            // Pack saison
            if (this.isComplete) {
                parts.push('COMPLETE');
            } else if (this.season) {
                parts.push(this.formatSeason());
            }
        } else {
            // Episode unique
            if (this.season && this.episode) {
                parts.push(`${this.formatSeason()}${this.formatEpisode()}`);
            } else if (this.episode) {
                parts.push(this.formatEpisode());
            } else if (this.season) {
                parts.push(this.formatSeason());
            }
        }

        // 5. Info (REPACK, PROPER, etc.)
        if (this.info) parts.push(this.info.toUpperCase());

        // 6. Edition
        if (this.edition) parts.push(this.edition);

        // 7. iMAX
        if (this.imax) parts.push('iMAX');

        // 8. Langue
        parts.push(...this.getLanguageParts());

        // 9. Dynamic (HDR, etc.)
        parts.push(...this.getHdrParts());

        // 10. Résolution
        const resPart = this.getResolutionPart();
        if (resPart) parts.push(resPart);

        // 11. Plateforme
        if (this.platform) parts.push(this.platform.toUpperCase());

        // 12. Source
        const sourcePart = this.getSourcePart();
        if (sourcePart) parts.push(sourcePart);

        // 13. Audio
        parts.push(...this.getAudioParts());

        // 14. Codec vidéo
        const codecPart = this.getCodecPart();
        if (codecPart) parts.push(codecPart);

        // 15. Team/ReleaseGroup
        const baseName = parts.join('.');
        const team = this.releaseGroup || 'NoTag';
        return `${baseName}-${team}`;
    }
    
    /**
     * Formate le numéro de saison (S01, S02, etc.)
     * @returns {string}
     */
    formatSeason() {
        if (!this.season) return '';
        const s = this.season.toString().toUpperCase();
        if (s === 'COMPLETE' || s === 'INTEGRALE') return 'COMPLETE';
        if (s.startsWith('S')) return s.padStart(3, '0').replace(/^0+S/, 'S');
        return 'S' + s.padStart(2, '0');
    }
    
    /**
     * Formate le numéro d'épisode (E01, E02, etc.)
     * @returns {string}
     */
    formatEpisode() {
        if (!this.episode) return '';
        const e = this.episode.toString().toUpperCase();
        if (e.startsWith('E')) return e;
        return 'E' + e.padStart(2, '0');
    }
    
    /**
     * Récupère les tags automatiques pour La Cale
     * @returns {Array<number>}
     */
    getAutoTags() {
        const tags = [];
        
        // Type: Série
        tags.push(2); // ID pour "Série" dans tags_data.go
        
        // Pack saison
        if (this.isPack) {
            tags.push(6); // Pack saison
        }
        
        // Résolution
        const resMap = {
            '2160p': 5, '4k': 5,
            '1080p': 4,
            '720p': 3,
            '480p': 2
        };
        const resLower = (this.resolution || '').toLowerCase();
        if (resMap[resLower]) tags.push(resMap[resLower]);
        
        // Source
        const sourceMap = {
            'bluray': 10, 'blu-ray': 10,
            'remux': 11,
            'web-dl': 12, 'webdl': 12,
            'webrip': 13,
            'hdtv': 14
        };
        const srcLower = (this.source || '').toLowerCase();
        if (sourceMap[srcLower]) tags.push(sourceMap[srcLower]);
        
        // Langue
        if (this.isVOSTFR) {
            tags.push(20); // VOSTFR
        } else {
            const hasVFF = this.audioLanguages.some(l => l.toLowerCase() === 'vff' || l.toLowerCase().includes('français'));
            const hasMulti = this.audioLanguages.length > 1;
            if (hasMulti) tags.push(22); // MULTI
            else if (hasVFF) tags.push(21); // VFF
        }
        
        // HDR
        if (this.hdr && this.hdr.length > 0) {
            if (this.hdr.some(h => h.includes('DV') || h.includes('Dolby'))) tags.push(30);
            if (this.hdr.some(h => h.includes('HDR10+'))) tags.push(31);
            else if (this.hdr.some(h => h.includes('HDR'))) tags.push(32);
        }
        
        return tags;
    }
    
    /**
     * Génère la présentation BBCode
     * @param {number} totalSize - Taille totale en octets
     * @returns {string}
     */
    toPresentation(totalSize = 0) {
        const title = this.externalData?.name || this.title || "Unknown Title";
        const year = this.externalData?.first_air_date?.substring(0, 4) || this.year || "";
        const posterUrl = this.externalData?.poster_path 
            ? `https://image.tmdb.org/t/p/w500${this.externalData.poster_path}` 
            : this.posterUrl;
        const genres = (this.externalData?.genres || []).map(g => g.name).join(", ") || this.genres.join(", ") || "Non spécifié";
        const score = this.externalData?.vote_average 
            ? `${this.externalData.vote_average.toFixed(1)}/10` 
            : this.rating || "N/A";
        const overview = this.externalData?.overview || this.overview || "Aucune description disponible.";

        const size = totalSize ? this.formatSize(totalSize) : "Variable";
        const audioSection = this.formatAudioSection();
        const subsSection = this.formatSubtitlesSection();
        const resolution = this.resolution || "Non spécifié";
        const container = this.container || "MKV";
        const video = this.codec || "Non spécifié";
        const hdr = (this.hdr && this.hdr.length > 0) ? this.hdr.join(" / ") : "";
        
        // Info saison/épisode
        let seasonInfo = "";
        if (this.isPack) {
            seasonInfo = this.isComplete 
                ? "Série Complète" 
                : `Saison ${this.season?.replace(/^S0?/, '') || '?'}`;
            if (this.episodeCount > 0) {
                seasonInfo += ` (${this.episodeCount} épisodes)`;
            }
        } else if (this.season && this.episode) {
            seasonInfo = `Saison ${this.season.replace(/^S0?/, '')} - Épisode ${this.episode.replace(/^E0?/, '')}`;
        }

        return `[center]
[img]${posterUrl}[/img]

[size=6][color=#eab308][b]${title} (${year})[/b][/color][/size]
${seasonInfo ? `[size=4][b]${seasonInfo}[/b][/size]` : ''}

[b]Note :[/b] ${score}
[b]Genre :[/b] ${genres}

[quote]${overview}[/quote]

[color=#eab308][b]--- DÉTAILS ---[/b][/color]

[b]Qualité :[/b] ${resolution}${hdr ? ` ${hdr}` : ''}
[b]Format :[/b] ${container}
[b]Codec Vidéo :[/b] ${video}
[b]Audio :[/b]
${audioSection}
[b]Sous-titres :[/b]
${subsSection}
[b]Taille :[/b] ${size}


[i]Généré par AATM[/i]
[/center]`;
    }
    
    /**
     * Formate la section audio
     * @returns {string}
     */
    formatAudioSection() {
        if (this.audioTracks && this.audioTracks.length > 0) {
            return this.audioTracks.map(track => {
                let line = track.language;
                if (track.codec) line += ` : ${track.codec}`;
                if (track.channels) line += ` ${track.channels}`;
                if (track.bitrate) line += ` @ ${track.bitrate}`;
                return line;
            }).join("\n");
        } else if (this.audioLanguages && this.audioLanguages.length > 0) {
            return this.audioLanguages.join("\n");
        }
        return this.language || "Non spécifié";
    }
    
    /**
     * Formate la section sous-titres
     * @returns {string}
     */
    formatSubtitlesSection() {
        if (this.subtitleLanguages && this.subtitleLanguages.length > 0) {
            return this.subtitleLanguages.join("\n");
        }
        return "Aucun";
    }
    
    /**
     * Formate une taille
     * @param {number} bytes 
     * @returns {string}
     */
    formatSize(bytes) {
        if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(2) + ' GiB';
        if (bytes >= 1048576) return (bytes / 1048576).toFixed(2) + ' MiB';
        if (bytes >= 1024) return (bytes / 1024).toFixed(2) + ' KiB';
        return bytes + ' B';
    }
    
    /**
     * Vérifie si la série a toutes les infos requises
     * @returns {boolean}
     */
    isComplete() {
        const hasSeasonInfo = this.isPack ? !!this.season : !!(this.season && this.episode);
        return !!(this.title && this.resolution && hasSeasonInfo);
    }
    
    /**
     * Liste les champs manquants
     * @returns {Array<string>}
     */
    getMissingFields() {
        const missing = super.getMissingFields();
        if (!this.season) missing.push('saison');
        if (!this.isPack && !this.episode) missing.push('épisode');
        return missing;
    }
    
    /**
     * Applique les données TMDB
     * @param {Object} tmdbData - Données TMDB
     */
    applyTmdbData(tmdbData) {
        this.externalData = tmdbData;
        this.externalId = tmdbData.id?.toString() || '';
        this.tmdbId = tmdbData.id?.toString() || '';
        
        if (tmdbData.name && !this.title) this.title = tmdbData.name;
        if (tmdbData.first_air_date && !this.year) {
            this.year = tmdbData.first_air_date.substring(0, 4);
        }
        if (tmdbData.genres) {
            this.genres = tmdbData.genres.map(g => g.name);
        }
        if (tmdbData.overview) this.overview = tmdbData.overview;
        if (tmdbData.poster_path) {
            this.posterUrl = `https://image.tmdb.org/t/p/w500${tmdbData.poster_path}`;
        }
        if (tmdbData.vote_average) {
            this.rating = `${tmdbData.vote_average.toFixed(1)}/10`;
        }
        if (tmdbData.networks && tmdbData.networks.length > 0) {
            this.network = tmdbData.networks[0].name;
        }
        if (tmdbData.status) this.status = tmdbData.status;
        if (tmdbData.number_of_seasons) this.totalSeasons = tmdbData.number_of_seasons;
        if (tmdbData.number_of_episodes) this.totalEpisodes = tmdbData.number_of_episodes;
    }
    
    /**
     * Applique les données de l'analyse de répertoire
     * @param {Object} analysis - Résultat de analyzeDirectory
     */
    applyDirectoryAnalysis(analysis) {
        if (analysis.isPack !== undefined) this.isPack = analysis.isPack;
        if (analysis.episodeCount) this.episodeCount = analysis.episodeCount;
        if (analysis.season) this.season = analysis.season;
        if (analysis.isComplete) this.isComplete = analysis.isComplete;
    }
    
    /**
     * Sérialise l'objet
     * @returns {Object}
     */
    toJSON() {
        return {
            ...super.toJSON(),
            season: this.season,
            episode: this.episode,
            episodeTitle: this.episodeTitle,
            isPack: this.isPack,
            episodeCount: this.episodeCount,
            isComplete: this.isComplete,
            tmdbId: this.tmdbId,
            genres: this.genres,
            overview: this.overview,
            posterUrl: this.posterUrl,
            rating: this.rating,
            network: this.network,
            status: this.status
        };
    }
}

// Export pour ES modules et Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Serie };
}
