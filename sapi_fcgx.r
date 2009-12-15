--with-fcgx-listen=:7000

CFLAGS+=-D SAPI_FCGX_LISTEN=\"$(--with-fcgx-listen)\"
