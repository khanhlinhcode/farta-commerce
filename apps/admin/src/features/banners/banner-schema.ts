import { z } from "zod";

export const bannerSchema = z.object({
  title: z.string().trim().min(1, "Nhập tiêu đề banner.").max(160),
  desktopMediaId: z.string().min(1, "Chọn desktop media."),
  mobileMediaId: z.string().optional(),
  desktopVideoMediaId: z.string().optional(),
  mobileVideoMediaId: z.string().optional(),
});

export type BannerInput = z.infer<typeof bannerSchema>;
