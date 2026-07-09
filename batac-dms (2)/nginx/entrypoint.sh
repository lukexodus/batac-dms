#!/bin/sh
# nginx/entrypoint.sh
set -e
envsubst '${APP_DOMAIN}' < /etc/nginx/templates/batac.conf.template \
  > /etc/nginx/conf.d/batac.conf
exec nginx -g 'daemon off;'
