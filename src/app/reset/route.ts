import { errorResponse, readJson, toResponse, withApi } from "@/lib/http";
import { resetSlots } from "@/lib/service";

// POST /reset — Level 1. Deletes every booking and replaces all slots.
export const POST = withApi(async (request) => {
  const body = await readJson(request);
  if (!body.ok) return errorResponse(400, "request body must be valid JSON");
  return toResponse(await resetSlots(body.value));
});
