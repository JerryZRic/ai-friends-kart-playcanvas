# AI Friends Kart · PlayCanvas

[English](README.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [粵語](README.yue.md) | [日本語](README.ja.md) | [한국어](README.ko.md)

[![引擎：PlayCanvas](https://img.shields.io/badge/engine-PlayCanvas-orange)](https://playcanvas.com/)
[![平台：网页 / Windows](https://img.shields.io/badge/platforms-Web%20%2F%20Windows-blue)](https://github.com/JerryZRic/ai-friends-kart-playcanvas/releases)
[![代码：AGPL-3.0-only](https://img.shields.io/badge/code-AGPL--3.0--only-blue)](LICENSE)

使用 **PlayCanvas Engine、TypeScript 和 Vite** 开发的日落海岸街机卡丁车游戏。任选六位骨骼角色车手之一，与其余五位比赛，体验漂移加速、道具对抗和可自由环顾的追逐镜头。

**[浏览器在线试玩](https://jerryzric.github.io/ai-friends-kart-playcanvas/) · [下载 Windows 试玩版](https://github.com/JerryZRic/ai-friends-kart-playcanvas/releases/tag/v0.1.0-windows-playtest.20261007)**

> 游戏界面为简体中文，搭配英文品牌文字。上方语言导航只切换文档。代码与原创资产采用 AGPL-3.0-only；六个角色模型另有非商业限制，详见[许可与模型权利](#license-and-model-rights)。

## dev 自由模式测试

[打开独立 dev 试玩](https://jerryzric.github.io/ai-friends-kart-playcanvas/dev/)：动态 3D 赛道封面、旋转地图预览、可旋转的角色 3D 形象、差异化驾驶属性、画面设置，以及海岸和水上乐园完整圈赛。[功能与验证范围](docs/free-mode.md)。上方稳定版入口与 Windows 版本保持不变。

## 游戏特色

- **六位可选车手：** WHALE、GEMINI、GPT、CLAUDE、GROK 和 GLM，内置骨骼角色模型
- **三圈竞速：** 在日落海岸赛道与五位 AI 对手比赛，包含海景、碰撞、圈数/名次统计和小地图
- **街机驾驶：** 手动油门、刹车、倒车、手刹漂移与漂移加速
- **三种道具：** 涡轮加速、能量护盾与追踪脉冲
- **可视道具箱：** 半透明箱内展示原创 3D 道具，25% 为问号随机箱；拾取后立即消失，比赛运行八秒后刷新。HUD 显示由同一模型投影生成的道具图片。[说明](docs/item-pickups.md)
- **道具 NPC：** 对手会争抢真实道具箱、安全调整路线，并择机加速、开盾或脉冲攻击玩家及其他 NPC；头顶道具和使用特效清晰可见。[说明](docs/npc-tactics.md)
- **双追逐视角：** 鼠标环顾、视角回正与临时后视
- 暂停/重开、音效、键盘操作与屏幕触控按钮
- 可在当前会话中导入本地 GLB 替换角色，不上传文件

## 浏览器试玩

使用启用 **WebGL2** 的浏览器打开 **[GitHub Pages 游戏](https://jerryzric.github.io/ai-friends-kart-playcanvas/)**。等待角色加载，选择车手后开始比赛。

首次角色下载合计约 **51.6 MB**，最多同时下载/准备两个模型。加载界面显示真实字节进度、解压和准备阶段；临时错误会有限次重试，也可只重试失败文件，保留已成功加载的模型。缺失模型会明确标注为原创替身。

无需 ChatGPT 登录、模型服务账号或运行时 CDN。游戏与角色资源均由同一分发包提供。

## Windows 试玩版

需要 **Windows 10/11 64 位及支持 WebGL2 的 GPU**。这是预发布试玩版本，并非正式生产版本。

1. 从[发布页面](https://github.com/JerryZRic/ai-friends-kart-playcanvas/releases/tag/v0.1.0-windows-playtest.20261007)下载 [AI-Friends-Kart-Windows-x64-20261007.zip](https://github.com/JerryZRic/ai-friends-kart-playcanvas/releases/download/v0.1.0-windows-playtest.20261007/AI-Friends-Kart-Windows-x64-20261007.zip)。
2. 将 **整个 ZIP 完整解压**到一个文件夹。
3. 运行 **AI Friends Kart.exe**，保持旁边的 DLL、`resources` 和 `locales` 文件夹完整。
4. 按 **F11** 切换全屏。

已内置六个角色，可离线试玩。无需 Node.js、安装或管理员权限。请勿为了运行游戏而关闭 Windows 安全防护。

压缩包包含 `Game-Corresponding-Source.zip`、附有桌面包装源码及构建说明的 `Desktop-Source`，以及许可声明。桌面打包材料随该发布包提供；本仓库的 npm 脚本构建的是网页游戏。

## 操作

| 输入 | 功能 |
| --- | --- |
| `W` / `↑` | 油门；松开后滑行 |
| `A` / `←`、`D` / `→` | 向左/右转向 |
| `S` / `↓` | 先刹车，继续按住则倒车 |
| `Space` | 刹车，不倒车 |
| `Left Shift` + 转向 | 漂移；蓄力后松开 Shift 释放加速 |
| `E` | 使用已拾取的道具 |
| `Z` / `C` | 切换追逐视角 |
| 按住鼠标右键 | 临时后视 |
| 点击赛道后移动鼠标 | 环顾镜头 |
| `Q` | 镜头回正 |
| `Esc` | 暂停并释放鼠标 |
| `P` / 暂停按钮 | 暂停/继续 |

如果无法捕获鼠标，可按住左键拖动环顾。触控按钮提供油门、转向、倒车、刹车与漂移；点击道具面板使用道具。菜单按钮支持原生键盘操作。

## 开发与构建

需要 **Node.js 22.12 或更新版本**及 npm。

```sh
git clone https://github.com/JerryZRic/ai-friends-kart-playcanvas.git
cd ai-friends-kart-playcanvas
npm ci
npm run dev
```

打开 Vite 输出的 HTTP 地址。检查并构建生产分发包：

```sh
npm run check
npm test
npm run build
npm run test:dist
npm run preview
```

通过 HTTP(S) 提供完整 **`dist/`** 目录，不要以 `file://` 方式打开 `index.html`。相对路径同时支持域名根目录和仓库子目录。许可声明、`source.html` 与 `source.zip` 应与游戏一同部署。

完整克隆包含 `public/assets/drivers/` 下的六个驾驶模型压缩档，以及 `public/assets/portraits/` 下的六个独立站姿肖像压缩档。线上较小的 `source.zip` 包含代码、测试、两份校验清单、构建文件及原创可编辑资产，但不重复打包这两组角色档案。解压该源码包后可这样恢复：

```sh
npm ci
npm run models:fetch
npm run build
```

下载脚本使用独立 `/dev/` 预览的固定公开路径，按[驾驶模型清单](docs/runtime-models.json)及[站姿肖像清单](docs/portrait-models.json)校验压缩及解压后的哈希，并拒绝覆盖不匹配的本地文件。保留不变的稳定版根目录不包含新肖像。没有角色档案时，代码仍可构建；完整画面需要还原两组模型。

### GitHub Pages

[Build and publish PlayCanvas game 工作流](.github/workflows/pages.yml)需 **手动运行**。在仓库 **Settings → Pages** 中选择 **GitHub Actions**，然后在 `main` 分支运行工作流并勾选 **Publish**。发布前会对所选提交执行检查、测试和构建；普通推送不会部署游戏。

### 目录结构

- `src/`：PlayCanvas 场景、赛道、比赛逻辑、输入、镜头与角色加载
- `public/assets/`：内置运行时资源，含六个压缩车手模型
- `models/`：原创卡丁车与场景道具的可编辑源文件
- `tests/`：逻辑、加载、界面和引擎级检查
- `scripts/`：源码打包、运行时模型下载与分发检查
- `docs/`：模型清单、本地导入契约和技术验证说明

## 本地替换车手

选择角色槽位并导入兼容 GLB，或多选文件名中各含唯一槽位名称标记的文件。每个文件上限 **32 MiB**，最多同时处理两个。导入文件仅保留在当前页面内存中，不上传、不持久保存。失败或取消会保留原角色；**恢复默认**会恢复内置角色或明确标注的替身。

兼容模型与验证规则见[骨骼及导入契约](docs/local-import.md)。

## 验证

自动检查涵盖独立于引擎的比赛/输入逻辑、真实 PlayCanvas CPU/空设备骨骼加载、模拟界面集成及静态分发检查，不能据此认定 GPU 画面、原生鼠标锁定或性能已获验证。详见[测试覆盖与限制](docs/MIGRATION-PARITY.md)及[海水着色器回归说明](docs/WATER-REGRESSION.md)。

<a id="license-and-model-rights"></a>
## 许可与模型权利

**代码及原创游戏资产：** AGPL-3.0-only，包括原创界面、赛道、卡丁车、道具及可编辑源文件。见 [LICENSE](LICENSE)、[NOTICE](NOTICE) 和 [THIRD-PARTY-NOTICES.txt](THIRD-PARTY-NOTICES.txt)。PlayCanvas 与 fflate 保留各自的 MIT 许可。

**六个角色的驾驶与独立站姿肖像模型：** 权利单独处理。项目所有者将其标注为带有非商业限制的 Tripo Free 输出；确切再分发条款尚未独立核实。纳入本仓库不授予新的模型许可、Creative Commons 许可或商业使用权。AGPL 不会重新授权角色。复用或再分发前，请确认适用权利并取得所需许可，详见 [MODEL-NOTICE.txt](MODEL-NOTICE.txt)。

仓库包含最终角色运行文件，不包含角色 Blender 工程或高模制作源文件。原创卡丁车/道具的可编辑文件仍作为对应源码提供。本演示没有广告、付款或商业模型销售。
