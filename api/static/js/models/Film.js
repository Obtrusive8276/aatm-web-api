/**
 * AATM - Film Class
 * Représente un film (movie)
 */

class Film extends Media {
    /**
     * @param {Object} options - Options de construction
     */
    constructor(options = {}) {
        super(options);
        
        // Spécifique films
        this.director = options.director || '';
        this.actors = options.actors || [];
        this.tmdbId = options.tmdbId || '';
        this.imdbId = options.imdbId || '';
        this.genres = options.genres || [];
        this.overview = options.overview || '';
        this.posterUrl = options.posterUrl || '';
        this.rating = options.rating || '';
    }
    
    /**
     * @returns {string}
     */
    get type() {
        return 'movie';
    }
    
    /**
     * Génère le nom de release selon les règles La Cale
     * @returns {string}
     */
    generateName() {
        const parts = [];

        // 1. Titre (normalisé)
        if (this.title) parts.push(Media.normalizeTitle(this.title));

        // 2. 3D (optionnel)
        if (this.threeD) parts.push('3D');
        if (this.threeDType) parts.push(this.threeDType);

        // 3. Année
        if (this.year) parts.push(this.year);

        // 4. Info (REPACK, PROPER, CUSTOM, etc.)
        if (this.info) parts.push(this.info.toUpperCase());

        // 5. Edition (UNRATED, DC, REMASTER, etc.)
        if (this.edition) parts.push(this.edition);

        // 6. iMAX
        if (this.imax) parts.push('iMAX');

        // 7. Langue
        parts.push(...this.getLanguageParts());

        // 8. Dynamic (HDR, DV, etc.)
        parts.push(...this.getHdrParts());

        // 9. Résolution
        const resPart = this.getResolutionPart();
        if (resPart) parts.push(resPart);

        // 10. Plateforme
        if (this.platform) parts.push(this.platform.toUpperCase());

        // 11. Source
        const sourcePart = this.getSourcePart();
        if (sourcePart) parts.push(sourcePart);

        // 12. Audio
        parts.push(...this.getAudioParts());

        // 13. Codec vidéo
        const codecPart = this.getCodecPart();
        if (codecPart) parts.push(codecPart);

        // 14. Team/ReleaseGroup
        const baseName = parts.join('.');
        const team = this.releaseGroup || 'NoTag';
        return `${baseName}-${team}`;
    }
    
    /**
     * Récupère les tags automatiques pour La Cale
     * @returns {Array<number>}
     */
    getAutoTags() {
        const tags = [];
        
        // Type: Film
        tags.push(1); // ID pour "Film" dans tags_data.go
        
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
            'hdtv': 14,
            'dvdrip': 15
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
            if (this.hdr.some(h => h.includes('DV') || h.includes('Dolby'))) tags.push(30); // Dolby Vision
            if (this.hdr.some(h => h.includes('HDR10+'))) tags.push(31); // HDR10+
            else if (this.hdr.some(h => h.includes('HDR'))) tags.push(32); // HDR
        }
        
        return tags;
    }
    
    /**
     * Génère la présentation BBCode
     * @param {number} totalSize - Taille totale en octets
     * @returns {string}
     */
    toPresentation(totalSize = 0) {
        const title = this.externalData?.title || this.title || "Unknown Title";
        const year = this.externalData?.release_date?.substring(0, 4) || this.year || "";
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

        return `[center]
[img]${posterUrl}[/img]

[size=6][color=#eab308][b]${title} (${year})[/b][/color][/size]

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
     * Formate la section audio pour la présentation
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
     * Formate la section sous-titres pour la présentation
     * @returns {string}
     */
    formatSubtitlesSection() {
        if (this.subtitleLanguages && this.subtitleLanguages.length > 0) {
            return this.subtitleLanguages.join("\n");
        }
        return "Aucun";
    }
    
    /**
     * Formate une taille en octets en format lisible
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
     * Vérifie si le film a toutes les infos requises
     * @returns {boolean}
     */
    isComplete() {
        return !!(this.title && this.year && this.resolution);
    }
    
    /**
     * Liste les champs manquants
     * @returns {Array<string>}
     */
    getMissingFields() {
        const missing = super.getMissingFields();
        if (!this.year) missing.push('année');
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
        
        if (tmdbData.title && !this.title) this.title = tmdbData.title;
        if (tmdbData.release_date && !this.year) {
            this.year = tmdbData.release_date.substring(0, 4);
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
        if (tmdbData.imdb_id) this.imdbId = tmdbData.imdb_id;
    }
    
    /**
     * Sérialise l'objet
     * @returns {Object}
     */
    toJSON() {
        return {
            ...super.toJSON(),
            director: this.director,
            actors: this.actors,
            tmdbId: this.tmdbId,
            imdbId: this.imdbId,
            genres: this.genres,
            overview: this.overview,
            posterUrl: this.posterUrl,
            rating: this.rating
        };
    }
}

// Export pour ES modules et Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Film };
}
