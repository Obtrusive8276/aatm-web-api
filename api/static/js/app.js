/**
 * AATM - Amazing Automatic Torrent Maker
 * Application principale
 * 
 * Ce fichier orchestre tous les modules :
 * - config.js : Configuration et constantes
 * - state.js : Gestion de l'état
 * - utils.js : Fonctions utilitaires
 * - parsers.js : Parsing MediaInfo et noms de release
 * - generators.js : Génération de noms de release
 * - presentation.js : Génération de présentations
 * - api.js : Client API
 */

// ============ INITIALISATION ============

document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    loadSettings().then(() => {
        navigateTo('files');
    });
    checkApiStatus();
    setInterval(checkApiStatus, 30000);

    // Event listeners pour le workflow
    document.getElementById('btnStep1Next').addEventListener('click', () => goToStep(2));
    document.getElementById('btnStep2Next').addEventListener('click', () => goToStep(3));
    document.getElementById('btnMetadataSearch').addEventListener('click', searchMetadata);
    document.getElementById('metadataQuery').addEventListener('keydown', e => { 
        if (e.key === 'Enter') searchMetadata(); 
    });
    document.getElementById('btnValidationConfirm').addEventListener('click', createTorrent);
    document.getElementById('btnFinish').addEventListener('click', finishWorkflow);
    document.getElementById('btnSaveSettings').addEventListener('click', saveSettings);
    document.getElementById('btnClearHistory').addEventListener('click', clearHistory);
    document.getElementById('btnCreateFromFolder').addEventListener('click', createTorrentFromCurrentFolder);

    // Recherche de fichiers
    document.getElementById('fileSearchInput').addEventListener('input', filterFiles);

    // Sélection du type de média
    document.querySelectorAll('.media-type-btn').forEach(btn => {
        btn.addEventListener('click', () => selectMediaType(btn.dataset.type));
    });
});

// ============ NAVIGATION ============

function initNavigation() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => navigateTo(item.dataset.page));
    });
}

function navigateTo(page) {
    AppState.currentPage = page;
    
    // Mise à jour des classes actives
    document.querySelectorAll('.nav-item').forEach(item => 
        item.classList.toggle('active', item.dataset.page === page)
    );
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    document.getElementById(`page-${page}`).classList.remove('hidden');

    // Mise à jour du titre
    const titles = { 
        files: 'Explorateur de fichiers', 
        create: 'Creer un torrent', 
        settings: 'Parametres', 
        history: 'Historique' 
    };
    document.getElementById('pageTitle').textContent = titles[page];

    // Actions spécifiques à la page
    switch (page) {
        case 'files':
            if (!AppState.currentPath) {
                AppState.currentPath = AppState.settings.rootPath || '/';
            }
            loadFiles(AppState.currentPath);
            break;
        case 'settings':
            loadSettingsForm();
            break;
        case 'history':
            loadHistory();
            break;
        case 'create':
            updateWorkflowUI();
            break;
    }
}

// ============ STATUT API ============

async function checkApiStatus() {
    try {
        const isOnline = await ApiClient.checkHealth();
        document.getElementById('statusIndicator').className = 
            isOnline ? 'status-indicator online' : 'status-indicator offline';
        document.getElementById('statusText').textContent = 
            isOnline ? 'API en ligne' : 'API hors ligne';
    } catch (e) {
        document.getElementById('statusIndicator').className = 'status-indicator offline';
        document.getElementById('statusText').textContent = 'API hors ligne';
    }
}

// ============ EXPLORATEUR DE FICHIERS ============

async function loadFiles(path) {
    const fileList = document.getElementById('fileList');
    fileList.innerHTML = '<div class="loading"><div class="spinner"></div>Chargement...</div>';
    
    try {
        console.log('Loading files from path:', path);
        const files = await ApiClient.getFiles(path);
        console.log('Files loaded:', files.length);
        
        AppState.currentPath = path;
        AppState.currentFiles = files;
        
        updateBreadcrumb(path);
        renderFiles(files);
        document.getElementById('fileSearchInput').value = '';
    } catch (e) {
        console.error('Error loading files:', e);
        fileList.innerHTML = `<div class="empty-state"><p>Erreur: ${e.message}</p></div>`;
    }
}

function filterFiles() {
    const query = document.getElementById('fileSearchInput').value.toLowerCase().trim();
    if (!AppState.currentFiles) return;
    
    if (query === '') {
        renderFiles(AppState.currentFiles);
    } else {
        const filtered = AppState.currentFiles.filter(f => 
            f.name.toLowerCase().includes(query)
        );
        renderFiles(filtered);
    }
}

function updateBreadcrumb(path) {
    const breadcrumb = document.getElementById('breadcrumb');
    const parts = path.split('/').filter(p => p);
    
    let html = '<span class="breadcrumb-item" onclick="loadFiles(\'/\')">~</span>';
    let currentPath = '';
    
    parts.forEach((part, i) => {
        currentPath += '/' + part;
        html += `<span class="breadcrumb-separator">/</span>`;
        html += i === parts.length - 1
            ? `<span class="breadcrumb-item current">${part}</span>`
            : `<span class="breadcrumb-item" onclick="loadFiles('${currentPath}')">${part}</span>`;
    });
    
    breadcrumb.innerHTML = html;
}

function renderFiles(files) {
    const fileList = document.getElementById('fileList');
    
    if (!files || files.length === 0) { 
        fileList.innerHTML = '<div class="empty-state"><p>Aucun fichier media trouve</p></div>'; 
        return; 
    }

    // Filtrer et trier
    let filteredFiles = AppState.settings.showProcessed 
        ? files 
        : files.filter(f => !f.isProcessed);
    
    filteredFiles.sort((a, b) => { 
        if (a.isDir && !b.isDir) return -1; 
        if (!a.isDir && b.isDir) return 1; 
        return a.name.localeCompare(b.name); 
    });

    const getFileIcon = (file) => {
        if (file.isDir) return '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>';
        if (file.mediaType === 'ebook') return '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>';
        if (file.mediaType === 'game') return '<rect x="2" y="6" width="20" height="12" rx="2"/><line x1="6" y1="12" x2="10" y2="12"/><line x1="8" y1="10" x2="8" y2="14"/><circle cx="17" cy="10" r="1"/><circle cx="15" cy="13" r="1"/>';
        return '<polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>';
    };

    const getFileClass = (file) => {
        if (file.isDir) return 'folder';
        if (file.mediaType === 'ebook') return 'ebook';
        if (file.mediaType === 'game') return 'game';
        return 'video';
    };

    fileList.innerHTML = filteredFiles.map(file => `
        <div class="file-item ${file.isProcessed ? 'processed' : ''}" 
             data-name="${file.name}" 
             data-isdir="${file.isDir}" 
             data-mediatype="${file.mediaType || ''}" 
             onclick="selectFile('${file.name.replace(/'/g, "\\'")}', ${file.isDir}, '${file.mediaType || ''}')">
            <svg class="file-icon ${getFileClass(file)}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                ${getFileIcon(file)}
            </svg>
            <span class="file-name">${file.name}</span>
            ${file.isProcessed ? '<span class="processed-badge">Traite</span>' : ''}
            <span class="file-size">${file.isDir ? 'Dossier' : formatSize(file.size)}</span>
        </div>
    `).join('');
}

async function selectFile(name, isDir, mediaType = '') {
    const fullPath = AppState.currentPath + '/' + name;
    
    document.querySelectorAll('.file-item').forEach(el => 
        el.classList.toggle('selected', el.dataset.name === name)
    );

    if (isDir) { 
        loadFiles(fullPath); 
        AppState.selectedFile = null; 
        return; 
    }

    AppState.selectedFile = fullPath;
    AppState.selectedIsDir = isDir;
    AppState.selectedMediaType = mediaType;
    
    document.getElementById('detailsTitle').textContent = name;
    document.getElementById('fileActions').style.display = 'flex';

    const detailsContent = document.getElementById('detailsContent');
    detailsContent.innerHTML = '<div class="loading"><div class="spinner"></div>Chargement...</div>';

    try {
        if (mediaType === 'ebook' || mediaType === 'game') {
            const sizeData = await ApiClient.getDirectorySize(fullPath);
            const typeLabel = mediaType === 'ebook' ? 'E-book' : 'Jeu video';
            detailsContent.innerHTML = `
                <div class="detail-section">
                    <h4>Informations</h4>
                    <div class="detail-row"><span class="detail-label">Chemin</span><span class="detail-value" style="word-break:break-all;font-size:0.85rem;">${fullPath}</span></div>
                    <div class="detail-row"><span class="detail-label">Taille</span><span class="detail-value">${sizeData.size}</span></div>
                    <div class="detail-row"><span class="detail-label">Type</span><span class="detail-value">${typeLabel}</span></div>
                </div>
            `;
        } else {
            const [sizeData, mediaData] = await Promise.all([
                ApiClient.getDirectorySize(fullPath),
                ApiClient.getMediaInfo(fullPath, 'text')
            ]);

            detailsContent.innerHTML = `
                <div class="detail-section">
                    <h4>Informations</h4>
                    <div class="detail-row"><span class="detail-label">Chemin</span><span class="detail-value" style="word-break:break-all;font-size:0.85rem;">${fullPath}</span></div>
                    <div class="detail-row"><span class="detail-label">Taille</span><span class="detail-value">${sizeData.size}</span></div>
                </div>
                <div class="detail-section">
                    <h4>MediaInfo</h4>
                    <div class="mediainfo-output">${escapeHtml(mediaData.mediainfo)}</div>
                </div>
            `;
        }
    } catch (e) {
        detailsContent.innerHTML = `<div class="alert alert-danger">Erreur: ${e.message}</div>`;
    }

    document.getElementById('btnStartWorkflow').onclick = () => startWorkflow(fullPath, name, mediaType);
}

// ============ WORKFLOW ============

async function startWorkflow(path, name, mediaType = '') {
    AppState.selectedFile = path;
    AppState.workflowStep = 1;
    AppState.releaseInfo = parseReleaseName(name);
    AppState.resetMetadata();

    // Analyze directory if it's a potential series pack
    try {
        const analysis = await ApiClient.analyzeDirectory(path);
        if (analysis.isDirectory && analysis.isSeriesPack) {
            // It's a series pack
            if (analysis.detectedSeason) {
                AppState.releaseInfo.season = analysis.detectedSeason;
            }
            AppState.releaseInfo.episodeCount = analysis.episodeCount;
            selectMediaType('season');
        } else if (mediaType === 'ebook') {
            selectMediaType('ebook');
        } else if (mediaType === 'game') {
            selectMediaType('game');
        } else if (AppState.releaseInfo.season || AppState.releaseInfo.episode) {
            // Has season or episode info from filename
            if (AppState.releaseInfo.episode && !AppState.releaseInfo.season) {
                selectMediaType('episode');
            } else if (AppState.releaseInfo.season) {
                selectMediaType('season');
            } else {
                selectMediaType('episode');
            }
        } else {
            selectMediaType('movie');
        }
    } catch (e) {
        console.warn('Failed to analyze directory:', e);
        // Fallback to original detection
        if (mediaType === 'ebook') {
            selectMediaType('ebook');
        } else if (mediaType === 'game') {
            selectMediaType('game');
        } else if (AppState.releaseInfo.season || AppState.releaseInfo.episode) {
            if (AppState.releaseInfo.episode && !AppState.releaseInfo.season) {
                selectMediaType('episode');
            } else if (AppState.releaseInfo.season) {
                selectMediaType('season');
            } else {
                selectMediaType('episode');
            }
        } else {
            selectMediaType('movie');
        }
    }

    document.getElementById('selectedSource').innerHTML = `
        <div class="alert alert-success"><strong>Source:</strong> ${name}</div>
        <div class="detail-row"><span class="detail-label">Chemin</span><span class="detail-value" style="word-break:break-all;font-size:0.85rem;">${path}</span></div>
    `;

    const generatedName = generateReleaseName(AppState.releaseInfo, AppState.mediaType);
    AppState.torrentName = generatedName || name.replace(/\.[^/.]+$/, '');
    document.getElementById('metadataQuery').value = AppState.releaseInfo.title || '';

    updateReleaseTags();
    document.getElementById('btnStep1Next').disabled = false;
    navigateTo('create');
}

function createTorrentFromCurrentFolder() {
    const path = AppState.currentPath;
    const name = path.split('/').pop() || 'dossier';
    startWorkflow(path, name, '');
}

function selectMediaType(type) {
    AppState.mediaType = type;
    document.querySelectorAll('.media-type-btn').forEach(btn => 
        btn.classList.toggle('active', btn.dataset.type === type)
    );
}

function updateReleaseTags() {
    const info = AppState.releaseInfo;
    const tags = [];
    
    if (info.year) tags.push(`<span class="tag year">${info.year}</span>`);
    if (info.resolution) tags.push(`<span class="tag resolution">${info.resolution}</span>`);
    if (info.source) tags.push(`<span class="tag source">${info.source}</span>`);
    if (info.codec) tags.push(`<span class="tag codec">${info.codec}</span>`);
    if (info.audio) tags.push(`<span class="tag audio">${info.audio}</span>`);
    if (info.audioChannels) tags.push(`<span class="tag audio">${info.audioChannels}</span>`);
    if (info.language) tags.push(`<span class="tag language">${info.language}</span>`);
    if (info.hdr) info.hdr.forEach(h => tags.push(`<span class="tag hdr">${h}</span>`));
    if (info.releaseGroup) tags.push(`<span class="tag group">-${info.releaseGroup}</span>`);
    if (info.detectedLanguages) {
        info.detectedLanguages.forEach(l => tags.push(`<span class="tag language">${l}</span>`));
    } else if (info.audioLanguages) {
        info.audioLanguages.forEach(l => tags.push(`<span class="tag language">${l}</span>`));
    }
    
    document.getElementById('releaseTags').innerHTML = tags.length > 0 ? tags.join('') : '-';
}

function updateWorkflowUI() {
    document.querySelectorAll('.workflow-step').forEach(step => {
        const stepNum = parseInt(step.dataset.step);
        step.classList.remove('active', 'completed');
        step.style.display = '';

        if (stepNum === AppState.workflowStep) step.classList.add('active');
        else if (stepNum < AppState.workflowStep) step.classList.add('completed');
    });
    
    for (let i = 1; i <= 6; i++) {
        document.getElementById(`step-${i}`).classList.toggle('hidden', i !== AppState.workflowStep);
    }

    // Mettre à jour le label de l'étape 2 selon le type de média
    const step2Label = document.querySelector('.workflow-step[data-step="2"] .step-label');
    if (step2Label) {
        if (AppState.mediaType === 'ebook') step2Label.textContent = 'Google Books';
        else if (AppState.mediaType === 'game') step2Label.textContent = 'Steam';
        else step2Label.textContent = 'TMDB';
    }
}

/**
 * Toggle la sélection d'un tag
 * @param {HTMLElement} element - L'élément tag cliqué
 */
function toggleTag(element) {
    const tagId = element.dataset.tagId;
    
    if (AppState.selectedTagIds.has(tagId)) {
        AppState.selectedTagIds.delete(tagId);
        element.classList.remove('selected');
    } else {
        AppState.selectedTagIds.add(tagId);
        element.classList.add('selected');
    }
}

async function goToStep(step) {
    AppState.workflowStep = step;
    updateWorkflowUI();

    switch (step) {
        case 2:
            await initStep2();
            break;
        case 3:
            await initStep3();
            break;
        case 4:
            await populateValidationScreen();
            break;
        case 5:
            document.getElementById('creationProgress').classList.add('hidden');
            document.getElementById('creationResult').classList.add('hidden');
            break;
        case 6:
            document.getElementById('createdTorrentPath').textContent = AppState.createdTorrentPath || '-';
            document.getElementById('createdNfoPath').textContent = AppState.createdNfoPath || '-';
            break;
    }
}

async function initStep2() {
    const titleEl = document.getElementById('step2Title');
    const labelEl = document.getElementById('step2Label');
    const queryEl = document.getElementById('metadataQuery');
    const resultsEl = document.getElementById('metadataResults');
    const selectedEl = document.getElementById('metadataSelected');

    resultsEl.classList.add('hidden');
    selectedEl.classList.add('hidden');

    if (AppState.mediaType === 'ebook') {
        titleEl.textContent = 'Identification Google Books';
        labelEl.textContent = 'Rechercher sur Google Books';
        queryEl.placeholder = 'Titre du livre ou auteur...';
    } else if (AppState.mediaType === 'game') {
        titleEl.textContent = 'Identification Steam';
        labelEl.textContent = 'Rechercher sur Steam';
        queryEl.placeholder = 'Nom du jeu...';
    } else {
        titleEl.textContent = 'Identification TMDB';
        labelEl.textContent = 'Rechercher sur TMDB';
        queryEl.placeholder = 'Titre du film ou serie...';
    }

    if (queryEl.value && !AppState.metadataId) {
        searchMetadata();
    }
}

async function initStep3() {
    const mediaInfoEl = document.getElementById('workflowMediainfo');
    const nfoEl = document.getElementById('nfoContent');

    if (AppState.mediaType === 'ebook' || AppState.mediaType === 'game') {
        mediaInfoEl.textContent = 'MediaInfo non disponible pour ce type de fichier';
        nfoEl.value = '';
        AppState.nfoContent = '';
    } else {
        mediaInfoEl.textContent = 'Chargement...';
        try {
            const textData = await ApiClient.getMediaInfo(AppState.selectedFile, 'text');
            mediaInfoEl.textContent = textData.mediainfo;
            nfoEl.value = textData.mediainfo;
            AppState.nfoContent = textData.mediainfo;

            const jsonData = await ApiClient.getMediaInfo(AppState.selectedFile);
            
            const name = AppState.selectedFile.split('/').pop();
            AppState.releaseInfo = parseReleaseName(name, jsonData);
            updateReleaseTags();

            const generatedName = generateReleaseName(AppState.releaseInfo, AppState.mediaType);
            if (generatedName) {
                AppState.torrentName = generatedName;
            }
        } catch (e) { 
            mediaInfoEl.textContent = 'Erreur: ' + e.message; 
        }
    }
}

// ============ RECHERCHE METADATA ============

async function searchMetadata() {
    const query = document.getElementById('metadataQuery').value;
    if (!query) return;

    if (AppState.mediaType === 'ebook') {
        await searchGoogleBooks(query);
    } else if (AppState.mediaType === 'game') {
        await searchSteam(query);
    } else {
        await searchTmdb(query);
    }
}

async function searchTmdb(query) {
    const resultsEl = document.getElementById('metadataResults');
    const selectedEl = document.getElementById('metadataSelected');
    resultsEl.innerHTML = '<div class="loading"><div class="spinner"></div>Recherche TMDB...</div>';
    resultsEl.classList.remove('hidden');
    selectedEl.classList.add('hidden');

    const type = AppState.mediaType === 'movie' ? 'movie' : 'tv';
    
    try {
        const data = await ApiClient.searchTmdb(type, query);

        if (!data.results || data.results.length === 0) {
            resultsEl.innerHTML = '<div class="empty-state"><p>Aucun resultat</p></div>';
            return;
        }

        resultsEl.innerHTML = data.results.slice(0, 10).map(item => `
            <div class="tmdb-item" onclick="selectTmdbItem(${item.id})">
                <img src="${item.poster_path ? 'https://image.tmdb.org/t/p/w92' + item.poster_path : ''}" alt="" onerror="this.style.display='none'">
                <div class="tmdb-item-info">
                    <div class="tmdb-item-title">${item.title || item.name}</div>
                    <div class="tmdb-item-year">${(item.release_date || item.first_air_date || '').substring(0, 4)} - ID: ${item.id}</div>
                    <div class="tmdb-item-overview">${item.overview || ''}</div>
                </div>
            </div>
        `).join('');
    } catch (e) {
        resultsEl.innerHTML = `<div class="alert alert-danger">Erreur: ${e.message}</div>`;
    }
}

async function selectTmdbItem(id) {
    const type = AppState.mediaType === 'movie' ? 'movie' : 'tv';

    try {
        const data = await ApiClient.getTmdbDetails(type, id);
        AppState.setMetadata(id.toString(), data);

        if (data.genres) {
            AppState.releaseInfo.genres = data.genres.map(g => g.name);
        }

        document.getElementById('metadataResults').classList.add('hidden');
        const selectedEl = document.getElementById('metadataSelected');
        selectedEl.classList.remove('hidden');
        selectedEl.innerHTML = `
            <div class="tmdb-selected">
                <img src="${data.poster_path ? 'https://image.tmdb.org/t/p/w154' + data.poster_path : ''}" alt="" onerror="this.style.display='none'">
                <div class="tmdb-selected-info">
                    <div class="tmdb-selected-title">${data.title || data.name}</div>
                    <div class="tmdb-selected-meta">${(data.release_date || data.first_air_date || '').substring(0, 4)} - ${(data.genres || []).map(g => g.name).join(', ')}</div>
                    <div class="tmdb-selected-overview">${data.overview || ''}</div>
                </div>
            </div>
        `;

        document.getElementById('btnStep2Next').disabled = false;
    } catch (e) {
        showToast('Erreur TMDB: ' + e.message, 'error');
    }
}

async function searchGoogleBooks(query) {
    const resultsEl = document.getElementById('metadataResults');
    const selectedEl = document.getElementById('metadataSelected');
    resultsEl.innerHTML = '<div class="loading"><div class="spinner"></div>Recherche Google Books...</div>';
    resultsEl.classList.remove('hidden');
    selectedEl.classList.add('hidden');

    try {
        const data = await GoogleBooksApi.search(query);

        if (!data.items || data.items.length === 0) {
            resultsEl.innerHTML = '<div class="empty-state"><p>Aucun resultat</p></div>';
            return;
        }

        resultsEl.innerHTML = data.items.map(item => {
            const info = item.volumeInfo || {};
            const thumbnail = info.imageLinks?.thumbnail || '';
            const authors = (info.authors || []).join(', ');
            const year = (info.publishedDate || '').substring(0, 4);
            return `
                <div class="tmdb-item" onclick="selectGoogleBook('${item.id}')">
                    <img src="${thumbnail}" alt="" onerror="this.style.display='none'">
                    <div class="tmdb-item-info">
                        <div class="tmdb-item-title">${info.title || 'Sans titre'}</div>
                        <div class="tmdb-item-year">${authors}${year ? ' - ' + year : ''}</div>
                        <div class="tmdb-item-overview">${info.description || ''}</div>
                    </div>
                </div>
            `;
        }).join('');
    } catch (e) {
        resultsEl.innerHTML = `<div class="alert alert-danger">Erreur: ${e.message}</div>`;
    }
}

async function selectGoogleBook(id) {
    try {
        const data = await GoogleBooksApi.getDetails(id);
        const info = data.volumeInfo || {};
        AppState.setMetadata(id, info);

        document.getElementById('metadataResults').classList.add('hidden');
        const selectedEl = document.getElementById('metadataSelected');
        selectedEl.classList.remove('hidden');

        const thumbnail = info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail || '';
        const authors = (info.authors || []).join(', ');
        const year = (info.publishedDate || '').substring(0, 4);
        const categories = (info.categories || []).join(', ');

        selectedEl.innerHTML = `
            <div class="tmdb-selected">
                <img src="${thumbnail}" alt="" onerror="this.style.display='none'">
                <div class="tmdb-selected-info">
                    <div class="tmdb-selected-title">${info.title || 'Sans titre'}</div>
                    <div class="tmdb-selected-meta">${authors}${year ? ' (' + year + ')' : ''}${categories ? ' - ' + categories : ''}</div>
                    <div class="tmdb-selected-overview">${info.description || ''}</div>
                </div>
            </div>
        `;

        document.getElementById('btnStep2Next').disabled = false;
    } catch (e) {
        showToast('Erreur Google Books: ' + e.message, 'error');
    }
}

async function searchSteam(query) {
    const resultsEl = document.getElementById('metadataResults');
    const selectedEl = document.getElementById('metadataSelected');
    resultsEl.innerHTML = '<div class="loading"><div class="spinner"></div>Recherche Steam...</div>';
    resultsEl.classList.remove('hidden');
    selectedEl.classList.add('hidden');

    try {
        const data = await ApiClient.searchSteam(query);

        if (!data.items || data.items.length === 0) {
            resultsEl.innerHTML = '<div class="empty-state"><p>Aucun resultat</p></div>';
            return;
        }

        resultsEl.innerHTML = data.items.slice(0, 10).map(item => `
            <div class="tmdb-item" onclick="selectSteamGame(${item.id})">
                <img src="${item.tiny_image || ''}" alt="" onerror="this.style.display='none'">
                <div class="tmdb-item-info">
                    <div class="tmdb-item-title">${item.name}</div>
                    <div class="tmdb-item-year">Steam ID: ${item.id}</div>
                </div>
            </div>
        `).join('');
    } catch (e) {
        resultsEl.innerHTML = `<div class="alert alert-danger">Erreur Steam: ${e.message}</div>`;
    }
}

async function selectSteamGame(id) {
    try {
        const data = await ApiClient.getSteamDetails(id);
        const gameData = data[id]?.data;

        if (!gameData) {
            showToast('Impossible de charger les details du jeu', 'error');
            return;
        }

        AppState.setMetadata(id.toString(), gameData);

        document.getElementById('metadataResults').classList.add('hidden');
        const selectedEl = document.getElementById('metadataSelected');
        selectedEl.classList.remove('hidden');

        const genres = (gameData.genres || []).map(g => g.description).join(', ');
        const releaseDate = gameData.release_date?.date || '';

        selectedEl.innerHTML = `
            <div class="tmdb-selected">
                <img src="${gameData.header_image || ''}" alt="" style="width:200px;height:auto;" onerror="this.style.display='none'">
                <div class="tmdb-selected-info">
                    <div class="tmdb-selected-title">${gameData.name}</div>
                    <div class="tmdb-selected-meta">${releaseDate}${genres ? ' - ' + genres : ''}</div>
                    <div class="tmdb-selected-overview">${gameData.short_description || ''}</div>
                </div>
            </div>
        `;

        document.getElementById('btnStep2Next').disabled = false;
    } catch (e) {
        showToast('Erreur Steam: ' + e.message, 'error');
    }
}

// ============ CREATION TORRENT ============

async function createTorrent() {
    await goToStep(5);
    
    const btn = document.getElementById('btnValidationConfirm');
    btn.disabled = true;
    btn.textContent = 'Création en cours...';
    document.getElementById('creationProgress').classList.remove('hidden');

    const trackers = AppState.settings.torrentTrackers?.split('\n').filter(t => t.trim()) || [];
    const isPrivate = true;
    const torrentName = AppState.torrentName;
    let nfoContent = AppState.nfoContent;

    // Mettre à jour le nom complet dans le NFO
    if (torrentName && nfoContent) {
        const originalName = AppState.selectedFile.split('/').pop();
        const ext = originalName.match(/\.[^/.]+$/)?.[0] || '';
        const newCompleteName = torrentName + ext;
        nfoContent = nfoContent.replace(
            /^(Complete name\s*:\s*).*$/m,
            `$1${newCompleteName}`
        );
    }
    AppState.nfoContent = nfoContent;

    try {
        // Sauvegarder le NFO
        const nfoData = await ApiClient.saveNfo({ 
            sourcePath: AppState.selectedFile, 
            content: AppState.nfoContent, 
            torrentName 
        });
        AppState.createdNfoPath = nfoData.nfoPath;

        // Créer le torrent
        const torrentData = await ApiClient.createTorrent({ 
            sourcePath: AppState.selectedFile, 
            trackers, 
            comment: 'AATM', 
            isPrivate, 
            torrentName 
        });
        AppState.createdTorrentPath = torrentData.torrentPath;

        // Créer le hardlink si activé
        let hardlinkPath = null;
        let hardlinkError = null;
        if (AppState.settings.enableHardlink && AppState.settings.hardlinkDirs?.length > 0) {
            try {
                const hardlinkData = await ApiClient.createHardlink({
                    sourcePath: AppState.selectedFile,
                    hardlinkDirs: AppState.settings.hardlinkDirs,
                    torrentName: torrentName
                });
                hardlinkPath = hardlinkData.hardlinkPath;
            } catch (hlErr) {
                hardlinkError = hlErr.message;
            }
        }

        // Marquer comme traité
        await ApiClient.markProcessed(AppState.selectedFile);

        // Afficher le résultat
        document.getElementById('creationProgress').classList.add('hidden');
        document.getElementById('creationResult').classList.remove('hidden');
        
        let successMsg = 'Torrent et NFO créés avec succès!';
        if (hardlinkPath) {
            successMsg += `<br><small>Hardlink: ${hardlinkPath}</small>`;
        } else if (hardlinkError) {
            successMsg += `<br><small style="color: var(--warning-text);">Hardlink échoué: ${hardlinkError}</small>`;
        } else if (AppState.settings.enableHardlink) {
            successMsg += `<br><small style="color: var(--warning-text);">Hardlink: aucun répertoire configuré sur le même disque</small>`;
        }
        
        document.getElementById('creationResult').innerHTML = `<div class="alert alert-success">${successMsg}</div>`;
        showToast('Torrent créé!', 'success');
        
        setTimeout(() => goToStep(6), 1000);
    } catch (e) {
        document.getElementById('creationProgress').classList.add('hidden');
        document.getElementById('creationResult').classList.remove('hidden');
        document.getElementById('creationResult').innerHTML = `<div class="alert alert-danger">Erreur: ${e.message}</div>`;
        btn.disabled = false;
        btn.textContent = 'Confirmer et créer';
        showToast('Erreur: ' + e.message, 'error');
    }
}

// ============ UPLOAD ============

async function uploadToTorrentClient() {
    const statusEl = document.getElementById('uploadStatus');
    const clientName = AppState.settings.torrentClient || 'qbittorrent';
    
    if (clientName === 'none') {
        statusEl.innerHTML = '<div class="alert alert-info">Aucun client torrent configure - etape ignoree</div>';
        return;
    }
    
    const clientDisplayNames = {
        'qbittorrent': 'qBittorrent',
        'transmission': 'Transmission',
        'deluge': 'Deluge'
    };
    const displayName = clientDisplayNames[clientName] || clientName;
    statusEl.innerHTML = `<div class="loading"><div class="spinner"></div>Upload vers ${displayName}...</div>`;
    
    try {
        await ApiClient.uploadToClient(AppState.createdTorrentPath);
        statusEl.innerHTML = `<div class="alert alert-success">Upload ${displayName} reussi!</div>`;
        showToast(`Upload ${displayName} OK!`, 'success');
    } catch (e) {
        statusEl.innerHTML = `<div class="alert alert-danger">Erreur: ${e.message}</div>`;
        showToast('Erreur: ' + e.message, 'error');
    }
}

async function uploadToQBittorrent() {
    return uploadToTorrentClient();
}

async function uploadToLaCale() {
    const statusEl = document.getElementById('uploadStatus');
    statusEl.innerHTML = '<div class="loading"><div class="spinner"></div>Generation de la description et upload...</div>';

    try {
        let totalSize = null;
        try {
            const sizeData = await ApiClient.getDirectorySize(AppState.selectedFile);
            totalSize = sizeData.size;
        } catch (e) {}

        // Utiliser la description modifiée par l'utilisateur si disponible
        let description = AppState.presentationBBCode;
        
        // Si pas de description stockée, la générer
        if (!description) {
            description = await generatePresentation({
                releaseInfo: AppState.releaseInfo,
                tmdbId: AppState.tmdbId,
                mediaType: AppState.mediaType,
                nfoContent: AppState.nfoContent,
                totalSize
            });
        }

        const torrentName = AppState.torrentName || AppState.selectedFile.split('/').pop();

        await ApiClient.uploadToLaCale({
            torrentPath: AppState.createdTorrentPath,
            nfoPath: AppState.createdNfoPath,
            title: torrentName,
            description: description,
            tmdbId: AppState.tmdbId,
            mediaType: AppState.mediaType,
            releaseInfo: AppState.releaseInfo,
            passkey: AppState.settings.passkey,
            email: AppState.settings.laCaleEmail,
            password: AppState.settings.laCalePassword,
            customTags: AppState.selectedTagIds ? Array.from(AppState.selectedTagIds) : []
        });

        statusEl.innerHTML = '<div class="alert alert-success">Upload La-Cale reussi!</div>';
        showToast('Upload La-Cale OK!', 'success');
    } catch (e) {
        statusEl.innerHTML = `<div class="alert alert-danger">Erreur: ${e.message}</div>`;
        showToast('Erreur: ' + e.message, 'error');
    }
}

// ============ VALIDATION ============

async function populateValidationScreen() {
    if (!AppState.torrentName) {
        const generatedName = generateReleaseName(AppState.releaseInfo, AppState.mediaType);
        if (generatedName) {
            AppState.torrentName = generatedName;
        }
    }
    
    const torrentName = AppState.torrentName || 'Non défini';
    document.getElementById('validationReleaseName').textContent = torrentName;

    // MediaInfo
    const mediaInfoContainer = document.getElementById('validationMediaInfo');
    mediaInfoContainer.textContent = 'Chargement du MediaInfo...';
    try {
        const res = await fetch(`${API_BASE}/api/mediainfo?path=${encodeURIComponent(AppState.selectedFile)}&format=text`);
        if (res.ok) {
            const jsonData = await res.json();
            let text = jsonData.mediainfo || '';
            text = text.replace(/\\n/g, '\n');
            
            if (AppState.torrentName) {
                text = text.replace(
                    /^(Complete name\s*:\s*)(.*)$/gm,
                    (match, prefix, oldPath) => {
                        const oldFileName = oldPath.split(/[/\\]/).pop();
                        const ext = oldFileName.match(/\.[^/.]+$/)?.[0] || '';
                        return prefix + AppState.torrentName + ext;
                    }
                );
            }
            
            mediaInfoContainer.textContent = text || 'MediaInfo non disponible';
        } else {
            mediaInfoContainer.textContent = 'Erreur chargement MediaInfo';
        }
    } catch (e) {
        mediaInfoContainer.textContent = 'Erreur: ' + e.message;
    }

    // Tags - Charger tous les tags avec sélection
    const tagsContainer = document.getElementById('validationTagsContainer');
    tagsContainer.innerHTML = '<div class="loading"><div class="spinner"></div>Chargement des tags...</div>';
    
    try {
        const tagsData = await ApiClient.getAllLaCaleTags({
            mediaType: AppState.mediaType,
            releaseInfo: AppState.releaseInfo
        });
        
        // Stocker les tags sélectionnés dans AppState
        AppState.selectedTagIds = new Set(tagsData.selectedTags || []);
        
        if (tagsData.categories && tagsData.categories.length > 0) {
            tagsContainer.innerHTML = tagsData.categories.map(category => `
                <div class="tag-category">
                    <div class="tag-category-title">${escapeHtml(category.name)}</div>
                    <div class="tag-category-tags">
                        ${category.tags.map(tag => `
                            <span class="tag-selectable ${AppState.selectedTagIds.has(tag.id) ? 'selected' : ''}" 
                                  data-tag-id="${escapeHtml(tag.id)}" 
                                  data-tag-name="${escapeHtml(tag.name)}"
                                  onclick="toggleTag(this)">
                                ${escapeHtml(tag.name)}
                            </span>
                        `).join('')}
                    </div>
                </div>
            `).join('');
        } else {
            tagsContainer.innerHTML = '<div style="color: var(--text-muted);">Aucune catégorie de tags disponible</div>';
        }
    } catch (e) {
        tagsContainer.innerHTML = '<div style="color: var(--warning-text);">Erreur: ' + e.message + '</div>';
    }

    // Métadonnées (version compacte)
    const metadata = document.getElementById('validationMetadata');
    const info = AppState.releaseInfo || {};
    const metadataRows = [
        { label: 'Titre', value: info.title || '-' },
        { label: 'Année', value: info.year || '-' },
        { label: 'Résolution', value: info.resolution || '-' },
        { label: 'Source', value: info.source || '-' },
        { label: 'Codec', value: info.codec || '-' },
        { label: 'Audio', value: info.audioLanguages?.join(', ') || '-' },
        { label: 'Groupe', value: info.releaseGroup || '-' }
    ];
    
    metadata.innerHTML = metadataRows.map(row => 
        `<div class="validation-metadata-row">
            <div class="validation-metadata-label">${row.label}</div>
            <div class="validation-metadata-value">${row.value}</div>
        </div>`
    ).join('');

    // Présentation - Générer et stocker le BBCode
    const presentationPreview = document.getElementById('presentationPreview');
    const presentationEditor = document.getElementById('presentationEditor');
    const toggleBtn = document.getElementById('btnTogglePresentationView');
    
    presentationPreview.innerHTML = '<div class="loading"><div class="spinner"></div>Génération...</div>';
    
    try {
        const totalSize = await getTotalSize();
        const presentationBBCode = await generatePresentation({
            tmdbId: AppState.metadataId,
            mediaType: AppState.mediaType,
            releaseInfo: info,
            nfoContent: AppState.nfoContent,
            totalSize: totalSize
        });
        
        // Stocker le BBCode dans AppState pour l'upload
        AppState.presentationBBCode = presentationBBCode;
        
        // Afficher le rendu visuel
        presentationPreview.innerHTML = bbcodeToHtml(presentationBBCode);
        
        // Mettre le BBCode dans l'éditeur
        presentationEditor.value = presentationBBCode;
        
        // Réinitialiser l'état du toggle
        presentationPreview.classList.remove('hidden');
        presentationEditor.classList.add('hidden');
        toggleBtn.textContent = 'Voir BBCode';
        
    } catch (e) {
        presentationPreview.innerHTML = '<div style="color: var(--warning-text);">Erreur: ' + e.message + '</div>';
    }
}

/**
 * Toggle entre la vue visuelle et l'éditeur BBCode
 */
function togglePresentationView() {
    const preview = document.getElementById('presentationPreview');
    const editor = document.getElementById('presentationEditor');
    const btn = document.getElementById('btnTogglePresentationView');
    
    if (preview.classList.contains('hidden')) {
        // Passer en mode preview - mettre à jour le rendu avec le contenu édité
        AppState.presentationBBCode = editor.value;
        preview.innerHTML = bbcodeToHtml(editor.value);
        preview.classList.remove('hidden');
        editor.classList.add('hidden');
        btn.textContent = 'Voir BBCode';
    } else {
        // Passer en mode éditeur
        preview.classList.add('hidden');
        editor.classList.remove('hidden');
        btn.textContent = 'Voir Preview';
    }
}

async function getTotalSize() {
    try {
        const data = await ApiClient.getDirectorySize(AppState.selectedFile);
        return data.size;
    } catch (e) {
        return null;
    }
}

async function finishWorkflow() {
    const btn = document.getElementById('btnFinish');
    btn.disabled = true;
    btn.textContent = 'Upload en cours...';

    await uploadToTorrentClient();
    await uploadToLaCale();

    AppState.resetWorkflow();
    AppState.selectedFile = null;
    
    navigateTo('files');
    showToast('Workflow termine!', 'success');
}

// ============ SETTINGS ============

async function loadSettings() {
    console.log('Loading settings...');
    try {
        const settings = await ApiClient.getSettings();
        AppState.settings = settings;
        console.log('Settings loaded:', AppState.settings);
        if (!AppState.settings.rootPath) AppState.settings.rootPath = '/';
        AppState.currentPath = AppState.settings.rootPath;
    } catch (e) { 
        console.error('Error loading settings:', e);
        AppState.settings.rootPath = '/';
        AppState.currentPath = '/';
    }
}

function loadSettingsForm() {
    document.getElementById('settingRootPath').value = AppState.settings.rootPath || '/';
    document.getElementById('settingTrackers').value = AppState.settings.torrentTrackers || '';
    document.getElementById('settingTorrentClient').value = AppState.settings.torrentClient || 'qbittorrent';
    document.getElementById('settingQbitUrl').value = AppState.settings.qbitUrl || 'http://localhost:8081';
    document.getElementById('settingQbitUsername').value = AppState.settings.qbitUsername || 'admin';
    document.getElementById('settingQbitPassword').value = AppState.settings.qbitPassword || '';
    document.getElementById('settingTransmissionUrl').value = AppState.settings.transmissionUrl || 'http://localhost:9091';
    document.getElementById('settingTransmissionUsername').value = AppState.settings.transmissionUsername || '';
    document.getElementById('settingTransmissionPassword').value = AppState.settings.transmissionPassword || '';
    document.getElementById('settingDelugeUrl').value = AppState.settings.delugeUrl || 'http://localhost:8112';
    document.getElementById('settingDelugePassword').value = AppState.settings.delugePassword || 'deluge';
    document.getElementById('settingLaCaleEmail').value = AppState.settings.laCaleEmail || '';
    document.getElementById('settingLaCalePassword').value = AppState.settings.laCalePassword || '';
    document.getElementById('settingLaCalePasskey').value = AppState.settings.passkey || '';
    document.getElementById('settingEnableHardlink').checked = AppState.settings.enableHardlink || false;
    document.getElementById('settingHardlinkDirs').value = (AppState.settings.hardlinkDirs || []).join('\n');
    document.getElementById('settingShowProcessed').checked = AppState.settings.showProcessed || false;
    toggleTorrentClientSettings();
}

function toggleTorrentClientSettings() {
    const client = document.getElementById('settingTorrentClient').value;
    document.getElementById('qbittorrentSettings').style.display = client === 'qbittorrent' ? 'block' : 'none';
    document.getElementById('transmissionSettings').style.display = client === 'transmission' ? 'block' : 'none';
    document.getElementById('delugeSettings').style.display = client === 'deluge' ? 'block' : 'none';
}

async function saveSettings() {
    const hardlinkDirsText = document.getElementById('settingHardlinkDirs').value;
    const hardlinkDirs = hardlinkDirsText.split('\n').map(s => s.trim()).filter(s => s !== '');

    const settings = {
        rootPath: document.getElementById('settingRootPath').value,
        torrentTrackers: document.getElementById('settingTrackers').value,
        torrentClient: document.getElementById('settingTorrentClient').value,
        qbitUrl: document.getElementById('settingQbitUrl').value,
        qbitUsername: document.getElementById('settingQbitUsername').value,
        qbitPassword: document.getElementById('settingQbitPassword').value,
        transmissionUrl: document.getElementById('settingTransmissionUrl').value,
        transmissionUsername: document.getElementById('settingTransmissionUsername').value,
        transmissionPassword: document.getElementById('settingTransmissionPassword').value,
        delugeUrl: document.getElementById('settingDelugeUrl').value,
        delugePassword: document.getElementById('settingDelugePassword').value,
        laCaleEmail: document.getElementById('settingLaCaleEmail').value,
        laCalePassword: document.getElementById('settingLaCalePassword').value,
        passkey: document.getElementById('settingLaCalePasskey').value,
        enableHardlink: document.getElementById('settingEnableHardlink').checked,
        hardlinkDirs: hardlinkDirs,
        showProcessed: document.getElementById('settingShowProcessed').checked
    };
    
    try {
        await ApiClient.saveSettings(settings);
        AppState.settings = settings;
        AppState.currentPath = settings.rootPath;
        showToast('Parametres sauvegardes!', 'success');
    } catch (e) { 
        showToast('Erreur: ' + e.message, 'error'); 
    }
}

// ============ HISTORY ============

async function loadHistory() {
    const historyList = document.getElementById('historyList');
    historyList.innerHTML = '<div class="loading"><div class="spinner"></div>Chargement...</div>';
    
    try {
        const files = await ApiClient.getProcessed();
        historyList.innerHTML = (!files || files.length === 0)
            ? '<div class="empty-state"><p>Aucun fichier traite</p></div>'
            : files.map(file => `
                <div class="history-item">
                    <span class="history-path">${file.path}</span>
                    <span style="color:var(--text-muted);font-size:0.8rem;margin-left:1rem;">${file.processedAt}</span>
                </div>
            `).join('');
    } catch (e) { 
        historyList.innerHTML = `<div class="alert alert-danger">Erreur: ${e.message}</div>`; 
    }
}

async function clearHistory() {
    if (!confirm('Voulez-vous vraiment effacer tout l\'historique?')) return;
    
    try {
        await ApiClient.clearProcessed();
        showToast('Historique efface!', 'success');
        loadHistory();
    } catch (e) { 
        showToast('Erreur: ' + e.message, 'error'); 
    }
}
