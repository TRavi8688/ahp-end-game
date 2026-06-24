/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // HOSPAIN brand palette — extracted from the new HOSPAIN logo:
        // dark navy wordmark (#0F2A5E), gradient blue icon (#1565C0 → #1E88E5)
        primary: {
          50:  '#E8F1FB',
          100: '#C5D9F5',
          200: '#93B8ED',
          300: '#5A91E0',
          400: '#2E72D4',
          500: '#1565C0',  // mid-blue from logo gradient
          600: '#1154A8',
          700: '#0E4490',
          800: '#0F2A5E',  // dark navy from logo wordmark
          900: '#081A3C',
        },
        // page background — light blue tint
        lavender: {
          50:  '#F0F6FF',
          100: '#E0EDFF',
        },
        // success / dispensed
        success: {
          50:  '#ECFDF5',
          100: '#D1FAE5',
          500: '#10B981',
          600: '#059669',
          700: '#047857',
        },
        // low-stock / warning
        warning: {
          50:  '#FFFBEB',
          100: '#FEF3C7',
          500: '#F59E0B',
          600: '#D97706',
        },
        // heading / body text
        ink: {
          900: '#0A1628',
          800: '#1A2A48',
        },
      },
      boxShadow: {
        card:     '0 2px 12px rgba(15, 42, 94, 0.08)',
        floating: '0 8px 24px rgba(17, 84, 168, 0.22)',
      },
    },
  },
  plugins: [],
}
