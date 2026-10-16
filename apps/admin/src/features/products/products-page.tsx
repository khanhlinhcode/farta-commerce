import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, Plus } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { NavLink } from "react-router-dom";

import { Button, Surface } from "@farta/ui";

import { MediaPicker } from "../../components/media-picker";
import {
  ConfirmationDialog,
  PageHeader,
  QueryState,
  Status,
} from "../../components/page";
import { adminApi, type Product } from "../../lib/api";
import { errorMessage } from "../../lib/errors";
import { productSchema, type ProductInput } from "./product-schema";

export function ProductsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [archiveTarget, setArchiveTarget] = useState<Product | null>(null);
  const products = useQuery({
    queryKey: ["products", page, q, status, category],
    queryFn: () => adminApi.products({ page, q, status, category }),
  });
  const categories = useQuery({
    queryKey: ["categories"],
    queryFn: () => adminApi.categories(),
  });
  const form = useForm<ProductInput>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: "",
      categoryIds: [],
      coverMediaId: "",
      status: "DRAFT",
    },
  });
  const create = useMutation({
    mutationFn: (value: ProductInput) =>
      adminApi.createProduct({
        name: value.name,
        categoryIds: value.categoryIds,
        ...(value.coverMediaId ? { coverMediaId: value.coverMediaId } : {}),
      }),
    onSuccess: async () => {
      form.reset();
      await queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });
  const archive = useMutation({
    mutationFn: (productId: string) => adminApi.archiveProduct(productId),
    onSuccess: async () => {
      setArchiveTarget(null);
      await queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });
  const pages = Math.max(1, Math.ceil((products.data?.total ?? 0) / 20));
  return (
    <>
      <PageHeader
        eyebrow="Catalog"
        title="Sản phẩm"
        description="Product là phong cách; Variant mới là đơn vị bán theo màu, size và SKU."
      />
      <Surface className="panel product-create">
        <h2>Sản phẩm mới</h2>
        <form
          className="inline-form"
          onSubmit={form.handleSubmit((value) => create.mutate(value))}
        >
          <label>
            Tên
            <input
              aria-invalid={Boolean(form.formState.errors.name)}
              aria-describedby={
                form.formState.errors.name ? "product-name-error" : undefined
              }
              {...form.register("name")}
            />
          </label>
          {form.formState.errors.name && (
            <p className="field-error" id="product-name-error">
              {form.formState.errors.name.message}
            </p>
          )}
          <fieldset
            aria-describedby={
              form.formState.errors.categoryIds
                ? "product-category-error"
                : undefined
            }
            aria-invalid={Boolean(form.formState.errors.categoryIds)}
            className="category-checklist"
          >
            <legend>Danh mục</legend>
            {categories.data?.items
              .filter((item) => item.status === "ACTIVE")
              .map((item) => (
                <label key={item.id}>
                  <input
                    type="checkbox"
                    value={item.id}
                    {...form.register("categoryIds")}
                  />
                  {item.name}
                </label>
              ))}
          </fieldset>
          {form.formState.errors.categoryIds && (
            <p className="field-error" id="product-category-error">
              {form.formState.errors.categoryIds.message}
            </p>
          )}
          <MediaPicker
            emptyLabel="Chọn sau"
            id="product-cover"
            label="Ảnh bìa"
            onChange={(value) =>
              form.setValue("coverMediaId", value, { shouldDirty: true })
            }
            resourceType="image"
            value={form.watch("coverMediaId") ?? ""}
          />
          <Button disabled={create.isPending} type="submit">
            <Plus aria-hidden="true" size={17} strokeWidth={1.7} />
            Tạo draft
          </Button>
        </form>
        {create.error && (
          <p role="alert" className="form-error">
            {errorMessage(create.error)}
          </p>
        )}
      </Surface>
      <Surface className="panel table-panel">
        <div className="admin-toolbar">
          <input
            aria-label="Tìm sản phẩm"
            onChange={(event) => {
              setPage(1);
              setQ(event.target.value);
            }}
            placeholder="Tìm sản phẩm"
            value={q}
          />
          <select
            aria-label="Lọc danh mục sản phẩm"
            onChange={(event) => {
              setPage(1);
              setCategory(event.target.value);
            }}
            value={category}
          >
            <option value="">Tất cả danh mục</option>
            {categories.data?.items.map((item) => (
              <option key={item.id} value={item.slug}>
                {item.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Lọc trạng thái sản phẩm"
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
        <QueryState pending={products.isPending} error={products.error} />
        {products.data && (
          <table>
            <thead>
              <tr>
                <th>Sản phẩm</th>
                <th>Slug</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {products.data.items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.name}</strong>
                  </td>
                  <td>
                    <code>{item.slug}</code>
                  </td>
                  <td>
                    <Status value={item.status} />
                  </td>
                  <td>
                    <div className="table-actions">
                      <NavLink
                        className="text-link"
                        to={`/products/${item.id}`}
                      >
                        Variants &amp; tồn kho
                      </NavLink>
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
      {archiveTarget && (
        <ConfirmationDialog
          confirmLabel="Xác nhận lưu trữ"
          error={archive.error}
          onCancel={() => setArchiveTarget(null)}
          onConfirm={() => archive.mutate(archiveTarget.id)}
          pending={archive.isPending}
          title={`Lưu trữ ${archiveTarget.name}?`}
        >
          <p>Sản phẩm sẽ bị loại khỏi catalog công khai.</p>
        </ConfirmationDialog>
      )}
    </>
  );
}
