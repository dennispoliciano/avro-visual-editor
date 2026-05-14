/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Montserrat', 'sans-serif'],
      },
      colors: {
        brand: {
          primary:        '#5C2D91',
          'primary-dark': '#3D1A6E',
          'primary-light':'#EDE7F6',
          secondary:      '#F57C00',
          'secondary-dark':'#E65100',
        },
      },
    },
  },
  plugins: [],
}
