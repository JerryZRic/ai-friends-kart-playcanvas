# Neon Kart 3D · Sunset Coast

[English](README.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [粵語](README.yue.md) | [日本語](README.ja.md) | [한국어](README.ko.md)

[![License: AGPL-3.0-only](https://img.shields.io/badge/license-AGPL--3.0--only-blue.svg)](LICENSE)
[![Platform: Web](https://img.shields.io/badge/platform-Web-orange.svg)](https://cici-neon-kart.shtw.chatgpt.site)

一个使用 Three.js 构建的原创 WebGL 街机卡丁车游戏，包含使用 Blender 4.3.2 制作和导出的可编辑模型。

**[在浏览器中游玩](https://cici-neon-kart.shtw.chatgpt.site)**

## 功能

- 落日海岸赛道、海面着色器、平行光阴影和透视追逐镜头
- 六名车手、手动油门、制动与倒车、手刹漂移和漂移加速
- 三种道具、圈数与排名统计、暂停和重新开始
- 两种追逐镜头、鼠标环绕视角、临时后视和触屏操作
- 原创可编辑 Blender 模型和可独立部署的静态网页构建

## 稳定版本

`v1.0.0` 是首个 GitHub 稳定版基线，来自已发布的 Sites v5 源码提交 `27e465a74e2248bc2584b77e3987ea2bb88d39dd`。Sites 发布编号与 GitHub 版本标签分别计数。详见[版本来源与验证记录](docs/releases/v1.0.0.md)。

本版本保留原有游戏和素材，不包含后续角色及模型实验。游戏界面仍为中文；上方语言链接只切换 README。

## 运行要求

- 已启用 WebGL 的浏览器
- 构建或运行检查需要 Node.js 和 npm；本版本使用 Node.js 24.19.0 和 npm 11.9.0 验证
- 附带的本地 HTTP 服务命令需要 Python 3
- 编辑或重新生成模型需要 Blender 4.3.2；游玩不需要安装 Blender

## 快速开始

```bash
git clone https://github.com/JerryZRic/neon-kart.git
cd neon-kart
npm ci
npm run check
npm test
npm run build
npm run test:dist
npm run serve
```

打开 [http://localhost:4173](http://localhost:4173)。

`dist/` 可独立部署，包含打包后的 Three.js 渲染器、全部四个 GLB 素材，以及许可证和源码说明，无需请求 CDN。请通过 HTTP 服务访问，不要使用 `file:` 地址直接打开 `index.html`。也可以直接托管附带的预构建 `dist/`，无需重新构建。

## GitHub Pages 与独立托管

将 **`dist/` 内的全部内容**作为静态网站部署即可。相对路径支持域名根目录、`/neon-kart/` 或其他子目录，不依赖 ChatGPT 账号、Sites 服务、CDN 或后端。请保留 `.nojekyll`、`source.html`、`source.zip` 及全部许可声明。游戏中的 **Source / License · 源码与许可证**链接可从同一站点下载完整项目源码，包括可编辑 Blender 文件。

已准备的 [Pages 工作流](.github/workflows/pages.yml)直接上传 `dist/`，**仅支持手动运行**，且需要明确勾选发布；推送代码不会自动部署。审阅并同意公开托管后，可在 **Settings → Pages → GitHub Actions** 中配置，再从 Actions 手动运行 **Publish static game to GitHub Pages**。目前仅准备了文件，没有启用 Pages 或发布新站点。仓库设为私有通常不代表 Pages 网站也私有，发布还会公开 `source.zip`。

Pages 的分支发布选项只接受 `/(root)` 或 `/docs`，不能直接选择 `/dist`。推荐使用上述工作流，也可将完整分发目录复制到这两个位置之一。运行 `npm run test:dist` 可检查根目录和嵌套路径的 HTTP 访问。目录结构、替代方案和验证范围见[独立部署指南](docs/github-pages.md)。

## 操作

| 输入 | 功能 |
| --- | --- |
| `W` / `↑` | 油门。松开后滑行，需要手动加速。 |
| `A` / `←`、`D` / `→` | 相对于车辆向左或向右转向。 |
| `S` / `↓` | 前进时制动，继续按住则倒车。 |
| `Space` | 制动至完全停止，不会倒车。 |
| `Left Shift` + 转向 | 手刹漂移，松开 Shift 触发漂移加速。 |
| `E` | 使用已获得的道具。 |
| `Z` | 切换两种追逐镜头并回正视角；`C` 也可执行此操作。 |
| 按住鼠标右键 | 临时向后看，松开后恢复之前的环绕视角。 |
| 点击赛道后移动鼠标 | 捕获鼠标指针，水平 360° 环绕视角，垂直视角平滑变化并有限幅。 |
| `Q` | 平滑回正镜头。 |
| `Esc` | 暂停并释放鼠标指针。 |
| `P` / 暂停按钮 | 切换暂停状态。 |

暂停后，点击赛道会恢复游戏并重新捕获鼠标；按 `P` 或点击暂停按钮则恢复游戏而不捕获鼠标。如果无法捕获鼠标，可按住鼠标左键拖动视角。

触屏提供左转、右转、漂移、制动、倒车和油门按钮。点击道具面板即可使用道具。

相关驾驶键位参考了 NTE 公布的 PC 操作。[操作参考](https://gamewith.net/nte/75764)及其[游戏内 HUD 图片](https://img.gamewith.net/img/original_c5318b60d191081761bb0516dadb5cd4.png)显示：Space 制动、Left Shift 手刹、Z 切换视角、鼠标右键后视。`E` 使用道具是 Neon Kart 自身的键位。本作仍是沿赛道行进的街机赛车，不复现 NTE 的车辆物理或其他车辆功能。

## 可编辑模型

用 Blender 打开 `models/kart.blend` 和 `models/props.blend`，原始部件和材质均可编辑。重新生成素材：

```bash
blender -b --python models/build_models.py
blender -b --python models/create_props.py
```

脚本将文件导出至 `models/`。重新构建前，将生成的 `kart.glb`、`palm.glb`、`rock.glb` 和 `arch.glb` 复制到 `dist/assets/`。GLB 使用 Y 轴向上的坐标系，卡丁车朝向 +Z。`Body` 和 `Helmet` 材质可重新着色。

全部 Blender 素材均为本游戏制作的原创作品，适用项目许可证。Blender 本身是外部创作工具，不包含在仓库内。

## 仓库结构

- `src/vehicle-controls.js`：物理按键映射、手动油门、制动／倒车和带方向的转向控制
- `src/mouse-look.js`：平滑环绕视角、俯仰限幅、指针锁定生命周期和拖动回退
- `src/game.js`：Three.js 场景、镜头、赛道、车手、漂移加速、道具、圈数和排名
- `src/index.html`：响应式中文界面和操作控件
- `models/`：可编辑 Blender 源文件、程序化建模脚本和模型元数据
- `tests/`：鼠标视角、车辆控制和游戏逻辑模拟检查
- `build.mjs`：esbuild 打包及许可证／源码说明复制，保留本地 GLB 素材
- `dist/`：可部署的静态游戏、四个 GLB 和必要声明
- `docs/releases/`：版本来源和验证记录

## 验证情况

JavaScript 语法检查、全部 **34 项控制／镜头／游戏逻辑模拟检查**和构建均已通过。游戏 JavaScript 和 GLB 与已发布稳定版逐字节一致。源码 HTML 不变；分发打包只在生成的 HTML 中增加可见的源码／许可证链接。四个 GLB 均不引用外部缓冲区或图片，两个可编辑 Blender 文件均未链接外部库、图片、字体或脚本。详见[版本验证记录](docs/releases/v1.0.0.md)。

原始构建还通过了 Blender 导出、重新导入和摄影棚渲染检查，以及 Three.js GLB 解析和材质合批验证。模拟覆盖包括：360 个朝向下的转向／偏航；两种追逐镜头在赛道 32 个位置的投影；平滑鼠标方向、俯仰限幅、无限水平旋转和回正；重复捕获点击与组合鼠标按键释放；意外及主动释放指针锁定；暂停后延迟成功的指针锁定；捕获失败与拖动回退；后视恢复；制动／倒车；道具；暂停／输入释放；触屏操作；比赛／重新开始逻辑。

公开 Site 已在无需登录的情况下打开，但云端测试浏览器报告 `GL_VENDOR = Disabled` / `GL_RENDERER = Disabled`，无法创建 WebGL 上下文。因此，**尚未在该浏览器中验证实际渲染的游戏画面和原生指针锁定手感**。模拟套件使用真实的 Three.js 镜头／几何体与游戏逻辑，搭配模拟渲染器和 DOM，不等同于浏览器可视化试玩通过。

## 许可证

原创游戏代码、界面、构建／建模脚本、测试、文档、可编辑 Blender 源文件和导出的 GLB 模型均采用 **GNU AGPL 第 3 版，仅此版本**（`AGPL-3.0-only`）。详见 [LICENSE](LICENSE) 和 [NOTICE](NOTICE)。

第三方软件保留各自原有许可证。Three.js 和 esbuild 采用 MIT 许可证，相关声明保留在 [THIRD-PARTY-NOTICES.txt](THIRD-PARTY-NOTICES.txt)。

AGPL 允许商业使用。分发受该许可证覆盖的作品时，须遵守许可证及对应源码提供要求。如果修改本程序并通过网络提供修改后的版本供用户交互，须依照第 13 条，向这些用户显著提供获取对应源码的机会。仅供私人使用本身不要求公开发布，也不要求将修改提交给上游。具体以完整许可证为准。

本版本的完整对应源码：[JerryZRic/neon-kart v1.0.0](https://github.com/JerryZRic/neon-kart/tree/v1.0.0)。
