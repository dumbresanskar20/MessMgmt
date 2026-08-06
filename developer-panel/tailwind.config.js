/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        dark: {
          50: '#f6f6f7',
          100: '#e3e3e7',
          200: '#c7c7d0',
          300: '#a3a3b3',
          400: '#79798e',
          500: '#5c5c72',
          600: '#48485a',
          700: '#3c3c4b',
          800: '#26262e',
          900: '#1b1b22',
          950: '#0f0f13',
        }
      }
    },
  },
  plugins: [],
}
