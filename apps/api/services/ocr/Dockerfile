FROM python:3.11-slim
RUN apt-get update && apt-get install -y --no-install-recommends libgl1 libgomp1 libglib2.0-0 tesseract-ocr tesseract-ocr-spa && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
ENV OCR_ENGINE=paddle PADDLE_PDX_MODEL_SOURCE=BOS
EXPOSE 8090
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8090", "--workers", "1"]
