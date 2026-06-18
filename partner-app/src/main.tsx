// partner-app/src/main.tsx
//
// FIX: Redux store Provider was COMPLETELY MISSING from this file.
// Every page using useDispatch() or useSelector() crashed with:
//   "could not find react-redux context value; please ensure the component
//    is wrapped in a <Provider>"
// Dashboard.jsx, Login.jsx, Orders.jsx, ReferralTracking.jsx all affected.

import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import store from './store';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    {/* FIX: Wrap App with Redux Provider so all useDispatch/useSelector calls work */}
    <Provider store={store}>
      <App />
    </Provider>
  </React.StrictMode>,
);
