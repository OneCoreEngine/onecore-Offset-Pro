/**
 * OneCore GitHub File Manager - Core Logic
 */

const GITHUB_API_BASE = "https://api.github.com";

// State Management
const state = {
    token: localStorage.getItem('gh_access_token'),
    user: null,
    activeTab: 'home',
    currentRepo: null,
    currentPath: '',
    repos: [],
    contents: [],
    breadcrumbs: [],
    uploadQueue: [],
    isUploading: false,
    theme: localStorage.getItem('gh_theme') || 'neon-green'
};

// DOM Elements
const elements = {
    authScreen: document.getElementById('auth-screen'),
    loginInitial: document.getElementById('login-initial'),
    loginLoading: document.getElementById('login-loading'),
    btnLogin: document.getElementById('btn-login'),
    patInput: document.getElementById('pat-input'),
    appContainer: document.getElementById('app-container'),
    bottomNav: document.getElementById('bottom-nav'),
    viewTitle: document.getElementById('view-title'),
    viewSubtitle: document.getElementById('view-subtitle'),
    content: document.getElementById('content'),
    userAvatar: document.getElementById('user-avatar'),
    navItems: document.querySelectorAll('.nav-item'),
    toast: document.getElementById('toast'),
    btnRefresh: document.getElementById('btn-refresh'),
    globalLoader: document.getElementById('global-loader'),
    
    // Action Sheet
    actionSheet: document.getElementById('action-sheet'),
    actionSheetOverlay: document.getElementById('action-sheet-overlay'),
    sheetTitle: document.getElementById('sheet-title'),
    sheetSubtitle: document.getElementById('sheet-subtitle'),
    sheetActions: document.getElementById('sheet-actions'),
    
    // Modals
    editModal: document.getElementById('edit-modal'),
    editFilename: document.getElementById('edit-filename'),
    editContent: document.getElementById('edit-content'),
    btnSaveFile: document.getElementById('btn-save-file'),
    
    confirmModal: document.getElementById('confirm-modal'),
    confirmTitle: document.getElementById('confirm-title'),
    confirmMessage: document.getElementById('confirm-message'),
    btnConfirmAction: document.getElementById('btn-confirm-action'),
    
    promptModal: document.getElementById('prompt-modal'),
    promptTitle: document.getElementById('prompt-title'),
    promptMessage: document.getElementById('prompt-message'),
    promptInput: document.getElementById('prompt-input'),
    btnPromptAction: document.getElementById('btn-prompt-action')
};

// --- Initialization ---
async function init() {
    setTheme(state.theme);
    if (!state.token) {
        showAuthScreen();
    } else {
        try {
            await fetchUserProfile();
            showApp();
            renderTab('home');
        } catch (err) {
            console.error("Auth failed:", err);
            logout();
        }
    }
    setupEventListeners();
}

// --- Event Listeners ---
function setupEventListeners() {
    elements.btnLogin.addEventListener('click', handlePATLogin);
    
    elements.navItems.forEach(item => {
        item.addEventListener('click', () => {
            const tab = item.getAttribute('data-tab');
            switchTab(tab);
        });
    });

    elements.btnRefresh.addEventListener('click', () => {
        if (state.activeTab === 'home' && state.currentRepo) {
            fetchRepoContents(state.currentRepo, state.currentPath);
        } else if (state.activeTab === 'repos') {
            fetchUserRepos();
        } else {
            renderTab(state.activeTab);
        }
    });
}

// --- Theme Management ---
function setTheme(theme) {
    state.theme = theme;
    localStorage.setItem('gh_theme', theme);
    document.body.setAttribute('data-theme', theme);
    
    // Update RGB variable for borders/glows
    const rgb = theme === 'neon-green' ? '57, 255, 20' : '0, 212, 255';
    document.documentElement.style.setProperty('--accent-rgb', rgb);
}

// --- Authentication (PAT) ---
async function handlePATLogin() {
    const token = elements.patInput.value.trim();
    if (!token) return showToast("Please enter a token", 'error');

    elements.loginInitial.classList.add('hidden');
    elements.loginLoading.classList.remove('hidden');

    try {
        const res = await fetch(`${GITHUB_API_BASE}/user`, {
            headers: { 'Authorization': `token ${token}` }
        });
        
        if (!res.ok) throw new Error("Invalid token or insufficient permissions");
        
        state.token = token;
        localStorage.setItem('gh_access_token', token);
        state.user = await res.json();
        
        updateHeader();
        showApp();
        renderTab('home');
        showToast("Login successful", 'success', 2000);
    } catch (err) {
        showToast(err.message, 'error');
        elements.loginInitial.classList.remove('hidden');
        elements.loginLoading.classList.add('hidden');
    }
}

async function fetchUserProfile() {
    const res = await fetch(`${GITHUB_API_BASE}/user`, {
        headers: { 'Authorization': `token ${state.token}` }
    });
    if (!res.ok) {
        if (res.status === 401) logout();
        throw new Error("Failed to fetch user profile");
    }
    state.user = await res.json();
    updateHeader();
}

function updateHeader() {
    const img = elements.userAvatar.querySelector('img');
    img.src = state.user.avatar_url;
    img.classList.remove('hidden');
}

function logout() {
    localStorage.removeItem('gh_access_token');
    state.token = null;
    state.user = null;
    location.reload();
}

// --- UI Navigation ---
function showAuthScreen() {
    elements.authScreen.classList.remove('hidden');
    elements.appContainer.classList.add('hidden');
    elements.bottomNav.classList.add('hidden');
}

function showApp() {
    elements.authScreen.classList.add('hidden');
    elements.appContainer.classList.remove('hidden');
    elements.bottomNav.classList.remove('hidden');
}

function switchTab(tab) {
    state.activeTab = tab;
    elements.navItems.forEach(item => {
        item.classList.toggle('active', item.getAttribute('data-tab') === tab);
    });
    
    if (tab === 'home' || tab === 'repos') {
        state.currentRepo = null;
        state.currentPath = '';
    }
    
    renderTab(tab);
}

function renderTab(tab) {
    elements.content.innerHTML = '';
    elements.viewTitle.textContent = tab.charAt(0).toUpperCase() + tab.slice(1);
    elements.viewSubtitle.textContent = tab === 'home' ? 'File Explorer' : tab === 'repos' ? 'Repository List' : tab === 'upload' ? 'Bulk Upload' : 'Account Settings';

    switch (tab) {
        case 'home':
            renderHome();
            break;
        case 'repos':
            renderRepos();
            break;
        case 'upload':
            renderUpload();
            break;
        case 'settings':
            renderSettings();
            break;
    }
}

// --- Tab Renderers ---
async function renderHome() {
    if (!state.currentRepo) {
        elements.content.innerHTML = `
            <div class="space-y-6">
                <div class="glass-card p-6 rounded-3xl accent-border relative overflow-hidden">
                    <div class="absolute top-0 right-0 w-32 h-32 accent-bg opacity-5 rounded-full -mr-16 -mt-16"></div>
                    <h3 class="text-2xl font-black text-white tracking-tighter leading-tight">Welcome, ${state.user.name || state.user.login}!</h3>
                    <p class="text-[10px] accent-text opacity-60 mt-2 font-black uppercase tracking-[0.2em]">Select a repository to manage files.</p>
                </div>
                <div class="flex items-center justify-between px-2">
                    <h4 class="text-[10px] font-black text-white/40 uppercase tracking-widest">Recent Repositories</h4>
                    <button onclick="switchTab('repos')" class="text-[10px] font-black accent-text uppercase tracking-widest">View All</button>
                </div>
                <div id="home-repo-list" class="space-y-3">
                    <div class="loader mx-auto my-10"></div>
                </div>
            </div>
        `;
        await fetchUserRepos();
        const homeRepoList = document.getElementById('home-repo-list');
        if (homeRepoList) {
            const recentRepos = state.repos.slice(0, 5);
            homeRepoList.innerHTML = recentRepos.map(repo => `
                <div class="glass-card p-5 rounded-3xl flex items-center justify-between active:scale-95 transition-all border-white/5" onclick="openRepoActionSheet('${repo.full_name}', '${repo.name}')">
                    <div class="flex items-center gap-4">
                        <div class="w-12 h-12 accent-bg opacity-10 rounded-2xl flex items-center justify-center accent-text">
                            <i class="fas fa-book text-lg"></i>
                        </div>
                        <div>
                            <h3 class="font-black text-white text-sm tracking-tight">${repo.name}</h3>
                            <p class="text-[10px] text-white/40 font-black uppercase tracking-widest mt-0.5">${repo.private ? 'Private' : 'Public'}</p>
                        </div>
                    </div>
                    <i class="fas fa-ellipsis-v text-white/10 text-xs"></i>
                </div>
            `).join('') || '<p class="text-center text-white/40 py-10 font-black uppercase tracking-widest text-[10px]">No repositories found</p>';
        }
    } else {
        elements.viewTitle.textContent = state.currentRepo.name;
        renderBreadcrumbs();
        renderContentsList();
    }
}

async function renderRepos() {
    elements.content.innerHTML = '<div class="loader mx-auto my-20"></div>';
    await fetchUserRepos();
    renderRepoList();
}

function renderRepoList() {
    elements.content.innerHTML = `
        <div class="space-y-4">
            <div class="relative">
                <i class="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-white/20 text-sm"></i>
                <input id="repo-search" type="text" placeholder="Search repositories..." class="w-full bg-white/5 border border-white/10 rounded-2xl py-5 pl-12 pr-4 text-sm text-white outline-none focus:border-accent transition-all font-bold uppercase tracking-tight">
            </div>
            <div id="repo-list-container" class="space-y-3">
                ${state.repos.map(repo => `
                    <div class="glass-card p-5 rounded-3xl flex items-center justify-between active:scale-95 transition-all border-white/5" onclick="openRepoActionSheet('${repo.full_name}', '${repo.name}')">
                        <div class="flex items-center gap-4 flex-1 min-w-0">
                            <div class="w-12 h-12 accent-bg opacity-10 rounded-2xl flex items-center justify-center accent-text">
                                <i class="fas fa-book text-lg"></i>
                            </div>
                            <div class="min-w-0">
                                <h3 class="font-black text-white text-sm tracking-tight truncate">${repo.name}</h3>
                                <p class="text-[10px] text-white/40 font-black uppercase tracking-widest mt-0.5">${repo.private ? 'Private' : 'Public'}</p>
                            </div>
                        </div>
                        <i class="fas fa-ellipsis-v text-white/10 text-xs"></i>
                    </div>
                `).join('')}
            </div>
        </div>
    `;

    document.getElementById('repo-search').oninput = (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = state.repos.filter(r => r.name.toLowerCase().includes(term));
        document.getElementById('repo-list-container').innerHTML = filtered.map(repo => `
            <div class="glass-card p-5 rounded-3xl flex items-center justify-between active:scale-95 transition-all border-white/5" onclick="selectRepo('${repo.full_name}')">
                <div class="flex items-center gap-4 flex-1 min-w-0">
                    <div class="w-12 h-12 accent-bg opacity-10 rounded-2xl flex items-center justify-center accent-text">
                        <i class="fas fa-book text-lg"></i>
                    </div>
                    <div class="min-w-0">
                        <h3 class="font-black text-white text-sm tracking-tight truncate">${repo.name}</h3>
                        <p class="text-[10px] text-white/40 font-black uppercase tracking-widest mt-0.5">${repo.private ? '<i class="fas fa-lock mr-1 accent-text opacity-60"></i>Private' : '<i class="fas fa-globe mr-1 accent-text opacity-60"></i>Public'}</p>
                    </div>
                </div>
                <div class="flex items-center gap-3">
                    <button onclick="event.stopPropagation(); confirmDeleteRepo('${repo.full_name}')" class="w-10 h-10 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center active:scale-90 transition-all">
                        <i class="fas fa-trash-alt text-xs"></i>
                    </button>
                    <i class="fas fa-chevron-right text-white/10 text-xs"></i>
                </div>
            </div>
        `).join('');
    };
}

function renderBreadcrumbs() {
    const parts = state.currentPath ? state.currentPath.split('/') : [];
    let html = `
        <div class="flex items-center gap-2 overflow-x-auto no-scrollbar py-2 text-[10px] font-black uppercase tracking-widest text-white/40">
            <span class="hover:accent-text cursor-pointer bg-white/5 px-3 py-1.5 rounded-lg border border-white/10" onclick="navigatePath('')">Root</span>
    `;
    
    let path = '';
    parts.forEach((part, i) => {
        path += (i === 0 ? '' : '/') + part;
        html += `
            <i class="fas fa-chevron-right text-[8px] opacity-20"></i>
            <span class="hover:accent-text cursor-pointer ${i === parts.length - 1 ? 'accent-text' : ''}" onclick="navigatePath('${path}')">${part}</span>
        `;
    });
    
    html += `</div>`;
    elements.content.insertAdjacentHTML('afterbegin', html);
}

function renderContentsList() {
    const listHtml = state.contents.map(item => {
        const isDir = item.type === 'dir';
        const icon = isDir ? 'fa-folder accent-text' : getFileIcon(item.name);
        return `
            <div class="glass-card p-4 rounded-2xl flex items-center justify-between group border-white/5 active:scale-[0.98] transition-all" onclick="openItemActionSheet('${item.path}', '${item.name}', '${item.type}', '${item.download_url}')">
                <div class="flex items-center gap-4 flex-1 min-w-0">
                    <div class="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center ${isDir ? 'accent-text' : 'text-white/40'}">
                        <i class="fas ${icon} text-lg"></i>
                    </div>
                    <div class="min-w-0">
                        <h4 class="text-xs font-black text-white truncate tracking-tight">${item.name}</h4>
                        <p class="text-[9px] text-white/40 font-black uppercase tracking-widest mt-0.5">${isDir ? 'Folder' : formatSize(item.size)}</p>
                    </div>
                </div>
                <i class="fas fa-ellipsis-v text-white/10 text-xs"></i>
            </div>
        `;
    }).join('') || '<p class="text-center text-white/40 py-10 font-black uppercase tracking-widest text-[10px]">This folder is empty</p>';
    
    const actionButtons = `
        <div class="grid grid-cols-2 gap-3 mb-4">
            <button onclick="promptNewFile()" class="flex items-center justify-center gap-2 py-4 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:border-accent/30 transition-all">
                <i class="fas fa-plus accent-text"></i> New File
            </button>
            <button onclick="promptNewFolder()" class="flex items-center justify-center gap-2 py-4 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:border-accent/30 transition-all">
                <i class="fas fa-folder-plus accent-text"></i> New Folder
            </button>
        </div>
    `;

    const headerHtml = `
        <div class="flex items-center justify-between px-2 mb-4 mt-6">
            <h4 class="text-[10px] font-black text-white/40 uppercase tracking-widest">Files & Folders</h4>
            <button onclick="downloadFolderAsZip('${state.currentPath}', '${state.currentRepo.name}')" class="text-[10px] font-black accent-text uppercase tracking-widest bg-white/5 px-3 py-1.5 rounded-lg border border-white/10 active:scale-95 transition-all">
                <i class="fas fa-file-archive mr-1"></i> ZIP
            </button>
        </div>
    `;
    
    elements.content.insertAdjacentHTML('beforeend', actionButtons + headerHtml + `<div class="space-y-2">${listHtml}</div>`);
}

function renderUpload() {
    elements.content.innerHTML = `
        <div class="space-y-6">
            <div class="glass-card p-6 rounded-3xl space-y-5 border-white/5">
                <h4 class="text-[10px] font-black accent-text uppercase tracking-widest">Target Repository</h4>
                <select id="upload-repo" class="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm text-white outline-none focus:border-accent appearance-none font-black uppercase tracking-tight">
                    <option value="">Select a repository</option>
                    ${state.repos.map(r => `<option value="${r.full_name}">${r.full_name}</option>`).join('')}
                </select>
                
                <div class="grid grid-cols-2 gap-4">
                    <div class="space-y-2">
                        <label class="text-[10px] font-black text-white/40 uppercase tracking-widest ml-1">Branch</label>
                        <input id="upload-branch" type="text" value="main" class="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm text-white outline-none focus:border-accent font-black uppercase tracking-tight transition-all">
                    </div>
                    <div class="space-y-2">
                        <label class="text-[10px] font-black text-white/40 uppercase tracking-widest ml-1">Path</label>
                        <input id="upload-path" type="text" placeholder="root/" class="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm text-white outline-none focus:border-accent font-black uppercase tracking-tight transition-all">
                    </div>
                </div>
            </div>

            <div class="grid grid-cols-2 gap-4">
                <label class="glass-card p-6 rounded-3xl flex flex-col items-center justify-center gap-4 cursor-pointer active:scale-95 transition-all border-white/5 border-dashed border-2 hover:border-accent/30">
                    <div class="w-12 h-12 accent-bg opacity-10 rounded-2xl flex items-center justify-center accent-text">
                        <i class="fas fa-file-alt text-xl"></i>
                    </div>
                    <span class="text-[9px] font-black uppercase tracking-widest text-white/60">Select Files</span>
                    <input type="file" id="file-input" multiple class="hidden">
                </label>
                <label class="glass-card p-6 rounded-3xl flex flex-col items-center justify-center gap-4 cursor-pointer active:scale-95 transition-all border-white/5 border-dashed border-2 hover:border-accent/30">
                    <div class="w-12 h-12 accent-bg opacity-10 rounded-2xl flex items-center justify-center accent-text">
                        <i class="fas fa-folder-open text-xl"></i>
                    </div>
                    <span class="text-[9px] font-black uppercase tracking-widest text-white/60">Select Folder</span>
                    <input type="file" id="folder-input" webkitdirectory class="hidden">
                </label>
            </div>

            <div id="upload-status" class="hidden glass-card p-6 rounded-3xl space-y-4 border-accent/20">
                <div class="flex justify-between text-[10px] font-black uppercase tracking-widest">
                    <span id="upload-progress-text" class="accent-text">Uploading...</span>
                    <span id="upload-percentage" class="text-white">0%</span>
                </div>
                <div class="h-2 bg-white/5 rounded-full overflow-hidden">
                    <div id="upload-progress-bar" class="h-full accent-bg transition-all duration-300 shadow-[0_0_15px_var(--accent-glow)]" style="width: 0%"></div>
                </div>
            </div>

            <button id="btn-start-upload" class="w-full btn-primary font-black py-5 rounded-2xl shadow-lg uppercase tracking-widest text-xs disabled:opacity-30 transition-all" disabled>
                Start Upload
            </button>
        </div>
    `;

    const fileInput = document.getElementById('file-input');
    const folderInput = document.getElementById('folder-input');
    const btnStart = document.getElementById('btn-start-upload');

    const handleFileSelect = (e) => {
        state.uploadQueue = Array.from(e.target.files);
        btnStart.disabled = state.uploadQueue.length === 0;
        btnStart.textContent = `Upload ${state.uploadQueue.length} Items`;
    };

    fileInput.addEventListener('change', handleFileSelect);
    folderInput.addEventListener('change', handleFileSelect);
    btnStart.addEventListener('click', startBulkUpload);
}

function renderSettings() {
    elements.content.innerHTML = `
        <div class="space-y-6">
            <div class="glass-card p-6 rounded-3xl flex items-center gap-6 border-white/5 relative overflow-hidden">
                <div class="absolute top-0 right-0 w-32 h-32 accent-bg opacity-5 rounded-full -mr-16 -mt-16"></div>
                <div class="relative">
                    <img src="${state.user.avatar_url}" class="w-20 h-20 rounded-2xl border-2 border-white/10 shadow-2xl">
                    <div class="absolute -bottom-1 -right-1 w-6 h-6 accent-bg rounded-full border-4 border-[#111111] shadow-lg"></div>
                </div>
                <div class="relative z-10">
                    <h3 class="text-2xl font-black text-white tracking-tighter leading-none">${state.user.name || state.user.login}</h3>
                    <p class="text-[10px] accent-text font-black uppercase tracking-widest mt-2">@${state.user.login}</p>
                </div>
            </div>

            <div class="space-y-3">
                <h4 class="text-[10px] font-black text-white/40 uppercase tracking-widest ml-2">Theme Switcher</h4>
                <div class="glass-card p-4 rounded-3xl flex items-center justify-between border-white/5">
                    <span class="text-xs font-black text-white uppercase tracking-tight">Cyber Blue Theme</span>
                    <button onclick="toggleTheme()" class="w-14 h-8 bg-white/5 rounded-full relative p-1 transition-all">
                        <div class="w-6 h-6 rounded-full transition-all ${state.theme === 'cyber-blue' ? 'translate-x-6 accent-bg' : 'bg-white/20'}"></div>
                    </button>
                </div>
            </div>

            <div class="glass-card rounded-3xl overflow-hidden divide-y divide-white/5 border-white/5">
                <div class="p-5 flex items-center justify-between">
                    <div class="flex items-center gap-4">
                        <div class="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center accent-text">
                            <i class="fas fa-shield-alt"></i>
                        </div>
                        <span class="text-xs font-black text-white uppercase tracking-tight">Auth Mode</span>
                    </div>
                    <span class="text-[9px] bg-white/5 accent-text px-3 py-1.5 rounded-lg font-black uppercase tracking-widest border border-white/10">PAT Access</span>
                </div>
                <div class="p-5 flex items-center justify-between active:bg-red-500/5 transition-colors" onclick="logout()">
                    <div class="flex items-center gap-4 text-red-500">
                        <div class="w-10 h-10 bg-red-500/10 rounded-xl flex items-center justify-center">
                            <i class="fas fa-sign-out-alt"></i>
                        </div>
                        <span class="text-xs font-black uppercase tracking-tight">Sign Out</span>
                    </div>
                    <i class="fas fa-chevron-right text-white/10 text-xs"></i>
                </div>
            </div>
        </div>
    `;
}

// --- API Actions ---
async function fetchUserRepos() {
    try {
        const res = await fetch(`${GITHUB_API_BASE}/user/repos?sort=updated&per_page=100`, {
            headers: { 'Authorization': `token ${state.token}` }
        });
        if (!res.ok) {
            if (res.status === 401) logout();
            throw new Error("Failed to fetch repos");
        }
        state.repos = await res.json();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function selectRepo(fullName) {
    state.currentRepo = state.repos.find(r => r.full_name === fullName);
    state.currentPath = '';
    state.breadcrumbs = [];
    closeActionSheet();
    await fetchRepoContents(state.currentRepo, '');
    renderTab('home');
}

async function navigatePath(path) {
    state.currentPath = path;
    closeActionSheet();
    await fetchRepoContents(state.currentRepo, path);
    renderTab('home');
}

async function fetchRepoContents(repo, path) {
    try {
        const res = await fetch(`${GITHUB_API_BASE}/repos/${repo.full_name}/contents/${path}`, {
            headers: { 'Authorization': `token ${state.token}` }
        });
        if (!res.ok) {
            if (res.status === 401) logout();
            throw new Error("Failed to fetch contents");
        }
        state.contents = await res.json();
        state.contents.sort((a, b) => (a.type === 'dir' ? -1 : 1));
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// --- CRUD Operations ---
async function handleFileClick(path, name, downloadUrl) {
    const isText = isTextFile(name);
    if (isText) {
        editFile(path, name);
    } else {
        downloadFile(downloadUrl, name);
    }
}

async function editFile(path, name) {
    closeActionSheet();
    showGlobalLoader(true);
    try {
        const res = await fetch(`${GITHUB_API_BASE}/repos/${state.currentRepo.full_name}/contents/${path}`, {
            headers: { 'Authorization': `token ${state.token}` }
        });
        const data = await res.json();
        const content = atob(data.content);
        
        elements.editFilename.textContent = `Editing: ${name}`;
        elements.editContent.value = content;
        
        elements.btnSaveFile.onclick = () => saveFile(path, data.sha);
        
        openModal('edit-modal');
    } catch (err) {
        showToast("Failed to load file: " + err.message, 'error');
    } finally {
        showGlobalLoader(false);
    }
}

async function saveFile(path, sha) {
    const content = elements.editContent.value;
    showGlobalLoader(true);
    try {
        const res = await fetch(`${GITHUB_API_BASE}/repos/${state.currentRepo.full_name}/contents/${path}`, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${state.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: `Update ${path} via OneCore`,
                content: btoa(content),
                sha: sha
            })
        });
        
        if (!res.ok) throw new Error("Failed to save file");
        
        showToast("File saved successfully!");
        closeModal('edit-modal');
        fetchRepoContents(state.currentRepo, state.currentPath);
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        showGlobalLoader(false);
    }
}

async function confirmDelete(path, name, isDir) {
    closeActionSheet();
    elements.confirmTitle.textContent = `Delete ${isDir ? 'Folder' : 'File'}?`;
    elements.confirmMessage.textContent = `Are you sure you want to delete "${name}"? ${isDir ? 'This will delete all contents recursively.' : ''}`;
    
    elements.btnConfirmAction.onclick = () => {
        if (isDir) {
            deleteFolder(path);
        } else {
            deleteFile(path);
        }
        closeModal('confirm-modal');
    };
    
    openModal('confirm-modal');
}

async function deleteFile(path, sha = null) {
    // Optimistic UI
    const originalContents = [...state.contents];
    state.contents = state.contents.filter(item => item.path !== path);
    renderTab('home');

    try {
        if (!sha) {
            const res = await fetch(`${GITHUB_API_BASE}/repos/${state.currentRepo.full_name}/contents/${path}`, {
                headers: { 'Authorization': `token ${state.token}` }
            });
            const data = await res.json();
            sha = data.sha;
        }
        
        const delRes = await fetch(`${GITHUB_API_BASE}/repos/${state.currentRepo.full_name}/contents/${path}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `token ${state.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: `Delete ${path} via OneCore`,
                sha: sha
            })
        });
        
        if (!delRes.ok) throw new Error("Delete failed");
        
        showToast("Deleted successfully!");
    } catch (err) {
        state.contents = originalContents;
        renderTab('home');
        showToast(err.message, 'error');
    }
}

async function deleteFolder(path) {
    // Optimistic UI
    const originalContents = [...state.contents];
    state.contents = state.contents.filter(item => item.path !== path);
    renderTab('home');

    try {
        await recursiveDelete(path);
        showToast("Folder deleted!");
    } catch (err) {
        state.contents = originalContents;
        renderTab('home');
        showToast("Folder delete failed: " + err.message, 'error');
    }
}

async function recursiveDelete(path) {
    const res = await fetch(`${GITHUB_API_BASE}/repos/${state.currentRepo.full_name}/contents/${path}`, {
        headers: { 'Authorization': `token ${state.token}` }
    });
    const items = await res.json();
    
    for (const item of items) {
        if (item.type === 'dir') {
            await recursiveDelete(item.path);
        } else {
            await fetch(`${GITHUB_API_BASE}/repos/${state.currentRepo.full_name}/contents/${item.path}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `token ${state.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: `Recursive delete ${item.path}`,
                    sha: item.sha
                })
            });
        }
    }
}

async function confirmRename(path, name, isDir) {
    closeActionSheet();
    elements.promptTitle.textContent = `Rename ${isDir ? 'Folder' : 'File'}`;
    elements.promptMessage.textContent = `Enter new name for "${name}"`;
    elements.promptInput.value = name;
    
    elements.btnPromptAction.onclick = () => {
        const newName = elements.promptInput.value.trim();
        if (newName && newName !== name) {
            renameItem(path, name, newName, isDir);
        }
        closeModal('prompt-modal');
    };
    
    openModal('prompt-modal');
}

async function renameItem(oldPath, oldName, newName, isDir) {
    showGlobalLoader(true);
    try {
        const parentPath = oldPath.substring(0, oldPath.lastIndexOf('/'));
        const newPath = parentPath ? `${parentPath}/${newName}` : newName;
        
        if (isDir) {
            // Rename folder: copy all files to new path, then delete old path
            await recursiveCopy(oldPath, newPath);
            await recursiveDelete(oldPath);
        } else {
            // Rename file: get content, create new, delete old
            const res = await fetch(`${GITHUB_API_BASE}/repos/${state.currentRepo.full_name}/contents/${oldPath}`, {
                headers: { 'Authorization': `token ${state.token}` }
            });
            const data = await res.json();
            
            await fetch(`${GITHUB_API_BASE}/repos/${state.currentRepo.full_name}/contents/${newPath}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${state.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: `Rename ${oldName} to ${newName}`,
                    content: data.content
                })
            });
            
            await deleteFile(oldPath, data.sha);
        }
        
        showToast("Renamed successfully!");
        fetchRepoContents(state.currentRepo, state.currentPath);
    } catch (err) {
        showToast("Rename failed: " + err.message, 'error');
    } finally {
        showGlobalLoader(false);
    }
}

async function recursiveCopy(oldPath, newPath) {
    const res = await fetch(`${GITHUB_API_BASE}/repos/${state.currentRepo.full_name}/contents/${oldPath}`, {
        headers: { 'Authorization': `token ${state.token}` }
    });
    const items = await res.json();
    
    for (const item of items) {
        const itemNewPath = item.path.replace(oldPath, newPath);
        if (item.type === 'dir') {
            await recursiveCopy(item.path, itemNewPath);
        } else {
            const fileRes = await fetch(`${GITHUB_API_BASE}/repos/${state.currentRepo.full_name}/contents/${item.path}`, {
                headers: { 'Authorization': `token ${state.token}` }
            });
            const fileData = await fileRes.json();
            
            await fetch(`${GITHUB_API_BASE}/repos/${state.currentRepo.full_name}/contents/${itemNewPath}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${state.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: `Copy for rename: ${item.path}`,
                    content: fileData.content
                })
            });
        }
    }
}

async function promptNewFile() {
    closeActionSheet();
    elements.promptTitle.textContent = "New File";
    elements.promptMessage.textContent = "Enter filename (e.g. index.html)";
    elements.promptInput.value = "";
    
    elements.btnPromptAction.onclick = async () => {
        const name = elements.promptInput.value.trim();
        if (name) {
            const path = state.currentPath ? `${state.currentPath}/${name}` : name;
            await createFile(path);
        }
        closeModal('prompt-modal');
    };
    
    openModal('prompt-modal');
}

async function createFile(path) {
    showGlobalLoader(true);
    try {
        const res = await fetch(`${GITHUB_API_BASE}/repos/${state.currentRepo.full_name}/contents/${path}`, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${state.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: `Create ${path} via OneCore`,
                content: "" // Empty file
            })
        });
        
        if (!res.ok) throw new Error("Failed to create file");
        
        showToast("File created!");
        fetchRepoContents(state.currentRepo, state.currentPath);
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        showGlobalLoader(false);
    }
}

async function promptNewFolder() {
    closeActionSheet();
    elements.promptTitle.textContent = "New Folder";
    elements.promptMessage.textContent = "Enter folder name";
    elements.promptInput.value = "";
    
    elements.btnPromptAction.onclick = async () => {
        const name = elements.promptInput.value.trim();
        if (name) {
            const path = state.currentPath ? `${state.currentPath}/${name}/.gitkeep` : `${name}/.gitkeep`;
            await createFile(path);
        }
        closeModal('prompt-modal');
    };
    
    openModal('prompt-modal');
}

async function confirmDeleteRepo(fullName) {
    closeActionSheet();
    elements.confirmTitle.textContent = "Delete Repository?";
    elements.confirmMessage.textContent = `Are you sure you want to delete "${fullName}"? This action is irreversible.`;
    
    elements.btnConfirmAction.onclick = async () => {
        showGlobalLoader(true);
        try {
            const res = await fetch(`${GITHUB_API_BASE}/repos/${fullName}`, {
                method: 'DELETE',
                headers: { 'Authorization': `token ${state.token}` }
            });
            
            if (!res.ok) throw new Error("Delete failed. Check if your token has 'delete_repo' scope.");
            
            showToast("Repository deleted!");
            fetchUserRepos();
            renderTab('repos');
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            showGlobalLoader(false);
            closeModal('confirm-modal');
        }
    };
    
    openModal('confirm-modal');
}

// --- File Operations (Existing) ---
function downloadFile(url, name) {
    closeActionSheet();
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast(`Downloading ${name}...`);
}

async function downloadFolderAsZip(path, folderName) {
    closeActionSheet();
    showToast(`Preparing ZIP for ${folderName}...`);
    const zip = new JSZip();
    const repo = state.currentRepo;
    
    try {
        await addFolderToZip(zip, repo, path);
        const content = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(content);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${folderName}.zip`;
        a.click();
        URL.revokeObjectURL(url);
        showToast("ZIP Downloaded!");
    } catch (err) {
        showToast("ZIP failed: " + err.message, 'error');
    }
}

async function addFolderToZip(zip, repo, path) {
    const res = await fetch(`${GITHUB_API_BASE}/repos/${repo.full_name}/contents/${path}`, {
        headers: { 'Authorization': `token ${state.token}` }
    });
    const items = await res.json();
    
    for (const item of items) {
        if (item.type === 'dir') {
            const folder = zip.folder(item.name);
            await addFolderToZip(folder, repo, item.path);
        } else {
            const fileRes = await fetch(item.download_url);
            const blob = await fileRes.blob();
            zip.file(item.name, blob);
        }
    }
}

async function startBulkUpload() {
    const repoSelect = document.getElementById('upload-repo');
    const branchInput = document.getElementById('upload-branch');
    const pathInput = document.getElementById('upload-path');
    const statusDiv = document.getElementById('upload-status');
    const progressText = document.getElementById('upload-progress-text');
    const progressBar = document.getElementById('upload-progress-bar');
    const percentageText = document.getElementById('upload-percentage');

    const repo = repoSelect.value;
    const branch = branchInput.value || 'main';
    const basePath = pathInput.value.replace(/^\/+|\/+$/g, '');

    if (!repo) return showToast("Select a repository", 'error');

    statusDiv.classList.remove('hidden');
    state.isUploading = true;
    let uploaded = 0;
    const total = state.uploadQueue.length;

    for (const file of state.uploadQueue) {
        try {
            const relativePath = file.webkitRelativePath || file.name;
            const fullPath = basePath ? `${basePath}/${relativePath}` : relativePath;
            
            progressText.textContent = `Uploading ${file.name}...`;
            
            const content = await readFileAsBase64(file);
            
            await fetch(`${GITHUB_API_BASE}/repos/${repo}/contents/${fullPath}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${state.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: `Upload ${file.name} via OneCore`,
                    content: content,
                    branch: branch
                })
            });

            uploaded++;
            const percent = Math.round((uploaded / total) * 100);
            progressBar.style.width = `${percent}%`;
            percentageText.textContent = `${percent}%`;
        } catch (err) {
            console.error(err);
            showToast(`Failed: ${file.name}`, 'error');
        }
    }

    state.isUploading = false;
    progressText.textContent = "Upload Complete!";
    showToast(`Uploaded ${uploaded}/${total} items`);
    setTimeout(() => statusDiv.classList.add('hidden'), 3000);
}

function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function toggleTheme() {
    const newTheme = state.theme === 'neon-green' ? 'cyber-blue' : 'neon-green';
    setTheme(newTheme);
    renderTab('settings');
}

// --- Action Sheet Logic ---
function openActionSheet(title, subtitle, actions) {
    elements.sheetTitle.textContent = title;
    elements.sheetSubtitle.textContent = subtitle;
    elements.sheetActions.innerHTML = actions.map(action => `
        <button onclick="${action.handler}" class="sheet-item w-full flex items-center gap-4 px-4 rounded-2xl hover:bg-white/5 transition-all active:scale-[0.98]">
            <div class="w-10 h-10 flex items-center justify-center text-white/40">
                <i class="fas ${action.icon} text-sm"></i>
            </div>
            <span class="text-xs font-black text-white uppercase tracking-tight">${action.label}</span>
        </button>
    `).join('');
    
    elements.actionSheetOverlay.classList.remove('hidden');
    setTimeout(() => elements.actionSheet.classList.add('open'), 10);
}

function closeActionSheet() {
    elements.actionSheet.classList.remove('open');
    setTimeout(() => elements.actionSheetOverlay.classList.add('hidden'), 300);
}

function openRepoActionSheet(fullName, name) {
    const actions = [
        { label: 'Open Repository', icon: 'fa-external-link-alt', handler: `selectRepo('${fullName}')` },
        { label: 'Delete Repository', icon: 'fa-trash-alt text-red-500', handler: `confirmDeleteRepo('${fullName}')` }
    ];
    openActionSheet(name, 'Repository', actions);
}

function openItemActionSheet(path, name, type, downloadUrl) {
    const isDir = type === 'dir';
    let actions = [];
    
    if (isDir) {
        actions = [
            { label: 'Open Folder', icon: 'fa-folder-open', handler: `navigatePath('${path}')` },
            { label: 'New File', icon: 'fa-plus', handler: `promptNewFile()` },
            { label: 'New Folder', icon: 'fa-folder-plus', handler: `promptNewFolder()` },
            { label: 'Rename', icon: 'fa-edit', handler: `confirmRename('${path}', '${name}', true)` },
            { label: 'Download ZIP', icon: 'fa-file-archive', handler: `downloadFolderAsZip('${path}', '${name}')` },
            { label: 'Delete', icon: 'fa-trash-alt text-red-500', handler: `confirmDelete('${path}', '${name}', true)` }
        ];
    } else {
        actions = [
            { label: 'Edit File', icon: 'fa-edit', handler: `editFile('${path}', '${name}')` },
            { label: 'Rename', icon: 'fa-signature', handler: `confirmRename('${path}', '${name}', false)` },
            { label: 'Download', icon: 'fa-download', handler: `downloadFile('${downloadUrl}', '${name}')` },
            { label: 'Copy Path', icon: 'fa-copy', handler: `copyToClipboard('${path}')` },
            { label: 'Delete', icon: 'fa-trash-alt text-red-500', handler: `confirmDelete('${path}', '${name}', false)` }
        ];
    }
    
    openActionSheet(name, isDir ? 'Folder' : 'File', actions);
}

async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        showToast("Path copied to clipboard");
    } catch (err) {
        showToast("Failed to copy", "error");
    }
    closeActionSheet();
}

async function editorAction(action) {
    const textarea = elements.editContent;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = textarea.value.substring(start, end);

    try {
        if (action === 'copy') {
            if (selectedText) {
                await navigator.clipboard.writeText(selectedText);
                showToast("Copied to clipboard");
            }
        } else if (action === 'cut') {
            if (selectedText) {
                await navigator.clipboard.writeText(selectedText);
                textarea.value = textarea.value.substring(0, start) + textarea.value.substring(end);
                showToast("Cut to clipboard");
            }
        } else if (action === 'paste') {
            const text = await navigator.clipboard.readText();
            textarea.value = textarea.value.substring(0, start) + text + textarea.value.substring(end);
            showToast("Pasted from clipboard");
        }
    } catch (err) {
        showToast("Clipboard access denied", "error");
    }
}
function getFileIcon(name) {
    const ext = name.split('.').pop().toLowerCase();
    const icons = {
        'js': 'fa-js text-yellow-400',
        'ts': 'fa-code text-blue-400',
        'html': 'fa-html5 text-orange-500',
        'css': 'fa-css3 text-blue-400',
        'json': 'fa-code accent-text',
        'md': 'fa-file-alt text-white/40',
        'png': 'fa-image accent-text',
        'jpg': 'fa-image accent-text',
        'svg': 'fa-image accent-text',
        'pdf': 'fa-file-pdf text-red-500',
        'zip': 'fa-file-archive accent-text'
    };
    return icons[ext] || 'fa-file text-white/20';
}

function isTextFile(name) {
    const ext = name.split('.').pop().toLowerCase();
    const textExts = ['js', 'ts', 'html', 'css', 'json', 'md', 'txt', 'yml', 'yaml', 'xml', 'env', 'gitignore'];
    return textExts.includes(ext);
}

function formatSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function showToast(message, type = 'success', duration = 3000) {
    elements.toast.textContent = message;
    elements.toast.className = `fixed bottom-28 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full text-[10px] font-black shadow-2xl transition-all pointer-events-none z-[200] uppercase tracking-widest ${type === 'error' ? 'bg-red-600 text-white' : 'accent-bg text-black'}`;
    elements.toast.classList.add('opacity-100', 'bottom-32');
    setTimeout(() => {
        elements.toast.classList.remove('opacity-100', 'bottom-32');
    }, duration);
}

function showGlobalLoader(show) {
    elements.globalLoader.classList.toggle('hidden', !show);
}

function openModal(id) {
    document.getElementById(id).classList.remove('hidden');
}

function closeModal(id) {
    document.getElementById(id).classList.add('hidden');
}

// Service Worker Registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').then(reg => {
            console.log('SW registered');
        }).catch(err => {
            console.log('SW failed', err);
        });
    });
}

// Export functions to window for onclick attributes
window.selectRepo = selectRepo;
window.navigatePath = navigatePath;
window.switchTab = switchTab;
window.downloadFile = downloadFile;
window.downloadFolderAsZip = downloadFolderAsZip;
window.logout = logout;
window.setTheme = setTheme;
window.closeModal = closeModal;
window.handleFileClick = handleFileClick;
window.confirmDelete = confirmDelete;
window.confirmRename = confirmRename;
window.promptNewFile = promptNewFile;
window.promptNewFolder = promptNewFolder;
window.confirmDeleteRepo = confirmDeleteRepo;
window.openRepoActionSheet = openRepoActionSheet;
window.openItemActionSheet = openItemActionSheet;
window.closeActionSheet = closeActionSheet;
window.toggleTheme = toggleTheme;
window.editorAction = editorAction;
window.copyToClipboard = copyToClipboard;

init();
