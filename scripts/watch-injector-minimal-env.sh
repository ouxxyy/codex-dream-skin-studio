#!/bin/bash

set -euo pipefail

if [ "$#" -ne 5 ]; then
  printf 'usage: %s HOME NODE INJECTOR PORT THEME_DIR\n' "$0" >&2
  exit 64
fi

user_home="$1"
node_path="$2"
injector_path="$3"
port="$4"
theme_dir="$5"

exec /usr/bin/env -i \
  HOME="$user_home" \
  PATH=/usr/bin:/bin:/usr/sbin:/sbin \
  "$node_path" "$injector_path" --watch --port "$port" --theme-dir "$theme_dir"
