FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
EXPOSE 3000
# Modo desarrollo para el esqueleto; se pasará a build de producción más adelante
CMD ["npm", "run", "dev"]
