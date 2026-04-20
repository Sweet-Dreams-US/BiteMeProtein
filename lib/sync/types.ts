/**
 * Shared types for the sync layer.
 *
 * Each entity handler file exports three functions with this shape:
 *   upsert<Entity>(raw: unknown): Promise<void>
 *   backfill<Entity>(since?: Date): Promise<SyncResult>
 *   syncRecent<Entity>(hoursBack: number): Promise<SyncResult>
 */

export interface SyncResult {
  entity: string;
  count: number;
  durationMs: number;
  errors: number;
}

export type SquareId = string;
