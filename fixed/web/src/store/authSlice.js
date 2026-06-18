// src/store/authSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import apiClient from '../services/apiClient';

export const loginPartner = createAsyncThunk(
  'auth/loginPartner',
  async ({ email, password }, { rejectWithValue }) => {
    try {
      const { data } = await apiClient.post('/api/v1/partner/auth/login', { email, password });
      return data; // { access_token, partner }
    } catch (err) {
      return rejectWithValue(err?.response?.data?.detail || 'Login failed');
    }
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    partner:  null,
    token:    null,
    loading:  false,
    error:    null,
  },
  reducers: {
    clearAuthError: (state) => { state.error = null; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginPartner.pending,   (state) => { state.loading = true;  state.error = null; })
      .addCase(loginPartner.fulfilled, (state, action) => {
        state.loading = false;
        state.token   = action.payload.access_token;
        state.partner = action.payload.partner;
      })
      .addCase(loginPartner.rejected,  (state, action) => {
        state.loading = false;
        state.error   = action.payload;
      });
  },
});

export const { clearAuthError } = authSlice.actions;
export default authSlice.reducer;
