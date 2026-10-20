import "reflect-metadata";

import { Logger, type INestApplicationContext } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { randomUUID } from "node:crypto";

import { AppModule } from "../app.module";
import type { Environment } from "../config/environment";
import { ReservationsService } from "../reservations/reservations.service";

const logger = new Logger("ReservationExpiryOnce");

type ApplicationContextFactory = () => Promise<INestApplicationContext>;

const createApplicationContext: ApplicationContextFactory = () =>
  NestFactory.createApplicationContext(AppModule);

export async function runReservationExpiryOnce(
  createContext: ApplicationContextFactory = createApplicationContext,
): Promise<number> {
  const application = await createContext();
  try {
    const config =
      application.get<ConfigService<Environment, true>>(ConfigService);
    const reservations = application.get(ReservationsService);
    const batchSize = config.get("RESERVATION_WORKER_BATCH_SIZE", {
      infer: true,
    });
    const released = await reservations.expireDue(
      batchSize,
      `reservation-job:${randomUUID()}`,
    );
    logger.log(`Reservation expiry job completed; released=${released}.`);
    return released;
  } finally {
    await application.close();
  }
}

if (require.main === module) {
  void runReservationExpiryOnce().catch(() => {
    logger.error("Reservation expiry job failed.");
    process.exitCode = 1;
  });
}
