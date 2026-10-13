import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useForm } from "react-hook-form";
import { useParams } from "react-router-dom";

import { Button, Surface } from "@farta/ui";

import { PageHeader, QueryState } from "../../components/page";
import { InventoryAdjustment } from "../inventory/inventory-adjustment";
import { adminApi, type Variant } from "../../lib/api";
import { errorMessage } from "../../lib/errors";
import { variantSchema, type VariantInput } from "./variant-schema";

export function ProductDetailPage() {
  const { productId = "" } = useParams();
  const queryClient = useQueryClient();
  const variants = useQuery({
    queryKey: ["variants", productId],
    queryFn: () => adminApi.variants(productId),
    enabled: Boolean(productId),
  });
  const form = useForm<VariantInput>({
    resolver: zodResolver(variantSchema),
    defaultValues: { sku: "", color: "", size: "", price: 0 },
  });
  const create = useMutation({
    mutationFn: (value: VariantInput) =>
      adminApi.createVariant(productId, {
        sku: value.sku,
        color: value.color,
        size: value.size,
        price: value.price,
      }),
    onSuccess: async () => {
      form.reset();
      await queryClient.invalidateQueries({
        queryKey: ["variants", productId],
      });
    },
  });
  return (
    <>
      <PageHeader
        eyebrow="Variant editor"
        title="Biến thể & tồn kho"
        description="Giá dùng integer VND; SKU được normalize và bảo vệ bằng unique index."
      />
      <Surface className="panel">
        <form
          className="inline-form variant-form"
          onSubmit={form.handleSubmit((value) => create.mutate(value))}
        >
          <label>
            SKU
            <input {...form.register("sku")} />
          </label>
          <label>
            Màu
            <input {...form.register("color")} />
          </label>
          <label>
            Size
            <input {...form.register("size")} />
          </label>
          <label>
            Giá VND
            <input
              inputMode="numeric"
              {...form.register("price", { valueAsNumber: true })}
            />
          </label>
          <Button disabled={create.isPending} type="submit">
            <Plus aria-hidden="true" size={17} strokeWidth={1.7} />
            Thêm variant
          </Button>
        </form>
        {Object.keys(form.formState.errors).length > 0 && (
          <p className="form-error" role="alert">
            Vui lòng kiểm tra SKU, màu, size và giá bán.
          </p>
        )}
        {create.error && (
          <p role="alert" className="form-error">
            {errorMessage(create.error)}
          </p>
        )}
      </Surface>
      <Surface className="panel table-panel">
        <QueryState pending={variants.isPending} error={variants.error} />
        {variants.data && (
          <table>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Màu / Size</th>
                <th>Giá</th>
                <th>Tồn kho</th>
              </tr>
            </thead>
            <tbody>
              {variants.data.items.map((item) => (
                <VariantRow key={item.id} variant={item} />
              ))}
            </tbody>
          </table>
        )}
      </Surface>
    </>
  );
}

function VariantRow({ variant }: { variant: Variant }) {
  return (
    <tr>
      <td>
        <code>{variant.sku}</code>
      </td>
      <td>
        {variant.color} / {variant.size}
      </td>
      <td>{new Intl.NumberFormat("vi-VN").format(variant.price)} ₫</td>
      <td>
        <InventoryAdjustment variant={variant} />
      </td>
    </tr>
  );
}
