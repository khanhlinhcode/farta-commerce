import { z } from "zod";

export const categorySchema = z.object({
  name: z.string().trim().min(1, "Nhập tên danh mục."),
  status: z.enum(["DRAFT", "ACTIVE", "INACTIVE"]),
  parentCategoryId: z.string().optional(),
});

export type CategoryInput = z.infer<typeof categorySchema>;
