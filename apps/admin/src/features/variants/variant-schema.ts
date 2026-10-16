import { z } from "zod";

export const variantSchema = z
  .object({
    sku: z.string().trim().min(2, "SKU cần ít nhất 2 ký tự."),
    color: z.string().trim().min(1, "Nhập màu."),
    colorCode: z.string().trim().max(20).optional(),
    size: z.string().trim().min(1, "Nhập size."),
    price: z
      .number()
      .int("Giá phải là số nguyên.")
      .nonnegative("Giá không được âm."),
    compareAtPrice: z.number().int().nonnegative().optional(),
    mediaId: z.string().optional(),
    lowStockThreshold: z.number().int().nonnegative().max(1_000_000),
  })
  .refine(
    (value) =>
      value.compareAtPrice === undefined || value.compareAtPrice > value.price,
    {
      path: ["compareAtPrice"],
      message: "Giá so sánh phải lớn hơn giá bán.",
    },
  );

export type VariantInput = z.infer<typeof variantSchema>;
