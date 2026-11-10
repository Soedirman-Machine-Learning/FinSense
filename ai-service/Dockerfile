# Gunakan base image Python 3.10 (ringan dan stabil)
FROM python:3.10-slim

RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

# Set working directory di dalam container
WORKDIR /app

# Copy file requirements terlebih dahulu (agar caching bekerja)
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy semua file dari folder ai ke dalam container
COPY . .

# Ekspos port yang digunakan Hugging Face Spaces (wajib 7860)
EXPOSE 7860

# Perintah untuk menjalankan FastAPI dengan uvicorn
CMD ["uvicorn", "combined_ai:app", "--host", "0.0.0.0", "--port", "7860"]