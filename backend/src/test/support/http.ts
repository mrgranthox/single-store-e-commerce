import { once } from "node:events";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { request as httpRequest } from "node:http";
import { createServer as createHttpsServer, type Server as HttpsServer } from "node:https";
import { request as httpsRequest } from "node:https";

import type { Express } from "express";

import { TEST_TLS_CERTIFICATE, TEST_TLS_PRIVATE_KEY } from "./tls-fixtures";

export const startHttpServer = async (app: Express) => {
  const server = createServer(app);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");

  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("Failed to resolve the integration server address.");
  }

  return {
    server,
    baseUrl: `http://127.0.0.1:${(address as AddressInfo).port}`
  };
};

export const startHttpsServer = async (app: Express) => {
  const server = createHttpsServer(
    {
      key: TEST_TLS_PRIVATE_KEY,
      cert: TEST_TLS_CERTIFICATE
    },
    app
  );
  server.listen(0, "127.0.0.1");
  await once(server, "listening");

  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("Failed to resolve the HTTPS integration server address.");
  }

  return {
    server,
    baseUrl: `https://127.0.0.1:${(address as AddressInfo).port}`
  };
};

export const stopServer = async (server: Server | HttpsServer) => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
};

export const stopHttpServer = stopServer;

export const requestJson = async <T>(input: {
  baseUrl: string;
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  headers?: Record<string, string>;
  body?: unknown;
}) => {
  const url = new URL(input.path, input.baseUrl);
  const body = input.body === undefined ? null : JSON.stringify(input.body);
  const requestImpl = url.protocol === "https:" ? httpsRequest : httpRequest;

  const response = await new Promise<{
    statusCode: number;
    headers: Record<string, string | string[] | undefined>;
    bodyText: string;
  }>((resolve, reject) => {
    const request = requestImpl(
      url,
      {
        method: input.method,
        ...(url.protocol === "https:" ? { rejectUnauthorized: false } : {}),
        headers: {
          accept: "application/json",
          ...(body
            ? {
                "content-type": "application/json",
                "content-length": Buffer.byteLength(body).toString()
              }
            : {}),
          ...(input.headers ?? {})
        }
      },
      async (response) => {
        response.setEncoding("utf8");
        let bodyText = "";

        response.on("data", (chunk) => {
          bodyText += chunk;
        });

        response.on("end", () => {
          resolve({
            statusCode: response.statusCode ?? 500,
            headers: response.headers,
            bodyText
          });
        });
      }
    );

    request.on("error", reject);

    if (body) {
      request.write(body);
    }

    request.end();
  });

  return {
    statusCode: response.statusCode,
    headers: response.headers,
    bodyText: response.bodyText,
    json: response.bodyText ? (JSON.parse(response.bodyText) as T) : null
  };
};
