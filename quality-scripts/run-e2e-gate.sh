#!/usr/bin/env bash
# Run one E2E/release gate with compact live output, durable logs and timing.
# The command's exit code and test selection are preserved.
set -uo pipefail
if [[ $# -lt 2 ]]; then
  echo "usage: run-e2e-gate.sh <gate-name> <command> [args...]" >&2
  exit 64
fi
gate_name="$1"
shift
log_path="${E2E_GATE_LOG_PATH:-e2e-gate-logs/${gate_name}.log}"
timing_path="${E2E_GATE_TIMINGS_FILE:-e2e-gate-timings.txt}"
mkdir -p "$(dirname "$log_path")"
started_at="$(date +%s)"
"$@" 2>&1 | tee "$log_path"
pipeline_status=( "${PIPESTATUS[@]}" )
status="${pipeline_status[0]:-1}"
finished_at="$(date +%s)"
duration="$((finished_at - started_at))"
printf '%s status=%s duration_seconds=%s log=%s\n' "$gate_name" "$status" "$duration" "$log_path" >> "$timing_path"
printf 'E2E_GATE_RESULT name=%s status=%s duration_seconds=%s log=%s\n' "$gate_name" "$status" "$duration" "$log_path"
exit "$status"
