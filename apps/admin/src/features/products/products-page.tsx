import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useForm } from "react-hook-form";
import { NavLink } from "react-router-dom";

import { Button, Surface } from "@farta/ui";

import { PageHeader, QueryState, Status } from "../../components/page";
import { adminApi } from "../../lib/api";
import { errorMessage } from "../../lib/errors";
import { productSchema, type ProductInput } from "./product-schema";

export function ProductsPage() {
  const queryClient = useQueryClient();
  const products = useQuery({
    queryKey: ["products"],
    queryFn: adminApi.products,
  });
  const categories = useQuery({
    queryKey: ["categories"],
    queryFn: adminApi.categories,
  });
  const media = useQuery({ queryKey: ["media"], queryFn: adminApi.media });
  const form = useForm<ProductInput>({
    resolver: zodResolver(productSchema),
    defaultValues: { name: "", categoryId: "", coverMediaId: "" },
  });
  const create = useMutation({
    mutationFn: (value: ProductInput) =>
      adminApi.createProduct({
        name: value.name,
        categoryIds: [value.categoryId],
        ...(value.coverMediaId ? { coverMediaId: value.coverMediaId } : {}),
      }),
    onSuccess: async () => {
      form.reset();
      await queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });
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
          <label>
            Danh mục
            <select
              aria-invalid={Boolean(form.formState.errors.categoryId)}
              aria-describedby={
                form.formState.errors.categoryId
                  ? "product-category-error"
                  : undefined
              }
              {...form.register("categoryId")}
            >
              <option value="">Chọn danh mục</option>
              {categories.data?.items
                .filter((item) => item.status === "ACTIVE")
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
            </select>
          </label>
          {form.formState.errors.categoryId && (
            <p className="field-error" id="product-category-error">
              {form.formState.errors.categoryId.message}
            </p>
          )}
          <label>
            Ảnh bìa
            <select {...form.register("coverMediaId")}>
              <option value="">Chọn sau</option>
              {media.data?.items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.altText ?? item.publicId}
                </option>
              ))}
            </select>
          </label>
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
        <QueryState pending={products.isPending} error={products.error} />
        {products.data && (
          <table>
            <thead>
              <tr>
                <th>Sản phẩm</th>
                <th>Slug</th>
                <th>Trạng thái</th>
                <th></th>
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
                    <NavLink className="text-link" to={`/products/${item.id}`}>
                      Variants & tồn kho
                    </NavLink>
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
