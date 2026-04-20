import { beforeEach, vi } from "vitest";

process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-key";
process.env.SQUARE_ACCESS_TOKEN ??= "test-square-token";
process.env.SQUARE_ENVIRONMENT ??= "sandbox";
process.env.SQUARE_LOCATION_ID ??= "TESTLOCATION";
process.env.NEXT_PUBLIC_SQUARE_APPLICATION_ID ??= "test-app-id";
process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID ??= "TESTLOCATION";
process.env.RESEND_API_KEY ??= "test-resend-key";

beforeEach(() => {
  vi.clearAllMocks();
});
