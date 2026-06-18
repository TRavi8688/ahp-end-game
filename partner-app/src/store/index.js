// src/store/index.js
import { configureStore } from '@reduxjs/toolkit';
import authReducer      from './authSlice';
import inventoryReducer from './inventorySlice';
import ordersReducer    from './ordersSlice';
import referralReducer  from './referralSlice';

const store = configureStore({
  reducer: {
    auth:      authReducer,
    inventory: inventoryReducer,
    orders:    ordersReducer,
    referrals: referralReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Allow non-serializable values only in these paths if needed
        ignoredActions: [],
      },
    }),
});

export default store;
