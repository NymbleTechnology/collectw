title=CollectW - WebUI for CollectD by Phoenix Kayo

target=collectw
sources=$(wildcard *.c)
objects=$(patsubst %.c,%.o,$(sources))

html-object=index.html
css-sources=$(wildcard css/*.css)
css-object=style.css
ecm-sources=$(wildcard js/*.js)
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

all: collectw

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
	@{ $(call add-title) echo '</head><body>'; $(call add-div,tabs,<ul></ul>) $(call add-div,date) $(call add-div,view) $(call add-div,stat) echo '</body></html>'; } >> $@



clean:
	@rm -f $(target) $(objects) $(html-object) $(ecm-object) $(css-object)

