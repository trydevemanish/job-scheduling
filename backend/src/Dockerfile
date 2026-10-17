FROM node:22-alpine

WORKDIR /code

COPY package*.json ./
RUN npm i

COPY . .

EXPOSE 4000

CMD ["npm", "run", "dev:api"]