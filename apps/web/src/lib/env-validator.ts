/**
 * Environment variable validation module for Next.js frontend.
 * Validates required environment variables at build/runtime.
 */

export class EnvValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EnvValidationError';
  }
}

interface ValidationRule {
  key: string;
  required: boolean;
  allowedValues?: string[];
  default?: string;
}

/**
 * Validate a single environment variable.
 */
function validateEnvVar(rule: ValidationRule): string | undefined {
  const { key, required, allowedValues, default: defaultValue } = rule;
  const value = process.env[key] || defaultValue;

  if (required && !value) {
    throw new EnvValidationError(`Required environment variable '${key}' is not set`);
  }

  if (allowedValues && value && !allowedValues.includes(value)) {
    throw new EnvValidationError(
      `Environment variable '${key}' has invalid value '${value}'. ` +
      `Allowed values: ${allowedValues.join(', ')}`
    );
  }

  return value;
}

/**
 * Validate all required environment variables.
 * Call this at the top of your app or in a root layout.
 */
export function validateAllEnvVars(): Record<string, string | undefined> {
  const validated: Record<string, string | undefined> = {};
  const errors: string[] = [];

  const rules: ValidationRule[] = [
    {
      key: 'NEXT_PUBLIC_FIREBASE_API_KEY',
      required: true,
    },
    {
      key: 'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
      required: true,
    },
    {
      key: 'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
      required: true,
    },
    {
      key: 'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
      required: true,
    },
    {
      key: 'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
      required: true,
    },
    {
      key: 'NEXT_PUBLIC_FIREBASE_APP_ID',
      required: true,
    },
    {
      key: 'NEXT_PUBLIC_API_BASE',
      required: false, // Optional for relative URL usage
    },
    {
      key: 'NEXT_PUBLIC_DIRECT_API_URL',
      required: false, // Optional, has default
    },
    {
      key: 'NEXT_PUBLIC_ALLOWED_DIRECT_API_DOMAINS',
      required: false, // Optional, has default
    },
    {
      key: 'NODE_ENV',
      required: false,
      allowedValues: ['development', 'production', 'test'],
      default: 'development',
    },
  ];

  for (const rule of rules) {
    try {
      const value = validateEnvVar(rule);
      validated[rule.key] = value;
    } catch (error) {
      if (error instanceof EnvValidationError) {
        errors.push(error.message);
      } else {
        throw error;
      }
    }
  }

  if (errors.length > 0) {
    const errorMessage = 'Environment variable validation failed:\n' +
      errors.map(err => `  - ${err}`).join('\n');
    throw new EnvValidationError(errorMessage);
  }

  if (process.env.NODE_ENV === 'development') {
    console.log('✅ Environment variables validated successfully');
  }

  return validated;
}

/**
 * Validate environment variables and exit if validation fails (for server-side).
 */
export function validateEnvVarsOrExit(): void {
  try {
    validateAllEnvVars();
  } catch (error) {
    if (error instanceof EnvValidationError) {
      console.error(`❌ Startup failed due to environment validation errors:\n${error.message}`);
      process.exit(1);
    }
    throw error;
  }
}
