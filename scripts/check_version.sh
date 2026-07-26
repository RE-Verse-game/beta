#!/usr/bin/env bash
# The release version lives in three hand-maintained places, and they have
# already drifted apart once: v0.0.4 shipped with a README badge still reading
# v0.0.3, because the badge is the one nobody remembers to bump. This checks
# that the three agree, so the next drift is a red CI run instead of a question.
#
#   1. the README shields.io badge
#   2. the newest heading in CHANGELOG.md
#   3. a link reference for that version at the bottom of CHANGELOG.md
#
# On a tag build it also checks the tag itself matches. Run it anywhere:
#
#     bash scripts/check_version.sh
set -euo pipefail

cd "$(dirname "$0")/.."

badge=$(grep -o 'version-v[0-9.]*' README.md | head -1 | sed 's/^version-//')
changelog=$(grep -m1 -o '^## \[v[0-9.]*\]' CHANGELOG.md | tr -d '#[] ')

fail=0
note() { printf '  %s\n' "$1"; fail=1; }

echo "README badge     : ${badge:-<none>}"
echo "CHANGELOG newest : ${changelog:-<none>}"

[ -n "$badge" ] || note "no version badge found in README.md"
[ -n "$changelog" ] || note "no '## [vX.Y.Z]' heading found in CHANGELOG.md"

if [ -n "$badge" ] && [ -n "$changelog" ] && [ "$badge" != "$changelog" ]; then
  note "badge ($badge) and newest CHANGELOG entry ($changelog) disagree"
fi

# Every heading needs a link reference, or the version renders as bare text.
while read -r version; do
  grep -q "^\[$version\]:" CHANGELOG.md \
    || note "CHANGELOG has no link reference for $version"
done < <(grep -o '^## \[v[0-9.]*\]' CHANGELOG.md | tr -d '#[] ')

# Tag builds: the thing being released has to say it is that release.
if [ "${GITHUB_REF_TYPE:-}" = "tag" ]; then
  echo "tag              : ${GITHUB_REF_NAME:-<none>}"
  [ "${GITHUB_REF_NAME:-}" = "$changelog" ] \
    || note "tag (${GITHUB_REF_NAME:-<none>}) and CHANGELOG ($changelog) disagree"
fi

if [ "$fail" -ne 0 ]; then
  echo "version metadata is inconsistent — fix before releasing" >&2
  exit 1
fi
echo "version metadata agrees"
