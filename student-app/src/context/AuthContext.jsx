import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [student, setStudent] = useState(() => {
    const saved = localStorage.getItem('student_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('student_token') || null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [pendingCheckout, setPendingCheckout] = useState(false);
  const [loading, setLoading] = useState(false);

  // Sync token to API interceptor headers
  useEffect(() => {
    if (token) {
      localStorage.setItem('student_token', token);
    } else {
      localStorage.removeItem('student_token');
    }
  }, [token]);

  useEffect(() => {
    if (student) {
      localStorage.setItem('student_user', JSON.stringify(student));
    } else {
      localStorage.removeItem('student_user');
    }
  }, [student]);

  // Handle successful login or OTP verification
  const handleAuthSuccess = (userData, accessToken) => {
    setStudent(userData);
    setToken(accessToken);
    setAuthModalOpen(false);
  };

  const login = async (email, password) => {
    setLoading(true);
    try {
      const response = await api.post('/auth/student/login', { email, password });
      const data = response.data;

      if (data.requires_otp) {
        return { success: false, requires_otp: true, email: data.email, message: data.message };
      }

      handleAuthSuccess(data.student, data.accessToken);
      return { success: true, message: data.message };
    } catch (error) {
      const msg = error.response?.data?.message || 'Login failed. Please check your credentials.';
      return { success: false, message: msg };
    } finally {
      setLoading(false);
    }
  };

  const signup = async (formData) => {
    setLoading(true);
    try {
      const response = await api.post('/auth/student/signup', formData);
      const data = response.data;
      return { success: true, requires_otp: data.requires_otp, email: data.email, message: data.message };
    } catch (error) {
      const msg = error.response?.data?.message || 'Signup failed. Please try again.';
      return { success: false, message: msg, errors: error.response?.data?.errors };
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async (email, otp_code) => {
    setLoading(true);
    try {
      const response = await api.post('/auth/student/verify-otp', { email, otp_code });
      const data = response.data;
      handleAuthSuccess(data.student, data.accessToken);
      return { success: true, message: data.message };
    } catch (error) {
      const msg = error.response?.data?.message || 'Verification failed. Invalid or expired OTP.';
      return { success: false, message: msg };
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setStudent(null);
    setToken(null);
    localStorage.removeItem('student_token');
    localStorage.removeItem('student_user');
  };

  const openAuthModal = (forCheckout = false) => {
    setPendingCheckout(forCheckout);
    setAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setAuthModalOpen(false);
    setPendingCheckout(false);
  };

  return (
    <AuthContext.Provider
      value={{
        student,
        token,
        isAuthenticated: !!token && !!student,
        authModalOpen,
        pendingCheckout,
        loading,
        login,
        signup,
        verifyOtp,
        logout,
        openAuthModal,
        closeAuthModal,
        setPendingCheckout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
