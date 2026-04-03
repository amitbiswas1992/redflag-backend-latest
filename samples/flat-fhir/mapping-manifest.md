# Flat FHIR Mapping Manifest

This manifest is a human-readable baseline for the synthetic flat FHIR sample pack.

## Canonical intent

- `patient_*` fields map to `Patient`
- `practitioner_*` fields map to `Practitioner`
- `organization_name` maps to `Organization.name`
- `encounter_*` fields map to `Encounter`
- `observation_*` fields map to `Observation`
- `condition_*` fields map to `Condition`
- `medication_*` fields map to `MedicationStatement`
- `allergy_*` fields map to `AllergyIntolerance`
- `procedure_*` fields map to `Procedure`
- `diagnostic_report_*` fields map to `DiagnosticReport`

## Important conventions

- `patient_epic_id` is the patient linkage key.
- Resource IDs are the source Epic IDs for the corresponding entities.
- Code fields use official coding systems where possible.
- Dates are ISO-8601 unless the source family explicitly requires another format.

## Testing purpose

Use this pack to validate:
- document-family detection
- fingerprinting
- field mapping
- patient association
- resource fan-out into normalized tables
- history and row-result reporting
