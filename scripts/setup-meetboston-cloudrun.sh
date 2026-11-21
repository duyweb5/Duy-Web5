#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Meet Boston — One-Shot Google Cloud Run + Cloud Scheduler + IAM Setup Script
# Project : gen-lang-client-0440115237
# Domain  : Configurable via DOMAIN=... (default: meetboston.duyvo.win; e.g. DOMAIN=langthangbostone.com)
# Run inside Google Cloud Shell (already authenticated to your GCP account).
# ==============================================================================

PROJECT_ID="${PROJECT_ID:-gen-lang-client-0440115237}"
DOMAIN="${DOMAIN:-meetboston.duyvo.win}"
PUBLIC_URL="https://${DOMAIN}"
SCHEDULER_JOB="meet-boston-youtube-daily-sync"
SCHEDULER_LOCATION="${SCHEDULER_LOCATION:-us-east1}"

echo "==> [1/6] Thiet lap project ${PROJECT_ID}..."
gcloud config set project "${PROJECT_ID}" >/dev/null

# Auto-detect Cloud Run service & region
SERVICE_INFO=$(gcloud run services list --project="${PROJECT_ID}" --format="value(metadata.name,region)" | head -n 1 || true)
SERVICE_NAME="${CLOUD_RUN_SERVICE:-$(echo "${SERVICE_INFO}" | awk '{print $1}')}"
REGION="${CLOUD_RUN_REGION:-$(echo "${SERVICE_INFO}" | awk '{print $2}')}"

if [[ -z "${SERVICE_NAME}" || -z "${REGION}" ]]; then
  echo "Khong tu dong tim thay Cloud Run service. Hay truyen tay:"
  echo "  CLOUD_RUN_SERVICE=<ten-service> CLOUD_RUN_REGION=<region> bash scripts/setup-meetboston-cloudrun.sh"
  exit 1
fi

echo "    Tim thay Cloud Run Service: ${SERVICE_NAME} (region: ${REGION})"

echo "==> [2/6] Cap quyen toi thieu Firestore (roles/datastore.user) cho Cloud Run Service Account..."
PROJECT_NUMBER=$(gcloud projects describe "${PROJECT_ID}" --format="value(projectNumber)")
RUNTIME_SA=$(gcloud run services describe "${SERVICE_NAME}" \
  --project="${PROJECT_ID}" \
  --region="${REGION}" \
  --format="value(spec.template.spec.serviceAccountName)" || true)
if [[ -z "${RUNTIME_SA}" ]]; then
  RUNTIME_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
fi
echo "    Service Account: ${RUNTIME_SA}"
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${RUNTIME_SA}" \
  --role="roles/datastore.user" >/dev/null

echo "==> [3/6] Sinh khoa bao mat CRON_SECRET & WEBSUB_SECRET va gan bien moi truong..."
CRON_SECRET="${CRON_SECRET:-$(openssl rand -hex 24)}"
WEBSUB_SECRET="${WEBSUB_SECRET:-$(openssl rand -hex 24)}"

ENV_VARS="PUBLIC_APP_URL=${PUBLIC_URL},CRON_SECRET=${CRON_SECRET},WEBSUB_SECRET=${WEBSUB_SECRET}"
if [[ -n "${GEMINI_API_KEY:-}" ]]; then
  ENV_VARS="${ENV_VARS},GEMINI_API_KEY=${GEMINI_API_KEY}"
fi

gcloud run services update "${SERVICE_NAME}" \
  --project="${PROJECT_ID}" \
  --region="${REGION}" \
  --update-env-vars="${ENV_VARS}" >/dev/null

echo "==> [4/6] Kiem tra Domain Mapping cho ${DOMAIN}..."
if gcloud beta run domain-mappings describe --domain="${DOMAIN}" --region="${REGION}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
  echo "    Domain mapping ${DOMAIN} da ton tai."
else
  echo "    Dang tao Domain mapping ${DOMAIN} -> ${SERVICE_NAME}..."
  gcloud beta run domain-mappings create \
    --service="${SERVICE_NAME}" \
    --domain="${DOMAIN}" \
    --region="${REGION}" \
    --project="${PROJECT_ID}" || true
fi

echo "==> [5/6] Bat Cloud Scheduler API & tao/cap nhat lich quet YouTube 06:00 hang ngay..."
gcloud services enable cloudscheduler.googleapis.com --project="${PROJECT_ID}" >/dev/null

if gcloud scheduler jobs describe "${SCHEDULER_JOB}" --location="${SCHEDULER_LOCATION}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
  gcloud scheduler jobs update http "${SCHEDULER_JOB}" \
    --project="${PROJECT_ID}" \
    --location="${SCHEDULER_LOCATION}" \
    --schedule="0 6 * * *" \
    --time-zone="America/New_York" \
    --uri="${PUBLIC_URL}/api/cron/sync-youtube" \
    --http-method=POST \
    --update-headers="Content-Type=application/json,X-Cron-Secret=${CRON_SECRET}" \
    --message-body='{"forceRenewWebSub":true,"maxAiPerRun":10}' >/dev/null
else
  gcloud scheduler jobs create http "${SCHEDULER_JOB}" \
    --project="${PROJECT_ID}" \
    --location="${SCHEDULER_LOCATION}" \
    --schedule="0 6 * * *" \
    --time-zone="America/New_York" \
    --uri="${PUBLIC_URL}/api/cron/sync-youtube" \
    --http-method=POST \
    --headers="Content-Type=application/json,X-Cron-Secret=${CRON_SECRET}" \
    --message-body='{"forceRenewWebSub":true,"maxAiPerRun":10}' >/dev/null
fi

echo "==> [6/6] Kiem tra suc khoe he thong tai ${PUBLIC_URL}/api/health ..."
curl -sS "${PUBLIC_URL}/api/health" || true
echo ""
echo "HOAN TAT! Hay mo ${PUBLIC_URL}/admin -> Thu vien Video & AI -> Tu dong hoa & Lich quet -> bam Kich hoat WebSub."
