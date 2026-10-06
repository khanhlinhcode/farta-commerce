"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Minus, Plus, Trash2 } from "lucide-react";
import Link from "next/link";

import {
  cartQueryKey,
  clearCart,
  getCart,
  removeCartItem,
  updateCartItem,
} from "@/lib/cart";
import { formatVnd } from "@/lib/catalog";
import { MediaFrame } from "./media-frame";

export function CartPage() {
  const queryClient = useQueryClient();
  const cart = useQuery({
    queryKey: cartQueryKey,
    queryFn: getCart,
    retry: false,
  });
  const mutation = useMutation({
    mutationFn: async (
      command:
        | { type: "update"; itemId: string; quantity: number }
        | { type: "remove"; itemId: string }
        | { type: "clear" },
    ) => {
      if (command.type === "update")
        return updateCartItem(command.itemId, command.quantity);
      if (command.type === "remove") return removeCartItem(command.itemId);
      return clearCart();
    },
    onSuccess: (next) => queryClient.setQueryData(cartQueryKey, next),
  });

  if (cart.isPending) {
    return (
      <main id="main-content" className="cart-page cart-state" aria-busy="true">
        <p>Đang chuẩn bị giỏ hàng…</p>
      </main>
    );
  }
  if (cart.isError) {
    return (
      <main id="main-content" className="cart-page cart-state">
        <h1>Chưa thể mở giỏ hàng</h1>
        <p>Kết nối đang gián đoạn. Giỏ của bạn vẫn được giữ trên máy chủ.</p>
        <button className="button button--quiet" onClick={() => cart.refetch()}>
          Thử lại
        </button>
      </main>
    );
  }
  if (!cart.data.items.length) {
    return (
      <main id="main-content" className="cart-page cart-state">
        <span>FARTA</span>
        <h1>Giỏ hàng đang đợi một lựa chọn thật đúng.</h1>
        <p>Bắt đầu từ những phom dáng mới nhất của mùa này.</p>
        <Link className="button button--primary" href="/shop">
          Tiếp tục mua sắm
        </Link>
      </main>
    );
  }

  return (
    <main id="main-content" className="cart-page">
      <header className="cart-heading">
        <h1>Giỏ hàng</h1>
        <p>{cart.data.itemCount} sản phẩm đã chọn</p>
      </header>
      {cart.data.conflicts.length > 0 && (
        <div className="cart-conflict" role="alert">
          Một vài lựa chọn vừa thay đổi về tình trạng hàng. Vui lòng kiểm tra
          trước khi thanh toán.
        </div>
      )}
      {mutation.isError && (
        <p className="form-error" role="alert">
          Không thể cập nhật giỏ. Vui lòng thử lại với số lượng còn khả dụng.
        </p>
      )}
      <div className="cart-layout">
        <section className="cart-lines" aria-label="Sản phẩm trong giỏ">
          {cart.data.items.map((item) => (
            <article className="cart-line" key={item.id}>
              <Link
                className="cart-line__media"
                href={item.product ? `/product/${item.product.slug}` : "/shop"}
              >
                <MediaFrame
                  media={item.image}
                  fallbackLabel={item.product?.name ?? item.variant.sku}
                />
              </Link>
              <div className="cart-line__body">
                <div>
                  <h2>{item.product?.name ?? "Sản phẩm không còn khả dụng"}</h2>
                  <p>
                    {item.variant.color} · {item.variant.size}
                  </p>
                  <strong>{formatVnd(item.unitPrice)}</strong>
                </div>
                <div className="cart-line__actions">
                  <div className="quantity-control" aria-label="Số lượng">
                    <button
                      aria-label="Giảm số lượng"
                      disabled={item.quantity <= 1 || mutation.isPending}
                      onClick={() =>
                        mutation.mutate({
                          type: "update",
                          itemId: item.id,
                          quantity: item.quantity - 1,
                        })
                      }
                    >
                      <Minus aria-hidden="true" size={15} />
                    </button>
                    <span aria-live="polite">{item.quantity}</span>
                    <button
                      aria-label="Tăng số lượng"
                      disabled={mutation.isPending}
                      onClick={() =>
                        mutation.mutate({
                          type: "update",
                          itemId: item.id,
                          quantity: item.quantity + 1,
                        })
                      }
                    >
                      <Plus aria-hidden="true" size={15} />
                    </button>
                  </div>
                  <button
                    className="cart-remove"
                    disabled={mutation.isPending}
                    onClick={() =>
                      mutation.mutate({ type: "remove", itemId: item.id })
                    }
                  >
                    <Trash2 aria-hidden="true" size={15} />
                    Xóa
                  </button>
                </div>
              </div>
            </article>
          ))}
          <button
            className="cart-clear"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate({ type: "clear" })}
          >
            Xóa toàn bộ giỏ hàng
          </button>
        </section>
        <aside className="cart-summary" aria-label="Tóm tắt giỏ hàng">
          <div>
            <span>Tạm tính</span>
            <strong>{formatVnd(cart.data.subtotal)}</strong>
          </div>
          <p>
            Phí vận chuyển và tổng thanh toán được xác nhận ở bước tiếp theo.
          </p>
          <button className="button button--primary button--wide" disabled>
            Thanh toán — mở ở Phase 4B
          </button>
          <Link href="/shop">Tiếp tục mua sắm</Link>
        </aside>
      </div>
    </main>
  );
}
