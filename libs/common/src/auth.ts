import { db } from '@app/db';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { organization } from 'better-auth/plugins';
import { createAccessControl } from 'better-auth/plugins/access';
import {
  defaultStatements,
  adminAc,
  ownerAc,
  memberAc,
} from 'better-auth/plugins/organization/access';

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
  advanced: {
    database: {
      generateId: 'uuid',
    },
  },
  plugins: [
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
    }),
  ],
});
