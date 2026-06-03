# Chapter 03: Frontend Architecture

## 3.1 Framework Stack
Hospyn 2.0 uses a dual-frontend strategy to ensure native performance on mobiles and high productivity on the web.
- **Patient App:** React Native with **Expo**. Chosen for "write once, run anywhere" capability and access to native SecureStore and Camera APIs.
- **Doctor App:** React with **Vite** and **TailwindCSS**. Chosen for extreme build speed and highly responsive UI utility layers.

## 3.2 UI Structure & Component Design
Both apps follow the **Atomic Design** methodology:
1. **Atoms:** Buttons, Inputs, Typography tokens.
2. **Molecules:** Search bars, Login forms, Status badges.
3. **Organisms:** Navigation sidebars, Medical record carousels.
4. **Templates/Pages:** Complete screen layouts.

## 3.3 State Management Matrix
- **Auth State:** React Context API + encrypted persistent storage. Used for session tokens and user profile cache.
- **Data Reactive State:** Local `useState` and `useReducer` for form handling.
- **Real-time State:** WebSocket event listeners update the UI instantly when a record is processed.

## 3.4 Routing Architecture
- **Patient App:** Uses `Expo Router` with file-based routing. Grouped into `(auth)` (public) and `(app)` (protected) stacks.
- **Doctor App:** Uses `react-router-dom` v6 with `ProtectedRoute` wrappers that verify JWT presence.

## 3.5 Frontend Security Protections
- **JWT Storage:** Tokens are stored in **SecureStore** (iOS/Android) or strictly in memory for the web app (no LocalStorage for sensitive tokens).
- **Network Layer:** Custom Axios instance with interceptors for `401 Unauthorized` handling and automatic Token Refresh logic.
- **Protection:** Sanitization of all user-generated input before rendering to prevent XSS.

## 3.6 Communication Workflows (Visual)
```mermaid
graph LR
    subgraph "Frontend Layer"
        UI[State/UI]
        Axios[Axios Instance]
    end
    subgraph "API Layer"
        BE[FastAPI]
    </div>
    
    UI --> |Action: Fetch| Axios
    Axios --> |Header: Authorization Bearer| BE
    BE --> |JSON Response| Axios
    Axios --> |Dispatcher| UI
```
