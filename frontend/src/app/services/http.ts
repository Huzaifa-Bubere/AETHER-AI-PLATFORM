import axios, { AxiosInstance } from 'axios';

const raw = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001/api';
export const apiBaseURL = raw.replace(/\/$/, '').endsWith('/api')
  ? raw.replace(/\/$/, '') : raw.replace(/\/$/, '') + '/api';

let refreshPromise: Promise<string> | null = null;

function expireSession() {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  window.dispatchEvent(new Event('auth:expired'));
}

export function attachAuthentication(client: AxiosInstance): AxiosInstance {
  client.interceptors.request.use((config) => {
    const token = localStorage.getItem('accessToken');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });
  client.interceptors.response.use((response) => response, async (error) => {
    const request = error.config;
    if (!request || error.response?.status !== 401 || request._retry || /\/auth\//.test(request.url || '')) {
      return Promise.reject(error);
    }
    request._retry = true;
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) {
      expireSession();
      return Promise.reject(error);
    }
    try {
      if (!refreshPromise) {
        // Plain axios prevents the refresh request from intercepting itself.
        refreshPromise = axios.post(`${apiBaseURL}/auth/refresh`, { refreshToken }, { timeout: 15000 })
          .then(({ data }) => {
            const tokens = data?.data;
            if (!data?.success || !tokens?.accessToken || !tokens?.refreshToken) {
              expireSession();
              throw new Error('Invalid refresh response');
            }
            localStorage.setItem('accessToken', tokens.accessToken);
            localStorage.setItem('refreshToken', tokens.refreshToken);
            return tokens.accessToken as string;
          }).finally(() => { refreshPromise = null; });
      }
      const token = await refreshPromise;
      request.headers.Authorization = `Bearer ${token}`;
      return await client(request);
    } catch (refreshError: any) {
      if ([401, 403, 423].includes(refreshError.response?.status)) expireSession();
      return Promise.reject(refreshError);
    }
  });
  return client;
}
