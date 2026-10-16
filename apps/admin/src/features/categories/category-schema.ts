import { z } from "zod";

export const categorySchema = z.object({
  name: z.string().trim().min(1, "Nhập tên danh mục."),
  status: z.enum(["DRAFT", "ACTIVE", "INACTIVE"]),
  parentCategoryId: z.string().optional(),
  description: z.string().trim().max(2_000).optional(),
  imageMediaId: z.string().optional(),
  sortOrder: z.number().int().min(-10_000).max(10_000),
});

export type CategoryInput = z.infer<typeof categorySchema>;
