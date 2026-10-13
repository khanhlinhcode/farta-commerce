import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { adminApi, type Variant } from "../../lib/api";
import { errorMessage } from "../../lib/errors";
import { inventoryAdjustmentSchema } from "./inventory-schema";

export function InventoryAdjustment({ variant }: { variant: Variant }) {
  const queryClient = useQueryClient();
  const inventory = useQuery({
    queryKey: ["inventory", variant.id],
    queryFn: () => adminApi.inventory(variant.id),
  });
  const [delta, setDelta] = useState(1);
  const [reason, setReason] = useState("");
  const validation = inventoryAdjustmentSchema.safeParse({
    quantityDelta: delta,
    reason,
  });
  const adjust = useMutation({
    mutationFn: () => {
      const input = inventoryAdjustmentSchema.parse({
        quantityDelta: delta,
        reason,
      });
      return adminApi.adjustInventory(variant.id, input);
    },
    onSuccess: async () => {
      setReason("");
      await queryClient.invalidateQueries({
        queryKey: ["inventory", variant.id],
      });
    },
  });
  return (
    <div className="inventory-cell">
      <span>
        {inventory.data ? `${inventory.data.available} khả dụng` : "—"}
      </span>
      <input
        aria-label={`Số lượng điều chỉnh ${variant.sku}`}
        onChange={(event) => setDelta(Number(event.target.value))}
        type="number"
        value={delta}
      />
      <input
        aria-label={`Lý do điều chỉnh ${variant.sku}`}
        maxLength={500}
        onChange={(event) => setReason(event.target.value)}
        placeholder="Lý do điều chỉnh"
        value={reason}
      />
      <button
        disabled={adjust.isPending || !validation.success}
        onClick={() => adjust.mutate()}
        type="button"
      >
        Điều chỉnh
      </button>
      {adjust.error && (
        <small className="field-error">{errorMessage(adjust.error)}</small>
      )}
    </div>
  );
}
