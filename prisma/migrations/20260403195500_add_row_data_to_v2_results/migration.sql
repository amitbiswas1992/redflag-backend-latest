-- Add rowData and persisted columns to ingestion_row_results_v2 to store original CSV rows and persisted entity IDs
ALTER TABLE ingestion_row_results_v2 ADD COLUMN row_data JSONB;
ALTER TABLE ingestion_row_results_v2 ADD COLUMN persisted JSONB;
