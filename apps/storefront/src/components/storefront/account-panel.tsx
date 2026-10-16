"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

type CurrentUser = {
  user: {
    id: string;
    displayName: string;
    email: string;
    onboardingCompleted: boolean;
  };
};
type Session = {
  id: string;
  deviceLabel: string | null;
  createdAt: string;
  lastActivityAt: string;
  current: boolean;
};

async function request<T>(path: string): Promise<T> {
  const response = await fetch(`/api/v1${path}`, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(String(response.status));
  return response.json() as Promise<T>;
}

function customerCsrfToken(): string | null {
  for (const name of ["farta_customer_csrf", "__Secure-farta_customer_csrf"]) {
    const value = document.cookie
      .split("; ")
      .find((entry) => entry.startsWith(`${name}=`))
      ?.slice(name.length + 1);
    if (value) return decodeURIComponent(value);
  }
  return null;
}

async function sessionMutation(path: string, method: "POST" | "DELETE") {
  const csrf = customerCsrfToken();
  if (!csrf) throw new Error("CSRF_MISSING");
  const response = await fetch(`/api/v1${path}`, {
    method,
    credentials: "include",
    headers: { "x-csrf-token": csrf },
  });
  if (!response.ok) throw new Error(String(response.status));
}

async function customerMutation<T>(
  path: string,
  method: "POST" | "PATCH",
  body?: Record<string, unknown>,
): Promise<T> {
  const csrf = customerCsrfToken();
  if (!csrf) throw new Error("CSRF_MISSING");
  const response = await fetch(`/api/v1${path}`, {
    method,
    credentials: "include",
    headers: {
      "x-csrf-token": csrf,
      ...(body ? { "content-type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) throw new Error(String(response.status));
  return response.json() as Promise<T>;
}

export function AccountPanel({
  section = "overview",
}: {
  section?: "overview" | "profile" | "orders" | "security";
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const me = useQuery({
    queryKey: ["customer-me"],
    queryFn: () => request<CurrentUser>("/auth/customer/me"),
    retry: false,
  });
  const sessions = useQuery({
    queryKey: ["customer-sessions"],
    queryFn: () => request<{ sessions: Session[] }>("/auth/customer/sessions"),
    enabled: section === "security" && me.isSuccess,
    retry: false,
  });
  const revoke = useMutation({
    mutationFn: (sessionId: string) =>
      sessionMutation(`/auth/customer/sessions/${sessionId}`, "DELETE"),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["customer-sessions"] }),
  });
  const logout = useMutation({
    mutationFn: (all: boolean) =>
      sessionMutation(
        `/auth/customer/${all ? "logout-all" : "logout"}`,
        "POST",
      ),
    onSuccess: () => {
      queryClient.clear();
      router.replace("/login");
    },
  });
  const profile = useMutation({
    mutationFn: (displayName: string) =>
      customerMutation<CurrentUser["user"]>("/auth/customer/profile", "PATCH", {
        displayName,
      }),
    onSuccess: (user) => {
      queryClient.setQueryData<CurrentUser>(["customer-me"], { user });
    },
  });
  const onboarding = useMutation({
    mutationFn: () =>
      customerMutation<CurrentUser["user"]>(
        "/auth/customer/onboarding/complete",
        "POST",
      ),
    onSuccess: (user) => {
      queryClient.setQueryData<CurrentUser>(["customer-me"], { user });
    },
  });
  if (me.isPending)
    return (
      <div className="account-state" role="status">
        Đang tải tài khoản…
      </div>
    );
  if (me.isError)
    return (
      <div className="account-state">
        <h2>Đăng nhập để tiếp tục</h2>
        <p>Khu vực này chỉ hiển thị dữ liệu tài khoản thật của bạn.</p>
        <Link className="button button--primary" href="/login">
          Đăng nhập
        </Link>
      </div>
    );
  const user = me.data.user;
  if (section === "orders")
    return (
      <div className="account-state">
        <h2>Chưa có đơn hàng</h2>
        <p>
          Order domain sẽ xuất hiện khi Phase 4 hoàn tất. FARTA không tạo đơn
          hàng mẫu.
        </p>
        <Link href="/shop">Khám phá sản phẩm</Link>
      </div>
    );
  if (section === "security")
    return (
      <div>
        <h2>Thiết bị & phiên đăng nhập</h2>
        {sessions.isPending ? (
          <p role="status">Đang tải phiên…</p>
        ) : sessions.isError ? (
          <p role="alert">Không thể tải danh sách phiên.</p>
        ) : (
          <div className="session-list">
            {sessions.data.sessions.map((session) => (
              <article key={session.id}>
                <div>
                  <strong>
                    {session.current
                      ? "Thiết bị hiện tại"
                      : "Thiết bị đã đăng nhập"}
                  </strong>
                  <p>{session.deviceLabel ?? "Không có thông tin thiết bị"}</p>
                </div>
                <time>
                  {new Intl.DateTimeFormat("vi-VN", {
                    dateStyle: "medium",
                  }).format(new Date(session.lastActivityAt))}
                </time>
                {!session.current && (
                  <button
                    className="button button--quiet"
                    disabled={revoke.isPending}
                    onClick={() => revoke.mutate(session.id)}
                    type="button"
                  >
                    Thu hồi
                  </button>
                )}
              </article>
            ))}
          </div>
        )}
        {(revoke.isError || logout.isError) && (
          <p className="form-error" role="alert">
            Không thể cập nhật phiên. Vui lòng tải lại trang và thử lại.
          </p>
        )}
        <div className="security-actions">
          <button
            className="button button--quiet"
            disabled={logout.isPending}
            onClick={() => logout.mutate(false)}
            type="button"
          >
            Đăng xuất thiết bị này
          </button>
          <button
            className="button button--primary"
            disabled={logout.isPending}
            onClick={() => logout.mutate(true)}
            type="button"
          >
            Đăng xuất tất cả thiết bị
          </button>
        </div>
      </div>
    );
  if (section === "profile")
    return (
      <div className="profile-readonly">
        <h2>Hồ sơ</h2>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            profile.mutate(String(data.get("displayName") ?? ""));
          }}
        >
          <label htmlFor="profile-display-name">Tên hiển thị</label>
          <input
            id="profile-display-name"
            name="displayName"
            defaultValue={user.displayName}
            minLength={1}
            maxLength={100}
            required
            aria-describedby="profile-display-name-help"
          />
          <p id="profile-display-name-help">
            Tên này được dùng trong lời chào FARTA.
          </p>
          <label htmlFor="profile-email">Email</label>
          <input id="profile-email" value={user.email} readOnly />
          <button
            className="button button--primary"
            disabled={profile.isPending}
            type="submit"
          >
            {profile.isPending ? "Đang lưu…" : "Lưu hồ sơ"}
          </button>
          {profile.isSuccess && <p role="status">Đã cập nhật hồ sơ.</p>}
          {profile.isError && (
            <p className="form-error" role="alert">
              Không thể cập nhật hồ sơ. Vui lòng thử lại.
            </p>
          )}
        </form>
      </div>
    );
  return (
    <div>
      {searchParams.get("cart") === "review" && (
        <div className="account-state" role="status">
          <strong>Đăng nhập đã thành công.</strong>
          <p>
            Giỏ hàng chưa thể đồng bộ hoàn toàn. Sản phẩm cũ vẫn được giữ để bạn
            kiểm tra lại.
          </p>
          <Link href="/cart">Kiểm tra lại giỏ hàng</Link>
        </div>
      )}
      <h2>
        {user.onboardingCompleted
          ? `Xin chào ${user.displayName.split(/\s+/)[0]}.`
          : `Chào mừng ${user.displayName.split(/\s+/)[0]} đến với FARTA.`}
      </h2>
      <p>Quản lý hồ sơ, đơn hàng và bảo mật từ một nơi.</p>
      {!user.onboardingCompleted && (
        <div className="security-actions">
          <button
            className="button button--primary"
            disabled={onboarding.isPending}
            onClick={() =>
              onboarding.mutate(undefined, {
                onSuccess: () => router.push("/shop"),
              })
            }
            type="button"
          >
            Bắt đầu khám phá
          </button>
          <button
            className="button button--quiet"
            disabled={onboarding.isPending}
            onClick={() => onboarding.mutate()}
            type="button"
          >
            Bỏ qua lời chào
          </button>
          {onboarding.isError && (
            <p className="form-error" role="alert">
              Chưa thể lưu lựa chọn. Vui lòng thử lại.
            </p>
          )}
        </div>
      )}
      <div className="account-links">
        <Link href="/account/profile">Hồ sơ</Link>
        <Link href="/account/orders">Đơn hàng</Link>
        <Link href="/account/security">Bảo mật</Link>
      </div>
    </div>
  );
}
