# E-Market — image de production légère.
FROM node:20-alpine

WORKDIR /app

# Dépendances (couche cachée tant que package*.json ne change pas).
COPY package*.json ./
RUN npm ci --omit=dev

# Code applicatif.
COPY server ./server
COPY public ./public

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# Sonde de santé (le conteneur est "healthy" quand /api/health répond).
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server/index.js"]
