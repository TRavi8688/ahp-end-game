/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        hospyn: {
          black: '#050810',
          indigo: '#6366F1',
          slate: '#94A3B8',
          emerald: '#10B981',
          rose: '#EF4444',
          amber: '#F59E0B'
        }
      },
      fontFamily: {
        outfit: ['Outfit', 'sans-serif'],
        inter: ['Inter', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.6s cubic-bezier(0.4, 0, 0.2, 1) forwards',
      }
    },
  },
  plugins: [],
}
