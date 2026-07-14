import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSharedLink,
  downloadFile,
  listFolder,
  searchFiles,
  uploadFile,
} from "./operations";
import { dropboxSecretSchema, uploadFileInputSchema } from "./schemas";

const secrets = { accessToken: "unit-test-token" };
const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });
const metadata = { ".tag": "file", id: "id:abc", name: "report.txt", path_display: "/report.txt", path_lower: "/report.txt", size: 5 };

describe("Dropbox schemas", () => {
  it("requires a non-empty access token", () => {
    expect(() => dropboxSecretSchema.parse({ accessToken: "" })).toThrow();
    expect(dropboxSecretSchema.parse(secrets)).toEqual(secrets);
  });

  it("requires exactly one upload content representation", () => {
    expect(() => uploadFileInputSchema.parse({ path: "/a.txt", contentText: "a", contentBase64: "Yg==" })).toThrow(/exactly one/);
    expect(uploadFileInputSchema.parse({ path: "/a.txt", contentText: "a" }).contentText).toBe("a");
  });
});

describe("Dropbox operations", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("builds list-folder requests and returns cursor pagination", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      json({ entries: [metadata, { ".tag": "folder", id: "id:folder", name: "Docs", path_display: "/Docs" }], has_more: true, cursor: "next-cursor" }),
    );

    await expect(listFolder({ ...secrets, path: "/", recursive: true, includeDeleted: false, limit: 25, cursor: null })).resolves.toEqual({
      success: true,
      entries: [
        { id: "id:abc", name: "report.txt", pathDisplay: "/report.txt", pathLower: "/report.txt", size: 5, isFolder: false },
        { id: "id:folder", name: "Docs", pathDisplay: "/Docs", isFolder: true },
      ],
      hasMore: true,
      cursor: "next-cursor",
    });

    const [request, init] = fetchMock.mock.calls[0]!;
    expect(String(request)).toBe("https://api.dropboxapi.com/2/files/list_folder");
    expect(JSON.parse(String(init?.body))).toEqual({ path: "/", recursive: true, include_deleted: false, limit: 25 });
    expect(init?.headers).toMatchObject({ Authorization: "Bearer unit-test-token", Accept: "application/json" });
  });

  it("uses search options and formats matches", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      json({ matches: [{ match_type: "filename", metadata }], more: false }),
    );

    await expect(searchFiles({ ...secrets, query: "report", path: "/Docs", maxResults: 10, filenameOnly: true })).resolves.toEqual({
      success: true,
      matches: [{
        matchType: "filename",
        metadata: { id: "id:abc", name: "report.txt", pathDisplay: "/report.txt", pathLower: "/report.txt", size: 5, isFolder: false },
      }],
      hasMore: false,
    });
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      query: "report",
      options: { path: "/Docs", max_results: 10, filename_only: true },
    });
  });

  it("builds upload arguments and decodes downloaded bytes", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(json(metadata))
      .mockResolvedValueOnce(new Response(new TextEncoder().encode("hello"), {
        status: 200,
        headers: {
          "Content-Type": "text/plain",
          "Dropbox-API-Result": JSON.stringify(metadata),
        },
      }));

    await expect(uploadFile({ ...secrets, path: "/report.txt", contentText: "hello", contentBase64: null, mimeType: "text/plain", mode: "overwrite", autorename: false, mute: true, strictConflict: true })).resolves.toMatchObject({ success: true, file: { name: "report.txt" } });
    const [uploadRequest, uploadInit] = fetchMock.mock.calls[0]!;
    expect(String(uploadRequest)).toBe("https://content.dropboxapi.com/2/files/upload");
    expect(JSON.parse(String((uploadInit?.headers as Record<string, string>)["Dropbox-API-Arg"]))).toEqual({ path: "/report.txt", mode: "overwrite", autorename: false, mute: true, strict_conflict: true });
    expect(new TextDecoder().decode(new Uint8Array(await new Response(uploadInit?.body as BodyInit).arrayBuffer()))).toBe("hello");

    await expect(downloadFile({ ...secrets, path: "/report.txt", decodeText: true })).resolves.toEqual({
      success: true,
      path: "/report.txt",
      name: "report.txt",
      mimeType: "text/plain",
      sizeBytes: 5,
      contentBase64: "aGVsbG8=",
      contentText: "hello",
    });
    expect(JSON.parse(String((fetchMock.mock.calls[1]?.[1]?.headers as Record<string, string>)["Dropbox-API-Arg"]))).toEqual({ path: "/report.txt" });
  });

  it("creates shared links and exposes API errors", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(json({ url: "https://www.dropbox.com/s/example/report.txt?dl=0", name: "report.txt", path_display: "/report.txt", link_permissions: { visibility: "public" } }))
      .mockResolvedValueOnce(json({ error_summary: "path/not_found/", error: {} }, 409));

    await expect(createSharedLink({ ...secrets, path: "/report.txt", visibility: "public", allowDownload: true })).resolves.toEqual({
      success: true,
      url: "https://www.dropbox.com/s/example/report.txt?dl=0",
      name: "report.txt",
      pathDisplay: "/report.txt",
      visibility: "public",
    });
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      path: "/report.txt",
      settings: { requested_visibility: "public", allow_download: true },
    });
    await expect(searchFiles({ ...secrets, query: "missing", path: null, maxResults: 10, filenameOnly: false })).rejects.toThrow(/path\/not_found/);
  });

  it("rejects malformed JSON responses", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("not-json", { status: 200 }));
    await expect(searchFiles({ ...secrets, query: "report", path: null, maxResults: 10, filenameOnly: false })).rejects.toThrow(/Invalid JSON/);
  });
});
