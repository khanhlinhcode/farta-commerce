import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, Pencil, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useParams } from "react-router-dom";

import { Button, Surface } from "@farta/ui";

import { MediaPicker } from "../../components/media-picker";
import { PageHeader, QueryState } from "../../components/page";
import { InventoryAdjustment } from "../inventory/inventory-adjustment";
import { adminApi, type Variant } from "../../lib/api";
import { errorMessage } from "../../lib/errors";
import { productSchema, type ProductInput } from "../products/product-schema";
import { variantSchema, type VariantInput } from "./variant-schema";

export function ProductDetailPage() {
  const { productId = "" } = useParams();
  const queryClient = useQueryClient();
  const variants = useQuery({
    queryKey: ["variants", productId],
    queryFn: () => adminApi.variants(productId),
    enabled: Boolean(productId),
  });
  const product = useQuery({
    queryKey: ["product", productId],
    queryFn: () => adminApi.product(productId),
    enabled: Boolean(productId),
  });
  const categories = useQuery({
    queryKey: ["categories", "product-editor"],
    queryFn: () => adminApi.categories({ limit: 100 }),
  });
  const productForm = useForm<ProductInput>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: "",
      categoryIds: [],
      coverMediaId: "",
      shortDescription: "",
      description: "",
      tags: "",
      seoTitle: "",
      seoDescription: "",
      status: "DRAFT",
    },
  });
  useEffect(() => {
    if (!product.data) return;
    productForm.reset({
      name: product.data.name,
      categoryIds: product.data.categoryIds,
      coverMediaId: product.data.coverMediaId ?? "",
      shortDescription: product.data.shortDescription ?? "",
      description: product.data.description ?? "",
      tags: product.data.tags.join(", "),
      seoTitle: product.data.seo.title ?? "",
      seoDescription: product.data.seo.description ?? "",
      status: product.data.status as ProductInput["status"],
    });
  }, [product.data, productForm]);
  const saveProduct = useMutation({
    mutationFn: (value: ProductInput) =>
      adminApi.updateProduct(productId, {
        name: value.name,
        categoryIds: value.categoryIds,
        coverMediaId: value.coverMediaId || null,
        shortDescription: value.shortDescription || null,
        description: value.description || null,
        tags: (value.tags ?? "")
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        seo: {
          title: value.seoTitle || null,
          description: value.seoDescription || null,
        },
        status: value.status,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["product", productId] });
      await queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });
  const form = useForm<VariantInput>({
    resolver: zodResolver(variantSchema),
    defaultValues: {
      sku: "",
      color: "",
      colorCode: "",
      size: "",
      price: 0,
      mediaId: "",
      lowStockThreshold: 5,
    },
  });
  const create = useMutation({
    mutationFn: (value: VariantInput) =>
      adminApi.createVariant(productId, {
        sku: value.sku,
        color: value.color,
        colorCode: value.colorCode || null,
        size: value.size,
        price: value.price,
        compareAtPrice: value.compareAtPrice ?? null,
        mediaIds: value.mediaId ? [value.mediaId] : [],
        lowStockThreshold: value.lowStockThreshold,
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
        <div className="panel-heading">
          <h2>Thông tin sản phẩm</h2>
          {product.data?.status === "ACTIVE" && (
            <a
              className="text-link"
              href={`${import.meta.env.VITE_STOREFRONT_URL ?? "http://localhost:3000"}/product/${product.data.slug}`}
              rel="noreferrer"
              target="_blank"
            >
              Xem storefront
            </a>
          )}
        </div>
        <QueryState pending={product.isPending} error={product.error} />
        {product.data && (
          <form
            className="product-editor"
            onSubmit={productForm.handleSubmit((value) =>
              saveProduct.mutate(value),
            )}
          >
            <label>
              Tên sản phẩm
              <input {...productForm.register("name")} />
            </label>
            <fieldset className="category-checklist">
              <legend>Danh mục</legend>
              {categories.data?.items.map((item) => (
                <label key={item.id}>
                  <input
                    type="checkbox"
                    value={item.id}
                    {...productForm.register("categoryIds")}
                  />
                  {item.name}
                </label>
              ))}
            </fieldset>
            <label>
              Trạng thái
              <select {...productForm.register("status")}>
                <option value="DRAFT">Draft</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </label>
            <MediaPicker
              emptyLabel="Chọn sau"
              id="product-editor-cover"
              label="Ảnh bìa"
              onChange={(value) =>
                productForm.setValue("coverMediaId", value, {
                  shouldDirty: true,
                })
              }
              resourceType="image"
              value={productForm.watch("coverMediaId") ?? ""}
            />
            <label>
              Mô tả ngắn
              <textarea
                rows={3}
                {...productForm.register("shortDescription")}
              />
            </label>
            <label>
              Mô tả sản phẩm
              <textarea rows={7} {...productForm.register("description")} />
            </label>
            <label>
              Tags, phân cách bằng dấu phẩy
              <input {...productForm.register("tags")} />
            </label>
            <label>
              SEO title
              <input {...productForm.register("seoTitle")} />
            </label>
            <label>
              SEO description
              <textarea rows={3} {...productForm.register("seoDescription")} />
            </label>
            {Object.keys(productForm.formState.errors).length > 0 && (
              <p className="form-error" role="alert">
                Vui lòng kiểm tra thông tin sản phẩm.
              </p>
            )}
            {saveProduct.error && (
              <p className="form-error" role="alert">
                {errorMessage(saveProduct.error)}
              </p>
            )}
            <Button disabled={saveProduct.isPending} type="submit">
              Lưu sản phẩm
            </Button>
          </form>
        )}
      </Surface>
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
            Mã màu
            <input placeholder="#171717" {...form.register("colorCode")} />
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
          <label>
            Giá so sánh
            <input
              inputMode="numeric"
              {...form.register("compareAtPrice", {
                setValueAs: (value) =>
                  value === "" ? undefined : Number(value),
              })}
            />
          </label>
          <label>
            Ngưỡng sắp hết
            <input
              inputMode="numeric"
              {...form.register("lowStockThreshold", { valueAsNumber: true })}
            />
          </label>
          <MediaPicker
            emptyLabel="Dùng ảnh sản phẩm"
            id="variant-image"
            label="Ảnh variant"
            onChange={(value) =>
              form.setValue("mediaId", value, { shouldDirty: true })
            }
            resourceType="image"
            value={form.watch("mediaId") ?? ""}
          />
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
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {variants.data.items.map((item) => (
                <VariantRow
                  key={item.id}
                  productId={productId}
                  variant={item}
                />
              ))}
            </tbody>
          </table>
        )}
      </Surface>
    </>
  );
}

function VariantRow({
  productId,
  variant,
}: {
  productId: string;
  variant: Variant;
}) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [price, setPrice] = useState(variant.price);
  const [compareAtPrice, setCompareAtPrice] = useState(
    variant.compareAtPrice ?? 0,
  );
  const [threshold, setThreshold] = useState(variant.lowStockThreshold);
  const update = useMutation({
    mutationFn: () =>
      adminApi.updateVariant(productId, variant.id, {
        price,
        compareAtPrice: compareAtPrice > 0 ? compareAtPrice : null,
        lowStockThreshold: threshold,
      }),
    onSuccess: async () => {
      setEditing(false);
      await queryClient.invalidateQueries({
        queryKey: ["variants", productId],
      });
    },
  });
  const archive = useMutation({
    mutationFn: () => adminApi.archiveVariant(productId, variant.id),
    onSuccess: async () => {
      setConfirmArchive(false);
      await queryClient.invalidateQueries({
        queryKey: ["variants", productId],
      });
    },
  });
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
      <td>
        {editing ? (
          <div className="inline-editor">
            <label>
              Giá
              <input
                inputMode="numeric"
                onChange={(event) => setPrice(Number(event.target.value))}
                value={price}
              />
            </label>
            <label>
              Giá so sánh
              <input
                inputMode="numeric"
                onChange={(event) =>
                  setCompareAtPrice(Number(event.target.value))
                }
                value={compareAtPrice || ""}
              />
            </label>
            <label>
              Ngưỡng
              <input
                inputMode="numeric"
                onChange={(event) => setThreshold(Number(event.target.value))}
                value={threshold}
              />
            </label>
            <Button disabled={update.isPending} onClick={() => update.mutate()}>
              Lưu
            </Button>
            <button onClick={() => setEditing(false)} type="button">
              <X aria-hidden="true" size={15} /> Hủy
            </button>
            {update.error && (
              <p className="form-error" role="alert">
                {errorMessage(update.error)}
              </p>
            )}
          </div>
        ) : confirmArchive ? (
          <div className="inline-editor">
            <span>Lưu trữ SKU này?</span>
            <Button
              disabled={archive.isPending}
              onClick={() => archive.mutate()}
            >
              Xác nhận
            </Button>
            <button onClick={() => setConfirmArchive(false)} type="button">
              Hủy
            </button>
            {archive.error && (
              <p className="form-error" role="alert">
                {errorMessage(archive.error)}
              </p>
            )}
          </div>
        ) : (
          <div className="table-actions">
            <button onClick={() => setEditing(true)} type="button">
              <Pencil aria-hidden="true" size={15} /> Sửa
            </button>
            {variant.status !== "ARCHIVED" && (
              <button onClick={() => setConfirmArchive(true)} type="button">
                <Archive aria-hidden="true" size={15} /> Lưu trữ
              </button>
            )}
          </div>
        )}
      </td>
    </tr>
  );
}
