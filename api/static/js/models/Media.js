/**
 * AATM - Media Base Class
 * Classe abstraite représentant un média (film, série, jeu, ebook)
 */

class Media {
    /**
     * @param {Object} options - Options de construction
     * @param {string} options.path - Chemin du fichier/dossier
     * @param {string} options.title - Titre du média
     * @param {string} options.year - Année de sortie
     */
    constructor(options = {}) {
        if (new.target === Media) {
            throw new Error('Media est une classe abstraite, utilisez Film, Serie, etc.');
        }
        
        // Identité
        this.path = options.path || '';
        this.title = options.title || '';
        this.year = options.year || '';
        
        // Technique (depuis MediaInfo)
        this.resolution = options.resolution || '';
        this.codec = options.codec || '';
        this.container = options.container || '';
        this.hdr = options.hdr || [];
        
        // Audio
        this.audioCodecs = options.audioCodecs || [];
        this.audioChannels = options.audioChannels || '';
        this.audioLanguages = options.audioLanguages || [];
        this.audioTracks = options.audioTracks || [];
        
        // Sous-titres
        this.subtitleLanguages = options.subtitleLanguages || [];
        
        // Release
        this.source = options.source || '';
        this.releaseGroup = options.releaseGroup || '';
        this.edition = options.edition || '';
        this.info = options.info || ''; // REPACK, PROPER, etc.
        
        // Metadata externe (TMDB, IMDB, etc.)
        this.externalId = options.externalId || '';
        this.externalData = options.externalData || null;
        
        // Langue détectée
        this.language = options.language || '';
        this.isVOSTFR = options.isVOSTFR || false;
        
        // Options
        this.imax = options.imax || false;
        this.threeD = options.threeD || false;
        this.threeDType = options.threeDType || '';
        this.platform = options.platform || '';
        
        // Tags La Cale sélectionnés
        this.selectedTagIds = options.selectedTagIds || new Set();
    }
    
    /**
     * Type de média (à override)
     * @returns {string}
     */
    get type() {
        throw new Error('La propriété type doit être implémentée');
    }
    
    /**
     * Génère le nom de release
     * @returns {string}
     */
    generateName() {
        throw new Error('generateName() doit être implémenté');
    }
    
    /**
     * Récupère les tags automatiques pour La Cale
     * @returns {Array<number>}
     */
    getAutoTags() {
        throw new Error('getAutoTags() doit être implémenté');
    }
    
    /**
     * Génère la présentation BBCode
     * @returns {string}
     */
    toPresentation() {
        throw new Error('toPresentation() doit être implémenté');
    }
    
    /**
     * Vérifie si le média a toutes les infos requises
     * @returns {boolean}
     */
    isComplete() {
        return !!(this.title && this.resolution);
    }
    
    /**
     * Liste les champs manquants
     * @returns {Array<string>}
     */
    getMissingFields() {
        const missing = [];
        if (!this.title) missing.push('titre');
        if (!this.resolution) missing.push('résolution');
        return missing;
    }
    
    /**
     * Normalise un titre pour les noms de release
     * @param {string} title 
     * @returns {string}
     */
    static normalizeTitle(title) {
        if (!title) return '';
        let normalized = title.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        normalized = normalized.replace(/[çÇ]/g, m => m === 'ç' ? 'c' : 'C');
        normalized = normalized.replace(/[''`]/g, '.');
        normalized = normalized.replace(/[,;}{[\]:]/g, '');
        normalized = normalized.replace(/-/g, '.');
        normalized = normalized.split(/\s+/).map(word => {
            if (word.length === 0) return '';
            if (word === word.toUpperCase() && word.length <= 4) return word;
            return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        }).join('.');
        normalized = normalized.replace(/\.{2,}/g, '.').replace(/^\.|\.$/g, '');
        return normalized;
    }
    
    /**
     * Génère les parties langue du nom
     * @returns {Array<string>}
     */
    getLanguageParts() {
        const parts = [];
        
        if (this.isVOSTFR) {
            parts.push('VOSTFR');
            return parts;
        }
        
        if (this.audioLanguages && this.audioLanguages.length > 0) {
            const hasEnglish = this.audioLanguages.some(l => 
                ['anglais', 'english', 'en'].includes(l.toLowerCase())
            );
            const hasVFF = this.audioLanguages.some(l => l.toLowerCase() === 'vff');
            const hasVFQ = this.audioLanguages.some(l => l.toLowerCase() === 'vfq');
            const hasFrench = this.audioLanguages.some(l => 
                l.toLowerCase().includes('français') || l.toLowerCase().includes('french')
            );
            
            const otherLanguages = this.audioLanguages.filter(l => {
                const lower = l.toLowerCase();
                return !['vff', 'vfq', 'français', 'french', 'anglais', 'english', 'en'].includes(lower);
            });

            if (hasEnglish && !hasVFF && !hasVFQ && !hasFrench && otherLanguages.length === 0) {
                parts.push('VOSTFR');
            } else if (hasEnglish && (hasVFQ || hasVFF) && otherLanguages.length === 0) {
                parts.push('MULTI');
            } else if (hasVFF && hasVFQ && !hasEnglish && !hasFrench && otherLanguages.length === 0) {
                parts.push('MULTI');
            } else if (hasVFF && !hasVFQ && !hasEnglish && !hasFrench && otherLanguages.length === 0) {
                parts.push('VFF');
            } else if (hasVFQ && !hasVFF && !hasEnglish && !hasFrench && otherLanguages.length === 0) {
                parts.push('VFQ');
            } else if (hasFrench && !hasVFF && !hasVFQ && otherLanguages.length > 0) {
                parts.push('MULTI');
            } else if (hasFrench && !hasVFF && !hasVFQ && otherLanguages.length === 0) {
                parts.push('VFF');
            } else if (otherLanguages.length > 1) {
                parts.push('MULTI');
            } else if (otherLanguages.length === 1) {
                parts.push(otherLanguages[0].toUpperCase());
            }
        } else if (this.language) {
            parts.push(this.language.toUpperCase() === 'MULTI' ? 'MULTi' : this.language.toUpperCase());
        }
        
        return parts;
    }
    
    /**
     * Génère les parties source du nom
     * @returns {string}
     */
    getSourcePart() {
        if (!this.source) return '';
        
        const s = this.source.toLowerCase();
        if (s === 'web-dl' || s === 'webdl') return 'WEB-DL';
        if (s === 'webrip') return 'WEBRip';
        if (s === 'bluray' || s === 'blu-ray' || s === 'bdrip' || s === 'brrip') return 'BluRay';
        if (s === 'remux') return 'REMUX';
        if (s === 'hdlight') return 'HDLight';
        if (s === '4klight') return '4KLight';
        if (s === 'dvdrip') return 'DVDRip';
        if (s === 'hdtv') return 'HDTV';
        return this.source;
    }
    
    /**
     * Génère les parties audio du nom
     * @returns {Array<string>}
     */
    getAudioParts() {
        const parts = [];
        
        if (this.audioCodecs && this.audioCodecs.length > 0) {
            const codecs = this.audioCodecs.map(c => {
                let codec = c.toUpperCase();
                if (codec.includes('TRUEHD')) return 'TrueHD';
                if (codec.includes('E-AC3') || codec.includes('EAC3')) return 'EAC3';
                if (codec === 'DTS:X') return 'DTS:X';
                if (codec.includes('DTS')) return 'DTS';
                return codec.replace(/\s+ATMOS/, '').replace(/\s+DTS:X/, '');
            });
            const uniqueCodecs = [...new Set(codecs)];
            parts.push(uniqueCodecs.join('.'));
        }

        if (this.audioChannels) {
            parts.push(this.audioChannels);
        }

        // Audio specs (Atmos, DTS:X)
        if (this.audioCodecs && this.audioCodecs.length > 0) {
            const audioSpecs = new Set();
            this.audioCodecs.forEach(c => {
                const lower = c.toLowerCase();
                if (lower.includes('atmos')) audioSpecs.add('Atmos');
                if (lower.includes('dts:x') || lower.includes('dtsx')) audioSpecs.add('DTS:X');
            });
            if (audioSpecs.size > 0) {
                parts.push(Array.from(audioSpecs).join('.'));
            }
        }
        
        return parts;
    }
    
    /**
     * Génère la partie codec du nom
     * @returns {string}
     */
    getCodecPart() {
        if (!this.codec) return '';
        let codec = this.codec.toUpperCase();
        if (codec === 'H264' || codec === 'H.264' || codec === 'AVC') return 'x264';
        if (codec === 'H265' || codec === 'H.265' || codec === 'HEVC') return 'x265';
        return codec;
    }
    
    /**
     * Génère les parties HDR du nom
     * @returns {Array<string>}
     */
    getHdrParts() {
        if (!this.hdr || this.hdr.length === 0) return [];
        const hdrOrder = ['HDR10+', 'HDR10', 'HDR', 'DV', 'HLG', 'SDR'];
        return this.hdr
            .map(h => h.toUpperCase().replace('DOLBY VISION', 'DV'))
            .sort((a, b) => hdrOrder.indexOf(a) - hdrOrder.indexOf(b));
    }
    
    /**
     * Génère la partie résolution du nom
     * @returns {string}
     */
    getResolutionPart() {
        if (!this.resolution) return '';
        const res = this.resolution.toLowerCase();
        return res.endsWith('p') ? res : res + 'p';
    }
    
    /**
     * Applique les données MediaInfo parsées
     * @param {Object} mediaInfo - Données MediaInfo JSON parsées
     */
    applyMediaInfo(mediaInfo) {
        if (mediaInfo.resolution) this.resolution = mediaInfo.resolution;
        if (mediaInfo.codec) this.codec = mediaInfo.codec;
        if (mediaInfo.container) this.container = mediaInfo.container;
        if (mediaInfo.hdr) this.hdr = mediaInfo.hdr;
        if (mediaInfo.audioCodecs) this.audioCodecs = mediaInfo.audioCodecs;
        if (mediaInfo.audioChannels) this.audioChannels = mediaInfo.audioChannels;
        if (mediaInfo.audioLanguages) this.audioLanguages = mediaInfo.audioLanguages;
        if (mediaInfo.audioTracks) this.audioTracks = mediaInfo.audioTracks;
        if (mediaInfo.subtitleLanguages) this.subtitleLanguages = mediaInfo.subtitleLanguages;
        if (mediaInfo.language) this.language = mediaInfo.language;
    }
    
    /**
     * Applique les données parsées du nom de fichier
     * @param {Object} releaseInfo - Données parsées du nom
     */
    applyReleaseInfo(releaseInfo) {
        if (releaseInfo.title) this.title = releaseInfo.title;
        if (releaseInfo.year) this.year = releaseInfo.year;
        if (releaseInfo.source) this.source = releaseInfo.source;
        if (releaseInfo.releaseGroup) this.releaseGroup = releaseInfo.releaseGroup;
        if (releaseInfo.edition) this.edition = releaseInfo.edition;
        if (releaseInfo.info) this.info = releaseInfo.info;
        if (releaseInfo.isVOSTFR) this.isVOSTFR = releaseInfo.isVOSTFR;
    }
    
    /**
     * Sérialise l'objet pour le state
     * @returns {Object}
     */
    toJSON() {
        return {
            type: this.type,
            path: this.path,
            title: this.title,
            year: this.year,
            resolution: this.resolution,
            codec: this.codec,
            container: this.container,
            hdr: this.hdr,
            audioCodecs: this.audioCodecs,
            audioChannels: this.audioChannels,
            audioLanguages: this.audioLanguages,
            audioTracks: this.audioTracks,
            subtitleLanguages: this.subtitleLanguages,
            source: this.source,
            releaseGroup: this.releaseGroup,
            edition: this.edition,
            info: this.info,
            externalId: this.externalId,
            externalData: this.externalData,
            language: this.language,
            isVOSTFR: this.isVOSTFR,
            imax: this.imax,
            threeD: this.threeD,
            threeDType: this.threeDType,
            platform: this.platform,
            selectedTagIds: Array.from(this.selectedTagIds)
        };
    }
}

// Export pour ES modules et Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Media };
}
