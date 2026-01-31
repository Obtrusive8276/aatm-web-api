/**
 * AATM - Film Class
 * Représente un film (movie)
 */

// Patch Film.js pour Node.js : injecte Media dans le scope global si besoin
if (typeof global !== 'undefined' && !global.Media) {
  const { Media } = require('./Media');
  global.Media = Media;
}

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
    
    async getAutoTags() {
        // Fetch and cache tag list if not already cached
        if (!window.LaCaleTagCache) {
            window.LaCaleTagCache = await ApiClient.getAllLaCaleTags({ mediaType: this.type });
        }
        const tagCache = window.LaCaleTagCache;
        const tags = [];

        // Helper: find tag ID by name (case-insensitive, accent-insensitive)
        function findTagIdByName(name, category = null) {
            if (!name) return null;
            const norm = s => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
            const aliases = {
                'x264': ['avc/h264/x264', 'avc', 'h264'],
                'ac3': ['ac3', 'dolby digital'],
                'francais': ['french', 'français', 'fr'],
                'french': ['francais', 'français', 'fr'],
                'anglais': ['english', 'en'],
                'english': ['anglais', 'en'],
                'web-dl': ['web-dl', 'webdl'],
                'vff': ['vff'],
                'vfq': ['vfq'],
                'multi': ['multi'],
                '1080p': ['1080p (full hd)', '1080p'],
                '2160p': ['2160p (4k)', '2160p', '4k'],
                '720p': ['720p (hd)', '720p'],
                'sd': ['sd'],
                'remux': ['remux'],
                'bluray': ['bluray', 'blu-ray'],
                'mkv': ['mkv'],
                'mp4': ['mp4'],
                'avi': ['avi'],
                'iso': ['iso'],
                'autres': ['autres', 'autres extensions', 'autres sous-titres', 'autres audio'],
            };
            const categoryVariants = {
                'Source': ['Source', 'Source / Type'],
                'Source / Type': ['Source', 'Source / Type'],
                'Langue audio': ['Langue audio', 'Langues audio'],
                'Langues audio': ['Langue audio', 'Langues audio'],
                'Codec vidéo': ['Codec vidéo'],
                'Codec audio': ['Codec audio'],
                'Extension': ['Extension', 'Extensions'],
                'Sous-titres': ['Sous-titres', 'Sous titres'],
                'Résolution': ['Résolution', 'Qualité / Résolution'],
                'Qualité / Résolution': ['Résolution', 'Qualité / Résolution'],
                'Genre': ['Genre', 'Genres'],
                'HDR': ['HDR', 'Caractéristiques vidéo'],
                'Caractéristiques vidéo': ['HDR', 'Caractéristiques vidéo'],
                'Type': ['Type'],
            };
            const normName = norm(name);
            // 1. Recherche stricte et alias dans la catégorie cible (et variantes)
            let cats = tagCache.categories;
            if (category && categoryVariants[category]) {
                cats = cats.filter(cat => categoryVariants[category].some(v => norm(cat.name) === norm(v)));
            } else if (category) {
                cats = cats.filter(cat => norm(cat.name) === norm(category));
            }
            for (const cat of cats) {
                for (const tag of cat.tags) {
                    if (norm(tag.name) === normName) return tag.id;
                    if (aliases[normName] && aliases[normName].some(alias => norm(tag.name).includes(norm(alias)))) return tag.id;
                }
            }
            // 2. Recherche partielle dans la catégorie cible
            for (const cat of cats) {
                for (const tag of cat.tags) {
                    if (norm(tag.name).includes(normName)) return tag.id;
                }
            }
            // 3. Fallback : recherche stricte, alias et partielle sur toutes les catégories
            for (const cat of tagCache.categories) {
                for (const tag of cat.tags) {
                    if (norm(tag.name) === normName) return tag.id;
                    if (aliases[normName] && aliases[normName].some(alias => norm(tag.name).includes(norm(alias)))) return tag.id;
                    if (norm(tag.name).includes(normName)) return tag.id;
                }
            }
            return null;
        }

        // Type: Film
        tags.push(findTagIdByName('Film', 'Type'));

        // Résolution
        if (this.resolution) {
            const resId = findTagIdByName(this.resolution, 'Résolution');
            if (resId) tags.push(resId);
        }

        // Source
        if (this.source) {
            const srcId = findTagIdByName(this.source, 'Source');
            if (srcId) tags.push(srcId);
        }

        // Codec vidéo
        if (this.codec) {
            const codecId = findTagIdByName(this.codec, 'Codec vidéo');
            if (codecId) tags.push(codecId);
        }

        // HDR, 3D, IMAX
        if (this.hdr && this.hdr.length > 0) {
            this.hdr.forEach(h => {
                const hdrId = findTagIdByName(h, 'HDR');
                if (hdrId) tags.push(hdrId);
            });
        }
        if (this.threeD) {
            const threeDId = findTagIdByName('3D', 'HDR');
            if (threeDId) tags.push(threeDId);
        }
        if (this.imax) {
            const imaxId = findTagIdByName('IMAX', 'HDR');
            if (imaxId) tags.push(imaxId);
        }

        // Codec audio
        if (this.audioCodecs && this.audioCodecs.length > 0) {
            this.audioCodecs.forEach(c => {
                const audioId = findTagIdByName(c, 'Codec audio');
                if (audioId) tags.push(audioId);
            });
        }

        // Langues audio
        if (this.audioLanguages && this.audioLanguages.length > 0) {
            this.audioLanguages.forEach(l => {
                const langId = findTagIdByName(l, 'Langue audio');
                if (langId) tags.push(langId);
            });
        }

        // Sous-titres
        if (this.subtitles && this.subtitles.length > 0) {
            this.subtitles.forEach(s => {
                const subId = findTagIdByName(s, 'Sous-titres');
                if (subId) tags.push(subId);
            });
        }

        // Extension
        let ext = this.extension;
        if (!ext && this.container) ext = this.container;
        if (!ext && this.path) {
            const match = this.path.match(/\.([a-z0-9]+)$/i);
            if (match) ext = match[1];
        }
        if (ext) {
            const extId = findTagIdByName(ext, 'Extension');
            if (extId) tags.push(extId);
        }

        // Genres (recherche stricte/alias uniquement, pas de fallback partiel)
        if (this.genres && this.genres.length > 0) {
            // Cas spécial Téléfilm : ne sélectionner que si le seul genre est Téléfilm (ou alias strict)
            const norm = s => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
            const aliases = {
                'sf': ['science-fiction', 'sci-fi'],
                'comedy': ['comédie', 'comedy'],
                'telefilm': ['téléfilm', 'telefilm'],
                // Ajoute d'autres alias si besoin
            };
            const normGenres = this.genres.map(g => norm(g));
            // Si Téléfilm présent, il doit être le seul genre pour être tagué
            if (normGenres.length === 1 && (normGenres[0] === 'téléfilm' || normGenres[0] === 'telefilm')) {
                // Recherche stricte Téléfilm
                let genreId = null;
                let cats = tagCache.categories.filter(cat => ['genre', 'genres'].includes(norm(cat.name)));
                for (const cat of cats) {
                    for (const tag of cat.tags) {
                        if (norm(tag.name) === 'téléfilm' || norm(tag.name) === 'telefilm') genreId = tag.id;
                        if (!genreId && aliases['telefilm'].some(alias => norm(tag.name) === norm(alias))) genreId = tag.id;
                        if (genreId) break;
                    }
                    if (genreId) break;
                }
                if (genreId) tags.push(genreId);
            } else {
                // Pour tous les autres genres, on ne tague JAMAIS Téléfilm même si présent dans la liste
                this.genres.forEach(genre => {
                    const normGenre = norm(genre);
                    if (normGenre === 'téléfilm' || normGenre === 'telefilm') return; // skip Téléfilm si d'autres genres
                    let genreId = null;
                    let cats = tagCache.categories.filter(cat => ['genre', 'genres'].includes(norm(cat.name)));
                    for (const cat of cats) {
                        for (const tag of cat.tags) {
                            if (norm(tag.name) === normGenre) genreId = tag.id;
                            if (!genreId && aliases[normGenre] && aliases[normGenre].some(alias => norm(tag.name) === norm(alias))) genreId = tag.id;
                            if (genreId) break;
                        }
                        if (genreId) break;
                    }
                    if (genreId) tags.push(genreId);
                });
            }
        }

        // Fallback: return unique tags
        return [...new Set(tags.filter(Boolean))];
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
