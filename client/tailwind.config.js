/** @type {import('tailwindcss').Config}
 *
 * WENKER theme-aware Tailwind config.
 *
 * The `slate` (surfaces / text) and `cyan` (accent) palettes are resolved from CSS
 * custom properties declared in :root (see src/styles/index.css). Channels are
 * stored as space-separated RGB, so Tailwind opacity modifiers such as
 * `border-cyan-500/30` keep working.
 *
 * Result: a WENKER add-on theme only has to override a handful of `--color-*`
 * variables to reskin the whole console - no JSX rewrite needed.
 */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        cyan: {
          50: 'rgb(var(--color-cyan-50) / <alpha-value>)',
          100: 'rgb(var(--color-cyan-100) / <alpha-value>)',
          200: 'rgb(var(--color-cyan-200) / <alpha-value>)',
          300: 'rgb(var(--color-cyan-300) / <alpha-value>)',
          400: 'rgb(var(--color-cyan-400) / <alpha-value>)',
          500: 'rgb(var(--color-cyan-500) / <alpha-value>)',
          600: 'rgb(var(--color-cyan-600) / <alpha-value>)',
          700: 'rgb(var(--color-cyan-700) / <alpha-value>)',
          800: 'rgb(var(--color-cyan-800) / <alpha-value>)',
          900: 'rgb(var(--color-cyan-900) / <alpha-value>)',
          950: 'rgb(var(--color-cyan-950) / <alpha-value>)'
        },
        slate: {
          50: 'rgb(var(--color-slate-50) / <alpha-value>)',
          100: 'rgb(var(--color-slate-100) / <alpha-value>)',
          200: 'rgb(var(--color-slate-200) / <alpha-value>)',
          300: 'rgb(var(--color-slate-300) / <alpha-value>)',
          400: 'rgb(var(--color-slate-400) / <alpha-value>)',
          500: 'rgb(var(--color-slate-500) / <alpha-value>)',
          600: 'rgb(var(--color-slate-600) / <alpha-value>)',
          700: 'rgb(var(--color-slate-700) / <alpha-value>)',
          750: 'rgb(var(--color-slate-750) / <alpha-value>)',
          800: 'rgb(var(--color-slate-800) / <alpha-value>)',
          900: 'rgb(var(--color-slate-900) / <alpha-value>)',
          950: 'rgb(var(--color-slate-950) / <alpha-value>)'
        },
        // Heading/value token: white in the default (dark) skin, overridden to a
        // dark ink by light add-on themes (see --color-heading in index.css).
        heading: 'rgb(var(--color-heading) / <alpha-value>)'
      }
    }
  },
  plugins: []
};
