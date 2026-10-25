#!/usr/bin/env bash
set -euo pipefail
mkdir -p .playwright-cli
playwright-cli --version
playwright-cli open 'http://localhost:3000/login?role=owner'
playwright-cli fill 'input[autocomplete="username"]' 'owner-a@test.com'
playwright-cli fill 'input[autocomplete="current-password"]' 'Test1234!'
playwright-cli click "getByRole('button', { name: 'Войти в DentVision' })"
playwright-cli snapshot --filename=.playwright-cli/ci-authenticated.yml
test -s .playwright-cli/ci-authenticated.yml
grep -q "DentVision" .playwright-cli/ci-authenticated.yml
for route in \
  /ai \
  /crm/patients \
  /crm/schedule \
  /crm/dental-chart \
  /crm/treatment-plans \
  /crm/lab \
  /crm/inventory \
  /crm/cashier \
  /diagnostics \
  /diagnostics/referrals \
  /diagnostics/results \
  /diagnostics/center \
  /diagnostics/lab \
  /shop \
  /school; do
  safe_name="$(printf '%s' "$route" | tr '/-' '__')"
  playwright-cli goto "http://localhost:3000$route"
  playwright-cli snapshot --filename=".playwright-cli/${safe_name}.yml"
  test -s ".playwright-cli/${safe_name}.yml"
  if grep -Eqi 'Application error|ChunkLoadError|Failed to fetch dynamically imported module|Something went wrong' ".playwright-cli/${safe_name}.yml"; then
    echo "Playwright CLI found an application error on $route" >&2
    exit 1
  fi
done
playwright-cli close
