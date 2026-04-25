import 'dotenv/config';
import { and, eq } from 'drizzle-orm';
import { ConditionOperator, TargetTable } from '../apps/core-service/src/rule-builder/dto/rule-builder.dto';
import { db, organizations, riskRules, ruleCategories, ruleConditions } from '../libs/db/src';

// ── Explicit Rule Definitions based on Clinical Mapping ──
const SEED_RULES = [
  // 1. Telehealth
  {
    category: 'Telehealth',
    code: 'TH-001',
    name: 'Ryan Haight Act Violation',
    severity: 'CRITICAL',
    targetTable: TargetTable.ENCOUNTER_ANALYTICS,
    conditions: [
      { fieldName: 'is_telehealth', operator: ConditionOperator.EQUALS, value: 'true' },
      { fieldName: 'controlled_substance_prescribed', operator: ConditionOperator.EQUALS, value: 'true' },
      { fieldName: 'patient_identity_verified', operator: ConditionOperator.IS_NULL, value: null },
      { fieldName: 'telehealth_id', operator: ConditionOperator.IS_NOT_NULL, value: null },
    ]
  },
  {
    category: 'Telehealth',
    code: 'TH-002',
    name: 'Cross-State Licensure Violation',
    severity: 'HIGH',
    targetTable: TargetTable.ENCOUNTER_ANALYTICS,
    conditions: [
      { fieldName: 'is_telehealth', operator: ConditionOperator.EQUALS, value: 'true' },
      { fieldName: 'cross_state_flag', operator: ConditionOperator.EQUALS, value: 'true' },
      { fieldName: 'cross_state_license', operator: ConditionOperator.EQUALS, value: 'false' },
    ]
  },
  {
    category: 'Telehealth',
    code: 'TH-003',
    name: 'Inadequate Telehealth Consent',
    severity: 'HIGH',
    targetTable: TargetTable.ENCOUNTER_ANALYTICS,
    conditions: [
      { fieldName: 'is_telehealth', operator: ConditionOperator.EQUALS, value: 'true' },
      { fieldName: 'consent_obtained', operator: ConditionOperator.EQUALS, value: 'false' },
      { fieldName: 'informed_consent_type', operator: ConditionOperator.IS_NULL, value: null },
      { fieldName: 'session_recording_consent', operator: ConditionOperator.IS_NULL, value: null },
    ]
  },

  // 2. Misprescribing
  {
    category: 'Misprescribing',
    code: 'MP-001',
    name: 'Prescribing Without Indication',
    severity: 'HIGH',
    targetTable: TargetTable.ENCOUNTER_ANALYTICS,
    conditions: [
      { fieldName: 'medication_prescribed', operator: ConditionOperator.IS_NOT_NULL, value: null },
      { fieldName: 'primary_diagnosis', operator: ConditionOperator.IS_NULL, value: null },
      { fieldName: 'clinical_notes_completed', operator: ConditionOperator.EQUALS, value: 'false' },
    ]
  },
  {
    category: 'Misprescribing',
    code: 'MP-002',
    name: 'Dangerous Overdosing',
    severity: 'CRITICAL',
    targetTable: TargetTable.MEDICATION_ANALYTICS,
    conditions: [
      { fieldName: 'controlled_substance', operator: ConditionOperator.EQUALS, value: 'true' },
      { fieldName: 'substance_quantity', operator: ConditionOperator.GREATER_THAN, value: '120' },
    ]
  },
  {
    category: 'Misprescribing',
    code: 'MP-003',
    name: 'Inadequate Medical Assessment',
    severity: 'MEDIUM',
    targetTable: TargetTable.ENCOUNTER_ANALYTICS,
    conditions: [
      { fieldName: 'session_duration', operator: ConditionOperator.LESS_THAN, value: '30' },
      { fieldName: 'mental_health_screening', operator: ConditionOperator.IS_NULL, value: null },
      { fieldName: 'substance_use_screening', operator: ConditionOperator.IS_NULL, value: null },
    ]
  },

  // 3. Controlled Substance
  {
    category: 'Controlled Substance',
    code: 'CS-001',
    name: 'Auto-Refill Violation',
    severity: 'HIGH',
    targetTable: TargetTable.MEDICATION_ANALYTICS,
    conditions: [
      { fieldName: 'controlled_substance_prescribed', operator: ConditionOperator.EQUALS, value: 'true' },
      { fieldName: 'auto_refill_enabled', operator: ConditionOperator.EQUALS, value: 'true' },
    ]
  },
  {
    category: 'Controlled Substance',
    code: 'CS-002',
    name: 'Refill Without Medical Oversight',
    severity: 'HIGH',
    targetTable: TargetTable.MEDICATION_ANALYTICS,
    conditions: [
      { fieldName: 'refill_count', operator: ConditionOperator.GREATER_THAN, value: '2' },
      { fieldName: 'follow_up_scheduled', operator: ConditionOperator.EQUALS, value: 'false' },
      { fieldName: 'vital_signs_recorded', operator: ConditionOperator.IS_NULL, value: null },
    ]
  },
  {
    category: 'Controlled Substance',
    code: 'CS-003',
    name: 'Patient Addiction Facilitation',
    severity: 'CRITICAL',
    targetTable: TargetTable.MEDICATION_ANALYTICS,
    conditions: [
      { fieldName: 'controlled_substance', operator: ConditionOperator.EQUALS, value: 'true' },
      { fieldName: 'substance_quantity', operator: ConditionOperator.GREATER_THAN, value: '90' },
      { fieldName: 'cds_alert_count', operator: ConditionOperator.GREATER_THAN, value: '0' },
      { fieldName: 'override_reason', operator: ConditionOperator.IS_NULL, value: null },
      { fieldName: 'medication_adherence', operator: ConditionOperator.EQUALS, value: 'Unknown' },
    ]
  },

  // 4. CPOM
  {
    category: 'CPOM',
    code: 'CPOM-001',
    name: 'Corporate Clinical Interference',
    severity: 'HIGH',
    targetTable: TargetTable.ENCOUNTER_ANALYTICS,
    conditions: [
      { fieldName: 'clinical_protocol_approved_by', operator: ConditionOperator.NOT_IN, value: 'MD,DO,NP,PA,Physician,Licensed Physician,Nurse Practitioner,Physician Assistant' },
      { fieldName: 'auto_refill_policy_corporate_mandated', operator: ConditionOperator.EQUALS, value: 'true' },
    ]
  },
  {
    category: 'CPOM',
    code: 'CPOM-002',
    name: 'Inadequate Physician Ownership',
    severity: 'HIGH',
    targetTable: TargetTable.ENCOUNTER_ANALYTICS,
    conditions: [
      { fieldName: 'physician_ownership_percentage', operator: ConditionOperator.LESS_THAN, value: '51' },
      { fieldName: 'corporate_structure', operator: ConditionOperator.EQUALS, value: 'PE-Backed' },
    ]
  },

  // 5. Documentation
  {
    category: 'Documentation',
    code: 'DOC-001',
    name: 'Missing Clinical Documentation',
    severity: 'MEDIUM',
    targetTable: TargetTable.ENCOUNTER_ANALYTICS,
    conditions: [
      { fieldName: 'clinical_notes_completed', operator: ConditionOperator.EQUALS, value: 'false' },
      { fieldName: 'note_signed_date', operator: ConditionOperator.IS_NULL, value: null },
      { fieldName: 'chief_complaint', operator: ConditionOperator.IS_NULL, value: null },
      { fieldName: 'allergies_reviewed', operator: ConditionOperator.IS_NULL, value: null },
    ]
  },
  {
    category: 'Documentation',
    code: 'DOC-002',
    name: 'Inadequate Screening Documentation',
    severity: 'MEDIUM',
    targetTable: TargetTable.ENCOUNTER_ANALYTICS,
    conditions: [
      { fieldName: 'mental_health_screening', operator: ConditionOperator.IS_NULL, value: null },
      { fieldName: 'substance_use_screening', operator: ConditionOperator.IS_NULL, value: null },
      { fieldName: 'allergies_reviewed', operator: ConditionOperator.IS_NULL, value: null },
      { fieldName: 'technology_assessment', operator: ConditionOperator.IS_NULL, value: null },
    ]
  }
];

async function seed() {
  console.log('🌱 Starting Strictly-Typed Rule Seed...');

  const orgs = await db.select().from(organizations);
  if (orgs.length === 0) {
    console.error('❌ No organizations found in database. Please register an organization first.');
    process.exit(1);
  }

  console.log(`🏢 Found ${orgs.length} organizations to seed.`);

  for (const org of orgs) {
    const orgId = org.id;
    console.log(`\n🚀 Seeding precise rules for: ${org.name} (${orgId})...`);

    // Cleanup existing for this org
    await db.delete(ruleConditions).where(eq(ruleConditions.organizationId, orgId));
    await db.delete(riskRules).where(eq(riskRules.organizationId, orgId));
    await db.delete(ruleCategories).where(eq(ruleCategories.organizationId, orgId));

    const categoryCache = new Map<string, string>();
    let rulesCount = 0;
    let conditionsCount = 0;

    for (const ruleDef of SEED_RULES) {
      // 1. Category
      if (!categoryCache.has(ruleDef.category)) {
        const [existingCat] = await db.select()
          .from(ruleCategories)
          .where(
            and(
              eq(ruleCategories.name, ruleDef.category),
              eq(ruleCategories.organizationId, orgId)
            )
          )
          .limit(1);

        if (existingCat) {
          categoryCache.set(ruleDef.category, existingCat.id);
        } else {
          const [newCat] = await db.insert(ruleCategories).values({
            organizationId: orgId,
            name: ruleDef.category,
          }).returning();
          categoryCache.set(ruleDef.category, newCat.id);
        }
      }
      const catId = categoryCache.get(ruleDef.category)!;

      // 2. Rule
      const [newRule] = await db.insert(riskRules).values({
        organizationId: orgId,
        categoryId: catId,
        ruleName: ruleDef.name,
        ruleCode: ruleDef.code,
        targetTable: ruleDef.targetTable,
        severity: ruleDef.severity as any,
        isActive: true,
      }).returning();
      rulesCount++;

      // 3. Conditions
      let conditionOrder = 0;
      for (const cond of ruleDef.conditions) {
        await db.insert(ruleConditions).values({
          ruleId: newRule.id,
          organizationId: orgId,
          fieldName: cond.fieldName,
          operator: cond.operator,
          value: cond.value,
          logicalOperator: 'AND',
          order: conditionOrder++,
        });
        conditionsCount++;
      }
    }

    console.log(`✅ Seeded ${rulesCount} rules and ${conditionsCount} conditions for ${org.name}`);
  }

  console.log('\n✨ Seeding Complete!');
}

seed().catch((err) => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
