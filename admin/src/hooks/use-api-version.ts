import { useQuery } from "@tanstack/react-query";
import { API_VERSION_QUERY_KEY, API_VERSION_STALE_TIME_MS } from "@/constants/api";
import { fetchApiVersion } from "@/lib/api/version";

// The API's build number changes only when the API is redeployed, so this is
// asked once and kept — it exists to be read out, not watched.
export function useApiVersionQuery() {
  return useQuery({
    queryKey: API_VERSION_QUERY_KEY,
    queryFn: fetchApiVersion,
    staleTime: API_VERSION_STALE_TIME_MS,
    // A version line that quietly stays blank is fine; a retry storm behind a
    // dropdown is not.
    retry: false,
  });
}
