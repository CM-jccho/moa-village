#!/usr/bin/env bash
# MOA Village — GitHub 저장소 생성 + 첫 푸시 + Pages 활성화
#
# 사용자가 직접 실행하거나, 사용자의 승인을 받은 뒤 실행하세요.
# 공개 저장소가 만들어지고 인터넷에 공개됩니다.
#
#   bash scripts/deploy_github.sh                # CM-jccho/moa-village
#   bash scripts/deploy_github.sh my-name        # 다른 이름
#
set -euo pipefail

NAME="${1:-moa-village}"
OWNER="$(gh api user --jq .login)"
DIR="$(cd "$(dirname "$0")/.." && pwd)"

cd "$DIR"

if [ ! -d .git ]; then
  git init -q
  git add -A
  git commit -qm "feat: MOA Village prototype"
  git branch -M main
fi

if gh repo view "$OWNER/$NAME" >/dev/null 2>&1; then
  echo "저장소 $OWNER/$NAME 이(가) 이미 있습니다 — 원격만 연결합니다."
  git remote get-url origin >/dev/null 2>&1 || git remote add origin "https://github.com/$OWNER/$NAME.git"
else
  echo "공개 저장소 $OWNER/$NAME 을(를) 만듭니다."
  gh repo create "$OWNER/$NAME" --public --source=. --remote=origin --push
fi

git push -u origin main 2>/dev/null || git push -u origin main

# Pages: GitHub Actions 로 배포
if gh api "repos/$OWNER/$NAME/pages" >/dev/null 2>&1; then
  echo "Pages 가 이미 켜져 있습니다."
else
  gh api -X POST "repos/$OWNER/$NAME/pages" -f "build_type=workflow" >/dev/null 2>&1 \
    && echo "Pages(Actions) 활성화 완료" \
    || echo "Pages 자동 활성화 실패 — Settings → Pages → Source: GitHub Actions 로 설정하세요."
fi

echo ""
echo "배포 주소(1~2분 뒤): https://$OWNER.github.io/$NAME/"
echo "워크플로: gh run list -R $OWNER/$NAME"
