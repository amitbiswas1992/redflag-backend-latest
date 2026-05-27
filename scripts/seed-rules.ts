import 'dotenv/config';
import { db } from '../libs/db/src';
import { organizations } from '../libs/db/src/schema/identity';
import { seedOrgRules } from '../libs/db/src/seeders/rule-seeder';

async function seed() {
  console.log('🌱 Starting Strictly-Typed Rule Seed...');

  const orgs = await db.select().from(organizations);
  if (orgs.length === 0) {
    console.error('❌ No organizations found in database. Please register an organization first.');
    process.exit(1);
  }

  console.log(`🏢 Found ${orgs.length} organizations to seed.`);

  for (const org of orgs) {
    await seedOrgRules(org, true);
  }

  console.log('\n✨ Seeding Complete!');
}

seed().catch((err) => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
