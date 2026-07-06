#!/bin/sh
set -e

if [ -z "$GH_PAT" ]; then
  echo "ERROR: GH_PAT is not set in Vercel environment variables."
  exit 1
fi

echo "Configuring git auth..."
git config --global url."https://${GH_PAT}@github.com/".insteadOf "git@github.com:"
git config --global url."https://${GH_PAT}@github.com/".insteadOf "ssh://git@github.com/"
git config --global url."https://${GH_PAT}@github.com/".insteadOf "https://github.com/"

echo "Installing dependencies..."
pnpm install