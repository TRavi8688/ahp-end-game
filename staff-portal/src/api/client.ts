/**
 * FIXED: This file previously had its own axios instance reading from sessionStorage.
 * Now re-exports from the canonical apiClient so both import paths work.
 */
export { default as apiClient, default } from '../apiClient';

export const authAPI = {
  login: (email: string, password: string) =>
    import('../apiClient').then(({ default: api }) =>
      api.post('/auth/login', { username: email, password })
    ),
};
