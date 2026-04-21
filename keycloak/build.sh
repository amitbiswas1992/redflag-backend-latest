#!/bin/bash
# Build script for custom Keycloak image with redflag theme

set -euo pipefail

# Configuration
IMAGE_NAME="${1:-keycloak-redflag}"
IMAGE_TAG="${2:-latest}"
REGISTRY="${3:-}"  # Optional registry prefix (e.g., ghcr.io/username)

# Build the image
if [ -n "$REGISTRY" ]; then
  FULL_IMAGE_NAME="${REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}"
else
  FULL_IMAGE_NAME="${IMAGE_NAME}:${IMAGE_TAG}"
fi

echo "Building Keycloak image: $FULL_IMAGE_NAME"
docker build -t "$FULL_IMAGE_NAME" -f "$(dirname "$0")/Dockerfile" "$(dirname "$0")/.."

echo "✓ Build complete: $FULL_IMAGE_NAME"
echo ""
echo "To push to registry:"
echo "  docker push $FULL_IMAGE_NAME"
