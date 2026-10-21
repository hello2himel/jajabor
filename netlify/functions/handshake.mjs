import { guard, handleHandshake } from "../../server/netlify-upstream.mjs";

export async function handler(event) {
  return guard(event) || handleHandshake(event);
}
