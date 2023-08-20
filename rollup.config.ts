import { defineConfig } from 'rollup'
import terser from '@rollup/plugin-terser'
import typescript from 'rollup-plugin-typescript2'

export default defineConfig({
  input: 'src/GSP.ts',
  output: [
    {
      file: 'dist/GSP.cjs',
      format: 'cjs',
      sourcemap: true
    },
    {
      file: 'dist/GSP.js',
      format: 'umd',
      name: 'GSP',
      sourcemap: true
    }
  ],
  plugins: [
    typescript(),
    terser({
      compress: true,
      keep_fnames: true,
      mangle: true
    })
  ]
})
