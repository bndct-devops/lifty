FROM node:18-alpine AS build
WORKDIR /app
ARG COMMIT_SHA=dev
ENV VITE_COMMIT_SHA=$COMMIT_SHA
COPY package.json package-lock.json* ./
RUN npm install --silent
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
