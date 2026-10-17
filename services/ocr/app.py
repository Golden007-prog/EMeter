import io
import os
import threading

from fastapi import FastAPI, HTTPException, UploadFile
from PIL import Image, ImageOps, UnidentifiedImageError
from pypdf import PdfReader
import pypdfium2 as pdfium
from parser import extract_fields

app = FastAPI(title="UtilityMeter local OCR")
lock = threading.Lock()
engine = None
MAX_BYTES = 20 * 1024 * 1024
MAX_PAGES = 10
Image.MAX_IMAGE_PIXELS = 25_000_000


def recognize(image):
    global engine
    if os.getenv("OCR_ENGINE", "paddle") == "tesseract":
        import pytesseract
        return pytesseract.image_to_string(image, lang="spa+eng"), None
    from paddleocr import PaddleOCR
    import numpy as np
    if engine is None:
        engine = PaddleOCR(lang="es", device="cpu", use_doc_orientation_classify=False,
                           use_doc_unwarping=False, use_textline_orientation=False,
                           enable_mkldnn=False)
    results = list(engine.predict(np.array(image.convert("RGB"))))
    texts, scores = [], []
    for result in results:
        data = result.json["res"]
        texts.extend(data.get("rec_texts", []))
        scores.extend(data.get("rec_scores", []))
    return "\n".join(texts), sum(scores) / len(scores) if scores else None


def extract_document(data, content_type):
    texts, scores = [], []
    engines = set()
    with lock:  # Paddle inference instance is not shared concurrently.
        if content_type == "application/pdf":
            reader = PdfReader(io.BytesIO(data))
            if reader.is_encrypted or len(reader.pages) > MAX_PAGES:
                raise ValueError("PDF must be unencrypted with at most 10 pages")
            document = None
            try:
                for index, page in enumerate(reader.pages):
                    text = page.extract_text() or ""
                    if len(text.strip()) < 30:
                        engines.add(os.getenv("OCR_ENGINE", "paddle"))
                        if document is None:
                            document = pdfium.PdfDocument(data)
                        pdf_page = document[index]
                        width, height = pdf_page.get_size()
                        scale = min(2.0, (20_000_000 / max(width * height, 1)) ** 0.5)
                        bitmap = pdf_page.render(scale=scale)
                        try:
                            text, score = recognize(bitmap.to_pil())
                            if score is not None:
                                scores.append(score)
                        finally:
                            bitmap.close()
                            pdf_page.close()
                    else:
                        engines.add("pdf-text")
                    texts.append(text)
            finally:
                if document is not None:
                    document.close()
        else:
            engines.add(os.getenv("OCR_ENGINE", "paddle"))
            with Image.open(io.BytesIO(data)) as image:
                if image.width * image.height > 25_000_000:
                    raise ValueError("Image exceeds 25 megapixels")
                image = ImageOps.exif_transpose(image).convert("RGB")
                text, score = recognize(image)
                texts.append(text)
                if score is not None:
                    scores.append(score)
    text = "\n".join(texts)
    if not text.strip():
        raise ValueError("No readable text found")
    return {"text": text, "fields": extract_fields(text),
            "confidence": sum(scores) / len(scores) if scores else None,
            "engine": "+".join(sorted(engines))}


@app.get("/health")
def health():
    return {"status": "ok", "engine": os.getenv("OCR_ENGINE", "paddle")}


@app.post("/extract")
def extract(file: UploadFile):
    if file.content_type not in ("application/pdf", "image/jpeg", "image/png"):
        raise HTTPException(415, "Only PDF, JPEG and PNG supported")
    data = file.file.read(MAX_BYTES + 1)
    if not data or len(data) > MAX_BYTES:
        raise HTTPException(413, "File must be between 1 byte and 20 MiB")
    try:
        return extract_document(data, file.content_type)
    except (ValueError, UnidentifiedImageError) as exc:
        raise HTTPException(422, str(exc)) from exc
