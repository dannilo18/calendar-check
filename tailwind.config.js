/** @type {import('tailwindcss').Config} */
const config = {
  content: ["./src/**/*.{js,jsx,mdx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#1a2744",
          light: "#243460",
          dark: "#111b30",
        },
        gold: {
          DEFAULT: "#c5973a",
          light: "#d4a94f",
          dark: "#a87d2a",
        },
        cream: "#f8f5f0",
      },
      fontFamily: {
        serif: ["Georgia", "Cambria", "Times New Roman", "serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
