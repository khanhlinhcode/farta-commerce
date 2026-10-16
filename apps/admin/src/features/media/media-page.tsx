import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Film, Image as ImageIcon, UploadCloud } from "lucide-react";
import { useState } from "react";

import { Button, Surface } from "@farta/ui";

import { PageHeader, QueryState } from "../../components/page";
import { adminApi, ApiFailure } from "../../lib/api";
import { errorMessage } from "../../lib/errors";

export function MediaPage() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["media"], queryFn: adminApi.media });
  const [file, setFile] = useState<File | null>(null);
  const [alt, setAlt] = useState("");
  const [resourceType, setResourceType] = useState<"image" | "video">("image");
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
          <label>
            Loại media
            <select
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
          <label>
            Tệp {resourceType === "video" ? "video" : "ảnh"}
            <input
              accept={
                resourceType === "video"
                  ? "video/mp4,video/webm"
                  : "image/jpeg,image/png,image/webp,image/avif"
              }
              key={resourceType}
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              type="file"
            />
          </label>
          <label>
            Alt text
            <input
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
            </div>
          </Surface>
        ))}
      </section>
    </>
  );
}
