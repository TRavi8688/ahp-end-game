// src/store/index.js
import { configureStore } from '@reduxjs/toolkit';
import authReducer      from './authSlice';
import ordersReducer    from './ordersSlice';
import inventoryReducer from './inventorySlice';

export const store = configureStore({
  reducer: {
    auth:      authReducer,
    orders:    ordersReducer,
    inventory: inventoryReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({ serializableCheck: { ignoredActionPaths: ['payload.created_at', 'payload.updated_at'] } }),
});
