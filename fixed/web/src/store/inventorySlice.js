// src/store/inventorySlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import apiClient from '../services/apiClient';

export const fetchInventory = createAsyncThunk(
  'inventory/fetch',
  async ({ search = '', category = '', lowStock = false } = {}, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams();
      if (search)   params.append('search', search);
      if (category) params.append('category', category);
      if (lowStock) params.append('low_stock', 'true');
      const { data } = await apiClient.get(`/api/v1/partner/inventory?${params}`);
      return data;
    } catch (err) {
      return rejectWithValue(err?.response?.data?.detail || 'Failed to load inventory');
    }
  }
);

export const updateStock = createAsyncThunk(
  'inventory/updateStock',
  async ({ id, stock_quantity, reason }, { rejectWithValue }) => {
    try {
      const { data } = await apiClient.patch(`/api/v1/partner/inventory/${id}/stock`, {
        stock_quantity,
        reason: reason || 'manual_update',
      });
      return data;
    } catch (err) {
      return rejectWithValue(err?.response?.data?.detail || 'Failed to update stock');
    }
  }
);

export const scanQRCode = createAsyncThunk(
  'inventory/scan',
  async (qr_code, { rejectWithValue }) => {
    try {
      const { data } = await apiClient.get(`/api/v1/partner/inventory/scan?qr=${encodeURIComponent(qr_code)}`);
      return data;
    } catch (err) {
      // 404 means not found — return structured not-found result
      if (err?.response?.status === 404) {
        return { found: false, message: `No item found for "${qr_code}"`, item: null };
      }
      return rejectWithValue(err?.response?.data?.detail || 'Scan failed');
    }
  }
);

const inventorySlice = createSlice({
  name: 'inventory',
  initialState: {
    items:     [],
    loading:   false,
    error:     null,
    qrResult:  null,
    qrLoading: false,
  },
  reducers: {
    clearError:    (state) => { state.error = null; },
    clearQRResult: (state) => { state.qrResult = null; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchInventory.pending,   (state) => { state.loading = true; state.error = null; })
      .addCase(fetchInventory.fulfilled, (state, action) => {
        state.loading = false;
        state.items   = action.payload;
      })
      .addCase(fetchInventory.rejected,  (state, action) => {
        state.loading = false;
        state.error   = action.payload;
      })
      .addCase(updateStock.fulfilled, (state, action) => {
        const idx = state.items.findIndex(i => i.id === action.payload.id);
        if (idx !== -1) state.items[idx] = action.payload;
      })
      .addCase(scanQRCode.pending,   (state) => { state.qrLoading = true; state.qrResult = null; })
      .addCase(scanQRCode.fulfilled, (state, action) => {
        state.qrLoading = false;
        state.qrResult  = action.payload;
      })
      .addCase(scanQRCode.rejected,  (state, action) => {
        state.qrLoading = false;
        state.qrResult  = { found: false, message: action.payload, item: null };
      });
  },
});

export const { clearError, clearQRResult } = inventorySlice.actions;
export default inventorySlice.reducer;
