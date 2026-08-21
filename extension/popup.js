// Gatekeeper Extension Popup
// Handles authentication and settings

const API_BASE = 'http://localhost:5001/api';

const elements = {
  loading: document.getElementById('loading'),
  notAuthenticated: document.getElementById('not-authenticated'),
  authenticated: document.getElementById('authenticated'),
  loginForm: document.getElementById('login-form'),
  loginError: document.getElementById('login-error'),
  loginBtn: document.getElementById('login-btn'),
  registerLink: document.getElementById('register-link'),
  userAvatar: document.getElementById('user-avatar'),
  userInitial: document.getElementById('user-initial'),
  userName: document.getElementById('user-name'),
  userEmail: document.getElementById('user-email'),
  userRoleBadge: document.getElementById('user-role-badge'),
  protectionToggle: document.getElementById('protection-toggle'),
  autoScanToggle: document.getElementById('auto-scan-toggle'),
  openDashboard: document.getElementById('open-dashboard'),
  logoutBtn: document.getElementById('logout-btn'),
};

function showLoading() {
  elements.loading.classList.remove('hidden');
  elements.notAuthenticated.classList.add('hidden');
  elements.authenticated.classList.add('hidden');
}

function showNotAuthenticated() {
  elements.loading.classList.add('hidden');
  elements.notAuthenticated.classList.remove('hidden');
  elements.authenticated.classList.add('hidden');
}

function showAuthenticated(user) {
  elements.loading.classList.add('hidden');
  elements.notAuthenticated.classList.add('hidden');
  elements.authenticated.classList.remove('hidden');

  const initial = (user.first_name?.[0] || user.email?.[0] || 'U').toUpperCase();
  elements.userInitial.textContent = initial;
  elements.userName.textContent = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email;
  elements.userEmail.textContent = user.email;
  
  const role = user.role || 'user';
  elements.userRoleBadge.textContent = role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  elements.userRoleBadge.className = 'px-2 py-0.5 rounded-full text-xs font-medium ' + 
    (role === 'super_admin' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' :
     role === 'org_admin' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' :
     'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400');
  
  elements.protectionToggle.checked = true;
  elements.autoScanToggle.checked = true;
}

async function apiRequest(endpoint, options = {}) {
  const token = await getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });
  
  if (response.status === 401) {
    await clearTokens();
    showNotAuthenticated();
    throw new Error('Session expired');
  }
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || errorData.error || `Request failed: ${response.status}`);
  }
  
  return response.json();
}

async function getToken() {
  const result = await chrome.storage.local.get('gatekeeper_token');
  return result.gatekeeper_token || null;
}

async function setToken(token) {
  await chrome.storage.local.set({ gatekeeper_token: token });
}

async function clearTokens() {
  await chrome.storage.local.remove(['gatekeeper_token', 'gatekeeper_refresh_token', 'gatekeeper_user']);
}

async function getUser() {
  const result = await chrome.storage.local.get('gatekeeper_user');
  return result.gatekeeper_user || null;
}

async function setUser(user) {
  await chrome.storage.local.set({ gatekeeper_user: user });
}

async function login(email, password) {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || errorData.error || 'Login failed');
  }
  
  const data = await response.json();
  await setToken(data.access_token);
  await setUser(data.user);
  return data.user;
}

async function checkAuth() {
  try {
    const token = await getToken();
    if (!token) {
      showNotAuthenticated();
      return;
    }
    
    // Try to get current user to validate token
    const userData = await apiRequest('/auth/me');
    showAuthenticated(userData.user);
  } catch (error) {
    console.error('Auth check failed:', error);
    showNotAuthenticated();
  }
}

function showError(message) {
  elements.loginError.textContent = message;
  elements.loginError.classList.remove('hidden');
}

function hideError() {
  elements.loginError.classList.add('hidden');
}

elements.loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideError();
  
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  
  if (!email || !password) {
    showError('Please enter both email and password');
    return;
  }
  
  elements.loginBtn.disabled = true;
  elements.loginBtn.textContent = 'Signing in...';
  
  try {
    const user = await login(email, password);
    showAuthenticated(user);
  } catch (error) {
    showError(error.message);
  } finally {
    elements.loginBtn.disabled = false;
    elements.loginBtn.textContent = 'Sign In';
  }
});

elements.logoutBtn.addEventListener('click', async () => {
  await clearTokens();
  showNotAuthenticated();
  // Notify background script to stop scanning
  chrome.runtime.sendMessage({ type: 'GATEKEEPER_LOGOUT' });
});

elements.openDashboard.addEventListener('click', (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: 'http://localhost:5001/dashboard' });
});

elements.registerLink.addEventListener('click', (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: 'http://localhost:5001/register' });
});

// Listen for settings changes
elements.protectionToggle.addEventListener('change', async () => {
  await chrome.storage.local.set({ protection_enabled: elements.protectionToggle.checked });
  chrome.runtime.sendMessage({ 
    type: 'GATEKEEPER_SETTINGS_UPDATE', 
    protection_enabled: elements.protectionToggle.checked 
  });
});

elements.autoScanToggle.addEventListener('change', async () => {
  await chrome.storage.local.set({ auto_scan_enabled: elements.autoScanToggle.checked });
  chrome.runtime.sendMessage({ 
    type: 'GATEKEEPER_SETTINGS_UPDATE', 
    auto_scan_enabled: elements.autoScanToggle.checked 
  });
});

// Load saved settings
async function loadSettings() {
  const result = await chrome.storage.local.get(['protection_enabled', 'auto_scan_enabled']);
  elements.protectionToggle.checked = result.protection_enabled !== false;
  elements.autoScanToggle.checked = result.auto_scan_enabled !== false;
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  await checkAuth();
});