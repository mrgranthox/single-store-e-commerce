/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0f1117",
        graphite: "#13161e",
        slate: "#8891aa",
        frost: "#f8f9fb",
        signal: "#4f7ef8",
        night: "#0f1117",
        shell: "#0f1117",
        sidebar: "#13161e",
        surface: "#1a1d27",
        elevated: "#20243a",
        page: "#f0f2f7",
        primary: "#4f7ef8",
        primaryHover: "#3b68e0",
        success: "#22c55e",
        warning: "#f59e0b",
        danger: "#ef4444",
        info: "#38bdf8"
      },
      boxShadow: {
        panel: "0 4px 16px rgba(0,0,0,0.10), 0 2px 6px rgba(0,0,0,0.06)",
        card: "0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)",
        sidebar: "2px 0 12px rgba(0,0,0,0.20)"
      },
      fontFamily: {
        sans: ["IBM Plex Sans", "Segoe UI", "sans-serif"],
        headline: ["Plus Jakarta Sans", "DM Sans", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"]
      },
      borderRadius: {
        card: "12px"
      }
    }
  },
  plugins: []
};
