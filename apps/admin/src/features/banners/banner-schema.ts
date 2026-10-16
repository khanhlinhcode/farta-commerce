import { z } from "zod";

export const bannerSchema = z
  .object({
    title: z.string().trim().min(1, "Nhập tiêu đề banner.").max(160),
    subtitle: z.string().trim().max(500).optional(),
    desktopMediaId: z.string().min(1, "Chọn desktop media."),
    mobileMediaId: z.string().optional(),
    desktopVideoMediaId: z.string().optional(),
    mobileVideoMediaId: z.string().optional(),
    ctaLabel: z.string().trim().max(80).optional(),
    ctaTarget: z
      .string()
      .trim()
      .max(500)
      .refine(
        (value) => !value || (value.startsWith("/") && !value.startsWith("//")),
        "CTA phải là đường dẫn nội bộ bắt đầu bằng /.",
      )
      .optional(),
    position: z.string().trim().min(1).max(80),
    priority: z.number().int().min(0).max(100_000),
    startAt: z.string().optional(),
    endAt: z.string().optional(),
    status: z.enum(["DRAFT", "ACTIVE", "INACTIVE"]),
  })
  .refine(
    (value) =>
      !value.startAt ||
      !value.endAt ||
      new Date(value.endAt).getTime() > new Date(value.startAt).getTime(),
    {
      message: "Thời gian kết thúc phải sau thời gian bắt đầu.",
      path: ["endAt"],
    },
  );

export type BannerInput = z.infer<typeof bannerSchema>;
