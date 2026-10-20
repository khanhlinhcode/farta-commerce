type Env = {
  API_ORIGIN: string;
  ASSETS: {
    fetch(request: Request): Promise<Response>;
  };
};

function apiUrl(request: Request, apiOrigin: string): URL {
  const requestUrl = new URL(request.url);
  const configuredOrigin = new URL(apiOrigin);

  if (configuredOrigin.protocol !== "https:") {
    throw new Error("API_ORIGIN must use HTTPS.");
  }

  return new URL(
    `${requestUrl.pathname}${requestUrl.search}`,
    configuredOrigin.origin,
  );
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) {
      return env.ASSETS.fetch(request);
    }

    const headers = new Headers(request.headers);
    headers.delete("host");

    const upstreamRequest = new Request(apiUrl(request, env.API_ORIGIN), {
      method: request.method,
      headers,
      ...(request.method === "GET" || request.method === "HEAD"
        ? {}
        : { body: request.body }),
      redirect: "manual",
    });

    return fetch(upstreamRequest);
  },
};
