// src/store/inventorySlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import apiClient from '../services/apiClient';

// ── Async thunks ──────────────────────────────────────────────────────────────
export const fetchInventory = createAsyncThunk(
  'inventory/fetch',
  async (filters = {}, { rejectWithValue }) => {
    try {
      const params = {};
      if (filters.category)  params.category  = filters.category;
      if (filters.search)    params.search    = filters.search;
      if (filters.lowStock)  params.low_stock = true;
      const { data } = await apiClient.get('/api/v1/partner/inventory', { params });
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.detail || 'Failed to fetch inventory');
    }
  }
);

export const updateStock = createAsyncThunk(
  'inventory/updateStock',
  async ({ id, stock_quantity, reason = 'manual_adjustment' }, { rejectWithValue }) => {
    try {
      const { data } = await apiClient.patch(`/api/v1/partner/inventory/${id}/stock`, {
        stock_quantity,
        reason,
      });
      return { id, stock_quantity, ...data };
    } catch (err) {
      return rejectWithValue(err.response?.data?.detail || 'Failed to update stock');
    }
  }
);

export const scanQRCode = createAsyncThunk(
  'inventory/scanQR',
  async (qrCode, { rejectWithValue }) => {
    try {
      const { data } = await apiClient.get('/api/v1/partner/inventory/scan', {
        params: { qr: qrCode },
      });
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.detail || 'QR scan failed');
    }
  }
);

// ── Slice ─────────────────────────────────────────────────────────────────────
const inventorySlice = createSlice({
  name: 'inventory',
  initialState: {
    items:       [],
    loading:     false,
    error:       null,
    qrResult:    null,   // { found, item, message }
    qrLoading:   false,
    lastUpdated: null,
  },
  reducers: {
    clearQRResult(state)  { state.qrResult = null; },
    clearError(state)     { state.error    = null; },
  },
  extraReducers: (builder) => {
    builder
      // fetchInventory
      .addCase(fetchInventory.pending,   (state) => { state.loading = true; state.error = null; })
      .addCase(fetchInventory.fulfilled, (state, { payload }) => {
        state.loading     = false;
        state.items       = payload;
        state.lastUpdated = new Date().toISOString();
      })
      .addCase(fetchInventory.rejected,  (state, { payload }) => { state.loading = false; state.error = payload; })

      // updateStock — optimistic update
      .addCase(updateStock.fulfilled, (state, { payload }) => {
        const item = state.items.find((i) => i.id === payload.id);
        if (item) {
          item.stock_quantity = payload.stock_quantity;
          item.is_available   = payload.stock_quantity > 0;
        }
      })
      .addCase(updateStock.rejected, (state, { payload }) => { state.error = payload; })

      // scanQR
      .addCase(scanQRCode.pending,   (state) => { state.qrLoading = true; state.qrResult = null; })
      .addCase(scanQRCode.fulfilled, (state, { payload }) => { state.qrLoading = false; state.qrResult = payload; })
      .addCase(scanQRCode.rejected,  (state, { payload }) => {
        state.qrLoading = false;
        state.qrResult  = { found: false, item: null, message: payload };
      });
  },
});

export const { clearQRResult, clearError } = inventorySlice.actions;
export default inventorySlice.reducer;
