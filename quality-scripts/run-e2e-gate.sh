#!/usr/bin/env bash
# Run one E2E/release gate with bounded live output, durable logs and timing.
# Preserve the command's exit code and complete output without flooding Actions logs.
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
heartbeat_seconds="${E2E_GATE_HEARTBEAT_SECONDS:-20}"
if ! [[ "$heartbeat_seconds" =~ ^[1-9][0-9]*$ ]]; then
  heartbeat_seconds=20
fi

mkdir -p "$(dirname "$log_path")"
started_at="$(date +%s)"
printf 'E2E_GATE_START name=%s log=%s heartbeat_seconds=%s\n' "$gate_name" "$log_path" "$heartbeat_seconds"

# Keep every byte for failure analysis, but do not mirror verbose Playwright output
# into the Actions console. Emit a bounded heartbeat while the command is running.
"$@" >"$log_path" 2>&1 &
command_pid=$!
while kill -0 "$command_pid" 2>/dev/null; do
  sleep "$heartbeat_seconds"
  if kill -0 "$command_pid" 2>/dev/null; then
    now="$(date +%s)"
    elapsed="$((now - started_at))"
    printf 'E2E_GATE_HEARTBEAT name=%s elapsed_seconds=%s log=%s\n' "$gate_name" "$elapsed" "$log_path"
  fi
done

status=0
wait "$command_pid" || status=$?
awk '
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
' "$log_path"
finished_at="$(date +%s)"
duration="$((finished_at - started_at))"
printf '%s status=%s duration_seconds=%s log=%s\n' "$gate_name" "$status" "$duration" "$log_path" >> "$timing_path"
printf '%s status=%s duration_seconds=%s log=%s\n' "$gate_name" "$status" "$duration" "$log_path"

# The full log remains available as a failure-only artifact. Print only the
# result summary on success, or a bounded, high-signal excerpt on failure.
if [[ -s "$log_path" ]]; then
  if [[ "$status" -eq 0 ]]; then
    echo "=== $gate_name: result summary ==="
    grep -E '(^[[:space:]]*[0-9]+ (passed|skipped)|E2E_GATE_RESULT|All tests passed|warning:)' "$log_path" | tail -n 12 || true
  else
    echo "=== $gate_name: bounded failure excerpt (max 80 matching lines) ==="
    if ! grep -E '(›|Error:|Expected:|Received:|[0-9]+ failed|[0-9]+ passed|expect\(|HTTP [45][0-9]{2}|Test timeout|timed out|not.toBe|not.toEqual|failed)' "$log_path" | tail -n 80; then
      tail -n 60 "$log_path"
    fi
  fi
fi

printf 'E2E_GATE_RESULT name=%s status=%s duration_seconds=%s log=%s\n' "$gate_name" "$status" "$duration" "$log_path"
exit "$status"
