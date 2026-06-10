import { defineConfig } from "vite-plus";

// The demo is deployed to GitHub Pages under the `/better-filter-bar/`
// subpath, so emit asset URLs relative to the HTML document rather than
// the domain root.
export default defineConfig({
  base: "./",
});
