# his — 紹介動画（30秒 / 英語VO）

プロダクト紹介動画。ダークUIのクリーン＆プレミアム路線。

| 項目 | 内容 |
|---|---|
| 尺 / 比率 | 30.0s / 16:9（1920×1080, 30fps） |
| フック | Never lose your history |
| CTA | Download for macOS |
| VO | Kokoro ローカルTTS · 男性 `am_michael` · speed 0.95 · MP3 64kbps mono |
| BGM | `assets/bgm/bgm_001.mp3`（HeyGen音源）· volume 0.22 |
| 最終出力 | `out/his-promo.mp4` |
| 技術 | HyperFrames（HTMLタイムライン + GSAP）+ FFmpeg |

**配色**: bg `#0B0E14` / surface `#151A23` / border `#2C313F` / text `#F7F9FC` / muted `#7E8A9E` / primary `#4465DB`
**フォント**: system-ui（アプリと同じ）

## カット構成

| Cut | 尺 | 内容 | VO |
|---|---|---|---|
| 1 | 7.0s | 履歴カードが消えていく（課題） | Your history disappears. / Cleared caches. / Switched browsers. / Gone. |
| 2 | 5.7s | ロゴ出現 → ブラウザロゴが1つに収束 → ONE ARCHIVE | his / keeps it all. / For every browser. / One private archive. |
| 3 | 6.8s | WebUI実録画（3Dウィンドウ、回転・スクロール） | Charts and totals. / Every visit, in order. / And rich detail for YouTube and GitHub. |
| 4 | 5.0s | LOCAL-FIRST ＋ 自動同期リング | It runs on your Mac, / syncing automatically in the background. |
| 5 | 5.5s | CTA（ロゴ・タグライン・Download for macOS・URL） | his. / Never lose your history. / Download for macOS. |

- カット間はハードカット（境界トランジションなし）
- BGMは全編通し（0–30s、フェードin 0.8s / フェードout 27.5–30s）
- 各VOは1フレーズ1ファイル（`audio/vo/cutN/<順序>-<snake_phrase>.mp3`）を各カット内で個別に配置

## メモ
- Cut 3 の実録画はモックWebUI（`site/demo`）を配信して撮影（ビルド不要）
- **録画は Playwright `recordVideo` を使わない**: VP8固定・低ビットレートのためダークUIに圧縮ノイズ（シミ）が出る。CDPスクリーンキャストで**可逆PNGフレーム**を取得し、x264 CRF14 でエンコードする（`assets/webui/*.mp4`）

## 操作
```bash
cd video
npx --yes hyperframes@0.8.227 preview    # プレビュー http://localhost:3002/#project/video
npx --yes hyperframes@0.8.227 check      # 検証
npx --yes hyperframes@0.8.227 render -o out/his-promo.mp4   # 書き出し
```
