#!/usr/bin/env node

/**
 * Script to generate RSA key pair for Epic Backend Systems authentication
 * Usage: node scripts/generate-keys.js
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

console.log('Generating RSA key pair for Epic Backend Systems...\n');

// Generate key pair
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: {
    type: 'spki',
    format: 'pem',
  },
  privateKeyEncoding: {
    type: 'pkcs8',
    format: 'pem',
  },
});

// Write keys to files
const privateKeyPath = path.join(__dirname, '..', 'private_key.pem');
const publicKeyPath = path.join(__dirname, '..', 'public_key.pem');

fs.writeFileSync(privateKeyPath, privateKey);
fs.writeFileSync(publicKeyPath, publicKey);

console.log('✅ Key pair generated successfully!\n');
console.log('Files created:');
console.log(`  - ${privateKeyPath}`);
console.log(`  - ${publicKeyPath}\n`);
console.log('Next steps:');
console.log('1. Upload public_key.pem to Epic App Orchard');
console.log('2. Get the Key ID (KID) from Epic after uploading');
console.log('3. Add the private key to your .env file as EPIC_JWT_PRIVATE_KEY');
console.log('4. Add the Key ID to your .env file as EPIC_JWT_KEY_ID\n');
console.log('⚠️  SECURITY WARNING:');
console.log('   - Never commit private_key.pem to version control');
console.log('   - Keep private_key.pem secure');
console.log('   - Use environment variables or secure key management\n');

// Show private key format for .env
console.log('For .env file, use this format (replace \\n with actual newlines or use single line):');
console.log('EPIC_JWT_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----');

