import Logger from "@/utils/logger";
import { Request } from "express";
import multer from "multer";

export class FileUploadService {
  private static instance: FileUploadService;

  private constructor() {}

  public static getInstance(): FileUploadService {
    if (!FileUploadService.instance) {
      FileUploadService.instance = new FileUploadService();
    }
    return FileUploadService.instance;
  }

  private multerConfig = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 5 * 1024 * 1024,
      files: 1,
    },
    fileFilter: (
      req: Request,
      file: Express.Multer.File,
      callback: multer.FileFilterCallback
    ) => {
      const allowedTypes = ["image/jpeg", "image/png", "application/pdf"];

      if (!allowedTypes.includes(file.mimetype)) {
        Logger.error(`Invalid file type: ${file.mimetype}`);
        callback(
          new Error(
            "Invalid file type. Only JPEG, PNG and PDF files are allowed"
          )
        );
        return;
      }

      callback(null, true);
    },
  });

  public getUploadMiddleware(fieldName: string) {
    return this.multerConfig.single(fieldName);
  }
}
