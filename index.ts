import { createToolHandler, defineToolSet } from "@fastgpt-plugin/sdk-factory";
import { createSharedLink, downloadFile, listFolder, searchFiles, uploadFile } from "./src/operations";
import {
  createSharedLinkInputSchema,
  createSharedLinkOutputSchema,
  downloadFileInputSchema,
  downloadFileOutputSchema,
  dropboxSecretSchema,
  listFolderInputSchema,
  listFolderOutputSchema,
  searchFilesInputSchema,
  searchFilesOutputSchema,
  uploadFileInputSchema,
  uploadFileOutputSchema,
  type DropboxSecrets,
} from "./src/schemas";

function getSecrets(secrets: DropboxSecrets | undefined): DropboxSecrets {
  if (!secrets?.accessToken?.trim()) {
    throw new Error("Dropbox accessToken secret is required");
  }
  return secrets;
}

const listFolderHandler = createToolHandler({
  inputSchema: listFolderInputSchema,
  outputSchema: listFolderOutputSchema,
  secretSchema: dropboxSecretSchema,
  handler: async (input, ctx) => listFolder({ ...input, ...getSecrets(ctx.secrets) }),
});

const searchFilesHandler = createToolHandler({
  inputSchema: searchFilesInputSchema,
  outputSchema: searchFilesOutputSchema,
  secretSchema: dropboxSecretSchema,
  handler: async (input, ctx) => searchFiles({ ...input, ...getSecrets(ctx.secrets) }),
});

const uploadFileHandler = createToolHandler({
  inputSchema: uploadFileInputSchema,
  outputSchema: uploadFileOutputSchema,
  secretSchema: dropboxSecretSchema,
  handler: async (input, ctx) => uploadFile({ ...input, ...getSecrets(ctx.secrets) }),
});

const downloadFileHandler = createToolHandler({
  inputSchema: downloadFileInputSchema,
  outputSchema: downloadFileOutputSchema,
  secretSchema: dropboxSecretSchema,
  handler: async (input, ctx) => downloadFile({ ...input, ...getSecrets(ctx.secrets) }),
});

const createSharedLinkHandler = createToolHandler({
  inputSchema: createSharedLinkInputSchema,
  outputSchema: createSharedLinkOutputSchema,
  secretSchema: dropboxSecretSchema,
  handler: async (input, ctx) => createSharedLink({ ...input, ...getSecrets(ctx.secrets) }),
});

export default defineToolSet({
  manifest: {
    pluginId: "dropbox",
    name: { en: "Dropbox", "zh-CN": "Dropbox" },
    description: {
      en: "Search, upload, download, and share files in Dropbox.",
      "zh-CN": "搜索、上传、下载和共享 Dropbox 文件。",
    },
    version: "0.1.0",
    versionDescription: {
      en: "Initial Dropbox file-management toolset.",
      "zh-CN": "初始 Dropbox 文件管理工具集。",
    },
    toolDescription: "Use a Dropbox OAuth access token to manage files through fixed Dropbox API v2 endpoints.",
    tutorialUrl: "https://www.dropbox.com/developers/documentation/http/documentation",
    tags: ["tools", "productivity"],
    permission: [],
  },
  secretSchema: dropboxSecretSchema,
  children: [
    {
      id: "listFolder",
      name: { en: "List Folder", "zh-CN": "列出文件夹" },
      description: { en: "List files and folders in Dropbox.", "zh-CN": "列出 Dropbox 中的文件和文件夹。" },
      toolDescription: "List a Dropbox folder, optionally recursively, with cursor pagination.",
      handler: listFolderHandler,
    },
    {
      id: "searchFiles",
      name: { en: "Search Files", "zh-CN": "搜索文件" },
      description: { en: "Search Dropbox files and folders.", "zh-CN": "搜索 Dropbox 文件和文件夹。" },
      toolDescription: "Search Dropbox by text, optional folder path, result limit, and filename-only mode.",
      handler: searchFilesHandler,
    },
    {
      id: "uploadFile",
      name: { en: "Upload File", "zh-CN": "上传文件" },
      description: { en: "Upload text or base64 content to Dropbox.", "zh-CN": "将文本或 base64 内容上传到 Dropbox。" },
      toolDescription: "Upload UTF-8 text or base64 bytes to a Dropbox path with conflict controls.",
      handler: uploadFileHandler,
    },
    {
      id: "downloadFile",
      name: { en: "Download File", "zh-CN": "下载文件" },
      description: { en: "Download a Dropbox file as base64 content.", "zh-CN": "将 Dropbox 文件下载为 base64 内容。" },
      toolDescription: "Download file bytes from Dropbox and optionally decode them as UTF-8 text.",
      handler: downloadFileHandler,
    },
    {
      id: "createSharedLink",
      name: { en: "Create Shared Link", "zh-CN": "创建共享链接" },
      description: { en: "Create a Dropbox shared link.", "zh-CN": "创建 Dropbox 共享链接。" },
      toolDescription: "Create a Dropbox shared link with optional visibility and download settings.",
      handler: createSharedLinkHandler,
    },
  ],
});
