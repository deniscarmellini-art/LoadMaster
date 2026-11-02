import React from "react";
import { createRoot } from "react-dom/client";
import MaintenanceNotice from "../../src/components/layout/MaintenanceNotice";

createRoot(document.getElementById("root")!).render(<React.StrictMode><MaintenanceNotice /></React.StrictMode>);
