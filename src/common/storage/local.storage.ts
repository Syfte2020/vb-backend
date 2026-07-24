import {
  Injectable,
  InternalServerErrorException,
} from "@nestjs/common";

import * as fs from "fs";
import * as path from "path";
import { v4 as uuid } from "uuid";
import axios from "axios";

import { StorageService } from "./storage.service";

@Injectable()
export class LocalStorageService extends StorageService {

  // -----------------------------
  // UPLOAD IMAGE / VIDEO FILE
  // -----------------------------
  async upload(file: any, folder: string): Promise<string> {
    try {
      if (!file?.buffer || !Buffer.isBuffer(file.buffer)) {
        throw new Error("Invalid file buffer");
      }

      const mime = file.mimetype || "";

      // detect type
      const isVideo = mime.startsWith("video/");
      const baseFolder = isVideo ? "videos" : "images";

      const safeFilename = (
        file.originalname ||
        file.filename ||
        "file"
      ).replace(/[^a-zA-Z0-9.-]/g, "_");

      const finalName = `${Date.now()}-${uuid()}-${safeFilename}`;

      const uploadDir = path.join(
        process.cwd(),
        "uploads",
        baseFolder,
        folder,
      );

      await fs.promises.mkdir(uploadDir, { recursive: true });

      const filePath = path.join(uploadDir, finalName);

      await fs.promises.writeFile(filePath, file.buffer);

      return `uploads/${baseFolder}/${folder}/${finalName}`;
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException("File upload failed");
    }
  }

  // -----------------------------
  // DELETE FILE
  // -----------------------------
  async delete(filePath: string): Promise<boolean> {
    try {
      const fullPath = path.join(process.cwd(), filePath);

      try {
        await fs.promises.access(fullPath);
        await fs.promises.unlink(fullPath);
      } catch {
        // file not found → ignore
      }

      return true;
    } catch (error) {
      console.error(error);
      return false;
    }
  }

  // -----------------------------
  // UPLOAD FROM URL (IMAGE ONLY)
  // -----------------------------
  async uploadFromUrl(imageUrl: string, fileName: string): Promise<string> {
    try {
      const response = await axios.get(imageUrl, {
        responseType: "arraybuffer",
      });

      const buffer = Buffer.from(response.data);

      const uploadDir = path.join(
        process.cwd(),
        "uploads",
        "images",
        "venues",
      );

      await fs.promises.mkdir(uploadDir, { recursive: true });

      const finalName = `${Date.now()}-${uuid()}-${fileName}.jpg`;

      const filePath = path.join(uploadDir, finalName);

      await fs.promises.writeFile(filePath, buffer);

      return `uploads/images/venues/${finalName}`;
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException(
        "Image upload from URL failed",
      );
    }
  }
}