/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: ['class', '.dark'],
  theme: {
  	extend: {
  		colors: {
  			primary: {
  				'50': '#f5f3ff',
  				'100': '#ede9fe',
  				'200': '#ddd6fe',
  				'300': '#c4b5fd',
  				'400': '#a78bfa',
  				'500': '#8b5cf6',
  				'600': '#7c3aed',
  				'700': '#6d28d9',
  				'800': '#5b21b6',
  				'900': '#4c1d95',
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
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
  			}
  		},
  		animation: {
  			'spin-slow': 'spin 12s linear infinite',
  			'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
  			float: 'float 6s ease-in-out infinite',
  			glow: 'glow 2s ease-in-out infinite alternate',
  			'bounce-slow': 'bounce 3s infinite',
  			wiggle: 'wiggle 1s ease-in-out infinite',
  			slide: 'slide 20s linear infinite',
  			'progress-fill': 'progress-fill 2s ease-out forwards',
  			'star-glow': 'star-glow 3s ease-in-out infinite',
  			'level-up': 'level-up 1s ease-out forwards'
  		},
  		keyframes: {
  			float: {
  				'0%, 100%': {
  					transform: 'translateY(0px) rotate(0deg)'
  				},
  				'50%': {
  					transform: 'translateY(-20px) rotate(180deg)'
  				}
  			},
  			glow: {
  				'0%': {
  					boxShadow: '0 0 20px rgba(139, 92, 246, 0.5), 0 0 40px rgba(139, 92, 246, 0.3), 0 0 60px rgba(139, 92, 246, 0.1)'
  				},
  				'100%': {
  					boxShadow: '0 0 30px rgba(139, 92, 246, 0.8), 0 0 60px rgba(139, 92, 246, 0.5), 0 0 90px rgba(139, 92, 246, 0.3)'
  				}
  			},
  			wiggle: {
  				'0%, 100%': {
  					transform: 'rotate(-3deg)'
  				},
  				'50%': {
  					transform: 'rotate(3deg)'
  				}
  			},
  			slide: {
  				'0%': {
  					transform: 'translateX(-100%)'
  				},
  				'100%': {
  					transform: 'translateX(100vw)'
  				}
  			},
  			'progress-fill': {
  				'0%': {
  					width: '0%'
  				},
  				'100%': {
  					width: 'var(--progress-width)'
  				}
  			},
  			'star-glow': {
  				'0%, 100%': {
  					filter: 'drop-shadow(0 0 10px currentColor)',
  					transform: 'scale(1)'
  				},
  				'50%': {
  					filter: 'drop-shadow(0 0 20px currentColor)',
  					transform: 'scale(1.1)'
  				}
  			},
  			'level-up': {
  				'0%': {
  					transform: 'scale(0.8) rotate(-10deg)',
  					opacity: '0'
  				},
  				'50%': {
  					transform: 'scale(1.2) rotate(5deg)',
  					opacity: '1'
  				},
  				'100%': {
  					transform: 'scale(1) rotate(0deg)',
  					opacity: '1'
  				}
  			}
  		},
  		backdropBlur: {
  			xs: '2px'
  		},
  		backgroundImage: {
  			'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
  			'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
  			'mesh-gradient': 'linear-gradient(45deg, #8B5CF6 0%, #3B82F6 25%, #06B6D4 50%, #10B981 75%, #F59E0B 100%)'
  		},
  		boxShadow: {
  			neon: '0 0 20px rgba(139, 92, 246, 0.5)',
  			'neon-lg': '0 0 40px rgba(139, 92, 246, 0.6)',
  			'neon-xl': '0 0 60px rgba(139, 92, 246, 0.7)',
  			star: '0 0 30px currentColor'
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
  safelist: [
    // Star level colors
    'text-amber-600', 'bg-amber-600', 'from-amber-600', 'to-amber-600', 'border-amber-600', 'bg-amber-50',
    'text-gray-400', 'bg-gray-400', 'from-gray-400', 'to-gray-400', 'border-gray-400', 'bg-gray-50',
    'text-yellow-500', 'bg-yellow-500', 'from-yellow-500', 'to-yellow-500', 'border-yellow-500', 'bg-yellow-50',
    'text-blue-500', 'bg-blue-500', 'from-blue-500', 'to-blue-500', 'border-blue-500', 'bg-blue-50',
    'text-purple-500', 'bg-purple-500', 'from-purple-500', 'to-purple-500', 'border-purple-500', 'bg-purple-50',
    'text-pink-500', 'bg-pink-500', 'from-pink-500', 'to-pink-500', 'border-pink-500', 'bg-pink-50',
    'text-indigo-600', 'bg-indigo-600', 'from-indigo-600', 'to-indigo-600', 'border-indigo-600', 'bg-indigo-50',
    'text-red-500', 'bg-red-500', 'from-red-500', 'to-red-500', 'border-red-500', 'bg-red-50',
    // Opacity variants
    'text-amber-600/80', 'text-gray-400/80', 'text-yellow-500/80', 'text-blue-500/80',
    'text-purple-500/80', 'text-pink-500/80', 'text-indigo-600/80', 'text-red-500/80',
    'bg-amber-600/10', 'bg-gray-400/10', 'bg-yellow-500/10', 'bg-blue-500/10',
    'bg-purple-500/10', 'bg-pink-500/10', 'bg-indigo-600/10', 'bg-red-500/10',
    'bg-amber-600/20', 'bg-gray-400/20', 'bg-yellow-500/20', 'bg-blue-500/20',
    'bg-purple-500/20', 'bg-pink-500/20', 'bg-indigo-600/20', 'bg-red-500/20',
    'border-amber-600/20', 'border-gray-400/20', 'border-yellow-500/20', 'border-blue-500/20',
    'border-purple-500/20', 'border-pink-500/20', 'border-indigo-600/20', 'border-red-500/20',
    'border-amber-600/40', 'border-gray-400/40', 'border-yellow-500/40', 'border-blue-500/40',
    'border-purple-500/40', 'border-pink-500/40', 'border-indigo-600/40', 'border-red-500/40',
    // Additional existing colors
    'text-purple-400',
    'text-blue-400', 
    'text-green-400',
    'text-orange-400',
    'text-pink-400',
    'bg-purple-400',
    'bg-blue-400',
    'bg-green-400', 
    'bg-orange-400',
    'bg-emerald-400',
    'from-purple-500',
    'to-purple-600',
    'from-blue-500',
    'to-blue-600',
    'from-green-500',
    'to-green-600',
    'from-orange-500',
    'to-orange-600',
  ]
};