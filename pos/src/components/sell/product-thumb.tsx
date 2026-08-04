import Image from "next/image";
import { ImageOff } from "lucide-react";
import { API_BASE_URL } from "@/lib/env";
import { cn } from "@/lib/utils";

interface ProductThumbProps {
  src: string | null | undefined;
  alt: string;
  className?: string;
  sizes?: string;
}

// Image URLs from the API are stored-relative ("/uploads/..") — the backend
// serves them statically, so they're resolved against the API origin, not
// the POS app's own origin.
export function ProductThumb({ src, alt, className, sizes }: ProductThumbProps) {
  if (!src) {
    return (
      <div
        className={cn("flex items-center justify-center bg-muted text-muted-foreground", className)}
        role="img"
        aria-label={alt}
      >
        <ImageOff className="size-6" aria-hidden="true" />
      </div>
    );
  }

  const resolvedSrc = src.startsWith("http") ? src : `${API_BASE_URL}${src}`;

  return (
    <div className={cn("relative shrink-0 overflow-hidden bg-muted", className)}>
      <Image src={resolvedSrc} alt={alt} fill sizes={sizes ?? "80px"} className="object-cover" />
    </div>
  );
}
