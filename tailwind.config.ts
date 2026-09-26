import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      screens: {
        // Celular pequeno. Sem isto, todo "xs:" no código nunca
        // aplica e o conteúdo marcado com "hidden xs:block" fica
        // invisível em qualquer tela.
        xs: '420px',
      },
      colors: {
        cinema: {
          base: '#08090D',
          surface: '#11131C',
          elevated: '#1A1D2B',
          border: '#23273B',
        },
        accent: {
          purple: '#8B5CF6',
          blue: '#38BDF8',
          pink: '#F43F5E',
          gold: '#FBBF24',
        }
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'sans-serif'],
      },
      boxShadow: {
        'glow-purple': '0 0 25px -5px rgba(139, 92, 246, 0.35)',
        'glow-blue': '0 0 25px -5px rgba(56, 189, 248, 0.35)',
        'glow-pink': '0 0 25px -5px rgba(244, 63, 94, 0.35)',
        'glow-gold': '0 0 25px -5px rgba(251, 191, 36, 0.35)',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      }
    },
  },
  plugins: [],
} satisfies Config;
