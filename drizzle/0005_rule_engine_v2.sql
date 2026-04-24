-- Rule Engine V2 — Schema Overhaul Migration
-- Drops V1 tables (risk_evaluations) and creates new V2 tables.
-- Adds ruleId + violationContext to compliance_flags.
-- Safe to run on a clean V1 database — V1 data (risk_evaluations) will be dropped.

-- ── Drop V1 tables ────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS risk_evaluations CASCADE;

-- ── Clean up old risk_rules columns (V1) ─────────────────────────────────────
-- Remove V1-only columns that no longer exist in the schema.
-- We use ALTER TABLE ... DROP COLUMN IF EXISTS for safety.
ALTER TABLE risk_rules DROP COLUMN IF EXISTS role_name;
ALTER TABLE risk_rules DROP COLUMN IF EXISTS event_name;
ALTER TABLE risk_rules DROP COLUMN IF EXISTS score;
ALTER TABLE risk_rules DROP COLUMN IF EXISTS condition_logic;
ALTER TABLE risk_rules DROP COLUMN IF EXISTS affected_variables;
ALTER TABLE risk_rules DROP COLUMN IF EXISTS taxonomy;
ALTER TABLE risk_rules DROP COLUMN IF EXISTS regulatory_citation;
ALTER TABLE risk_rules DROP COLUMN IF EXISTS red_flags;
ALTER TABLE risk_rules DROP COLUMN IF EXISTS risk_level;
ALTER TABLE risk_rules DROP COLUMN IF EXISTS description;

-- Drop old risk_rules columns and add V2 columns
ALTER TABLE risk_rules ADD COLUMN IF NOT EXISTS category_id UUID;
ALTER TABLE risk_rules ADD COLUMN IF NOT EXISTS rule_name TEXT;
ALTER TABLE risk_rules ADD COLUMN IF NOT EXISTS rule_code TEXT;
ALTER TABLE risk_rules ADD COLUMN IF NOT EXISTS target_table TEXT;
ALTER TABLE risk_rules ADD COLUMN IF NOT EXISTS severity TEXT;

-- Populate non-nullable columns with safe defaults for any existing rows
UPDATE risk_rules SET rule_name = 'Migrated Rule' WHERE rule_name IS NULL;
UPDATE risk_rules SET target_table = 'encounter_analytics' WHERE target_table IS NULL;
UPDATE risk_rules SET severity = 'MEDIUM' WHERE severity IS NULL;

-- Now enforce NOT NULL
ALTER TABLE risk_rules ALTER COLUMN rule_name SET NOT NULL;
ALTER TABLE risk_rules ALTER COLUMN target_table SET NOT NULL;
ALTER TABLE risk_rules ALTER COLUMN severity SET NOT NULL;

-- ── V2 Tables ─────────────────────────────────────────────────────────────────

-- Finding categories
CREATE TABLE IF NOT EXISTS rule_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rule_categories_org ON rule_categories (organization_id);

-- Foreign key from risk_rules.category_id → rule_categories
ALTER TABLE risk_rules
    ADD CONSTRAINT fk_risk_rules_category
    FOREIGN KEY (category_id) REFERENCES rule_categories(id) ON DELETE SET NULL
    NOT VALID;
ALTER TABLE risk_rules VALIDATE CONSTRAINT fk_risk_rules_category;

-- Indexes on risk_rules
CREATE INDEX IF NOT EXISTS idx_risk_rules_org_active ON risk_rules (organization_id, is_active);
CREATE INDEX IF NOT EXISTS idx_risk_rules_category ON risk_rules (organization_id, category_id);

-- Rule conditions (V2)
CREATE TABLE IF NOT EXISTS rule_conditions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id UUID NOT NULL REFERENCES risk_rules(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    field_name TEXT NOT NULL,
    operator TEXT NOT NULL,
    value TEXT,
    logical_operator TEXT NOT NULL DEFAULT 'AND',
    "order" INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rule_conditions_rule ON rule_conditions (rule_id);

-- ── Compliance flags — add V2 columns ─────────────────────────────────────────
ALTER TABLE compliance_flags ADD COLUMN IF NOT EXISTS rule_id UUID;
ALTER TABLE compliance_flags ADD COLUMN IF NOT EXISTS violation_context JSONB;

ALTER TABLE compliance_flags
    ADD CONSTRAINT fk_compliance_flags_rule
    FOREIGN KEY (rule_id) REFERENCES risk_rules(id) ON DELETE SET NULL
    NOT VALID;
ALTER TABLE compliance_flags VALIDATE CONSTRAINT fk_compliance_flags_rule;

CREATE INDEX IF NOT EXISTS idx_compliance_flags_org ON compliance_flags (organization_id);
CREATE INDEX IF NOT EXISTS idx_compliance_flags_rule ON compliance_flags (organization_id, rule_id);
CREATE INDEX IF NOT EXISTS idx_compliance_flags_entity ON compliance_flags (organization_id, entity_id);
