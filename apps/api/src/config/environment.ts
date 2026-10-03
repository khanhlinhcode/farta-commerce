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
    JWT_ISSUER: z.string().min(1),
    JWT_CUSTOMER_AUDIENCE: z.string().min(1),
    JWT_STAFF_AUDIENCE: z.string().min(1),
    GOOGLE_CLIENT_ID: z.string().default(""),
    GOOGLE_CLIENT_SECRET: z.string().default(""),
    APPLE_CLIENT_ID: z.string().default(""),
    APPLE_TEAM_ID: z.string().default(""),
    APPLE_KEY_ID: z.string().default(""),
    APPLE_PRIVATE_KEY: z.string().default(""),
    CLOUDINARY_CLOUD_NAME: z.string().default(""),
    CLOUDINARY_API_KEY: z.string().default(""),
    CLOUDINARY_API_SECRET: z.string().default(""),
  })
  .superRefine((environment, context) => {
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
    for (const key of ["JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET"] as const) {
      if (environment[key].toLowerCase().includes("replace")) {
        context.addIssue({
          code: "custom",
          path: [key],
          message: "Production secrets cannot be placeholders.",
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
