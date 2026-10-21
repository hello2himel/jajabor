import { guard, handleSearch } from "../../server/netlify-upstream.mjs";

export async function handler(event) {
  return guard(event) || handleSearch(event);
}
