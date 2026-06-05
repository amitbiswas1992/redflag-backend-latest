import { BaseOAuthProviderOptions, GenericOAuthConfig } from "better-auth/plugins/generic-oauth";

export interface KeycloakOptions extends BaseOAuthProviderOptions {
	/**
	 * Keycloak issuer URL (includes realm, e.g., https://my-domain/realms/MyRealm)
	 * Used for the authorization redirect and as the expected `iss` claim in tokens.
	 */
	issuer: string;
	/**
	 * Internal Keycloak URL reachable by the backend (e.g., http://keycloak:8080/realms/MyRealm).
	 * When set, token/JWKS/userinfo calls use this URL instead of `issuer`, so the backend
	 * can reach Keycloak inside Docker while the browser uses the public `issuer` URL.
	 */
	internalIssuer?: string;
}

/**
 * Keycloak OAuth provider helper
 *
 * @example
 * ```ts
 * import { genericOAuth, keycloak } from "better-auth/plugins/generic-oauth";
 *
 * export const auth = betterAuth({
 *   plugins: [
 *     genericOAuth({
 *       config: [
 *         keycloak({
 *           clientId: process.env.KEYCLOAK_CLIENT_ID,
 *           clientSecret: process.env.KEYCLOAK_CLIENT_SECRET,
 *           issuer: process.env.KEYCLOAK_ISSUER,
 *         }),
 *       ],
 *     }),
 *   ],
 * });
 * ```
 */
export function keycloak(options: KeycloakOptions): GenericOAuthConfig {
	const defaultScopes = ["openid", "profile", "email"];
	const issuer = options.issuer.replace(/\/$/, "");

	const base = {
		providerId: "keycloak",
		clientId: options.clientId,
		clientSecret: options.clientSecret,
		scopes: options.scopes ?? defaultScopes,
		redirectURI: options.redirectURI,
		pkce: options.pkce,
		disableImplicitSignUp: options.disableImplicitSignUp,
		disableSignUp: options.disableSignUp,
		overrideUserInfo: options.overrideUserInfo,
	};

	if (options.internalIssuer) {
		const internal = options.internalIssuer.replace(/\/$/, "");
		// No discoveryUrl here: the plugin always overwrites tokenUrl/userInfoUrl from
		// the discovery doc, so we must specify all endpoints manually.
		return {
			...base,
			authorizationUrl: `${issuer}/protocol/openid-connect/auth`,
			tokenUrl: `${internal}/protocol/openid-connect/token`,
			userInfoUrl: `${internal}/protocol/openid-connect/userinfo`,
			// Must match the `iss` claim in tokens (set by KC_HOSTNAME on Keycloak)
			issuer,
		};
	}

	return {
		...base,
		discoveryUrl: `${issuer}/.well-known/openid-configuration`,
	};
}