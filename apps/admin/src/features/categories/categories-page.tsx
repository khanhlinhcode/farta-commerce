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
import { adminApi, type Category } from "../../lib/api";
import { errorMessage } from "../../lib/errors";
import { categorySchema, type CategoryInput } from "./category-schema";

export function CategoriesPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [editing, setEditing] = useState<Category | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<Category | null>(null);
  const query = useQuery({
    queryKey: ["categories", page, q, status],
    queryFn: () => adminApi.categories({ page, q, status }),
  });
  const form = useForm<CategoryInput>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: "",
      status: "DRAFT",
      parentCategoryId: "",
      description: "",
      imageMediaId: "",
      sortOrder: 0,
    },
  });
  const save = useMutation({
    mutationFn: (value: CategoryInput) => {
      const input = {
        name: value.name,
        status: value.status,
        parentCategoryId: value.parentCategoryId || null,
        description: value.description || null,
        imageMediaId: value.imageMediaId || null,
        sortOrder: value.sortOrder,
      };
      return editing
        ? adminApi.updateCategory(editing.id, input)
        : adminApi.createCategory({
            name: input.name,
            status: input.status,
            description: input.description,
            imageMediaId: input.imageMediaId,
            sortOrder: input.sortOrder,
            ...(value.parentCategoryId
              ? { parentCategoryId: value.parentCategoryId }
              : {}),
          });
    },
    onSuccess: async () => {
      setEditing(null);
      form.reset({
        name: "",
        status: "DRAFT",
        parentCategoryId: "",
        description: "",
        imageMediaId: "",
        sortOrder: 0,
      });
      await queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
  });
  const archive = useMutation({
    mutationFn: (categoryId: string) => adminApi.archiveCategory(categoryId),
    onSuccess: async () => {
      setArchiveTarget(null);
      await queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
  });
  const pages = Math.max(1, Math.ceil((query.data?.total ?? 0) / 20));

  function edit(item: Category) {
    setEditing(item);
    form.reset({
      name: item.name,
      status: item.status as CategoryInput["status"],
      parentCategoryId: item.parentCategoryId ?? "",
      description: item.description ?? "",
      imageMediaId: item.imageMediaId ?? "",
      sortOrder: item.sortOrder,
    });
  }
  return (
    <>
      <PageHeader
        eyebrow="Catalog"
        title="Danh mục"
        description="Cấu trúc điều hướng có giới hạn chiều sâu và kiểm tra cycle ở server."
      />
      <div className="split-grid">
        <Surface className="panel">
          <div className="panel-heading">
            <h2>{editing ? "Chỉnh sửa danh mục" : "Tạo danh mục"}</h2>
            {editing && (
              <button
                aria-label="Hủy chỉnh sửa"
                className="icon-button"
                onClick={() => {
                  setEditing(null);
                  form.reset();
                }}
                type="button"
              >
                <X aria-hidden="true" size={18} />
              </button>
            )}
          </div>
          <form onSubmit={form.handleSubmit((value) => save.mutate(value))}>
            <label>
              Tên
              <input
                aria-invalid={Boolean(form.formState.errors.name)}
                aria-describedby={
                  form.formState.errors.name ? "category-name-error" : undefined
                }
                {...form.register("name")}
              />
            </label>
            {form.formState.errors.name && (
              <p className="field-error" id="category-name-error">
                {form.formState.errors.name.message}
              </p>
            )}
            <label>
              Mô tả
              <textarea rows={4} {...form.register("description")} />
            </label>
            <label>
              Trạng thái
              <select {...form.register("status")}>
                <option value="DRAFT">Draft</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </label>
            <label>
              Danh mục cha
              <select {...form.register("parentCategoryId")}>
                <option value="">Không có</option>
                {query.data?.items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <MediaPicker
              emptyLabel="Không dùng ảnh"
              id="category-image"
              label="Ảnh danh mục"
              onChange={(value) =>
                form.setValue("imageMediaId", value, { shouldDirty: true })
              }
              resourceType="image"
              value={form.watch("imageMediaId") ?? ""}
            />
            <label>
              Thứ tự
              <input
                inputMode="numeric"
                type="number"
                {...form.register("sortOrder", { valueAsNumber: true })}
              />
            </label>
            {save.error && (
              <p role="alert" className="form-error">
                {errorMessage(save.error)}
              </p>
            )}
            <Button disabled={save.isPending} type="submit">
              <Plus aria-hidden="true" size={17} strokeWidth={1.7} />
              {editing ? "Lưu thay đổi" : "Tạo danh mục"}
            </Button>
          </form>
        </Surface>
        <Surface className="panel table-panel">
          <div className="admin-toolbar">
            <input
              aria-label="Tìm danh mục"
              onChange={(event) => {
                setPage(1);
                setQ(event.target.value);
              }}
              placeholder="Tìm danh mục"
              value={q}
            />
            <select
              aria-label="Lọc trạng thái danh mục"
              onChange={(event) => {
                setPage(1);
                setStatus(event.target.value);
              }}
              value={status}
            >
              <option value="">Tất cả trạng thái</option>
              <option value="DRAFT">Draft</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </div>
          <QueryState pending={query.isPending} error={query.error} />
          {query.data && (
            <table>
              <thead>
                <tr>
                  <th>Tên</th>
                  <th>Slug</th>
                  <th>Trạng thái</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {query.data.items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.name}</td>
                    <td>
                      <code>{item.slug}</code>
                    </td>
                    <td>
                      <Status value={item.status} />
                    </td>
                    <td>
                      <div className="table-actions">
                        <button onClick={() => edit(item)} type="button">
                          <Pencil aria-hidden="true" size={15} /> Sửa
                        </button>
                        {item.status !== "ARCHIVED" && (
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
          <div className="pagination-controls">
            <button
              disabled={page <= 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              type="button"
            >
              Trang trước
            </button>
            <span>
              Trang {page}/{pages}
            </span>
            <button
              disabled={page >= pages}
              onClick={() => setPage((value) => value + 1)}
              type="button"
            >
              Trang sau
            </button>
          </div>
        </Surface>
      </div>
      {archiveTarget && (
        <ConfirmationDialog
          confirmLabel="Xác nhận lưu trữ"
          error={archive.error}
          onCancel={() => setArchiveTarget(null)}
          onConfirm={() => archive.mutate(archiveTarget.id)}
          pending={archive.isPending}
          title={`Lưu trữ ${archiveTarget.name}?`}
        >
          <p>Danh mục sẽ không còn xuất hiện trong catalog công khai.</p>
        </ConfirmationDialog>
      )}
    </>
  );
}
