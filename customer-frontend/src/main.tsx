import React from "react";
import ReactDOM from "react-dom/client";

import { App } from "@/app/App";
import { initializeCustomerObservability } from "@/lib/observability/sentry";
import "@/index.css";

initializeCustomerObservability();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
