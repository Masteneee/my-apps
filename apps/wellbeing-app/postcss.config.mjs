// PostCSS runs on our CSS during the build. The Tailwind plugin reads
// app/globals.css and generates only the utility classes we actually use.
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
