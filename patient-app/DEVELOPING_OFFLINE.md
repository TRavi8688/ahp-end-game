# Hospyn 2.0: Isolated Frontend Development

This guide explains how to develop and preview the **Patient App** without running the full backend infrastructure (FastAPI, Postgres, Redis, Celery).

## 🚀 How to Run

1.  **Navigate to the app directory**:
    ```bash
    cd patient-app
    ```

2.  **Enable Mock Mode**:
    Ensure `USE_MOCK_API = true` in `src/api.js`.

3.  **Install dependencies** (if not already done):
    ```bash
    npm install
    ```

4.  **Start the Web Preview**:
    ```bash
    npm run web
    ```

## 🛠 Why Use This Mode?
- **Zero Configuration**: No need to set up a database or AI API keys.
- **Low Resource Usage**: Saves significant RAM and CPU on your local machine.
- **Instant UI Feedback**: Perfect for tweaking styles, translations (`i18n`), and page navigation.

## 📝 Editing Mock Data
To change the data you see in the app (e.g., adding more records or changing Vitails), simply edit the `getMockData` function in `src/api.js`.
