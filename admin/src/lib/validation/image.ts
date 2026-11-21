import { ERROR_CODES } from "@store/shared/constants/errors";
import { CLIENT_ALLOWED_IMAGE_TYPES, CLIENT_MAX_IMAGE_SIZE_MB } from "@/constants/images";

// Returns a backend error code or null; the backend re-validates regardless (rule 8).
export function validateImageFile(file: File): string | null {
  if (!CLIENT_ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return ERROR_CODES.IMAGE_INVALID_TYPE;
  }
  if (file.size > CLIENT_MAX_IMAGE_SIZE_MB * 1024 * 1024) {
    return ERROR_CODES.IMAGE_TOO_LARGE;
  }
  return null;
}
