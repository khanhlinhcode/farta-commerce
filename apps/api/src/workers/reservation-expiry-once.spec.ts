import type { INestApplicationContext } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { describe, expect, it, vi } from "vitest";

import { ReservationsService } from "../reservations/reservations.service";
import { runReservationExpiryOnce } from "./reservation-expiry-once";

function createContext(input: {
  batchSize: number;
  expireDue: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
}): INestApplicationContext {
  const config = {
    get: vi.fn().mockReturnValue(input.batchSize),
  };
  const reservations = {
    expireDue: input.expireDue,
  };
  return {
    get: vi.fn((token: unknown) => {
      if (token === ConfigService) return config;
      if (token === ReservationsService) return reservations;
      throw new Error("Unexpected application dependency.");
    }),
    close: input.close,
  } as unknown as INestApplicationContext;
}

describe("runReservationExpiryOnce", () => {
  it("expires one bounded batch and closes the application context", async () => {
    const expireDue = vi.fn().mockResolvedValue(3);
    const close = vi.fn().mockResolvedValue(undefined);
    const application = createContext({ batchSize: 25, expireDue, close });

    await expect(
      runReservationExpiryOnce(async () => application),
    ).resolves.toBe(3);

    expect(expireDue).toHaveBeenCalledWith(
      25,
      expect.stringMatching(/^reservation-job:/),
    );
    expect(close).toHaveBeenCalledOnce();
  });

  it("closes the application context when expiry fails", async () => {
    const expireDue = vi.fn().mockRejectedValue(new Error("expiry failed"));
    const close = vi.fn().mockResolvedValue(undefined);
    const application = createContext({ batchSize: 10, expireDue, close });

    await expect(
      runReservationExpiryOnce(async () => application),
    ).rejects.toThrow("expiry failed");
    expect(close).toHaveBeenCalledOnce();
  });
});
