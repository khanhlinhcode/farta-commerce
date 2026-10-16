import { z } from "zod";

export const productSchema = z.object({
  name: z.string().trim().min(1, "Nhập tên sản phẩm."),
  categoryIds: z.array(z.string()).min(1, "Chọn ít nhất một danh mục."),
  coverMediaId: z.string().optional(),
  shortDescription: z.string().trim().max(500).optional(),
  description: z.string().trim().max(10_000).optional(),
  tags: z.string().max(500).optional(),
  seoTitle: z.string().trim().max(70).optional(),
  seoDescription: z.string().trim().max(160).optional(),
  status: z.enum(["DRAFT", "ACTIVE", "INACTIVE"]),
});

export type ProductInput = z.infer<typeof productSchema>;
