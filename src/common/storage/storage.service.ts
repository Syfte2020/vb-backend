export type UploadType = "image" | "video" | "file";

export abstract class StorageService {

  abstract upload(
    file: any,
    folder: string,
    type?: UploadType,
  ): Promise<string>;

  abstract delete(
    filePath: string,
  ): Promise<boolean>;

  abstract uploadFromUrl(
    url: string,
    fileName: string,
    type?: UploadType,
    folder?: string,
  ): Promise<string>;
}