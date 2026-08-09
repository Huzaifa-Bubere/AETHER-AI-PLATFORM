import axios from 'axios';

// Shared axios instance for the aptitude module. Kept separate from the main
// apiService because the aptitude backend returns raw JSON payloads directly
// (e.g. { attemptId, ... }), not the { success, data } envelope the rest of
// this app's API responses use. This instance still attaches the real auth
// token from localStorage, same as the main apiService does.
const raw = (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:5001';

// Strip a trailing /api if present — every request path below already
// includes its own leading /api/..., so this avoids a doubled /api/api/.
const base = raw.replace(/\/$/, '').replace(/\/api$/, '');

const aptitudeApi = axios.create({ baseURL: base });

aptitudeApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default aptitudeApi;