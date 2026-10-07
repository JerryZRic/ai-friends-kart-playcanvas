# AI Friends Kart · 六角色非商业试玩

六个带骨骼角色自动加载，选择 WHALE、GEMINI、GPT、CLAUDE、GROK 或 GLM 后即可比赛，其余五位作为 AI 对手。不需要手动导入模型。仍可选用本地 GLB 替换角色。

游戏代码、原创赛车/赛道/道具与原始开放资产遵循 AGPL-3.0-only。六个角色模型的权利与代码分开：项目所有者将其标识为 Tripo Free 输出，仅供非商业使用；具体适用的转分发条款尚未独立核实。公开试玩不代表全部权利已确认，也不授予新的商用、再许可或通用转分发权。AGPL 不会自动覆盖角色模型。详见 [模型声明](MODEL-NOTICE.txt)。本试玩没有广告、支付或模型销售。

仅发布六个最终运行 GLB，不发布新的角色 Blender 工程、高模原件、独立贴图、预览或工作文件。原项目早已公开的两个赛车/道具 Blender 文件保留，供原创 AGPL 资产的对应源码使用。

完整仓库包含模型，将整个 dist 目录放到 HTTP(S) 静态服务器即可。初次角色下载约 49.2 MiB（51.6 MB），同时最多两个下载/解析；按清单验证大小与 SHA-256，全部完成或失败后才开放开始按钮。失败槽位明确显示原创替身，不会把缺失角色标成六个就绪；刷新可重试。

源码 ZIP 不重复六个大 GLB，包含代码、测试、脚本、原创开放资产、原始 Blender 源码及运行模型清单。仅解压 ZIP 可以构建代码，但完整六角色体验/测试还需将公开试玩的 assets/drivers/ 六文件放到 dist/assets/drivers/，或运行 npm run models:fetch。该脚本只从固定公开路径下载并验证，不上传，不覆盖校验不匹配的文件。

Node.js 22+：npm ci → npm run check → npm test → npm run build → npm run test:dist。npm run serve 为可选开发服务器。不支持 file:// 直接打开。

W 油门，S 刹车/倒车，A/D 转向，空格刹车，Shift 漂移，E 道具，Z/C 视角，鼠标右键回看，Q 回正，Esc 暂停，P 继续。

可选本地替换：选角色后选择兼容 GLB，每个 ≤32 MiB；文件仅在当前页面内存中读取，不上传、不保存。恢复默认会返回自动加载的角色。具体要求见 [骨骼与动画约定](docs/local-import.md)。

完整权利说明、构建和验证边界见 [English README](README.md)。
