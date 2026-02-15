#!/bin/bash

# Setup Cloud Scheduler to trigger the function at 4 AM JST daily

set -e

JOB_NAME="daily-scheduler-4am-jst"
PROJECT_ID="hackason-grab"
REGION="asia-northeast1"
SCHEDULE="0 4 * * *"  # 4 AM every day
TIMEZONE="Asia/Tokyo"
FUNCTION_URL="https://${REGION}-${PROJECT_ID}.cloudfunctions.net/daily-scheduler"
SERVICE_ACCOUNT_EMAIL="cloud-scheduler@${PROJECT_ID}.iam.gserviceaccount.com"

echo "Creating Cloud Scheduler job: $JOB_NAME"

# Delete existing job if exists
gcloud scheduler jobs delete $JOB_NAME \
  --location=$REGION \
  --project=$PROJECT_ID \
  --quiet || true

# Create new job with OIDC authentication
gcloud scheduler jobs create http $JOB_NAME \
  --location=$REGION \
  --schedule="$SCHEDULE" \
  --time-zone="$TIMEZONE" \
  --uri="$FUNCTION_URL" \
  --http-method=POST \
  --headers="Content-Type=application/json" \
  --oidc-service-account-email="$SERVICE_ACCOUNT_EMAIL" \
  --oidc-token-audience="$FUNCTION_URL" \
  --project=$PROJECT_ID

echo "Cloud Scheduler job created successfully!"
echo ""
echo "Job details:"
echo "  Name: $JOB_NAME"
echo "  Schedule: $SCHEDULE ($TIMEZONE)"
echo "  Target: $FUNCTION_URL"
echo ""
echo "To test manually, run:"
echo "  gcloud scheduler jobs run $JOB_NAME --location=$REGION --project=$PROJECT_ID"
