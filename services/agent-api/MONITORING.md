# Monitoring and Quality Features

This document describes the monitoring, error tracking, and quality features implemented in the HairGuard Agent API.

## Features

### 1. API Response Time Monitoring

**Location**: `app/middleware/monitoring.py`

All API requests are automatically monitored for response time. The middleware adds:

- **X-Process-Time header**: Response time in milliseconds added to every response
- **Automatic logging**:
  - `DEBUG` level: < 2 seconds
  - `INFO` level: 2-5 seconds
  - `WARNING` level: > 5 seconds

**Usage**: Automatically enabled for all endpoints.

**Viewing logs in production**:
```bash
# Google Cloud Console
# Cloud Run → agent-api → Logs

# Or use gcloud CLI
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=agent-api" --limit 50
```

### 2. Enhanced Health Check Endpoints

**Location**: `app/routers/health.py`

Enhanced health check endpoints with detailed system information:

- **GET /api/health**: Basic health check (backward compatible)
- **GET /api/v1/health**: Enhanced health check with system info
- **GET /api/v1/health/ready**: Readiness probe for Cloud Run
- **GET /api/v1/health/live**: Liveness probe for Cloud Run

**Response example**:
```json
{
  "status": "ok",
  "service": "HairGuard Agent API",
  "version": "1.0.0",
  "timestamp": "2025-02-09T12:00:00Z",
  "environment": "production",
  "checks": {
    "api": "healthy",
    "gemini": "enabled"
  }
}
```

### 3. Rate Limiting (Optional)

**Location**: `app/middleware/rate_limit.py`

Endpoint-specific rate limiting to prevent abuse:

| Endpoint | Rate Limit | Purpose |
|----------|------------|---------|
| /api/v1/health/* | 200/minute | Health checks |
| /api/v1/photos/analysis-history | 100/minute | Dashboard data fetching |
| /api/v1/photos/analyze | 5/minute | Photo analysis |
| /api/v1/mental-shield/chat | 10/minute | Mental health chat |
| /api/v1/food-sniper/recommend | 5/minute | Food recommendations |
| /api/v1/reports/generate | 3/minute | Report generation |
| Other endpoints | 30/minute | Default limit |

**Enabling rate limiting**:

Uncomment in `app/main.py`:
```python
app.add_middleware(RateLimitMiddleware)
```

**Note**: Currently commented out to avoid breaking dashboard functionality during hackathon. The dashboard makes 2 rapid API calls (limit=50, then limit=200).

### 4. Error Monitoring with Sentry

**Location**: `app/monitoring/sentry.py`

Automatic error tracking and performance monitoring using Sentry.

**Configuration**:

Set the following environment variables:

```bash
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
ENVIRONMENT=production  # or staging, development
```

**Features**:
- Automatic exception tracking
- Performance monitoring (traces)
- Logging integration
- Privacy-safe (PII disabled by default)

**Manual error capture**:
```python
from app.monitoring import capture_exception, capture_message

try:
    # Your code
    pass
except Exception as e:
    capture_exception(e, context={"user_id": uid, "operation": "analyze_photo"})
```

**Viewing errors**:
- Visit your Sentry dashboard at sentry.io
- Or use Sentry CLI/API

### 5. E2E Testing with Playwright

**Location**: `apps/web/tests/e2e/`

Comprehensive end-to-end tests for frontend and API:

- Dashboard page tests
- Photo analysis flow tests
- API health check tests
- Response time monitoring verification
- Mobile responsiveness tests

**Running tests**:
```bash
cd apps/web
npm install
npx playwright install

# Run all tests
npm run test:e2e

# Interactive mode
npm run test:e2e:ui

# Debug mode
npm run test:e2e:debug
```

## Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `SENTRY_DSN` | Sentry DSN for error tracking | - | No |
| `ENVIRONMENT` | Environment name | development | No |

## Production Deployment

### Cloud Run Configuration

Add environment variables to Cloud Run deployment:

```bash
gcloud run deploy agent-api \
  --set-env-vars="SENTRY_DSN=your-dsn-here,ENVIRONMENT=production"
```

### GitHub Actions

Update `.github/workflows/cloud-run-deploy.yml` to include:

```yaml
env:
  SENTRY_DSN: ${{ secrets.SENTRY_DSN }}
```

## Monitoring Best Practices

1. **Check health endpoints regularly**:
   - Use Cloud Run health checks with `/api/v1/health/ready` and `/api/v1/health/live`

2. **Set up Sentry alerts**:
   - Configure alerts for error rate threshold
   - Set up Slack/email notifications

3. **Monitor response times**:
   - Use Cloud Run metrics dashboard
   - Set up alerts for slow endpoints (> 5s)

4. **Review logs regularly**:
   - Check for WARNING level logs in Cloud Run
   - Look for patterns in slow requests

5. **Run E2E tests before deployment**:
   - Include E2E tests in CI/CD pipeline
   - Test against staging environment

## Troubleshooting

### Response time monitoring not working

- Check if ResponseTimeMiddleware is enabled in `app/main.py`
- Verify logs with: `gcloud logging read "severity>=INFO"`

### Sentry not capturing errors

- Verify `SENTRY_DSN` is set correctly
- Check Sentry initialization logs at startup
- Test with manual error: `from app.monitoring import capture_message; capture_message("Test")`

### Rate limiting blocking legitimate requests

- Review rate limits in `app/middleware/rate_limit.py`
- Temporarily disable by commenting out in `app/main.py`
- Consider endpoint-specific adjustments

## Future Improvements

- [ ] Add Prometheus metrics export
- [ ] Implement distributed tracing with OpenTelemetry
- [ ] Add custom business metrics (e.g., analysis success rate)
- [ ] Set up automated performance regression testing
- [ ] Add real-time alerting with Cloud Monitoring
