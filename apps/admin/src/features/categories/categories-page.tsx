import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useForm } from "react-hook-form";

import { Button, Surface } from "@farta/ui";

import { PageHeader, QueryState, Status } from "../../components/page";
import { adminApi } from "../../lib/api";
import { errorMessage } from "../../lib/errors";
import { categorySchema, type CategoryInput } from "./category-schema";

export function CategoriesPage() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["categories"],
    queryFn: adminApi.categories,
  });
  const form = useForm<CategoryInput>({
    resolver: zodResolver(categorySchema),
    defaultValues: { name: "", status: "DRAFT", parentCategoryId: "" },
  });
  const create = useMutation({
    mutationFn: (value: CategoryInput) =>
      adminApi.createCategory({
        name: value.name,
        status: value.status,
        ...(value.parentCategoryId
          ? { parentCategoryId: value.parentCategoryId }
          : {}),
      }),
    onSuccess: async () => {
      form.reset();
      await queryClient.invalidateQueries({ queryKey: ["categories"] });
    },
  });
  return (
    <>
      <PageHeader
        eyebrow="Catalog"
        title="Danh mục"
        description="Cấu trúc điều hướng có giới hạn chiều sâu và kiểm tra cycle ở server."
      />
      <div className="split-grid">
        <Surface className="panel">
          <h2>Tạo danh mục</h2>
          <form onSubmit={form.handleSubmit((value) => create.mutate(value))}>
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
            {create.error && (
              <p role="alert" className="form-error">
                {errorMessage(create.error)}
              </p>
            )}
            <Button disabled={create.isPending} type="submit">
              <Plus aria-hidden="true" size={17} strokeWidth={1.7} />
              Tạo danh mục
            </Button>
          </form>
        </Surface>
        <Surface className="panel table-panel">
          <h2>Danh sách</h2>
          <QueryState pending={query.isPending} error={query.error} />
          {query.data && (
            <table>
              <thead>
                <tr>
                  <th>Tên</th>
                  <th>Slug</th>
                  <th>Trạng thái</th>
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
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Surface>
      </div>
    </>
  );
}
