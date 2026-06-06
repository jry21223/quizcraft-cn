#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
STATIC_DEPLOY_DIR="${STATIC_DEPLOY_DIR:-}"

cd "${ROOT_DIR}/web-app"
npm run build:ops

if [ -n "${STATIC_DEPLOY_DIR}" ]; then
  if [ ! -d "${STATIC_DEPLOY_DIR}" ]; then
    echo "static deploy dir does not exist: ${STATIC_DEPLOY_DIR}" >&2
    exit 1
  fi
  cp -f dist/index.html "${STATIC_DEPLOY_DIR}/"
  mkdir -p "${STATIC_DEPLOY_DIR}/assets"
  cp -rf dist/assets/. "${STATIC_DEPLOY_DIR}/assets/"
fi
