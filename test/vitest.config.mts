import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    watch: false,
    testTimeout: 12000,
  }
});