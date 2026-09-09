#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"

# Run by repo-puller on the server after pulling the `deploy` branch
# (which contains the built dist/ plus this script).
echo "Deploying beeminder-timer files..."
rsync -a --delete --exclude 'deploy.sh' --exclude '.git' ./ /var/www/html/beeminder-timer/
chown -R www-data:www-data /var/www/html/beeminder-timer/
echo "Done."
