# Custom Keycloak image with redflag theme pre-configured
FROM quay.io/keycloak/keycloak:26.1

# Copy the redflag theme into the keycloak themes directory
# The path is relative to the build context (backend repo root)
# Themes are located at: keycloak/themes/redflag/
COPY keycloak/themes/redflag /opt/keycloak/themes/redflag

# Do NOT set KC_SPI_THEME_DEFAULT=redflag as it will break the admin theme which we haven't overridden.
# Instead we configure it only for the login theme:
# ENV KC_SPI_THEME_LOGIN_DEFAULT=redflag

# The base image already defines the startup command, so no CMD override needed
