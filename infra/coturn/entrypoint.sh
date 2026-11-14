#!/bin/sh
# Render the coturn config from the environment at container start.
# The shared secret is never written to the image or the repository.
set -eu

: "${TURN_SECRET:?TURN_SECRET is required}"
: "${TURN_REALM:?TURN_REALM is required}"
: "${PUBLIC_IPV4:?PUBLIC_IPV4 is required}"

sed \
  -e "s|__TURN_SECRET__|${TURN_SECRET}|g" \
  -e "s|__TURN_REALM__|${TURN_REALM}|g" \
  -e "s|__PUBLIC_IPV4__|${PUBLIC_IPV4}|g" \
  /etc/coturn/turnserver.conf.template > /tmp/turnserver.conf

exec turnserver -c /tmp/turnserver.conf
