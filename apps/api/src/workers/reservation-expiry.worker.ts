import "reflect-metadata";

import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { randomUUID } from "node:crypto";

import { AppModule } from "../app.module";
import type { Environment } from "../config/environment";
import { ReservationsService } from "../reservations/reservations.service";

const logger = new Logger("ReservationExpiryWorker");

function waitForNextBatch(
  intervalMs: number,
  signal: AbortSignal,
): Promise<void> {
  if (signal.aborted) return Promise.resolve();

  return new Promise((resolve) => {
    const timer = setTimeout(finish, intervalMs);

    function finish(): void {
      clearTimeout(timer);
      signal.removeEventListener("abort", finish);
      resolve();
    }

    signal.addEventListener("abort", finish, { once: true });
  });
}

async function run(): Promise<void> {
  // This process uses Nest's built-in logger directly. Do not buffer startup
  // logs without installing and flushing a replacement logger, otherwise
  // worker lifecycle and retry failures become invisible to operators.
  const application = await NestFactory.createApplicationContext(AppModule);
  const config =
    application.get<ConfigService<Environment, true>>(ConfigService);
  const reservations = application.get(ReservationsService);
  const intervalMs = config.get("RESERVATION_WORKER_INTERVAL_MS", {
    infer: true,
  });
  const batchSize = config.get("RESERVATION_WORKER_BATCH_SIZE", {
    infer: true,
  });
  let stopping = false;
  const stopController = new AbortController();
  const stop = () => {
    if (stopping) return;
    stopping = true;
    logger.log("Reservation expiry worker shutdown requested.");
    stopController.abort();
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  logger.log("Reservation expiry worker started.");
  while (!stopping) {
    try {
      const released = await reservations.expireDue(
        batchSize,
        `reservation-worker:${randomUUID()}`,
      );
      if (released > 0) logger.log(`Expired ${released} reservation(s).`);
    } catch {
      logger.error("Reservation expiry batch failed and will be retried.");
    }
    if (!stopping) {
      await waitForNextBatch(intervalMs, stopController.signal);
    }
  }
  await application.close();
  logger.log("Reservation expiry worker stopped.");
}

void run();
