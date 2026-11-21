import type { NextFunction, Request, Response } from "express";
import multer, { MulterError } from "multer";
import { AppError } from "@/lib/response";
import { ALLOWED_IMAGE_TYPES, UPLOAD_MAX_SIZE_MB } from "@/lib/image";
import { ERROR_CODES } from "@/constants";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: UPLOAD_MAX_SIZE_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
      cb(new AppError(400, ERROR_CODES.IMAGE_INVALID_TYPE));
      return;
    }
    cb(null, true);
  },
});

// One "file" field, with multer's errors turned into the unified error envelope.
export function handleImageUpload(req: Request, res: Response, next: NextFunction): void {
  upload.single("file")(req, res, (err: unknown) => {
    if (err) {
      if (err instanceof MulterError && err.code === "LIMIT_FILE_SIZE") {
        next(new AppError(400, ERROR_CODES.IMAGE_TOO_LARGE));
        return;
      }
      next(err instanceof AppError ? err : new AppError(400, ERROR_CODES.IMAGE_UPLOAD_FAILED));
      return;
    }
    next();
  });
}
