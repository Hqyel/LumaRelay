import { embyApiUrl } from "./url.js";

export type EmbyImageType =
  "Primary" | "Backdrop" | "Logo" | "Thumb" | "Banner";

export type ImageSizePreset =
  "poster" | "landscape" | "backdrop" | "avatar" | "logo";

export interface ImageSize {
  maxHeight?: number;
  maxWidth: number;
}

export interface EmbyImageRequest {
  imageTag: string;
  imageType: EmbyImageType;
  index?: number;
  itemId: string;
  quality?: number;
  size: ImageSize;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function dimensions(width: number, aspectRatio: number): ImageSize {
  return { maxHeight: Math.round(width / aspectRatio), maxWidth: width };
}

export function resolveImageSize(
  preset: ImageSizePreset,
  containerWidth: number,
  devicePixelRatio = 1,
): ImageSize {
  if (!Number.isFinite(containerWidth) || containerWidth <= 0)
    throw new TypeError("Image container width must be positive");
  if (!Number.isFinite(devicePixelRatio) || devicePixelRatio <= 0)
    throw new TypeError("Image device pixel ratio must be positive");

  const dpr = clamp(devicePixelRatio, 1, 3);
  const targetWidth = Math.round(containerWidth * dpr);

  switch (preset) {
    case "poster":
      return dimensions(clamp(targetWidth, 360, 480), 2 / 3);
    case "landscape":
      return dimensions(clamp(targetWidth, 480, 960), 16 / 9);
    case "backdrop":
      return dimensions(clamp(targetWidth, 640, dpr > 1 ? 2560 : 1920), 16 / 9);
    case "avatar": {
      const width = clamp(targetWidth, 96, 512);
      return { maxHeight: width, maxWidth: width };
    }
    case "logo":
      return { maxWidth: clamp(targetWidth, 320, 1200) };
  }
}

export function buildEmbyImageUrl(
  baseUrl: string,
  request: EmbyImageRequest,
): URL {
  if (request.itemId.trim() === "")
    throw new TypeError("Emby image item ID must not be empty");
  if (request.imageTag.trim() === "")
    throw new TypeError("Emby image tag must not be empty");
  if (
    request.index !== undefined &&
    (!Number.isInteger(request.index) || request.index < 0)
  )
    throw new TypeError("Emby image index must be a nonnegative integer");
  if (!Number.isFinite(request.size.maxWidth) || request.size.maxWidth <= 0)
    throw new TypeError("Emby image width must be positive");
  if (
    request.size.maxHeight !== undefined &&
    (!Number.isFinite(request.size.maxHeight) || request.size.maxHeight <= 0)
  )
    throw new TypeError("Emby image height must be positive");
  if (request.quality !== undefined && !Number.isFinite(request.quality))
    throw new TypeError("Emby image quality must be finite");

  const suffix = request.index === undefined ? "" : `/${request.index}`;
  const url = embyApiUrl(
    baseUrl,
    `/Items/${encodeURIComponent(request.itemId)}/Images/` +
      `${request.imageType}${suffix}`,
  );
  const quality = clamp(Math.round(request.quality ?? 90), 1, 100);

  url.searchParams.set("tag", request.imageTag);
  url.searchParams.set("maxWidth", String(Math.round(request.size.maxWidth)));
  if (request.size.maxHeight !== undefined)
    url.searchParams.set(
      "maxHeight",
      String(Math.round(request.size.maxHeight)),
    );
  url.searchParams.set("quality", String(quality));
  return url;
}
