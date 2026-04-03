# Flat FHIR Sample Pack

This folder contains synthetic, schema-aligned fixtures for the first ingestion target: flat FHIR export.

Files:
- `flat-fhir-export.csv` - denormalized flat export suitable for template detection and mapping.
- `flat-fhir-bundle.json` - matching native FHIR Bundle fixture built from the same sample patient.

Notes:
- These samples are synthetic and should not be treated as real clinical data.
- The column names are intentionally stable and explicit so the importer can be validated without guessing.
- Keep this pack in sync with the ingestion spec and mapping manifest when the contract changes.
