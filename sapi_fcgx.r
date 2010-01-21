--with-libfcgi-include-dir=
--with-libfcgi-lib-dir=
--with-fcgx-listen=:7000

CFLAGS+=$(if $(--with-libfcgi-include-dir),-I$(--with-libfcgi-include-dir))
CFLAGS+=-D SAPI_FCGX_LISTEN=\"$(--with-fcgx-listen)\"
CFLAGS+=-D COLLECTW_FCGX_HELP="\"$(shell cat sapi_fcgx.n | sed -e :a -e '$b;N;s/\n/\\n/;ba' | sed 's/\t/\\t/g')\""

LDFLAGS+=$(if $(--with-libfcgi-lib-dir),-L$(--with-libfcgi-lib-dir))
LDFLAGS+=-lfcgi

check-dep+=$(if\
 $(wildcard $(if $(--with-libfcgi-include-dir),$(--with-libfcgi-include-dir),/usr/include)/fcgiapp.h)\
 $(wildcard $(if $(--with-libfcgi-lib-dir),$(--with-libfcgi-lib-dir),/usr/lib)/libfcgi.*)\
,,libfcgi-dev)
