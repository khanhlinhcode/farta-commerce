import { z } from "zod";

const url = z.url();

const environmentSchema = z
  .object({
    APP_ENV: z
      .enum(["development", "test", "staging", "production"])
      .default("development"),
    PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
    APP_ORIGIN: url,
    ADMIN_ORIGIN: url,
    API_ORIGIN: url,
    MONGODB_URI: z.string().min(1),
    REDIS_URL: url,
    JWT_ACCESS_SECRET: z.string().min(32),
    JWT_REFRESH_SECRET: z.string().min(32),
    CSRF_SECRET: z.string().min(32),
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

    if (environment.APP_ENV !== "production") return;
    for (const key of ["APP_ORIGIN", "ADMIN_ORIGIN", "API_ORIGIN"] as const) {
      if (!environment[key].startsWith("https://")) {
        context.addIssue({
          code: "custom",
          path: [key],
          message: "Production origins must use HTTPS.",
        });
      }
    }
    for (const key of [
      "JWT_ACCESS_SECRET",
      "JWT_REFRESH_SECRET",
      "CSRF_SECRET",
    ] as const) {
      if (environment[key].toLowerCase().includes("replace")) {
        context.addIssue({
          code: "custom",
          path: [key],
          message: "Production secrets cannot be placeholders.",
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
          message: "Development bootstrap values are forbidden in production.",
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
