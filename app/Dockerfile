FROM node:22-slim
ENV TZ=Asia/Tehran NODE_ENV=production
WORKDIR /app
# موتور OCR (Tesseract) - داده‌ی زبان فارسی/انگلیسی همراه برنامه است (app/tessdata)
RUN apt-get update && apt-get install -y --no-install-recommends tesseract-ocr && rm -rf /var/lib/apt/lists/*
COPY package.json ./
RUN npm install --omit=dev
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
