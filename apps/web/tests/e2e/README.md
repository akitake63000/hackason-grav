# E2E Testing with Playwright

This directory contains end-to-end tests for the HairGuard application using Playwright.

## Setup

Install dependencies:

```bash
npm install
npx playwright install
```

## Running Tests

### Run all tests

```bash
npm run test:e2e
```

### Run tests in UI mode (interactive)

```bash
npm run test:e2e:ui
```

### Run tests in debug mode

```bash
npm run test:e2e:debug
```

### Run specific test file

```bash
npx playwright test dashboard.spec.ts
```

### Run tests in specific browser

```bash
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit
```

## Test Structure

- **dashboard.spec.ts**: Tests for the dashboard page, including API call verification
- **photo-analysis.spec.ts**: Tests for the photo capture and analysis flow
- **api-health.spec.ts**: Tests for API health checks and response time monitoring

## Configuration

The test configuration is in `playwright.config.ts`. Key settings:

- Base URL: `http://localhost:3000` (configurable via `PLAYWRIGHT_TEST_BASE_URL` env var)
- API Base URL: `http://localhost:8000` (configurable via `API_BASE_URL` env var)
- Browsers: Chromium, Firefox, WebKit
- Dev server auto-start: Enabled

## Environment Variables

- `PLAYWRIGHT_TEST_BASE_URL`: Override frontend base URL (default: `http://localhost:3000`)
- `API_BASE_URL`: Override API base URL (default: `http://localhost:8000`)
- `CI`: Set to `true` for CI environment (enables retries and sequential execution)

## Testing Against Production

To run E2E tests against the production environment:

### 1. Get your production URLs

- **Frontend**: Your Firebase Hosting URL (e.g., `https://hackason-grab.web.app`)
- **Backend**: Your Cloud Run service URL

Get Cloud Run URL:
```bash
gcloud run services describe agent-api --region=asia-northeast1 --format="value(status.url)"
```

### 2. Run tests with production URLs

```bash
# Method 1: Using environment variables
PLAYWRIGHT_TEST_BASE_URL=https://hackason-grab.web.app \
API_BASE_URL=https://your-service-xxx.run.app \
npm run test:e2e

# Method 2: Create .env.production file
cp .env.production.example .env.production
# Edit .env.production with your URLs
# Then load and run:
export $(cat .env.production | xargs) && npm run test:e2e
```

### 3. CI/CD Integration (GitHub Actions)

Create `.github/workflows/e2e-tests.yml`:

```yaml
name: E2E Tests (Production)

on:
  workflow_dispatch:  # Manual trigger
  schedule:
    - cron: '0 0 * * *'  # Daily at midnight

jobs:
  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        working-directory: apps/web
        run: |
          npm install
          npx playwright install --with-deps

      - name: Run E2E tests
        working-directory: apps/web
        env:
          PLAYWRIGHT_TEST_BASE_URL: https://hackason-grab.web.app
          API_BASE_URL: ${{ secrets.CLOUD_RUN_URL }}
        run: npm run test:e2e

      - name: Upload test report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: apps/web/playwright-report/
```

**Note**: Add your Cloud Run URL as a GitHub Secret named `CLOUD_RUN_URL`.

## Viewing Test Reports

After running tests, view the HTML report:

```bash
npx playwright show-report
```

## Writing New Tests

Follow the existing patterns:

1. Use descriptive test names
2. Use `test.describe` for grouping related tests
3. Use `test.beforeEach` for setup
4. Use proper waiting strategies (`waitForLoadState`, `waitForSelector`)
5. Make tests independent (don't rely on test execution order)

## API Response Time Monitoring

The `api-health.spec.ts` tests verify that the API includes the `X-Process-Time` header, which is added by the `ResponseTimeMiddleware` on the backend. This helps monitor API performance.
