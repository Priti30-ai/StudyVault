import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api, { getStoredToken, setStoredToken, removeStoredToken } from '../api/client.js';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(getStoredToken());
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  // Initialize and verify authentication on app load
  const checkAuth = useCallback(async () => {
    const existingToken = getStoredToken();
    if (!existingToken) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const res = await api.auth.me();
      if (res.success && res.data?.user) {
        setUser(res.data.user);
        setToken(existingToken);
      } else {
        throw new Error('Invalid user response');
      }
    } catch (err) {
      console.warn('Auth session expired or invalid:', err.message);
      removeStoredToken();
      setUser(null);
      setToken(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();

    // Global unauthorized listener
    const handleUnauthorized = () => {
      setUser(null);
      setToken(null);
    };
    window.addEventListener('studyvault_unauthorized', handleUnauthorized);
    return () => window.removeEventListener('studyvault_unauthorized', handleUnauthorized);
  }, [checkAuth]);

  // Login handler
  const login = async (email, password) => {
    setAuthError(null);
    try {
      const res = await api.auth.login({ email, password });
      if (res.success && res.data?.token) {
        setStoredToken(res.data.token);
        setToken(res.data.token);
        setUser(res.data.user);
        return res.data.user;
      }
      throw new Error(res.message || 'Login failed');
    } catch (err) {
      setAuthError(err.message);
      throw err;
    }
  };

  // Register handler
  const register = async (name, email, password) => {
    setAuthError(null);
    try {
      const res = await api.auth.register({ name, email, password });
      if (res.success && res.data?.token) {
        setStoredToken(res.data.token);
        setToken(res.data.token);
        setUser(res.data.user);
        return res.data.user;
      }
      throw new Error(res.message || 'Registration failed');
    } catch (err) {
      setAuthError(err.message);
      throw err;
    }
  };

  // Logout handler
  const logout = () => {
    removeStoredToken();
    setToken(null);
    setUser(null);
    setAuthError(null);
  };

  const value = {
    user,
    token,
    isAuthenticated: Boolean(user && token),
    isLoading,
    authError,
    setAuthError,
    login,
    register,
    logout,
    refreshUser: checkAuth
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
