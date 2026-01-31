/**
 * AATM - Release Name Generators
 * Génération des noms de release selon les règles La Cale
 */

/**
 * Normalise un titre pour les releases
 * @param {string} title - Titre à normaliser
 * @returns {string}
 */
function normalizeTitle(title) {
    if (!title) return '';
    // Supprimer les accents
    let normalized = title.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    // Remplacer les cédilles
    normalized = normalized.replace(/[çÇ]/g, m => m === 'ç' ? 'c' : 'C');
    // Remplacer les apostrophes par un point
    normalized = normalized.replace(/[''`]/g, '.');
    // Supprimer les caractères spéciaux interdits
    normalized = normalized.replace(/[,;}{[\]:]/g, '');
    // Remplacer les tirets par des points
    normalized = normalized.replace(/-/g, '.');
    // Première lettre de chaque mot en majuscule
    normalized = normalized.split(/\s+/).map(word => {
        if (word.length === 0) return '';
        if (word === word.toUpperCase() && word.length <= 4) return word;
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    }).join('.');
    // Nettoyer les points multiples
    normalized = normalized.replace(/\.{2,}/g, '.').replace(/^\.|\.$/g, '');
    return normalized;
}

/**
 * Détecte si le français est VFF ou VFQ
 * @param {string} releaseGroup - Groupe de release
 * @param {Array} tags - Tags
 * @returns {string}
 */
function detectFrenchVariant(releaseGroup, tags) {
    const searchText = (releaseGroup + ' ' + (tags || []).join(' ')).toUpperCase();
    
    if (searchText.includes('VFQ') || 
        searchText.includes('QUÉBEC') || 
        searchText.includes('QUEBEC') || 
        searchText.includes('CANADIAN') ||
        searchText.includes('CANADA') ||
        searchText.includes('QUEBECOIS') ||
        searchText.includes('QUÉBÉCOIS')) {
        return 'VFQ';
    }
    
    if (searchText.includes('VFF') || 
        searchText.includes('FRENCH') ||
        searchText.includes('FRANCE') ||
        searchText.includes('EUROPEAN')) {
        return 'VFF';
    }
    
    return 'VFF';
}

/**
 * Génère la partie langue du nom de release
 * @param {Object} info - Informations de release
 * @returns {Array} Parties à ajouter
 */
function generateLanguageParts(info) {
    const parts = [];
    
    if (info.isVOSTFR) {
        parts.push('VOSTFR');
        return parts;
    }
    
    if (info.audioLanguages && info.audioLanguages.length > 0) {
        const hasEnglish = info.audioLanguages.some(l => 
            l.toLowerCase() === 'anglais' || l.toLowerCase() === 'english' || l.toLowerCase() === 'en'
        );
        const hasVFF = info.audioLanguages.some(l => l.toLowerCase() === 'vff');
        const hasVFQ = info.audioLanguages.some(l => l.toLowerCase() === 'vfq');
        const hasFrench = info.audioLanguages.some(l => 
            l.toLowerCase().includes('français') || l.toLowerCase().includes('french')
        );
        
        const otherLanguages = info.audioLanguages.filter(l => {
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
            const frenchVariant = detectFrenchVariant(info.releaseGroup, info.tags);
            parts.push(frenchVariant.toUpperCase());
        } else if (otherLanguages.length > 1) {
            parts.push('MULTI');
        } else if (otherLanguages.length === 1) {
            parts.push(otherLanguages[0].toUpperCase());
        }
    } else if (info.language) {
        const lang = info.language.toUpperCase();
        parts.push(lang === 'MULTI' ? 'MULTi' : lang);
    }
    
    return parts;
}

/**
 * Génère la partie langue info du nom de release
 * @param {Object} info - Informations de release
 * @returns {Array} Parties à ajouter
 */
function generateLanguageInfoParts(info) {
    const parts = [];
    
    if (info.audioLanguages && info.audioLanguages.length > 0) {
        const hasVFF = info.audioLanguages.some(l => l.toLowerCase() === 'vff');
        const hasVFQ = info.audioLanguages.some(l => l.toLowerCase() === 'vfq');
        const otherLanguages = info.audioLanguages.filter(l => {
            const lower = l.toLowerCase();
            return lower !== 'vff' && lower !== 'vfq' && 
                   !lower.includes('français') && !lower.includes('french');
        });
        
        if ((hasVFF || hasVFQ) && otherLanguages.length > 0) {
            parts.push(hasVFQ ? 'VFQ' : 'TrueFrench');
        }
    }
    
    if (info.languageInfo) {
        parts.push(info.languageInfo.toUpperCase());
    }
    
    return parts;
}

/**
 * Génère la partie source du nom de release
 * @param {Object} info - Informations de release
 * @returns {string}
 */
function generateSourcePart(info) {
    const detectedSources = new Set();
    const allText = ((info.source || '') + ' ' + (info.releaseGroup || '') + ' ' + 
                     (info.tags || []).join(' ')).toUpperCase();
    
    const sourcePatterns = {
        'REMUX': /REMUX/,
        'WEB-DL': /WEB-DL|WEBDL/,
        'WEB': /^WEB$/,
        'WEBRip': /WEBRIP|WEB.RIP/,
        'HDTV': /HDTV/,
        'HDLight': /HDLIGHT/,
        '4KLight': /4KLIGHT/,
        'BluRay': /BLURAY|BLU-RAY|BDRIP|BRRIP/,
        'DVDRip': /DVDRIP|DVD-RIP/
    };
    
    for (const [sourceName, pattern] of Object.entries(sourcePatterns)) {
        if (pattern.test(allText)) {
            detectedSources.add(sourceName);
        }
    }
    
    if (info.source) {
        let source = info.source;
        const s = source.toLowerCase();
        if (s === 'web-dl' || s === 'webdl') source = 'WEB-DL';
        else if (s === 'webrip') source = 'WEBRip';
        else if (s === 'bluray' || s === 'blu-ray' || s === 'bdrip' || s === 'brrip') source = 'BluRay';
        else if (s === 'remux') source = 'REMUX';
        else if (s === 'hdlight') source = 'HDLight';
        else if (s === '4klight') source = '4KLight';
        else if (s === 'dvdrip') source = 'DVDRip';
        else if (s === 'hdtv') source = 'HDTV';
        detectedSources.add(source);
    }
    
    return detectedSources.size > 0 ? Array.from(detectedSources).join('.') : '';
}

/**
 * Génère la partie audio du nom de release
 * @param {Object} info - Informations de release
 * @returns {Array} Parties à ajouter
 */
function generateAudioParts(info) {
    const parts = [];
    
    if (info.audioCodecs && info.audioCodecs.length > 0) {
        const codecs = info.audioCodecs.map(c => {
            let codec = c.toUpperCase();
            if (codec === 'TRUEHD ATMOS' || codec.includes('TRUEHD')) codec = 'TrueHD';
            else if (codec === 'E-AC3 ATMOS' || codec === 'EAC3 ATMOS' || codec.includes('E-AC3')) codec = 'EAC3';
            else if (codec === 'DTS:X') codec = 'DTS:X';
            else if (codec.includes('DTS')) codec = 'DTS';
            return codec.replace(/\s+ATMOS/, '').replace(/\s+DTS:X/, '');
        });
        const uniqueCodecs = [...new Set(codecs)];
        parts.push(uniqueCodecs.join('.'));
    } else if (info.audio) {
        let audio = info.audio.toUpperCase();
        if (audio === 'DDP' || audio === 'E-AC-3') audio = 'EAC3';
        if (audio === 'DD' || audio === 'AC-3') audio = 'AC3';
        parts.push(audio);
    }

    if (info.audioChannels) {
        parts.push(info.audioChannels);
    }

    // Audio specs (Atmos, DTS:X)
    if (info.audioCodecs && info.audioCodecs.length > 0) {
        const audioSpecs = new Set();
        info.audioCodecs.forEach(c => {
            const lower = c.toLowerCase();
            if (lower.includes('atmos')) audioSpecs.add('Atmos');
            if (lower.includes('dts:x') || lower.includes('dtsx')) audioSpecs.add('DTS:X');
        });
        if (audioSpecs.size > 0) {
            parts.push(Array.from(audioSpecs).join('.'));
        }
    }
    
    if (info.audioSpec) {
        parts.push(info.audioSpec);
    }
    
    return parts;
}

/**
 * Génère un nom de release pour un film
 * @param {Object} info - Informations de release
 * @returns {string}
 */
function generateMovieReleaseName(info) {
    const parts = [];

    // 1. Titre (normalisé)
    if (info.title) parts.push(normalizeTitle(info.title));

    // 2. 3D (optionnel)
    if (info.threeD) parts.push('3D');
    if (info.threeDType) parts.push(info.threeDType);

    // 3. Année
    if (info.year) parts.push(info.year);

    // 4. Info (REPACK, PROPER, CUSTOM, etc.)
    if (info.info) parts.push(info.info.toUpperCase());

    // 5. Edition (UNRATED, DC, REMASTER, etc.)
    if (info.edition) parts.push(info.edition);

    // 6. iMAX
    if (info.imax) parts.push('iMAX');

    // 7. Langue
    parts.push(...generateLanguageParts(info));

    // 8. LangueInfo
    parts.push(...generateLanguageInfoParts(info));

    // 9. Dynamic (HDR, DV, etc.)
    if (info.hdr && info.hdr.length > 0) {
        const hdrOrder = ['HDR10+', 'HDR10', 'HDR', 'DV', 'HLG', 'SDR'];
        const sortedHdr = info.hdr
            .map(h => h.toUpperCase().replace('DOLBY VISION', 'DV'))
            .sort((a, b) => hdrOrder.indexOf(a) - hdrOrder.indexOf(b));
        parts.push(...sortedHdr);
    }

    // 10. Résolution
    if (info.resolution) {
        const res = info.resolution.toLowerCase();
        parts.push(res.endsWith('p') ? res : res + 'p');
    }

    // 11. Plateforme
    if (info.platform) parts.push(info.platform.toUpperCase());

    // 12. Source
    const sourcePart = generateSourcePart(info);
    if (sourcePart) parts.push(sourcePart);

    // 13. Audio
    parts.push(...generateAudioParts(info));

    // 14. Codec vidéo
    if (info.codec) {
        let codec = info.codec.toUpperCase();
        if (codec === 'H264' || codec === 'H.264' || codec === 'AVC') codec = 'x264';
        if (codec === 'H265' || codec === 'H.265' || codec === 'HEVC') codec = 'x265';
        parts.push(codec);
    }

    // 15. Team/ReleaseGroup
    const baseName = parts.join('.');
    const team = info.releaseGroup || 'NoTag';
    return `${baseName}-${team}`;
}

/**
 * Génère un nom de release pour une série
 * @param {Object} info - Informations de release
 * @param {string} mediaType - Type de média ('season' ou 'episode')
 * @returns {string}
 */
function generateSeriesReleaseName(info, mediaType) {
    const parts = [];

    // 1. Titre
    if (info.title) parts.push(normalizeTitle(info.title));

    // 2. 3D
    if (info.threeD) parts.push('3D');
    if (info.threeDType) parts.push(info.threeDType);

    // 3. Année
    if (info.year) parts.push(info.year);

    // 4. SaisonEpisode
    if (mediaType === 'season') {
        if (info.season) {
            if (info.season.toUpperCase() === 'COMPLETE' || info.season.toUpperCase() === 'INTEGRALE') {
                parts.push('COMPLETE');
            } else {
                parts.push(info.season.toUpperCase());
            }
        }
    } else {
        if (info.season && info.episode) {
            parts.push(`${info.season.toUpperCase()}${info.episode.toUpperCase()}`);
        } else if (info.episode) {
            parts.push(info.episode.toUpperCase());
        } else if (info.season) {
            parts.push(info.season.toUpperCase());
        }
    }

    // 5. Info
    if (info.info) parts.push(info.info.toUpperCase());

    // 6. Edition
    if (info.edition) parts.push(info.edition);

    // 7. iMAX
    if (info.imax) parts.push('iMAX');

    // 8. Langue
    parts.push(...generateLanguageParts(info));

    // 9. LangueInfo
    parts.push(...generateLanguageInfoParts(info));

    // 10. Dynamic (HDR, etc.)
    if (info.hdr && info.hdr.length > 0) {
        const hdrOrder = ['HDR10+', 'HDR10', 'HDR', 'DV', 'HLG', 'SDR'];
        const sortedHdr = info.hdr
            .map(h => h.toUpperCase().replace('DOLBY VISION', 'DV'))
            .sort((a, b) => hdrOrder.indexOf(a) - hdrOrder.indexOf(b));
        parts.push(...sortedHdr);
    }

    // 11. Résolution
    if (info.resolution) {
        const res = info.resolution.toLowerCase();
        parts.push(res.endsWith('p') ? res : res + 'p');
    }

    // 12. Plateforme
    if (info.platform) parts.push(info.platform.toUpperCase());

    // 13. Source
    const sourcePart = generateSourcePart(info);
    if (sourcePart) parts.push(sourcePart);

    // 14. Audio
    parts.push(...generateAudioParts(info));

    // 15. Codec vidéo
    if (info.codec) {
        let codec = info.codec.toUpperCase();
        if (codec === 'H264' || codec === 'H.264' || codec === 'AVC') codec = 'x264';
        if (codec === 'H265' || codec === 'H.265' || codec === 'HEVC') codec = 'x265';
        parts.push(codec);
    }

    // 16. Team/ReleaseGroup
    const baseName = parts.join('.');
    const team = info.releaseGroup || 'NoTag';
    return `${baseName}-${team}`;
}

/**
 * Génère un nom de release selon le type de média
 * @param {Object} info - Informations de release
 * @param {string} mediaType - Type de média
 * @returns {string}
 */
function generateReleaseName(info, mediaType) {
    if (mediaType === 'movie') {
        return generateMovieReleaseName(info);
    } else if (mediaType === 'season' || mediaType === 'episode') {
        return generateSeriesReleaseName(info, mediaType);
    }
    return info.title || '';
}

// Export pour utilisation dans d'autres modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        normalizeTitle,
        detectFrenchVariant,
        generateReleaseName,
        generateMovieReleaseName,
        generateSeriesReleaseName
    };
}
