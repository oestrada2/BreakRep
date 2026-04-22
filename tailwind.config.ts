import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        bg:        '#0B1C2D',
        surface:   '#112A46',
        panel:     '#163A5F',
        textPrim:  '#EAF2FF',
        textSec:   '#A9C1E8',
        complete:  '#22C55E',
        snooze:    '#FACC15',
        skip:      '#FB923C',
        danger:    '#EF4444',
        action:    '#38BDF8',
      },
    },
  },
  plugins: [],
};

export default config;
