import { z } from "zod";

export const productSchema = z.object({
  name: z.string().trim().min(1, "Nhập tên sản phẩm."),
  categoryId: z.string().min(1, "Chọn danh mục."),
  coverMediaId: z.string().optional(),
});

export type ProductInput = z.infer<typeof productSchema>;
