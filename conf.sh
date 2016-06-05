#!/bin/bash
set -x
./configure \
    --prefix="/" \
    --bin-dir=/usr/bin \
    --web-dir=/var/www/html \
    --with-interface=fcgx \
    --with-fcgx-listen=127.0.0.1:7000 \
    --with-rrd-basedir=/var/www/rrd \
    --with-user-config=/etc/collectw.json
