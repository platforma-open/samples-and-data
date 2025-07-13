import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';

// Check if we're building UMD format specifically
const buildingUMD = process.env.BUILD_UMD === 'true';

export default defineConfig({
  plugins: [
    dts({
      insertTypesEntry: true,
      rollupTypes: true,
      outDir: 'dist',
    }),
  ],
  build: {
    emptyOutDir: false,
    minify: false,
    // Use SSR mode for ES/CJS to automatically externalize dependencies
    ssr: !buildingUMD,
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      formats: buildingUMD ? ['umd'] : ['es', 'cjs'],
      fileName: (format) => {
        switch (format) {
          case 'es':
            return 'index.js';
          case 'cjs':
            return 'index.cjs';
          case 'umd':
            return 'bundle.js';
          default:
            return `index.${format}.js`;
        }
      },
      name: 'model', // Global variable name for UMD
    },
    sourcemap: true,
  },
});
