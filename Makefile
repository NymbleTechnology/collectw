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

ifeq ($(wildcard config),)
$(error Run ./configure before..)
else

title=CollectW - WebUI for CollectD by Phoenix Kayo

target=collectw
sources=$(wildcard *.c)
objects=$(patsubst %.c,%.o,$(sources))

html-object=index.html
css-sources=$(wildcard css/*.css)
css-object=style.css
ecm-sources=$(wildcard ecm/*.js)
ecm-object=script.js

nginx-config=collectw.nginx
site-config=$(nginx-config)

--prefix=/usr/local
--bin-dir=bin
--web-dir=share/collectw
--with-interface=fcgx
--with-user-config=/etc/collectw.json
--nginx-cfg-dir=/etc/nginx
--server-listen=40011
--server-name=

include sapi_*.r
include collectw.r
include config

ifdef --enable-debug
CFLAGS+=-g -D DEBUG=1
endif

webcont+=$(html-object)
nginx-fcgi-listen=127.0.0.1$(--with-fcgx-listen)

ifdef --devel-mode
user-config=$(CURDIR)/user-config.json
www-data=$(CURDIR)
bin-exec=$(CURDIR)/$(target)
else
user-config=$(--with-user-config)
www-data=$(--prefix)/$(--web-dir)
bin-exec=$(--prefix)/$(--bin-dir)/$(target)
webcont+=$(css-object) $(ecm-object)
endif

CFLAGS+=-D COLLECTW_USER_CONFIG=\"$(user-config)\" -D COLLECTW_INTERFACE=\"sapi_$(--with-interface).h\"

add-doctype=echo '<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01 Transitional//EN" "http://www.w3.org/TR/html4/loose.dtd">';
add-contype=echo '<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">';
add-title=echo '<title>$(title)</title>';
add-ecm=echo '<script type="text/javascript" src="$(1)"></script>';
add-inline-ecm=echo '<script type="text/javascript">$(1)</script>';
add-css=echo '<link rel="stylesheet" href="$(1)" type="text/css" />';
add-div=echo '<div id="$(1)">$(2)</div>';
add-ico=echo '<link rel="icon" type="image/png" href="$(1)" />';

all: $(target) $(webcont) $(site-config)

check:
	@$(if $(strip $(check-dep)),$(foreach d,$(check-dep),echo "Dependence \"$d\" unsatisfied..";) exit 1,exit 0)

$(target): $(objects)
	$(CC) -o $@ $^ $(LDFLAGS)

$(html-object):
	@{ $(call add-doctype) echo '<html><head>'; $(call add-contype) } > $@
	@{ $(call add-ico,icon.png) } >> $@
ifdef --demo-mode
	@{ $(call add-inline-ecm,var demo_mode=true;) } >> $@
else
	@{ $(call add-inline-ecm,var demo_mode=false;) } >> $@
endif
ifdef --devel-mode
	@{ $(foreach f,$(css-sources),$(call add-css,$(f))) } >> $@
	@{ $(foreach f,$(ecm-sources),$(call add-ecm,$(f))) } >> $@
else
	@{ $(call add-css,$(css-object)) } >> $@
	@{ $(call add-ecm,$(ecm-object)) } >> $@
endif
	@{ $(call add-title) echo '</head><body>'; echo '</body></html>'; } >> $@

$(css-object): $(css-sources)
	@cat $^ > $@

$(ecm-object): $(ecm-sources)
	@cat $^ > $@

$(nginx-config):
	@echo "# CollectW server config.." > $@
	@echo "server {" >> $@
	$(if $(strip $(--server-listen)),@echo "  listen $(--server-listen);" >> $@)
	$(if $(strip $(--server-name)),@echo "  server_name $(--server-name);" >> $@)
	@echo '  root $(www-data);' >> $@
	@echo '  index index.html;' >> $@
	@echo '  location ~* ^.+\.(css|js|png|ico)$$ {' >> $@
	@echo '    access_log off;' >> $@
	@echo '    expires 31d;' >> $@
	@echo '    add_header Last-Modified: $$date_gmt;' >> $@
	@echo '  }' >> $@
	@echo '  location /$(target) {' >> $@
	@echo '    fastcgi_pass $(nginx-fcgi-listen);' >> $@
	@echo '    include fastcgi_params;' >> $@
	@echo '  }' >> $@
	@echo '}' >> $@
nginx-config: $(nginx-config)

clean:
	@rm -f $(target) $(objects) $(webcont) $(site-config)

install: all
ifdef --devel-mode
	@[ -d $(--nginx-cfg-dir) ] && { ln -s "$(CURDIR)/$(nginx-config)" $(--nginx-cfg-dir)/sites-available/$(target); ln -s $(--nginx-cfg-dir)/sites-available/$(target) $(--nginx-cfg-dir)/sites-enabled/$(target); }
else
	@install -m 755 $(target) $(bin-exec)
	@install -m 644 $(webcont) icon.png $(www-data)
endif

uninstall:
	@rm -f $(--nginx-cfg-dir)/sites-enabled/$(target) $(--nginx-cfg-dir)/sites-available/$(target)
ifdef --devel-mode
else
	@rm -f $(bin-exec)
	@rm -rf $(www-data)
endif

.PHONY: check clean install uninstall

endif
