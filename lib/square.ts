import { SquareClient, SquareEnvironment } from "square";

// Lazy singleton — created on first API request, not at module load time.
// This ensures process.env is fully available at runtime on Vercel,
// regardless of how Turbopack bundles the module.

let _client: SquareClient | null = null;

export function getSquareClient(): SquareClient {
  if (!_client) {
    const token = process.env.SQUARE_ACCESS_TOKEN?.trim();
    if (!token) {
      throw new Error("SQUARE_ACCESS_TOKEN is not configured");
    }
    const environment =
      process.env.SQUARE_ENVIRONMENT === "production"
        ? SquareEnvironment.Production
        : SquareEnvironment.Sandbox;

    _client = new SquareClient({ token, environment });
  }
  return _client;
}

export function getLocationId(): string {
  const id = process.env.SQUARE_LOCATION_ID?.trim();
  if (!id) {
    throw new Error("SQUARE_LOCATION_ID is not configured");
  }
  return id;
}

export function getApplicationId(): string {
  return process.env.SQUARE_APPLICATION_ID?.trim() || "";
}
