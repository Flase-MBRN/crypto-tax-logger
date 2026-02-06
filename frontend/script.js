// ==============================================
// API CONFIGURATION
// ==============================================

const API_BASE_URL = 'https://crypto-tax-logger-clean.onrender.com';
let AUTH_TOKEN = localStorage.getItem('auth_token') || null;

// API Helper
async function apiCall(endpoint, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };
    
    if (AUTH_TOKEN && !endpoint.includes('/auth/')) {
        headers['Authorization'] = `Bearer ${AUTH_TOKEN}`;
    }
    
    const config = {
        ...options,
        headers
    };
    
    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
        
        if (response.status === 401) {
            // Token expired
            handleLogout();
            throw new Error('Session expired. Please login again.');
        }
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.detail || 'API Error');
        }
        
        return data;
    } catch (error) {
        console.error('API Call failed:', error);
        throw error;
    }
}

// ==============================================
// GLOBAL STATE
// ==============================================

const APP_STATE = {
    user: null,
    wallets: [],
    transactions: [],
    currentView: 'dashboard',
    isLoggedIn: false
};

// ==============================================
// DOM ELEMENTS
// ==============================================

// Auth Elements
const authScreen = document.getElementById('authScreen');
const appWrapper = document.getElementById('appWrapper');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const showRegisterLink = document.getElementById('showRegister');
const showLoginLink = document.getElementById('showLogin');

// App Elements
const menuBtn = document.getElementById('menuBtn');
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('overlay');
const closeSidebar = document.getElementById('closeSidebar');
const logoutBtn = document.getElementById('logoutBtn');

// Navigation
const navLinks = document.querySelectorAll('.nav-link');

// User Info
const userAvatar = document.getElementById('userAvatar');
const sidebarAvatar = document.getElementById('sidebarAvatar');
const userName = document.getElementById('userName');
const userPlan = document.getElementById('userPlan');

// Dashboard Elements
const portfolioValue = document.getElementById('portfolioValue');
const portfolioChange = document.getElementById('portfolioChange');
const txCount = document.getElementById('txCount');
const txLimit = document.getElementById('txLimit');
const walletCount = document.getElementById('walletCount');
const profitLoss = document.getElementById('profitLoss');
const plChange = document.getElementById('plChange');
const recentTxList = document.getElementById('recentTxList');

// Action Buttons
const addWalletBtn = document.getElementById('addWalletBtn');
const addWalletBtn2 = document.getElementById('addWalletBtn2');
const syncBtn = document.getElementById('syncBtn');
const quickExportBtn = document.getElementById('quickExportBtn');
const upgradeBtn = document.getElementById('upgradeBtn');
const exportTaxBtn = document.getElementById('exportTaxBtn');
const exportAllBtn = document.getElementById('exportAllBtn');

// Views
const dashboardView = document.getElementById('dashboardView');
const walletsView = document.getElementById('walletsView');
const transactionsView = document.getElementById('transactionsView');
const exportView = document.getElementById('exportView');
const settingsView = document.getElementById('settingsView');

// Settings
const settingsEmail = document.getElementById('settingsEmail');
const settingsPlan = document.getElementById('settingsPlan');

// ==============================================
// AUTH FUNCTIONS (API Connected)
// ==============================================

function switchToRegister(e) {
    e.preventDefault();
    loginForm.classList.add('hidden');
    registerForm.classList.remove('hidden');
}

function switchToLogin(e) {
    e.preventDefault();
    registerForm.classList.add('hidden');
    loginForm.classList.remove('hidden');
}

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    if (!email || !password) {
        showNotification('❌ Bitte alle Felder ausfüllen', 'error');
        return;
    }

    showNotification('🔄 Anmeldung läuft...', 'info');

    try {
        // FastAPI OAuth2 expects form data
        const formData = new URLSearchParams();
        formData.append('username', email);
        formData.append('password', password);

        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: formData
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || 'Login fehlgeschlagen');
        }

        // Save token
        AUTH_TOKEN = data.access_token;
        localStorage.setItem('auth_token', AUTH_TOKEN);

        APP_STATE.user = data.user;
        APP_STATE.isLoggedIn = true;

        showNotification('✅ Login erfolgreich!', 'success');
        
        setTimeout(() => {
            loadApp();
        }, 500);

    } catch (error) {
        showNotification(`❌ ${error.message}`, 'error');
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const name = document.getElementById('regName').value;
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPassword').value;
    const plan = document.querySelector('input[name="plan"]:checked').value;

    if (!name || !email || !password) {
        showNotification('❌ Bitte alle Felder ausfüllen', 'error');
        return;
    }

    if (password.length < 8) {
        showNotification('❌ Passwort muss mind. 8 Zeichen haben', 'error');
        return;
    }

    showNotification('🔄 Account wird erstellt...', 'info');

    try {
        const data = await apiCall('/auth/register', {
            method: 'POST',
            body: JSON.stringify({
                name,
                email,
                password,
                plan
            })
        });

        // Save token
        AUTH_TOKEN = data.access_token;
        localStorage.setItem('auth_token', AUTH_TOKEN);

        APP_STATE.user = data.user;
        APP_STATE.isLoggedIn = true;

        showNotification('✅ Account erstellt!', 'success');
        
        setTimeout(() => {
            loadApp();
        }, 500);

    } catch (error) {
        showNotification(`❌ ${error.message}`, 'error');
    }
}

function handleLogout() {
    if (confirm('Wirklich abmelden?')) {
        AUTH_TOKEN = null;
        localStorage.removeItem('auth_token');
        
        APP_STATE.user = null;
        APP_STATE.isLoggedIn = false;
        APP_STATE.wallets = [];
        APP_STATE.transactions = [];
        
        appWrapper.classList.add('hidden');
        authScreen.classList.remove('hidden');
        
        loginForm.reset();
        registerForm.reset();
        registerForm.classList.add('hidden');
        loginForm.classList.remove('hidden');
        
        showNotification('👋 Auf Wiedersehen!', 'success');
    }
}

async function loadApp() {
    authScreen.classList.add('hidden');
    appWrapper.classList.remove('hidden');
    
    // Update user info
    userAvatar.textContent = APP_STATE.user.name.charAt(0).toUpperCase();
    sidebarAvatar.textContent = APP_STATE.user.name.charAt(0).toUpperCase();
    userName.textContent = APP_STATE.user.name;
    userPlan.textContent = APP_STATE.user.plan === 'pro' ? 'Pro Plan' : 'Free Plan';
    settingsEmail.textContent = APP_STATE.user.email;
    settingsPlan.textContent = APP_STATE.user.plan === 'pro' ? 'Pro (9€/Monat)' : 'Free';
    
    // Load real data from API
    await loadDashboardData();
    
    showNotification('🎉 Willkommen zurück!', 'success');
}

// Check if already logged in on page load
async function checkAuth() {
    if (AUTH_TOKEN) {
        try {
            const user = await apiCall('/auth/me');
            APP_STATE.user = user;
            APP_STATE.isLoggedIn = true;
            loadApp();
        } catch (error) {
            // Token invalid
            AUTH_TOKEN = null;
            localStorage.removeItem('auth_token');
        }
    }
}

// ==============================================
// DASHBOARD FUNCTIONS (API Connected)
// ==============================================

async function loadDashboardData() {
    try {
        // Load stats
        const stats = await apiCall('/dashboard/stats');
        
        // Update UI
        portfolioValue.textContent = formatCurrency(stats.portfolio_value);
        portfolioChange.textContent = '+12.5%'; // TODO: Calculate real change
        portfolioChange.className = 'stat-change positive';

        const txMax = APP_STATE.user.plan === 'pro' ? '∞' : '50';
        txCount.textContent = stats.total_transactions;
        txLimit.textContent = `${stats.total_transactions}/${txMax}`;
        txLimit.className = stats.total_transactions > 40 && txMax !== '∞' 
            ? 'stat-change negative' 
            : 'stat-change neutral';

        walletCount.textContent = stats.total_wallets;

        profitLoss.textContent = formatCurrency(stats.profit_loss);
        plChange.textContent = stats.profit_loss >= 0 ? '+24.5%' : '-12.3%';
        plChange.className = stats.profit_loss >= 0 
            ? 'stat-change positive' 
            : 'stat-change negative';

        // Load wallets
        APP_STATE.wallets = await apiCall('/wallets');

        // Load transactions
        APP_STATE.transactions = await apiCall('/transactions');

        // Update recent transactions
        renderRecentTransactions();

    } catch (error) {
        showNotification(`❌ Fehler beim Laden: ${error.message}`, 'error');
    }
}

function renderRecentTransactions() {
    if (APP_STATE.transactions.length === 0) {
        recentTxList.innerHTML = `
            <div class="empty-state">
                <p>🔍 Noch keine Transaktionen</p>
                <button class="btn-secondary" id="addFirstWallet">Wallet verbinden</button>
            </div>
        `;
        const btn = document.getElementById('addFirstWallet');
        if (btn) btn.addEventListener('click', () => switchView('wallets'));
        return;
    }

    const recent = APP_STATE.transactions.slice(0, 3);
    recentTxList.innerHTML = recent.map(tx => `
        <div class="activity-item">
            <div class="activity-icon ${tx.tx_type === 'buy' ? 'success' : tx.tx_type === 'sell' ? 'warning' : 'user'}">
                ${tx.tx_type === 'buy' ? '📈' : tx.tx_type === 'sell' ? '📉' : '↔️'}
            </div>
            <div class="activity-content">
                <p class="activity-title">
                    ${tx.tx_type === 'buy' ? 'Gekauft' : tx.tx_type === 'sell' ? 'Verkauft' : 'Transfer'}: 
                    ${tx.amount} ${tx.to_asset}
                </p>
                <p class="activity-time">${formatTimeAgo(new Date(tx.timestamp).getTime())}</p>
            </div>
            <div class="activity-amount">
                <strong>${tx.total_eur > 0 ? formatCurrency(tx.total_eur) : '—'}</strong>
            </div>
        </div>
    `).join('');
}

// ==============================================
// NAVIGATION
// ==============================================

function switchView(viewName) {
    document.querySelectorAll('.view').forEach(view => {
        view.classList.add('hidden');
    });

    const viewMap = {
        'dashboard': dashboardView,
        'wallets': walletsView,
        'transactions': transactionsView,
        'export': exportView,
        'settings': settingsView
    };

    if (viewMap[viewName]) {
        viewMap[viewName].classList.remove('hidden');
    }

    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });

    const activeNav = document.querySelector(`[data-view="${viewName}"]`);
    if (activeNav) {
        activeNav.parentElement.classList.add('active');
    }

    APP_STATE.currentView = viewName;
    closeSidebarMenu();

    if (viewName === 'wallets') renderWallets();
    if (viewName === 'transactions') renderTransactions();
}

// ==============================================
// WALLETS VIEW (API Connected)
// ==============================================

async function renderWallets() {
    const walletsGrid = document.getElementById('walletsGrid');
    
    if (APP_STATE.wallets.length === 0) {
        walletsGrid.innerHTML = `
            <div class="empty-state">
                <p>💼 Noch keine Wallets verbunden</p>
                <button class="btn-primary" id="addWalletEmpty">+ Erstes Wallet</button>
            </div>
        `;
        document.getElementById('addWalletEmpty').addEventListener('click', handleAddWallet);
        return;
    }

    walletsGrid.innerHTML = APP_STATE.wallets.map(wallet => `
        <div class="wallet-card">
            <div class="wallet-header">
                <h3>${wallet.name}</h3>
                <span class="wallet-type">${wallet.wallet_type}</span>
            </div>
            <div class="wallet-balance">
                <p class="wallet-label">Wert</p>
                <h2>${formatCurrency(wallet.balance_eur)}</h2>
            </div>
            <button class="btn-secondary wallet-sync" data-id="${wallet.id}">
                🔄 Sync
            </button>
        </div>
    `).join('');

    document.querySelectorAll('.wallet-sync').forEach(btn => {
        btn.addEventListener('click', () => handleSyncWallet(btn.dataset.id));
    });
}

async function handleAddWallet() {
    const name = prompt('Wallet Name:');
    if (!name) return;

    const type = prompt('Typ (exchange/wallet/defi):');
    if (!type) return;

    try {
        const wallet = await apiCall('/wallets', {
            method: 'POST',
            body: JSON.stringify({
                name,
                wallet_type: type
            })
        });

        APP_STATE.wallets.push(wallet);
        showNotification('✅ Wallet hinzugefügt!', 'success');
        renderWallets();
        loadDashboardData();

    } catch (error) {
        showNotification(`❌ ${error.message}`, 'error');
    }
}

async function handleSyncWallet(walletId) {
    showNotification('🔄 Synchronisiere Wallet...', 'info');
    
    try {
        await apiCall(`/wallets/${walletId}/sync`, {
            method: 'POST'
        });

        showNotification('✅ Wallet synchronisiert!', 'success');
        loadDashboardData();

    } catch (error) {
        showNotification(`❌ ${error.message}`, 'error');
    }
}

// ==============================================
// TRANSACTIONS VIEW (API Connected)
// ==============================================

async function renderTransactions() {
    const transactionsList = document.getElementById('transactionsList');
    const filter = document.getElementById('txFilter').value;
    
    let filtered = APP_STATE.transactions;
    if (filter !== 'all') {
        filtered = APP_STATE.transactions.filter(tx => tx.tx_type === filter);
    }

    if (filtered.length === 0) {
        transactionsList.innerHTML = `
            <div class="empty-state">
                <p>📝 Keine Transaktionen gefunden</p>
            </div>
        `;
        return;
    }

    transactionsList.innerHTML = filtered.map(tx => `
        <div class="transaction-card">
            <div class="tx-icon ${tx.tx_type}">
                ${tx.tx_type === 'buy' ? '📈' : tx.tx_type === 'sell' ? '📉' : '↔️'}
            </div>
            <div class="tx-info">
                <h4>${tx.tx_type === 'buy' ? 'Kauf' : tx.tx_type === 'sell' ? 'Verkauf' : 'Transfer'}</h4>
                <p>${tx.amount} ${tx.to_asset} ${tx.from_asset !== tx.to_asset ? `← ${tx.from_asset}` : ''}</p>
                <p class="tx-time">${formatTimeAgo(new Date(tx.timestamp).getTime())}</p>
            </div>
            <div class="tx-amount">
                ${tx.total_eur > 0 ? `<strong>${formatCurrency(tx.total_eur)}</strong>` : '—'}
            </div>
        </div>
    `).join('');
}

// ==============================================
// EXPORT FUNCTIONS (API Connected)
// ==============================================

async function handleTaxExport() {
    showNotification('📊 Erstelle Steuer-Export...', 'info');
    
    try {
        window.open(`${API_BASE_URL}/export/tax-csv?token=${AUTH_TOKEN}`, '_blank');
        showNotification('✅ Export gestartet!', 'success');
    } catch (error) {
        showNotification(`❌ ${error.message}`, 'error');
    }
}

async function handleFullExport() {
    showNotification('📝 Erstelle Transaktions-Export...', 'info');
    
    try {
        window.open(`${API_BASE_URL}/export/full-csv?token=${AUTH_TOKEN}`, '_blank');
        showNotification('✅ Export gestartet!', 'success');
    } catch (error) {
        showNotification(`❌ ${error.message}`, 'error');
    }
}

// ==============================================
// UI FUNCTIONS
// ==============================================

function openSidebar() {
    sidebar.classList.add('active');
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeSidebarMenu() {
    sidebar.classList.remove('active');
    overlay.classList.remove('active');
    document.body.style.overflow = '';
}

function showNotification(message, type = 'info') {
    const existing = document.querySelector('.notification');
    if (existing) existing.remove();
    
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    
    const colors = {
        success: 'linear-gradient(135deg, #10b981, #14b8a6)',
        error: 'linear-gradient(135deg, #ef4444, #dc2626)',
        info: 'linear-gradient(135deg, #3b82f6, #2563eb)',
        warning: 'linear-gradient(135deg, #f59e0b, #d97706)'
    };
    
    notification.style.cssText = `
        position: fixed;
        bottom: 80px;
        left: 50%;
        transform: translateX(-50%) translateY(100px);
        background: ${colors[type] || colors.info};
        color: white;
        padding: 14px 24px;
        border-radius: 12px;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
        z-index: 1000;
        font-weight: 600;
        font-size: 14px;
        transition: transform 0.3s ease;
        max-width: 90%;
        text-align: center;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.transform = 'translateX(-50%) translateY(0)';
    }, 10);
    
    setTimeout(() => {
        notification.style.transform = 'translateX(-50%) translateY(100px)';
        setTimeout(() => notification.remove(), 300);
    }, 2500);
}

// ==============================================
// UTILITY FUNCTIONS
// ==============================================

function formatCurrency(amount) {
    return new Intl.NumberFormat('de-DE', {
        style: 'currency',
        currency: 'EUR'
    }).format(amount);
}

function formatTimeAgo(timestamp) {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    
    if (seconds < 60) return 'vor ' + seconds + ' Sekunden';
    if (seconds < 3600) return 'vor ' + Math.floor(seconds / 60) + ' Minuten';
    if (seconds < 86400) return 'vor ' + Math.floor(seconds / 3600) + ' Stunden';
    return 'vor ' + Math.floor(seconds / 86400) + ' Tagen';
}

// ==============================================