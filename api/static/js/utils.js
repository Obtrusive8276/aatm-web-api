/**
 * AATM - Utilities
 * Fonctions utilitaires réutilisables
 */

/**
 * Formate une taille de fichier en unités lisibles
 * @param {number} bytes - Taille en octets
 * @returns {string}
 */
function formatSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Formate une durée en minutes en format lisible
 * @param {number} minutes - Durée en minutes
 * @returns {string}
 */
function formatDuration(minutes) {
    if (!minutes) return '';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
        return `${hours}h ${mins}min`;
    }
    return `${mins}min`;
}

/**
 * Échappe les caractères HTML spéciaux
 * @param {string} text - Texte à échapper
 * @returns {string}
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Debounce une fonction
 * @param {Function} func - Fonction à debouncer
 * @param {number} wait - Délai en millisecondes
 * @returns {Function}
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Normalise une langue en nom français
 * @param {string} lang - Code ou nom de langue
 * @returns {string}
 */
function normalizeLang(lang) {
    if (!lang) return 'Unknown';
    
    lang = lang.trim();
    
    // Vérifier pour VOSTFR
    if (/VOSTFR|VO[\s-]*STF?R?/i.test(lang)) return 'VOSTFR';
    
    // Vérifier pour VFF/VFQ
    const vffMatch = lang.match(/VF[FQ]/i);
    if (vffMatch) {
        const vff = vffMatch[0].toUpperCase();
        return vff === 'VFQ' ? 'VFQ' : 'VFF';
    }
    
    const match = lang.match(/^([\w\-]+)/i);
    if (match) {
        const base = match[1].toLowerCase();
        return LANGUAGE_MAP[base] || lang;
    }
    
    return lang || 'Unknown';
}

/**
 * Nettoie un nom de fichier pour le torrent
 * @param {string} name - Nom à nettoyer
 * @returns {string}
 */
function cleanFileName(name) {
    return name
        .replace(/[<>:"/\\|?*]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Génère un ID unique
 * @returns {string}
 */
function generateUniqueId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * Parse une date en format lisible
 * @param {string} dateString - Date en format ISO
 * @returns {string}
 */
function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

/**
 * Extrait l'année d'une date
 * @param {string} dateString - Date en format ISO
 * @returns {string}
 */
function extractYear(dateString) {
    if (!dateString) return '';
    return dateString.substring(0, 4);
}

/**
 * Vérifie si un fichier est une vidéo
 * @param {string} filename - Nom du fichier
 * @returns {boolean}
 */
function isVideoFile(filename) {
    return PARSING_PATTERNS.videoExtension.test(filename);
}

/**
 * Vérifie si un fichier est un ebook
 * @param {string} filename - Nom du fichier
 * @returns {boolean}
 */
function isEbookFile(filename) {
    return PARSING_PATTERNS.ebookFormat.test(filename);
}

/**
 * Tronque un texte à une longueur maximale
 * @param {string} text - Texte à tronquer
 * @param {number} maxLength - Longueur maximale
 * @returns {string}
 */
function truncateText(text, maxLength) {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
}

/**
 * Affiche une notification toast
 * @param {string} message - Message à afficher
 * @param {string} type - Type de notification (success, error, warning, info)
 * @param {number} duration - Durée d'affichage en ms
 */
function showToast(message, type = 'info', duration = 3000) {
    // Créer ou récupérer le conteneur de toasts
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <span>${escapeHtml(message)}</span>
        <button style="background:none;border:none;color:var(--text-muted);cursor:pointer;margin-left:auto;font-size:1.2rem;" onclick="this.parentElement.remove()">×</button>
    `;
    
    container.appendChild(toast);
    
    // Suppression automatique
    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

/**
 * Copie du texte dans le presse-papiers
 * @param {string} text - Texte à copier
 * @returns {Promise<boolean>}
 */
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        showToast('Copié dans le presse-papiers', 'success');
        return true;
    } catch (err) {
        console.error('Erreur de copie:', err);
        showToast('Erreur lors de la copie', 'error');
        return false;
    }
}

/**
 * Vérifie si une valeur est vide
 * @param {*} value - Valeur à vérifier
 * @returns {boolean}
 */
function isEmpty(value) {
    if (value === null || value === undefined) return true;
    if (typeof value === 'string') return value.trim() === '';
    if (Array.isArray(value)) return value.length === 0;
    if (typeof value === 'object') return Object.keys(value).length === 0;
    return false;
}

/**
 * Convertit du BBCode en HTML pour l'affichage visuel
 * @param {string} bbcode - Le BBCode à convertir
 * @returns {string} HTML rendu
 */
function bbcodeToHtml(bbcode) {
    if (!bbcode) return '';
    
    let html = escapeHtml(bbcode);
    
    // Images
    html = html.replace(/\[img\](.*?)\[\/img\]/gi, '<img src="$1" alt="Cover" onerror="this.style.display=\'none\'">');
    
    // Titres avec taille et couleur
    html = html.replace(/\[size=(\d+)\]\[color=(#[a-f0-9]+)\]\[b\](.*?)\[\/b\]\[\/color\]\[\/size\]/gi, 
        '<div class="bb-title" style="color: $2;">$3</div>');
    
    // Couleur + bold pour les sections
    html = html.replace(/\[color=(#[a-f0-9]+)\]\[b\](.*?)\[\/b\]\[\/color\]/gi, 
        '<div class="bb-section-title" style="color: $1;">$2</div>');
    
    // Bold
    html = html.replace(/\[b\](.*?)\[\/b\]/gi, '<strong>$1</strong>');
    
    // Italic
    html = html.replace(/\[i\](.*?)\[\/i\]/gi, '<em>$1</em>');
    
    // Underline
    html = html.replace(/\[u\](.*?)\[\/u\]/gi, '<u>$1</u>');
    
    // Quote
    html = html.replace(/\[quote\](.*?)\[\/quote\]/gis, '<div class="bb-quote">$1</div>');
    
    // Center
    html = html.replace(/\[center\](.*?)\[\/center\]/gis, '<div style="text-align: center;">$1</div>');
    
    // Color
    html = html.replace(/\[color=(#[a-f0-9]+)\](.*?)\[\/color\]/gi, '<span style="color: $1;">$2</span>');
    
    // Size
    html = html.replace(/\[size=(\d+)\](.*?)\[\/size\]/gi, (match, size, content) => {
        const fontSize = Math.min(Math.max(parseInt(size) * 0.25, 0.75), 2.5);
        return `<span style="font-size: ${fontSize}rem;">${content}</span>`;
    });
    
    // URL
    html = html.replace(/\[url=(.*?)\](.*?)\[\/url\]/gi, '<a href="$1" target="_blank" style="color: var(--accent);">$2</a>');
    html = html.replace(/\[url\](.*?)\[\/url\]/gi, '<a href="$1" target="_blank" style="color: var(--accent);">$1</a>');
    
    // Spoiler
    html = html.replace(/\[spoiler\](.*?)\[\/spoiler\]/gis, 
        '<details style="margin: 0.5rem 0;"><summary style="cursor: pointer; color: var(--accent);">Spoiler</summary><div style="padding: 0.5rem; background: var(--bg-secondary); border-radius: 4px; margin-top: 0.25rem;">$1</div></details>');
    
    // Line breaks
    html = html.replace(/\n/g, '<br>');
    
    return html;
}

// Export pour utilisation dans d'autres modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        formatSize,
        formatDuration,
        escapeHtml,
        debounce,
        normalizeLang,
        cleanFileName,
        generateUniqueId,
        formatDate,
        extractYear,
        isVideoFile,
        isEbookFile,
        truncateText,
        showToast,
        copyToClipboard,
        isEmpty,
        bbcodeToHtml
    };
}
