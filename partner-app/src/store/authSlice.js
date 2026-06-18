// src/store/authSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import apiClient from '../services/apiClient';

// ── Async thunks ──────────────────────────────────────────────────────────────
export const loginPartner = createAsyncThunk(
  'auth/login',
  async ({ email, password }, { rejectWithValue }) => {
    try {
      const { data } = await apiClient.post('/api/v1/partner/auth/login', { email, password });
      // Persist tokens to localStorage so apiClient interceptor can read them
      localStorage.setItem('partner_access_token',  data.access_token);
      localStorage.setItem('partner_refresh_token', data.refresh_token);
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.detail || 'Login failed');
    }
  }
);

export const fetchMe = createAsyncThunk(
  'auth/fetchMe',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await apiClient.get('/api/v1/partner/auth/me');
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.detail || 'Session expired');
    }
  }
);

// ── Initial state ─────────────────────────────────────────────────────────────
const initialState = {
  user:            null,
  token:           localStorage.getItem('partner_access_token') || null,
  isAuthenticated: !!localStorage.getItem('partner_access_token'),
  loading:         false,
  error:           null,
};

// ── Slice ─────────────────────────────────────────────────────────────────────
const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout(state) {
      state.user            = null;
      state.token           = null;
      state.isAuthenticated = false;
      localStorage.removeItem('partner_access_token');
      localStorage.removeItem('partner_refresh_token');
    },
    clearError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // login
      .addCase(loginPartner.pending,   (state) => { state.loading = true;  state.error = null; })
      .addCase(loginPartner.fulfilled, (state, { payload }) => {
        state.loading         = false;
        state.user            = payload.partner;
        state.token           = payload.access_token;
        state.isAuthenticated = true;
      })
      .addCase(loginPartner.rejected,  (state, { payload }) => { state.loading = false; state.error = payload; })
      // fetchMe
      .addCase(fetchMe.fulfilled, (state, { payload }) => { state.user = payload; state.isAuthenticated = true; })
      .addCase(fetchMe.rejected,  (state) => { state.isAuthenticated = false; state.user = null; });
  },
});

export const { logout, clearError } = authSlice.actions;
export default authSlice.reducer;
