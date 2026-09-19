#!/usr/bin/env node
/**
 * Test Runner for WENKER Router
 * Runs all unit tests with proper configuration
 */

const { spawn } = require('child_process');
const path = require('path');

const TEST_FILES = [
  'rateLimiter.test.js',
  'inputSanitizer.test.js',
  'circuitBreaker.test.js',
  'structuredLogger.test.js',
  'metricsService.test.js',
  'errorFormatter.test.js',
  'quotaService.test.js',
];

async function runTests() {
  console.log('🧪 Running WENKER Router Unit Tests\n');
  console.log('=' .repeat(50));
  
  let passed = 0;
  let failed = 0;
  const results = [];
  
  for (const testFile of TEST_FILES) {
    const fullPath = path.join(__dirname, testFile);
    console.log(`\n📋 Running: ${testFile}`);
    
    try {
      await runMocha(fullPath);
      console.log(`✅ ${testFile} - PASSED`);
      passed++;
      results.push({ file: testFile, status: 'passed' });
    } catch (error) {
      console.log(`❌ ${testFile} - FAILED`);
      console.log(`   Error: ${error.message}`);
      failed++;
      results.push({ file: testFile, status: 'failed', error: error.message });
    }
  }
  
  console.log('\n' + '=' .repeat(50));
  console.log(`📊 Results: ${passed} passed, ${failed} failed`);
  
  if (failed > 0) {
    console.log('\n❌ Failed tests:');
    results.filter(r => r.status === 'failed').forEach(r => {
      console.log(`   - ${r.file}: ${r.error}`);
    });
    process.exit(1);
  } else {
    console.log('\n✅ All tests passed!');
    process.exit(0);
  }
}

function runMocha(testFile) {
  return new Promise((resolve, reject) => {
    const mocha = spawn('npx', ['mocha', testFile, '--timeout', '10000'], {
      cwd: __dirname,
      stdio: 'pipe',
      shell: true,
      env: { ...process.env, NODE_ENV: 'test' },
    });
    
    let stdout = '';
    let stderr = '';
    
    mocha.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    mocha.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    mocha.on('close', (code) => {
      // Filter out npm warnings from stderr
      const filteredStderr = stderr
        .split('\n')
        .filter(line => !line.includes('npm warn') && !line.includes('allow-scripts'))
        .join('\n')
        .trim();
      
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(filteredStderr || stdout || `Mocha exited with code ${code}`));
      }
    });
    
    mocha.on('error', (err) => {
      reject(err);
    });
  });
}

runTests();