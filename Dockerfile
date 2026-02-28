FROM python:3.11-slim
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
COPY backend/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt
# Copy the whole repository into the image so backend files are present
COPY . /app
EXPOSE 8000
# Run the backend module path explicitly
CMD ["uvicorn","backend.main:app","--host","0.0.0.0","--port","8000"]
