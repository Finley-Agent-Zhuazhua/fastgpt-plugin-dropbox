import { Buffer } from "node:buffer";
import type {
  CreateSharedLinkInput,
  DownloadFileInput,
  ListFolderInput,
  SearchFilesInput,
  UploadFileInput,
} from "./schemas";

export const DROPBOX_API_BASE = "https://api.dropboxapi.com/2";
export const DROPBOX_CONTENT_BASE = "https://content.dropboxapi.com/2";

type JsonObject = Record<string, unknown>;
type FetchFn = typeof fetch;

type DownloadResult = {
  bytes: Uint8Array;
  metadata: JsonObject;
  mimeType?: string;
};

export class DropboxClient {
  private readonly accessToken: string;
  private readonly fetchFn: FetchFn;

  constructor(accessToken: string, fetchFn: FetchFn = fetch) {
    const trimmed = accessToken.trim();
    if (!trimmed) {
      throw new Error("Dropbox accessToken secret is required");
    }
    this.accessToken = trimmed;
    this.fetchFn = fetchFn;
  }

  listFolder(input: ListFolderInput): Promise<JsonObject> {
    if (input.cursor) {
      return this.requestJson("/files/list_folder/continue", { cursor: input.cursor });
    }
    return this.requestJson("/files/list_folder", {
      path: input.path,
      recursive: input.recursive,
      include_deleted: input.includeDeleted,
      limit: input.limit,
    });
  }

  searchFiles(input: SearchFilesInput): Promise<JsonObject> {
    return this.requestJson("/files/search_v2", {
      query: input.query,
      options: {
        ...(input.path ? { path: input.path } : {}),
        max_results: input.maxResults,
        filename_only: input.filenameOnly,
      },
    });
  }

  async uploadFile(input: UploadFileInput): Promise<JsonObject> {
    const bytes = typeof input.contentText === "string"
      ? Buffer.from(input.contentText, "utf8")
      : Buffer.from(input.contentBase64 ?? "", "base64");
    return this.requestContentJson("/files/upload", bytes, {
      "Dropbox-API-Arg": JSON.stringify({
        path: input.path,
        mode: input.mode,
        autorename: input.autorename,
        mute: input.mute,
        strict_conflict: input.strictConflict,
      }),
    });
  }

  async downloadFile(input: DownloadFileInput): Promise<DownloadResult> {
    const response = await this.fetchFn(new URL(`${DROPBOX_CONTENT_BASE}/files/download`), {
      method: "POST",
      headers: this.authHeaders({
        "Content-Type": "application/octet-stream",
        "Dropbox-API-Arg": JSON.stringify({ path: input.path }),
      }),
    });
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (!response.ok) {
      throw new Error(`Dropbox API POST /files/download failed: ${extractErrorMessage(parseErrorBody(bytes), response.statusText)}`);
    }
    const resultHeader = response.headers.get("Dropbox-API-Result");
    if (!resultHeader) {
      throw new Error("Dropbox download response is missing Dropbox-API-Result");
    }
    const metadata = parseJson(resultHeader, "Dropbox-API-Result") as unknown;
    if (!isObject(metadata)) {
      throw new Error("Dropbox-API-Result must be an object");
    }
    const mimeType = response.headers.get("Content-Type") ?? undefined;
    return mimeType ? { bytes, metadata, mimeType } : { bytes, metadata };
  }

  createSharedLink(input: CreateSharedLinkInput): Promise<JsonObject> {
    const settings = {
      ...(input.visibility ? { requested_visibility: input.visibility } : {}),
      ...(typeof input.allowDownload === "boolean" ? { allow_download: input.allowDownload } : {}),
    };
    return this.requestJson("/sharing/create_shared_link_with_settings", {
      path: input.path,
      ...(Object.keys(settings).length ? { settings } : {}),
    });
  }

  private requestJson(path: string, body: JsonObject): Promise<JsonObject> {
    return this.requestJsonInternal(new URL(`${DROPBOX_API_BASE}${path}`), body);
  }

  private async requestJsonInternal(url: URL, body: JsonObject): Promise<JsonObject> {
    const response = await this.fetchFn(url, {
      method: "POST",
      headers: this.authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(body),
    });
    const text = await response.text();
    const payload = text ? parseJson(text, url.pathname) : {};
    if (!response.ok) {
      throw new Error(`Dropbox API POST ${url.pathname} failed: ${extractErrorMessage(payload, response.statusText)}`);
    }
    if (!isObject(payload)) {
      throw new Error(`Dropbox API POST ${url.pathname} returned a non-object response`);
    }
    return payload;
  }

  private async requestContentJson(path: string, body: Uint8Array, extraHeaders: Record<string, string>): Promise<JsonObject> {
    const url = new URL(`${DROPBOX_CONTENT_BASE}${path}`);
    const response = await this.fetchFn(url, {
      method: "POST",
      headers: this.authHeaders({
        Accept: "application/json",
        "Content-Type": "application/octet-stream",
        ...extraHeaders,
      }),
      body: body as unknown as BodyInit,
    });
    const text = await response.text();
    const payload = text ? parseJson(text, url.pathname) : {};
    if (!response.ok) {
      throw new Error(`Dropbox API POST ${url.pathname} failed: ${extractErrorMessage(payload, response.statusText)}`);
    }
    if (!isObject(payload)) {
      throw new Error(`Dropbox API POST ${url.pathname} returned a non-object response`);
    }
    return payload;
  }

  private authHeaders(extra: Record<string, string>): Record<string, string> {
    return {
      Accept: "application/json",
      Authorization: `Bearer ${this.accessToken}`,
      ...extra,
    };
  }
}

export function formatMetadata(value: unknown): {
  id?: string;
  name?: string;
  pathDisplay?: string;
  pathLower?: string;
  size?: number;
  clientModified?: string;
  serverModified?: string;
  isFolder: boolean;
} {
  if (!isObject(value)) {
    throw new Error("Dropbox metadata must be an object");
  }
  const output: {
    id?: string;
    name?: string;
    pathDisplay?: string;
    pathLower?: string;
    size?: number;
    clientModified?: string;
    serverModified?: string;
    isFolder: boolean;
  } = { isFolder: value[".tag"] === "folder" };
  copyString(output, "id", value.id);
  copyString(output, "name", value.name);
  copyString(output, "pathDisplay", value.path_display);
  copyString(output, "pathLower", value.path_lower);
  copyNumber(output, "size", value.size);
  copyString(output, "clientModified", value.client_modified);
  copyString(output, "serverModified", value.server_modified);
  return output;
}

export function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function isObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function copyString(target: JsonObject, key: string, value: unknown): void {
  if (typeof value === "string" && value.length > 0) {
    target[key] = value;
  }
}

function copyNumber(target: JsonObject, key: string, value: unknown): void {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    target[key] = value;
  }
}

function parseJson(text: string, label: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(`Invalid JSON from Dropbox ${label}`);
  }
}

function parseErrorBody(bytes: Uint8Array): unknown {
  const text = new TextDecoder().decode(bytes);
  return text ? parseJson(text, "error response") : {};
}

function extractErrorMessage(payload: unknown, fallback: string): string {
  if (isObject(payload)) {
    if (typeof payload.error_summary === "string" && payload.error_summary) {
      return payload.error_summary;
    }
    if (typeof payload.message === "string" && payload.message) {
      return payload.message;
    }
    if (typeof payload.error === "string" && payload.error) {
      return payload.error;
    }
  }
  return fallback || "request failed";
}
