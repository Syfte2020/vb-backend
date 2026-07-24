import {
  Global,
  Module,
} from "@nestjs/common";

import { ConfigModule, ConfigService } from "@nestjs/config";

import { StorageService } from "./storage.service";
import { LocalStorageService } from "./local.storage";
import { S3StorageService } from "./s3.storage";

@Global()
@Module({
  imports: [ConfigModule],

  providers: [
    LocalStorageService,
    S3StorageService,

    {
      provide: StorageService,
      inject: [
        LocalStorageService,
        S3StorageService,
        ConfigService,
      ],
      useFactory: (
        localStorage: LocalStorageService,
        s3Storage: S3StorageService,
        configService: ConfigService,
      ) => {
        const driver = configService.get<string>("STORAGE_DRIVER") || "local";

        console.log(` STORAGE_DRIVER: ${driver}. Use 'local' or 's3'.`)

        switch (driver) {
          case "s3":
            return s3Storage;

          case "local":
            return localStorage;

          default:
            throw new Error(
              `Invalid STORAGE_DRIVER: ${driver}. Use 'local' or 's3'.`,
            );
        }
      },
    },
  ],

  exports: [StorageService],
})
export class StorageModule {}