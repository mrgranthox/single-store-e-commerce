import type { Router } from "express";

export interface RouteMetadata {
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  path: string;
  summary: string;
  tags: string[];
  auth: "public" | "authenticated" | "admin";
  permissions?: string[];
}

export interface RouteModule {
  router: Router;
  metadata: RouteMetadata[];
}
