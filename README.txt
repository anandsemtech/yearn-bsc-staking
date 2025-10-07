WelcomeScreen migration bundle
==============================

This folder contains the minimal files to enable your animated Tailwind-based Welcome screen with AppKit connect.

Files:
- src/routes/WelcomeScreen.tsx        → Drop into your project and point your router ('/' route) to it
- src/theme.css                        → Import in src/main.tsx (import './theme.css')
- tailwind.config.ts                   → Use or merge with your existing Tailwind config (includes safelist + animations)
- postcss.config.js                    → Standard PostCSS pipeline
- *.original                           → Copies of the files found in your upload so you can manually merge

Dependencies you should have installed:
  npm i lucide-react
  npm i -D tailwindcss postcss autoprefixer
  npx tailwindcss init -p   # when first setting up Tailwind

Router snippet:
  import WelcomeScreen from './routes/WelcomeScreen';
  <Route path="/" element={<WelcomeScreen />} />

Ensure Vite alias and Tailwind are wired:
  - vite.config.ts: alias '@' -> 'src' (if you use '@/...' imports elsewhere)
  - src/main.tsx: import './theme.css';

If you already have Tailwind/postcss configs, compare with the *.original files and merge the SAFELIST + animations.