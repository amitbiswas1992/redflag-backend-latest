#!/bin/bash

# Script to generate RSA key pair for Epic Backend Systems authentication

echo "Generating RSA key pair for Epic Backend Systems..."

# Generate private key (2048 bits)
openssl genrsa -out private_key.pem 2048

# Extract public key
openssl rsa -in private_key.pem -pubout -out public_key.pem

echo ""
echo "✅ Key pair generated successfully!"
echo ""
echo "Files created:"
echo "  - private_key.pem (KEEP SECURE - DO NOT COMMIT TO VERSION CONTROL)"
echo "  - public_key.pem (Upload this to Epic App Orchard)"
echo ""
echo "Next steps:"
echo "1. Upload public_key.pem to Epic App Orchard"
echo "2. Get the Key ID (KID) from Epic after uploading"
echo "3. Add the private key to your .env file as EPIC_JWT_PRIVATE_KEY"
echo "4. Add the Key ID to your .env file as EPIC_JWT_KEY_ID"
echo ""
echo "⚠️  SECURITY WARNING:"
echo "   - Never commit private_key.pem to version control"
echo "   - Keep private_key.pem secure"
echo "   - Use environment variables or secure key management"

