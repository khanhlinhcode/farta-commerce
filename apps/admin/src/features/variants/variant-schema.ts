import { z } from "zod";

export const variantSchema = z
  .object({
    sku: z.string().trim().min(2, "SKU cần ít nhất 2 ký tự."),
    color: z.string().trim().min(1, "Nhập màu."),
    size: z.string().trim().min(1, "Nhập size."),
    price: z
      .number()
      .int("Giá phải là số nguyên.")
      .nonnegative("Giá không được âm."),
    compareAtPrice: z.number().int().nonnegative().optional(),
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
