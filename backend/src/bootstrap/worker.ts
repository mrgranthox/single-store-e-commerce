import { initializeSentry, registerRuntimeErrorHandlers } from "../config/sentry";

initializeSentry("worker");
registerRuntimeErrorHandlers("worker");

void import("../workers/index");
