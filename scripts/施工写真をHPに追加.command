#!/bin/zsh
cd "/Users/yasudashinya/Documents/New project/ex-takumi-site" || exit 1

echo "施工写真をHP用フォルダへ取り込みます。"
echo ""
node scripts/import-works.mjs --publish
echo ""
echo "この画面を閉じるには Enter キーを押してください。"
read
