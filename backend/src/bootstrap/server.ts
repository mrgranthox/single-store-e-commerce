import { initializeSentry, registerRuntimeErrorHandlers } from "../config/sentry";

initializeSentry("http");
registerRuntimeErrorHandlers("http");

void import("../app/server");
