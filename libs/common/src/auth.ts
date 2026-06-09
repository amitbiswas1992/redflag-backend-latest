import { db } from '@app/db';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { genericOAuth, keycloak, organization } from 'better-auth/plugins';
import { logoutKeycloakSessions, setOAuthInternalUrl } from './auth-utils';
import { createAccessControl } from 'better-auth/plugins/access';
import {
  defaultStatements,
  adminAc,
  ownerAc,
  memberAc,
} from 'better-auth/plugins/organization/access';
import { seedOrgRules } from '@app/db/seeders/rule-seeder';
import { createAuthMiddleware } from 'better-auth/api';
import { sendOrganizationInvitation } from './emails/email';

const KEYCLOAK_CLIENT_ID = process.env.KEYCLOAK_CLIENT_ID!;
const KEYCLOAK_CLIENT_SECRET = process.env.KEYCLOAK_CLIENT_SECRET!;
const KEYCLOAK_ISSUER = `${process.env.KEYCLOAK_URL}/realms/${process.env.KEYCLOAK_REALM}`;
const KEYCLOAK_INTERNAL_ISSUER = process.env.KEYCLOAK_INTERNAL_URL
  ? `${process.env.KEYCLOAK_INTERNAL_URL}/realms/${process.env.KEYCLOAK_REALM}`
  : undefined;

const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3002';

const statement = {
  ...defaultStatements,
} as const;

const ac = createAccessControl(statement);

const owner = ac.newRole({
  ...ownerAc.statements,
});

const admin = ac.newRole({
  ...adminAc.statements,
});

const risk_owner = ac.newRole({
  ...memberAc.statements,
});

const control_owner = ac.newRole({
  ...memberAc.statements,
});

const compliance_officer = ac.newRole({
  ...memberAc.statements,
});

const executive_sponsor = ac.newRole({
  ...memberAc.statements,
});

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    usePlural: true,
  }),
  trustedOrigins: process.env.FRONTEND_ORIGIN
    ? [process.env.FRONTEND_ORIGIN]
    : [],
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ['keycloak'],
    },
  },
  advanced: {
    database: {
      generateId: 'uuid',
    },
  },
  plugins: [
    genericOAuth({
      config: [
        setOAuthInternalUrl(
          keycloak({
            clientId: KEYCLOAK_CLIENT_ID,
            clientSecret: KEYCLOAK_CLIENT_SECRET,
            issuer: KEYCLOAK_ISSUER,
          }),
          KEYCLOAK_ISSUER,
          KEYCLOAK_INTERNAL_ISSUER,
        ),
      ],
    }),
    organization({
      ac,
      roles: {
        owner,
        admin,
        risk_owner,
        control_owner,
        compliance_officer,
        executive_sponsor,
      },
      schema: {
        organization: {
          additionalFields: {
            scoreTuning: {
              type: 'json',
              input: true,
              required: false,
            },
          },
        },
      },
      organizationHooks: {
        async afterCreateOrganization(data) {
          await seedOrgRules(data.organization);
        },
      },
      async sendInvitationEmail(data) {
        const inviteLink = `${frontendUrl}/auth/accept-invite?invitationId=${data.id}`;
        await sendOrganizationInvitation({
          email: data.email,
          invitedByUsername: data.inviter.user.name,
          invitedByEmail: data.inviter.user.email,
          teamName: data.organization.name,
          inviteLink,
        });
      },
    }),
  ],
  hooks: {
    after: createAuthMiddleware(async (ctx) => {
      if (ctx.context.newSession) {
        const { id: userId } = ctx.context.newSession.user;
        // Immediately logout from Keycloak after login — without this, Keycloak
        // auto-signs into the existing session on every redirect to the login page,
        // making it impossible to switch accounts.
        ctx.context.runInBackground(
          ctx.context.internalAdapter
            .findAccountByUserId(userId)
            .then((accounts) =>
              logoutKeycloakSessions(
                accounts,
                KEYCLOAK_CLIENT_ID,
                KEYCLOAK_CLIENT_SECRET,
                `${KEYCLOAK_INTERNAL_ISSUER}/protocol/openid-connect/logout`,
              ),
            ),
        );
      }
    }),
  },
});
