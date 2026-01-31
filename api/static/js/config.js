/**
 * AATM - Configuration
 * Constantes et configuration de l'application
 */

// Détection automatique du chemin de base (pour accès via /aatm/ ou direct)
const API_BASE = window.location.pathname.startsWith('/aatm') ? '/aatm' : '';

// Configuration des types de médias
const MEDIA_TYPES = {
    MOVIE: 'movie',
    EPISODE: 'episode',
    SEASON: 'season',
    EBOOK: 'ebook',
    GAME: 'game'
};

// Labels des types de médias
const MEDIA_TYPE_LABELS = {
    [MEDIA_TYPES.MOVIE]: 'Film',
    [MEDIA_TYPES.EPISODE]: 'Épisode',
    [MEDIA_TYPES.SEASON]: 'Saison',
    [MEDIA_TYPES.EBOOK]: 'E-book',
    [MEDIA_TYPES.GAME]: 'Jeu vidéo'
};

// Configuration des étapes du workflow
const WORKFLOW_STEPS = {
    TYPE: 1,
    TMDB: 2,
    NFO: 3,
    VALIDATION: 4,
    CREATION: 5,
    UPLOAD: 6
};

// Labels des étapes
const WORKFLOW_STEP_LABELS = {
    [WORKFLOW_STEPS.TYPE]: 'Type',
    [WORKFLOW_STEPS.TMDB]: 'TMDB',
    [WORKFLOW_STEPS.NFO]: 'NFO',
    [WORKFLOW_STEPS.VALIDATION]: 'Validation',
    [WORKFLOW_STEPS.CREATION]: 'Création',
    [WORKFLOW_STEPS.UPLOAD]: 'Upload'
};

// Patterns de parsing
const PARSING_PATTERNS = {
    year: /\b(19|20)\d{2}\b/g,
    season: /\b(?:S|Season)\s?(\d{1,2})\b|\b(Complete|Integrale)\b/gi,
    episode: /\b(?:E|Episode)\s?(\d{1,3})\b/gi,
    seasonEpisode: /\bS(\d{1,2})E(\d{1,3})\b/gi,
    source: /\b(Bluray|BluRay|BDRip|BRRip|WEBRip|WebRip|WEB-DL|WEBDL|WEB|HDTV|DVDRip)\b/gi,
    vostfr: /(?:^|[\.\s\-])VOSTFR(?:[\.\s\-]|$)/i,
    ebookFormat: /\.(epub|pdf|mobi|azw3?|cbr|cbz)$/i,
    videoExtension: /\.(mkv|mp4|avi|iso)$/i
};

// Mapping des langues
const LANGUAGE_MAP = {
    'french': 'Français',
    'français': 'Français',
    'fr': 'Français',
    'english': 'Anglais',
    'en': 'Anglais',
    'spanish': 'Espagnol',
    'español': 'Espagnol',
    'es': 'Espagnol',
    'german': 'Allemand',
    'deutsch': 'Allemand',
    'de': 'Allemand',
    'italian': 'Italien',
    'italiano': 'Italien',
    'it': 'Italien',
    'portuguese': 'Portugais',
    'português': 'Portugais',
    'pt': 'Portugais',
    'japanese': 'Japonais',
    'ja': 'Japonais',
    'korean': 'Coréen',
    'ko': 'Coréen',
    'chinese': 'Chinois',
    'zh': 'Chinois',
    'russian': 'Russe',
    'ru': 'Russe',
    'arabic': 'Arabe',
    'ar': 'Arabe'
};

// Mapping des codecs audio
const AUDIO_CODEC_MAP = {
    'E-AC-3': 'EAC3',
    'EAC3': 'EAC3',
    'AC-3': 'AC3',
    'AC3': 'AC3',
    'MLP': 'TrueHD',
    'TrueHD': 'TrueHD',
    'AAC': 'AAC',
    'FLAC': 'FLAC',
    'Opus': 'Opus'
};

// Configuration des canaux audio
const AUDIO_CHANNELS_MAP = {
    8: '7.1',
    7: '7.1',
    6: '5.1',
    5: '5.1',
    2: '2.0',
    1: '1.0'
};

// Export pour utilisation dans d'autres modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        API_BASE,
        MEDIA_TYPES,
        MEDIA_TYPE_LABELS,
        WORKFLOW_STEPS,
        WORKFLOW_STEP_LABELS,
        PARSING_PATTERNS,
        LANGUAGE_MAP,
        AUDIO_CODEC_MAP,
        AUDIO_CHANNELS_MAP
    };
}
