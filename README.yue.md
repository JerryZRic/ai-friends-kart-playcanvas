# Neon Kart 3D · Sunset Coast

[English](README.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [粵語](README.yue.md) | [日本語](README.ja.md) | [한국어](README.ko.md)

[![License: AGPL-3.0-only](https://img.shields.io/badge/license-AGPL--3.0--only-blue.svg)](LICENSE)
[![Platform: Web](https://img.shields.io/badge/platform-Web-orange.svg)](https://cici-neon-kart.shtw.chatgpt.site)

一隻用 Three.js 整嘅原創 WebGL 街機高卡車遊戲，附有用 Blender 4.3.2 製作同匯出嘅可編輯模型。

**[喺瀏覽器玩](https://cici-neon-kart.shtw.chatgpt.site)**

## 功能

- 日落海岸賽道、海面著色器、平行光陰影同透視追車鏡頭
- 六位車手、手動油門、煞車同倒車、手掣飄移同飄移加速
- 三種道具、圈數同排名統計、暫停同重新開始
- 兩款追車鏡頭、滑鼠環繞視角、暫時後望同觸控操作
- 原創可編輯 Blender 模型，同可以獨立部署嘅靜態網頁版本

## 穩定版本

`v1.0.0` 係第一個 GitHub 穩定版基準，源自已發布嘅 Sites v5 原始碼提交 `27e465a74e2248bc2584b77e3987ea2bb88d39dd`。Sites 發布編號同 GitHub 版本標籤係分開計數嘅。詳情睇[版本來源同驗證紀錄](docs/releases/v1.0.0.md)。

呢個版本保留原本嘅遊戲同素材，唔包括之後嘅角色同模型實驗。遊戲介面仍然係中文；上面嘅語言連結只會切換 README。

## 運行要求

- 已啟用 WebGL 嘅瀏覽器
- 建置或者做檢查要有 Node.js 同 npm；呢個版本用 Node.js 24.19.0 同 npm 11.9.0 驗證過
- 隨附嘅本機 HTTP 伺服器指令要有 Python 3
- 編輯或者重新產生模型要用 Blender 4.3.2；玩遊戲唔使裝 Blender

## 快速開始

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

打開 [http://localhost:4173](http://localhost:4173)。

`dist/` 可以獨立部署，入面有打包好嘅 Three.js 渲染器、全部四個 GLB 素材，同埋授權及原始碼說明，唔使向 CDN 發送請求。請經 HTTP 伺服器開啟，唔好用 `file:` 位址直接開 `index.html`。亦可以直接託管附帶嘅預先建置 `dist/`，唔使重新建置。

## GitHub Pages 同獨立託管

將 **`dist/` 入面全部內容**部署成靜態網站就得。相對路徑支援網域根目錄、`/neon-kart/` 或者其他子目錄，唔使依賴 ChatGPT 帳號、Sites 服務、CDN 或者後端。記得保留 `.nojekyll`、`source.html`、`source.zip` 同所有授權聲明。遊戲入面嘅 **Source / License · 源码与许可证**連結，可以喺同一個網站下載完整專案原始碼，包括可以編輯嘅 Blender 檔案。

準備好嘅 [Pages 工作流程](.github/workflows/pages.yml)會直接上傳 `dist/`，**只可以手動執行**，仲要明確剔選發布；推送程式碼唔會自動部署。睇過同同意公開託管之後，可以喺 **Settings → Pages → GitHub Actions** 設定，再喺 Actions 手動執行 **Publish static game to GitHub Pages**。依家只係準備好檔案，未啟用 Pages，亦未發布新網站。私有儲存庫通常唔代表 Pages 網站都係私有，發布亦會公開 `source.zip`。

Pages 嘅分支發布選項只接受 `/(root)` 或者 `/docs`，唔可以直接揀 `/dist`。建議用上面嘅工作流程，亦可以將完整分發目錄複製去呢兩個位置其中一個。執行 `npm run test:dist` 可以檢查根目錄同巢狀路徑嘅 HTTP 存取。目錄結構、其他方法同驗證範圍可以睇[獨立部署指南](docs/github-pages.md)。

## 操作

| 輸入 | 功能 |
| --- | --- |
| `W` / `↑` | 油門。放手之後會滑行，要手動加速。 |
| `A` / `←`、`D` / `→` | 相對架車向左或者向右轉。 |
| `S` / `↓` | 向前行嗰陣煞車，繼續撳住就會倒車。 |
| `Space` | 煞車直到完全停低，唔會倒車。 |
| `Left Shift` + 轉向 | 手掣飄移，放開 Shift 就會觸發飄移加速。 |
| `E` | 用已經攞到嘅道具。 |
| `Z` | 切換兩款追車鏡頭並將視角擺返正；`C` 都做到。 |
| 撳住滑鼠右鍵 | 暫時向後望，放開就會還原之前嘅環繞視角。 |
| 點一下賽道，再郁滑鼠 | 捕捉滑鼠指標，水平 360° 環繞視角；上下視角平滑變化，並有限制範圍。 |
| `Q` | 平滑咁將鏡頭擺返正。 |
| `Esc` | 暫停同釋放滑鼠指標。 |
| `P` / 暫停掣 | 切換暫停狀態。 |

暫停之後，點一下賽道就會繼續遊戲兼重新捕捉滑鼠；撳 `P` 或者暫停掣就會繼續遊戲，但唔捕捉滑鼠。如果捕捉唔到滑鼠，可以撳住滑鼠左鍵拖動視角。

觸控有左轉、右轉、飄移、煞車、倒車同油門掣。點一下道具面板就可以用道具。

相關駕駛鍵位參考咗 NTE 公布嘅 PC 操作。[操作參考](https://gamewith.net/nte/75764)同入面嘅[遊戲 HUD 圖片](https://img.gamewith.net/img/original_c5318b60d191081761bb0516dadb5cd4.png)顯示：Space 煞車、Left Shift 手掣、Z 切換視角、滑鼠右鍵後望。`E` 用道具係 Neon Kart 自己嘅鍵位。呢隻仍然係沿賽道行進嘅街機賽車，唔會重現 NTE 嘅車輛物理或者其他車輛功能。

## 可編輯模型

用 Blender 開 `models/kart.blend` 同 `models/props.blend`，原本嘅零件同材質都可以編輯。要重新產生素材：

```bash
blender -b --python models/build_models.py
blender -b --python models/create_props.py
```

腳本會將檔案匯出到 `models/`。重新建置之前，將產生嘅 `kart.glb`、`palm.glb`、`rock.glb` 同 `arch.glb` 複製去 `dist/assets/`。GLB 用 Y 軸向上嘅座標系，架高卡車朝向 +Z。`Body` 同 `Helmet` 材質可以改色。

全部 Blender 素材都係為呢隻遊戲製作嘅原創作品，受專案授權條款涵蓋。Blender 本身係外部創作工具，唔包括喺儲存庫入面。

## 儲存庫結構

- `src/vehicle-controls.js`：實體按鍵對應、手動油門、煞車／倒車，同帶方向嘅轉向控制
- `src/mouse-look.js`：平滑環繞視角、俯仰範圍限制、指標鎖定生命週期，同拖動後備操作
- `src/game.js`：Three.js 場景、鏡頭、賽道、車手、飄移加速、道具、圈數同排名
- `src/index.html`：響應式中文介面同操作控制項
- `models/`：可編輯 Blender 原始檔、程序化建模腳本同模型中繼資料
- `tests/`：滑鼠視角、車輛控制同遊戲邏輯模擬檢查
- `build.mjs`：esbuild 打包同授權／原始碼說明複製，保留本機 GLB 素材
- `dist/`：可以部署嘅靜態遊戲、四個 GLB 同必要聲明
- `docs/releases/`：版本來源同驗證紀錄

## 驗證情況

JavaScript 語法檢查、全部 **34 項控制／鏡頭／遊戲邏輯模擬檢查**同建置都已經通過。遊戲 JavaScript 同 GLB，同已發布穩定版逐個位元組一致。原始碼 HTML 冇改；分發打包只喺產生嘅 HTML 加咗一個睇得到嘅原始碼／授權連結。四個 GLB 都冇引用外部緩衝區或者圖片，兩個可編輯 Blender 檔案都冇連結外部函式庫、圖片、字型或者腳本。詳情睇[版本驗證紀錄](docs/releases/v1.0.0.md)。

原始建置亦通過咗 Blender 匯出、重新匯入同攝影棚渲染檢查，以及 Three.js GLB 解析同材質批次合併驗證。模擬涵蓋：360 個朝向下嘅轉向／偏航；兩款追車鏡頭喺賽道 32 個位置嘅投影；平滑滑鼠方向、俯仰限制、無限水平旋轉同回正；重複捕捉點擊同組合滑鼠按鍵釋放；意外同主動釋放指標鎖定；暫停之後延遲成功嘅指標鎖定；捕捉失敗同拖動後備操作；後視還原；煞車／倒車；道具；暫停／輸入釋放；觸控操作；比賽／重新開始邏輯。

公開 Site 已經喺唔使登入嘅情況下打開過，但雲端測試瀏覽器回報 `GL_VENDOR = Disabled` / `GL_RENDERER = Disabled`，建立唔到 WebGL 上下文。所以，**仲未喺嗰個瀏覽器驗證實際渲染嘅遊戲畫面同原生指標鎖定手感**。模擬套件用真實嘅 Three.js 鏡頭／幾何體同遊戲邏輯，配合模擬渲染器同 DOM，唔等於瀏覽器可視化試玩已經通過。

## 授權

原創遊戲程式碼、介面、建置／建模腳本、測試、文件、可編輯 Blender 原始檔同匯出嘅 GLB 模型，都採用 **GNU AGPL 第 3 版，僅此版本**（`AGPL-3.0-only`）。詳情睇 [LICENSE](LICENSE) 同 [NOTICE](NOTICE)。

第三方軟件保留各自原本嘅授權條款。Three.js 同 esbuild 採用 MIT 授權，相關聲明保留喺 [THIRD-PARTY-NOTICES.txt](THIRD-PARTY-NOTICES.txt)。

AGPL 容許商業使用。分發受呢個授權涵蓋嘅作品時，要遵守授權條款同提供對應原始碼嘅要求。如果修改咗本程式，再經網絡提供修改後嘅版本畀用戶互動，就要按照第 13 條，向呢啲用戶明顯提供取得對應原始碼嘅機會。純粹私人使用本身唔要求公開發布，亦唔要求將修改交返上游。具體以完整授權條款為準。

呢個版本嘅完整對應原始碼：[JerryZRic/neon-kart v1.0.0](https://github.com/JerryZRic/neon-kart/tree/v1.0.0)。
