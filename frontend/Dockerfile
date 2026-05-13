FROM node:20-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci

ARG VITE_API_URL=https://backend-production-ee2a.up.railway.app
ENV VITE_API_URL=$VITE_API_URL

COPY . .
RUN npm run build

EXPOSE 4173
CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0", "--port", "4173"]
