# Dropbox FastGPT 插件

将 Dropbox 的文件搜索、目录浏览、上传、下载和共享链接能力接入 FastGPT。

## 工具

- `listFolder`：列出文件夹内容，支持递归和 cursor 分页。
- `searchFiles`：按文本、目录范围或文件名搜索文件。
- `uploadFile`：上传 UTF-8 文本或 base64 文件内容，可控制冲突处理。
- `downloadFile`：下载文件并返回 base64，可选返回 UTF-8 文本。
- `createSharedLink`：创建带可选可见性和下载设置的共享链接。

## Secret 与权限

配置插件 secret：

- `accessToken`：Dropbox OAuth access token。请在 Dropbox App Console 创建应用并按最小权限原则授予 scopes；不要把 token 放进输入参数、README、测试、`.env` 或 Git 历史。

插件固定调用 Dropbox API v2 的 `api.dropboxapi.com` 和 `content.dropboxapi.com`，不接受用户输入的 endpoint，避免把请求导向任意主机。上传和下载内容通过 base64 或文本字段传递，建议对文件大小设置合理限制。

## 本地开发

```bash
pnpm install --ignore-workspace
pnpm run type-check
pnpm test
pnpm build
pnpm check
pnpm run pack
```

`pnpm run pack` 会生成 `dropbox.pkg`。本项目的测试使用 mock fetch 覆盖请求构造、认证头、响应解析、二进制内容和错误路径；当前环境没有 Dropbox 凭证，因此未执行真实 Dropbox API 集成测试。
