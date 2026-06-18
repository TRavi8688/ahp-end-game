// src/store/ordersSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import apiClient from '../services/apiClient';

export const fetchOrders = createAsyncThunk(
  'orders/fetchOrders',
  async ({ status, search } = {}, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams();
      if (status && status !== 'all') params.append('status', status);
      if (search) params.append('search', search);
      const { data } = await apiClient.get(`/api/v1/partner/orders?${params}`);
      return data;
    } catch (err) {
      return rejectWithValue(err?.response?.data?.detail || 'Failed to load orders');
    }
  }
);

export const updateOrderStatus = createAsyncThunk(
  'orders/updateStatus',
  async ({ id, status }, { rejectWithValue }) => {
    try {
      const { data } = await apiClient.patch(`/api/v1/partner/orders/${id}/status`, { status });
      return data;
    } catch (err) {
      return rejectWithValue(err?.response?.data?.detail || 'Failed to update status');
    }
  }
);

const ordersSlice = createSlice({
  name: 'orders',
  initialState: {
    orders:       [],
    loading:      false,
    error:        null,
    activeFilter: 'all',
    pendingCount: 0,
  },
  reducers: {
    setFilter: (state, action) => { state.activeFilter = action.payload; },
    clearError: (state) => { state.error = null; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchOrders.pending,   (state) => { state.loading = true; state.error = null; })
      .addCase(fetchOrders.fulfilled, (state, action) => {
        state.loading      = false;
        state.orders       = action.payload;
        state.pendingCount = action.payload.filter(o => o.status === 'pending').length;
      })
      .addCase(fetchOrders.rejected,  (state, action) => {
        state.loading = false;
        state.error   = action.payload;
      })
      .addCase(updateOrderStatus.fulfilled, (state, action) => {
        const idx = state.orders.findIndex(o => o.id === action.payload.id);
        if (idx !== -1) state.orders[idx] = action.payload;
        state.pendingCount = state.orders.filter(o => o.status === 'pending').length;
      });
  },
});

export const { setFilter, clearError } = ordersSlice.actions;
export default ordersSlice.reducer;
