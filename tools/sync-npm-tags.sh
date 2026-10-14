#!/usr/bin/env bash
set -euo pipefail

package_name=${1:?package name required}
target_version=${2:-}
if [[ -z "$target_version" ]]; then
  target_version=$(npm view "${package_name}@latest" version --prefer-online)
fi

if [[ ${TEA_TAG_CHECK_PERMISSION:-0} == 1 ]]; then
  check_tag="tea-publish-check-${GITHUB_RUN_ID:?}-${GITHUB_RUN_ATTEMPT:-1}"
  npm dist-tag add "${package_name}@${target_version}" "$check_tag"
  trap 'npm dist-tag rm "$package_name" "$check_tag" >/dev/null || true' EXIT
  npm dist-tag rm "$package_name" "$check_tag"
  trap - EXIT
fi

attempts=${TEA_TAG_SYNC_ATTEMPTS:-90}
for ((attempt = 1; attempt <= attempts; attempt++)); do
  if npm dist-tag add "${package_name}@${target_version}" next; then
    if tags=$(npm view "$package_name" dist-tags --json --prefer-online); then
      if node -e '
        const tags = JSON.parse(process.argv[1]);
        const version = process.argv[2];
        process.exit(tags.latest === version && tags.next === version ? 0 : 1);
      ' "$tags" "$target_version"; then
        echo "npm latest and next both point to ${target_version}"
        exit 0
      fi
    fi
  fi
  if ((attempt < attempts)); then
    echo "Waiting for npm tags to show ${target_version} (attempt ${attempt}/${attempts})"
    sleep 10
  fi
done

echo "npm latest and next did not converge on ${target_version}" >&2
exit 1
