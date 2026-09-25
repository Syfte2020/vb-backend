import { SetMetadata } from "@nestjs/common";

export const ACTIVITY_MODULE = (module: string) =>
  SetMetadata("activity_module", module);