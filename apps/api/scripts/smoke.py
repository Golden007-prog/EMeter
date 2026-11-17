"""End-to-end prototype check; creates new test records, never deletes user data."""
import argparse
import hashlib
import json
import time
import urllib.request
import urllib.error
from pathlib import Path


def sample_pdf():
    lines = ["Enel", "Numero de cliente: 1234567", "Boleta electronica N 555123",
             "Lectura anterior: 12.345,5", "Lectura actual: 12.400,5",
             "Consumo facturado: 55 kWh", "Total a pagar: $18.990"]
    stream = "BT /F1 16 Tf 40 750 Td " + " 0 -30 Td ".join(f"({line}) Tj" for line in lines) + " ET"
    objects = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
               "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
               "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
               f"<< /Length {len(stream)} >>\nstream\n{stream}\nendstream"]
    data = b"%PDF-1.4\n"
    offsets = [0]
    for i, obj in enumerate(objects, 1):
        offsets.append(len(data))
        data += f"{i} 0 obj\n{obj}\nendobj\n".encode()
    xref = len(data)
    data += f"xref\n0 {len(offsets)}\n0000000000 65535 f \n".encode()
    data += b"".join(f"{offset:010d} 00000 n \n".encode() for offset in offsets[1:])
    data += f"trailer << /Size {len(offsets)} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode()
    return data


def run(base, image=None, output=None):
    def request(path, body=None, method=None, raw=False, content_type="application/json"):
        data = body if isinstance(body, bytes) else json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(base + path, data=data, method=method, headers={"Content-Type": content_type})
        with urllib.request.urlopen(req, timeout=30) as response:
            value = response.read()
            return value if raw else json.loads(value) if value else None

    org = request("/api/organizations", {"name": "Smoke test", "contactEmail": None})
    condo = request("/api/condominiums", {"name": "Smoke condo", "address": "Santiago", "organizationId": org["id"]})
    prop = request("/api/properties", {"name": "Smoke house", "address": "Santiago", "resourceType": "electricity", "condominiumId": condo["id"]})
    meter = request("/api/meters", {"propertyId": prop["id"], "serialNumber": "smoke", "resourceType": "electricity", "unit": "kWh", "model": "test"})
    period = request("/api/billing-periods", {"start": "2026-10-01T00:00:00-03:00", "end": "2026-10-31T23:59:59-03:00"})
    missing = request(f'/api/reports/missing-readings/{period["id"]}')
    assert meter["id"] in [x["meterId"] for x in missing]
    baseline = {"meterId": meter["id"], "value": 12345.5, "unit": "kWh", "measuredAt": "2026-09-30T09:00:00-03:00", "source": "Company"}
    try:
        request("/api/readings/", {**baseline, "value": -1})
        raise AssertionError("Negative reading accepted")
    except urllib.error.HTTPError as exc:
        assert exc.code == 400, exc.code
    request("/api/readings/", baseline)
    original = Path(image).read_bytes() if image else sample_pdf()
    mime = "image/png" if image and image.lower().endswith(".png") else "image/jpeg" if image else "application/pdf"
    name = Path(image).name if image else "synthetic-bill.pdf"
    boundary = "UtilityMeterSmokeBoundary"
    multipart = (f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{name}"\r\nContent-Type: {mime}\r\n\r\n'.encode()
                 + original + f"\r\n--{boundary}--\r\n".encode())
    uploaded = request("/api/evidence/upload", multipart, content_type=f"multipart/form-data; boundary={boundary}")
    job_id = uploaded.get("extractionId", uploaded["id"])
    assert uploaded["hash"].lower() == hashlib.sha256(original).hexdigest()
    deadline = time.monotonic() + 360
    while time.monotonic() < deadline:
        job = request(f"/api/extractions/{job_id}")
        if job["status"] in ("NeedsReview", "Failed"):
            break
        time.sleep(2)
    assert job["status"] == "NeedsReview", job
    assert job["result"]["text"].strip(), job
    if not image:
        assert job["result"]["fields"]["currentReading"] == "12400.5", job
    confirmation = {**baseline, "value": 12400.5, "measuredAt": "2026-10-01T09:00:00-03:00", "billingPeriodId": period["id"]}
    confirmed = request(f"/api/extractions/{job_id}/confirm", confirmation)
    repeated = request(f"/api/extractions/{job_id}/confirm", confirmation)
    assert confirmed == repeated
    reading = request(f'/api/readings/{confirmed["readingId"]}')
    assert uploaded["id"] in reading["evidenceIds"]
    downloaded = request(f'/api/evidence/{uploaded["id"]}/download', raw=True)
    assert original == downloaded
    summary = request(f'/api/reports/monthly-summary/{period["id"]}')
    assert summary["companyTotal"] == 55, summary
    missing = request(f'/api/reports/missing-readings/{period["id"]}')
    assert meter["id"] not in [x["meterId"] for x in missing]
    request(f'/api/billing-periods/{period["id"]}/status/Closed', method="PUT")
    try:
        request("/api/readings/", {**confirmation, "measuredAt": "2026-10-02T09:00:00-03:00"})
        raise AssertionError("Reading accepted in closed period")
    except urllib.error.HTTPError as exc:
        assert exc.code == 409, exc.code
    result = {"extractionId": job_id, "readingId": confirmed["readingId"], "evidenceId": uploaded["id"], "status": "passed"}
    if output:
        Path(output).write_text(json.dumps(result), encoding="utf-8")
    print(json.dumps(result))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", default="http://localhost:8080")
    parser.add_argument("--image")
    parser.add_argument("--output")
    args = parser.parse_args()
    run(args.base.rstrip("/"), args.image, args.output)
