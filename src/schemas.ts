import type {
  InputSchemaMetaType,
  OutputSchemaMetaType,
  SecretSchemaMetaType,
} from "@fastgpt-plugin/sdk-factory";
import z from "zod";

const pathSchema = z.string().max(4096).refine(
  (value) => value === "" || value.startsWith("/") || value.startsWith("id:"),
  "Dropbox paths must be empty, absolute paths, or id: paths.",
).meta({
  title: "Dropbox path",
  description: "A Dropbox path such as /Reports/file.pdf, or an id: path. Empty means the root folder.",
  toolDescription: "Dropbox path.",
} satisfies InputSchemaMetaType);

const filePathSchema = pathSchema.min(1).refine(
  (value) => value !== "/" && !value.endsWith("/"),
  "A file path must identify a file, not a folder.",
);

export const dropboxSecretSchema = z.object({
  accessToken: z.string().min(1).max(4096).meta({
    title: "Dropbox access token",
    description: "Dropbox OAuth access token. Store it as a FastGPT secret and grant only the scopes required by the selected tools.",
    isSecret: true,
  } satisfies SecretSchemaMetaType),
});

export const listFolderInputSchema = z.object({
  path: pathSchema.default(""),
  recursive: z.boolean().default(false).meta({
    title: "Recursive",
    description: "Include files in all descendant folders.",
    toolDescription: "Whether to list nested folders recursively.",
  } satisfies InputSchemaMetaType),
  includeDeleted: z.boolean().default(false).meta({
    title: "Include deleted",
    description: "Include deleted entries in the result.",
    toolDescription: "Whether to include deleted Dropbox entries.",
  } satisfies InputSchemaMetaType),
  limit: z.number().int().min(1).max(2000).default(100).meta({
    title: "Limit",
    description: "Maximum number of entries returned by Dropbox.",
    toolDescription: "Maximum number of entries to return.",
  } satisfies InputSchemaMetaType),
  cursor: z.string().min(1).max(4096).optional().nullable().meta({
    title: "Cursor",
    description: "Cursor returned by a previous listFolder call. When present, the other listing options are ignored.",
    toolDescription: "Dropbox pagination cursor.",
  } satisfies InputSchemaMetaType),
});

export const searchFilesInputSchema = z.object({
  query: z.string().min(1).max(1024).meta({
    title: "Search query",
    description: "Text to search for in Dropbox file and folder names or content.",
    toolDescription: "Dropbox search text.",
  } satisfies InputSchemaMetaType),
  path: pathSchema.optional().nullable().meta({
    title: "Search path",
    description: "Optional folder path that limits the search scope.",
    toolDescription: "Optional Dropbox folder path to search within.",
  } satisfies InputSchemaMetaType),
  maxResults: z.number().int().min(1).max(1000).default(20).meta({
    title: "Maximum results",
    description: "Maximum number of search matches.",
    toolDescription: "Maximum Dropbox search results.",
  } satisfies InputSchemaMetaType),
  filenameOnly: z.boolean().default(false).meta({
    title: "Filename only",
    description: "Search only file and folder names instead of content too.",
    toolDescription: "Restrict the search to filenames.",
  } satisfies InputSchemaMetaType),
});

export const uploadFileInputSchema = z.object({
  path: filePathSchema.meta({
    title: "Upload path",
    description: "Destination file path in Dropbox.",
    toolDescription: "Dropbox destination file path.",
  } satisfies InputSchemaMetaType),
  mimeType: z.string().min(1).max(255).optional().nullable().meta({
    title: "MIME type",
    description: "Optional content MIME type used for local metadata only.",
    toolDescription: "Optional file MIME type.",
  } satisfies InputSchemaMetaType),
  contentText: z.string().max(10_000_000).optional().nullable().meta({
    title: "Text content",
    description: "UTF-8 text to upload. Provide exactly one of contentText or contentBase64.",
    toolDescription: "Text content to upload.",
  } satisfies InputSchemaMetaType),
  contentBase64: z.string().min(1).max(50_000_000).optional().nullable().meta({
    title: "Base64 content",
    description: "Base64-encoded binary content. Provide exactly one of contentText or contentBase64.",
    toolDescription: "Base64-encoded content to upload.",
  } satisfies InputSchemaMetaType),
  mode: z.enum(["add", "overwrite"]).default("add").meta({
    title: "Write mode",
    description: "Add a new file or overwrite the file at the path.",
    toolDescription: "Dropbox upload mode.",
  } satisfies InputSchemaMetaType),
  autorename: z.boolean().default(true).meta({
    title: "Auto-rename",
    description: "Automatically rename the file if the destination already exists in add mode.",
    toolDescription: "Whether Dropbox may auto-rename a conflicting file.",
  } satisfies InputSchemaMetaType),
  mute: z.boolean().default(false).meta({
    title: "Mute notifications",
    description: "Do not notify collaborators about this upload.",
    toolDescription: "Whether to mute Dropbox notifications.",
  } satisfies InputSchemaMetaType),
  strictConflict: z.boolean().default(false).meta({
    title: "Strict conflict",
    description: "Fail rather than overwrite when a conflict is detected.",
    toolDescription: "Whether to enforce strict conflict checking.",
  } satisfies InputSchemaMetaType),
}).refine(
  (input) => [typeof input.contentText === "string", typeof input.contentBase64 === "string"].filter(Boolean).length === 1,
  "Provide exactly one of contentText or contentBase64.",
);

export const downloadFileInputSchema = z.object({
  path: filePathSchema.meta({
    title: "File path",
    description: "Dropbox file path or id: path to download.",
    toolDescription: "Dropbox file path.",
  } satisfies InputSchemaMetaType),
  decodeText: z.boolean().default(false).meta({
    title: "Decode text",
    description: "Also return UTF-8 text. Keep disabled for binary files.",
    toolDescription: "Whether to decode downloaded bytes as UTF-8 text.",
  } satisfies InputSchemaMetaType),
});

export const createSharedLinkInputSchema = z.object({
  path: filePathSchema.meta({
    title: "File or folder path",
    description: "Dropbox file or folder path for the shared link.",
    toolDescription: "Dropbox path to share.",
  } satisfies InputSchemaMetaType),
  visibility: z.enum(["public", "team_only", "password"]).optional().nullable().meta({
    title: "Visibility",
    description: "Optional requested link visibility.",
    toolDescription: "Dropbox shared-link visibility.",
  } satisfies InputSchemaMetaType),
  allowDownload: z.boolean().optional().nullable().meta({
    title: "Allow download",
    description: "Whether viewers may download the shared content.",
    toolDescription: "Whether downloading is allowed from the shared link.",
  } satisfies InputSchemaMetaType),
});

const fileOutputSchema = z.object({
  id: z.string().optional().meta({ title: "ID" } satisfies OutputSchemaMetaType),
  name: z.string().optional().meta({ title: "Name" } satisfies OutputSchemaMetaType),
  pathDisplay: z.string().optional().meta({ title: "Path" } satisfies OutputSchemaMetaType),
  pathLower: z.string().optional().meta({ title: "Lowercase path" } satisfies OutputSchemaMetaType),
  size: z.number().nonnegative().optional().meta({ title: "Size" } satisfies OutputSchemaMetaType),
  clientModified: z.string().optional().meta({ title: "Client modified" } satisfies OutputSchemaMetaType),
  serverModified: z.string().optional().meta({ title: "Server modified" } satisfies OutputSchemaMetaType),
  isFolder: z.boolean().meta({ title: "Is folder" } satisfies OutputSchemaMetaType),
});

export const listFolderOutputSchema = z.object({
  success: z.literal(true).meta({ title: "Success" } satisfies OutputSchemaMetaType),
  entries: z.array(fileOutputSchema).meta({ title: "Entries" } satisfies OutputSchemaMetaType),
  hasMore: z.boolean().meta({ title: "Has more" } satisfies OutputSchemaMetaType),
  cursor: z.string().optional().meta({ title: "Cursor" } satisfies OutputSchemaMetaType),
});

export const searchFilesOutputSchema = z.object({
  success: z.literal(true).meta({ title: "Success" } satisfies OutputSchemaMetaType),
  matches: z.array(z.object({
    matchType: z.string().optional().meta({ title: "Match type" } satisfies OutputSchemaMetaType),
    metadata: fileOutputSchema,
  })).meta({ title: "Matches" } satisfies OutputSchemaMetaType),
  hasMore: z.boolean().meta({ title: "Has more" } satisfies OutputSchemaMetaType),
});

export const uploadFileOutputSchema = z.object({
  success: z.literal(true).meta({ title: "Success" } satisfies OutputSchemaMetaType),
  file: fileOutputSchema,
});

export const downloadFileOutputSchema = z.object({
  success: z.literal(true).meta({ title: "Success" } satisfies OutputSchemaMetaType),
  path: z.string().meta({ title: "Path" } satisfies OutputSchemaMetaType),
  name: z.string().optional().meta({ title: "Name" } satisfies OutputSchemaMetaType),
  mimeType: z.string().optional().meta({ title: "MIME type" } satisfies OutputSchemaMetaType),
  sizeBytes: z.number().int().nonnegative().meta({ title: "Size bytes" } satisfies OutputSchemaMetaType),
  contentBase64: z.string().meta({ title: "Content base64" } satisfies OutputSchemaMetaType),
  contentText: z.string().optional().meta({ title: "Content text" } satisfies OutputSchemaMetaType),
});

export const createSharedLinkOutputSchema = z.object({
  success: z.literal(true).meta({ title: "Success" } satisfies OutputSchemaMetaType),
  url: z.string().url().meta({ title: "Shared URL" } satisfies OutputSchemaMetaType),
  name: z.string().optional().meta({ title: "Name" } satisfies OutputSchemaMetaType),
  pathDisplay: z.string().optional().meta({ title: "Path" } satisfies OutputSchemaMetaType),
  visibility: z.string().optional().meta({ title: "Visibility" } satisfies OutputSchemaMetaType),
});

export type DropboxSecrets = z.output<typeof dropboxSecretSchema>;
export type ListFolderInput = z.output<typeof listFolderInputSchema>;
export type SearchFilesInput = z.output<typeof searchFilesInputSchema>;
export type UploadFileInput = z.output<typeof uploadFileInputSchema>;
export type DownloadFileInput = z.output<typeof downloadFileInputSchema>;
export type CreateSharedLinkInput = z.output<typeof createSharedLinkInputSchema>;
