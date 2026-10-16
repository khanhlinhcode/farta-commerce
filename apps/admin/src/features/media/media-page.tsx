import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, Film, Image as ImageIcon, UploadCloud } from "lucide-react";
import { useState } from "react";

import { Button, Surface } from "@farta/ui";

import { PageHeader, QueryState } from "../../components/page";
import { adminApi, ApiFailure } from "../../lib/api";
import { errorMessage } from "../../lib/errors";

export function MediaPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [alt, setAlt] = useState("");
  const [resourceType, setResourceType] = useState<"image" | "video">("image");
  const [filter, setFilter] = useState<"all" | "image" | "video">("all");
  const [archiveTarget, setArchiveTarget] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ["media", page, filter],
    queryFn: () =>
      adminApi.media({
        page,
        ...(filter === "all" ? {} : { resourceType: filter }),
      }),
  });
  const upload = useMutation({
    mutationFn: () => {
      if (!file)
        throw new ApiFailure("MEDIA_REQUIRED", "Chọn một tệp media.", 400);
      return adminApi.uploadMedia(file, alt, resourceType);
    },
    onSuccess: async () => {
      setFile(null);
      setAlt("");
      await queryClient.invalidateQueries({ queryKey: ["media"] });
    },
  });
  const archive = useMutation({
    mutationFn: (mediaId: string) => adminApi.archiveMedia(mediaId),
    onSuccess: async () => {
      setArchiveTarget(null);
      await queryClient.invalidateQueries({ queryKey: ["media"] });
    },
  });
  return (
    <>
      <PageHeader
        eyebrow="Cloudinary"
        title="Media manager"
        description="Signed upload ngắn hạn; API xác minh response signature trước khi ghi asset."
      />
      <Surface className="panel">
        <form
          className="inline-form"
          onSubmit={(event) => {
            event.preventDefault();
            upload.mutate();
          }}
        >
          <label htmlFor="media-resource-type">
            Loại media
            <select
              id="media-resource-type"
              onChange={(event) => {
                setResourceType(event.target.value as "image" | "video");
                setFile(null);
              }}
              value={resourceType}
            >
              <option value="image">Ảnh</option>
              <option value="video">Video campaign</option>
            </select>
          </label>
          <label htmlFor="media-file">
            Tệp {resourceType === "video" ? "video" : "ảnh"}
            <input
              accept={
                resourceType === "video"
                  ? "video/mp4,video/webm"
                  : "image/jpeg,image/png,image/webp,image/avif"
              }
              id="media-file"
              key={resourceType}
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              type="file"
            />
          </label>
          <label htmlFor="media-alt-text">
            Alt text
            <input
              id="media-alt-text"
              onChange={(event) => setAlt(event.target.value)}
              value={alt}
            />
          </label>
          <Button disabled={upload.isPending || !file} type="submit">
            <UploadCloud aria-hidden="true" size={17} strokeWidth={1.7} />
            {upload.isPending ? "Đang tải…" : "Tải media"}
          </Button>
        </form>
        {upload.error && (
          <p role="alert" className="form-error">
            {errorMessage(upload.error)}
          </p>
        )}
      </Surface>
      <label className="admin-filter-control" htmlFor="media-library-filter">
        Lọc thư viện
        <select
          id="media-library-filter"
          onChange={(event) => {
            setPage(1);
            setFilter(event.target.value as "all" | "image" | "video");
          }}
          value={filter}
        >
          <option value="all">Tất cả</option>
          <option value="image">Ảnh</option>
          <option value="video">Video</option>
        </select>
      </label>
      <QueryState pending={query.isPending} error={query.error} />
      <section className="media-grid">
        {query.data?.items.map((item) => (
          <Surface className="media-card" key={item.id}>
            {item.resourceType === "video" ? (
              <video
                aria-label={item.altText ?? "Video campaign"}
                controls
                muted
                playsInline
                preload="metadata"
                src={item.secureUrl}
              />
            ) : (
              <img alt={item.altText ?? ""} src={item.secureUrl} />
            )}
            <div>
              <strong>{item.altText ?? "Chưa có mô tả media"}</strong>
              <span>
                {item.resourceType === "video" ? (
                  <Film aria-hidden="true" size={15} />
                ) : (
                  <ImageIcon aria-hidden="true" size={15} />
                )}
                {item.width} × {item.height} · {item.format.toUpperCase()}
              </span>
              {archiveTarget === item.id ? (
                <div className="inline-editor">
                  <span>Lưu trữ media này?</span>
                  <Button
                    disabled={archive.isPending}
                    onClick={() => archive.mutate(item.id)}
                  >
                    Xác nhận
                  </Button>
                  <button onClick={() => setArchiveTarget(null)} type="button">
                    Hủy
                  </button>
                </div>
              ) : (
                <button onClick={() => setArchiveTarget(item.id)} type="button">
                  <Archive aria-hidden="true" size={15} /> Lưu trữ
                </button>
              )}
              {archiveTarget === item.id && archive.error && (
                <p className="form-error" role="alert">
                  {errorMessage(archive.error)}
                </p>
              )}
            </div>
          </Surface>
        ))}
      </section>
      {query.data && (
        <div className="pagination-controls">
          <button
            disabled={page <= 1}
            onClick={() => setPage((value) => Math.max(1, value - 1))}
            type="button"
          >
            Trang trước
          </button>
          <span>
            Trang {page}/
            {Math.max(1, Math.ceil(query.data.total / query.data.limit))}
          </span>
          <button
            disabled={page * query.data.limit >= query.data.total}
            onClick={() => setPage((value) => value + 1)}
            type="button"
          >
            Trang sau
          </button>
        </div>
      )}
    </>
  );
}
