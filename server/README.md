# Carepoint API

This folder is a standalone Node.js backend package. It can be deployed on its own, without deploying the Angular frontend in `../client`. The API exposes endpoints under `/api`.

## Run locally

From this folder:

```sh
npm ci
npm run dev
```

Set the environment variables below before starting. The API listens on port `3000` by default. Check `/api/health` to confirm it is ready.

## Deploy the backend

Create a Node.js web service from this folder as the service root. Use Node.js 20 or 22, set the install/build command to `npm ci --omit=dev`, and the start command to `npm start`. The included `Dockerfile` can also be built with this folder as the Docker build context.

Set these environment variables in the hosting provider:

- `MONGODB_URI`: reachable MongoDB connection string.
- `JWT_SECRET`: private random value at least 32 characters long.
- `CLIENT_ORIGIN`: full public URL of the separately hosted frontend, such as `https://carepoint.example.com`.
- `PORT`: supplied by most hosts automatically; defaults to `3000` locally.

The service waits for MongoDB before listening and exits with an error if the JWT secret is missing or too short. After deployment, verify `https://<backend-host>/api/health`. Create the first administrator with `npm ci` followed by `npm run create-admin` from this folder, using the deployment environment variables.

## Frontend connection

The local Angular dev server proxies `/api` to `http://localhost:3000`. For a separately hosted frontend, configure its API base URL to the deployed backend URL and set that URL in the backend's `CLIENT_ORIGIN`.
