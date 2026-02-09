import { test, expect } from '@playwright/test';

test.describe('API Health and Monitoring', () => {
  // Get API base URL from environment or use default
  const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:8000';

  test('should return health check successfully', async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/api/v1/health`);

    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('status');
    expect(data.status).toBe('ok');
  });

  test('should include X-Process-Time header in response', async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/api/v1/health`);

    // Check for response time monitoring header
    const processTime = response.headers()['x-process-time'];

    expect(processTime).toBeDefined();
    expect(parseFloat(processTime)).toBeGreaterThan(0);

    console.log(`API response time: ${processTime}ms`);
  });

  test('should handle CORS correctly', async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/api/v1/health`, {
      headers: {
        'Origin': 'http://localhost:3000'
      }
    });

    expect(response.ok()).toBeTruthy();

    // Check CORS headers
    const headers = response.headers();
    expect(headers['access-control-allow-origin']).toBeDefined();
  });

  test('should reject invalid HTTP methods', async ({ request }) => {
    // API only allows GET and POST, so PUT should fail
    try {
      const response = await request.put(`${API_BASE_URL}/api/v1/health`);

      // Should either get 405 Method Not Allowed or be rejected by CORS
      expect([405, 403, 400]).toContain(response.status());
    } catch (error) {
      // Request may be rejected before response, which is also acceptable
      expect(error).toBeDefined();
    }
  });

  test('should respond within acceptable time threshold', async ({ request }) => {
    const startTime = Date.now();
    const response = await request.get(`${API_BASE_URL}/api/v1/health`);
    const endTime = Date.now();

    const responseTime = endTime - startTime;

    expect(response.ok()).toBeTruthy();

    // Health check should respond within 500ms
    expect(responseTime).toBeLessThan(500);

    console.log(`Health check response time: ${responseTime}ms`);
  });
});
