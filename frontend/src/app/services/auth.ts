import { apiService } from './api';
import { User, LoginForm, SignupForm, APIResponse } from '../types';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginResponse {
  user: User;
  tokens: AuthTokens;
}

class AuthService {
  async login(credentials: LoginForm): Promise<APIResponse<LoginResponse>> {
    const response = await apiService.post<LoginResponse>('/auth/login', credentials);
    
    if (response.success && response.data) {
      this.setTokens(response.data.tokens);
    }
    
    return response;
  }

  async signup(userData: SignupForm): Promise<APIResponse<LoginResponse>> {
    const response = await apiService.post<LoginResponse>('/auth/register', userData);
    
    if (response.success && response.data) {
      this.setTokens(response.data.tokens);
    }
    
    return response;
  }

  async logout(): Promise<void> {
    try {
      await apiService.post('/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      this.clearTokens();
    }
  }

  async refreshToken(): Promise<APIResponse<AuthTokens>> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await apiService.post<AuthTokens>('/auth/refresh', {
      refreshToken,
    });

    if (response.success && response.data) {
      this.setTokens(response.data);
    }

    return response;
  }

  async forgotPassword(email: string): Promise<APIResponse<{ message: string }>> {
    return apiService.post('/auth/forgot-password', { email });
  }

  async resetPassword(token: string, password: string): Promise<APIResponse<{ message: string }>> {
    return apiService.post('/auth/reset-password', { token, password });
  }

  async verifyOTP(email: string, otp: string): Promise<APIResponse<{ verified: boolean }>> {
    return apiService.post('/auth/verify-otp', { email, otp });
  }

  async getCurrentUser(): Promise<APIResponse<User>> {
    return apiService.get<User>('/user/profile');
  }

  // Token management
  setTokens(tokens: AuthTokens): void {
    localStorage.setItem('accessToken', tokens.accessToken);
    localStorage.setItem('refreshToken', tokens.refreshToken);
  }

  getAccessToken(): string | null {
    return localStorage.getItem('accessToken');
  }

  getRefreshToken(): string | null {
    return localStorage.getItem('refreshToken');
  }

  clearTokens(): void {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  }

  isAuthenticated(): boolean {
    return !!this.getAccessToken();
  }

  // Google OAuth
  async googleLogin(): Promise<void> {
    // Redirect to Google OAuth endpoint
    window.location.href = `${import.meta.env.VITE_API_BASE_URL}/auth/google`;
  }

  // Handle OAuth callback
  async handleOAuthCallback(code: string): Promise<APIResponse<LoginResponse>> {
    const response = await apiService.post<LoginResponse>('/auth/google/callback', { code });
    
    if (response.success && response.data) {
      this.setTokens(response.data.tokens);
    }
    
    return response;
  }
}

export const authService = new AuthService();
export default authService;