#!/bin/bash
set -euo pipefail
studio_root="$(cd "$(dirname "$0")" && pwd)"
studio_codex="$(command -v codex || true)"
if [ -z "$studio_codex" ] && [ -x "$HOME/.local/bin/codex" ]; then
  studio_codex="$HOME/.local/bin/codex"
fi
if [ -z "$studio_codex" ]; then
  echo "Codex CLI를 찾지 못했어요. README의 데스크탑 설치 안내를 따라주세요."
  exit 1
fi
"$studio_codex" plugin marketplace add "$studio_root"
"$studio_codex" plugin add ablelam-card-studio@ablelam-studio
echo "에이블램 명함 스튜디오를 설치했어요. 데스크탑앱의 새 채팅에서 플러그인을 선택해주세요."
