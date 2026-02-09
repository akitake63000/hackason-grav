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
