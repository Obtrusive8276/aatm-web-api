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
        this._season = options.season || '';
        this._episode = options.episode || '';
        this.episodeTitle = options.episodeTitle || '';
        this.episodeCount = options.episodeCount || 0;
        this.isComplete = options.isComplete || false;
        // TMDB
        this.tmdbId = options.tmdbId || '';
        this.genres = options.genres || [];
        this.overview = options.overview || '';
        this.posterUrl = options.posterUrl || '';
        this.rating = options.rating || '';
        this.network = options.network || '';
        this.status = options.status || '';
        // isPack dynamique
        if (options.isPack !== undefined) {
            this._isPack = options.isPack;
        } else {
            this._isPack = (this.episodeCount > 1) ? true : false;
        }
        this._updateIsPack();
    }

    get season() { return this._season; }
    set season(val) {
        this._season = val;
        this._updateIsPack();
    }
    get episode() { return this._episode; }
    set episode(val) {
        this._episode = val;
        this._updateIsPack();
    }
    get isPack() { return this._isPack; }
    set isPack(val) { this._isPack = val; }

    _updateIsPack() {
        // Si episode est défini, ce n'est pas un pack
        if (this._episode && String(this._episode).trim() !== '') {
            this._isPack = false;
        } else if (this.episodeCount > 1) {
            this._isPack = true;
        }
        // Sinon, ne change pas la valeur manuelle
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
                // Ajoute toujours la saison si connue
                if (this.season) {
                    parts.push(`${this.formatSeason()}${this.formatEpisode()}`);
                } else {
                    parts.push(this.formatEpisode());
                }
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
     * @returns {Promise<Array<string>>}
     */
    async getAutoTags() {
        // S'assurer que le cache est chargé
        if (!window.LaCaleTagCache) {
            try {
                window.LaCaleTagCache = await ApiClient.getAllLaCaleTags({ mediaType: this.type });
            } catch (e) {
                console.error('Erreur chargement tags:', e);
                return [];
            }
        }

        const tagCache = window.LaCaleTagCache;
        const tags = [];

        // Helper: mapping dynamique et robuste (comme Film.js)
        function findTagIdByName(name, category = null) {
            if (!name) return null;
            const norm = s => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
            const aliases = {
                'x264': ['avc/h264/x264', 'avc', 'h264'],
                'x265': ['hevc/h265/x265', 'hevc', 'h265'],
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

        // Type: Série
        const typeTag = findTagIdByName('Série', 'Type') || findTagIdByName('Serie', 'Type');
        if (typeTag) tags.push(typeTag);

        // Pack saison
        if (this.isPack) {
            const packTag = findTagIdByName('Pack Saison') || findTagIdByName('Saison');
            if (packTag) tags.push(packTag);
        }

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

        // HDR
        if (this.hdr && this.hdr.length > 0) {
            this.hdr.forEach(h => {
                const hdrId = findTagIdByName(h, 'HDR');
                if (hdrId) tags.push(hdrId);
            });
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

        // Langue (corrigée et priorisée, pour compatibilité BBCode)
        const langs = (this.audioLanguages || []).map(l => l.toLowerCase());
        const fileName = (this.path || '').toLowerCase();
        const hasFrench = langs.some(l => l.includes('français') || l === 'fr' || l === 'french');
        const hasVFQ = langs.some(l => l.includes('vfq')) || fileName.includes('vfq');
        const hasVFF = langs.some(l => l.includes('vff')) || fileName.includes('vff');
        const hasEnglish = langs.some(l => l.includes('anglais') || l === 'en' || l === 'english');
        const langCount = langs.length;

        if (this.isVOSTFR) {
            const t = findTagIdByName('VOSTFR');
            if (t) tags.push(t);
        } else if (hasVFQ) {
            const t = findTagIdByName('VFQ');
            if (t) tags.push(t);
        } else if (hasVFF) {
            const t = findTagIdByName('VFF');
            if (t) tags.push(t);
        } else if (langCount > 1) {
            const t = findTagIdByName('MULTI');
            if (t) tags.push(t);
            if (hasFrench) {
                const tf = findTagIdByName('French') || findTagIdByName('Français');
                if (tf) tags.push(tf);
            }
            if (hasEnglish) {
                const te = findTagIdByName('English') || findTagIdByName('Anglais');
                if (te) tags.push(te);
            }
        } else if (hasFrench) {
            const t = findTagIdByName('French') || findTagIdByName('Français');
            if (t) tags.push(t);
        } else if (hasEnglish) {
            const t = findTagIdByName('English') || findTagIdByName('Anglais');
            if (t) tags.push(t);
        }

        // Genres (recherche stricte/alias uniquement, pas de fallback partiel)
        if (this.genres && this.genres.length > 0) {
            const norm = s => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
            const aliases = {
                'sf': ['science-fiction', 'sci-fi'],
                'comedy': ['comédie', 'comedy'],
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
                        if (!genreId && ['téléfilm', 'telefilm'].some(alias => norm(tag.name) === norm(alias))) genreId = tag.id;
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

        return [...new Set(tags.filter(Boolean))];
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
