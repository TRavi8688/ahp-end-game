// hr-portal/src/main.jsx
// FIXED: This is the correct entry point.
// The root App.jsx was the wrong entry — it was a single-file app that:
//   1. Used localStorage.getItem('hr_access_token') — PHI risk
//   2. Called http://localhost:8001 directly — bypassing nginx to auth service
//   3. Only had 3 tabs; the real src/App.jsx has 6 full pages
//
// index.html now points to this file.

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
