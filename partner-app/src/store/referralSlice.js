// src/store/referralSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import apiClient from '../services/apiClient';

// ── Async thunks ──────────────────────────────────────────────────────────────
export const fetchReferrals = createAsyncThunk(
  'referrals/fetch',
  async (filters = {}, { rejectWithValue }) => {
    try {
      const params = {};
      if (filters.status && filters.status !== 'all') params.status = filters.status;
      const { data } = await apiClient.get('/api/v1/partner/referrals', { params });
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.detail || 'Failed to fetch referrals');
    }
  }
);

export const fetchReferralStats = createAsyncThunk(
  'referrals/fetchStats',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await apiClient.get('/api/v1/partner/referrals/stats');
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.detail || 'Failed to fetch stats');
    }
  }
);

export const fetchPayouts = createAsyncThunk(
  'referrals/fetchPayouts',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await apiClient.get('/api/v1/partner/referrals/payouts');
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.detail || 'Failed to fetch payouts');
    }
  }
);

export const fetchReferralLink = createAsyncThunk(
  'referrals/fetchLink',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await apiClient.get('/api/v1/partner/referrals/link');
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.detail || 'Failed to fetch referral link');
    }
  }
);

// ── Slice ─────────────────────────────────────────────────────────────────────
const referralSlice = createSlice({
  name: 'referrals',
  initialState: {
    referrals:    [],
    stats:        null,
    payouts:      [],
    link:         null,
    loading:      false,
    statsLoading: false,
    error:        null,
    lastUpdated:  null,
  },
  reducers: {
    clearError(state) { state.error = null; },
  },
  extraReducers: (builder) => {
    builder
      // fetchReferrals
      .addCase(fetchReferrals.pending,   (state) => { state.loading = true;  state.error = null; })
      .addCase(fetchReferrals.fulfilled, (state, { payload }) => {
        state.loading     = false;
        state.referrals   = payload;
        state.lastUpdated = new Date().toISOString();
      })
      .addCase(fetchReferrals.rejected,  (state, { payload }) => { state.loading = false; state.error = payload; })

      // fetchReferralStats
      .addCase(fetchReferralStats.pending,   (state) => { state.statsLoading = true; })
      .addCase(fetchReferralStats.fulfilled, (state, { payload }) => {
        state.statsLoading = false;
        state.stats        = payload;
      })
      .addCase(fetchReferralStats.rejected,  (state, { payload }) => {
        state.statsLoading = false;
        state.error        = payload;
      })

      // fetchPayouts
      .addCase(fetchPayouts.fulfilled, (state, { payload }) => { state.payouts = payload; })

      // fetchReferralLink
      .addCase(fetchReferralLink.fulfilled, (state, { payload }) => { state.link = payload; });
  },
});

export const { clearError } = referralSlice.actions;
export default referralSlice.reducer;
