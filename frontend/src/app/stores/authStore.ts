import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User, LoginForm, SignupForm } from '../types';
import { apiService } from '../services/api';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  login: (email: string, password: string) => Promise<{ user: User; tokens: { accessToken: string; refreshToken: string } }>;
  signup: (userData: SignupForm) => Promise<void>;
  logout: () => void;
  clearError: () => void;
  setUser: (user: User) => void;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null });
        
        try {
          const response = await apiService.post<{
            user: User;
            tokens: { accessToken: string; refreshToken: string };
          }>('/auth/login', { email, password });
          
          if (response.success && response.data) {
            localStorage.setItem('accessToken', response.data.tokens.accessToken);
            localStorage.setItem('refreshToken', response.data.tokens.refreshToken);
            
            set({
              user: response.data.user,
              isAuthenticated: true,
              isLoading: false,
            });
            
            return response.data;
          } else {
            const errorMessage = response.error || response.message || 'Login failed';
            set({
              error: errorMessage,
              isLoading: false,
            });
            throw new Error(errorMessage);
          }
        } catch (error: any) {
          const errorMessage = error.message || 'Login failed';
          set({
            error: errorMessage,
            isLoading: false,
          });
          throw error;
        }
      },

      signup: async (userData: SignupForm) => {
        set({ isLoading: true, error: null });
        
        try {
          // Transform data to match backend schema
          const requestData = {
            email: userData.email,
            password: userData.password,
            profile: {
              firstName: userData.firstName,
              lastName: userData.lastName,
            },
          };

          const response = await apiService.post<{
            user: User;
            tokens: { accessToken: string; refreshToken: string };
          }>('/auth/register', requestData);
          
          if (response.success && response.data) {
            localStorage.setItem('accessToken', response.data.tokens.accessToken);
            localStorage.setItem('refreshToken', response.data.tokens.refreshToken);
            
            set({
              user: response.data.user,
              isAuthenticated: true,
              isLoading: false,
            });
          } else {
            const errorMessage = response.error || response.message || 'Signup failed';
            set({
              error: errorMessage,
              isLoading: false,
            });
            throw new Error(errorMessage);
          }
        } catch (error: any) {
          const errorMessage = error.message || 'Signup failed';
          set({
            error: errorMessage,
            isLoading: false,
          });
          throw error;
        }
      },

      logout: () => {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        
        set({
          user: null,
          isAuthenticated: false,
          error: null,
        });
      },

      checkAuth: async () => {
        const token = localStorage.getItem('accessToken');
        
        if (!token) {
          set({ isAuthenticated: false, user: null });
          return;
        }

        try {
          const response = await apiService.get<User>('/user/profile');
          
          if (response.success && response.data) {
            set({
              user: response.data,
              isAuthenticated: true,
            });
          } else {
            set({ isAuthenticated: false, user: null });
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
          }
        } catch (error) {
          set({ isAuthenticated: false, user: null });
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
        }
      },

      clearError: () => set({ error: null }),
      
      setUser: (user: User) => set({ user, isAuthenticated: true }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);