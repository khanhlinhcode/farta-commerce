import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useForm } from "react-hook-form";

import { Button, Surface } from "@farta/ui";

import { PageHeader, QueryState, Status } from "../../components/page";
import { adminApi } from "../../lib/api";
import { errorMessage } from "../../lib/errors";
import { bannerSchema, type BannerInput } from "./banner-schema";

export function BannersPage() {
  const queryClient = useQueryClient();
  const banners = useQuery({
    queryKey: ["banners"],
    queryFn: adminApi.banners,
  });
  const media = useQuery({ queryKey: ["media"], queryFn: adminApi.media });
  const form = useForm<BannerInput>({
    resolver: zodResolver(bannerSchema),
    defaultValues: { title: "", desktopMediaId: "" },
  });
  const create = useMutation({
    mutationFn: (value: BannerInput) =>
      adminApi.createBanner({
        title: value.title,
        desktopMediaId: value.desktopMediaId,
        mobileMediaId: value.mobileMediaId || null,
        desktopVideoMediaId: value.desktopVideoMediaId || null,
        mobileVideoMediaId: value.mobileVideoMediaId || null,
        position: "home-hero",
        ctaTarget: "/shop",
        status: "DRAFT",
      }),
    onSuccess: async () => {
      form.reset();
      await queryClient.invalidateQueries({ queryKey: ["banners"] });
    },
  });
  const imageMedia = media.data?.items.filter(
    (item) => item.resourceType === "image",
  );
  const videoMedia = media.data?.items.filter(
    (item) => item.resourceType === "video",
  );
  return (
    <>
      <PageHeader
        eyebrow="Content"
        title="Banner CMS"
        description="Campaign có media reference, safe internal CTA, lịch hiển thị và priority."
      />
      <Surface className="panel">
        <form
          className="inline-form"
          onSubmit={form.handleSubmit((value) => create.mutate(value))}
        >
          <label>
            Tiêu đề
            <input {...form.register("title")} />
          </label>
          <label>
            Desktop media
            <select {...form.register("desktopMediaId")}>
              <option value="">Chọn media</option>
              {imageMedia?.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.altText ?? item.publicId}
                </option>
              ))}
            </select>
          </label>
          <label>
            Mobile poster
            <select {...form.register("mobileMediaId")}>
              <option value="">Dùng desktop poster</option>
              {imageMedia?.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.altText ?? item.publicId}
                </option>
              ))}
            </select>
          </label>
          <label>
            Desktop video
            <select {...form.register("desktopVideoMediaId")}>
              <option value="">Không dùng video</option>
              {videoMedia?.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.altText ?? item.publicId}
                </option>
              ))}
            </select>
          </label>
          <label>
            Mobile video
            <select {...form.register("mobileVideoMediaId")}>
              <option value="">Dùng desktop video</option>
              {videoMedia?.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.altText ?? item.publicId}
                </option>
              ))}
            </select>
          </label>
          <Button disabled={create.isPending} type="submit">
            <Plus aria-hidden="true" size={17} strokeWidth={1.7} />
            Tạo draft banner
          </Button>
        </form>
        {Object.values(form.formState.errors).map((error) => (
          <p className="field-error" key={error.message}>
            {error.message}
          </p>
        ))}
        {create.error && (
          <p role="alert" className="form-error">
            {errorMessage(create.error)}
          </p>
        )}
      </Surface>
      <Surface className="panel table-panel">
        <QueryState pending={banners.isPending} error={banners.error} />
        {banners.data && (
          <table>
            <thead>
              <tr>
                <th>Campaign</th>
                <th>Vị trí</th>
                <th>CTA</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {banners.data.items.map((item) => (
                <tr key={item.id}>
                  <td>{item.title}</td>
                  <td>{item.position}</td>
                  <td>{item.ctaTarget ?? "—"}</td>
                  <td>
                    <Status value={item.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Surface>
    </>
  );
}
