/**
 * OneCore GitHub File Manager - Core Logic
 * 100% Client-Side GitHub OAuth PKCE
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
    isUploading: false
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
    btnRefresh: document.getElementById('btn-refresh')
};

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
        showToast("Login successful!");
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
                <div class="glass-card p-6 rounded-3xl border-[#39ff14]/20 relative overflow-hidden">
                    <div class="absolute top-0 right-0 w-32 h-32 bg-[#39ff14]/5 rounded-full -mr-16 -mt-16"></div>
                    <h3 class="text-2xl font-black text-white tracking-tighter">Welcome, ${state.user.name || state.user.login}!</h3>
                    <p class="text-[10px] text-[#39ff14]/60 mt-2 font-black uppercase tracking-[0.2em]">Select a repository to manage files.</p>
                </div>
                <div class="flex items-center justify-between px-2">
                    <h4 class="text-[10px] font-black text-[#39ff14]/40 uppercase tracking-widest">Recent Repositories</h4>
                    <button onclick="switchTab('repos')" class="text-[10px] font-black text-[#39ff14] uppercase tracking-widest">View All</button>
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
                <div class="glass-card p-5 rounded-3xl flex items-center justify-between active:scale-95 transition-all border-[#39ff14]/10" onclick="selectRepo('${repo.full_name}')">
                    <div class="flex items-center gap-4">
                        <div class="w-12 h-12 bg-[#39ff14]/10 rounded-2xl flex items-center justify-center text-[#39ff14]">
                            <i class="fas fa-book text-lg"></i>
                        </div>
                        <div>
                            <h3 class="font-black text-white text-sm tracking-tight">${repo.name}</h3>
                            <p class="text-[10px] text-[#39ff14]/40 font-black uppercase tracking-widest mt-0.5">${repo.private ? '<i class="fas fa-lock mr-1 text-[#39ff14]/60"></i>Private' : '<i class="fas fa-globe mr-1 text-[#39ff14]/60"></i>Public'}</p>
                        </div>
                    </div>
                    <i class="fas fa-chevron-right text-[#39ff14]/20 text-xs"></i>
                </div>
            `).join('') || '<p class="text-center text-[#39ff14]/40 py-10 font-black uppercase tracking-widest text-[10px]">No repositories found</p>';
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
                <i class="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-[#39ff14]/20 text-sm"></i>
                <input id="repo-search" type="text" placeholder="Search repositories..." class="w-full bg-[#39ff14]/5 border border-[#39ff14]/20 rounded-2xl py-5 pl-12 pr-4 text-sm text-white outline-none focus:border-[#39ff14]/50 transition-all font-bold uppercase tracking-tight">
            </div>
            <div id="repo-list-container" class="space-y-3">
                ${state.repos.map(repo => `
                    <div class="glass-card p-5 rounded-3xl flex items-center justify-between active:scale-95 transition-all border-[#39ff14]/10" onclick="selectRepo('${repo.full_name}')">
                        <div class="flex items-center gap-4">
                            <div class="w-12 h-12 bg-[#39ff14]/10 rounded-2xl flex items-center justify-center text-[#39ff14]">
                                <i class="fas fa-book text-lg"></i>
                            </div>
                            <div>
                                <h3 class="font-black text-white text-sm tracking-tight">${repo.name}</h3>
                                <p class="text-[10px] text-[#39ff14]/40 font-black uppercase tracking-widest mt-0.5">${repo.private ? '<i class="fas fa-lock mr-1 text-[#39ff14]/60"></i>Private' : '<i class="fas fa-globe mr-1 text-[#39ff14]/60"></i>Public'}</p>
                            </div>
                        </div>
                        <i class="fas fa-chevron-right text-[#39ff14]/20 text-xs"></i>
                    </div>
                `).join('')}
            </div>
        </div>
    `;

    document.getElementById('repo-search').oninput = (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = state.repos.filter(r => r.name.toLowerCase().includes(term));
        document.getElementById('repo-list-container').innerHTML = filtered.map(repo => `
            <div class="glass-card p-5 rounded-3xl flex items-center justify-between active:scale-95 transition-all border-[#39ff14]/10" onclick="selectRepo('${repo.full_name}')">
                <div class="flex items-center gap-4">
                    <div class="w-12 h-12 bg-[#39ff14]/10 rounded-2xl flex items-center justify-center text-[#39ff14]">
                        <i class="fas fa-book text-lg"></i>
                    </div>
                    <div>
                        <h3 class="font-black text-white text-sm tracking-tight">${repo.name}</h3>
                        <p class="text-[10px] text-[#39ff14]/40 font-black uppercase tracking-widest mt-0.5">${repo.private ? '<i class="fas fa-lock mr-1 text-[#39ff14]/60"></i>Private' : '<i class="fas fa-globe mr-1 text-[#39ff14]/60"></i>Public'}</p>
                    </div>
                </div>
                <i class="fas fa-chevron-right text-[#39ff14]/20 text-xs"></i>
            </div>
        `).join('');
    };
}

function renderBreadcrumbs() {
    const parts = state.currentPath ? state.currentPath.split('/') : [];
    let html = `
        <div class="flex items-center gap-2 overflow-x-auto no-scrollbar py-2 text-[10px] font-black uppercase tracking-widest text-[#39ff14]/40">
            <span class="hover:text-[#39ff14] cursor-pointer bg-[#39ff14]/10 px-3 py-1.5 rounded-lg border border-[#39ff14]/20" onclick="navigatePath('')">Root</span>
    `;
    
    let path = '';
    parts.forEach((part, i) => {
        path += (i === 0 ? '' : '/') + part;
        html += `
            <i class="fas fa-chevron-right text-[8px] text-[#39ff14]/10"></i>
            <span class="hover:text-[#39ff14] cursor-pointer ${i === parts.length - 1 ? 'text-[#39ff14]' : ''}" onclick="navigatePath('${path}')">${part}</span>
        `;
    });
    
    html += `</div>`;
    elements.content.insertAdjacentHTML('afterbegin', html);
}

function renderContentsList() {
    const listHtml = state.contents.map(item => {
        const isDir = item.type === 'dir';
        const icon = isDir ? 'fa-folder text-[#39ff14]' : getFileIcon(item.name);
        return `
            <div class="glass-card p-4 rounded-2xl flex items-center justify-between group border-[#39ff14]/10 active:scale-95 transition-all">
                <div class="flex items-center gap-4 flex-1 min-w-0" onclick="${isDir ? `navigatePath('${item.path}')` : `downloadFile('${item.download_url}', '${item.name}')`}">
                    <div class="w-10 h-10 bg-[#39ff14]/5 rounded-xl flex items-center justify-center ${isDir ? 'text-[#39ff14]' : 'text-[#39ff14]/40'}">
                        <i class="fas ${icon} text-lg"></i>
                    </div>
                    <div class="min-w-0">
                        <h4 class="text-xs font-black text-white truncate tracking-tight">${item.name}</h4>
                        <p class="text-[9px] text-[#39ff14]/40 font-black uppercase tracking-widest mt-0.5">${isDir ? 'Folder' : formatSize(item.size)}</p>
                    </div>
                </div>
                <div class="flex items-center gap-2">
                    ${isDir ? `
                        <button onclick="downloadFolderAsZip('${item.path}', '${item.name}')" class="p-2 text-[#39ff14]/40 hover:text-[#39ff14] transition-colors">
                            <i class="fas fa-file-archive"></i>
                        </button>
                    ` : `
                        <button onclick="downloadFile('${item.download_url}', '${item.name}')" class="p-2 text-[#39ff14]/40 hover:text-[#39ff14] transition-colors">
                            <i class="fas fa-download"></i>
                        </button>
                    `}
                </div>
            </div>
        `;
    }).join('') || '<p class="text-center text-[#39ff14]/40 py-10 font-black uppercase tracking-widest text-[10px]">This folder is empty</p>';
    
    const headerHtml = `
        <div class="flex items-center justify-between px-2 mb-4 mt-6">
            <h4 class="text-[10px] font-black text-[#39ff14]/40 uppercase tracking-widest">Files & Folders</h4>
            <button onclick="downloadFolderAsZip('${state.currentPath}', '${state.currentRepo.name}')" class="text-[10px] font-black text-[#39ff14] uppercase tracking-widest bg-[#39ff14]/10 px-3 py-1.5 rounded-lg border border-[#39ff14]/20 active:scale-95 transition-all">
                <i class="fas fa-file-archive mr-1"></i> Download ZIP
            </button>
        </div>
    `;
    
    elements.content.insertAdjacentHTML('beforeend', headerHtml + `<div class="space-y-2">${listHtml}</div>`);
}

function renderUpload() {
    elements.content.innerHTML = `
        <div class="space-y-6">
            <div class="glass-card p-6 rounded-3xl space-y-5 border-[#39ff14]/10">
                <h4 class="text-[10px] font-black text-[#39ff14] uppercase tracking-widest">Target Repository</h4>
                <select id="upload-repo" class="w-full bg-[#39ff14]/5 border border-[#39ff14]/20 rounded-2xl p-4 text-sm text-white outline-none focus:border-[#39ff14]/50 appearance-none font-black uppercase tracking-tight">
                    <option value="">Select a repository</option>
                    ${state.repos.map(r => `<option value="${r.full_name}">${r.full_name}</option>`).join('')}
                </select>
                
                <div class="grid grid-cols-2 gap-4">
                    <div class="space-y-2">
                        <label class="text-[10px] font-black text-[#39ff14]/40 uppercase tracking-widest ml-1">Branch</label>
                        <input id="upload-branch" type="text" value="main" class="w-full bg-[#39ff14]/5 border border-[#39ff14]/20 rounded-2xl p-4 text-sm text-white outline-none focus:border-[#39ff14]/50 font-black uppercase tracking-tight transition-all">
                    </div>
                    <div class="space-y-2">
                        <label class="text-[10px] font-black text-[#39ff14]/40 uppercase tracking-widest ml-1">Path</label>
                        <input id="upload-path" type="text" placeholder="root/" class="w-full bg-[#39ff14]/5 border border-[#39ff14]/20 rounded-2xl p-4 text-sm text-white outline-none focus:border-[#39ff14]/50 font-black uppercase tracking-tight transition-all">
                    </div>
                </div>
            </div>

            <div class="grid grid-cols-2 gap-4">
                <label class="glass-card p-6 rounded-3xl flex flex-col items-center justify-center gap-4 cursor-pointer active:scale-95 transition-all border-[#39ff14]/10 border-dashed border-2 hover:border-[#39ff14]/30">
                    <div class="w-12 h-12 bg-[#39ff14]/10 rounded-2xl flex items-center justify-center text-[#39ff14]">
                        <i class="fas fa-file-alt text-xl"></i>
                    </div>
                    <span class="text-[9px] font-black uppercase tracking-widest text-[#39ff14]/60">Select Files</span>
                    <input type="file" id="file-input" multiple class="hidden">
                </label>
                <label class="glass-card p-6 rounded-3xl flex flex-col items-center justify-center gap-4 cursor-pointer active:scale-95 transition-all border-[#39ff14]/10 border-dashed border-2 hover:border-[#39ff14]/30">
                    <div class="w-12 h-12 bg-[#39ff14]/10 rounded-2xl flex items-center justify-center text-[#39ff14]">
                        <i class="fas fa-folder-open text-xl"></i>
                    </div>
                    <span class="text-[9px] font-black uppercase tracking-widest text-[#39ff14]/60">Select Folder</span>
                    <input type="file" id="folder-input" webkitdirectory class="hidden">
                </label>
            </div>

            <div id="upload-status" class="hidden glass-card p-6 rounded-3xl space-y-4 border-[#39ff14]/20">
                <div class="flex justify-between text-[10px] font-black uppercase tracking-widest">
                    <span id="upload-progress-text" class="text-[#39ff14]">Uploading...</span>
                    <span id="upload-percentage" class="text-white">0%</span>
                </div>
                <div class="h-2 bg-[#39ff14]/10 rounded-full overflow-hidden">
                    <div id="upload-progress-bar" class="h-full bg-[#39ff14] transition-all duration-300 shadow-[0_0_15px_rgba(57,255,20,0.5)]" style="width: 0%"></div>
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
            <div class="glass-card p-6 rounded-3xl flex items-center gap-6 border-[#39ff14]/10 relative overflow-hidden">
                <div class="absolute top-0 right-0 w-32 h-32 bg-[#39ff14]/5 rounded-full -mr-16 -mt-16"></div>
                <div class="relative">
                    <img src="${state.user.avatar_url}" class="w-20 h-20 rounded-2xl border-2 border-[#39ff14]/20 shadow-2xl">
                    <div class="absolute -bottom-1 -right-1 w-6 h-6 bg-[#39ff14] rounded-full border-4 border-[#111111] shadow-lg"></div>
                </div>
                <div class="relative z-10">
                    <h3 class="text-2xl font-black text-white tracking-tighter leading-none">${state.user.name || state.user.login}</h3>
                    <p class="text-[10px] text-[#39ff14] font-black uppercase tracking-widest mt-2">@${state.user.login}</p>
                </div>
            </div>

            <div class="glass-card rounded-3xl overflow-hidden divide-y divide-[#39ff14]/10 border-[#39ff14]/10">
                <div class="p-5 flex items-center justify-between">
                    <div class="flex items-center gap-4">
                        <div class="w-10 h-10 bg-[#39ff14]/10 rounded-xl flex items-center justify-center text-[#39ff14]">
                            <i class="fas fa-shield-alt"></i>
                        </div>
                        <span class="text-xs font-black text-white uppercase tracking-tight">Auth Mode</span>
                    </div>
                    <span class="text-[9px] bg-[#39ff14]/10 text-[#39ff14] px-3 py-1.5 rounded-lg font-black uppercase tracking-widest border border-[#39ff14]/20">PAT Access</span>
                </div>
                <div class="p-5 flex items-center justify-between active:bg-red-500/5 transition-colors" onclick="logout()">
                    <div class="flex items-center gap-4 text-red-500">
                        <div class="w-10 h-10 bg-red-500/10 rounded-xl flex items-center justify-center">
                            <i class="fas fa-sign-out-alt"></i>
                        </div>
                        <span class="text-xs font-black uppercase tracking-tight">Sign Out</span>
                    </div>
                    <i class="fas fa-chevron-right text-[#39ff14]/10 text-xs"></i>
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
    await fetchRepoContents(state.currentRepo, '');
    renderTab('home');
}

async function navigatePath(path) {
    state.currentPath = path;
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
        'json': 'fa-code text-[#39ff14]',
        'md': 'fa-file-alt text-white/40',
        'png': 'fa-image text-[#39ff14]',
        'jpg': 'fa-image text-[#39ff14]',
        'svg': 'fa-image text-[#39ff14]',
        'pdf': 'fa-file-pdf text-red-500',
        'zip': 'fa-file-archive text-[#39ff14]'
    };
    return icons[ext] || 'fa-file text-white/20';
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
    elements.toast.className = `fixed bottom-28 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full text-xs font-black shadow-[0_0_30px_rgba(57,255,20,0.4)] transition-all pointer-events-none z-[200] uppercase tracking-widest ${type === 'error' ? 'bg-red-600 text-white' : 'bg-[#39ff14] text-black'}`;
    elements.toast.classList.add('opacity-100', 'bottom-32');
    setTimeout(() => {
        elements.toast.classList.remove('opacity-100', 'bottom-32');
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
