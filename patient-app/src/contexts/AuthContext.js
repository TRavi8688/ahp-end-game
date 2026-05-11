import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { SecurityUtils } from '../utils/security';
import ApiService from '../utils/ApiService';

const AuthContext = createContext();

/**
 * Hospyn Enterprise Authentication Provider
 * Manages the global authentication lifecycle, token persistence, and session restoration.
 */
export const AuthProvider = ({ children }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [user, setUser] = useState(null);

    /**
     * Restore session from secure storage on boot.
     */
    const initializeAuth = useCallback(async () => {
        try {
            console.log('[Auth] Initializing session restoration...');
            const token = await SecurityUtils.getToken();
            
            if (token) {
                console.log('[Auth] Found active token, verifying session...');
                // In a full production app, we would verify the token with the backend here
                // For now, we trust the presence of a token if it's not expired
                setIsAuthenticated(true);
                
                // Fetch profile to verify token and get user data
                try {
                    const profile = await ApiService.getProfile();
                    setUser(profile);
                    console.log('[Auth] Session restored for:', profile.full_name);
                } catch (err) {
                    console.error('[Auth] Token verification failed:', err.message);
                    if (err.response?.status === 401) {
                        await logout();
                    }
                }
            } else {
                console.log('[Auth] No session found.');
            }
        } catch (error) {
            console.error('[Auth] Initialization error:', error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        initializeAuth();
    }, [initializeAuth]);

    /**
     * Centralized Login Handler
     */
    const login = async (token, hospynId) => {
        try {
            console.log('[Auth] Persisting session...');
            await SecurityUtils.saveToken(token);
            await SecurityUtils.saveHospynId(hospynId);
            
            setIsAuthenticated(true);
            
            // Refresh profile data
            const profile = await ApiService.getProfile();
            setUser(profile);
            
            console.log('[Auth] Login successful.');
            return true;
        } catch (error) {
            console.error('[Auth] Login persistence failed:', error);
            return false;
        }
    };

    /**
     * Centralized Logout Handler
     */
    const logout = async () => {
        try {
            console.warn('[Auth] Terminating session...');
            await SecurityUtils.deleteToken();
            setIsAuthenticated(false);
            setUser(null);
            console.log('[Auth] Session cleared.');
        } catch (error) {
            console.error('[Auth] Logout failed:', error);
        }
    };

    return (
        <AuthContext.Provider value={{
            isAuthenticated,
            isLoading,
            user,
            login,
            logout,
            setIsAuthenticated // Exposed for interceptors
        }}>
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
