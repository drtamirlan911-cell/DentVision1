#!/usr/bin/env bash
# Run one E2E/release gate with bounded live output, durable logs and timing.
# Preserve the command's exit code and complete output without flooding Actions logs.
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
