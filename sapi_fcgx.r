--with-fcgx-listen=:7000

CFLAGS+=-D SAPI_FCGX_LISTEN=\"$(--with-fcgx-listen)\"
CFLAGS+=-D COLLECTW_FCGX_HELP="\"$(shell cat sapi_fcgx.n | sed -e :a -e '$b;N;s/\n/\\n/;ba' | sed 's/\t/\\t/g')\""
