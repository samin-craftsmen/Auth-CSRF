import { createContext, useContext, useMemo, useState } from 'react';

const AuthContext = createContext(null);
const AUTH_STORAGE_KEY = 'auth-session';

function readStoredAuth() {
  const emptyAuthState = {
    isLoggedIn: false,
    token: null,
    user: null,
  };

  if (typeof window === 'undefined') {
    return emptyAuthState;
  }

  const storedAuth = window.localStorage.getItem(AUTH_STORAGE_KEY);
  if (!storedAuth) {
    return emptyAuthState;
  }

  try {
    const parsedAuth = JSON.parse(storedAuth);
    return {
      isLoggedIn: Boolean(parsedAuth.isLoggedIn && parsedAuth.token),
      token: parsedAuth.token || null,
      user: parsedAuth.user || null,
    };
  } catch {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    return emptyAuthState;
  }
}

export function AuthProvider({ children }) {
  const [authState, setAuthState] = useState(readStoredAuth);
  const [isLoading, setIsLoading] = useState(false);

  const login = async (email, password) => {
    const normalizedEmail = email.trim();

    if (!normalizedEmail || !password) {
      return {
        success: false,
        error: 'Enter email and password',
      };
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: normalizedEmail, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || 'Login failed',
        };
      }

      const nextAuthState = {
        isLoggedIn: Boolean(data.isAuthenticated && data.token),
        token: data.token,
        user: data.user,
      };

      setAuthState(nextAuthState);
      window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextAuthState));

      return {
        success: true,
        user: data.user,
      };
    } catch {
      return {
        success: false,
        error: 'Unable to reach the login service',
      };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    const nextAuthState = {
      isLoggedIn: false,
      token: null,
      user: null,
    };

    setAuthState(nextAuthState);
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
  };

  const value = useMemo(() => ({
    isLoggedIn: authState.isLoggedIn,
    token: authState.token,
    user: authState.user,
    isLoading,
    login,
    logout,
  }), [authState, isLoading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Custom hook to use auth context
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}