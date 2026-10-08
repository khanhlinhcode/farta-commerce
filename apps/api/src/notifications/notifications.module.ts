import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";

import { NotificationsService } from "./notifications.service";
import {
  NotificationEvent,
  NotificationEventSchema,
} from "./schemas/notification-event.schema";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: NotificationEvent.name, schema: NotificationEventSchema },
    ]),
  ],
  providers: [NotificationsService],
  exports: [NotificationsService, MongooseModule],
})
export class NotificationsModule {}
