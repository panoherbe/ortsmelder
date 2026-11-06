# The official image ships the browsers; its tag has to match @playwright/test in e2e/package.json.
FROM mcr.microsoft.com/playwright:v1.56.0-noble
WORKDIR /w
COPY package.json package-lock.json ./
COPY api/package.json api/package.json
COPY web/package.json web/package.json
COPY e2e/package.json e2e/package.json
RUN npm ci --no-audit --no-fund --ignore-scripts -w e2e
COPY e2e e2e
WORKDIR /w/e2e
CMD ["npx", "playwright", "test"]
