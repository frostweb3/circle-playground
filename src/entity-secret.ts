#!/usr/bin/env node

/**
 * Entity Secret Management for Circle Wallets
 * 
 * This script helps you generate and register an Entity Secret for Circle Developer-Controlled Wallets.
 * 
 * Reference: https://developers.circle.com/wallets/dev-controlled/register-entity-secret
 */

// @ts-ignore - Package will be installed by user
import { generateEntitySecret, registerEntitySecretCiphertext } from '@circle-fin/developer-controlled-wallets';
import { config } from './config.js';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * Generate a new Entity Secret
 */
function generateSecret(): string {
  console.log('🔐 Generating Entity Secret...');
  console.log('─'.repeat(50));
  
  const entitySecret = generateEntitySecret();
  
  console.log('✅ Entity Secret generated successfully!');
  console.log(`\n📝 Entity Secret: ${entitySecret}`);
  console.log('\n⚠️  IMPORTANT: Save this Entity Secret securely!');
  console.log('   - Store it in a password manager');
  console.log('   - Circle does NOT store it and cannot recover it');
  console.log('   - You will need it for future API calls');
  
  return entitySecret;
}

/**
 * Register Entity Secret with Circle
 */
async function registerSecret(
  entitySecret: string,
  recoveryFilePath?: string
): Promise<void> {
  console.log('\n📤 Registering Entity Secret with Circle...');
  console.log('─'.repeat(50));

  if (!config.apiKey) {
    throw new Error('CIRCLE_API_KEY is not set in .env file');
  }

  try {
    const response = await registerEntitySecretCiphertext({
      apiKey: config.apiKey,
      entitySecret: entitySecret,
      recoveryFileDownloadPath: recoveryFilePath || '',
    });

    console.log('✅ Entity Secret registered successfully!');
    
    if (response.data?.recoveryFile) {
      console.log('\n💾 Recovery file received');
      
      // Save recovery file if path provided
      if (recoveryFilePath) {
        const recoveryDir = join(process.cwd(), 'recovery');
        if (!existsSync(recoveryDir)) {
          mkdirSync(recoveryDir, { recursive: true });
        }
        
        const recoveryFile = join(recoveryDir, 'entity-secret-recovery.json');
        writeFileSync(recoveryFile, JSON.stringify(response.data.recoveryFile, null, 2));
        console.log(`📁 Recovery file saved to: ${recoveryFile}`);
        console.log('\n⚠️  IMPORTANT: Store this recovery file in a safe, separate location!');
        console.log('   This is the ONLY way to reset your Entity Secret if it\'s lost.');
      } else {
        console.log('\n📋 Recovery file data:');
        console.log(JSON.stringify(response.data.recoveryFile, null, 2));
        console.log('\n⚠️  IMPORTANT: Save this recovery file data securely!');
      }
    }

    console.log('\n✅ Registration complete!');
    console.log('\n💡 Next steps:');
    console.log('   1. Store your Entity Secret securely');
    console.log('   2. Save the recovery file in a safe location');
    console.log('   3. You can now use Circle Developer-Controlled Wallets APIs');
    console.log('   4. Each API request will require a new ciphertext (SDK handles this)');

  } catch (error: any) {
    console.error('\n❌ Error registering Entity Secret:', error.message);
    
    if (error.message.includes('401') || error.message.includes('unauthorized')) {
      console.log('\n💡 Tip: Check that your API key is correct and has the right permissions');
    } else if (error.message.includes('400')) {
      console.log('\n💡 Tip: The Entity Secret may already be registered or invalid');
    }
    
    throw error;
  }
}

/**
 * Main function
 */
async function main() {
  console.log('╔═══════════════════════════════════════════════════════╗');
  console.log('║     Circle Wallets Entity Secret Manager             ║');
  console.log('╚═══════════════════════════════════════════════════════╝');
  console.log(`\nEnvironment: ${config.environment}`);
  console.log(`Base URL: ${config.baseUrl}\n`);

  const args = process.argv.slice(2);
  const command = args[0];

  try {
    switch (command) {
      case 'generate':
        // Just generate, don't register
        generateSecret();
        break;

      case 'register':
        // Register an existing Entity Secret
        const existingSecret = args[1];
        if (!existingSecret) {
          console.error('❌ Error: Entity Secret required');
          console.error('Usage: npm run entity-secret register <entity-secret> [recovery-file-path]');
          process.exit(1);
        }
        const registerRecoveryPath = args[2];
        await registerSecret(existingSecret, registerRecoveryPath);
        break;

      case 'generate-and-register':
      case undefined:
        // Generate and register in one step
        const entitySecret = generateSecret();
        
        console.log('\n⏳ Registering Entity Secret...');
        const defaultRecoveryPath = join(process.cwd(), 'recovery', 'entity-secret-recovery.json');
        const generateRecoveryPath = args[1] || defaultRecoveryPath;
        await registerSecret(entitySecret, generateRecoveryPath);
        
        // Save Entity Secret to .env.example format (not actual .env for security)
        console.log('\n💡 To use this Entity Secret, add it to your .env file:');
        console.log(`   ENTITY_SECRET=${entitySecret}`);
        break;

      default:
        console.log('\n📖 Available Commands:');
        console.log('  generate                    - Generate a new Entity Secret (don\'t register)');
        console.log('  register <secret> [path]    - Register an existing Entity Secret');
        console.log('  generate-and-register [path] - Generate and register (default)');
        console.log('\nExamples:');
        console.log('  npm run entity-secret generate');
        console.log('  npm run entity-secret register <your-entity-secret>');
        console.log('  npm run entity-secret generate-and-register');
        console.log('  npm run entity-secret generate-and-register ./my-recovery.json');
        console.log('\n⚠️  Security Notes:');
        console.log('  - Entity Secret is a 32-byte private key');
        console.log('  - Circle does NOT store it - you are responsible for keeping it safe');
        console.log('  - Save the recovery file in a secure, separate location');
        console.log('  - Never commit Entity Secret or recovery file to version control');
    }
  } catch (error: any) {
    console.error('\n❌ Fatal error:', error.message);
    process.exit(1);
  }
}

main();
