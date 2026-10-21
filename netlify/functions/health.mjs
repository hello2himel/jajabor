import { guard, handleHealth } from "../../server/netlify-upstream.mjs";

export async function handler(event) {
  return guard(event) || handleHealth(event);
}
