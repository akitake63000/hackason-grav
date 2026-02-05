# 機能3開発キックオフ・サマリ

本ドキュメントは、機能3（生活アドバイザー）の開発開始にあたり、決定事項と準備状況をまとめたものです。
担当者は本ドキュメントを確認後、直ちに作業を開始してください。

## 1. 決定事項: 縦割り開発戦略 (Vertical Slicing)

開発効率と整合性を担保するため、**「入力(分析) vs 出力(提案)」という横割りではなく、「食体験 vs 生活習慣・運動」という縦割り**で分担します。
これにより、各開発者は自身の実装フロー内で因果関係（入力→分析→提案）を調整でき、相手の進捗待ち（ブロック）が発生しません。

## 2. 準備状況

以下の準備が完了しています。

*   **詳細分担書**: [`docs/feature3_task_breakdown.md`](./feature3_task_breakdown.md)
    *   **最新版(2026-02-05更新)**: 監査指摘に基づき、全てのADKツールファイル（`recommend_foods.py` 等）を網羅的に追記済みです。
    *   担当A（食の改善フロー）と担当B（生活習慣・傾向フロー）の具体的なタスク定義済み。
*   **親ブランチ**: `feature/team-c/lifestyle`
    *   作成済み。機能3全体のマージターゲットです。

## 3. 担当者別：作業開始手順

### 担当A（食の改善フロー）
1.  親ブランチから作業ブランチを作成:
    ```bash
    git fetch origin
    git checkout feature/team-c/lifestyle
    git checkout -b feature/team-c/dietary
    ```
2.  `docs/feature3_task_breakdown.md` の「担当A」セクションに基づき、`apps/web/src/app/feature3/meal/` 等の実装を開始。

### 担当B（生活習慣・傾向フロー）
1.  親ブランチから作業ブランチを作成:
    ```bash
    git fetch origin
    git checkout feature/team-c/lifestyle
    git checkout -b feature/team-c/tendency
    ```
2.  `docs/feature3_task_breakdown.md` の「担当B」セクションに基づき、`apps/web/src/app/feature3/tendency/` 等の実装を開始。

---
*Created: 2026-02-05*
