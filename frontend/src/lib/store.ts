import { create } from 'zustand';
import api, { setAccessToken } from './api';

export interface User {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  role: 'SUPER_ADMIN' | 'INSTITUTE_ADMIN' | 'TEACHER' | 'STUDENT' | 'PARENT';
  profileImage?: string;
  isActive: boolean;
  instituteId?: string;
  student?: { id: string; grade: string; verificationStatus: string };
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  fetchMe: () => Promise<void>;
  setUser: (user: User | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,

  login: async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    setAccessToken(data.data.accessToken);
    set({ user: data.data.user, isAuthenticated: true, isLoading: false });
  },

  logout: async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Ignore
    }
    setAccessToken(null);
    set({ user: null, isAuthenticated: false, isLoading: false });
  },

  fetchMe: async () => {
    try {
      const { data } = await api.get('/auth/me');
      set({ user: data.data, isAuthenticated: true, isLoading: false });
    } catch {
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  setUser: (user) => set({ user, isAuthenticated: !!user, isLoading: false }),
}));
