import type { Config } from "tailwindcss";
import { fontFamily } from "tailwindcss/defaultTheme";

const config: Config = {
    darkMode: ["class"],
    content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
  	screens: {
  		'xs': '375px',
  		'sm': '640px',
  		'md': '768px',
  		'lg': '1024px',
  		'xl': '1280px',
  		'2xl': '1536px',
  	},
  	fontFamily: {
  		sans: ['var(--font-geist-sans)', ...fontFamily.sans],
  		mono: ['var(--font-geist-mono)', ...fontFamily.mono],
  	},
  	extend: {
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
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			},
  			glow: {
  				primary: 'hsl(var(--glow-primary))',
  				accent: 'hsl(var(--glow-accent))',
  			}
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)',
  			'2xl': 'calc(var(--radius) + 4px)',
  			'3xl': 'calc(var(--radius) + 8px)',
  		},
  		spacing: {
  			'safe-top': 'env(safe-area-inset-top)',
  			'safe-bottom': 'env(safe-area-inset-bottom)',
  			'safe-left': 'env(safe-area-inset-left)',
  			'safe-right': 'env(safe-area-inset-right)',
  		},
  		minHeight: {
  			'touch': '44px',
  		},
  		minWidth: {
  			'touch': '44px',
  		},
  		boxShadow: {
  			'glow-sm': '0 0 10px hsl(var(--primary) / 0.3)',
  			'glow': '0 0 20px hsl(var(--primary) / 0.4), 0 0 40px hsl(var(--primary) / 0.2)',
  			'glow-lg': '0 0 30px hsl(var(--primary) / 0.5), 0 0 60px hsl(var(--primary) / 0.3)',
  			'glow-accent': '0 0 20px hsl(var(--accent) / 0.4), 0 0 40px hsl(var(--accent) / 0.2)',
  			'premium': '0 1px 2px hsl(var(--foreground) / 0.05), 0 4px 8px hsl(var(--foreground) / 0.04), 0 8px 16px hsl(var(--foreground) / 0.03)',
  			'premium-lg': '0 4px 6px hsl(var(--foreground) / 0.05), 0 10px 20px hsl(var(--foreground) / 0.04), 0 20px 40px hsl(var(--foreground) / 0.03)',
  			'inner-glow': 'inset 0 0 20px hsl(var(--primary) / 0.1)',
  		},
  		animation: {
  			'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
  			'gradient-shift': 'gradient-shift 3s ease infinite',
  			'float': 'float 3s ease-in-out infinite',
  			'shimmer': 'shimmer 2s ease-in-out infinite',
  			'spin-slow': 'spin 3s linear infinite',
  			'bounce-subtle': 'bounce-subtle 2s ease-in-out infinite',
  			'fade-in': 'fade-in 0.3s ease-out',
  			'slide-up': 'slide-up 0.3s ease-out',
  			'scale-in': 'scale-in 0.2s ease-out',
  		},
  		keyframes: {
  			'glow-pulse': {
  				'0%, 100%': { boxShadow: '0 0 15px hsl(var(--primary) / 0.4)' },
  				'50%': { boxShadow: '0 0 30px hsl(var(--primary) / 0.6), 0 0 50px hsl(var(--primary) / 0.3)' },
  			},
  			'gradient-shift': {
  				'0%, 100%': { backgroundPosition: '0% center' },
  				'50%': { backgroundPosition: '100% center' },
  			},
  			'float': {
  				'0%, 100%': { transform: 'translateY(0)' },
  				'50%': { transform: 'translateY(-5px)' },
  			},
  			'shimmer': {
  				'0%': { backgroundPosition: '100% 0' },
  				'100%': { backgroundPosition: '-100% 0' },
  			},
  			'bounce-subtle': {
  				'0%, 100%': { transform: 'translateY(0)' },
  				'50%': { transform: 'translateY(-3px)' },
  			},
  			'fade-in': {
  				'0%': { opacity: '0' },
  				'100%': { opacity: '1' },
  			},
  			'slide-up': {
  				'0%': { transform: 'translateY(10px)', opacity: '0' },
  				'100%': { transform: 'translateY(0)', opacity: '1' },
  			},
  			'scale-in': {
  				'0%': { transform: 'scale(0.95)', opacity: '0' },
  				'100%': { transform: 'scale(1)', opacity: '1' },
  			},
  		},
  		backgroundImage: {
  			'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
  			'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
  			'gradient-primary': 'linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--accent)) 100%)',
  			'gradient-glow': 'linear-gradient(135deg, hsl(var(--primary) / 0.2) 0%, hsl(var(--accent) / 0.2) 100%)',
  		},
  	}
  },
  plugins: [
    require("tailwindcss-animate"),
    require("@tailwindcss/typography"),
  ],
};
export default config;
