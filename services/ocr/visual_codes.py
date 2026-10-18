"""Decode QR, PDF417 and one-dimensional codes from rendered document pages."""


def decode_visual_codes(image, page):
    import numpy as np
    import zxingcpp

    artifacts = []
    for barcode in zxingcpp.read_barcodes(np.asarray(image.convert("RGB"))):
        format_name = str(barcode.format).split(".")[-1]
        normalized_format = "".join(character for character in format_name.lower() if character.isalnum())
        artifacts.append({
            "type": "qr" if normalized_format == "qrcode" else "barcode",
            "format": format_name,
            "value": barcode.text or None,
            "title": "Código detectado",
            "page": page,
            "status": "decoded",
        })
    return artifacts
