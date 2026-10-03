import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Boxes,
  ImageIcon,
  LayoutDashboard,
  LogOut,
  Megaphone,
  PackageSearch,
  ShieldCheck,
  Tags,
} from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import {
  NavLink,
  Navigate,
  Route,
  Routes,
  useNavigate,
  useParams,
} from "react-router-dom";
import { z } from "zod";

import { Button, Surface } from "@farta/ui";

import { adminApi, ApiFailure, type AdminUser } from "./lib/api";

const loginSchema = z.object({
  email: z.email("Email không hợp lệ."),
  password: z.string().min(8, "Mật khẩu cần ít nhất 8 ký tự."),
});
const categorySchema = z.object({
  name: z.string().trim().min(1, "Nhập tên danh mục."),
  status: z.enum(["DRAFT", "ACTIVE", "INACTIVE"]),
  parentCategoryId: z.string().optional(),
});
const productSchema = z.object({
  name: z.string().trim().min(1, "Nhập tên sản phẩm."),
  categoryId: z.string().min(1, "Chọn danh mục."),
  coverMediaId: z.string().optional(),
});
const variantSchema = z.object({
  sku: z.string().trim().min(2),
  color: z.string().trim().min(1),
  size: z.string().trim().min(1),
  price: z.number().int().nonnegative(),
});

function errorMessage(error: unknown): string {
  return error instanceof ApiFailure
    ? error.message
    : "Không thể hoàn tất yêu cầu. Vui lòng thử lại.";
}

function LoginPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });
  const login = useMutation({
    mutationFn: (values: z.infer<typeof loginSchema>) =>
      adminApi.login(values.email, values.password),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["staff-me"] });
      navigate("/", { replace: true });
    },
  });
  return (
    <main className="auth-layout">
      <section className="auth-editorial" aria-hidden="true">
        <p>FARTA / Operations</p>
        <h1>Quản trị thời trang, vận hành bằng dữ liệu đáng tin cậy.</h1>
      </section>
      <Surface className="auth-card">
        <ShieldCheck size={26} />
        <p className="eyebrow">Protected staff realm</p>
        <h2>Đăng nhập FARTA Admin</h2>
        <form
          onSubmit={form.handleSubmit((values) => login.mutate(values))}
          noValidate
        >
          <label>
            Email
            <input
              autoComplete="username"
              type="email"
              {...form.register("email")}
            />
          </label>
          {form.formState.errors.email && (
            <p className="field-error">{form.formState.errors.email.message}</p>
          )}
          <label>
            Mật khẩu
            <input
              autoComplete="current-password"
              type="password"
              {...form.register("password")}
            />
          </label>
          {form.formState.errors.password && (
            <p className="field-error">
              {form.formState.errors.password.message}
            </p>
          )}
          {login.error && (
            <p className="form-error" role="alert">
              {errorMessage(login.error)}
            </p>
          )}
          <Button className="w-full" disabled={login.isPending} type="submit">
            {login.isPending ? "Đang xác thực…" : "Đăng nhập"}
          </Button>
        </form>
      </Surface>
    </main>
  );
}

const navigation = [
  ["/", "Tổng quan", LayoutDashboard],
  ["/categories", "Danh mục", Tags],
  ["/products", "Sản phẩm", PackageSearch],
  ["/media", "Media", ImageIcon],
  ["/banners", "Banner", Megaphone],
] as const;

function AdminLayout({
  user,
  children,
}: {
  user: AdminUser;
  children: React.ReactNode;
}) {
  const queryClient = useQueryClient();
  const logout = useMutation({
    mutationFn: adminApi.logout,
    onSettled: () => queryClient.clear(),
  });
  return (
    <div className="admin-layout">
      <aside className="sidebar">
        <div>
          <p className="wordmark">FARTA</p>
          <p className="eyebrow">Commerce operations</p>
        </div>
        <nav aria-label="Quản trị chính">
          {navigation.map(([to, label, Icon]) => (
            <NavLink end={to === "/"} key={to} to={to}>
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="staff-card">
          <strong>{user.displayName}</strong>
          <span>{user.roles.join(" · ")}</span>
          <button onClick={() => logout.mutate()} type="button">
            <LogOut size={16} /> Đăng xuất
          </button>
        </div>
      </aside>
      <main className="admin-content">{children}</main>
    </div>
  );
}

function PageHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <header className="page-header">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p>{description}</p>
    </header>
  );
}
function QueryState({ pending, error }: { pending: boolean; error: unknown }) {
  if (pending)
    return (
      <p role="status" className="state-card">
        Đang tải dữ liệu vận hành…
      </p>
    );
  if (error)
    return (
      <p role="alert" className="state-card error">
        {errorMessage(error)}
      </p>
    );
  return null;
}
function Metric({
  label,
  value,
}: {
  label: string;
  value: number | undefined;
}) {
  return (
    <Surface className="metric">
      <span>{label}</span>
      <strong>{value ?? "—"}</strong>
    </Surface>
  );
}
function Status({ value }: { value: string }) {
  return (
    <span className={`status status-${value.toLowerCase()}`}>{value}</span>
  );
}

function Dashboard() {
  const categories = useQuery({
    queryKey: ["categories"],
    queryFn: adminApi.categories,
  });
  const products = useQuery({
    queryKey: ["products"],
    queryFn: adminApi.products,
  });
  const media = useQuery({ queryKey: ["media"], queryFn: adminApi.media });
  return (
    <>
      <PageHeader
        eyebrow="Operations"
        title="Tổng quan catalog"
        description="Một nguồn sự thật cho sản phẩm, tồn kho và nội dung storefront."
      />
      <section className="metric-grid">
        <Metric label="Danh mục" value={categories.data?.total} />
        <Metric label="Sản phẩm" value={products.data?.total} />
        <Metric label="Media assets" value={media.data?.items.length} />
      </section>
      <Surface className="notice">
        <Boxes />
        <div>
          <strong>Inventory ledger đang hoạt động</strong>
          <p>
            Mọi điều chỉnh tồn kho đi qua API có idempotency key và audit trail.
          </p>
        </div>
      </Surface>
    </>
  );
}

function CategoriesPage() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["categories"],
    queryFn: adminApi.categories,
  });
  const form = useForm<z.infer<typeof categorySchema>>({
    resolver: zodResolver(categorySchema),
    defaultValues: { name: "", status: "DRAFT", parentCategoryId: "" },
  });
  const create = useMutation({
    mutationFn: (value: z.infer<typeof categorySchema>) =>
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
              <input {...form.register("name")} />
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
            {create.error && (
              <p role="alert" className="form-error">
                {errorMessage(create.error)}
              </p>
            )}
            <Button disabled={create.isPending} type="submit">
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

function ProductsPage() {
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
  const form = useForm<z.infer<typeof productSchema>>({
    resolver: zodResolver(productSchema),
    defaultValues: { name: "", categoryId: "", coverMediaId: "" },
  });
  const create = useMutation({
    mutationFn: (value: z.infer<typeof productSchema>) =>
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
            <input {...form.register("name")} />
          </label>
          <label>
            Danh mục
            <select {...form.register("categoryId")}>
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

function ProductDetailPage() {
  const { productId = "" } = useParams();
  const queryClient = useQueryClient();
  const variants = useQuery({
    queryKey: ["variants", productId],
    queryFn: () => adminApi.variants(productId),
    enabled: Boolean(productId),
  });
  const form = useForm<z.infer<typeof variantSchema>>({
    resolver: zodResolver(variantSchema),
    defaultValues: { sku: "", color: "", size: "", price: 0 },
  });
  const create = useMutation({
    mutationFn: (value: z.infer<typeof variantSchema>) =>
      adminApi.createVariant(productId, value),
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
          <Button type="submit">Thêm variant</Button>
        </form>
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

function VariantRow({
  variant,
}: {
  variant: {
    id: string;
    sku: string;
    color: string;
    size: string;
    price: number;
  };
}) {
  const queryClient = useQueryClient();
  const inventory = useQuery({
    queryKey: ["inventory", variant.id],
    queryFn: () => adminApi.inventory(variant.id),
  });
  const [delta, setDelta] = useState(1);
  const adjust = useMutation({
    mutationFn: () =>
      adminApi.adjustInventory(variant.id, {
        quantityDelta: delta,
        reason: "Điều chỉnh thủ công từ FARTA Admin",
      }),
    onSuccess: async () =>
      queryClient.invalidateQueries({ queryKey: ["inventory", variant.id] }),
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
        <div className="inventory-cell">
          <span>
            {inventory.data ? `${inventory.data.available} khả dụng` : "—"}
          </span>
          <input
            aria-label={`Điều chỉnh ${variant.sku}`}
            onChange={(event) => setDelta(Number(event.target.value))}
            type="number"
            value={delta}
          />
          <button
            disabled={adjust.isPending || delta === 0}
            onClick={() => adjust.mutate()}
            type="button"
          >
            Điều chỉnh
          </button>
        </div>
        {adjust.error && (
          <small className="field-error">{errorMessage(adjust.error)}</small>
        )}
      </td>
    </tr>
  );
}

function MediaPage() {
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

function BannersPage() {
  const queryClient = useQueryClient();
  const banners = useQuery({
    queryKey: ["banners"],
    queryFn: adminApi.banners,
  });
  const media = useQuery({ queryKey: ["media"], queryFn: adminApi.media });
  const [title, setTitle] = useState("");
  const [mediaId, setMediaId] = useState("");
  const create = useMutation({
    mutationFn: () =>
      adminApi.createBanner({
        title,
        desktopMediaId: mediaId,
        position: "home-hero",
        ctaTarget: "/shop",
        status: "DRAFT",
      }),
    onSuccess: async () => {
      setTitle("");
      setMediaId("");
      await queryClient.invalidateQueries({ queryKey: ["banners"] });
    },
  });
  return (
    <>
      <PageHeader
        eyebrow="Content"
        title="Banner CMS"
        description="Campaign có media reference, safe internal CTA, lịch hiển thị và priority."
      />
      <Surface className="panel">
        <form
          className="inline-form"
          onSubmit={(event) => {
            event.preventDefault();
            create.mutate();
          }}
        >
          <label>
            Tiêu đề
            <input
              onChange={(event) => setTitle(event.target.value)}
              value={title}
            />
          </label>
          <label>
            Desktop media
            <select
              onChange={(event) => setMediaId(event.target.value)}
              value={mediaId}
            >
              <option value="">Chọn media</option>
              {media.data?.items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.altText ?? item.publicId}
                </option>
              ))}
            </select>
          </label>
          <Button
            disabled={!title || !mediaId || create.isPending}
            type="submit"
          >
            Tạo draft banner
          </Button>
        </form>
        {create.error && (
          <p role="alert" className="form-error">
            {errorMessage(create.error)}
          </p>
        )}
      </Surface>
      <Surface className="panel table-panel">
        <QueryState pending={banners.isPending} error={banners.error} />
        {banners.data && (
          <table>
            <thead>
              <tr>
                <th>Campaign</th>
                <th>Vị trí</th>
                <th>CTA</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {banners.data.items.map((item) => (
                <tr key={item.id}>
                  <td>{item.title}</td>
                  <td>{item.position}</td>
                  <td>{item.ctaTarget ?? "—"}</td>
                  <td>
                    <Status value={item.status} />
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

function ProtectedApp() {
  const me = useQuery({
    queryKey: ["staff-me"],
    queryFn: adminApi.me,
    retry: false,
  });
  if (me.isPending)
    return (
      <main className="center-state" role="status">
        Đang kiểm tra phiên quản trị…
      </main>
    );
  if (me.error || !me.data) return <Navigate replace to="/login" />;
  return (
    <AdminLayout user={me.data.user}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/categories" element={<CategoriesPage />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/products/:productId" element={<ProductDetailPage />} />
        <Route path="/media" element={<MediaPage />} />
        <Route path="/banners" element={<BannersPage />} />
        <Route path="*" element={<Navigate replace to="/" />} />
      </Routes>
    </AdminLayout>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/*" element={<ProtectedApp />} />
    </Routes>
  );
}
