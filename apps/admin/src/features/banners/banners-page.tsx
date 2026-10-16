import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, Pencil, Plus, X } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Button, Surface } from "@farta/ui";

import { MediaPicker } from "../../components/media-picker";
import {
  ConfirmationDialog,
  PageHeader,
  QueryState,
  Status,
} from "../../components/page";
import { adminApi, type Banner, type MediaAsset } from "../../lib/api";
import { errorMessage } from "../../lib/errors";
import { useStaff } from "../../lib/staff-context";
import { bannerSchema, type BannerInput } from "./banner-schema";

export function BannersPage() {
  const queryClient = useQueryClient();
  const staff = useStaff();
  const canCreate = staff.permissions.includes("banner.create");
  const canUpdate = staff.permissions.includes("banner.update");
  const canArchive = staff.permissions.includes("banner.archive");
  const canPublish = staff.permissions.includes("banner.publish");
  const [editing, setEditing] = useState<Banner | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<Banner | null>(null);
  const [previews, setPreviews] = useState<{
    desktopPoster: MediaAsset | undefined;
    mobilePoster: MediaAsset | undefined;
    desktopVideo: MediaAsset | undefined;
    mobileVideo: MediaAsset | undefined;
  }>(emptyPreviews());
  const banners = useQuery({
    queryKey: ["banners"],
    queryFn: adminApi.banners,
  });
  const form = useForm<BannerInput>({
    resolver: zodResolver(bannerSchema),
    defaultValues: defaultBannerValues(),
  });
  const save = useMutation({
    mutationFn: (value: BannerInput) => {
      const input = {
        title: value.title,
        subtitle: value.subtitle || null,
        desktopMediaId: value.desktopMediaId,
        mobileMediaId: value.mobileMediaId || null,
        desktopVideoMediaId: value.desktopVideoMediaId || null,
        mobileVideoMediaId: value.mobileVideoMediaId || null,
        ctaLabel: value.ctaLabel || null,
        ctaTarget: value.ctaTarget || null,
        position: value.position,
        priority: value.priority,
        startAt: value.startAt ? new Date(value.startAt).toISOString() : null,
        endAt: value.endAt ? new Date(value.endAt).toISOString() : null,
        status: value.status,
      };
      const { status: _status, ...inputWithoutStatus } = input;
      void _status;
      return editing
        ? adminApi.updateBanner(
            editing.id,
            !canPublish && editing.status === "ACTIVE"
              ? inputWithoutStatus
              : input,
          )
        : adminApi.createBanner(input);
    },
    onSuccess: async () => {
      setEditing(null);
      setPreviews(emptyPreviews());
      form.reset(defaultBannerValues());
      await queryClient.invalidateQueries({ queryKey: ["banners"] });
    },
  });
  const archive = useMutation({
    mutationFn: (bannerId: string) => adminApi.archiveBanner(bannerId),
    onSuccess: async () => {
      setArchiveTarget(null);
      await queryClient.invalidateQueries({ queryKey: ["banners"] });
    },
  });
  function edit(item: Banner) {
    setEditing(item);
    setPreviews({
      desktopPoster: item.desktopMedia ?? undefined,
      mobilePoster: item.mobileMedia ?? undefined,
      desktopVideo: item.desktopVideo ?? undefined,
      mobileVideo: item.mobileVideo ?? undefined,
    });
    form.reset({
      title: item.title,
      subtitle: item.subtitle ?? "",
      desktopMediaId: item.desktopMedia?.id ?? "",
      mobileMediaId: item.mobileMedia?.id ?? "",
      desktopVideoMediaId: item.desktopVideo?.id ?? "",
      mobileVideoMediaId: item.mobileVideo?.id ?? "",
      ctaLabel: item.ctaLabel ?? "",
      ctaTarget: item.ctaTarget ?? "",
      position: item.position,
      priority: item.priority,
      startAt: dateTimeLocal(item.startAt),
      endAt: dateTimeLocal(item.endAt),
      status: item.status as BannerInput["status"],
    });
  }

  return (
    <>
      <PageHeader
        eyebrow="Content"
        title="Banner CMS"
        description="Campaign có media reference, safe internal CTA, lịch hiển thị và priority."
      />
      <Surface className="panel">
        <div className="panel-heading">
          <h2>{editing ? "Chỉnh sửa campaign" : "Tạo campaign"}</h2>
          {editing && (
            <button
              aria-label="Hủy chỉnh sửa banner"
              className="icon-button"
              onClick={() => {
                setEditing(null);
                setPreviews(emptyPreviews());
                form.reset(defaultBannerValues());
              }}
              type="button"
            >
              <X aria-hidden="true" size={18} />
            </button>
          )}
        </div>
        <form
          className="inline-form"
          onSubmit={form.handleSubmit((value) => save.mutate(value))}
        >
          <label htmlFor="banner-title">
            Tiêu đề
            <input
              aria-describedby={
                form.formState.errors.title ? "banner-title-error" : undefined
              }
              aria-invalid={Boolean(form.formState.errors.title)}
              id="banner-title"
              {...form.register("title")}
            />
          </label>
          <MediaPicker
            describedBy={
              form.formState.errors.desktopMediaId
                ? "banner-desktop-media-error"
                : undefined
            }
            emptyLabel="Chọn media"
            id="banner-desktop-media"
            invalid={Boolean(form.formState.errors.desktopMediaId)}
            label="Desktop media"
            onChange={(value, asset) => {
              form.setValue("desktopMediaId", value, { shouldDirty: true });
              setPreviews((current) => ({
                ...current,
                desktopPoster: asset,
              }));
            }}
            resourceType="image"
            value={form.watch("desktopMediaId")}
          />
          <MediaPicker
            emptyLabel="Dùng desktop poster"
            id="banner-mobile-media"
            label="Mobile poster"
            onChange={(value, asset) => {
              form.setValue("mobileMediaId", value, { shouldDirty: true });
              setPreviews((current) => ({ ...current, mobilePoster: asset }));
            }}
            resourceType="image"
            value={form.watch("mobileMediaId") ?? ""}
          />
          <MediaPicker
            emptyLabel="Không dùng video"
            id="banner-desktop-video"
            label="Desktop video"
            onChange={(value, asset) => {
              form.setValue("desktopVideoMediaId", value, {
                shouldDirty: true,
              });
              setPreviews((current) => ({
                ...current,
                desktopVideo: asset,
              }));
            }}
            resourceType="video"
            value={form.watch("desktopVideoMediaId") ?? ""}
          />
          <MediaPicker
            emptyLabel="Dùng desktop video"
            id="banner-mobile-video"
            label="Mobile video"
            onChange={(value, asset) => {
              form.setValue("mobileVideoMediaId", value, {
                shouldDirty: true,
              });
              setPreviews((current) => ({ ...current, mobileVideo: asset }));
            }}
            resourceType="video"
            value={form.watch("mobileVideoMediaId") ?? ""}
          />
          <label htmlFor="banner-subtitle">
            Mô tả
            <input id="banner-subtitle" {...form.register("subtitle")} />
          </label>
          <label htmlFor="banner-cta-label">
            CTA label
            <input id="banner-cta-label" {...form.register("ctaLabel")} />
          </label>
          <label htmlFor="banner-cta-target">
            CTA nội bộ
            <input
              aria-describedby={
                form.formState.errors.ctaTarget
                  ? "banner-cta-target-error"
                  : undefined
              }
              aria-invalid={Boolean(form.formState.errors.ctaTarget)}
              id="banner-cta-target"
              placeholder="/shop"
              {...form.register("ctaTarget")}
            />
          </label>
          <label htmlFor="banner-position">
            Vị trí
            <input id="banner-position" {...form.register("position")} />
          </label>
          <label htmlFor="banner-priority">
            Priority
            <input
              id="banner-priority"
              inputMode="numeric"
              type="number"
              {...form.register("priority", { valueAsNumber: true })}
            />
          </label>
          <label htmlFor="banner-start-at">
            Bắt đầu
            <input
              id="banner-start-at"
              type="datetime-local"
              {...form.register("startAt")}
            />
          </label>
          <label htmlFor="banner-end-at">
            Kết thúc
            <input
              aria-describedby={
                form.formState.errors.endAt ? "banner-end-at-error" : undefined
              }
              aria-invalid={Boolean(form.formState.errors.endAt)}
              id="banner-end-at"
              type="datetime-local"
              {...form.register("endAt")}
            />
          </label>
          <label htmlFor="banner-status">
            Trạng thái
            <select id="banner-status" {...form.register("status")}>
              <option value="DRAFT">Draft</option>
              <option disabled={!canPublish} value="ACTIVE">
                Active
              </option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </label>
          <Button
            disabled={save.isPending || (editing ? !canUpdate : !canCreate)}
            type="submit"
          >
            <Plus aria-hidden="true" size={17} strokeWidth={1.7} />
            {editing ? "Lưu campaign" : "Tạo campaign"}
          </Button>
        </form>
        {form.formState.errors.title && (
          <p className="field-error" id="banner-title-error">
            {form.formState.errors.title.message}
          </p>
        )}
        {form.formState.errors.desktopMediaId && (
          <p className="field-error" id="banner-desktop-media-error">
            {form.formState.errors.desktopMediaId.message}
          </p>
        )}
        {form.formState.errors.ctaTarget && (
          <p className="field-error" id="banner-cta-target-error">
            {form.formState.errors.ctaTarget.message}
          </p>
        )}
        {form.formState.errors.endAt && (
          <p className="field-error" id="banner-end-at-error">
            {form.formState.errors.endAt.message}
          </p>
        )}
        {save.error && (
          <p role="alert" className="form-error">
            {errorMessage(save.error)}
          </p>
        )}
      </Surface>
      <section className="banner-preview-grid" aria-label="Xem trước campaign">
        <Surface className="panel banner-preview banner-preview-desktop">
          <h2>Desktop preview</h2>
          <BannerMediaPreview
            video={previews.desktopVideo}
            poster={previews.desktopPoster}
          />
        </Surface>
        <Surface className="panel banner-preview banner-preview-mobile">
          <h2>Mobile preview</h2>
          <BannerMediaPreview
            video={previews.mobileVideo ?? previews.desktopVideo}
            poster={previews.mobilePoster ?? previews.desktopPoster}
          />
        </Surface>
      </section>
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
                <th>Thao tác</th>
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
                  <td>
                    <div className="table-actions">
                      {canUpdate && (
                        <button onClick={() => edit(item)} type="button">
                          <Pencil aria-hidden="true" size={15} /> Sửa
                        </button>
                      )}
                      {canArchive && item.status !== "ARCHIVED" && (
                        <button
                          onClick={() => setArchiveTarget(item)}
                          type="button"
                        >
                          <Archive aria-hidden="true" size={15} /> Lưu trữ
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Surface>
      {archiveTarget && (
        <ConfirmationDialog
          confirmLabel="Xác nhận lưu trữ"
          error={archive.error}
          onCancel={() => setArchiveTarget(null)}
          onConfirm={() => archive.mutate(archiveTarget.id)}
          pending={archive.isPending}
          title={`Lưu trữ ${archiveTarget.title}?`}
        >
          <p>Campaign sẽ không còn xuất hiện trên storefront.</p>
        </ConfirmationDialog>
      )}
    </>
  );
}

function defaultBannerValues(): BannerInput {
  return {
    title: "",
    subtitle: "",
    desktopMediaId: "",
    mobileMediaId: "",
    desktopVideoMediaId: "",
    mobileVideoMediaId: "",
    ctaLabel: "",
    ctaTarget: "/shop",
    position: "home-hero",
    priority: 0,
    startAt: "",
    endAt: "",
    status: "DRAFT",
  };
}

function emptyPreviews() {
  return {
    desktopPoster: undefined,
    mobilePoster: undefined,
    desktopVideo: undefined,
    mobileVideo: undefined,
  } satisfies Record<string, MediaAsset | undefined>;
}

function dateTimeLocal(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function BannerMediaPreview({
  video,
  poster,
}: {
  video: MediaAsset | undefined;
  poster: MediaAsset | undefined;
}) {
  if (video) {
    return (
      <video
        aria-label={video.altText ?? "Campaign video preview"}
        controls
        muted
        playsInline
        poster={poster?.secureUrl}
        preload="metadata"
        src={video.secureUrl}
      />
    );
  }
  if (poster)
    return (
      <img alt={poster.altText ?? "Campaign preview"} src={poster.secureUrl} />
    );
  return <p className="state-card">Chọn media để xem trước campaign.</p>;
}
