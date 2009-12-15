sources=$(wildcard *.c)
objects=$(patsubst %.c,%.o,$(sources))

LDFLAGS+=-lfcgi -lrrd

--prefix=/usr/local
--bin-dir=/bin
--web-dir=/share/collectw
--with-interface=fcgx
--with-rrd-basedir=/var/lib/collectd/rrd

include sapi_*.r

-include config

CFLAGS+=-D COLLECTW_INTERFACE=\"sapi_$(--with-interface).h\"
CFLAGS+=-D COLLECTW_RRD_BASEDIR=\"$(--with-rrd-basedir)\"

all: collectw

probe:
	@echo CFLAGS=$(CFLAGS)
	@echo LDFLAGS=$(LDFLAGS)

collectw: $(objects)
	@gcc -o $@ $^ $(LDFLAGS)

clean:
	@rm -f *.o collectw

