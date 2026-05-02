/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        brand: {
          DEFAULT: "#235C63",
          light: "#2d7a83",
          dark: "#1a444a",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        "panel-slide-in": {
          from: { opacity: "0", transform: "translateX(-50%) translateY(20px) scale(0.97)" },
          to:   { opacity: "1", transform: "translateX(-50%) translateY(0) scale(1)" },
        },
        "panel-slide-out": {
          from: { opacity: "1", transform: "translateX(-50%) translateY(0) scale(1)" },
          to:   { opacity: "0", transform: "translateX(-50%) translateY(12px) scale(0.97)" },
        },
      },
      animation: {
        "panel-in":  "panel-slide-in 0.25s cubic-bezier(0.16,1,0.3,1)",
        "panel-out": "panel-slide-out 0.2s ease",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
