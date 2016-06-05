/** collectw.c ---
 *
 * Copyright (C) 2009 Kayo Phoenix
 *
 * Author: Kayo Phoenix <kayo.k11.4@gmail.com>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

#include <string.h>
#include <stdio.h>
#include <stdlib.h>
#include <sys/types.h>
#include <sys/stat.h>
#include <unistd.h>
#include <syslog.h>
#include <dirent.h>
#define __USE_XOPEN
#include <time.h>
#include <rrd.h>
#include <math.h>

#ifndef NAN
#ifdef FP_NAN
#define NAN FP_NAN
#else
#define NAN (nanf(""))
#endif
#endif

#include "collectw.h"

#define ERROR(message) { FPrintF(stream, "{status:false,message:\"%s\"}", message); return 3; }

static const char *collectw_rrd_basedir = COLLECTW_RRD_BASEDIR;
static const char *collectw_user_config = COLLECTW_USER_CONFIG;

int collectw_init( const char *rrd_basedir, const char *user_config )
{
  struct stat buf;
  int ret=0;

  if ( rrd_basedir && strlen( rrd_basedir )) { collectw_rrd_basedir = rrd_basedir; };
  if ( user_config && strlen( user_config )) { collectw_user_config = user_config; };

  if (stat(collectw_rrd_basedir, &buf))
  {
    syslog( LOG_ERR, "RRD basedir set as \"%s\", but it's unavailable or does not exist", collectw_rrd_basedir);
    ret++;
  }
  else
  {
    if ( S_ISDIR(buf.st_mode) )
    {
      if (access(collectw_rrd_basedir, R_OK))
      {
	syslog( LOG_ERR, "RRD basedir set as \"%s\", but it has no read access", collectw_rrd_basedir);
	ret++;
      }
    }
    else
    {
      syslog( LOG_ERR, "RRD basedir set as \"%s\", but it's not a directory", collectw_rrd_basedir);
      ret++;
    }
  }

  if (stat(collectw_user_config, &buf))
  {
    syslog( LOG_ERR, "User config set as \"%s\", but it's unavailable or does not exist", collectw_user_config);
    ret++;
  }
  else
  {
    if ( S_ISREG(buf.st_mode) )
    {
      if (access(collectw_user_config, R_OK))
      {
	syslog( LOG_ERR, "User config set as \"%s\", but it has no read access", collectw_user_config);
	ret++;
      }
    }
    else
    {
      syslog( LOG_ERR, "User config set as \"%s\", but it's not a file", collectw_user_config);
      ret++;
    }
  }

  return ret;
}

int collectw_none( Stream stream, const char **param )
{
  ERROR("Unsupported request!");
}

int collectw_load( Stream stream, const char **param )
{
  if (!collectw_user_config) ERROR("Config file not defined!");

  FILE* file = fopen(collectw_user_config, "r");
  if (!file) ERROR("Unable to open config file");

  char buf[1024];
  size_t cnt;

  while ( !feof(file) )
  {
    if ( (cnt = fread( buf, 1, sizeof(buf)-1, file )) > 0 )
    {
      PutStr( buf, cnt, stream );
    }
  }
  fclose(file);
  return 0;
}

int collectw_save( Stream stream, const char **param )
{
  if (!param[0]) ERROR( "Empty config!" );
  if (!collectw_user_config) ERROR( "Config file not defined!" );
  FILE* file = fopen( collectw_user_config, "w" );
  if (!file) ERROR( "Config file not found or access denied!" );
  fwrite( param[0], 1, strlen(param[0]), file );
  fclose( file );
  FPrintF( stream, "{status:true,message:'Config saved..'}" );
  return 0;
}

#define RRD_EXT ".rrd"

static int _collectw_info( Stream stream, const char *path )
{
  struct dirent *d;
  DIR  *f;
  int  len, rrd;
  char *p, *p1, *m, sep1;

  if ( !path || !strlen(path) ) return 2;
  if ( !(f = opendir(path)) ) return 1;

  sep1 = '{';
  while ( (d = readdir(f)) )
  {
    /* ignore . and .. */
    if ( d->d_name[0] == '.' && (d->d_name[1] == '\0' || (d->d_name[1] == '.' && d->d_name[2] == '\0')) )
      { continue; }

    /* emit separator, initially a left brace */
    PutChar( sep1, stream );
    sep1 = ','; /* after left brace, change to comma seperator */

    p = d->d_name;
    len = 0;
    rrd = 0;
    while ( *p != '\0' )
    {
      if ( *p == '.' )
      {
        p1 = p;
        m = ".rrd";
        while ( *p == *m && *p != '\0' ) { ++p; ++m; }

        if ( *p == '\0' && *m == '\0' )
        {
          /* yes, '.rrd' coincided with end of d_name */
          rrd = 1;
          break;
        }
        else
        {
          /* false alarm, so restore & continue */
          p = p1;
        }
      }
      ++p; ++len;
    }

    /* output name as element */
    PutChar( '\'', stream );
    PutStr( d->d_name, len, stream );
    PutChar( '\'', stream );
    PutChar( ':',  stream );

    /* create full file path */
    char file[ strlen(path) + strlen(d->d_name) + 2 ];
    strcpy(file, path);
    strcat(file, "/");
    strcat(file, d->d_name);

    if ( !rrd )
    {
      /* recurse depth-first */
      _collectw_info(stream, file);
    }
    else
    {
      /* emit info about the RRD file */
      char       sep2, *name;
      rrd_info_t *info, *infoList;
      char       *args[] = { NULL, file, NULL };

      infoList = rrd_info( 2, args );

      if ( infoList != NULL )
      {
        sep2 = '[';
        for ( info = infoList; info; info = info->next )
        {
          p = info->key;
          m = "ds[";
          while ( *p == *m && *p != '\0' ) { ++p; ++m; }

          if ( *m == '\0' )
          {
            name = p;
            while ( *p != ']' && *p != '\0' ) { ++p; }

            if ( *p == ']' )
            {
              len = p - name;

              m = "].type";
              while ( *p == *m && *p != '\0' ) { ++p; ++m; }

              if ( *m == '\0' )
              {
                PutChar( sep2, stream );
                sep2 = ',';
                PutStr( name, len, stream );
              }
            }
          }
        } /* for */
        rrd_info_free( infoList );
      }

      /* if we emitted the opening bracket, also emit the closing one */
      if (sep2 == ',')
      {
        PutChar( ']', stream );
      }
    }
  }
  if (sep1 == ',')
  {
    PutChar( '}', stream );
  }

  closedir(f);
  return 0;
}

int collectw_info( Stream stream, const char **param )
{
  return _collectw_info(stream, collectw_rrd_basedir);
}

static void collectw_output_value(Stream stream, rrd_value_t *value)
{
#ifdef ZERO_INSTEAD_OF_NAN_AND_INF
  if( isnan(*value) || isinf(*value) )
  {
    FPrintF(stream, "0");
  }
#else
  if (isnan(*value))
  {
    FPrintF(stream, "NaN");
  }
  else if (isinf(*value))
  {
    if ( signbit(*value) )
      PutChar( '-', stream );
    FPrintF(stream, "Infinity");
  }
#endif
  else
  {
    FPrintF(stream, "%g", *value);
  }
}

static int _collectw_data( Stream        stream,
			   const char    *path,
			   const char    *ds,
			   const char    *type,
			   time_t        *from,
			   time_t        *to,
			   unsigned long *step,
			   rrd_value_t   *min,
			   rrd_value_t   *max )
{
  char fullpath[ strlen(collectw_rrd_basedir) + strlen(path)+1 + strlen(RRD_EXT)+1 ];
  unsigned long ds_cnt = 0, l, n, i;
  char **ds_name, sep;
  rrd_value_t *data, *value;

  fullpath[0] = '\0';
  strcat( fullpath, collectw_rrd_basedir );
  if ( fullpath[0] != '\0' )
    strcat( fullpath, "/" );
  strcat( fullpath, path );
  strcat( fullpath, RRD_EXT );

  if ( rrd_fetch_r(fullpath, type, from, to, step, &ds_cnt, &ds_name, &data) )
  {
    FPrintF(stream, "\"%s\"", rrd_get_error());
    return 4;
  }

  l = (*to - *from) / *step;

  sep = '[';
  for (i = 0; i < ds_cnt; i++)
  {
    if (!ds || !strlen(ds) || strcmp(ds, ds_name[i]))
    {
      free(ds_name[i]);
      continue;
    }

    for (n = 0; n < l; n++)
    {
      value = data + n * ds_cnt + i;

      PutChar( sep, stream );
      sep = ',';
      collectw_output_value( stream, value );

      /* calc max and min values */
      if (!isnan(*value))
      {
	if (isnan(*min) || *min > *value) *min = *value;
	if (isnan(*max) || *max < *value) *max = *value;
      }
    }

    free(ds_name[i]);
  }

  if (sep == ',')
  {
    PutChar( ']', stream );
  }

  free(ds_name);
  free(data);

  return 0;
}

#define DATE_FMT "%Y-%m-%d"
#define TIME_FMT "%Y-%m-%d_%H:%M"

/* params: path ds type start end */

int collectw_data( Stream stream, const char **param )
{
  const char    *types[] = { "AVERAGE", "MIN", "MAX", NULL };
  const char    *return_types[] = { "avg", "min", "max", NULL };
  unsigned long stepping = 1, step;
  const char    *d;
  char          sep1, sep2;
  struct tm     t;
  time_t        start, end, from, to, now;
  rrd_value_t   min, max;

  now = time(&now);

  d = param[0];
  if (!d || !strlen(d)) ERROR("Start time is empty!");
  memset(&t, 0, sizeof(t));
  d = strptime(d, strchr(d, '_')? TIME_FMT : DATE_FMT, &t);
  if (!d) ERROR("Start time incorrect!");
  start = mktime(&t);

  d = param[1];
  if (!d || !strlen(d)) ERROR("End time is empty!");
  memset(&t, 0, sizeof(t));
  d = strptime(d, strchr(d, '_') ? TIME_FMT : DATE_FMT, &t);
  if (!d) ERROR("End time incorrect!");
  end = mktime(&t);

  d = param[2];
  if (!d || !strlen(d)) ERROR("Elements is empty!");

  sep1 = '[';
  char elements[strlen(d)], *key, *val;
  strcpy(elements, d);

  for ( key = strtok(elements, ","); key; key = strtok(NULL, ",") )
  {
      val = strrchr(key, ':');
      if (val) {
	val[0] = '\0';
	val++;
      } else {
	val = "value";
      }

      min = NAN; max = NAN;

      PutChar( sep1, stream );
      sep1 = ',';

      sep2 = '{';
      int i;
      for ( i = 0; types[i]; i++ )
      {
	FPrintF( stream, "%c%s:", sep2, return_types[i] );
        sep2 = ',';

	from = start; to = end; step = stepping;
	_collectw_data( stream, key, val, types[i], &from, &to, &step, &min, &max );
      }

      FPrintF( stream, ",lim:[");
      collectw_output_value( stream, &min );
      PutChar( ',', stream );
      collectw_output_value( stream, &max );
      FPrintF( stream, "]}" );
  }
  if (sep1 == ',' )
    { PutChar( ']', stream ); }

  return (0);
}

int collectw_time( Stream stream, const char **param )
{
  time_t now;
  struct tm t;

  memset( &t, 0, sizeof(t) );
  now = time(&now);
  if ( !localtime_r(&now, &t) ) ERROR("No local time!");

  char buf[32];
  if ( !strftime(buf, sizeof(buf), TIME_FMT, &t) ) ERROR("Error formating time!");

  FPrintF( stream, "{local:'%s'}", buf );
  return 0;
}
