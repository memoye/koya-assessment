import { json, withApi } from "@/lib/http";
import { listSlots } from "@/lib/service";

// GET /slots?provider= — Level 1. Every slot, earliest start first.
export const GET = withApi(async (request) => {
  const provider = new URL(request.url).searchParams.get("provider");
  return json(200, { slots: await listSlots(provider) });
});
