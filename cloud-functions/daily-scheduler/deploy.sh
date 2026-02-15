#!/bin/bash

# Deploy Cloud Function for daily scheduler
# Run this script from the cloud-functions/daily-scheduler directory

set -e

FUNCTION_NAME="daily-scheduler"
PROJECT_ID="hackason-grab"
REGION="asia-northeast1"  # Tokyo region
RUNTIME="python312"
MEMORY="512MB"
TIMEOUT="540s"  # 9 minutes (max for 2nd gen)

echo "Deploying Cloud Function: $FUNCTION_NAME"

gcloud functions deploy $FUNCTION_NAME \
  --gen2 \
  --runtime=$RUNTIME \
  --region=$REGION \
  --source=. \
  --entry-point=daily_scheduler \
  --trigger-http \
  --allow-unauthenticated \
  --memory=$MEMORY \
  --timeout=$TIMEOUT \
  --env-vars-file=.env.yaml \
  --project=$PROJECT_ID

echo "Cloud Function deployed successfully!"
echo ""
echo "Next step: Create Cloud Scheduler job"
echo "Run: ./setup-scheduler.sh"
