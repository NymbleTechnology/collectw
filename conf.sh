#!/bin/bash
set -x
./configure \
    --prefix="/" \
    --bin-dir=/usr/bin \
    --web-dir=/var/www/html \
    --with-interface=fcgx \
    --with-fcgx-listen=/tmp/collectw \
    --with-rrd-basedir=/var/lib/collectd/rrd/local/ \
    --with-user-config=/etc/collectw.json
