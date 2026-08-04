// NEXT_PUBLIC_* vars are inlined at build time and safe to read on the client.
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
