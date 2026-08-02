export interface HealthResponse {
  status: "ok";
  service: "Sistema Logistico API";
  version: string;
  timestamp: string;
}

export interface InfoResponse {
  service: "Sistema Logistico API";
  version: string;
  environment: string;
  runtime: string;
  database: "sqlite";
}

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
  };
}
