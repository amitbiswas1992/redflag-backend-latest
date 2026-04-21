# Custom Keycloak image with redflag theme pre-configured
FROM quay.io/keycloak/keycloak:26.1

# Copy the redflag theme into the keycloak themes directory
# The path must match Keycloak's internal theme location
COPY themes/redflag /opt/keycloak/themes/redflag

# Optionally, set environment variables for theme configuration
# These can be overridden at runtime via docker-compose env_file
ENV KC_SPI_THEME_DEFAULT=redflag

# The base image already defines the startup command, so no CMD override needed
