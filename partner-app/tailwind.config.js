/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // EXECUTION FIX: was an unrelated green palette (leftover from the old
        // dark "Command Center" dashboard). Replaced with the real Hospin
        // brand palette extracted from the approved mockups (Images 1,3,4,6,7,8):
        // soft lavender background, royal-violet primary actions.
        primary: {
          50:  '#F5F3FF',
          100: '#EDE9FE',
          200: '#DDD6FE',
          300: '#C4B5FD',
          400: '#A78BFA',
          500: '#8B5CF6',
          600: '#7C3AED',   // main button / active nav color
          700: '#6D28D9',
          800: '#5B21B6',
          900: '#4C1D95',
        },
        // page background tone used behind cards in every mockup
        lavender: {
          50: '#F8F7FF',
          100: '#F0EEFF',
        },
        // success / confirm actions (green CTA, "Dispensed" badges)
        success: {
          50:  '#ECFDF5',
          100: '#D1FAE5',
          500: '#10B981',
          600: '#059669',
          700: '#047857',
        },
        // low-stock / "Processing" badges
        warning: {
          50:  '#FFFBEB',
          100: '#FEF3C7',
          500: '#F59E0B',
          600: '#D97706',
        },
        // headings / wordmark tone (matches the logo's dark navy "Hospin" text)
        ink: {
          900: '#0F1029',
          800: '#1A1B3A',
        },
      },
      boxShadow: {
        card: '0 2px 12px rgba(76, 29, 149, 0.06)',
        floating: '0 8px 24px rgba(124, 58, 237, 0.25)',
      },
    },
  },
  plugins: [],
}
