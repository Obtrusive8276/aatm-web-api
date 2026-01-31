/**
 * AATM - Presentation Generators
 * Génération des présentations NFO/BBCode
 */

/**
 * Génère une présentation pour un film/série
 * @param {Object} data - Données de présentation
 * @returns {Promise<string>}
 */
async function generatePresentation(data) {
    const { tmdbId, mediaType, releaseInfo, nfoContent, totalSize } = data;

    if (mediaType === 'ebook') {
        return generateEbookPresentation(data);
    }

    if (mediaType === 'game') {
        return generateGamePresentation(data);
    }

    const type = (mediaType === 'movie') ? 'movie' : 'tv';
    let tmdbData = {};

    try {
        tmdbData = await ApiClient.getTmdbDetails(type, tmdbId);
    } catch (e) { 
        console.error("TMDB fetch error:", e); 
    }

    const title = tmdbData.title || tmdbData.name || releaseInfo.title || "Unknown Title";
    const year = (tmdbData.release_date || tmdbData.first_air_date || "").substring(0, 4) || releaseInfo.year || "";
    const posterUrl = tmdbData.poster_path ? `https://image.tmdb.org/t/p/w500${tmdbData.poster_path}` : "";
    const genres = (tmdbData.genres || []).map(g => g.name).join(", ") || "Non spécifié";
    const score = tmdbData.vote_average ? `${tmdbData.vote_average.toFixed(3)}/10` : "N/A";
    const overview = tmdbData.overview || "Aucune description disponible.";

    let size = totalSize || "Variable";
    if (!totalSize && nfoContent) {
        const sizeMatch = nfoContent.match(/File\s*size\s*:\s*([0-9.]+\s*[KMGT]?i?B)/i);
        if (sizeMatch) size = sizeMatch[1];
    }

    const audioSection = formatAudioSection(releaseInfo);
    const subsSection = formatSubtitlesSection(releaseInfo);
    const resolution = releaseInfo.resolution || "Non spécifié";
    const container = releaseInfo.container || "MKV";
    const video = releaseInfo.codec || "Non spécifié";
    const videoBitrate = releaseInfo.videoBitrate || "";
    const hdr = (releaseInfo.hdr && releaseInfo.hdr.length > 0) ? releaseInfo.hdr.join(" / ") : "";

    return `[center]
[img]${posterUrl}[/img]

[size=6][color=#eab308][b]${title} (${year})[/b][/color][/size]

[b]Note :[/b] ${score}
[b]Genre :[/b] ${genres}

[quote]${overview}[/quote]

[color=#eab308][b]--- DÉTAILS ---[/b][/color]

[b]Qualité :[/b] ${resolution}${hdr ? ` ${hdr}` : ''}
[b]Format :[/b] ${container}
[b]Codec Vidéo :[/b] ${video}${videoBitrate ? ` @ ${videoBitrate}` : ''}
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
 * @param {Object} releaseInfo - Informations de release
 * @returns {string}
 */
function formatAudioSection(releaseInfo) {
    if (releaseInfo.audioTracks && releaseInfo.audioTracks.length > 0) {
        return releaseInfo.audioTracks.map(track => {
            let line = track.language;
            if (track.codec) line += ` : ${track.codec}`;
            if (track.channels) line += ` ${track.channels}`;
            if (track.bitrate) line += ` @ ${track.bitrate}`;
            return line;
        }).join("\n");
    } else if (releaseInfo.audioLanguages && releaseInfo.audioLanguages.length > 0) {
        const audio = releaseInfo.audio || "";
        const channels = releaseInfo.audioChannels || "";
        return releaseInfo.audioLanguages.map(lang => {
            let line = lang;
            if (audio) line += ` : ${audio}`;
            if (channels) line += ` ${channels}`;
            return line;
        }).join("\n");
    }
    return releaseInfo.language || "Non spécifié";
}

/**
 * Formate la section sous-titres pour la présentation
 * @param {Object} releaseInfo - Informations de release
 * @returns {string}
 */
function formatSubtitlesSection(releaseInfo) {
    if (releaseInfo.subtitleLanguages && releaseInfo.subtitleLanguages.length > 0) {
        return releaseInfo.subtitleLanguages.join("\n");
    }
    return "Aucun";
}

/**
 * Génère une présentation pour un ebook
 * @param {Object} data - Données de présentation
 * @returns {string}
 */
function generateEbookPresentation(data) {
    const { releaseInfo, totalSize } = data;
    const bookData = AppState.bookData || {};

    const title = bookData.title || releaseInfo.title || "Titre inconnu";
    const authors = (bookData.authors || []).join(", ") || "Auteur inconnu";
    const year = (bookData.publishedDate || "").substring(0, 4) || releaseInfo.year || "";
    const description = bookData.description || "Aucune description disponible.";
    const categories = (bookData.categories || []).join(", ") || "Non spécifié";
    const thumbnail = bookData.imageLinks?.thumbnail || bookData.imageLinks?.smallThumbnail || "";
    const pageCount = bookData.pageCount || "Non spécifié";
    const publisher = bookData.publisher || "Non spécifié";

    let format = "EPUB";
    if (releaseInfo.container) {
        format = releaseInfo.container.toUpperCase();
    }

    let size = totalSize || "Variable";

    let language = bookData.language || "Non spécifié";
    if (language === "fr") language = "Français";
    else if (language === "en") language = "Anglais";

    return `[center]
${thumbnail ? `[img]${thumbnail}[/img]` : ''}

[size=6][color=#eab308][b]${title}${year ? ' (' + year + ')' : ''}[/b][/color][/size]

[b]Auteur :[/b] ${authors}
[b]Genre :[/b] ${categories}

[quote]${description.replace(/<[^>]*>/g, '')}[/quote]

[color=#eab308][b]--- DÉTAILS ---[/b][/color]

[b]Editeur :[/b] ${publisher}
[b]Pages :[/b] ${pageCount}
[b]Format :[/b] ${format}
[b]Langue :[/b] ${language}
[b]Taille :[/b] ${size}


[i]Généré par AATM[/i]
[/center]`;
}

/**
 * Génère une présentation pour un jeu
 * @param {Object} data - Données de présentation
 * @returns {string}
 */
function generateGamePresentation(data) {
    const { releaseInfo, totalSize } = data;
    const gameData = AppState.gameData || {};

    const title = gameData.name || releaseInfo.title || "Titre inconnu";
    const description = gameData.short_description || gameData.detailed_description || "Aucune description disponible.";
    const genres = (gameData.genres || []).map(g => g.description).join(", ") || "Non spécifié";
    const releaseDate = gameData.release_date?.date || releaseInfo.year || "Non spécifié";
    const developers = (gameData.developers || []).join(", ") || "Non spécifié";
    const publishers = (gameData.publishers || []).join(", ") || "Non spécifié";
    const headerImage = gameData.header_image || "";
    const metacritic = gameData.metacritic?.score ? `${gameData.metacritic.score}/100` : "N/A";

    let size = totalSize || "Variable";

    let languages = "Non spécifié";
    if (gameData.supported_languages) {
        languages = gameData.supported_languages.replace(/<[^>]*>/g, '').substring(0, 100);
        if (gameData.supported_languages.length > 100) languages += '...';
    }

    return `[center]
${headerImage ? `[img]${headerImage}[/img]` : ''}

[size=6][color=#eab308][b]${title}[/b][/color][/size]

[b]Date de sortie :[/b] ${releaseDate}
[b]Genre :[/b] ${genres}
[b]Note Metacritic :[/b] ${metacritic}

[quote]${description.replace(/<[^>]*>/g, '')}[/quote]

[color=#eab308][b]--- DÉTAILS ---[/b][/color]

[b]Developpeur :[/b] ${developers}
[b]Editeur :[/b] ${publishers}
[b]Langues :[/b] ${languages}
[b]Taille :[/b] ${size}


[i]Généré par AATM[/i]
[/center]`;
}

// Export pour utilisation dans d'autres modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        generatePresentation,
        generateEbookPresentation,
        generateGamePresentation
    };
}
