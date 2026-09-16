/**
 * Build script using esbuild for WENKER Router
 * Tuần 2 - Chuyển sang TypeScript + esbuild
 */

import esbuild from 'esbuild';
import { rmSync, mkdirSync } from 'fs';

async function build() {
  try {
    // Clean dist folder
    rmSync('./dist', { recursive: true, force: true });
    mkdirSync('./dist', { recursive: true });

    // Build server
    await esbuild.build({
      entryPoints: ['./server/index.ts'],
      bundle: false,
      platform: 'node',
      target: 'es2022',
      format: 'esm',
      outfile: './dist/index.js',
      minify: false,
      sourcemap: true,
      external: [
        'express',
        'cors',
        'path',
        'fs',
        'http',
        'https',
        'url',
        'undici',
        'dotenv',
        'express-rate-limit',
      ],
      logLevel: 'info',
      banner: {
        js: '// WENKER Router - Built with TypeScript and esbuild\n',
      },
    });

    // Copy package.json
    await esbuild.build({
      entryPoints: ['./package.json'],
      bundle: false,
      outfile: './dist/package.json',
      loader: { '.json': 'copy' },
    });

    console.log('✅ Build completed successfully!');
    console.log('  Output: ./dist/index.js');
    console.log('  Run with: node ./dist/index.js');
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

build();
