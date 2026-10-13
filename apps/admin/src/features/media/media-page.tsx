import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UploadCloud } from "lucide-react";
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
  const upload = useMutation({
    mutationFn: () => {
      if (!file) throw new ApiFailure("MEDIA_REQUIRED", "Chọn một ảnh.", 400);
      return adminApi.uploadMedia(file, alt);
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
            Ảnh
            <input
              accept="image/jpeg,image/png,image/webp,image/avif"
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
            {upload.isPending ? "Đang tải…" : "Tải ảnh"}
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
            <img alt={item.altText ?? ""} src={item.secureUrl} />
            <div>
              <strong>{item.altText ?? "Chưa có alt text"}</strong>
              <span>
                {item.width} × {item.height}
              </span>
            </div>
          </Surface>
        ))}
      </section>
    </>
  );
}
