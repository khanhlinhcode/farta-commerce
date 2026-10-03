import { Controller, Get, Inject, Query } from "@nestjs/common";
import { Type } from "class-transformer";
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";

import { RequireAuth } from "../auth/decorators/auth-realm.decorator";
import { RequirePermissions } from "../auth/decorators/permissions.decorator";
import { AuditService } from "./audit.service";

class AuditQueryDto {
  @IsOptional() @IsString() @MaxLength(80) resourceType?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 50;
}

@Controller("admin/audit-logs")
@RequireAuth("STAFF")
@RequirePermissions("audit.read")
export class AuditController {
  constructor(@Inject(AuditService) private readonly audit: AuditService) {}
  @Get() list(@Query() query: AuditQueryDto) {
    return this.audit.list(query.limit, query.resourceType);
  }
}
