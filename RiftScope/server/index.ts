import "dotenv/config";
import express from "express";
import { fileURLToPath } from "node:url";
import { createApp } from "./app";
const app = createApp();
app.use(express.static(fileURLToPath(new URL("../dist", import.meta.url))));
app.get("/{*path}", (_req, res) =>
  res.sendFile(fileURLToPath(new URL("../dist/index.html", import.meta.url))),
);
const port = Number(process.env.PORT ?? 3001);
app.listen(port, "127.0.0.1", () =>
  console.log(`RiftScope backend: http://127.0.0.1:${port}`),
);
