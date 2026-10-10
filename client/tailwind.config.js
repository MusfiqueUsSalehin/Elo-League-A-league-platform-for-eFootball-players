/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        turf: {
          950: '#070D0A',
          900: '#0B1410',
          800: '#131E18',
          700: '#1B2921',
          600: '#25362B',
        },
        line: '#22332A',
        chalk: '#EEF3EF',
        mist: '#8FA398',
        flood: { DEFAULT: '#FFD24A', dim: '#B58D1F' },
        win: '#2BAE66',
        loss: '#E2574C',
      },
      fontFamily: {
        display: ['"Barlow Condensed"', 'Impact', 'sans-serif'],
        sans: ['"Inter Variable"', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      boxShadow: {
        panel: '0 1px 0 rgba(255,255,255,0.03) inset, 0 12px 28px -18px rgba(0,0,0,0.9)',
      },
    },
  },
  plugins: [],
};
