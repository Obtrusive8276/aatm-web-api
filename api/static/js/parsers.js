/**
 * AATM - Parsers
 * Fonctions de parsing MediaInfo et noms de release
 */

/**
 * Parse les informations MediaInfo JSON
 * @param {Object} mediainfoJson - Données MediaInfo au format JSON
 * @returns {Object} Informations parsées
 */
function parseMediaInfo(mediainfoJson) {
    const info = {};
    
    // Si c'est une ancienne réponse texte, retourner vide
    if (typeof mediainfoJson === 'string') {
        console.warn('Received text MediaInfo instead of JSON, falling back to empty info');
        return info;
    }
    
    // Accéder aux tracks
    const tracks = mediainfoJson.media?.track || [];
    
    // Track général (General)
    const generalTrack = tracks.find(t => t['@type'] === 'General');
    
    // Track vidéo
    const videoTrack = tracks.find(t => t['@type'] === 'Video');
    if (videoTrack) {
        // Container depuis le track général
        if (generalTrack?.Format) {
            const fmt = generalTrack.Format;
            if (fmt.includes('Matroska')) info.container = 'MKV';
            else if (fmt.includes('MPEG-4')) info.container = 'MP4';
            else if (fmt.includes('AVI')) info.container = 'AVI';
            else info.container = fmt;
        }
        
        // Résolution depuis largeur ET hauteur
        const width = parseInt(videoTrack.Width) || 0;
        const height = parseInt(videoTrack.Height) || 0;
        
        if (width >= 3840 || height >= 2100) info.resolution = '2160p';
        else if (width >= 1920 || height >= 1000) info.resolution = '1080p';
        else if (width >= 1280 || height >= 700) info.resolution = '720p';
        else if (width > 0 || height > 0) info.resolution = '480p';
        
        // Codec vidéo
        const format = videoTrack.Format || '';
        const encodedLib = videoTrack.Encoded_Library || '';
        
        if (encodedLib.includes('x265') || format === 'HEVC') {
            info.codec = 'x265';
        } else if (encodedLib.includes('x264') || format === 'AVC') {
            info.codec = 'x264';
        } else if (format === 'AV1') {
            info.codec = 'AV1';
        } else if (format) {
            info.codec = format;
        }
        
        // Bitrate vidéo
        if (videoTrack.BitRate) {
            const br = parseInt(videoTrack.BitRate);
            if (br >= 1000000) {
                info.videoBitrate = (br / 1000000).toFixed(1) + ' Mb/s';
            } else if (br >= 1000) {
                info.videoBitrate = (br / 1000).toFixed(0) + ' kb/s';
            }
        }
        
        // HDR
        const hdr = [];
        if (videoTrack.HDR_Format) {
            const hdrFmt = videoTrack.HDR_Format;
            if (hdrFmt.includes('HDR10+')) hdr.push('HDR10+');
            else if (hdrFmt.includes('HDR10')) hdr.push('HDR10');
            else if (hdrFmt.includes('HDR')) hdr.push('HDR');
            
            if (hdrFmt.includes('Dolby Vision') || videoTrack.HDR_Format_Compatibility?.includes('HDR10')) {
                hdr.push('DV');
            }
        }
        if (videoTrack.transfer_characteristics?.includes('HLG')) {
            hdr.push('HLG');
        }
        if (hdr.length > 0) info.hdr = hdr;
    }
    
    // Tracks audio
    const audioTracks = tracks.filter(t => t['@type'] === 'Audio');
    if (audioTracks.length > 0) {
        const audioTrackData = [];
        const audioLanguages = [];
        const audioCodecsSet = new Set();
        
        audioTracks.forEach(track => {
            // Langue
            const lang = normalizeLang(track.Language || track.Title || 'Unknown');
            audioLanguages.push(lang);
            
            // Codec audio
            let codec = track.Format || '';
            const commercial = track.Format_Commercial || '';
            
            // Normaliser le codec
            if (codec.includes('E-AC-3') || codec.includes('EAC3')) codec = 'EAC3';
            else if (codec.includes('AC-3') || codec === 'AC3') codec = 'AC3';
            else if (codec.includes('DTS')) {
                if (commercial.includes('DTS:X')) codec = 'DTS:X';
                else if (codec.includes('DTS-HD MA')) codec = 'DTS-HD MA';
                else if (codec.includes('DTS-HD')) codec = 'DTS-HD';
                else codec = 'DTS';
            } else if (codec.includes('MLP') || codec.includes('TrueHD')) codec = 'TrueHD';
            else if (codec.includes('AAC')) codec = 'AAC';
            else if (codec.includes('FLAC')) codec = 'FLAC';
            else if (codec.includes('Opus')) codec = 'Opus';
            
            // Détecter Atmos
            if (commercial.includes('Atmos') || track.Format_AdditionalFeatures?.includes('Atmos')) {
                if (codec === 'TrueHD') codec = 'TrueHD Atmos';
                else if (codec === 'EAC3') codec = 'E-AC3 Atmos';
                else codec = codec + ' Atmos';
            }
            
            audioCodecsSet.add(codec);
            
            // Canaux
            let channels = '';
            const ch = parseInt(track.Channels) || 0;
            if (ch >= 8) channels = '7.1';
            else if (ch >= 6) channels = '5.1';
            else if (ch >= 2) channels = '2.0';
            else if (ch === 1) channels = '1.0';
            
            // Bitrate
            let bitrate = '';
            if (track.BitRate) {
                const br = parseInt(track.BitRate);
                if (br >= 1000000) bitrate = (br / 1000000).toFixed(0) + ' Mb/s';
                else if (br >= 1000) bitrate = (br / 1000).toFixed(0) + ' kb/s';
            }
            
            audioTrackData.push({
                language: lang,
                codec: codec + (commercial && !codec.includes(commercial) ? ' (' + commercial + ')' : ''),
                channels: channels,
                bitrate: bitrate
            });
        });
        
        info.audioTracks = audioTrackData;
        info.audioLanguages = audioLanguages;
        info.detectedLanguages = audioLanguages;
        info.audioCodecs = Array.from(audioCodecsSet);
        
        // Déterminer la langue générale
        const hasFrench = audioLanguages.some(l => l.toLowerCase().includes('français') || l.toLowerCase().includes('vff') || l.toLowerCase().includes('vfq'));
        const hasNonFrench = audioLanguages.some(l => !l.toLowerCase().includes('français') && !l.toLowerCase().includes('vff') && !l.toLowerCase().includes('vfq'));
        
        if (hasFrench && hasNonFrench) info.language = 'MULTi';
        else if (hasFrench) info.language = 'FRENCH';
    }
    
    // Tracks sous-titres
    const subtitleTracks = tracks.filter(t => t['@type'] === 'Text');
    if (subtitleTracks.length > 0) {
        const subtitles = [];
        
        subtitleTracks.forEach(track => {
            const lang = normalizeLang(track.Language || 'Unknown');
            const title = track.Title || '';
            const format = track.Format || '';
            
            let subType = '';
            if (title.toLowerCase().includes('forced') || track.Forced === 'Yes') subType = 'Forcés';
            else if (title.toLowerCase().includes('sdh')) subType = 'SDH';
            else if (title.toLowerCase().includes('full')) subType = 'Complet';
            
            let subFormat = '';
            if (format.includes('UTF-8') || format.includes('SubRip') || format.includes('ASS') || format.includes('SSA')) {
                subFormat = 'SRT';
            } else if (format.includes('PGS') || format.includes('HDMV')) {
                subFormat = 'PGS';
            }
            
            let suffix = '';
            if (subType && subFormat) suffix = ' (' + subType + ' ' + subFormat + ')';
            else if (subType) suffix = ' (' + subType + ')';
            else if (subFormat) suffix = ' (' + subFormat + ')';
            
            subtitles.push(lang + suffix);
        });
        
        info.subtitleLanguages = subtitles;
    }
    
    return info;
}

/**
 * Parse un nom de release pour en extraire les informations
 * @param {string} name - Nom du fichier/dossier
 * @param {Object} nfoContent - Contenu MediaInfo JSON (optionnel)
 * @returns {Object} Informations parsées
 */
function parseReleaseName(name, nfoContent = '') {
    const info = {};
    let cleanName = name.trim();

    // Retirer l'extension vidéo pour le parsing
    cleanName = cleanName.replace(/\.(mkv|mp4|avi|iso)$/i, '');

    // Extraire le groupe de release (après le dernier tiret)
    const groupMatch = cleanName.match(/-([a-zA-Z0-9\[\]]+)$/);
    if (groupMatch) {
        const potentialGroup = groupMatch[1];
        // Ne pas considérer comme groupe si c'est une résolution
        if (!/^(2160|1080|720|576|480|4320)p$/i.test(potentialGroup)) {
            info.releaseGroup = potentialGroup;
        }
    }

    const patterns = {
        year: /\b(19|20)\d{2}\b/g,
        season: /\b(?:S|Season)\s?(\d{1,2})\b|\b(Complete|Integrale)\b/gi,
        episode: /\b(?:E|Episode)\s?(\d{1,3})\b/gi,
        seasonEpisode: /\bS(\d{1,2})E(\d{1,3})\b/gi,
        source: /\b(Bluray|BluRay|BDRip|BRRip|WEBRip|WebRip|WEB-DL|WEBDL|WEB|HDTV|DVDRip)\b/gi,
        vostfr: /(?:^|[\.\s\-])VOSTFR(?:[\.\s\-]|$)/i,
        ebookFormat: /\.(epub|pdf|mobi|azw3?|cbr|cbz)$/i
    };

    let firstTagIndex = cleanName.length;

    // Détecter le format ebook depuis l'extension
    const ebookMatch = patterns.ebookFormat.exec(cleanName);
    if (ebookMatch) {
        info.container = ebookMatch[1].toUpperCase();
        cleanName = cleanName.replace(patterns.ebookFormat, '');
    }

    const yearMatch = patterns.year.exec(cleanName);
    if (yearMatch) { 
        info.year = yearMatch[0]; 
        if (yearMatch.index < firstTagIndex) firstTagIndex = yearMatch.index; 
    }

    patterns.seasonEpisode.lastIndex = 0;
    const sxeMatch = patterns.seasonEpisode.exec(cleanName);
    if (sxeMatch) {
        info.season = "S" + sxeMatch[1].padStart(2, '0');
        info.episode = "E" + sxeMatch[2].padStart(2, '0');
        if (sxeMatch.index < firstTagIndex) firstTagIndex = sxeMatch.index;
    } else {
        patterns.season.lastIndex = 0;
        const seasonMatch = patterns.season.exec(cleanName);
        if (seasonMatch) {
            info.season = seasonMatch[2] ? seasonMatch[2].toUpperCase() : "S" + seasonMatch[1].padStart(2, '0');
            if (seasonMatch.index < firstTagIndex) firstTagIndex = seasonMatch.index;
        }
        patterns.episode.lastIndex = 0;
        const epMatch = patterns.episode.exec(cleanName);
        if (epMatch) { 
            info.episode = "E" + epMatch[1].padStart(2, '0'); 
            if (epMatch.index < firstTagIndex) firstTagIndex = epMatch.index; 
        }
    }

    patterns.source.lastIndex = 0;
    const sourceMatch = patterns.source.exec(cleanName);
    if (sourceMatch) { 
        info.source = sourceMatch[0]; 
        if (sourceMatch.index < firstTagIndex) firstTagIndex = sourceMatch.index; 
    }

    let potentialTitle = cleanName.substring(0, firstTagIndex)
        .replace(/\./g, ' ')
        .replace(/_/g, ' ')
        .replace(/[-()]+$/, '')
        .trim();
    if (potentialTitle) info.title = potentialTitle;

    // Si nfoContent est fourni et est un objet (JSON MediaInfo), le parser
    if (nfoContent && typeof nfoContent === 'object') {
        const nfoInfo = parseMediaInfo(nfoContent);
        Object.assign(info, nfoInfo);
    }

    // Détecter VOSTFR depuis le nom du fichier
    const vostfrMatch = patterns.vostfr.exec(name);
    if (vostfrMatch) {
        info.isVOSTFR = true;
    }

    return info;
}

// Export pour utilisation dans d'autres modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        parseMediaInfo,
        parseReleaseName
    };
}
