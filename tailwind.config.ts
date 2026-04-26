import type { Config } from "tailwindcss";

export default {
	darkMode: ["class"],
	content: [
		"./pages/**/*.{ts,tsx}",
		"./components/**/*.{ts,tsx}",
		"./app/**/*.{ts,tsx}",
		"./src/**/*.{ts,tsx}",
	],
	prefix: "",
	theme: {
		container: {
			center: true,
			padding: '2rem',
			screens: {
				'2xl': '1400px'
			}
		},
		extend: {
			fontFamily: {
				heading: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
				body: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
				sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
				mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
			},
			fontSize: {
				// Aligned to --fs-* in tokens.css
				'11': ['11px', { lineHeight: '1.0' }],
				'12': ['12px', { lineHeight: '1.15' }],
				'13': ['13px', { lineHeight: '1.4' }],
				'14': ['14px', { lineHeight: '1.4' }],
				'16': ['16px', { lineHeight: '1.4' }],
				'18': ['18px', { lineHeight: '1.15' }],
				'20': ['20px', { lineHeight: '1.15' }],
				'24': ['24px', { lineHeight: '1.15' }],
				'32': ['32px', { lineHeight: '1.0' }],
				'40': ['40px', { lineHeight: '1.0' }],
				'56': ['56px', { lineHeight: '1.0' }],
			},
			colors: {
				// shadcn bridge
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))',
					light: 'hsl(var(--primary-light))',
					dark: 'hsl(var(--primary-dark))'
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))'
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))'
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))'
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))',
					light: 'hsl(var(--accent-light))'
				},
				success: {
					DEFAULT: 'hsl(var(--success))',
					foreground: 'hsl(var(--success-foreground))'
				},
				warning: {
					DEFAULT: 'hsl(var(--warning))',
					foreground: 'hsl(var(--warning-foreground))'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))'
				},
				sidebar: {
					DEFAULT: 'hsl(var(--sidebar-background))',
					foreground: 'hsl(var(--sidebar-foreground))',
					primary: 'hsl(var(--sidebar-primary))',
					'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
					accent: 'hsl(var(--sidebar-accent))',
					'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
					border: 'hsl(var(--sidebar-border))',
					ring: 'hsl(var(--sidebar-ring))'
				},
				'accent-purple': 'hsl(var(--accent-purple))',
				'accent-purple-dark': 'hsl(var(--accent-purple-dark))',
				'accent-yellow': 'hsl(var(--accent-yellow))',
				'accent-blue': 'hsl(var(--accent-blue))',
				'accent-green': 'hsl(var(--accent-green))',
				'accent-pink': 'hsl(var(--accent-pink))',

				// New design-system scales — `rgb(var(--*-rgb) / <alpha-value>)`
				// so Tailwind's opacity modifiers (bg-iris-400/20 etc.) compose alpha.
				ink: {
					300: 'rgb(var(--ink-300-rgb) / <alpha-value>)',
					400: 'rgb(var(--ink-400-rgb) / <alpha-value>)',
					500: 'rgb(var(--ink-500-rgb) / <alpha-value>)',
					600: 'rgb(var(--ink-600-rgb) / <alpha-value>)',
					700: 'rgb(var(--ink-700-rgb) / <alpha-value>)',
					800: 'rgb(var(--ink-800-rgb) / <alpha-value>)',
					900: 'rgb(var(--ink-900-rgb) / <alpha-value>)',
				},
				iris: {
					50:  'rgb(var(--iris-50-rgb)  / <alpha-value>)',
					100: 'rgb(var(--iris-100-rgb) / <alpha-value>)',
					200: 'rgb(var(--iris-200-rgb) / <alpha-value>)',
					300: 'rgb(var(--iris-300-rgb) / <alpha-value>)',
					400: 'rgb(var(--iris-400-rgb) / <alpha-value>)',
					500: 'rgb(var(--iris-500-rgb) / <alpha-value>)',
					600: 'rgb(var(--iris-600-rgb) / <alpha-value>)',
					700: 'rgb(var(--iris-700-rgb) / <alpha-value>)',
				},
				lilac: {
					300: 'rgb(var(--lilac-300-rgb) / <alpha-value>)',
					400: 'rgb(var(--lilac-400-rgb) / <alpha-value>)',
					500: 'rgb(var(--lilac-500-rgb) / <alpha-value>)',
					600: 'rgb(var(--lilac-600-rgb) / <alpha-value>)',
				},
				mint: {
					300: 'rgb(var(--mint-300-rgb) / <alpha-value>)',
					400: 'rgb(var(--mint-400-rgb) / <alpha-value>)',
					500: 'rgb(var(--mint-500-rgb) / <alpha-value>)',
					600: 'rgb(var(--mint-600-rgb) / <alpha-value>)',
				},
				coral: {
					300: 'rgb(var(--coral-300-rgb) / <alpha-value>)',
					400: 'rgb(var(--coral-400-rgb) / <alpha-value>)',
					500: 'rgb(var(--coral-500-rgb) / <alpha-value>)',
					600: 'rgb(var(--coral-600-rgb) / <alpha-value>)',
				},
				amber: {
					400: 'rgb(var(--amber-400-rgb) / <alpha-value>)',
					500: 'rgb(var(--amber-500-rgb) / <alpha-value>)',
					600: 'rgb(var(--amber-600-rgb) / <alpha-value>)',
				},
				fog: {
					50:  'rgb(var(--fog-50-rgb)  / <alpha-value>)',
					100: 'rgb(var(--fog-100-rgb) / <alpha-value>)',
					200: 'rgb(var(--fog-200-rgb) / <alpha-value>)',
					300: 'rgb(var(--fog-300-rgb) / <alpha-value>)',
					400: 'rgb(var(--fog-400-rgb) / <alpha-value>)',
					500: 'rgb(var(--fog-500-rgb) / <alpha-value>)',
				},
				paper: 'rgb(var(--paper-rgb) / <alpha-value>)',
			},
			spacing: {
				// Aligned to --sp-* in tokens.css
				'sp-1': '4px',
				'sp-2': '8px',
				'sp-3': '12px',
				'sp-4': '16px',
				'sp-5': '20px',
				'sp-6': '24px',
				'sp-7': '32px',
				'sp-8': '40px',
				'sp-9': '56px',
				'sp-10': '72px',
			},
			borderRadius: {
				// shadcn legacy
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)',
				// New system — aligned to --r-*
				'xs':   'var(--r-xs)',    // 6
				'r-sm': 'var(--r-sm)',    // 12
				'r-md': 'var(--r-md)',    // 20
				'r-lg': 'var(--r-lg)',    // 28
				'r-xl': 'var(--r-xl)',    // 36
				'r-2xl':'var(--r-2xl)',   // 48
				'pill': 'var(--r-pill)',  // 999
			},
			boxShadow: {
				'sh-sm':   'var(--sh-sm)',
				'sh-md':   'var(--sh-md)',
				'sh-lg':   'var(--sh-lg)',
				'glow-iris':  'var(--sh-glow-iris)',
				'glow-mint':  'var(--sh-glow-mint)',
				'glow-coral': 'var(--sh-glow-coral)',
			},
			backgroundImage: {
				'ground-cosmic': 'var(--ground-cosmic)',
				'ground-dusk':   'var(--ground-dusk)',
				'stroke-aurora': 'linear-gradient(135deg, var(--fog-500), var(--lilac-400))',
			},
			transitionTimingFunction: {
				'out-expo':  'cubic-bezier(0.22, 1, 0.36, 1)',
				'in-out-smooth': 'cubic-bezier(0.65, 0, 0.35, 1)',
			},
			transitionDuration: {
				'xs':  '120ms',
				'sm':  '180ms',
				'md':  '260ms',
				'lg':  '420ms',
			},
			keyframes: {
				'accordion-down': {
					from: { height: '0' },
					to:   { height: 'var(--radix-accordion-content-height)' }
				},
				'accordion-up': {
					from: { height: 'var(--radix-accordion-content-height)' },
					to:   { height: '0' }
				}
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up':   'accordion-up 0.2s ease-out'
			}
		}
	},
	plugins: [require("tailwindcss-animate")],
} satisfies Config;
