#!/usr/bin/env bash
set -euo pipefail

cd /workspaces/DentVision1
npm ci

cd dentvision-backend
npm ci
