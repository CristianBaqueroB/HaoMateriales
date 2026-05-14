/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'hao-blue': '#1e3a8a',
        'hao-orange': '#f97316',
      }
    },
  },
  plugins: [],
}