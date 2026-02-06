import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file from project root (two levels up from dist/ or src/)
const envPath = join(__dirname, '..', '.env');
const result = dotenv.config({ path: envPath });

// Silently handle .env loading errors (file might not exist or have permission issues)
// The app will still work if environment variables are set another way
if (result.error) {
  const error = result.error as NodeJS.ErrnoException;
  // Only warn for non-file-not-found errors
  if (error.code !== 'ENOENT' && process.env.NODE_ENV !== 'production') {
    console.warn(`⚠️  Could not load .env file: ${error.message}`);
  }
}

/**
 * Circle Mint API Configuration
 * Based on: https://developers.circle.com/circle-mint/getting-started-with-the-circle-apis
 */
export const config = {
  apiKey: process.env.CIRCLE_API_KEY || '',
  environment: (process.env.CIRCLE_ENV || 'sandbox') as 'sandbox' | 'production',
  baseUrl: process.env.CIRCLE_BASE_URL || (
    process.env.CIRCLE_ENV === 'production' 
      ? 'https://api.circle.com'
      : 'https://api-sandbox.circle.com'
  ),
};

/**
 * Security reminder: API keys must be kept secure
 * - Never commit API keys to version control
 * - Never expose API keys in client-side code
 * - Always use HTTPS for API requests
 * - Store API keys in environment variables
 */

if (!config.apiKey) {
  console.warn('⚠️  Warning: CIRCLE_API_KEY not set. Please set it in your .env file');
  console.warn(`   Looking for .env at: ${envPath}`);
}
