import { Buffer } from "node:buffer";
import { DropboxClient, formatMetadata, readString } from "./client";
import type {
  CreateSharedLinkInput,
  DropboxSecrets,
  DownloadFileInput,
  ListFolderInput,
  SearchFilesInput,
  UploadFileInput,
} from "./schemas";

type WithSecrets<T> = T & DropboxSecrets;
type JsonObject = Record<string, unknown>;

export async function listFolder(input: WithSecrets<ListFolderInput>) {
  const payload = await new DropboxClient(input.accessToken).listFolder(input);
  const rawEntries = Array.isArray(payload.entries) ? payload.entries : [];
  return {
    success: true as const,
    entries: rawEntries.map(formatMetadata),
    hasMore: payload.has_more === true,
    ...(readString(payload.cursor) ? { cursor: payload.cursor as string } : {}),
  };
}

export async function searchFiles(input: WithSecrets<SearchFilesInput>) {
  const payload = await new DropboxClient(input.accessToken).searchFiles(input);
  const rawMatches = Array.isArray(payload.matches) ? payload.matches : [];
  return {
    success: true as const,
    matches: rawMatches.map((value) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new Error("Dropbox search match must be an object");
      }
      const match = value as JsonObject;
      const metadata = match.metadata;
      return {
        ...(readString(match.match_type) ? { matchType: match.match_type as string } : {}),
        metadata: formatMetadata(metadata),
      };
    }),
    hasMore: payload.more === true,
  };
}

export async function uploadFile(input: WithSecrets<UploadFileInput>) {
  const payload = await new DropboxClient(input.accessToken).uploadFile(input);
  return {
    success: true as const,
    file: formatMetadata(payload),
  };
}

export async function downloadFile(input: WithSecrets<DownloadFileInput>) {
  const result = await new DropboxClient(input.accessToken).downloadFile(input);
  const contentBase64 = Buffer.from(result.bytes).toString("base64");
  const name = readString(result.metadata.name);
  const text = input.decodeText ? new TextDecoder("utf-8", { fatal: true }).decode(result.bytes) : undefined;
  return {
    success: true as const,
    path: input.path,
    ...(name ? { name } : {}),
    ...(result.mimeType ? { mimeType: result.mimeType } : {}),
    sizeBytes: result.bytes.byteLength,
    contentBase64,
    ...(text !== undefined ? { contentText: text } : {}),
  };
}

export async function createSharedLink(input: WithSecrets<CreateSharedLinkInput>) {
  const payload = await new DropboxClient(input.accessToken).createSharedLink(input);
  const url = readString(payload.url);
  if (!url) {
    throw new Error("Dropbox shared-link response is missing url");
  }
  const visibility = payload.link_permissions && typeof payload.link_permissions === "object" && !Array.isArray(payload.link_permissions)
    ? (payload.link_permissions as JsonObject).visibility
    : undefined;
  return {
    success: true as const,
    url,
    ...(readString(payload.name) ? { name: payload.name as string } : {}),
    ...(readString(payload.path_display) ? { pathDisplay: payload.path_display as string } : {}),
    ...(typeof visibility === "string" ? { visibility } : {}),
  };
}
