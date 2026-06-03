/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#02040a",
        primary: "#00f2ff",
        secondary: "#6366f1",
        accent: "#10b981",
        surface: "rgba(255, 255, 255, 0.03)",
        "glass-border": "rgba(255, 255, 255, 0.06)",
      },
      fontFamily: {
        outfit: ["Outfit", "sans-serif"],
        inter: ["Inter", "sans-serif"],
      },
      animation: {
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(0, 242, 255, 0.2)' },
          '100%': { boxShadow: '0 0 20px rgba(0, 242, 255, 0.6)' },
        }
      }
    },
  },
  plugins: [],
}
