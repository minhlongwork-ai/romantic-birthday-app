export const MAX_PHOTO_BYTES = 15 * 1024 * 1024;
export const DEFAULT_MAX_EDGE = 2048;

const FORMAT_BY_MIME = Object.freeze({
  "image/jpeg": "jpeg",
  "image/jpg": "jpeg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
});

const FORMAT_BY_EXTENSION = Object.freeze({
  jpg: "jpeg",
  jpeg: "jpeg",
  png: "png",
  webp: "webp",
  heic: "heic",
  heif: "heif",
});

const MIME_BY_FORMAT = Object.freeze({
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
});

export class PhotoValidationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "PhotoValidationError";
    this.code = code;
  }
}

function fileExtension(name) {
  const match = /\.([^.]+)$/u.exec(String(name ?? "").trim().toLowerCase());
  return match?.[1] ?? "";
}

export function normalizePhotoFormat(file) {
  const extension = fileExtension(file?.name);
  const declaredMime = String(file?.type ?? "").trim().toLowerCase();
  const mimeFormat = FORMAT_BY_MIME[declaredMime];
  const extensionFormat = FORMAT_BY_EXTENSION[extension];
  const genericMime =
    declaredMime === "" || declaredMime === "application/octet-stream";
  const format = mimeFormat || (genericMime ? extensionFormat : undefined);

  if (!format) return null;

  return {
    format,
    mimeType: MIME_BY_FORMAT[format],
    extension,
    requiresDecodeCheck: format === "heic" || format === "heif",
  };
}

export function validatePhoto(file, options = {}) {
  if (!file || typeof file !== "object") {
    throw new PhotoValidationError(
      "missing-file",
      "Hãy chọn một ảnh để tiếp tục.",
    );
  }

  const size = Number(file.size);
  if (!Number.isFinite(size) || size <= 0) {
    throw new PhotoValidationError(
      "empty-file",
      "Ảnh đang trống hoặc không thể đọc.",
    );
  }

  const maxBytes = Number(options.maxBytes) || MAX_PHOTO_BYTES;
  if (size > maxBytes) {
    throw new PhotoValidationError(
      "file-too-large",
      "Ảnh cần nhỏ hơn hoặc bằng 15 MB.",
    );
  }

  const normalized = normalizePhotoFormat(file);
  if (!normalized) {
    throw new PhotoValidationError(
      "unsupported-format",
      "Hãy chọn ảnh JPEG, PNG, WebP hoặc HEIC/HEIF được trình duyệt hỗ trợ.",
    );
  }

  return {
    name: String(file.name ?? ""),
    size,
    ...normalized,
  };
}

export function calculateDownscaledSize(
  sourceWidth,
  sourceHeight,
  maxEdge = DEFAULT_MAX_EDGE,
) {
  const width = Number(sourceWidth);
  const height = Number(sourceHeight);
  const limit = Number(maxEdge);

  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    !Number.isFinite(limit) ||
    width <= 0 ||
    height <= 0 ||
    limit <= 0
  ) {
    throw new TypeError("Photo dimensions and maxEdge must be positive numbers.");
  }

  const longestEdge = Math.max(width, height);
  if (longestEdge <= limit) {
    return {
      width: Math.round(width),
      height: Math.round(height),
      downscaled: false,
    };
  }

  const ratio = limit / longestEdge;
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
    downscaled: true,
  };
}

function loadImageElement(objectUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(
        new PhotoValidationError(
          "unsupported-format",
          "Trình duyệt chưa thể giải mã ảnh này.",
        ),
      );
    image.src = objectUrl;
  });
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Không thể giảm kích thước ảnh."));
      },
      type,
      quality,
    );
  });
}

async function decodeSource(file, objectUrl) {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, {
        imageOrientation: "from-image",
      });
      return {
        drawable: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        bitmap,
      };
    } catch {
      // Safari and older mobile browsers can still decode through an image element.
    }
  }

  if (typeof Image !== "function") {
    throw new PhotoValidationError(
      "decode-unavailable",
      "Trình duyệt chưa hỗ trợ xử lý ảnh trên thiết bị này.",
    );
  }

  const image = await loadImageElement(objectUrl);
  return {
    drawable: image,
    width: image.naturalWidth,
    height: image.naturalHeight,
    bitmap: null,
  };
}

export async function decodeAndDownscalePhoto(file, options = {}) {
  const metadata = validatePhoto(file, options);
  if (
    typeof URL === "undefined" ||
    typeof URL.createObjectURL !== "function" ||
    typeof document === "undefined" ||
    typeof document.createElement !== "function"
  ) {
    throw new PhotoValidationError(
      "decode-unavailable",
      "Trình duyệt chưa hỗ trợ xử lý ảnh trên thiết bị này.",
    );
  }

  let sourceUrl = URL.createObjectURL(file);
  let previewUrl = sourceUrl;
  let source = null;
  let outputBitmap = null;
  let disposed = false;

  try {
    source = await decodeSource(file, sourceUrl);
    const size = calculateDownscaledSize(
      source.width,
      source.height,
      options.maxEdge ?? DEFAULT_MAX_EDGE,
    );

    if (size.downscaled) {
      const canvas = document.createElement("canvas");
      canvas.width = size.width;
      canvas.height = size.height;
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) throw new Error("Trình duyệt chưa thể thu nhỏ ảnh.");
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(source.drawable, 0, 0, size.width, size.height);

      const outputType = metadata.format === "png" ? "image/png" : "image/jpeg";
      const normalizedBlob = await canvasToBlob(canvas, outputType, 0.9);
      previewUrl = URL.createObjectURL(normalizedBlob);
      URL.revokeObjectURL(sourceUrl);
      sourceUrl = "";

      if (source.bitmap?.close) source.bitmap.close();
      source.bitmap = null;
      if (typeof createImageBitmap === "function") {
        try {
          outputBitmap = await createImageBitmap(normalizedBlob);
        } catch {
          outputBitmap = null;
        }
      }

      return {
        bitmap: outputBitmap,
        objectUrl: previewUrl,
        width: size.width,
        height: size.height,
        sourceWidth: source.width,
        sourceHeight: source.height,
        mimeType: outputType,
        format: outputType === "image/png" ? "png" : "jpeg",
        downscaled: true,
        dispose() {
          if (disposed) return;
          disposed = true;
          URL.revokeObjectURL(previewUrl);
          outputBitmap?.close?.();
        },
      };
    }

    outputBitmap = source.bitmap;
    return {
      bitmap: outputBitmap,
      objectUrl: previewUrl,
      width: source.width,
      height: source.height,
      sourceWidth: source.width,
      sourceHeight: source.height,
      mimeType: metadata.mimeType,
      format: metadata.format,
      downscaled: false,
      dispose() {
        if (disposed) return;
        disposed = true;
        URL.revokeObjectURL(previewUrl);
        outputBitmap?.close?.();
      },
    };
  } catch (error) {
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    if (previewUrl && previewUrl !== sourceUrl) URL.revokeObjectURL(previewUrl);
    source?.bitmap?.close?.();
    outputBitmap?.close?.();
    if (error instanceof PhotoValidationError) throw error;
    throw new PhotoValidationError(
      "unsupported-format",
      "Trình duyệt chưa thể giải mã ảnh này. Hãy chọn JPG, PNG hoặc WebP.",
    );
  }
}

export function calculatePhotoTransform(imageSize, frameSize, cropState = {}) {
  const imageWidth = Number(imageSize?.width);
  const imageHeight = Number(imageSize?.height);
  const frameWidth = Number(frameSize?.width);
  const frameHeight = Number(frameSize?.height);

  if (
    ![imageWidth, imageHeight, frameWidth, frameHeight].every(
      (value) => Number.isFinite(value) && value > 0,
    )
  ) {
    throw new TypeError("Image and frame dimensions must be positive numbers.");
  }

  const zoom = Math.min(2.5, Math.max(1, Number(cropState.zoom) || 1));
  const panX = Math.min(0.5, Math.max(-0.5, Number(cropState.x) || 0));
  const panY = Math.min(0.5, Math.max(-0.5, Number(cropState.y) || 0));
  const requestedRotation = Number(cropState.rotation) || 0;
  const rotation = [-3, 0, 3].includes(requestedRotation) ? requestedRotation : 0;
  const baseScale = Math.max(frameWidth / imageWidth, frameHeight / imageHeight);
  const scale = baseScale * zoom;
  const renderWidth = imageWidth * scale;
  const renderHeight = imageHeight * scale;

  return {
    baseScale,
    scale,
    renderWidth,
    renderHeight,
    x: (frameWidth - renderWidth) / 2 + panX * frameWidth * 0.28,
    y: (frameHeight - renderHeight) / 2 + panY * frameHeight * 0.28,
    rotation,
    zoom,
  };
}

const disposedPhotos = new WeakSet();

export function disposePhoto(photoState) {
  if (!photoState || typeof photoState !== "object" || disposedPhotos.has(photoState)) {
    return;
  }
  disposedPhotos.add(photoState);

  if (typeof photoState.dispose === "function") {
    photoState.dispose();
    return;
  }
  if (
    photoState.objectUrl &&
    typeof URL !== "undefined" &&
    typeof URL.revokeObjectURL === "function"
  ) {
    URL.revokeObjectURL(photoState.objectUrl);
  }
  photoState.bitmap?.close?.();
}
