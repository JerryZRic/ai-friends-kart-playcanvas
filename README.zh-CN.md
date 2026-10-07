# AI Friends Kart · PlayCanvas 移植版

新建的独立 HTML 项目，底层使用 **PlayCanvas Engine + TypeScript + Vite**。旧版 AI Friends Kart 和稳定版 Neon Kart 保持不变；Windows 打包暂缓。

[GitHub Pages 试玩](https://jerryzric.github.io/ai-friends-kart-playcanvas/) · [完整说明](README.md) · [迁移与测试记录](docs/MIGRATION-PARITY.md)

六个骨骼角色 WHALE、GEMINI、GPT、CLAUDE、GROK、GLM 自动加载，可任选一个与其余五个 AI 比赛。保留原日落海岸赛道、三圈比赛、漂移加速、道具、碰撞、倒车、暂停/重开、双追逐视角、鼠标环顾/回正/后视、小地图、音效和触屏按钮。界面沿用简体中文与英文品牌文字，不含运行时语言切换。

## 运行

Node.js 22.12+：`npm ci` → `npm run check` → `npm test` → `npm run build` → `npm run test:dist` → `npm run preview`。通过显示的 HTTP 地址打开，不能直接双击 file:// HTML。完整 dist 目录不依赖 ChatGPT 登录、外部模型服务或运行时 CDN。

角色首次下载约 51.6 MB，最多两个并发。显示真实下载字节及独立解压/准备阶段；临时网络错误有有限指数退避重试，也可手动只重试失败资源。失败槽位明确使用原创替身。

W/↑ 油门，S/↓ 刹车后倒车，A/D 或 ←/→ 转向，空格刹车，左 Shift+转向漂移，松开加速；E 道具，Z/C 视角，右键后视，点击赛道后鼠标环顾，Q 回正，Esc 暂停/释放，P 暂停/继续。

可本地导入符合契约的 GLB，每个最多 32 MiB；只保留当前页面内存，不上传、不持久化，失败保留旧外观。[本地模型契约](docs/local-import.md)

## 权利与验证

代码、原创赛道/赛车/道具仍是 AGPL-3.0-only；六个角色权利另行说明，用户标注为 Tripo Free 非商业模型，确切转分发条款未独立核实，本项目不增加任何角色授权或商业权利。[角色声明](MODEL-NOTICE.txt)

源码下载 source.zip 包含代码、测试、原创资产及其原始 Blender 文件，不含角色工程/高模/私人参考，也不重复打包六个大型角色文件。源码包解压后可运行 `npm run models:fetch` 获取清单校验的公开运行文件。

自动化测试不能替代真实 GPU 试玩：当前云浏览器禁用 WebGL，画面、GPU 性能和浏览器原生鼠标锁定仍需在支持 WebGL2 的浏览器验证。
