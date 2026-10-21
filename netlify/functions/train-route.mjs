import { guard, handleTrainRoute } from "../../server/netlify-upstream.mjs";

export async function handler(event) {
  return guard(event) || handleTrainRoute(event);
}
