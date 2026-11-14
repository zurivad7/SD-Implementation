/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
      colors: {
        // One accent colour (spec section 9).
        accent: { 50: "#eef4ff", 100: "#dbe7fe", 600: "#2856c7", 700: "#1f449e", 300: "#8fb0f5" },
      },
    },
  },
  plugins: [],
};
