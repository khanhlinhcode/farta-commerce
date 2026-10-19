import { z } from "zod";

const url = z.url();
const appEnvironment = z.enum(["development", "test", "staging", "production"]);

export type AppEnvironment = z.infer<typeof appEnvironment>;

export function isDeployedEnvironment(
  environment: unknown,
): environment is Extract<AppEnvironment, "staging" | "production"> {
  return environment === "staging" || environment === "production";
}

const environmentSchema = z
  .object({
    APP_ENV: appEnvironment.default("development"),
    PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
    APP_ORIGIN: url,
    ADMIN_ORIGIN: url,
    API_ORIGIN: url,
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),
    MONGODB_URI: z.string().min(1),
    REDIS_URL: url,
    JWT_ACCESS_SECRET: z.string().min(32),
    JWT_REFRESH_SECRET: z.string().min(32),
    CSRF_SECRET: z.string().min(32),
    CART_CREDENTIAL_SECRET: z.string().min(32),
    JWT_ISSUER: z.string().min(1),
    JWT_CUSTOMER_AUDIENCE: z.string().min(1),
    JWT_STAFF_AUDIENCE: z.string().min(1),
    JWT_ACCESS_TTL_SECONDS: z.coerce
      .number()
      .int()
      .min(60)
      .max(900)
      .default(300),
    SESSION_IDLE_TTL_SECONDS: z.coerce
      .number()
      .int()
      .min(300)
      .max(2_592_000)
      .default(604_800),
    SESSION_ABSOLUTE_TTL_SECONDS: z.coerce
      .number()
      .int()
      .min(3600)
      .max(7_776_000)
      .default(2_592_000),
    BCRYPT_COST: z.coerce.number().int().min(10).max(15).default(12),
    AUTH_LOGIN_LIMIT: z.coerce.number().int().min(1).max(100).default(10),
    AUTH_LOGIN_WINDOW_SECONDS: z.coerce
      .number()
      .int()
      .min(10)
      .max(3600)
      .default(300),
    AUTH_REFRESH_LIMIT: z.coerce.number().int().min(1).max(300).default(60),
    AUTH_REFRESH_WINDOW_SECONDS: z.coerce
      .number()
      .int()
      .min(10)
      .max(3600)
      .default(300),
    CART_MAX_ITEM_QUANTITY: z.coerce.number().int().min(1).max(100),
    GUEST_CART_TTL_SECONDS: z.coerce.number().int().min(3600).max(7_776_000),
    CUSTOMER_CART_TTL_SECONDS: z.coerce
      .number()
      .int()
      .min(86_400)
      .max(31_536_000),
    CART_MUTATION_LIMIT: z.coerce.number().int().min(1).max(1000),
    CART_MUTATION_WINDOW_SECONDS: z.coerce.number().int().min(10).max(3600),
    CART_MERGE_LIMIT: z.coerce.number().int().min(1).max(300),
    CART_MERGE_WINDOW_SECONDS: z.coerce.number().int().min(10).max(3600),
    CHECKOUT_RESERVATION_TTL_SECONDS: z.coerce
      .number()
      .int()
      .min(60)
      .max(86_400),
    RESERVATION_WORKER_INTERVAL_MS: z.coerce
      .number()
      .int()
      .min(1_000)
      .max(300_000)
      .default(15_000),
    RESERVATION_WORKER_BATCH_SIZE: z.coerce
      .number()
      .int()
      .min(1)
      .max(500)
      .default(50),
    SHIPPING_FLAT_FEE_VND: z.coerce
      .number()
      .int()
      .min(0)
      .max(Number.MAX_SAFE_INTEGER),
    FREE_SHIPPING_THRESHOLD_VND: z
      .string()
      .default("")
      .transform((value, context) => {
        if (value === "") return null;
        const parsed = Number(value);
        if (!Number.isSafeInteger(parsed) || parsed < 0) {
          context.addIssue({
            code: "custom",
            message: "Free shipping threshold must be a non-negative integer.",
          });
          return z.NEVER;
        }
        return parsed;
      }),
    ORDER_LOOKUP_SECRET: z.string().min(32),
    CHECKOUT_LIMIT: z.coerce.number().int().min(1).max(300),
    CHECKOUT_WINDOW_SECONDS: z.coerce.number().int().min(10).max(3600),
    ORDER_LOOKUP_LIMIT: z.coerce.number().int().min(1).max(300),
    ORDER_LOOKUP_WINDOW_SECONDS: z.coerce.number().int().min(10).max(3600),
    PAYMENT_INITIATE_LIMIT: z.coerce.number().int().min(1).max(300).default(20),
    PAYMENT_INITIATE_GLOBAL_LIMIT: z.coerce
      .number()
      .int()
      .min(20)
      .max(5000)
      .default(100),
    PAYMENT_INITIATE_WINDOW_SECONDS: z.coerce
      .number()
      .int()
      .min(10)
      .max(3600)
      .default(300),
    PAYMENT_STATUS_LIMIT: z.coerce
      .number()
      .int()
      .min(100)
      .max(1000)
      .default(120),
    PAYMENT_STATUS_GLOBAL_LIMIT: z.coerce
      .number()
      .int()
      .min(120)
      .max(10_000)
      .default(600),
    PAYMENT_STATUS_WINDOW_SECONDS: z.coerce
      .number()
      .int()
      .min(60)
      .max(3600)
      .default(300),
    AI_ENABLED: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
    AI_SERVICE_URL: url.default("http://localhost:8000"),
    AI_GATEWAY_SHARED_SECRET: z.string().default(""),
    AI_TOOLS_SHARED_SECRET: z.string().default(""),
    AI_CONVERSATION_SECRET: z.string().default(""),
    AI_INTERNAL_REQUEST_TOLERANCE_SECONDS: z.coerce
      .number()
      .int()
      .min(30)
      .max(300)
      .default(60),
    AI_REQUEST_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .min(1_000)
      .max(25_000)
      .default(25_000),
    AI_CHAT_LIMIT: z.coerce.number().int().min(1).max(300).default(30),
    AI_CHAT_WINDOW_SECONDS: z.coerce
      .number()
      .int()
      .min(10)
      .max(3600)
      .default(300),
    AI_CONVERSATION_TTL_SECONDS: z.coerce
      .number()
      .int()
      .min(300)
      .max(86_400)
      .default(1_800),
    SEPAY_ENABLED: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
    SEPAY_BANK_NAME: z.string().trim().max(80).default(""),
    SEPAY_ACCOUNT_NUMBER: z.string().trim().max(80).default(""),
    SEPAY_ACCOUNT_HOLDER: z.string().trim().max(160).default(""),
    SEPAY_WEBHOOK_SECRET: z.string().default(""),
    SEPAY_WEBHOOK_TOLERANCE_SECONDS: z.coerce
      .number()
      .int()
      .min(30)
      .max(900)
      .default(300),
    SEPAY_PAYMENT_CODE_PREFIX: z
      .string()
      .trim()
      .regex(/^[A-Z][A-Z0-9]{1,9}$/)
      .default("FAR"),
    SEPAY_DEPOSIT_MODE: z
      .enum(["DISABLED", "FIXED", "PERCENTAGE"])
      .default("DISABLED"),
    SEPAY_DEPOSIT_FIXED_VND: z
      .string()
      .default("")
      .transform((value, context) => {
        if (value === "") return null;
        const parsed = Number(value);
        if (!Number.isSafeInteger(parsed) || parsed <= 0) {
          context.addIssue({
            code: "custom",
            message: "Fixed deposit must be a positive integer VND amount.",
          });
          return z.NEVER;
        }
        return parsed;
      }),
    SEPAY_DEPOSIT_BASIS_POINTS: z
      .string()
      .default("")
      .transform((value, context) => {
        if (value === "") return null;
        const parsed = Number(value);
        if (!Number.isInteger(parsed) || parsed < 1 || parsed > 9999) {
          context.addIssue({
            code: "custom",
            message: "Deposit basis points must be an integer from 1 to 9999.",
          });
          return z.NEVER;
        }
        return parsed;
      }),
    BOOTSTRAP_OWNER_EMAIL: z.string().default(""),
    BOOTSTRAP_OWNER_PASSWORD: z.string().default(""),
    BOOTSTRAP_OWNER_DISPLAY_NAME: z.string().default(""),
    GOOGLE_CLIENT_ID: z.string().default(""),
    GOOGLE_CLIENT_SECRET: z.string().default(""),
    APPLE_CLIENT_ID: z.string().default(""),
    APPLE_TEAM_ID: z.string().default(""),
    APPLE_KEY_ID: z.string().default(""),
    APPLE_PRIVATE_KEY: z.string().default(""),
    CLOUDINARY_CLOUD_NAME: z.string().default(""),
    CLOUDINARY_API_KEY: z.string().default(""),
    CLOUDINARY_API_SECRET: z.string().default(""),
    CLOUDINARY_UPLOAD_MAX_BYTES: z.coerce
      .number()
      .int()
      .min(1_024)
      .max(25_000_000)
      .default(10_000_000),
  })
  .superRefine((environment, context) => {
    const providerGroups = [
      {
        name: "Google",
        keys: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"] as const,
      },
      {
        name: "Apple",
        keys: [
          "APPLE_CLIENT_ID",
          "APPLE_TEAM_ID",
          "APPLE_KEY_ID",
          "APPLE_PRIVATE_KEY",
        ] as const,
      },
    ];
    for (const provider of providerGroups) {
      const configured = provider.keys.filter((key) => environment[key]);
      if (configured.length > 0 && configured.length !== provider.keys.length) {
        context.addIssue({
          code: "custom",
          path: [provider.keys[0]],
          message: `${provider.name} OAuth configuration must be complete or disabled.`,
        });
      }
    }
    const cloudinaryKeys = [
      "CLOUDINARY_CLOUD_NAME",
      "CLOUDINARY_API_KEY",
      "CLOUDINARY_API_SECRET",
    ] as const;
    const cloudinaryConfigured = cloudinaryKeys.filter(
      (key) => environment[key],
    );
    if (
      cloudinaryConfigured.length > 0 &&
      cloudinaryConfigured.length !== cloudinaryKeys.length
    ) {
      context.addIssue({
        code: "custom",
        path: ["CLOUDINARY_CLOUD_NAME"],
        message: "Cloudinary configuration must be complete or disabled.",
      });
    }

    if (environment.SEPAY_ENABLED) {
      for (const key of [
        "SEPAY_BANK_NAME",
        "SEPAY_ACCOUNT_NUMBER",
        "SEPAY_ACCOUNT_HOLDER",
      ] as const) {
        if (!environment[key]) {
          context.addIssue({
            code: "custom",
            path: [key],
            message: "SePay payment instructions require this value.",
          });
        }
      }
      if (environment.SEPAY_WEBHOOK_SECRET.length < 32) {
        context.addIssue({
          code: "custom",
          path: ["SEPAY_WEBHOOK_SECRET"],
          message: "SePay HMAC secret must contain at least 32 characters.",
        });
      }
    }
    if (
      environment.PAYMENT_INITIATE_GLOBAL_LIMIT <
      environment.PAYMENT_INITIATE_LIMIT
    ) {
      context.addIssue({
        code: "custom",
        path: ["PAYMENT_INITIATE_GLOBAL_LIMIT"],
        message: "Global payment initiation limit must cover one order limit.",
      });
    }
    if (
      environment.PAYMENT_STATUS_GLOBAL_LIMIT < environment.PAYMENT_STATUS_LIMIT
    ) {
      context.addIssue({
        code: "custom",
        path: ["PAYMENT_STATUS_GLOBAL_LIMIT"],
        message: "Global payment status limit must cover one order limit.",
      });
    }
    if (environment.AI_ENABLED) {
      for (const key of [
        "AI_GATEWAY_SHARED_SECRET",
        "AI_TOOLS_SHARED_SECRET",
        "AI_CONVERSATION_SECRET",
      ] as const) {
        if (environment[key].length < 32) {
          context.addIssue({
            code: "custom",
            path: [key],
            message: "AI service secrets must contain at least 32 characters.",
          });
        }
      }
    }
    if (
      environment.SEPAY_DEPOSIT_MODE === "FIXED" &&
      (environment.SEPAY_DEPOSIT_FIXED_VND === null ||
        environment.SEPAY_DEPOSIT_BASIS_POINTS !== null)
    ) {
      context.addIssue({
        code: "custom",
        path: ["SEPAY_DEPOSIT_FIXED_VND"],
        message: "Fixed deposit mode requires only a fixed VND amount.",
      });
    }
    if (
      environment.SEPAY_DEPOSIT_MODE === "PERCENTAGE" &&
      (environment.SEPAY_DEPOSIT_BASIS_POINTS === null ||
        environment.SEPAY_DEPOSIT_FIXED_VND !== null)
    ) {
      context.addIssue({
        code: "custom",
        path: ["SEPAY_DEPOSIT_BASIS_POINTS"],
        message: "Percentage deposit mode requires only basis points.",
      });
    }
    if (
      environment.SEPAY_DEPOSIT_MODE !== "DISABLED" &&
      !environment.SEPAY_ENABLED
    ) {
      context.addIssue({
        code: "custom",
        path: ["SEPAY_DEPOSIT_MODE"],
        message: "Deposit payments require SePay to be enabled.",
      });
    }

    if (!isDeployedEnvironment(environment.APP_ENV)) return;
    for (const key of ["APP_ORIGIN", "ADMIN_ORIGIN", "API_ORIGIN"] as const) {
      if (new URL(environment[key]).protocol !== "https:") {
        context.addIssue({
          code: "custom",
          path: [key],
          message: "Deployed-environment origins must use HTTPS.",
        });
      }
    }
    if (
      environment.AI_ENABLED &&
      new URL(environment.AI_SERVICE_URL).protocol !== "https:"
    ) {
      context.addIssue({
        code: "custom",
        path: ["AI_SERVICE_URL"],
        message: "Deployed AI service URL must use HTTPS.",
      });
    }
    for (const key of [
      "JWT_ACCESS_SECRET",
      "JWT_REFRESH_SECRET",
      "CSRF_SECRET",
      "CART_CREDENTIAL_SECRET",
      "ORDER_LOOKUP_SECRET",
      "SEPAY_WEBHOOK_SECRET",
      "AI_GATEWAY_SHARED_SECRET",
      "AI_TOOLS_SHARED_SECRET",
      "AI_CONVERSATION_SECRET",
    ] as const) {
      if (
        environment[key] &&
        environment[key].toLowerCase().includes("replace")
      ) {
        context.addIssue({
          code: "custom",
          path: [key],
          message: "Deployed-environment secrets cannot be placeholders.",
        });
      }
    }
    for (const key of [
      "BOOTSTRAP_OWNER_EMAIL",
      "BOOTSTRAP_OWNER_PASSWORD",
      "BOOTSTRAP_OWNER_DISPLAY_NAME",
    ] as const) {
      if (environment[key]) {
        context.addIssue({
          code: "custom",
          path: [key],
          message:
            "Development bootstrap values are forbidden in deployed environments.",
        });
      }
    }
  });

export type Environment = z.infer<typeof environmentSchema>;

export function validateEnvironment(
  input: Record<string, unknown>,
): Environment {
  const result = environmentSchema.safeParse(input);
  if (!result.success) {
    const fields = result.error.issues
      .map((issue) => issue.path.join(".") || "environment")
      .join(", ");
    throw new Error(`Invalid environment configuration: ${fields}`);
  }
  return result.data;
}
