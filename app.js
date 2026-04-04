/**
 * OneCore GitHub Manager - Core Logic
 * Author: AI Studio Build
 */

const GITHUB_CLIENT_ID = "YOUR_GITHUB_CLIENT_ID"; // User to replace this
const GITHUB_API_BASE = "https://api.github.com";
const GITHUB_AUTH_BASE = "https://github.com/login";

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
    loginDevice: document.getElementById('login-device'),
    userCode: document.getElementById('user-code'),
    btnOpenGithub: document.getElementById('btn-open-github'),
    btnLogin: document.getElementById('btn-login'),
    appContainer: document.getElementById('app-container'),
    viewTitle: document.getElementById('view-title'),
    content: document.getElementById('content'),
    userAvatar: document.getElementById('user-avatar'),
    navItems: document.querySelectorAll('.nav-item'),
    toast: document.getElementById('toast'),
    btnRefresh: document.getElementById('btn-refresh')
};

// Initialization
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

// Event Listeners
function setupEventListeners() {
    elements.btnLogin.addEventListener('click', startDeviceFlow);
    
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
        if (e.state && e.state.path !== undefined) {
            state.currentPath = e.state.path;
            fetchRepoContents(state.currentRepo, state.currentPath);
        } else if (state.currentRepo) {
            state.currentRepo = null;
            state.currentPath = '';
            renderTab('home');
        }
    });
}

// --- Authentication (Device Flow) ---

async function startDeviceFlow() {
    elements.loginInitial.classList.add('hidden');
    elements.loginDevice.classList.remove('hidden');
    
    try {
        const res = await fetch(`${GITHUB_AUTH_BASE}/device/code`, {
            method: 'POST',
            headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
            body: JSON.stringify({ client_id: GITHUB_CLIENT_ID, scope: 'repo,user' })
        });
        
        const data = await res.json();
        if (data.error) throw new Error(data.error_description);

        elements.userCode.textContent = data.user_code;
        elements.btnOpenGithub.onclick = () => window.open(data.verification_uri, '_blank');
        
        pollForToken(data.device_code, data.interval || 5);
    } catch (err) {
        showToast(err.message, 'error');
        elements.loginInitial.classList.remove('hidden');
        elements.loginDevice.classList.add('hidden');
    }
}

async function pollForToken(deviceCode, interval) {
    const poll = setInterval(async () => {
        try {
            const res = await fetch(`${GITHUB_AUTH_BASE}/oauth/access_token`, {
                method: 'POST',
                headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    client_id: GITHUB_CLIENT_ID,
                    device_code: deviceCode,
                    grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
                })
            });
            
            const data = await res.json();
            
            if (data.access_token) {
                clearInterval(poll);
                state.token = data.access_token;
                localStorage.setItem('gh_access_token', state.token);
                await fetchUserProfile();
                showApp();
                renderTab('home');
            } else if (data.error !== 'authorization_pending') {
                clearInterval(poll);
                showToast(data.error_description || "Auth failed", 'error');
                elements.loginInitial.classList.remove('hidden');
                elements.loginDevice.classList.add('hidden');
            }
        } catch (err) {
            console.error("Polling error:", err);
        }
    }, interval * 1000);
}

async function fetchUserProfile() {
    const res = await fetch(`${GITHUB_API_BASE}/user`, {
        headers: { 'Authorization': `token ${state.token}` }
    });
    if (!res.ok) throw new Error("Failed to fetch profile");
    state.user = await res.json();
    
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
}

function showApp() {
    elements.authScreen.classList.add('hidden');
    elements.appContainer.classList.remove('hidden');
}

function switchTab(tab) {
    state.activeTab = tab;
    elements.navItems.forEach(item => {
        item.classList.toggle('active', item.getAttribute('data-tab') === tab);
    });
    
    // Reset explorer state when switching to home/repos
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
        elements.viewTitle.textContent = "Repositories";
        await fetchUserRepos();
        renderRepoList();
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
    elements.content.innerHTML = state.repos.map(repo => `
        <div class="glass-card p-4 rounded-2xl flex items-center justify-between active:scale-95 transition-transform" onclick="selectRepo('${repo.full_name}')">
            <div class="flex items-center gap-4">
                <div class="w-10 h-10 bg-purple-900/50 rounded-xl flex items-center justify-center text-purple-400">
                    <i class="fas fa-book"></i>
                </div>
                <div>
                    <h3 class="font-bold text-white text-sm">${repo.name}</h3>
                    <p class="text-[10px] text-muted-purple">${repo.private ? '<i class="fas fa-lock mr-1"></i>Private' : '<i class="fas fa-globe mr-1"></i>Public'}</p>
                </div>
            </div>
            <i class="fas fa-chevron-right text-muted-purple/40 text-xs"></i>
        </div>
    `).join('') || '<p class="text-center text-muted-purple py-10">No repositories found</p>';
}

function renderBreadcrumbs() {
    const parts = state.currentPath ? state.currentPath.split('/') : [];
    let html = `
        <div class="flex items-center gap-2 overflow-x-auto no-scrollbar py-2 text-xs font-bold uppercase tracking-widest text-muted-purple/60">
            <span class="hover:text-purple-400 cursor-pointer" onclick="navigatePath('')">Root</span>
    `;
    
    let path = '';
    parts.forEach((part, i) => {
        path += (i === 0 ? '' : '/') + part;
        html += `
            <i class="fas fa-chevron-right text-[8px]"></i>
            <span class="hover:text-purple-400 cursor-pointer ${i === parts.length - 1 ? 'text-purple-400' : ''}" onclick="navigatePath('${path}')">${part}</span>
        `;
    });
    
    html += `</div>`;
    elements.content.insertAdjacentHTML('afterbegin', html);
}

function renderContentsList() {
    const listHtml = state.contents.map(item => {
        const isDir = item.type === 'dir';
        const icon = isDir ? 'fa-folder text-yellow-500' : getFileIcon(item.name);
        return `
            <div class="glass-card p-3 rounded-xl flex items-center justify-between group">
                <div class="flex items-center gap-3 flex-1 min-w-0" onclick="${isDir ? `navigatePath('${item.path}')` : `downloadFile('${item.download_url}', '${item.name}')`}">
                    <i class="fas ${icon} text-lg w-6 text-center"></i>
                    <div class="min-w-0">
                        <h4 class="text-xs font-bold text-white truncate">${item.name}</h4>
                        <p class="text-[10px] text-muted-purple">${isDir ? 'Folder' : formatSize(item.size)}</p>
                    </div>
                </div>
                <div class="flex items-center gap-2">
                    ${isDir ? `
                        <button onclick="downloadFolderAsZip('${item.path}', '${item.name}')" class="p-2 text-purple-400 hover:text-purple-300">
                            <i class="fas fa-file-archive"></i>
                        </button>
                    ` : `
                        <button onclick="downloadFile('${item.download_url}', '${item.name}')" class="p-2 text-purple-400 hover:text-purple-300">
                            <i class="fas fa-download"></i>
                        </button>
                    `}
                </div>
            </div>
        `;
    }).join('') || '<p class="text-center text-muted-purple py-10">This folder is empty</p>';
    
    elements.content.insertAdjacentHTML('beforeend', `<div class="space-y-2">${listHtml}</div>`);
}

function renderUpload() {
    elements.content.innerHTML = `
        <div class="space-y-6">
            <div class="glass-card p-6 rounded-2xl space-y-4">
                <h3 class="text-sm font-bold text-white uppercase tracking-widest">Target Repository</h3>
                <select id="upload-repo" class="w-full bg-[#0d0b1a] border border-purple-900/50 rounded-xl p-3 text-sm text-white outline-none focus:border-purple-500">
                    ${state.repos.map(r => `<option value="${r.full_name}">${r.full_name}</option>`).join('')}
                </select>
                
                <div class="grid grid-cols-2 gap-4">
                    <div class="space-y-2">
                        <label class="text-[10px] font-bold text-muted-purple uppercase">Branch</label>
                        <input id="upload-branch" type="text" value="main" class="w-full bg-[#05040a] border border-purple-900/50 rounded-xl p-3 text-sm text-white outline-none focus:border-purple-500">
                    </div>
                    <div class="space-y-2">
                        <label class="text-[10px] font-bold text-muted-purple uppercase">Path</label>
                        <input id="upload-path" type="text" placeholder="root/" class="w-full bg-[#05040a] border border-purple-900/50 rounded-xl p-3 text-sm text-white outline-none focus:border-purple-500">
                    </div>
                </div>
            </div>

            <div class="grid grid-cols-2 gap-4">
                <label class="glass-card p-6 rounded-2xl flex flex-col items-center justify-center gap-3 cursor-pointer active:scale-95 transition-all">
                    <i class="fas fa-file-alt text-2xl text-purple-400"></i>
                    <span class="text-[10px] font-black uppercase">Select Files</span>
                    <input type="file" id="file-input" multiple class="hidden">
                </label>
                <label class="glass-card p-6 rounded-2xl flex flex-col items-center justify-center gap-3 cursor-pointer active:scale-95 transition-all">
                    <i class="fas fa-folder-open text-2xl text-purple-400"></i>
                    <span class="text-[10px] font-black uppercase">Select Folder</span>
                    <input type="file" id="folder-input" webkitdirectory class="hidden">
                </label>
            </div>

            <div id="upload-status" class="hidden glass-card p-4 rounded-2xl space-y-3">
                <div class="flex justify-between text-[10px] font-bold uppercase">
                    <span id="upload-progress-text">Uploading...</span>
                    <span id="upload-percentage">0%</span>
                </div>
                <div class="h-2 bg-purple-900/30 rounded-full overflow-hidden">
                    <div id="upload-progress-bar" class="h-full bg-purple-500 transition-all duration-300" style="width: 0%"></div>
                </div>
            </div>

            <button id="btn-start-upload" class="w-full bg-purple-600 text-white font-black py-4 rounded-2xl shadow-lg shadow-purple-500/20 uppercase tracking-widest disabled:opacity-50" disabled>
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
            <div class="glass-card p-6 rounded-2xl flex items-center gap-4">
                <img src="${state.user.avatar_url}" class="w-16 h-16 rounded-2xl border-2 border-purple-500/30">
                <div>
                    <h3 class="text-lg font-bold text-white">${state.user.name || state.user.login}</h3>
                    <p class="text-xs text-muted-purple">@${state.user.login}</p>
                </div>
            </div>

            <div class="glass-card rounded-2xl overflow-hidden divide-y divide-purple-900/30">
                <div class="p-4 flex items-center justify-between">
                    <div class="flex items-center gap-3">
                        <i class="fas fa-key text-purple-400"></i>
                        <span class="text-xs font-bold">Token Status</span>
                    </div>
                    <span class="text-[10px] bg-green-500/20 text-green-400 px-2 py-1 rounded-full font-black uppercase">Active</span>
                </div>
                <div class="p-4 flex items-center justify-between" onclick="logout()">
                    <div class="flex items-center gap-3 text-red-400">
                        <i class="fas fa-sign-out-alt"></i>
                        <span class="text-xs font-bold">Sign Out</span>
                    </div>
                    <i class="fas fa-chevron-right text-muted-purple/40 text-xs"></i>
                </div>
            </div>

            <div class="glass-card p-6 rounded-2xl space-y-4">
                <h4 class="text-[10px] font-black text-purple-400 uppercase tracking-widest">Developer Info</h4>
                <div class="space-y-2 text-xs text-muted-purple/80 leading-relaxed">
                    <p><strong>How to setup:</strong></p>
                    <ol class="list-decimal ml-4 space-y-1">
                        <li>Go to GitHub Settings > Developer settings.</li>
                        <li>OAuth Apps > New OAuth App.</li>
                        <li>Set name and homepage.</li>
                        <li>Copy <strong>Client ID</strong> to app.js.</li>
                        <li>Enable <strong>Device Flow</strong> in app settings.</li>
                    </ol>
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
    // Push state for back navigation
    history.pushState({ path: '' }, '', '');
}

async function navigatePath(path) {
    state.currentPath = path;
    await fetchRepoContents(state.currentRepo, path);
    renderTab('home');
    history.pushState({ path }, '', '');
}

async function fetchRepoContents(repo, path) {
    try {
        const res = await fetch(`${GITHUB_API_BASE}/repos/${repo.full_name}/contents/${path}`, {
            headers: { 'Authorization': `token ${state.token}` }
        });
        if (!res.ok) throw new Error("Failed to fetch contents");
        state.contents = await res.json();
        // Sort: directories first
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

// --- Bulk Upload ---

async function startBulkUpload() {
    const repoFullName = document.getElementById('upload-repo').value;
    const branch = document.getElementById('upload-branch').value;
    const targetPath = document.getElementById('upload-path').value.replace(/^\/|\/$/g, '');
    const statusDiv = document.getElementById('upload-status');
    const progressBar = document.getElementById('upload-progress-bar');
    const progressText = document.getElementById('upload-progress-text');
    const percentageText = document.getElementById('upload-percentage');
    const btnStart = document.getElementById('btn-start-upload');

    if (state.isUploading) return;
    state.isUploading = true;
    btnStart.disabled = true;
    statusDiv.classList.remove('hidden');

    const total = state.uploadQueue.length;
    let successCount = 0;

    for (let i = 0; i < total; i++) {
        const file = state.uploadQueue[i];
        const relativePath = file.webkitRelativePath || file.name;
        const fullPath = targetPath ? `${targetPath}/${relativePath}` : relativePath;
        
        progressText.textContent = `Uploading: ${file.name}`;
        
        try {
            const base64 = await toBase64(file);
            const res = await fetch(`${GITHUB_API_BASE}/repos/${repoFullName}/contents/${fullPath}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${state.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: `Upload ${file.name} via OneCore`,
                    content: base64.split(',')[1],
                    branch: branch
                })
            });

            if (res.ok) successCount++;
        } catch (err) {
            console.error(`Failed to upload ${file.name}:`, err);
        }

        const pct = Math.round(((i + 1) / total) * 100);
        progressBar.style.width = `${pct}%`;
        percentageText.textContent = `${pct}%`;
    }

    state.isUploading = false;
    btnStart.disabled = false;
    progressText.textContent = `Completed: ${successCount}/${total} uploaded`;
    showToast(`Upload finished: ${successCount} files success.`);
}

// --- Helpers ---

function toBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

function getFileIcon(name) {
    const ext = name.split('.').pop().toLowerCase();
    const icons = {
        'js': 'fa-js text-yellow-400',
        'html': 'fa-html5 text-orange-500',
        'css': 'fa-css3 text-blue-400',
        'json': 'fa-code text-purple-400',
        'md': 'fa-file-alt text-muted-purple/60',
        'png': 'fa-image text-green-400',
        'jpg': 'fa-image text-green-400',
        'svg': 'fa-image text-green-400',
        'pdf': 'fa-file-pdf text-red-500',
        'zip': 'fa-file-archive text-purple-500'
    };
    return icons[ext] || 'fa-file text-muted-purple/40';
}

function formatSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function showToast(msg, type = 'info') {
    elements.toast.textContent = msg;
    elements.toast.style.backgroundColor = type === 'error' ? '#ef4444' : '#7c3aed';
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

init();
