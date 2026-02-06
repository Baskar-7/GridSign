// Tailwind v4 uses the '@tailwindcss/postcss' plugin. Vitest (Node env) may not need PostCSS; disable during tests.
const isVitest = !!process.env.VITEST;
const config = {
  plugins: isVitest ? [] : ["@tailwindcss/postcss"],
};

export default config;
