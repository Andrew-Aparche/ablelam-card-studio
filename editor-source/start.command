#!/bin/zsh
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  print "Node.js 20.19+ 또는 22.12+를 설치한 뒤 다시 실행해주세요."
  read -k 1
  exit 1
fi
if [[ ! -d node_modules ]]; then
  npm install || exit 1
fi
print "명함 스튜디오: http://127.0.0.1:5173/"
npm run dev
