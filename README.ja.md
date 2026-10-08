# AI Friends Kart · PlayCanvas

[English](README.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [粵語](README.yue.md) | [日本語](README.ja.md) | [한국어](README.ko.md)

[![エンジン: PlayCanvas](https://img.shields.io/badge/engine-PlayCanvas-orange)](https://playcanvas.com/)
[![対応環境: Web / Windows](https://img.shields.io/badge/platforms-Web%20%2F%20Windows-blue)](https://github.com/JerryZRic/ai-friends-kart-playcanvas/releases)
[![コード: AGPL-3.0-only](https://img.shields.io/badge/code-AGPL--3.0--only-blue)](LICENSE)

**PlayCanvas Engine、TypeScript、Vite** で制作した、夕暮れの海岸を走るアーケードカートレースです。リグ付きキャラクター6人からドライバーを選び、残りの5人と対戦。ドリフトブースト、アイテム、自由に回り込める追従カメラでレースを楽しめます。

**[ブラウザーでプレイ](https://jerryzric.github.io/ai-friends-kart-playcanvas/) · [Windows プレイテスト版をダウンロード](https://github.com/JerryZRic/ai-friends-kart-playcanvas/releases/tag/v0.1.0-windows-playtest.20261007)**

> ゲームの UI は簡体字中国語で、ブランド名は英語表記です。上の言語リンクで切り替わるのはドキュメントのみです。コードとオリジナル素材には AGPL-3.0-only が適用され、6体のキャラクターモデルには別途、非商用の制限があります。[ライセンスとモデルの権利](#license-and-model-rights)をご確認ください。

## 特徴

- **選べる6人のドライバー:** WHALE、GEMINI、GPT、CLAUDE、GROK、GLM。リグ付きキャラクターモデルを同梱
- 夕暮れの海岸サーキットで、5人の AI を相手に走る**3周のレース**。海の景色、衝突、周回数・順位表示、ミニマップに対応
- **アーケード操作:** 手動アクセル、ブレーキ、後退、ハンドブレーキドリフト、ドリフトブースト
- **3種類のアイテム:** ターボブースト、エネルギーシールド、追尾パルス
- **中身が見えるアイテム箱:** 半透明の箱にオリジナルの 3D アイテムを表示。25% は「？」のランダム箱です。取得すると即座に消え、レース進行時間で8秒後に再出現します。HUD の画像も同じモデルの投影から生成します。[詳細](docs/item-pickups.md)
- **アイテムを使う NPC：** 相手も実際のボックスを拾い、安全な進路を選びながら加速・シールド・パルスを使います。所持アイテムと使用エフェクトを3Dで表示します。[仕様](docs/npc-tactics.md)
- **2種類の追従カメラ**、マウスによる回り込み、視点のリセット、一時的な後方確認
- 一時停止・リスタート、効果音、キーボード操作、画面上のタッチ操作
- アップロード不要のローカル GLB ドライバー置き換え。現在のセッション内でのみ有効

## ブラウザーでプレイ

**WebGL2** を有効にしたブラウザーで **[GitHub Pages のゲーム](https://jerryzric.github.io/ai-friends-kart-playcanvas/)** を開いてください。キャラクターの読み込みを待ち、ドライバーを選んでレースを開始します。

初回のキャラクターダウンロードは合計で約 **51.6 MB** です。同時にダウンロード・準備するモデルは最大2体です。読み込み画面には実際のバイト単位の進捗、解凍、準備の状況が表示されます。一時的なエラーには上限付きで再試行し、読み込み済みのモデルを保持したまま失敗したファイルだけを再試行できます。モデルがない場合は、代替のオリジナルドライバーを使用していることが明示されます。

ChatGPT へのログイン、モデルサービスのアカウント、実行時の CDN は不要です。ゲームとキャラクター素材は同じ配布物から提供されます。

## Windows プレイテスト

**Windows 10/11 の64ビット版と、WebGL2 対応の GPU が必要です。** 正式版ではなく、プレリリースのプレイテスト版です。

1. [リリースページ](https://github.com/JerryZRic/ai-friends-kart-playcanvas/releases/tag/v0.1.0-windows-playtest.20261007)から [AI-Friends-Kart-Windows-x64-20261007.zip](https://github.com/JerryZRic/ai-friends-kart-playcanvas/releases/download/v0.1.0-windows-playtest.20261007/AI-Friends-Kart-Windows-x64-20261007.zip) をダウンロードします。
2. **ZIP 全体**をフォルダーに展開します。
3. **AI Friends Kart.exe** を実行します。同じ場所にある DLL、`resources`、`locales` フォルダーはまとめたままにしてください。
4. **F11** で全画面表示を切り替えます。

6人のキャラクターをすべて同梱しているため、オフラインでプレイできます。Node.js、インストール、管理者権限は不要です。ゲームを実行するために Windows のセキュリティ保護を無効にしないでください。

アーカイブには `Game-Corresponding-Source.zip`、デスクトップ用ラッパーとビルド手順を含む `Desktop-Source`、ライセンス通知を同梱しています。デスクトップ向けパッケージはこのリリースで提供されます。このリポジトリの npm スクリプトは Web 版ゲームをビルドします。

## 操作方法

| 入力 | 操作 |
| --- | --- |
| `W` / `↑` | アクセル。離すと惰性走行 |
| `A` / `←`, `D` / `→` | 左右に操舵 |
| `S` / `↓` | ブレーキ。押し続けると後退 |
| `Space` | 後退せずにブレーキ |
| `Left Shift` + 操舵 | ドリフト。Shift を離すとチャージしたドリフトブーストを発動 |
| `E` | 取得したアイテムを使用 |
| `Z` / `C` | 追従カメラを切り替え |
| マウスの右ボタンを長押し | 一時的に後方を確認 |
| コースをクリックしてマウスを動かす | カメラを回り込ませる |
| `Q` | カメラの向きをリセット |
| `Esc` | 一時停止し、ポインターを解放 |
| `P` / 一時停止ボタン | 一時停止・再開 |

ポインターのキャプチャーが利用できない場合は、マウスの左ボタンを押しながらドラッグすると周囲を見渡せます。タッチボタンではアクセル、操舵、後退、ブレーキ、ドリフトを操作でき、アイテムパネルをタップするとアイテムを使用できます。メニューボタンは標準のキーボード操作にも対応しています。

## 開発とビルド

**Node.js 22.12 以降**と npm が必要です。

```sh
git clone https://github.com/JerryZRic/ai-friends-kart-playcanvas.git
cd ai-friends-kart-playcanvas
npm ci
npm run dev
```

Vite が表示する HTTP アドレスを開いてください。チェックと本番用配布物のビルドには、次を実行します。

```sh
npm run check
npm test
npm run build
npm run test:dist
npm run preview
```

**`dist/` 全体**を HTTP(S) で配信してください。`index.html` を `file://` で開かないでください。相対パスを使用しているため、ドメインのルートとリポジトリのサブディレクトリの両方に対応します。ライセンス通知、`source.html`、`source.zip` はゲームと一緒に配置してください。

完全なクローンには、`public/assets/drivers/` 内の6個の運転モデルと、`public/assets/portraits/` 内の6個の独立した立ち姿ポートレートが含まれます。小容量の `source.zip` にはコード、テスト、両方のチェックサムマニフェスト、ビルドファイル、オリジナルの編集可能な素材が含まれますが、この2組のキャラクターアーカイブは含まれません。展開後は次の手順で復元できます。

```sh
npm ci
npm run models:fetch
npm run build
```

取得スクリプトは独立した `/dev/` プレビューの固定公開パスを使い、[運転モデル](docs/runtime-models.json)と[立ち姿ポートレート](docs/portrait-models.json)の圧縮前後のハッシュを検証します。一致しないローカルファイルは上書きしません。変更しない安定版のルートには新しいポートレートはありません。コードのみでもビルドできますが、すべての表示には両方のモデルの復元が必要です。

### GitHub Pages

[Build and publish PlayCanvas game ワークフロー](.github/workflows/pages.yml)は**手動実行**です。リポジトリの **Settings → Pages** で **GitHub Actions** を選択し、**Publish** にチェックを入れて `main` 上でワークフローを実行してください。選択したコミットをチェック、テスト、ビルドしてから公開します。通常の push ではゲームはデプロイされません。

### プロジェクト構成

- `src/`: PlayCanvas シーン、コース、レースロジック、入力、カメラ、キャラクターの読み込み
- `public/assets/`: 圧縮された6人のドライバーを含む、同梱のランタイム素材
- `models/`: オリジナルのカートと小物の編集可能なソース
- `tests/`: ロジック、読み込み、UI、エンジンレベルのチェック
- `scripts/`: ソースのパッケージ化、ランタイムモデルの取得、配布物のチェック
- `docs/`: モデルマニフェスト、ローカルインポート仕様、技術的な検証ノート

## ローカルドライバーの置き換え

ドライバースロットを選んで互換性のある GLB をインポートするか、各ファイル名にスロット名のトークンがちょうど1つ含まれるファイルを複数選択してください。ファイルサイズは**1個あたり32 MiB** が上限で、同時に処理するのは最大2個です。インポートしたデータはページのメモリー内にのみ保持され、アップロードも永続保存もされません。失敗・キャンセル時は前のドライバーを保持します。**Restore default** で同梱キャラクター、または明示された代替ドライバーに戻せます。

対応モデルと検証ルールについては、[リグとインポートの仕様](docs/local-import.md)をご確認ください。

## 検証

自動チェックの対象は、エンジンに依存しないレース・入力ロジック、実際の PlayCanvas を用いた CPU/null-device でのリグ読み込み、モックによる UI 統合、静的な配布物のチェックです。GPU 上の見た目、ネイティブのポインターロック動作、パフォーマンスを保証するものではありません。[テスト範囲と制限](docs/MIGRATION-PARITY.md)、[海面シェーダーの回帰テストノート](docs/WATER-REGRESSION.md)をご確認ください。

<a id="license-and-model-rights"></a>

## ライセンスとモデルの権利

**コードとオリジナルのゲーム素材:** AGPL-3.0-only。オリジナルの UI、サーキット、カート、小物、編集可能なソースを含みます。[LICENSE](LICENSE)、[NOTICE](NOTICE)、[THIRD-PARTY-NOTICES.txt](THIRD-PARTY-NOTICES.txt)をご確認ください。PlayCanvas と fflate には引き続き MIT ライセンスが適用されます。

**6体のキャラクターの運転モデルと立ち姿ポートレート:** 別個の権利が適用されます。プロジェクト所有者は、非商用の制限がある Tripo Free の出力物と説明していますが、正確な再配布条件は独立に確認されていません。ここへの収録は、新たなモデルライセンス、Creative Commons ライセンス、商用利用の許可を付与するものではありません。AGPL によってキャラクターのライセンスが変更されることもありません。再利用・再配布の前に適用される権利を確認し、必要な許可を取得してください。[MODEL-NOTICE.txt](MODEL-NOTICE.txt)をご確認ください。

このプロジェクトに含まれるのは最終版のキャラクターランタイムファイルであり、キャラクターの Blender プロジェクトやハイポリゴンの制作ソースではありません。オリジナルのカート・小物の編集可能なファイルは、対応するソースとして引き続き同梱しています。デモには広告、決済、商用のモデル販売はありません。
