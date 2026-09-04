/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: 'var(--color-primary, #005a8d)',
        themeGreen: '#0E8A5A',
        themeGreenHover: '#0b6f48',
      }
    },
  },
  plugins: [],
}
