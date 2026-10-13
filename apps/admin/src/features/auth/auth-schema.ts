import { z } from "zod";

export const loginSchema = z.object({
  email: z.email("Email không hợp lệ."),
  password: z.string().min(8, "Mật khẩu cần ít nhất 8 ký tự."),
});

export type LoginInput = z.infer<typeof loginSchema>;
