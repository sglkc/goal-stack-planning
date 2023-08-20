import { defineConfig } from 'rollup'
import terser from '@rollup/plugin-terser'
import typescript from 'rollup-plugin-typescript2'

export default defineConfig({
  input: 'src/GSP.ts',
  output: [
    {
      file: 'dist/GSP.js',
      format: 'umd',
      name: 'GSP'
    },
    {
      file: 'dist/GSP.min.js',
      format: 'umd',
      name: 'GSP',
      plugins: [terser()]
    }
  ],
  plugins: [typescript()]
})
