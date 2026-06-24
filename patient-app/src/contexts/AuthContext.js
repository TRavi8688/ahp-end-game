import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { SecurityUtils } from '../utils/security';
import { patientService } from '../services/patientService';
import { clinicalService } from '../services/clinicalService';
import { setAuthFailureCallback } from '../services/apiClient';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AuthContext = createContext();

/**
 * Hospyn Enterprise Authentication Provider
 * Manages the global authentication lifecycle, token persistence, and session restoration.
 */
export const AuthProvider = ({ children }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [user, setUser] = useState(null);
    const [authProvider, setAuthProvider] = useState('local');
    const [needsPasswordSetup, setNeedsPasswordSetup] = useState(false);

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
                
                // Retrieve auth provider if saved
                const provider = await AsyncStorage.getItem('auth_provider');
                if (provider) setAuthProvider(provider);
                
                // Fetch profile to verify token and get user data

                try {
                    const profile = await patientService.getProfile();
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
        // Register the global auth failure callback
        setAuthFailureCallback(() => {
            console.warn('[Auth] apiClient reported auth failure. Logging out.');
            logout();
        });
    }, [initializeAuth]);

    /**
     * Centralized Login Handler
     */
    const login = async (token, hospynId, fullName = null, provider = 'local') => {
        try {
            console.log('[Auth] Persisting session...');
            await SecurityUtils.saveToken(token);
            await SecurityUtils.saveHospynId(hospynId);
            await AsyncStorage.setItem('auth_provider', provider);
            
            setIsAuthenticated(true);
            setAuthProvider(provider);
            
            // If we have a name from onboarding, set it immediately for the greeting
            if (fullName) {
                setUser({ full_name: fullName, hospyn_id: hospynId });
            }
            
            // Refresh profile data in background to prevent UI block
            patientService.getProfile().then(profile => {
                setUser(profile);
                console.log('[Auth] Login profile synchronized.');
            }).catch(e => {
                console.warn('[Auth] Background profile sync failed, using defaults.');
            });
            
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
            
            // HIPAA compliance cache clearing
            try {
                patientService.clearCache();
                clinicalService.clearCache();
            } catch (cacheErr) {
                console.error('[Auth] Error clearing ephemeral caches:', cacheErr);
            }

            await SecurityUtils.deleteToken();
            await SecurityUtils.saveHospynId(null);
            await AsyncStorage.removeItem('auth_provider');
            setIsAuthenticated(false);
            setUser(null);
            setNeedsPasswordSetup(false);
            console.log('[Auth] Session cleared.');
        } catch (error) {
            console.error('[Auth] Logout failed:', error);
        }
    };

    /**
     * Switch Profile Context (Primary <-> Family Member)
     */
    const switchProfile = async (memberId) => {
        try {
            console.log('[Auth] Switching profile context to:', memberId || 'Primary');
            await SecurityUtils.saveActiveMemberId(memberId);
            
            // Refresh profile data under the new context
            // Note: apiClient will automatically include X-Family-Member-ID now
            const profile = await patientService.getProfile();
            setUser(profile);
            
            console.log('[Auth] Profile switch successful for:', profile.full_name);
            return true;
        } catch (error) {
            console.error('[Auth] Profile switch failed:', error);
            return false;
        }
    };

    /**
     * FIX-A6 (2026-06-23): called after a Google/Apple user successfully sets
     * a real Hospyn ID + password, so the UI stops treating them as
     * "social-only" without needing a full re-login.
     */
    const updateAuthProvider = async (provider) => {
        try {
            await AsyncStorage.setItem('auth_provider', provider);
            setAuthProvider(provider);
        } catch (error) {
            console.error('[Auth] Failed to update auth provider:', error);
        }
    };

    return (
        <AuthContext.Provider value={{
            isAuthenticated,
            isLoading,
            user,
            authProvider,
            needsPasswordSetup,
            setNeedsPasswordSetup,
            login,
            logout,
            switchProfile,
            updateAuthProvider,
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
