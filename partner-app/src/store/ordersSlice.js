// src/store/ordersSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import apiClient from '../services/apiClient';

// ── Async thunks ──────────────────────────────────────────────────────────────
export const fetchOrders = createAsyncThunk(
  'orders/fetch',
  async (filters = {}, { rejectWithValue }) => {
    try {
      const params = {};
      if (filters.status && filters.status !== 'all') params.status    = filters.status;
      if (filters.search)                              params.search    = filters.search;
      if (filters.page)                                params.page      = filters.page;
      if (filters.pageSize)                            params.page_size = filters.pageSize;
      const { data } = await apiClient.get('/api/v1/partner/orders', { params });
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.detail || 'Failed to fetch orders');
    }
  }
);

export const updateOrderStatus = createAsyncThunk(
  'orders/updateStatus',
  async ({ id, status, notes }, { rejectWithValue }) => {
    try {
      const { data } = await apiClient.patch(`/api/v1/partner/orders/${id}/status`, { status, notes });
      return { id, status, ...data };
    } catch (err) {
      return rejectWithValue(err.response?.data?.detail || 'Failed to update order');
    }
  }
);

// ── Helpers ───────────────────────────────────────────────────────────────────
const countPending = (orders) => orders.filter((o) => o.status === 'pending').length;

// ── Slice ─────────────────────────────────────────────────────────────────────
const ordersSlice = createSlice({
  name: 'orders',
  initialState: {
    orders:         [],
    pendingCount:   0,
    loading:        false,
    error:          null,
    activeFilter:   'all',
    lastUpdated:    null,
  },
  reducers: {
    setFilter(state, { payload }) { state.activeFilter = payload; },
    clearError(state)             { state.error        = null;    },
  },
  extraReducers: (builder) => {
    builder
      // fetchOrders
      .addCase(fetchOrders.pending,   (state) => { state.loading = true; state.error = null; })
      .addCase(fetchOrders.fulfilled, (state, { payload }) => {
        state.loading     = false;
        state.orders      = payload;
        state.pendingCount = countPending(payload);
        state.lastUpdated  = new Date().toISOString();
      })
      .addCase(fetchOrders.rejected,  (state, { payload }) => { state.loading = false; state.error = payload; })

      // updateOrderStatus — optimistic update
      .addCase(updateOrderStatus.fulfilled, (state, { payload }) => {
        const order = state.orders.find((o) => o.id === payload.id);
        if (order) {
          order.status     = payload.status;
          order.updated_at = payload.updated_at;
        }
        state.pendingCount = countPending(state.orders);
      })
      .addCase(updateOrderStatus.rejected, (state, { payload }) => { state.error = payload; });
  },
});

export const { setFilter, clearError } = ordersSlice.actions;
export default ordersSlice.reducer;
