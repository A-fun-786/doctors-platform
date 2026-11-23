import io
from typing import Tuple
from fastapi import HTTPException, UploadFile, status
from PIL import Image, UnidentifiedImageError

# Guard against decompression bomb attacks
Image.MAX_IMAGE_PIXELS = 4096 * 4096

ALLOWED_MIME_TYPES = {
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
}

FORMAT_TO_META = {
    "PNG": (".png", "image/png"),
    "JPEG": (".jpg", "image/jpeg"),
    "WEBP": (".webp", "image/webp"),
}

DEFAULT_MAX_UPLOAD_BYTES = 2 * 1024 * 1024  # 2 MB
MAX_DIMENSION_PX = 2048
CHUNK_SIZE = 64 * 1024  # 64 KB


def validate_and_sanitize_image(
    file: UploadFile,
    max_bytes: int = DEFAULT_MAX_UPLOAD_BYTES,
) -> Tuple[bytes, str, str]:
    """
    Stream-read, validate, and re-encode an uploaded image (avatar or app icon).

    Security guarantees:
    1. Streaming size limit prevents OOM DoS (HTTP 413 on oversized uploads).
    2. Strict format allowlist (PNG, JPEG, WebP) blocks SVG/HTML stored XSS.
    3. Magic-byte decoding & Pillow re-encoding strips EXIF metadata and polyglot payloads.
    4. Ignores untrusted client filename extensions.

    Returns:
        (sanitized_bytes, safe_extension, canonical_content_type)
    """
    raw_content_type = (file.content_type or "").lower().split(";")[0].strip()
    if raw_content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file must be a valid PNG, JPEG, or WebP image (SVG and other formats are not permitted).",
        )

    buffer = io.BytesIO()
    total_read = 0
    file.file.seek(0)
    while True:
        chunk = file.file.read(CHUNK_SIZE)
        if not chunk:
            break
        total_read += len(chunk)
        if total_read > max_bytes:
            raise HTTPException(
                status_code=status.HTTP_413_CONTENT_TOO_LARGE,
                detail=f"Image file size exceeds the maximum allowed limit of {max_bytes // (1024 * 1024)} MB.",
            )
        buffer.write(chunk)

    if total_read == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded image file is empty.",
        )

    raw_bytes = buffer.getvalue()

    try:
        # 1. Verify structural integrity
        with Image.open(io.BytesIO(raw_bytes)) as verify_img:
            verify_img.verify()

        # 2. Re-open to inspect dimensions, format, and re-encode cleanly
        with Image.open(io.BytesIO(raw_bytes)) as img:
            detected_format = (img.format or "").upper()
            if detected_format not in FORMAT_TO_META:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Unsupported or corrupted image binary format. Allowed formats: PNG, JPEG, WebP.",
                )

            width, height = img.size
            if width <= 0 or height <= 0 or width > MAX_DIMENSION_PX or height > MAX_DIMENSION_PX:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Image dimensions ({width}x{height}) exceed maximum allowed {MAX_DIMENSION_PX}x{MAX_DIMENSION_PX}px.",
                )

            ext, canonical_mime = FORMAT_TO_META[detected_format]
            out_buf = io.BytesIO()

            if detected_format == "JPEG":
                if img.mode not in ("RGB", "L"):
                    img = img.convert("RGB")
                img.save(out_buf, format="JPEG", quality=90, optimize=True)
            elif detected_format == "PNG":
                if img.mode not in ("RGB", "RGBA", "L", "LA", "P"):
                    img = img.convert("RGBA")
                img.save(out_buf, format="PNG", optimize=True)
            else:  # WEBP
                if img.mode not in ("RGB", "RGBA"):
                    img = img.convert("RGBA")
                img.save(out_buf, format="WEBP", quality=90)

            return out_buf.getvalue(), ext, canonical_mime
    except HTTPException:
        raise
    except (UnidentifiedImageError, Image.DecompressionBombError, OSError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or corrupted image file content.",
        ) from exc
