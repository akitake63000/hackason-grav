import { test, expect } from '@playwright/test';

test.describe('Security Fixes Verification', () => {
  const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:8000';

  // Skip authenticated tests in CI without real auth tokens
  const skipAuthTests = process.env.CI && !process.env.FIREBASE_AUTH_TOKEN;

  test.describe('IDOR Protection', () => {
    test.skip(skipAuthTests, 'Requires authentication token');

    test('should reject unauthorized storage path access', async ({ request }) => {
      // Attempt to access storage path with invalid ownership
      const invalidPath = 'users/other-user-id/meals/photo.jpg';

      const response = await request.post(`${API_BASE_URL}/api/v1/lifestyle/meal-analyze`, {
        data: {
          storagePath: invalidPath
        },
        headers: {
          'Authorization': 'Bearer test-token' // Would need real auth in production
        }
      });

      // Should be rejected with 403 Forbidden or 401 Unauthorized
      expect([401, 403]).toContain(response.status());
    });

    test('should reject path traversal attempts', async ({ request }) => {
      // Attempt path traversal attack
      const maliciousPath = 'users/uid/../../../etc/passwd';

      const response = await request.post(`${API_BASE_URL}/api/v1/lifestyle/meal-analyze`, {
        data: {
          storagePath: maliciousPath
        },
        headers: {
          'Authorization': 'Bearer test-token'
        }
      });

      // Should be rejected with 400 Bad Request or 403 Forbidden
      expect([400, 401, 403]).toContain(response.status());
    });
  });

  test.describe('Rate Limiting', () => {
    test.skip(skipAuthTests, 'Requires authentication token');

    test('should enforce rate limit on LLM endpoints', async ({ request }) => {
      // Test rate limiting on /reports/generate endpoint
      const requests = [];

      // Send 12 requests rapidly (limit is 10/minute)
      for (let i = 0; i < 12; i++) {
        requests.push(
          request.post(`${API_BASE_URL}/api/v1/reports/generate`, {
            data: {
              periodDays: 30
            },
            headers: {
              'Authorization': 'Bearer test-token'
            }
          })
        );
      }

      const responses = await Promise.all(requests);

      // At least one request should be rate limited (429 Too Many Requests)
      const rateLimitedResponses = responses.filter(r => r.status() === 429);

      expect(rateLimitedResponses.length).toBeGreaterThan(0);

      // Check rate limit header
      const lastResponse = responses[responses.length - 1];
      if (lastResponse.status() === 429) {
        const headers = lastResponse.headers();
        expect(headers['x-ratelimit-limit']).toBeDefined();
        console.log(`Rate limit: ${headers['x-ratelimit-limit']}`);
      }
    });

    test('should enforce rate limit on food-sniper endpoint', async ({ request }) => {
      const requests = [];

      // Send 11 requests (limit is 10/minute)
      for (let i = 0; i < 11; i++) {
        requests.push(
          request.post(`${API_BASE_URL}/api/v1/food-sniper/recommend`, {
            data: {
              message: 'Test request',
              hairPattern: 'test'
            },
            headers: {
              'Authorization': 'Bearer test-token'
            }
          })
        );
      }

      const responses = await Promise.all(requests);
      const rateLimitedCount = responses.filter(r => r.status() === 429).length;

      expect(rateLimitedCount).toBeGreaterThan(0);
    });
  });

  test.describe('Error Response Sanitization', () => {
    test('should not expose internal exception details', async ({ request }) => {
      // Trigger an internal server error
      const response = await request.post(`${API_BASE_URL}/api/v1/lifestyle/meal-analyze`, {
        data: {
          storagePath: 'invalid-format'
        },
        headers: {
          'Authorization': 'Bearer test-token'
        }
      });

      if (!response.ok()) {
        const body = await response.json();

        // Should not contain stack traces or internal error types
        const bodyStr = JSON.stringify(body);
        expect(bodyStr).not.toContain('Traceback');
        expect(bodyStr).not.toContain('Exception');
        expect(bodyStr).not.toContain('File "');

        // Should not expose exception_type
        expect(body).not.toHaveProperty('exception_type');

        // Should have standardized error structure
        expect(body).toHaveProperty('error');
        expect(body.error).toHaveProperty('code');
        expect(body.error).toHaveProperty('message');
      }
    });
  });

  test.describe('OIDC Authentication (Cloud Function)', () => {
    test('should reject unauthenticated requests to daily-scheduler', async ({ request }) => {
      // Attempt to call Cloud Function without OIDC token
      const response = await request.post(
        'https://asia-northeast1-hackason-grab.cloudfunctions.net/daily-scheduler',
        {
          failOnStatusCode: false
        }
      );

      // Should be rejected with 401 Unauthorized
      expect(response.status()).toBe(401);

      const body = await response.json();
      expect(body).toHaveProperty('error');
      expect(body.error).toBe('Unauthorized');
    });
  });

  test.describe('Data Cleanup API', () => {
    test.skip(skipAuthTests, 'Requires authentication token');

    test('should require authentication for cleanup endpoint', async ({ request }) => {
      const response = await request.post(`${API_BASE_URL}/api/v1/lifestyle/cleanup-user-data`, {
        failOnStatusCode: false
      });

      // Should require auth
      expect(response.status()).toBe(401);
    });

    test('should return deletion summary on success', async ({ request }) => {
      // This would need real auth token in production
      const response = await request.post(`${API_BASE_URL}/api/v1/lifestyle/cleanup-user-data`, {
        headers: {
          'Authorization': 'Bearer test-token'
        },
        failOnStatusCode: false
      });

      if (response.ok()) {
        const body = await response.json();

        // Should have deletion summary
        expect(body).toHaveProperty('status');
        expect(body).toHaveProperty('deleted');
        expect(body).toHaveProperty('timestamp');

        // Deleted should be an array
        expect(Array.isArray(body.deleted)).toBeTruthy();
      }
    });
  });
});
