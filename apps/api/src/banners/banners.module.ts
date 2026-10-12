import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";

import { AuditModule } from "../audit/audit.module";
import {
  MediaAsset,
  MediaAssetSchema,
} from "../media/schemas/media-asset.schema";
import {
  AdminBannersController,
  PublicBannersController,
} from "./banners.controller";
import { BannersService } from "./banners.service";
import { Banner, BannerSchema } from "./schemas/banner.schema";

@Module({
  imports: [
    AuditModule,
    MongooseModule.forFeature([
      { name: Banner.name, schema: BannerSchema },
      { name: MediaAsset.name, schema: MediaAssetSchema },
    ]),
  ],
  controllers: [PublicBannersController, AdminBannersController],
  providers: [BannersService],
  exports: [BannersService],
})
export class BannersModule {}
