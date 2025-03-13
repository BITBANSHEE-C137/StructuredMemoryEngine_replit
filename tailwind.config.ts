import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./client/index.html", "./client/src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          '"Inter var"',
          'Inter',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          '"Helvetica Neue"',
          'Arial',
          'sans-serif',
        ],
      },
      borderRadius: {
        lg: "var(--app-radius)",
        md: "calc(var(--app-radius) - 0.125rem)",
        sm: "calc(var(--app-radius) - 0.25rem)",
      },
      colors: {
        // Map our app- variables to Tailwind's color system
        app: {
          primary: "hsl(var(--app-primary))",
          "primary-foreground": "hsl(var(--app-primary-foreground))",
          "primary-hover": "hsl(var(--app-primary-hover))",
          
          secondary: "hsl(var(--app-secondary))",
          "secondary-foreground": "hsl(var(--app-secondary-foreground))",
          
          success: "hsl(var(--app-success))",
          info: "hsl(var(--app-info))",
          warning: "hsl(var(--app-warning))",
          danger: "hsl(var(--app-danger))"
        },
        
        // Legacy system
        background: "hsl(var(--app-background))",
        foreground: "hsl(var(--app-foreground))",
        card: {
          DEFAULT: "hsl(var(--app-card))",
          foreground: "hsl(var(--app-card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--app-card))",
          foreground: "hsl(var(--app-card-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--app-primary))",
          foreground: "hsl(var(--app-primary-foreground))",
          light: "hsl(var(--app-muted-foreground))",
          dark: "hsl(var(--app-primary-hover))",
        },
        secondary: {
          DEFAULT: "hsl(var(--app-info))",
          foreground: "hsl(var(--app-primary-foreground))",
          dark: "hsl(202 94% 45%)",
        },
        success: {
          DEFAULT: "hsl(var(--app-success))",
        },
        error: {
          DEFAULT: "hsl(var(--app-danger))",
          dark: "hsl(0 84% 55%)",
        },
        muted: {
          DEFAULT: "hsl(var(--app-muted))",
          foreground: "hsl(var(--app-muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--app-accent))",
          foreground: "hsl(var(--app-accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--app-danger))",
          foreground: "hsl(var(--app-primary-foreground))",
        },
        neutral: {
          DEFAULT: "hsl(var(--app-muted))",
          dark: "hsl(var(--app-border))",
          light: "hsl(210 40% 98%)",
        },
        border: "hsl(var(--app-border))",
        input: "hsl(var(--app-border))",
        ring: "hsl(var(--app-primary))",
        
        // Chart colors
        chart: {
          "1": "hsl(var(--app-primary))",
          "2": "hsl(var(--app-info))",
          "3": "hsl(var(--app-success))",
          "4": "hsl(var(--app-warning))",
          "5": "hsl(var(--app-danger))",
        },
        
        // Sidebar colors
        sidebar: {
          DEFAULT: "hsl(var(--app-sidebar-background))",
          foreground: "hsl(var(--app-sidebar-foreground))",
          primary: "hsl(var(--app-primary))",
          "primary-foreground": "hsl(var(--app-primary-foreground))",
          accent: "hsl(var(--app-accent))",
          "accent-foreground": "hsl(var(--app-accent-foreground))",
          border: "hsl(var(--app-sidebar-border))",
          ring: "hsl(var(--app-primary))",
        },
      },
      boxShadow: {
        'app-sm': '0 0.125rem 0.25rem rgba(0, 0, 0, 0.075)',
        'app': '0 0.5rem 1rem rgba(0, 0, 0, 0.08)',
        'app-lg': '0 1rem 3rem rgba(0, 0, 0, 0.1)',
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
        "pulse-slow": {
          '0%, 100%': {
            opacity: '0.1',
            transform: 'scale(0.9)',
          },
          '50%': {
            opacity: '0.3',
            transform: 'scale(1.05)',
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "pulse-slow": "pulse-slow 3s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
} satisfies Config;
