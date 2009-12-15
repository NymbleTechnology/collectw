#ifndef __COLLECTW_HEADER__
#define __COLLECTW_HEADER__

#ifndef COLLECTW_INTERFACE
#error You must use one of interfaces.
#else
#include COLLECTW_INTERFACE

int collectw_init(const char *rrd_basedir);
int collectw_info(Stream stream);
int collectw_data(Stream stream, const char *path);

#endif
#endif
