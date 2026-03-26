export function getAppHealth() {
  return {
    status: "ok" as const,
    service: "saatgut",
    timestamp: new Date().toISOString(),
  };
}
