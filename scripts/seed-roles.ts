import 'dotenv/config';
import { db, functionalRoles } from '../libs/db/src';

const FUNCTIONAL_ROLES: { id: string; name: string; slug: string }[] = [
  { id: '00000000-0000-0000-0000-000000000001', name: 'Risk Owner',          slug: 'risk_owner' },
  { id: '00000000-0000-0000-0000-000000000002', name: 'Control Owner',       slug: 'control_owner' },
  { id: '00000000-0000-0000-0000-000000000003', name: 'Compliance Officer',  slug: 'compliance_officer' },
  { id: '00000000-0000-0000-0000-000000000004', name: 'Executive Sponsor',   slug: 'executive_sponsor' },
];

async function seed() {
  console.log('🌱 Upserting functional roles...');

  for (const role of FUNCTIONAL_ROLES) {
    await db
      .insert(functionalRoles)
      .values(role)
      .onConflictDoUpdate({
        target: functionalRoles.id,
        set: { name: role.name, slug: role.slug },
      });
    console.log(`  ✓ ${role.name} (${role.id})`);
  }

  console.log('✨ Done.');
}

seed().catch((err) => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
