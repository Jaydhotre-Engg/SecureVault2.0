import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { User } from '../types';
import { authApi, LoginPayload, RegisterPayload } from '../api/auth';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isInvestigator: boolean;
  login: (payload: LoginPayload) => Promise<User>;
  register: (payload: RegisterPayload) => Promise<User>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('securevault_user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    return null;
  });

  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem('securevault_token');
  });

  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Initialize and verify authentication state with backend on mount
  const verifyAuth = useCallback(async () => {
    const savedToken = localStorage.getItem('securevault_token');
    if (!savedToken) {
      setUser(null);
      setToken(null);
      setIsLoading(false);
      return;
    }

    try {
      const currentUser = await authApi.getMe();
      setUser(currentUser);
      localStorage.setItem('securevault_user', JSON.stringify(currentUser));
    } catch (error) {
      console.warn('Session verification failed, logging out:', error);
      localStorage.removeItem('securevault_token');
      localStorage.removeItem('securevault_user');
      setUser(null);
      setToken(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    verifyAuth();
  }, [verifyAuth]);

  const login = async (payload: LoginPayload): Promise<User> => {
    setIsLoading(true);
    try {
      const tokenResp = await authApi.login(payload);
      localStorage.setItem('securevault_token', tokenResp.access_token);
      setToken(tokenResp.access_token);

      // Fetch authoritative user record from DB
      const userRecord = await authApi.getMe();
      setUser(userRecord);
      localStorage.setItem('securevault_user', JSON.stringify(userRecord));
      toast.success(`Welcome back, ${userRecord.username}!`);
      return userRecord;
    } catch (error) {
      toast.error('Login failed. Please check your credentials.');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (payload: RegisterPayload): Promise<User> => {
    setIsLoading(true);
    try {
      const newUser = await authApi.register(payload);
      return newUser;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('securevault_token');
    localStorage.removeItem('securevault_user');
    setToken(null);
    setUser(null);
    toast.success('Logged out successfully');
    setTimeout(() => {
      window.location.href = '/login';
    }, 500);
  };

  const refreshUser = async () => {
    if (!token) return;
    try {
      const refreshed = await authApi.getMe();
      setUser(refreshed);
      localStorage.setItem('securevault_user', JSON.stringify(refreshed));
    } catch (error) {
      console.error('Failed to refresh user profile:', error);
    }
  };

  const isAuthenticated = !!token && !!user;
  const isAdmin = user?.role === 'ADMIN';
  const isInvestigator = user?.role === 'INVESTIGATOR';

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated,
        isAdmin,
        isInvestigator,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
