import { GenericOAuthConfig } from 'better-auth/plugins/generic-oauth';

export async function logoutKeycloakSessions(
  accounts: Array<{ id: string; refreshToken?: string | null }>,
  clientId: string,
  clientSecret: string,
  logoutUrl: string,
): Promise<void> {
  for (const account of accounts) {
    if (!account.refreshToken) continue;
    const params = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: account.refreshToken,
    });
    const response = await fetch(logoutUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
    });
    if (!response.ok) console.log('logout failed for account', account.id);
  }
}

export function setOAuthInternalUrl(
  config: GenericOAuthConfig,
  issuer: string,
  internalIssuer: string | undefined,
): GenericOAuthConfig {
  if (!internalIssuer) {
    return config;
  }

  const normalizedIssuer = issuer.replace(/\/$/, '');
  const normalizedInternal = internalIssuer.replace(/\/$/, '');

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { discoveryUrl: _, ...rest } = config;

  return {
    ...rest,
    authorizationUrl: `${normalizedIssuer}/protocol/openid-connect/auth`,
    tokenUrl: `${normalizedInternal}/protocol/openid-connect/token`,
    userInfoUrl: `${normalizedInternal}/protocol/openid-connect/userinfo`,
    issuer: normalizedIssuer,
  };
}
