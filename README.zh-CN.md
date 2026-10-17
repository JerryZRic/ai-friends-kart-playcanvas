# AI Friends Kart · PlayCanvas

[English](README.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [粵語](README.yue.md) | [日本語](README.ja.md) | [한국어](README.ko.md)

[![引擎：PlayCanvas](https://img.shields.io/badge/engine-PlayCanvas-orange)](https://playcanvas.com/)
[![平台：网页 / Windows](https://img.shields.io/badge/platforms-Web%20%2F%20Windows-blue)](https://github.com/JerryZRic/ai-friends-kart-playcanvas/releases)
[![代码：AGPL-3.0-only](https://img.shields.io/badge/code-AGPL--3.0--only-blue)](LICENSE)

使用 **PlayCanvas Engine、TypeScript 和 Vite** 开发的街机卡丁车游戏，包含 12 张陆地地图和 1 张水上地图。任选六位骨骼角色车手之一，与其余五位比赛，体验漂移加速、道具对抗和可自由环顾的追逐镜头。

**[浏览器 main 版](https://jerryzric.github.io/ai-friends-kart-playcanvas/) · [独立 dev 预览](https://jerryzric.github.io/ai-friends-kart-playcanvas/dev/) · [Web / HTML 与 Windows 下载](https://github.com/JerryZRic/ai-friends-kart-playcanvas/releases)**

> 游戏界面为简体中文，搭配英文品牌文字。上方语言导航只切换文档。代码与原创资产（音乐除外）采用 AGPL-3.0-only；六个角色模型另有非商业限制，详见[许可与模型权利](#license-and-model-rights)。

## v1.1.1 首页热修复（正式稳定版）

**v1.1.1 是 Web / HTML 与 Windows x64 正式稳定热修复版（`prerelease=false`、`latest=true`）。** 本次修复首页渲染控制权问题；用户已在 Firefox 中验证 dev 提交 `73fbe76ba477b8595006e41998efdf83e5e2da1b` 的修复效果。本次小范围热修复的验证范围为针对性回归、构建与打包检查及原生 Windows 启动；具体结果及限制见 [v1.1.1 发布说明](https://github.com/JerryZRic/ai-friends-kart-playcanvas/releases/tag/v1.1.1)。v1.1.1 未重跑完整 2,073 项测试，v1.1.0 的全量测试结果仅作为该旧版本的历史证据。下方推荐的热修复下载已更新为 v1.1.1；[上一稳定版 v1.1.0 仍可下载](https://github.com/JerryZRic/ai-friends-kart-playcanvas/releases/tag/v1.1.0)。

## v1.1.0 上一稳定版

**v1.1.0 是 Web / HTML 与 Windows x64 上一正式稳定版。** 保留 13 张地图、六名车手和 55 个主题 / 330 件零件的六槽食物车库，11 张新增陆地地图均包含场景丰富化成果。已发布文件、源码提交、校验值及验证说明以[发布页面](https://github.com/JerryZRic/ai-friends-kart-playcanvas/releases/tag/v1.1.0)为准。站点根目录为 main 发布入口，`/dev/` 是独立开发预览。

自由模式包含六角色随机动态封面、旋转地图预览、角色 3D 检视、车辆选择、简单 / 普通 / 困难比赛设置与画面设置。封面使用自定义 PlayCanvas 2D 网格动画，并非 Cubism；大肥鱼（WHALE）出现概率为 35%，其余五位均分 65%。故事模式仍显示开发中提示。[实现说明与限制](docs/free-mode.md)。

### 地图目录

陆地赛道按 **01–12** 排列，水上地图 **A01** 放在最后。显示编号不改变原有地图 ID、存档选择或直达链接。

- **01** [日落海岸](https://jerryzric.github.io/ai-friends-kart-playcanvas/index.html?screen=maps&map=coast) · `coast`
- **02** [云岭盘山道](https://jerryzric.github.io/ai-friends-kart-playcanvas/index.html?screen=maps&map=mountain) · `mountain`
- **03** [灯阶旧城环线](https://jerryzric.github.io/ai-friends-kart-playcanvas/index.html?screen=maps&map=town) · `town`
- **04** [赤砾采石环道](https://jerryzric.github.io/ai-friends-kart-playcanvas/index.html?screen=maps&map=quarry) · `quarry`
- **05** [杉影星台环线](https://jerryzric.github.io/ai-friends-kart-playcanvas/index.html?screen=maps&map=forest) · `forest`
- **06** [发条工坊回旋道](https://jerryzric.github.io/ai-friends-kart-playcanvas/index.html?screen=maps&map=workshop) · `workshop`
- **07** [谷风麦垄回环](https://jerryzric.github.io/ai-friends-kart-playcanvas/index.html?screen=maps&map=harvest) · `harvest`
- **08** [星砂古驿](https://jerryzric.github.io/ai-friends-kart-playcanvas/index.html?screen=maps&map=desert) · `desert`
- **09** [霜环雪站](https://jerryzric.github.io/ai-friends-kart-playcanvas/index.html?screen=maps&map=snow) · `snow`
- **10** [玄岩环冕](https://jerryzric.github.io/ai-friends-kart-playcanvas/index.html?screen=maps&map=caldera) · `caldera`
- **11** [蔓穹花园](https://jerryzric.github.io/ai-friends-kart-playcanvas/index.html?screen=maps&map=garden) · `garden`
- **12** [铜翼空港](https://jerryzric.github.io/ai-friends-kart-playcanvas/index.html?screen=maps&map=airfield) · `airfield`
- **A01** [晴空水上乐园](https://jerryzric.github.io/ai-friends-kart-playcanvas/index.html?screen=maps&map=waterpark) · `waterpark`


## 原创陆地赛道

**云岭盘山道**：39 米高低差、带倾角的山路弯道、真正上下分层的高架交叉，以及原创山石、松林、护栏和观景木屋。沿用改装车库、六名车手、比赛设置与统一操作。[在地图列表中选择](https://jerryzric.github.io/ai-friends-kart-playcanvas/index.html?screen=maps&map=mountain)。[几何、源码与验证范围](docs/land-map-catalog.md)。

**灯阶旧城环线 / Lantern Terrace Rally** 新增山城集市赛道：用方向键选择灯巷或电车大道，经过真实高低分层街桥与原创建筑。玩家与 NPC 共用现有卡丁车竞速系统。[打开旧城地图](https://jerryzric.github.io/ai-friends-kart-playcanvas/index.html?screen=maps&map=town)。

**赤砾采石环道 / Redstrata Quarry** 新增干燥砂岩采石场，包含石脊窄道、重载环坡与木栈桥双层交叉。[打开采石场地图](https://jerryzric.github.io/ai-friends-kart-playcanvas/index.html?screen=maps&map=quarry)。

**杉影星台环线 / CedarLight Observatory** 新增连贯杉林山坡、真实倾斜林碗、镜台便道与观星环路分岔，以及跨越先前山谷的高架林冠桥。[打开杉林地图](https://jerryzric.github.io/ai-friends-kart-playcanvas/index.html?screen=maps&map=forest)。

**发条工坊回旋道 / Clockwind Workshop** 新增原创巨型钟表工坊：沿四分之三圈木制螺旋坡爬升，跨过先前道路，在工具柜弯道与木台外沿之间选择路线。[打开工坊地图](https://jerryzric.github.io/ai-friends-kart-playcanvas/index.html?screen=maps&map=workshop)。

**谷风麦垄回环 / Amberwind Harvest** 连接麦垄梯田、起伏果园与风车山脊，可以选择真正穿过谷仓的便道或宽阔田埂外环。[打开收获田野地图](https://jerryzric.github.io/ai-friends-kart-playcanvas/index.html?screen=maps&map=harvest)。

**星砂古驿 / Sunweave Caravan** 连接真实起伏的沙脊、风蚀砂岩弯廊与开放古驿庭院，可以选择双石拱折径或宽阔风帆庭环。[打开沙丘古驿地图](https://jerryzric.github.io/ai-friends-kart-playcanvas/index.html?screen=maps&map=desert)。

**霜环雪站 / Frostloop Depot** 穿行两座相向雪岭弯谷和低鞍部，在维修场折径与宽阔倾斜雪台之间选线，沿层叠石坡返回。[打开雪岭车站地图](https://jerryzric.github.io/ai-friends-kart-playcanvas/index.html?screen=maps&map=snow)。

**玄岩环冕 / Basalt Crown** 沿开阔火山岩环缘爬升，下探钩形石谷，在内侧技术弯与外侧宽路之间选线，两条下层道路分别穿过真实石桥拱洞。[打开玄岩环冕地图](https://jerryzric.github.io/ai-friends-kart-playcanvas/index.html?screen=maps&map=caldera)。

**蔓穹花园 / Verdant Canopy** 沿层叠花园连续弯爬上花瓣高台，在通透木架曲径与外园宽弧之间选线，穿过起伏南坡返回低地。[打开蔓穹花园地图](https://jerryzric.github.io/ai-friends-kart-playcanvas/index.html?screen=maps&map=garden)。

**铜翼空港 / Copperwing Airfield** 串联起步跑道、观景山脊连续弯与下降丘陵，可选择通透机库中的窄线或外围宽滑行道。原创静态飞机展品布置在赛车道路之外。[打开铜翼空港地图](https://jerryzric.github.io/ai-friends-kart-playcanvas/index.html?screen=maps&map=airfield)。

## 六槽食物车库

[打开main 版车库](https://jerryzric.github.io/ai-friends-kart-playcanvas/garage.html)或[独立 dev 车库](https://jerryzric.github.io/ai-friends-kart-playcanvas/dev/garage.html)：**55 个食物主题 / 330 件零件**，包含 000 纯白饭；提供“选整车 / 自由改装”双入口、六槽自由混搭、真实 3D 预览、参数比较与方案保存。浏览整车只预览，应用才替换六件，支持替换前收藏与撤销。所选装配用于全部 12 张陆地赛道，保留六角色属性和水上坐骑。NPC 使用相同零件公式的预设混搭车，同主题不额外加成。电量消耗、耐久损耗、修理及经济系统尚未启用。[实现与验证边界](docs/modular-garage.md)。

## 游戏特色

- **六位可选车手：** WHALE、GEMINI、GPT、CLAUDE、GROK 和 GLM，内置骨骼角色模型
- **三圈竞速：** 在陆地与水上地图中与五位 AI 对手比赛，包含碰撞、圈数 / 名次统计和小地图
- **街机驾驶：** 手动油门、刹车、倒车、手刹漂移与漂移加速
- **固定 E/R 双槽与三同类升级：** 正式版和 dev 默认开启叠加。同槽两个普通同类道具每次使用消耗一个，第三枚变成一次 super；已有 super 后，同类箱会被消耗，但不强化、不填另一槽、不生成 Token。有空槽时神秘箱照常抽取，双槽满时不接收。E/R 共用 1.2 秒冷却。暂停设置中切换后须应用并重新开始；`itemStacking=0` 恢复普通双槽。玩家与 NPC 使用相同规则，槽位固定不移位。
- **音乐：** 所有陆地和水上比赛共用 17 首随机曲池；菜单播放 THEME，Love 保留且不进入比赛曲池。保留原音质 MP3，不转码；音乐适用独立非商业许可。
- **三种道具：** 涡轮加速、能量护盾与追踪脉冲
- **可视道具箱：** 半透明箱内展示原创 3D 道具，25% 为问号随机箱；拾取后立即消失，比赛运行八秒后刷新。HUD 显示由同一模型投影生成的道具图片。[说明](docs/item-pickups.md)
- **道具 NPC：** 对手会争抢真实道具箱、安全调整路线，并择机加速、开盾或脉冲攻击玩家及其他 NPC；头顶道具和使用特效清晰可见。[说明](docs/npc-tactics.md)
- **双追逐视角：** 鼠标环顾、视角回正与临时后视
- 暂停/重开、音效、键盘操作与屏幕触控按钮
- 可在当前会话中导入本地 GLB 替换角色，不上传文件

## 浏览器试玩

使用启用 **WebGL2** 的浏览器打开 **[GitHub Pages 游戏](https://jerryzric.github.io/ai-friends-kart-playcanvas/)**。等待角色加载，选择车手后开始比赛。

首次比赛角色下载合计约 **51.6 MB**；所选站姿肖像和食物车辆零件另按需下载。最多同时下载 / 准备两个角色模型。加载界面显示真实字节进度、解压和准备阶段；临时错误会有限次重试，也可只重试失败文件，保留已成功加载的模型。缺失模型不会显示替身，所需资源全部就绪后才开始比赛。比赛使用高空赛道巡游加载画面，并平滑返回起点。

无需 ChatGPT 登录、模型服务账号或运行时 CDN。游戏与角色资源均由同一分发包提供。

## 网页 / HTML 下载包

从[发布页面](https://github.com/JerryZRic/ai-friends-kart-playcanvas/releases)选择 [`ai-friends-kart-playcanvas-v1.1.1-html.zip`](https://github.com/JerryZRic/ai-friends-kart-playcanvas/releases/download/v1.1.1/ai-friends-kart-playcanvas-v1.1.1-html.zip)，核对随附 SHA-256 校验值。完整解压后，通过 nginx 或其他 HTTP(S) 静态服务器部署；不支持以 `file://` 直接打开 `index.html`。保留全部资产、许可声明与对应源码文件。根目录和子目录部署的验证结果以发布说明为准，不能用相对路径设计代替对实际发布包的验证。

正式 GitHub Pages 站点提供运行文件；对应源码请从 [v1.1.1 发布页](https://github.com/JerryZRic/ai-friends-kart-playcanvas/releases/tag/v1.1.1)下载独立的 [`source.zip`](https://github.com/JerryZRic/ai-friends-kart-playcanvas/releases/download/v1.1.1/source.zip)。完整 HTML ZIP 仍包含 `source.zip` 和全部运行资源。历史离线平衡报告及数据保留在 `/dev/`。v1.1.1 从最终合并后的 `main` 提交打 tag，不直接从 `dev` 发布。

GitHub Pages 根目录和 Timewish 托管运行版不包含离线平衡诊断数据集；诊断入口链接到固定版本的 [v1.1.1 完整 HTML 包](https://github.com/JerryZRic/ai-friends-kart-playcanvas/releases/download/v1.1.1/ai-friends-kart-playcanvas-v1.1.1-html.zip)，不会跳转到随 dev 更新的诊断页。完整 HTML ZIP 保留数据集及可用的离线诊断。

## Windows x64 包

下载 [`ai-friends-kart-playcanvas-v1.1.1-windows-x64.zip`](https://github.com/JerryZRic/ai-friends-kart-playcanvas/releases/download/v1.1.1/ai-friends-kart-playcanvas-v1.1.1-windows-x64.zip) · [SHA256SUMS](https://github.com/JerryZRic/ai-friends-kart-playcanvas/releases/download/v1.1.1/SHA256SUMS)

需要 64 位 Windows 10/11 和支持 WebGL2 的 GPU。完整解压 ZIP，保持 DLL、`resources` 和 `locales` 文件夹在一起，运行 **AI Friends Kart.exe**；按 **F11** 切换全屏。不要关闭 Windows 安全防护。自动打包、安全及协议检查不能证明原生 Windows GPU、性能或输入兼容性。

## 操作

| 输入 | 功能 |
| --- | --- |
| `W` / `↑` | 油门；松开后滑行 |
| `A` / `←`、`D` / `→` | 向左/右转向 |
| `S` / `↓` | 先刹车，继续按住则倒车 |
| `Space` | 刹车，不倒车 |
| `Left Shift` + 转向 | 漂移；蓄力后松开 Shift 释放加速 |
| `E` / `R` | 使用对应固定槽位中的道具 |
| `Z` / `C` | 切换追逐视角 |
| 按住鼠标右键 | 临时后视 |
| 点击赛道后移动鼠标 | 环顾镜头 |
| `Q` | 镜头回正 |
| `Esc` | 暂停并释放鼠标 |
| `P` / 暂停按钮 | 暂停/继续 |

如果无法捕获鼠标，可按住左键拖动环顾。触控按钮提供油门、转向、倒车、刹车与漂移，并有独立的 `E`、`R` 道具按钮。菜单按钮支持原生键盘操作。手机游戏区域抑制误选文字、拖图、右键菜单和干扰手势，同时保留必要的输入框操作与滚动。无法保证拦截所有系统辅助缩放；这些改动尚未经过真实手机 QA。

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

通过 HTTP(S) 提供完整 **`dist/`** 目录，不要以 `file://` 方式打开 `index.html`。相对路径在域名根目录和子目录下的部署，需要结合实际发布包及发布验证说明确认。许可声明、`source.html` 与 `source.zip` 应与游戏一同部署。

完整克隆包含 `public/assets/drivers/` 下的六个驾驶模型压缩档，以及 `public/assets/portraits/` 下的六个独立站姿肖像压缩档。Release 中较小的 `source.zip` 包含代码、测试、两份校验清单、构建文件及原创可编辑资产，但不重复打包这两组角色档案。解压该源码包后可这样恢复：

```sh
npm ci
npm run models:fetch
npm run food:fetch
npm run food:verify
npm run build
```

源码包也不包含另行下载的食物车辆载荷，请用上述命令恢复并验证。原创可编辑资产源码及校验清单仍包含在源码包中。

下载脚本使用独立 `/dev/` 预览的固定公开路径，按[驾驶模型清单](docs/runtime-models.json)及[站姿肖像清单](docs/portrait-models.json)校验压缩及解压后的哈希，并拒绝覆盖不匹配的本地文件。没有角色档案时，代码仍可构建；完整画面需要还原两组模型。

### GitHub Pages

版本标记：正式稳定热修复版 `v1.1.1`，dev 使用实际构建提交 `v1.1.1-dev.<sha6>`，未提供提交的本地构建为 `v1.1.1-dev.local`。

开发版版本号追加实际 commit 哈希的前六位。发布从 `main` 打 tag，发布包必须使用该标签对应源码；dev 部署必须保留 main 站点根目录。

[Build and publish PlayCanvas game 工作流](.github/workflows/pages.yml)在发布前检查、测试并构建所选源码。main 版位于站点根目录，独立预览位于 `/dev/`。请按所检出分支的工作流触发条件和发布选项操作；dev 部署必须保留main 根目录。发布包必须使用对应版本标签的同一份源码。

### 目录结构

- `src/`：PlayCanvas 场景、赛道、比赛逻辑、输入、镜头与角色加载
- `public/assets/`：内置运行时资源，含六个压缩车手模型
- `models/`：原创卡丁车与场景道具的可编辑源文件
- `tests/`：逻辑、加载、界面和引擎级检查
- `scripts/`：源码打包、运行时模型下载与分发检查
- `docs/`：模型清单、本地导入契约和技术验证说明

## 本地替换车手

选择角色槽位并导入兼容 GLB，或多选文件名中各含唯一槽位名称标记的文件。每个文件上限 **32 MiB**，最多同时处理两个。导入文件仅保留在当前页面内存中，不上传、不持久保存。失败或取消会保留原角色；**恢复默认**会恢复内置角色。简化后的比赛加载页隐藏了旧导入控件，角色选择在主菜单进行。

兼容模型与验证规则见[骨骼及导入契约](docs/local-import.md)。

## 验证

历史 CPU 候选 21 的结果仅适用于单道具槽 baseline，不能作为新双槽玩法平衡或公平性的认证。尚未进行真实手机 QA。

自动检查涵盖独立于引擎的比赛/输入逻辑、真实 PlayCanvas CPU/空设备骨骼加载、模拟界面集成及静态分发检查，不能据此认定 GPU 画面、原生鼠标锁定或性能已获验证。详见[测试覆盖与限制](docs/MIGRATION-PARITY.md)及[海水着色器回归说明](docs/WATER-REGRESSION.md)。

<a id="license-and-model-rights"></a>
## 许可与模型权利

**代码及原创游戏资产（音乐除外）：** AGPL-3.0-only，包括原创界面、赛道、卡丁车、道具及可编辑源文件。见 [LICENSE](LICENSE)、[NOTICE](NOTICE) 和 [THIRD-PARTY-NOTICES.txt](THIRD-PARTY-NOTICES.txt)。PlayCanvas 与 fflate 保留各自的 MIT 许可。

**原创音乐（© 2026 JerryZRic）：** 适用[独立音乐许可](public/assets/music/LICENSE.txt)。音乐作品与录音及其改编可随本游戏和 fork 非商业使用、修改、分发，须署名并保留声明；商用须事先取得 JerryZRic 同意。不因此授权无关项目或脱离游戏及其 fork 单独分发、销售音乐。代码的 AGPL 条款不变。

**六个角色的驾驶与独立站姿肖像模型：** 权利单独处理。项目所有者将其标注为带有非商业限制的 Tripo Free 输出；确切再分发条款尚未独立核实。纳入本仓库不授予新的模型许可、Creative Commons 许可或商业使用权。AGPL 不会重新授权角色。复用或再分发前，请确认适用权利并取得所需许可，详见 [MODEL-NOTICE.txt](MODEL-NOTICE.txt)。

仓库包含最终角色运行文件，不包含角色 Blender 工程或高模制作源文件。原创卡丁车/道具的可编辑文件仍作为对应源码提供。本演示没有广告、付款或商业模型销售。

