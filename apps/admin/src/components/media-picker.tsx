import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { adminApi, type MediaAsset } from "../lib/api";
import { QueryState } from "./page";

export function MediaPicker({
  id,
  label,
  resourceType,
  value,
  emptyLabel,
  invalid = false,
  describedBy,
  onChange,
}: {
  id: string;
  label: string;
  resourceType: "image" | "video";
  value: string;
  emptyLabel: string;
  invalid?: boolean | undefined;
  describedBy?: string | undefined;
  onChange: (value: string, asset?: MediaAsset) => void;
}) {
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ["media", "picker", resourceType, page],
    queryFn: () => adminApi.media({ page, limit: 12, resourceType }),
  });
  const selectedIsOutsidePage =
    Boolean(value) && !query.data?.items.some((item) => item.id === value);
  const pages = Math.max(
    1,
    Math.ceil((query.data?.total ?? 0) / (query.data?.limit ?? 12)),
  );

  return (
    <div className="media-picker">
      <label htmlFor={id}>{label}</label>
      <select
        aria-describedby={describedBy}
        aria-invalid={invalid}
        id={id}
        onChange={(event) => {
          const next = event.target.value;
          onChange(
            next,
            query.data?.items.find((item) => item.id === next),
          );
        }}
        value={value}
      >
        <option value="">{emptyLabel}</option>
        {selectedIsOutsidePage && <option value={value}>Media đã chọn</option>}
        {query.data?.items.map((item) => (
          <option key={item.id} value={item.id}>
            {item.altText ?? item.publicId} · {item.width}×{item.height}
          </option>
        ))}
      </select>
      <QueryState pending={query.isPending} error={query.error} />
      {query.data && pages > 1 && (
        <div className="media-picker-pagination" aria-label={`${label} pages`}>
          <button
            aria-label={`${label}: trang trước`}
            disabled={page <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            type="button"
          >
            Trước
          </button>
          <span>
            {page}/{pages}
          </span>
          <button
            aria-label={`${label}: trang sau`}
            disabled={page >= pages}
            onClick={() => setPage((current) => current + 1)}
            type="button"
          >
            Sau
          </button>
        </div>
      )}
    </div>
  );
}
