/**
 * StudyVault Centralized API Client
 * Connects to AWS EC2 Express Backend API
 */

// Base API URL injected via Vite env, defaulting to relative path for same-origin Nginx proxying
const RAW_API_URL = import.meta.env.VITE_API_URL !== undefined ? import.meta.env.VITE_API_URL : '';
export const API_BASE = RAW_API_URL.replace(/\/+$/, '');

const TOKEN_KEY = 'studyvault_auth_token';

export const getStoredToken = () => localStorage.getItem(TOKEN_KEY);
export const setStoredToken = (token) => {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
};
export const removeStoredToken = () => localStorage.removeItem(TOKEN_KEY);

/**
 * Generic fetch wrapper with auth header injection and standardized error extraction
 */
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  const token = getStoredToken();

  const headers = {
    Accept: 'application/json',
    ...(options.headers || {})
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Do not set Content-Type if body is FormData (let browser set multipart boundary)
  if (options.body && !(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  let response;
  try {
    response = await fetch(url, {
      ...options,
      headers
    });
  } catch (networkError) {
    throw new Error(
      `Cannot connect to StudyVault server at ${API_BASE}. Please check your connection or CORS configuration.`
    );
  }

  // Handle Unauthorized (token expired or invalidated)
  if (response.status === 401 && !endpoint.includes('/auth/login') && !endpoint.includes('/auth/register')) {
    removeStoredToken();
    window.dispatchEvent(new Event('studyvault_unauthorized'));
  }

  let data;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    data = await response.json();
  } else {
    const text = await response.text();
    data = { success: response.ok, message: text };
  }

  if (!response.ok) {
    const errorMsg = data?.message || `Request failed with status ${response.status}`;
    const err = new Error(errorMsg);
    err.status = response.status;
    err.data = data;
    throw err;
  }

  return data;
}

export const api = {
  // Health
  health: {
    check: () => apiRequest('/api/health')
  },

  // Authentication
  auth: {
    login: (credentials) =>
      apiRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials)
      }),
    register: (userData) =>
      apiRequest('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(userData)
      }),
    me: () => apiRequest('/api/auth/me')
  },

  // Dashboard Analytics
  dashboard: {
    getStats: () => apiRequest('/api/dashboard/stats')
  },

  // Documents Management & S3 Storage
  documents: {
    list: (params = {}) => {
      const query = new URLSearchParams();
      if (params.search) query.set('search', params.search);
      if (params.subject) query.set('subject', params.subject);
      if (params.semester) query.set('semester', params.semester);
      if (params.category) query.set('category', params.category);
      if (params.favorite !== undefined && params.favorite !== '') query.set('favorite', String(params.favorite));
      if (params.page) query.set('page', String(params.page));
      if (params.limit) query.set('limit', String(params.limit));
      const qs = query.toString();
      return apiRequest(`/api/documents${qs ? `?${qs}` : ''}`);
    },
    getById: (id) => apiRequest(`/api/documents/${id}`),
    upload: (formData) =>
      apiRequest('/api/documents', {
        method: 'POST',
        body: formData
      }),
    getDownloadUrl: (id) => apiRequest(`/api/documents/${id}/download`),
    update: (id, metadata) =>
      apiRequest(`/api/documents/${id}`, {
        method: 'PUT',
        body: JSON.stringify(metadata)
      }),
    toggleFavorite: (id) =>
      apiRequest(`/api/documents/${id}/favorite`, {
        method: 'PATCH'
      }),
    delete: (id) =>
      apiRequest(`/api/documents/${id}`, {
        method: 'DELETE'
      })
  },

  // Activity Tracking
  activity: {
    list: (params = {}) => {
      const query = new URLSearchParams();
      if (params.action && params.action !== 'ALL') query.set('action', params.action);
      if (params.page) query.set('page', String(params.page));
      if (params.limit) query.set('limit', String(params.limit));
      const qs = query.toString();
      return apiRequest(`/api/activity${qs ? `?${qs}` : ''}`);
    }
  }
};

export default api;
