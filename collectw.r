--with-librrd-include-dir=
--with-librrd-lib-dir=
--with-rrd-basedir=/var/lib/collectd/rrd

CFLAGS+=$(if $(--with-librrd-include-dir),-I$(--with-librrd-include-dir))
CFLAGS+=-D COLLECTW_RRD_BASEDIR=\"$(--with-rrd-basedir)\"
#CFLAGS+=-D ZERO_INSTEAD_OF_NAN_AND_INF=1

LDFLAGS+=$(if $(--with-librrd-lib-dir),-L$(--with-librrd-lib-dir))
LDFLAGS+=-lrrd

check-dep+=$(if\
 $(wildcard $(if $(--with-librrd-include-dir),$(--with-librrd-include-dir),/usr/include)/rrd.h)\
 $(wildcard $(if $(--with-librrd-lib-dir),$(--with-librrd-lib-dir),/usr/include)/librrd.*)\
,,librrd-dev)
