import {
  Injectable,
  InternalServerErrorException,
} from "@nestjs/common";

import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

import axios from "axios";
import { v4 as uuid } from "uuid";

@Injectable()
export class S3StorageService {
  private s3: S3Client;

  private bucket = process.env.AWS_BUCKET!;
  private region = process.env.AWS_REGION!;

  constructor() {
    this.s3 = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
  }

  // -----------------------------
  // UPLOAD FILE BUFFER
  // -----------------------------
async upload(
  file: any,
  folder: string,
): Promise<string> {

  console.log({
  key: process.env.AWS_ACCESS_KEY_ID,
  secret: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
  bucket: process.env.AWS_BUCKET,
});

  try {

    if (
      !file?.buffer ||
      !Buffer.isBuffer(file.buffer)
    ) {
      throw new Error(
        "Invalid file buffer",
      );
    }

    console.log("loading image");

    const filename =
      file.filename ||
      file.originalname ||
      `file-${Date.now()}`;

    const safeFilename =
      filename.replace(
        /[^a-zA-Z0-9.-]/g,
        "_",
      );

    const key =
      `${folder}/${Date.now()}-${uuid()}-${safeFilename}`;

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer,
        ContentType:
          file.mimetype ||
          "application/octet-stream",
      }),
    );

    return this.getPublicUrl(key);

  } catch (error) {

    console.error(
      "S3 UPLOAD ERROR =>",
      error,
    );

    throw new InternalServerErrorException(
      "S3 upload failed",
    );
  }
}

  // -----------------------------
  // DELETE FILE
  // -----------------------------
  async delete(filePath: string): Promise<boolean> {
    try {
      await this.s3.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: filePath,
        }),
      );

      return true;
    } catch (error) {
      console.error(error);
      return false;
    }
  }

  // -----------------------------
  // UPLOAD FROM URL
  // -----------------------------
  async uploadFromUrl(imageUrl: string, fileName: string): Promise<string> {
    try {
      const response = await axios.get(imageUrl, {
        responseType: "arraybuffer",
      });

      const buffer = Buffer.from(response.data);
      const key = `venues/${Date.now()}-${uuid()}-${fileName}.jpg`;

      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: buffer,
          ContentType: "image/jpeg",
        }),
      );

      return this.getPublicUrl(key);
    } catch (error) {
      console.error("S3 upload failed:", error);
      return imageUrl;
    }
  }

  // -----------------------------
  // UPLOAD BUFFER (GENERIC)
  // -----------------------------
  async uploadFile(buffer: Buffer, mime: string, folder: string) {
    const key = `${folder}/${uuid()}`;

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: mime,
      }),
    );

    return this.getPublicUrl(key);
  }

  // -----------------------------
  // PUBLIC URL GENERATOR
  // -----------------------------
  private getPublicUrl(key: string): string {
    // return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
    return key;
  }
}
