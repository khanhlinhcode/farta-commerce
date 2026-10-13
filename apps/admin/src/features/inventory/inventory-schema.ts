import { z } from "zod";

export const inventoryAdjustmentSchema = z.object({
  quantityDelta: z
    .number()
    .int("Số lượng phải là số nguyên.")
    .refine((value) => value !== 0, "Số lượng điều chỉnh không được bằng 0."),
  reason: z.string().trim().min(8, "Lý do cần ít nhất 8 ký tự.").max(500),
});
