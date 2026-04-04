/**
 * OneCore GitHub File Manager - Core Logic
 * Author: AI Studio Build
 */

const GITHUB_API_BASE = "https://api.github.com";
const GITHUB_AUTH_BASE = "https://github.com/login/oauth/authorize";

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
    isUploading: false
};

// DOM Elements
const elements = {
    authScreen: document.getElementById('auth-screen'),
    loginInitial: document.getElementById('login-initial'),
    loginLoading: document.getElementById('login-loading'),
    btnLogin: document.getElementById('btn-login'),
    appContainer: document.getElementById('app-container'),
    bottomNav: document.getElementById('bottom-nav'),
    viewTitle: document.getElementById('view-title'),
    content: document.getElementById('content'),
    userAvatar: document.getElementById('user-avatar'),
    navItems: document.querySelectorAll('.nav-item'),
    toast: document.getElementById('toast'),
    btnRefresh: document.getElementById('btn-refresh')
};

// --- PKCE Helpers ---
function generateRandomString(length) {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    let result = '';
    const values = new Uint32Array(length);
    crypto.getRandomValues(values);
    for (let i = 0; i < length; i++) {
        result += charset[values[i] % charset.length];
    }
    return result;
}

async function sha256(plain) {
    const encoder = new TextEncoder();
    const data = encoder.encode(plain);
    return crypto.subtle.digest('SHA-256', data);
}

function base64urlencode(a) {
    let str = "";
    const bytes = new Uint8Array(a);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        str += String.fromCharCode(bytes[i]);
    }
    return btoa(str)
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
}

async function generateCodeChallenge(v) {
    const hashed = await sha256(v);
    return base64urlencode(hashed);
}

// --- Initialization ---
async function init() {
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
    elements.btnLogin.addEventListener('click', startOAuthFlow);
    
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

    // Handle back button for file explorer
    window.addEventListener('popstate', (e) => {
        if (state.currentRepo) {
            const path = e.state ? e.state.path : '';
            navigatePath(path, false);
        }
    });

    // Listen for message from popup
    window.addEventListener('message', (event) => {
        if (event.origin !== window.location.origin) return;
        
        if (event.data.access_token) {
            handleLoginSuccess(event.data.access_token);
        } else if (event.data.error) {
            showToast(event.data.error, 'error');
            elements.loginInitial.classList.remove('hidden');
            elements.loginLoading.classList.add('hidden');
        }
    });
}

// --- Authentication (OAuth PKCE) ---
async function startOAuthFlow() {
    const clientId = "YOUR_GITHUB_CLIENT_ID"; // This will be used in the popup if not set in server env
    // Note: In our server.ts, we use process.env.GITHUB_CLIENT_ID
    // But we still need to pass it to the authorize URL
    
    // We'll try to get it from a meta tag or just assume it's set in the server
    // For the client-side authorize call, we need the ID.
    // I'll add a way to set it in settings or just use a placeholder.
    const effectiveClientId = localStorage.getItem('gh_client_id') || "YOUR_GITHUB_CLIENT_ID";

    if (effectiveClientId === "YOUR_GITHUB_CLIENT_ID") {
        showToast("Please set Client ID in Settings first", 'error');
        // We can't switch tab if not logged in, so we'll just show a message
        return;
    }

    const codeVerifier = generateRandomString(64);
    sessionStorage.setItem('gh_code_verifier', codeVerifier);
    const codeChallenge = await generateCodeChallenge(codeVerifier);

    const redirectUri = window.location.origin + '/callback.html';
    const scope = 'repo user';
    
    const authUrl = `${GITHUB_AUTH_BASE}?client_id=${effectiveClientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&response_type=code&code_challenge=${codeChallenge}&code_challenge_method=S256`;

    elements.loginInitial.classList.add('hidden');
    elements.loginLoading.classList.remove('hidden');

    const width = 600;
    const height = 700;
    const left = (window.screen.width / 2) - (width / 2);
    const top = (window.screen.height / 2) - (height / 2);
    
    window.open(authUrl, 'GitHub Login', `width=${width},height=${height},top=${top},left=${left}`);
}

async function handleLoginSuccess(token) {
    state.token = token;
    localStorage.setItem('gh_access_token', token);
    try {
        await fetchUserProfile();
        showApp();
        renderTab('home');
        showToast("Login successful!");
    } catch (err) {
        showToast("Failed to fetch profile", 'error');
        logout();
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
                <div class="glass-card p-6 rounded-3xl border-violet-500/20">
                    <h3 class="text-xl font-black text-white tracking-tight">Welcome, ${state.user.name || state.user.login}!</h3>
                    <p class="text-xs text-violet-300/60 mt-1 font-bold uppercase tracking-widest">Select a repository to start managing files.</p>
                </div>
                <div class="flex items-center justify-between px-2">
                    <h4 class="text-[10px] font-black text-violet-300/40 uppercase tracking-widest">Recent Repositories</h4>
                    <button onclick="switchTab('repos')" class="text-[10px] font-black text-violet-400 uppercase tracking-widest">View All</button>
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
                <div class="glass-card p-5 rounded-3xl flex items-center justify-between active:scale-95 transition-all border-violet-900/20" onclick="selectRepo('${repo.full_name}')">
                    <div class="flex items-center gap-4">
                        <div class="w-12 h-12 bg-violet-900/20 rounded-2xl flex items-center justify-center text-violet-400">
                            <i class="fas fa-book text-lg"></i>
                        </div>
                        <div>
                            <h3 class="font-black text-white text-sm tracking-tight">${repo.name}</h3>
                            <p class="text-[10px] text-violet-300/40 font-bold uppercase tracking-widest mt-0.5">${repo.private ? '<i class="fas fa-lock mr-1 text-violet-500/60"></i>Private' : '<i class="fas fa-globe mr-1 text-violet-500/60"></i>Public'}</p>
                        </div>
                    </div>
                    <i class="fas fa-chevron-right text-violet-300/20 text-xs"></i>
                </div>
            `).join('') || '<p class="text-center text-violet-300/40 py-10 font-bold uppercase tracking-widest text-[10px]">No repositories found</p>';
        }
    } else {
        elements.viewTitle.textContent = state.currentRepo.name;
        renderBreadcrumbs();
        renderContentsList();
    }
}

async function renderRepos() {
    await fetchUserRepos();
    renderRepoList();
}

function renderRepoList() {
    elements.content.innerHTML = `
        <div class="space-y-4">
            <div class="relative">
                <i class="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-violet-300/20 text-sm"></i>
                <input id="repo-search" type="text" placeholder="Search repositories..." class="w-full bg-violet-900/10 border border-violet-900/30 rounded-2xl py-4 pl-12 pr-4 text-sm text-white outline-none focus:border-violet-500/50 transition-all font-medium">
            </div>
            <div id="repo-list-container" class="space-y-3">
                ${state.repos.map(repo => `
                    <div class="glass-card p-5 rounded-3xl flex items-center justify-between active:scale-95 transition-all border-violet-900/20" onclick="selectRepo('${repo.full_name}')">
                        <div class="flex items-center gap-4">
                            <div class="w-12 h-12 bg-violet-900/20 rounded-2xl flex items-center justify-center text-violet-400 shadow-inner">
                                <i class="fas fa-book text-lg"></i>
                            </div>
                            <div>
                                <h3 class="font-black text-white text-sm tracking-tight">${repo.name}</h3>
                                <p class="text-[10px] text-violet-300/40 font-bold uppercase tracking-widest mt-0.5">${repo.private ? '<i class="fas fa-lock mr-1 text-violet-500/60"></i>Private' : '<i class="fas fa-globe mr-1 text-violet-500/60"></i>Public'}</p>
                            </div>
                        </div>
                        <i class="fas fa-chevron-right text-violet-300/20 text-xs"></i>
                    </div>
                `).join('')}
            </div>
        </div>
    `;

    document.getElementById('repo-search').oninput = (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = state.repos.filter(r => r.name.toLowerCase().includes(term));
        document.getElementById('repo-list-container').innerHTML = filtered.map(repo => `
            <div class="glass-card p-5 rounded-3xl flex items-center justify-between active:scale-95 transition-all border-violet-900/20" onclick="selectRepo('${repo.full_name}')">
                <div class="flex items-center gap-4">
                    <div class="w-12 h-12 bg-violet-900/20 rounded-2xl flex items-center justify-center text-violet-400 shadow-inner">
                        <i class="fas fa-book text-lg"></i>
                    </div>
                    <div>
                        <h3 class="font-black text-white text-sm tracking-tight">${repo.name}</h3>
                        <p class="text-[10px] text-violet-300/40 font-bold uppercase tracking-widest mt-0.5">${repo.private ? '<i class="fas fa-lock mr-1 text-violet-500/60"></i>Private' : '<i class="fas fa-globe mr-1 text-violet-500/60"></i>Public'}</p>
                    </div>
                </div>
                <i class="fas fa-chevron-right text-violet-300/20 text-xs"></i>
            </div>
        `).join('');
    };
}

function renderBreadcrumbs() {
    const parts = state.currentPath ? state.currentPath.split('/') : [];
    let html = `
        <div class="flex items-center gap-2 overflow-x-auto no-scrollbar py-2 text-[10px] font-black uppercase tracking-widest text-violet-300/40">
            <span class="hover:text-violet-400 cursor-pointer bg-violet-900/20 px-3 py-1.5 rounded-lg border border-violet-500/10" onclick="navigatePath('')">Root</span>
    `;
    
    let path = '';
    parts.forEach((part, i) => {
        path += (i === 0 ? '' : '/') + part;
        html += `
            <i class="fas fa-chevron-right text-[8px] text-violet-300/10"></i>
            <span class="hover:text-violet-400 cursor-pointer ${i === parts.length - 1 ? 'text-violet-400' : ''}" onclick="navigatePath('${path}')">${part}</span>
        `;
    });
    
    html += `</div>`;
    elements.content.insertAdjacentHTML('afterbegin', html);
}

function renderContentsList() {
    const listHtml = state.contents.map(item => {
        const isDir = item.type === 'dir';
        const icon = isDir ? 'fa-folder text-violet-400' : getFileIcon(item.name);
        return `
            <div class="glass-card p-4 rounded-2xl flex items-center justify-between group border-violet-900/20 active:scale-95 transition-all">
                <div class="flex items-center gap-4 flex-1 min-w-0" onclick="${isDir ? `navigatePath('${item.path}')` : `downloadFile('${item.download_url}', '${item.name}')`}">
                    <div class="w-10 h-10 bg-violet-900/10 rounded-xl flex items-center justify-center ${isDir ? 'text-violet-400' : 'text-violet-300/40'}">
                        <i class="fas ${icon} text-lg"></i>
                    </div>
                    <div class="min-w-0">
                        <h4 class="text-xs font-black text-white truncate tracking-tight">${item.name}</h4>
                        <p class="text-[9px] text-violet-300/40 font-black uppercase tracking-widest mt-0.5">${isDir ? 'Folder' : formatSize(item.size)}</p>
                    </div>
                </div>
                <div class="flex items-center gap-2">
                    ${isDir ? `
                        <button onclick="downloadFolderAsZip('${item.path}', '${item.name}')" class="p-2 text-violet-400/40 hover:text-violet-400 transition-colors">
                            <i class="fas fa-file-archive"></i>
                        </button>
                    ` : `
                        <button onclick="downloadFile('${item.download_url}', '${item.name}')" class="p-2 text-violet-400/40 hover:text-violet-400 transition-colors">
                            <i class="fas fa-download"></i>
                        </button>
                    `}
                </div>
            </div>
        `;
    }).join('') || '<p class="text-center text-violet-300/40 py-10 font-black uppercase tracking-widest text-[10px]">This folder is empty</p>';
    
    const headerHtml = `
        <div class="flex items-center justify-between px-2 mb-4 mt-6">
            <h4 class="text-[10px] font-black text-violet-300/40 uppercase tracking-widest">Files & Folders</h4>
            <button onclick="downloadFolderAsZip('${state.currentPath}', '${state.currentRepo.name}')" class="text-[10px] font-black text-violet-400 uppercase tracking-widest bg-violet-900/20 px-3 py-1.5 rounded-lg border border-violet-500/20 active:scale-95 transition-all">
                <i class="fas fa-file-archive mr-1"></i> Download ZIP
            </button>
        </div>
    `;
    
    elements.content.insertAdjacentHTML('beforeend', headerHtml + `<div class="space-y-2">${listHtml}</div>`);
}

function renderUpload() {
    elements.viewTitle.textContent = "Upload Files";
    elements.content.innerHTML = `
        <div class="space-y-6">
            <div class="glass-card p-6 rounded-3xl space-y-4 border-violet-900/20">
                <h4 class="text-[10px] font-black text-violet-400 uppercase tracking-widest">Target Repository</h4>
                <select id="upload-repo" class="w-full bg-violet-900/10 border border-violet-900/30 rounded-2xl p-4 text-sm text-white outline-none focus:border-violet-500/50 appearance-none font-bold">
                    <option value="">Select a repository</option>
                    ${state.repos.map(r => `<option value="${r.full_name}">${r.full_name}</option>`).join('')}
                </select>
                
                <div class="grid grid-cols-2 gap-4">
                    <div class="space-y-2">
                        <label class="text-[10px] font-black text-violet-300/40 uppercase tracking-widest ml-1">Branch</label>
                        <input id="upload-branch" type="text" value="main" class="w-full bg-violet-900/10 border border-violet-900/30 rounded-2xl p-4 text-sm text-white outline-none focus:border-violet-500/50 font-bold transition-all">
                    </div>
                    <div class="space-y-2">
                        <label class="text-[10px] font-black text-violet-300/40 uppercase tracking-widest ml-1">Path</label>
                        <input id="upload-path" type="text" placeholder="root/" class="w-full bg-violet-900/10 border border-violet-900/30 rounded-2xl p-4 text-sm text-white outline-none focus:border-violet-500/50 font-bold transition-all">
                    </div>
                </div>
            </div>

            <div class="grid grid-cols-2 gap-4">
                <label class="glass-card p-6 rounded-3xl flex flex-col items-center justify-center gap-4 cursor-pointer active:scale-95 transition-all border-violet-900/20 border-dashed border-2 hover:border-violet-500/30">
                    <div class="w-12 h-12 bg-violet-900/20 rounded-2xl flex items-center justify-center text-violet-400">
                        <i class="fas fa-file-alt text-xl"></i>
                    </div>
                    <span class="text-[10px] font-black uppercase tracking-widest text-violet-300/60">Select Files</span>
                    <input type="file" id="file-input" multiple class="hidden">
                </label>
                <label class="glass-card p-6 rounded-3xl flex flex-col items-center justify-center gap-4 cursor-pointer active:scale-95 transition-all border-violet-900/20 border-dashed border-2 hover:border-violet-500/30">
                    <div class="w-12 h-12 bg-violet-900/20 rounded-2xl flex items-center justify-center text-violet-400">
                        <i class="fas fa-folder-open text-xl"></i>
                    </div>
                    <span class="text-[10px] font-black uppercase tracking-widest text-violet-300/60">Select Folder</span>
                    <input type="file" id="folder-input" webkitdirectory class="hidden">
                </label>
            </div>

            <div id="upload-status" class="hidden glass-card p-6 rounded-3xl space-y-4 border-violet-500/20">
                <div class="flex justify-between text-[10px] font-black uppercase tracking-widest">
                    <span id="upload-progress-text" class="text-violet-400">Uploading...</span>
                    <span id="upload-percentage" class="text-white">0%</span>
                </div>
                <div class="h-2 bg-violet-900/20 rounded-full overflow-hidden">
                    <div id="upload-progress-bar" class="h-full bg-violet-500 transition-all duration-300 shadow-[0_0_10px_rgba(139,92,246,0.5)]" style="width: 0%"></div>
                </div>
            </div>

            <button id="btn-start-upload" class="w-full btn-primary font-black py-4 rounded-2xl shadow-lg uppercase tracking-widest text-xs disabled:opacity-30 transition-all" disabled>
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
    const currentClientId = localStorage.getItem('gh_client_id') || "YOUR_GITHUB_CLIENT_ID";
    elements.viewTitle.textContent = "Settings";
    elements.content.innerHTML = `
        <div class="space-y-6">
            <div class="glass-card p-6 rounded-3xl flex items-center gap-5 border-violet-900/20">
                <div class="relative">
                    <img src="${state.user.avatar_url}" class="w-20 h-20 rounded-2xl border-2 border-violet-500/20 shadow-lg">
                    <div class="absolute -bottom-1 -right-1 w-6 h-6 bg-violet-500 rounded-full border-4 border-[#0f0a1f] shadow-lg"></div>
                </div>
                <div>
                    <h3 class="text-xl font-black text-white tracking-tighter">${state.user.name || state.user.login}</h3>
                    <p class="text-[10px] text-violet-400 font-black uppercase tracking-widest mt-1">@${state.user.login}</p>
                </div>
            </div>

            <div class="glass-card p-6 rounded-3xl space-y-4 border-violet-900/20">
                <h4 class="text-[10px] font-black text-violet-400 uppercase tracking-widest">Configuration</h4>
                <div class="space-y-3">
                    <label class="text-[10px] font-black text-violet-300/40 uppercase tracking-widest ml-1">GitHub Client ID</label>
                    <div class="flex gap-2">
                        <input id="settings-client-id" type="text" value="${currentClientId === 'YOUR_GITHUB_CLIENT_ID' ? '' : currentClientId}" placeholder="Enter Client ID" class="flex-1 bg-violet-900/10 border border-violet-900/30 rounded-2xl p-4 text-xs text-white outline-none focus:border-violet-500/50 font-bold transition-all">
                        <button id="btn-save-client-id" class="btn-primary text-white px-6 rounded-2xl text-[10px] font-black uppercase tracking-widest">Save</button>
                    </div>
                    <p class="text-[9px] text-violet-300/30 font-bold uppercase tracking-tighter ml-1">Required for client-side authorize call.</p>
                </div>
            </div>

            <div class="glass-card rounded-3xl overflow-hidden divide-y divide-violet-900/20 border-violet-900/20">
                <div class="p-5 flex items-center justify-between">
                    <div class="flex items-center gap-4">
                        <div class="w-10 h-10 bg-violet-900/20 rounded-xl flex items-center justify-center text-violet-400">
                            <i class="fas fa-shield-alt"></i>
                        </div>
                        <span class="text-xs font-black text-white uppercase tracking-tight">Token Status</span>
                    </div>
                    <span class="text-[9px] bg-violet-900/20 text-violet-400 px-3 py-1.5 rounded-lg font-black uppercase tracking-widest border border-violet-500/20">Active</span>
                </div>
                <div class="p-5 flex items-center justify-between active:bg-red-500/5 transition-colors" onclick="logout()">
                    <div class="flex items-center gap-4 text-red-500">
                        <div class="w-10 h-10 bg-red-500/10 rounded-xl flex items-center justify-center">
                            <i class="fas fa-sign-out-alt"></i>
                        </div>
                        <span class="text-xs font-black uppercase tracking-tight">Sign Out</span>
                    </div>
                    <i class="fas fa-chevron-right text-violet-300/10 text-xs"></i>
                </div>
            </div>

            <div class="glass-card p-6 rounded-3xl space-y-5 border-violet-900/20">
                <h4 class="text-[10px] font-black text-violet-400 uppercase tracking-widest">Quick Setup Guide</h4>
                <div class="space-y-4 text-[11px] text-violet-300/50 font-medium leading-relaxed">
                    <div class="flex gap-4">
                        <span class="w-6 h-6 bg-violet-900/20 rounded-lg flex items-center justify-center text-[10px] font-black text-violet-400 shrink-0 border border-violet-500/10">1</span>
                        <p>Go to <span class="text-white">GitHub Settings</span> > <span class="text-white">Developer settings</span> > <span class="text-white">OAuth Apps</span>.</p>
                    </div>
                    <div class="flex gap-4">
                        <span class="w-6 h-6 bg-violet-900/20 rounded-lg flex items-center justify-center text-[10px] font-black text-violet-400 shrink-0 border border-violet-500/10">2</span>
                        <p>Click <span class="text-white">New OAuth App</span>. Set Homepage URL to this app's URL.</p>
                    </div>
                    <div class="flex gap-4">
                        <span class="w-6 h-6 bg-violet-900/20 rounded-lg flex items-center justify-center text-[10px] font-black text-violet-400 shrink-0 border border-violet-500/10">3</span>
                        <p>Set Callback URL to <span class="text-white">${window.location.origin}/callback.html</span>.</p>
                    </div>
                    <div class="flex gap-4">
                        <span class="w-6 h-6 bg-violet-900/20 rounded-lg flex items-center justify-center text-[10px] font-black text-violet-400 shrink-0 border border-violet-500/10">4</span>
                        <p>Copy the <span class="text-white">Client ID</span> and paste it above.</p>
                    </div>
                    <div class="flex gap-4">
                        <span class="w-6 h-6 bg-violet-900/20 rounded-lg flex items-center justify-center text-[10px] font-black text-violet-400 shrink-0 border border-violet-500/10">5</span>
                        <p>Set <span class="text-white">GITHUB_CLIENT_SECRET</span> in your server environment.</p>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.getElementById('btn-save-client-id').onclick = () => {
        const id = document.getElementById('settings-client-id').value.trim();
        if (id) {
            localStorage.setItem('gh_client_id', id);
            showToast("Client ID saved! Reloading...");
            setTimeout(() => location.reload(), 1500);
        }
    };
}

// --- API Actions ---
async function fetchUserRepos() {
    try {
        const res = await fetch(`${GITHUB_API_BASE}/user/repos?sort=updated&per_page=100`, {
            headers: { 'Authorization': `token ${state.token}` }
        });
        if (!res.ok) throw new Error("Failed to fetch repos");
        state.repos = await res.json();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function selectRepo(fullName) {
    state.currentRepo = state.repos.find(r => r.full_name === fullName);
    state.currentPath = '';
    state.breadcrumbs = [];
    await fetchRepoContents(state.currentRepo, '');
    renderTab('home');
    history.pushState({ path: '' }, '', '');
}

async function navigatePath(path, pushState = true) {
    state.currentPath = path;
    await fetchRepoContents(state.currentRepo, path);
    renderTab('home');
    if (pushState) history.pushState({ path }, '', '');
}

async function fetchRepoContents(repo, path) {
    try {
        const res = await fetch(`${GITHUB_API_BASE}/repos/${repo.full_name}/contents/${path}`, {
            headers: { 'Authorization': `token ${state.token}` }
        });
        if (!res.ok) throw new Error("Failed to fetch contents");
        state.contents = await res.json();
        state.contents.sort((a, b) => (a.type === 'dir' ? -1 : 1));
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// --- File Operations ---
function downloadFile(url, name) {
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast(`Downloading ${name}...`);
}

async function downloadFolderAsZip(path, folderName) {
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

// --- Helpers ---
function getFileIcon(name) {
    const ext = name.split('.').pop().toLowerCase();
    const icons = {
        'js': 'fa-js text-yellow-400',
        'html': 'fa-html5 text-orange-500',
        'css': 'fa-css3 text-blue-400',
        'json': 'fa-code text-violet-400',
        'md': 'fa-file-alt text-violet-300/40',
        'png': 'fa-image text-violet-400',
        'jpg': 'fa-image text-violet-400',
        'svg': 'fa-image text-violet-400',
        'pdf': 'fa-file-pdf text-red-500',
        'zip': 'fa-file-archive text-violet-400'
    };
    return icons[ext] || 'fa-file text-violet-300/20';
}

function formatSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function showToast(message, type = 'success') {
    elements.toast.textContent = message;
    elements.toast.className = `fixed bottom-24 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full text-sm font-bold shadow-2xl transition-all pointer-events-none z-[200] ${type === 'error' ? 'bg-red-600' : 'bg-violet-600'} text-white`;
    elements.toast.classList.add('opacity-100', 'bottom-28');
    setTimeout(() => {
        elements.toast.classList.remove('opacity-100', 'bottom-28');
    }, 3000);
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

init();
