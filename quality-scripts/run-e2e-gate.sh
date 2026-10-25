#!/usr/bin/env bash
# Run one E2E/release gate with bounded live output, a complete durable log, and timing.
# stdout/stderr remain unabridged in log_path; only the terminal stream is summarized.
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
"$@" 2>&1 | tee "$log_path" | awk '
  function short(s) { return length(s) > 320 ? substr(s, 1, 317) "..." : s }
  /^Running [0-9]+ tests using [0-9]+ worker/ { print short($0); fflush(); next }
  /^[[:space:]]*[·×F°✓✔✘○]+[[:space:]]*$/ { print short($0); fflush(); next }
  /^[[:space:]]*[0-9]+ (passed|failed|skipped)([[:space:]]+.*)?$/ { print short($0); fflush(); next }
  /^[[:space:]]*[0-9]+\) \[/ {
    failure_headers++
    if (failure_headers <= 12) { print short($0); fflush() }
    next
  }
  /Error:|AssertionError:|Test timeout|HTTP [45][0-9][0-9]|response\.json: Protocol error|ReferenceError:|TypeError:/ {
    text = short($0)
    diagnostic_lines++
    if (!(text in seen) && unique_diagnostics < 24) {
      seen[text] = 1
      unique_diagnostics++
      print "  " text
      fflush()
    }
    next
  }
  END {
    if (failure_headers > 12) printf "... %d more failure headings omitted from live output; complete log retained.\n", failure_headers - 12
    if (diagnostic_lines > unique_diagnostics) printf "... %d repeated/extra diagnostic lines omitted; complete log retained.\n", diagnostic_lines - unique_diagnostics
  }
'
pipeline_status=( "${PIPESTATUS[@]}" )
status="${pipeline_status[0]:-1}"
finished_at="$(date +%s)"
duration="$((finished_at - started_at))"
printf '%s status=%s duration_seconds=%s log=%s\n' "$gate_name" "$status" "$duration" "$log_path" >> "$timing_path"
printf 'E2E_GATE_RESULT name=%s status=%s duration_seconds=%s log=%s\n' "$gate_name" "$status" "$duration" "$log_path"
exit "$status"
