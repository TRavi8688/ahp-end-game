/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  // FIXED: safelist dynamic colour classes used in OwnerDashboard quick-actions
  // e.g. bg-emerald-500/10, text-emerald-500, border-emerald-500/20
  safelist: [
    { pattern: /^(bg|text|border)-(emerald|blue|purple|amber|rose|red|indigo|sky|green)-(400|500|600)(\/10|\/20|\/30)?$/ },
    'animate-in',
    'slide-in-from-left-8',
    'duration-700',
    'duration-1000',
  ],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary:    "hsl(var(--primary))",
        emergency:  "hsl(var(--emergency))",
        vip:        "hsl(var(--vip))",
        success:    "hsl(var(--success))",
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
        mono: ["ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
}
