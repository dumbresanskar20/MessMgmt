import React, { createContext, useState, useEffect, useContext } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

// Configure Axios defaults
axios.defaults.baseURL = ''; // Handled by Vite dev server proxy

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('dev_token'));
  const [loading, setLoading] = useState(true);

  // Sync token changes to Axios default headers
  useEffect(() => {
    if (token) {
      localStorage.setItem('dev_token', token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      fetchUserProfile();
    } else {
      localStorage.removeItem('dev_token');
      delete axios.defaults.headers.common['Authorization'];
      setUser(null);
      setLoading(false);
    }
  }, [token]);

  const fetchUserProfile = async () => {
    try {
      const response = await axios.get('/api/developer/auth/me');
      if (response.data.success) {
        setUser(response.data.developer);
      } else {
        logout();
      }
    } catch (error) {
      console.error('Failed to load developer profile:', error);
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      const response = await axios.post('/api/developer/auth/login', { email, password });
      if (response.data.success) {
        setToken(response.data.token);
        setUser(response.data.developer);
        return { success: true };
      }
      return { success: false, message: response.data.message || 'Login failed.' };
    } catch (error) {
      const message = error.response?.data?.message || 'Server connection error during login.';
      return { success: false, message };
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('dev_token');
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
