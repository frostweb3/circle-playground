/**
 * Simple test runner for Circle Mint operations
 */
import { CircleMintTester } from './test-functions.js';
import { config } from './config.js';

async function runTests() {
  console.log('🧪 Circle Mint Test Suite');
  console.log(`Environment: ${config.environment}`);
  console.log(`Base URL: ${config.baseUrl}\n`);

  if (!config.apiKey) {
    console.error('❌ CIRCLE_API_KEY not set!');
    process.exit(1);
  }

  const tester = new CircleMintTester();
  await tester.runAllTests();
}

runTests().catch(console.error);
