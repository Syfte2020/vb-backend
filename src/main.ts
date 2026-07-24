import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module";

import {
  FastifyAdapter,
  NestFastifyApplication,
} from "@nestjs/platform-fastify";

import multipart from "@fastify/multipart";

import fastifyStatic from "@fastify/static";

import path from "path";

async function bootstrap() {

  const app =
    await NestFactory.create<NestFastifyApplication>(
      AppModule,
      new FastifyAdapter(),
    );

  /*
  |--------------------------------------------------------------------------
  | CORS
  |--------------------------------------------------------------------------
  */

  app.enableCors({
    origin: [
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:3002",
      "http://localhost:3003",
      "https://venuebook-psi.vercel.app",
    ],
    credentials: true,

    methods:
      "GET,POST,PUT,PATCH,DELETE,OPTIONS",

  //      allowedHeaders: [
  //   "Content-Type",
  //   "Authorization",
  // ],
  });

  /*
  |--------------------------------------------------------------------------
  | MULTIPART
  |--------------------------------------------------------------------------
  */

 await app.register(multipart as any, {
    limits: {
      fileSize: 50 * 1024 * 1024, // 50MB
    },
  });
  /*
  |--------------------------------------------------------------------------
  | STATIC FILES
  |--------------------------------------------------------------------------
  */

  await app.register(
    fastifyStatic,
    {
      root: path.join(
        process.cwd(),
        "uploads",
      ),

      prefix: "/uploads/",
    },
  );

  /*
  |--------------------------------------------------------------------------
  | START SERVER
  |--------------------------------------------------------------------------
  */

  await app.listen(
    3000,
    "0.0.0.0",
  );

  console.log(
    `🚀 Server running on http://localhost:3000`,
  );
}

bootstrap();