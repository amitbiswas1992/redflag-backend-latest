#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:4000}"
CSV_FILE="${CSV_FILE:-samples/flat-fhir/TEST_Jerome_Okonkwo_33f853bc-c57c-4be4-b7b3-1049192c9f2f.csv}"
POLL_SECONDS="${POLL_SECONDS:-2}"
TIMEOUT_SECONDS="${TIMEOUT_SECONDS:-90}"
READY_TIMEOUT_SECONDS="${READY_TIMEOUT_SECONDS:-60}"
MAX_ERROR_ROWS="${MAX_ERROR_ROWS:-0}"

if ! command -v curl >/dev/null 2>&1; then
  echo "Error: curl is required"
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "Error: jq is required"
  exit 1
fi

if [[ ! -f "$CSV_FILE" ]]; then
  echo "Error: CSV file not found: $CSV_FILE"
  exit 1
fi

echo "Using API: $BASE_URL"
echo "Using CSV: $CSV_FILE"

echo "Waiting for API readiness..."
ready_elapsed=0
while true; do
  if curl -sS -f "$BASE_URL/health" >/dev/null 2>&1; then
    break
  fi

  if (( ready_elapsed >= READY_TIMEOUT_SECONDS )); then
    echo "Error: API did not become ready within $READY_TIMEOUT_SECONDS seconds"
    exit 1
  fi

  sleep 2
  ready_elapsed=$((ready_elapsed + 2))
done

echo "API is ready"

create_payload=$(jq -n \
  --arg sourceType "FLAT_FHIR_CSV" \
  '{sourceType: $sourceType}')

create_response=$(curl -sS -f -X POST "$BASE_URL/api/ingestion/v2/jobs" \
  -H "Content-Type: application/json" \
  -d "$create_payload")

job_id=$(echo "$create_response" | jq -r '.jobId // empty')
if [[ -z "$job_id" ]]; then
  echo "Error: failed to create job"
  echo "$create_response"
  exit 1
fi

echo "Created job: $job_id"

upload_payload=$(jq -n --rawfile csv "$CSV_FILE" '{csvData: $csv}')
upload_response=$(curl -sS -f -X POST "$BASE_URL/api/ingestion/v2/jobs/$job_id/upload-csv" \
  -H "Content-Type: application/json" \
  -d "$upload_payload")

upload_status=$(echo "$upload_response" | jq -r '.status // empty')
if [[ "$upload_status" != "UPLOADED" ]]; then
  echo "Error: upload did not return UPLOADED"
  echo "$upload_response"
  exit 1
fi

total_rows=$(echo "$upload_response" | jq -r '.totalRows // 0')
echo "Uploaded rows: $total_rows"

start_response=$(curl -sS -f -X POST "$BASE_URL/api/ingestion/v2/jobs/$job_id/start" \
  -H "Content-Type: application/json" \
  -d '{}')

echo "Start response:"
echo "$start_response" | jq .

elapsed=0
while true; do
  job_response=$(curl -sS -f "$BASE_URL/api/ingestion/v2/jobs/$job_id")
  status=$(echo "$job_response" | jq -r '.status // empty')

  if [[ "$status" == "COMPLETED" ]]; then
    echo "Job completed"
    break
  fi

  if [[ "$status" == "FAILED" ]]; then
    echo "Error: job failed"
    echo "$job_response" | jq .
    exit 1
  fi

  if (( elapsed >= TIMEOUT_SECONDS )); then
    echo "Error: timed out waiting for completion"
    echo "$job_response" | jq .
    exit 1
  fi

  sleep "$POLL_SECONDS"
  elapsed=$((elapsed + POLL_SECONDS))
done

results_response=$(curl -sS -f "$BASE_URL/api/ingestion/v2/jobs/$job_id/results?page=1&pageSize=200")

result_total=$(echo "$results_response" | jq -r '.total // 0')
if [[ "$result_total" -eq 0 ]]; then
  echo "Error: expected row results, got total=0"
  echo "$results_response" | jq .
  exit 1
fi

error_rows=$(echo "$results_response" | jq -r '[.rows[] | select(.outcome == "ERROR")] | length')

if (( error_rows > MAX_ERROR_ROWS )); then
  echo "Error: row validation/persistence failures exceeded threshold"
  echo "error_rows=$error_rows max_allowed=$MAX_ERROR_ROWS"
  echo "$results_response" | jq .
  exit 1
fi

summary=$(jq -n \
  --arg jobId "$job_id" \
  --argjson totalRows "$total_rows" \
  --argjson rowResults "$result_total" \
  --argjson errorRows "$error_rows" \
  '{jobId: $jobId, uploadedRows: $totalRows, rowResults: $rowResults, errorRows: $errorRows}')

echo "E2E summary:"
echo "$summary" | jq .

echo "Success: CSV E2E test completed"
