import * as esbuild from 'esbuild'

try {
  await esbuild.build({
    entryPoints: ['./src/index.ts'],
    bundle: true,
    minify: true,
    format: 'esm',
    platform: 'node',
    outdir: './dist',
    target: 'node18',
  })
  console.log('Build succeeded')
} catch (error) {
  console.error('Build failed:', error)
  process.exit(1)
}
