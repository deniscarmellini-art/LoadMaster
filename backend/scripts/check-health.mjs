const apiUrl = process.env.API_URL ?? "http://localhost:3001/api";

try {
  const response = await fetch(`${apiUrl}/health`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const health = await response.json();
  if (health.status !== "ok") throw new Error("Stato API non valido");
  console.log(JSON.stringify(health, null, 2));
} catch (error) {
  const message = error instanceof Error ? error.message : "Errore di rete sconosciuto";
  console.error(`Health check fallito: ${message}`);
  process.exitCode = 1;
}
