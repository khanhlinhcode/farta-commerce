import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import bcrypt from "bcrypt";

import type { Environment } from "../../config/environment";

@Injectable()
export class PasswordService {
  private readonly cost: number;

  constructor(@Inject(ConfigService) config: ConfigService<Environment, true>) {
    this.cost = config.get("BCRYPT_COST", { infer: true });
  }

  hash(password: string): Promise<string> {
    return bcrypt.hash(password, this.cost);
  }

  verify(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }
}
