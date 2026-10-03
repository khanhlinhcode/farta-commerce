import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";

import { AuditModule } from "../audit/audit.module";
import { CloudinarySignatureService } from "./cloudinary-signature.service";
import { MediaController } from "./media.controller";
import { MediaService } from "./media.service";
import { MediaAsset, MediaAssetSchema } from "./schemas/media-asset.schema";

@Module({
  imports: [
    AuditModule,
    MongooseModule.forFeature([
      { name: MediaAsset.name, schema: MediaAssetSchema },
    ]),
  ],
  controllers: [MediaController],
  providers: [CloudinarySignatureService, MediaService],
  exports: [MediaService, MongooseModule],
})
export class MediaModule {}
