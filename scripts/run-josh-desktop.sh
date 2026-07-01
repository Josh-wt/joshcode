#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
release_dir="$repo_root/release"
latest_link="$release_dir/Synara-latest-x86_64.AppImage"

resolve_appimage() {
  if [[ -e "$latest_link" ]]; then
    printf '%s\n' "$latest_link"
    return
  fi

  local newest=""
  local candidate
  for candidate in "$release_dir"/Synara-*-x86_64.AppImage; do
    [[ -e "$candidate" ]] || continue
    [[ "$candidate" == "$latest_link" ]] && continue
    if [[ -z "$newest" || "$candidate" -nt "$newest" ]]; then
      newest="$candidate"
    fi
  done

  if [[ -z "$newest" ]]; then
    echo "No Synara AppImage found in $release_dir. Run: bun run dist:desktop:linux" >&2
    exit 1
  fi

  printf '%s\n' "$newest"
}

exec "$(resolve_appimage)" --no-sandbox "$@"
