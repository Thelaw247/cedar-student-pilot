/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  // Hover styles only apply on devices that actually hover — otherwise the
  // -translate-y lifts fired as sticky-hover jank on every touch (Design
  // Blueprint, global fix #13).
  future: { hoverOnlyWhenSupported: true },
  content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
    extend: {
      borderRadius: {
        // The concentric ladder (DSN-03): mapping the raw Tailwind steps onto
        // it retokens every existing rounded-* class in one place —
        // lg 12 / xl 16 / 2xl 20 (card) / 3xl 24 (modal).
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        xl: '1rem',
        '2xl': 'var(--radius-card)',
        '3xl': 'var(--radius-modal)',
        chip: 'var(--radius-chip)',
        button: 'var(--radius-button)',
        card: 'var(--radius-card)',
        input: 'var(--radius-input)',
        modal: 'var(--radius-modal)',
        notification: 'var(--radius-notification)'
      },
      boxShadow: {
        '0': 'var(--shadow-0)',
        '1': 'var(--shadow-1)',
        '2': 'var(--shadow-2)',
        '3': 'var(--shadow-3)'
      },
      transitionTimingFunction: {
        standard: 'var(--ease-standard)'
      },
      transitionDuration: {
        micro: 'var(--duration-micro)',
        standard: 'var(--duration-standard)',
        modal: 'var(--duration-modal)',
        page: 'var(--duration-page)'
      },
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))'
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))'
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))'
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))'
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))'
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))'
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))'
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
      },
      fontFamily: {
        heading: ['var(--font-heading)'],
        body: ['var(--font-body)'],
        display: ['var(--font-display)'],
        mono: ['var(--font-mono)']
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' }
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' }
        },
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' }
        },
        'slide-in': {
          from: { opacity: '0', transform: 'translateX(-12px)' },
          to: { opacity: '1', transform: 'translateX(0)' }
        }
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'fade-in': 'fade-in 0.3s ease-out',
        'slide-in': 'slide-in 0.3s ease-out'
      }
    }
  },
  plugins: [require("tailwindcss-animate")]
}
