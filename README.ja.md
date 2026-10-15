# AI Friends Kart · PlayCanvas

[English](README.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [粵語](README.yue.md) | [日本語](README.ja.md) | [한국어](README.ko.md)

[![エンジン: PlayCanvas](https://img.shields.io/badge/engine-PlayCanvas-orange)](https://playcanvas.com/)
[![対応環境: Web / Windows](https://img.shields.io/badge/platforms-Web%20%2F%20Windows-blue)](https://github.com/JerryZRic/ai-friends-kart-playcanvas/releases)
[![コード: AGPL-3.0-only](https://img.shields.io/badge/code-AGPL--3.0--only-blue)](LICENSE)

**PlayCanvas Engine、TypeScript、Vite** で制作した、陸上12コースと水上1コースを楽しめるアーケードカートレースです。リグ付きキャラクター6人からドライバーを選び、残りの5人と対戦。ドリフトブースト、アイテム、自由に回り込める追従カメラに対応します。

**[ブラウザー main 版](https://jerryzric.github.io/ai-friends-kart-playcanvas/) · [独立 dev プレビュー](https://jerryzric.github.io/ai-friends-kart-playcanvas/dev/) · [HTML テスト版 / 過去の Windows 版](https://github.com/JerryZRic/ai-friends-kart-playcanvas/releases)**

> ゲームの UI は簡体字中国語で、ブランド名は英語表記です。上の言語リンクで切り替わるのはドキュメントのみです。コードとオリジナル素材（音楽を除く）には AGPL-3.0-only が適用され、6体のキャラクターモデルには別途、非商用の制限があります。[ライセンスとモデルの権利](#license-and-model-rights)をご確認ください。

## v1.0.2a プレリリース

**v1.0.2a はテスト用のプレリリースで、独立した Web / HTML 静的配信用 ZIP のみを提供します。新しい Windows パッケージは含みません。** 13マップ、6人のドライバー、55テーマ / 330パーツの6スロット食べ物カートガレージを引き続き収録。追加の陸上11コースにはシーン充実化の成果を含みます。公開ファイル、ソースのリビジョン、チェックサム、検証状況は[リリースページ](https://github.com/JerryZRic/ai-friends-kart-playcanvas/releases)をご確認ください。サイトのルートは main の公開先、`/dev/` は独立した開発プレビューです。

フリーモードには6人からランダムに選ぶアニメーション付きタイトル画面、回転するマッププレビュー、キャラクターの3D表示、車両選択、簡単 / 普通 / 難しいのレース設定と画面設定があります。タイトル画面は独自の PlayCanvas 2D メッシュアニメーションで、Cubism は使用していません。大肥鱼（WHALE）の選択確率は35%、残りの5人は65%を均等に分けます。ストーリーモードは開発中の案内です。[実装ノートと制限](docs/free-mode.md)。

### マップ一覧

陸上コースを **01–12** の順に並べ、水上コース **A01** を最後に表示します。表示番号によって既存のマップ ID、保存した選択、直リンクは変わりません。

- **01** [Sunset Coast](https://jerryzric.github.io/ai-friends-kart-playcanvas/index.html?screen=maps&map=coast) · `coast`
- **02** [Cloudridge Pass](https://jerryzric.github.io/ai-friends-kart-playcanvas/index.html?screen=maps&map=mountain) · `mountain`
- **03** [Lantern Terrace Rally](https://jerryzric.github.io/ai-friends-kart-playcanvas/index.html?screen=maps&map=town) · `town`
- **04** [Redstrata Quarry](https://jerryzric.github.io/ai-friends-kart-playcanvas/index.html?screen=maps&map=quarry) · `quarry`
- **05** [CedarLight Observatory](https://jerryzric.github.io/ai-friends-kart-playcanvas/index.html?screen=maps&map=forest) · `forest`
- **06** [Clockwind Workshop](https://jerryzric.github.io/ai-friends-kart-playcanvas/index.html?screen=maps&map=workshop) · `workshop`
- **07** [Amberwind Harvest](https://jerryzric.github.io/ai-friends-kart-playcanvas/index.html?screen=maps&map=harvest) · `harvest`
- **08** [Sunweave Caravan](https://jerryzric.github.io/ai-friends-kart-playcanvas/index.html?screen=maps&map=desert) · `desert`
- **09** [Frostloop Depot](https://jerryzric.github.io/ai-friends-kart-playcanvas/index.html?screen=maps&map=snow) · `snow`
- **10** [Basalt Crown](https://jerryzric.github.io/ai-friends-kart-playcanvas/index.html?screen=maps&map=caldera) · `caldera`
- **11** [Verdant Canopy](https://jerryzric.github.io/ai-friends-kart-playcanvas/index.html?screen=maps&map=garden) · `garden`
- **12** [Copperwing Airfield](https://jerryzric.github.io/ai-friends-kart-playcanvas/index.html?screen=maps&map=airfield) · `airfield`
- **A01** [Sky Waterpark](https://jerryzric.github.io/ai-friends-kart-playcanvas/index.html?screen=maps&map=waterpark) · `waterpark`


## 6スロット食べ物カートガレージ

[main 版ガレージ](https://jerryzric.github.io/ai-friends-kart-playcanvas/garage.html)または [dev ガレージ](https://jerryzric.github.io/ai-friends-kart-playcanvas/dev/garage.html)を開いてください。000 白いご飯を含む **55テーマ / 330パーツ**で、完成車選択、6スロットの自由な組み合わせ、実際の3Dプレビュー、性能比較、構成保存に対応。完成車を見るだけでは変更されず、適用すると6パーツを置き換えます。置き換え前の保存と取り消しも可能です。選んだ構成は陸上12コースで使用し、6人の特性と水上の乗り物は維持します。NPC も同じパーツ計算式の混合構成を使い、同テーマの追加ボーナスはありません。電池消耗、耐久消耗、修理、経済システムは未実装です。[実装と検証の範囲](docs/modular-garage.md)。

## 特徴

- **選べる6人のドライバー:** WHALE、GEMINI、GPT、CLAUDE、GROK、GLM。リグ付きキャラクターモデルを同梱
- 陸上・水上コースで5人の AI と競う**3周レース**。衝突、周回数・順位表示、ミニマップに対応
- **アーケード操作:** 手動アクセル、ブレーキ、後退、ハンドブレーキドリフト、ドリフトブースト
- **位置が固定された2つのアイテムスロット:** 取得時は `E`、次に `R` の順に格納し、片方を使っても他方は移動しません。満杯のときはボックスを消費しません。NPC も同じく最大2個を所持でき、モバイルには各スロット専用のボタンがあります。
- **3種類のアイテム:** ターボブースト、エネルギーシールド、追尾パルス
- **中身が見えるアイテム箱:** 半透明の箱にオリジナルの 3D アイテムを表示。25% は「？」のランダム箱です。取得すると即座に消え、レース進行時間で8秒後に再出現します。HUD の画像も同じモデルの投影から生成します。[詳細](docs/item-pickups.md)
- **アイテムを使う NPC：** 相手も実際のボックスを拾い、安全な進路を選びながら加速・シールド・パルスを使います。所持アイテムと使用エフェクトを3Dで表示します。[仕様](docs/npc-tactics.md)
- **2種類の追従カメラ**、マウスによる回り込み、視点のリセット、一時的な後方確認
- 一時停止・リスタート、効果音、キーボード操作、画面上のタッチ操作
- アップロード不要のローカル GLB ドライバー置き換え。現在のセッション内でのみ有効

## ブラウザーでプレイ

**WebGL2** を有効にしたブラウザーで **[GitHub Pages のゲーム](https://jerryzric.github.io/ai-friends-kart-playcanvas/)** を開いてください。キャラクターの読み込みを待ち、ドライバーを選んでレースを開始します。

レース用キャラクターの初回ダウンロードは合計約 **51.6 MB** です。選択した立ち姿ポートレートと食べ物カートのパーツは必要に応じて別途取得します。同時にダウンロード・準備するキャラクターモデルは最大2体です。実際のバイト進捗、解凍、準備を表示し、一時エラーには上限付きで再試行します。読み込み済みモデルを保持したまま失敗ファイルだけを再試行できます。欠けたモデルを代替せず、必要な素材がすべて準備できてからレースを始めます。読み込み中はコース上空を巡り、滑らかにスタート地点へ戻ります。

ChatGPT へのログイン、モデルサービスのアカウント、実行時の CDN は不要です。ゲームとキャラクター素材は同じ配布物から提供されます。

## Web / HTML パッケージ

[リリースページ](https://github.com/JerryZRic/ai-friends-kart-playcanvas/releases)で [`ai-friends-kart-playcanvas-v1.0.2a-html.zip`](https://github.com/JerryZRic/ai-friends-kart-playcanvas/releases/download/v1.0.2a/ai-friends-kart-playcanvas-v1.0.2a-html.zip) を選び、付属の SHA-256 チェックサムと照合してください。全体を展開し、nginx などの HTTP(S) 静的サーバーで配信します。`file://` で `index.html` を直接開く方法には対応しません。素材、ライセンス通知、対応するソースをすべて保持してください。ルートやサブディレクトリへの配置の検証結果はリリースノートをご確認ください。相対パスの採用だけで実際の配布物の検証に代えることはできません。

正式な GitHub Pages サイトでは実行用ファイルを配信します。対応するソースは [v1.0.2a プレリリース](https://github.com/JerryZRic/ai-friends-kart-playcanvas/releases/tag/v1.0.2a)の独立した [`source.zip`](https://github.com/JerryZRic/ai-friends-kart-playcanvas/releases/download/v1.0.2a/source.zip)から取得してください。完全な HTML ZIP には引き続き `source.zip` とすべての実行用素材が含まれます。過去のオフラインバランス報告とデータは `/dev/` に残します。v1.0.2a のタグは最終マージ後の `main` コミットから作成し、`dev` から直接公開しません。

## 過去の Windows パッケージ（v1.0.0）

**v1.0.2a に Windows ビルドはありません。** [v1.0.0 リリース](https://github.com/JerryZRic/ai-friends-kart-playcanvas/releases/tag/v1.0.0)には過去の Windows 版を残していますが、今回のプレリリースの新機能は含まれません。ファイル名、チェックサム、手順はそのリリースに従ってください。64ビット版 Windows 10/11 と WebGL2 対応 GPU が必要です。ZIP 全体を展開し、DLL、`resources`、`locales` フォルダーを一緒に保ったまま **AI Friends Kart.exe** を起動します。**F11** で全画面表示を切り替えます。Windows のセキュリティ保護を無効にしないでください。パッケージ作成や自動チェックの成功は、実機 Windows の GPU、性能、入力互換性の検証を意味しません。

## 操作方法

| 入力 | 操作 |
| --- | --- |
| `W` / `↑` | アクセル。離すと惰性走行 |
| `A` / `←`, `D` / `→` | 左右に操舵 |
| `S` / `↓` | ブレーキ。押し続けると後退 |
| `Space` | 後退せずにブレーキ |
| `Left Shift` + 操舵 | ドリフト。Shift を離すとチャージしたドリフトブーストを発動 |
| `E` / `R` | 対応する固定スロットのアイテムを使用 |
| `Z` / `C` | 追従カメラを切り替え |
| マウスの右ボタンを長押し | 一時的に後方を確認 |
| コースをクリックしてマウスを動かす | カメラを回り込ませる |
| `Q` | カメラの向きをリセット |
| `Esc` | 一時停止し、ポインターを解放 |
| `P` / 一時停止ボタン | 一時停止・再開 |

ポインターのキャプチャーが利用できない場合は、左ボタンを押しながらドラッグして周囲を見渡せます。タッチ操作はアクセル、操舵、後退、ブレーキ、ドリフトに加え、独立した `E` と `R` のアイテムボタンに対応します。メニューボタンは標準のキーボード操作にも対応します。モバイルのゲーム領域では文字の誤選択、画像のドラッグ、コンテキストメニュー、操作を妨げるジェスチャーを抑えつつ、必要な入力欄の操作とスクロールを維持します。OS のアクセシビリティ拡大をすべて抑止できる保証はありません。実機スマートフォンでの QA は未実施です。

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

**`dist/` 全体**を HTTP(S) で配信してください。`index.html` を `file://` で開かないでください。ドメインのルートやサブディレクトリへの相対パス配置は、実際の配布アーカイブとリリースの検証記録で確認してください。ライセンス通知、`source.html`、`source.zip` はゲームと一緒に配置してください。

完全なクローンには、`public/assets/drivers/` 内の6個の運転モデルと、`public/assets/portraits/` 内の6個の独立した立ち姿ポートレートが含まれます。小容量の `source.zip` にはコード、テスト、両方のチェックサムマニフェスト、ビルドファイル、オリジナルの編集可能な素材が含まれますが、この2組のキャラクターアーカイブは含まれません。展開後は次の手順で復元できます。

```sh
npm ci
npm run models:fetch
npm run food:fetch
npm run food:verify
npm run build
```

ソースアーカイブには別途取得する食べ物カートのデータも含まれません。上記コマンドで復元・検証してください。オリジナルの編集可能な素材ソースとマニフェストは同梱します。

取得スクリプトは独立した `/dev/` プレビューの固定公開パスを使い、[運転モデル](docs/runtime-models.json)と[立ち姿ポートレート](docs/portrait-models.json)の圧縮前後のハッシュを検証します。一致しないローカルファイルは上書きしません。コードのみでもビルドできますが、すべての表示には両方のモデルの復元が必要です。

### GitHub Pages

開発版のバージョンには、実際の commit ハッシュの先頭6文字を付けます。リリースタグは `main` から作成し、配布物はそのタグのソースから生成します。dev の公開では main のサイトルートを保持してください。

[Build and publish PlayCanvas game ワークフロー](.github/workflows/pages.yml)は、公開前に選択したソースをチェック、テスト、ビルドします。main 版はサイトのルート、独立プレビューは `/dev/` です。チェックアウトしたブランチの起動条件と公開オプションに従ってください。dev の公開ではmain のルートを保持し、配布パッケージには対応するリリースタグと同じソースを使用します。

### プロジェクト構成

- `src/`: PlayCanvas シーン、コース、レースロジック、入力、カメラ、キャラクターの読み込み
- `public/assets/`: 圧縮された6人のドライバーを含む、同梱のランタイム素材
- `models/`: オリジナルのカートと小物の編集可能なソース
- `tests/`: ロジック、読み込み、UI、エンジンレベルのチェック
- `scripts/`: ソースのパッケージ化、ランタイムモデルの取得、配布物のチェック
- `docs/`: モデルマニフェスト、ローカルインポート仕様、技術的な検証ノート

## ローカルドライバーの置き換え

ドライバースロットを選んで互換 GLB を読み込むか、各ファイル名にスロット名が1つ含まれるファイルを複数選択します。上限は**1個32 MiB**、同時処理は最大2個です。内容はページのメモリーにのみ保持し、アップロードも永続保存もしません。失敗・キャンセル時は前のドライバーを保持し、**Restore default** で同梱キャラクターに戻します。簡略化したレース読み込み画面では従来のインポート操作を非表示にし、キャラクター選択はメインメニューで行います。

対応モデルと検証ルールについては、[リグとインポートの仕様](docs/local-import.md)をご確認ください。

## 検証

過去の CPU 候補21の結果は、単一アイテムスロットのベースラインにのみ適用されます。新しい2スロットのゲームバランスや公平性を認定するものではありません。実機スマートフォンでの QA は未実施です。

自動チェックの対象は、エンジンに依存しないレース・入力ロジック、実際の PlayCanvas を用いた CPU/null-device でのリグ読み込み、モックによる UI 統合、静的な配布物のチェックです。GPU 上の見た目、ネイティブのポインターロック動作、パフォーマンスを保証するものではありません。[テスト範囲と制限](docs/MIGRATION-PARITY.md)、[海面シェーダーの回帰テストノート](docs/WATER-REGRESSION.md)をご確認ください。

<a id="license-and-model-rights"></a>

## ライセンスとモデルの権利

**コードとオリジナルのゲーム素材（音楽を除く）:** AGPL-3.0-only。オリジナルの UI、サーキット、カート、小物、編集可能なソースを含みます。[LICENSE](LICENSE)、[NOTICE](NOTICE)、[THIRD-PARTY-NOTICES.txt](THIRD-PARTY-NOTICES.txt)をご確認ください。PlayCanvas と fflate には引き続き MIT ライセンスが適用されます。

**オリジナル音楽（© 2026 JerryZRic）:** [個別の音楽ライセンス](public/assets/music/LICENSE.txt)が適用されます。3曲の楽曲・録音とその翻案は、本ゲームとその fork の一部として、クレジットと通知を保持した非商用の利用・改変・配布が可能です。商用利用には JerryZRic の事前許可が必要です。無関係なプロジェクトや、ゲームと fork から独立した音楽の配布・販売は許可されません。コードの AGPL 条項は変更されません。

**6体のキャラクターの運転モデルと立ち姿ポートレート:** 別個の権利が適用されます。プロジェクト所有者は、非商用の制限がある Tripo Free の出力物と説明していますが、正確な再配布条件は独立に確認されていません。ここへの収録は、新たなモデルライセンス、Creative Commons ライセンス、商用利用の許可を付与するものではありません。AGPL によってキャラクターのライセンスが変更されることもありません。再利用・再配布の前に適用される権利を確認し、必要な許可を取得してください。[MODEL-NOTICE.txt](MODEL-NOTICE.txt)をご確認ください。

このプロジェクトに含まれるのは最終版のキャラクターランタイムファイルであり、キャラクターの Blender プロジェクトやハイポリゴンの制作ソースではありません。オリジナルのカート・小物の編集可能なファイルは、対応するソースとして引き続き同梱しています。デモには広告、決済、商用のモデル販売はありません。
