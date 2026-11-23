/**
 * Guards patches/israeli-bank-scrapers+6.9.0.patch: upstream fetchPost called
 * .json() on any response, so a block or error page surfaced only as
 * "Unexpected token '<' ... is not valid JSON", with no status or URL.
 */
import { fetchPost } from "israeli-bank-scrapers/lib/helpers/fetch.js";

const URL = "https://api.example.com/Frames/api/Frames/GetFrameStatus";

function mockFetch(status: number, body: string, contentType: string) {
  jest
    .spyOn(global, "fetch")
    .mockResolvedValue(
      new Response(body, { status, headers: { "content-type": contentType } }),
    );
}

afterEach(() => jest.restoreAllMocks());

describe("patched fetchPost", () => {
  it("returns parsed JSON on a 200 JSON response", async () => {
    mockFetch(200, '{"statusCode":1}', "application/json");
    await expect(fetchPost(URL, {})).resolves.toEqual({ statusCode: 1 });
  });

  it("still returns a JSON error body on a non-200, as upstream did", async () => {
    mockFetch(400, '{"statusCode":0,"title":"bad"}', "application/json");
    await expect(fetchPost(URL, {})).resolves.toEqual({
      statusCode: 0,
      title: "bad",
    });
  });

  it("reports status, URL and body start on a non-200 HTML page", async () => {
    mockFetch(403, "<html><head><title>Access Denied</title>", "text/html");
    await expect(fetchPost(URL, {})).rejects.toThrow(
      /POST .*GetFrameStatus returned status 403 \(text\/html\): <html><head><title>Access Denied/,
    );
  });

  it("reports a 200 response whose body is not JSON", async () => {
    mockFetch(200, "<html><head></head>", "text/html");
    await expect(fetchPost(URL, {})).rejects.toThrow(
      /returned status 200 \(text\/html\): <html><head>/,
    );
  });

  it("flags a 429 as automation blocking", async () => {
    mockFetch(429, "<html>slow down</html>", "text/html");
    await expect(fetchPost(URL, {})).rejects.toThrow(
      /Automation detected and blocked by server. Status: 429/,
    );
  });
});
