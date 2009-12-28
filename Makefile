# Makefile --- 
#
# Copyright (C) 2009 Kayo Phoenix
#
# Author: Kayo Phoenix <kayo.k11.4@gmail.com>
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
# 
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
# 
# You should have received a copy of the GNU General Public License
# along with this program.  If not, see <http://www.gnu.org/licenses/>.


title=CollectW - WebUI for CollectD by Phoenix Kayo

target=collectw
sources=$(wildcard *.c)
objects=$(patsubst %.c,%.o,$(sources))

html-object=index.html
css-sources=$(wildcard css/*.css)
css-object=style.css
ecm-sources=$(wildcard ecm/*.js)
ecm-object=script.js

LDFLAGS+=-lfcgi -lrrd

--prefix=/usr/local
--bin-dir=/bin
--web-dir=/share/collectw
--with-interface=fcgx
--with-rrd-basedir=/var/lib/collectd/rrd
--with-user-config=/etc/collectw.json

include sapi_*.r
-include config

ifdef --enable-debug
CFLAGS+=-g -D DEBUG=1
CFLAGS+=-D COLLECTW_USER_CONFIG=\"user-config.json\"
else
CFLAGS+=-D COLLECTW_USER_CONFIG=\"$(--with-user-config)\"
endif

CFLAGS+=-D COLLECTW_INTERFACE=\"sapi_$(--with-interface).h\"
CFLAGS+=-D COLLECTW_RRD_BASEDIR=\"$(--with-rrd-basedir)\"

add-doctype=echo '<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01 Transitional//EN" "http://www.w3.org/TR/html4/loose.dtd">';
add-contype=echo '<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">';
add-title=echo '<title>$(title)</title>';
add-ecm=echo '<script type="text/javascript" src="$(1)"></script>';
add-css=echo '<link rel="stylesheet" href="$(1)" type="text/css" />';
add-div=echo '<div id="$(1)">$(2)</div>';

webcont+=$(html-object)
ifndef --enable-debug
webcont+=$(css-object) $(ecm-object)
endif

all: $(target) $(webcont)

probe:
	@echo CFLAGS=$(CFLAGS)
	@echo LDFLAGS=$(LDFLAGS)

$(target): $(objects)
	@gcc -o $@ $^ $(LDFLAGS)

$(html-object):
	@{ $(call add-doctype) echo '<html><head>'; $(call add-contype) } > $@
ifdef --enable-debug
	@{ $(foreach f,$(css-sources),$(call add-css,$(f))) } >> $@
	@{ $(foreach f,$(ecm-sources),$(call add-ecm,$(f))) } >> $@
else
	@$(call add-css,$(css-object)) >> $@
	@$(call add-ecm,$(ecm-object)) >> $@
endif
	@{ $(call add-title) echo '</head><body>'; echo '</body></html>'; } >> $@

$(css-object): $(css-sources)
	@cat $^ > $@

$(ecm-object): $(ecm-sources)
	@cat $^ > $@

clean:
	@rm -f $(target) $(objects) $(webcont)

