/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{html,ts}"],
  theme: {
    extend: {
      colors: {
        pink: "#ec2a7a",
        "dark-blue": "#1a1064",
        "pink-palette": {
          50: "#fef1f8",
          100: "#fee5f2",
          200: "#ffcbe7",
          300: "#ffa1d2",
          400: "#ff67b2",
          500: "#fa3a93",
          600: "#ec2a7a",
          700: "#cc0a55",
          800: "#a80c46",
          900: "#8c0f3d",
          950: "#560120",
        },
        "dark-blue-palette": {
          50: "#f3f4ff",
          100: "#e9eafe",
          200: "#d6d8fe",
          300: "#b5b7fd",
          400: "#8d8bfa",
          500: "#675cf6",
          600: "#523aed",
          700: "#4428d9",
          800: "#3821b6",
          900: "#301d95",
          950: "#1a1064",
        },
      },
      fontFamily: {
        sans: ["Montserrat", "sans-serif"],
      },
      spacing: {
        72: "18rem",
        80: "20rem",
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms')
  ],
};
