/** collectw.c ---

    Copyright (C) 2009 Kayo Phoenix

    Author: Kayo Phoenix <kayo.k11.4@gmail.com>

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

#include <string.h>
#include <stdio.h>
#include <stdlib.h>
#include <sys/types.h>
#include <sys/stat.h>
#include <unistd.h>
#include <errno.h>
#include <syslog.h>
#include <signal.h>
#include <dirent.h>
#define  __USE_XOPEN
#include <time.h>
#include <getopt.h>
#include <rrd.h>
#include <setjmp.h>
#include <regex.h>
#include <sys/stat.h>
#include <math.h>


#ifndef NAN
#ifdef FP_NAN
#define NAN FP_NAN
#else
#define NAN (nanf(""))
#endif
#endif

#include "collectw.h"
#include "urlcode.h"

#define ERROR(message)                                             \
    {                                                              \
        FPrintF(stream, "{status:false,message:\"%s\"}", message); \
        return 3;                                                  \
    }
#define TRY(code) if (code) { syslog( LOG_ERR, "Fatal error: " #code ". Terminated." ); exit(3); }

#if defined(__GNUC__)
# define UNUSED(x) UNUSED_ ## x __attribute__((unused))
#elif defined(__LCLINT__)
# define UNUSED(x) /*@unused@*/ x
#else
# define UNUSED(x) x
#endif

static const char *rrd_basedir = COLLECTW_RRD_BASEDIR;
static const char *user_config = COLLECTW_USER_CONFIG;
static const char *rrd_ext = ".rrd";




static char *make_abspath( const char *key, const char *ext )
{
    char    *abspath;
    int     len, has_key, has_ext;

    has_key = (key != NULL && strlen(key) > 0);
    has_ext = (ext != NULL && strlen(ext) > 0);

    len = strlen(rrd_basedir) + 1;
    if ( has_key )
        len += strlen(key);
    if ( has_ext )
        len += strlen(ext);

    abspath = malloc( len );
    if (abspath != NULL)
    {
        strcpy( abspath, rrd_basedir ); /* guaranteed to have a trailing slash */
        if ( has_key )
            strcat( abspath, key );
        if (has_ext)
            strcat( abspath, ext );
    }
    return abspath;
}

static void emit_rrd_info( Stream stream, const char *key )
{
    char  *p, *m;
    char  *abspath;
    int   len;
    /* emit info about the RRD file */
    char sep, *name;
    rrd_info_t *info, *infoList;

    /* output key as element */
    FPrintF( stream, "\'%s\':", key );

    abspath = make_abspath( key, ".rrd" );
    if (abspath != NULL)
    {
        infoList = rrd_info_r( abspath );
        free( abspath );

        if (infoList != NULL)
        {
            sep = '[';
            for ( info = infoList; info != NULL; info = info->next )
            {
                p = info->key;
                m = "ds[";
                while ( *p == *m && *p != '\0' )
                { ++p; ++m; }

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
                            PutChar( sep, stream );
                            sep = ',';
                            PutStr( name, len, stream );
                        }
                    }
                }
            } /* for */
            /* if we emitted the opening bracket, also emit the closing one */
            if ( sep == ',' )
            {
                PutChar( ']', stream );
            }
            rrd_info_free( infoList );
        }
    }
}

/*
    note: this routine recurses, hence passing the separator back and forth
*/
static int emit_info_tree( Stream stream, const char *key, int sep )
{
    struct dirent *d;
    DIR     *f;
    char    *abspath, *newkey, *p;
    int     len;

    abspath = make_abspath( key, NULL );
    if ( abspath != NULL )
    {
        if ( ( f = opendir( abspath ) ) )
        {
            while ( ( d = readdir( f ) ) )
            {
                len = strlen(d->d_name) + 1;
                if (key != NULL)
                    len += strlen(key) + sizeof('/');

                newkey = malloc( len );
                if (newkey != NULL)
                {
                    *newkey = '\0'; // make into valid empty string
                    if ( key != NULL)
                    {
                        strcat( newkey, key );
                        strcat( newkey, "/" );
                    }
                    strcat( newkey, d->d_name );

                    switch (d->d_type)
                    {
                    case DT_DIR:
                        /* ignore . and .. */
                        if ( (strcmp( d->d_name, "." ) != 0) && (strcmp( d->d_name, ".." ) != 0) )
                        {
                            // recurse downwards
                            sep = emit_info_tree( stream, newkey, sep );
                        }
                        break;

                    case DT_REG:
                        p = strrchr( d->d_name, '.' );
                        if ( p != NULL && strcmp( p, ".rrd" ) == 0 )
                        {
                            p = strrchr( newkey, '.' );
                            if ( p != NULL )
                            {
                                *p = '\0'; // lop off the .rrd extension
                            }

                            /* emit separator, initially a left brace */
                            PutChar( sep, stream );
                            sep = ','; // after initial left brace, use a comma separator */

                            emit_rrd_info( stream, newkey );
                        }
                        break;

                    default:
                        // ignore everything else
                        break;
                    } /* switch */
                    free(newkey);
                }
            }
        } /* while */
        closedir( f );
        free( abspath );
    }
    return sep;
}

int collectw_info( Stream stream, const char ** UNUSED(param) )
{
    emit_info_tree( stream, NULL, '{' );
    PutChar( '}', stream );
    return 0;
}

static void emit_value( Stream stream, rrd_value_t *value )
{
#ifdef ZERO_INSTEAD_OF_NAN_AND_INF
    if ( isnan( *value ) || isinf( *value ) )
    {
        FPrintF( stream, "0" );
    }
#else
    if ( isnan( *value ) )
    {
        FPrintF( stream, "NaN" );
    }
    else if ( isinf( *value ) )
    {
        if ( signbit( *value ) )
        { PutChar( '-', stream ); }
        FPrintF( stream, "Infinity" );
    }
#endif
    else
    {
        FPrintF( stream, "%g", *value );
    }
}

static int emit_data_series( Stream stream,
                             const char *key, const char *val, const char *type,
                             time_t *from, time_t *to, unsigned long *step )
{
    unsigned long val_cnt, stride, n, i;
    char        **val_name;
    char        *abspath;
    char        sep;
    rrd_value_t *data, *value;
    rrd_value_t min, max;

    // convert the key into an absolute path for rrd_fetch_r
    abspath = make_abspath( key, ".rrd" );
    if (abspath != NULL)
    {
        val_cnt = 0;
        if ( rrd_fetch_r( abspath, type, from, to, step, &val_cnt, &val_name, &data ) )
        {
            FPrintF( stream, "\"%s\"", rrd_get_error() );
            return 4;
        }
        free( abspath );

        stride = ( *to - *from ) / *step;

        sep = '[';
        for ( i = 0; i < val_cnt; i++ )
        {
            if ( val && strlen( val ) > 0 && !strcmp( val, val_name[i] ) )
            {
                min  = NAN;
                max  = NAN;

                for ( n = 0; n < stride; n++ )
                {
                    PutChar( sep, stream );
                    sep = ',';

                    value = data + ( n * val_cnt ) + i;
                    emit_value( stream, value );

                    /* keep track of max and min values */
                    if ( !isnan( *value ) )
                    {
                        if ( isnan( min ) || min > *value )
                        { min = *value; }
                        if ( isnan( max ) || max < *value )
                        { max = *value; }
                    }
                }

                free( val_name[i] );
            }
        }

        if ( sep == ',' )
        {
            FPrintF( stream, "]," );
        }

        FPrintF( stream, "lim:[" );
        emit_value( stream, &min );
        PutChar( ',', stream );
        emit_value( stream, &max );
        FPrintF( stream, "]" );

        free( val_name );
        free( data );
    }

    return 0;
}

static int emit_data_sets( Stream stream, time_t start, time_t end, const char *elements )
{
    unsigned long  stepping = 1, step;
    char           sep, sep2;
    time_t         from, to;

    const char *types[][2] = { { "AVERAGE", "avg" }, { "MIN", "min" }, { "MAX", "max" }, { NULL, NULL } };
    int i;
    char *key, *val, *elem;
    elem = strdup( elements );

    sep = '[';
    for ( key = strtok( elem, "," ); key != NULL; key = strtok( NULL, "," ) )
    {
        val = strrchr( key, ':' );
        if ( val ) { *val++ = '\0'; }
        else { val = "value"; }

        PutChar( sep, stream );
        //FPrintF( stream, "%c\'%s\':", sep, key );
        sep = ',';

        sep2 = '{';
        for ( i = 0; types[i][0] != NULL; i++ )
        {
            FPrintF( stream, "%c%s:", sep2, types[i][1] );
            sep2 = ',';

            from = start;
            to   = end;
            step = stepping;
            emit_data_series( stream, key, val, types[i][0], &from, &to, &step );
        }
        if ( sep2 == ',' )
        { PutChar( '}', stream ); }
    }
    if ( sep == ',' )
    { PutChar( ']', stream ); }

    free( elem );
    return ( 0 );
}

time_t parse_time( Stream stream, const char *msg, const char *str )
{
    struct tm   t;

    if ( !str || !strlen( str ) )
    { FPrintF(stream, "{status:false,message:\"Error: %s time is empty\"", msg ); return 3; }

    memset( &t, 0, sizeof( t ) );

    str = strptime( str, strchr( str, '_' ) ? "%Y-%m-%d_%H:%M" : "%Y-%m-%d", &t );
    if ( !str )
    { FPrintF(stream, "{status:false,message:\"Error: %s time is invalid\"", msg ); return 3; }

    return mktime( &t );
}

/*
    params: start end path ds type
*/
int collectw_data( Stream stream, const char **param )
{
    time_t      start, stop;
    const char  *str;

    start = parse_time( stream, "start", param[0] );

    stop  = parse_time( stream, "end",   param[1] );

    str = param[2];
    if ( !str || !strlen( str ) )
    { ERROR( "Elements is empty!" ); }

    return emit_data_sets( stream, start, stop, str );
}

int collectw_load( Stream stream, const char ** UNUSED(param) )
{
    if ( !user_config )
    { ERROR( "Config file not defined!" ); }

    FILE *file = fopen( user_config, "r" );
    if ( !file )
    { ERROR( "Unable to open config file" ); }

    char buf[1024];
    size_t cnt;

    while ( !feof( file ) )
    {
        if ( ( cnt = fread( buf, 1, sizeof( buf ) - 1, file ) ) > 0 )
        {
            PutStr( buf, cnt, stream );
        }
    }
    fclose( file );
    return 0;
}

/*
int collectw_save( Stream stream, const char **param )
{
    if ( !param[0] )
    { ERROR( "Empty config!" ); }
    if ( !user_config )
    { ERROR( "Config file not defined!" ); }

    FILE *file = fopen( user_config, "w" );
    if ( !file )
    { ERROR( "Config file not found or access denied!" ); }

    fwrite( param[0], 1, strlen( param[0] ), file );
    fclose( file );
    FPrintF( stream, "{status:true,message:'Config saved..'}" );
    return 0;
}
*/

int collectw_time( Stream stream, const char ** UNUSED(param) )
{
    time_t now;
    struct tm t;

    memset( &t, 0, sizeof( t ) );
    now = time( &now );
    if ( !localtime_r( &now, &t ) )
    { ERROR( "No local time!" ); }

    char buf[32];
    if ( !strftime( buf, sizeof( buf ), "%Y-%m-%d_%H:%M", &t ) )
    { ERROR( "Error formating time!" ); }

    FPrintF( stream, "{local:'%s'}", buf );
    return 0;
}

static jmp_buf jmp_mark;

void term( int i )
{
    syslog( LOG_NOTICE, "Terminating (%d)", i );
    longjmp( jmp_mark, 1 );
}

static struct
{
    int ( *handler )( Stream stream, const char **param );
    const char *regex;
    regex_t    regex_c;

} reque[] =
{
    // url schema: collectw?data:[DATE_FROM,DATE_TO]{PATH1:DS1,PATH2:DS2,...}
    { collectw_data, "^data:\\[([-:_0-9]*),([-:_0-9]*)\\]\\{([-:_A-Za-z0-9/.,]*)\\}$", {0} },
    // url schema: collectw?info
    { collectw_info, "^info$", {0} },
    { collectw_load, "^load$", {0} },
    { collectw_time, "^time$", {0} },
/*  // url schema: collectw?save:FILENAME
    disabled - security hole
    { collectw_save, "^save:(.*$)", {0} }, */
    { NULL, NULL, {0} }     // end of list
};
const int max_num_sub = 5+1;

int compile_regex( void )
{
#define ERRBUF_SIZE 256
    char errbuf[ERRBUF_SIZE];
    char err, err_cnt = 0;
    int  i;

    for ( i = 0; reque[i].regex != NULL; i++ )
    {
        /* compile regex */
        err = regcomp( &reque[i].regex_c, reque[i].regex, REG_EXTENDED );
        if ( err )
        {
            regerror( err, &reque[i].regex_c, errbuf, ERRBUF_SIZE );
            syslog( LOG_ERR, "Failed to compile regex: %s", errbuf );
            ++err_cnt;
        }
    }
    return ( err_cnt );
}

void free_regex( void )
{
    int i;
    /* Freeing compiled regex */
    for ( i = 0; reque[i].regex; i++ )
    {
        regfree( &reque[i].regex_c );
    }
}

int main_loop( const char *listen )
{
#define ERRBUF_SIZE 256
    char          errbuf[ERRBUF_SIZE];
    regmatch_t    match[max_num_sub];
    char          *param[max_num_sub];
    int           i, n, len, err, socket, num_sub;
    const char    *raw_query;
    char          *query, *p;
    FCGX_Request  request;

    /* handle signals */
    struct sigaction sa;
    sigset_t sigset;

    /* Signal handling */
    sigemptyset( &sigset );
    // sigaddset( &sigset, SIGHUP );
    sigaddset( &sigset, SIGINT );
    // sigaddset( &sigset, SIGTERM );
    sigemptyset( &sa.sa_mask );
    sa.sa_handler = term;
    sigaction( SIGINT, &sa, 0 );

    /* Init daemon */
    err = FCGX_Init();
    if ( err != 0 )
    {
        fprintf( stderr, "FCGX_Init failed (%d)\n", err );
        exit( __LINE__ );
    }

    socket = FCGX_OpenSocket( listen, 100 );
    if ( socket == -1 )
    {
        fprintf( stderr, "FCGX_OpenSocket failed on %s\n", listen );
        exit( __LINE__ );
    }

    err = FCGX_InitRequest( &request, socket, 0 );
    if ( err != 0 )
    {
        fprintf( stderr, "FCGX_InitRequest failed (%d)\n", err );
        exit( __LINE__ );
    }

    err = compile_regex();
    if ( err != 0 )
    {
        exit( __LINE__ );
    }

    memset( param, 0, sizeof( param ) );

    if ( !setjmp( jmp_mark ) )
    {
        while ( ( err = FCGX_Accept_r( &request ) ) == 0 )
        {
            raw_query = FCGX_GetParam( "QUERY_STRING", request.envp );
            if ( raw_query )
            {
                query = url_decode( raw_query );

                syslog( LOG_INFO, "Query: %s", query );

                FPrintF( request.out, "Content-Type: text/plain; charset=utf-8\r\n\r\n" );
#ifdef DEBUG
                // url schema: collectw?env
                if ( strstr( query, "env" ) )
                {
                    for ( i = 0; request.envp[i]; i++ )
                    {
                        FPrintF( request.out, "%s\r\n", request.envp[i] );
                    }
                }
                else
#endif
                {
                    for ( i = 0; i >= 0 && reque[i].regex; i++ )
                    {
                        num_sub = reque[i].regex_c.re_nsub;
                        switch ( (err = regexec( &reque[i].regex_c, query, max_num_sub, match, 0 )) )
                        {
                        case 0: // we found a match
                            /* for regex, \0 is the whole string, \1..\9 are backreferences */
                            for ( n = 1; n < (num_sub + 1); ++n )
                            {
                                p = NULL;
                                // syslog( LOG_INFO, "n:%d,so:%d,eo:%d", n, match[n].rm_so, match[n].rm_eo);
                                len = match[n].rm_eo - match[n].rm_so;
                                if ( len > 0 )
                                {
                                    p = malloc( len + 1 );
                                    memcpy( p, query + match[n].rm_so, len );
                                    p[len] = '\0';
                                }
                                param[ n - 1 ] = p;
                                // syslog( LOG_INFO, "param[%d] = \'%s\'", n, param[n - 1] ? param[n - 1] : "<null>" );
                            }

                            /* Call the handler */
                            if ( reque[i].handler != NULL )
                            {
                                reque[i].handler( request.out, ( const char ** )param );
                            }

                            /* release & clear params */
                            for ( n = 0; n < num_sub; n++ )
                            {
                                if ( param[n] ) { free( param[n] ); }
                                param[n] = NULL;
                            }

                            i = -99; // short-circuit the for loop
                            break;

                        case REG_NOMATCH: // nothing bad happened, but no match found
                            break;

                        default: // something bad happened
                            regerror( err, &reque[i].regex_c, errbuf, ERRBUF_SIZE );
                            syslog( LOG_ERR, "regexec failed: %s", errbuf );
                            break;
                        }
                    }
                    if ( i >= 0 ) /* if i is still +ve, we didn't find a match */
                    { FPrintF( request.out, "{status:false,message:\"Unsupported request!\"}"); }
                }
                url_free( query );
            }

            FPrintF( request.out, "\r\n" );

            FCGX_Finish_r( &request );
        } /* end while */
    }
    if ( err != 0 )
    {
        syslog( LOG_CRIT, "FCGX_Accept_r failed (%d)", err );
    }
    return ( err );
}

void help( void )
{
    printf( COLLECTW_FCGX_HELP "\n" );
}

/*
    main entry point
*/
int main( int argc, char *argv[] )
{
    const char  *listen = SAPI_FCGX_LISTEN;
    struct stat  buf;
    int          i, len, ret = 0;

    int longindex = 0;
    static struct option longopts[] =
    {
        { "help",        no_argument,       0, 'h' },
        { "fcgx-listen", required_argument, 0, 'l' },
        { "rrd-basedir", required_argument, 0, 'b' },
        { "user-config", required_argument, 0, 'c' },
        {  NULL, 0, 0, '\0' }
    };

    openlog( "collectw", LOG_PID, LOG_DAEMON );

    while ( (i = getopt_long( argc, argv, "+hl:b:c:", longopts, &longindex )) != -1)
    {
        switch ( i )
        {
        case 'h':
            help();
            exit( 0 );
            break;

        case 'l':
            if ( optarg ) { listen = optarg; }
            break;

        case 'b':
            if ( optarg && strlen(optarg) > 0 )
            {
                rrd_basedir = optarg;
                if ( stat( rrd_basedir, &buf ) )
                { syslog( LOG_ERR, "Error on RRD basedir \"%s\": %s (%d)", rrd_basedir, strerror(errno), errno ); }
                else if ( S_ISDIR( buf.st_mode ) )
                {
                    if ( access( rrd_basedir, R_OK ) )
                    { syslog( LOG_ERR, "Error accessing RRD basedir \"%s\": %s (%d)", rrd_basedir, strerror(errno), errno ); }
                }
                else { syslog( LOG_ERR, "RRD basedir \"%s\" is not a directory", rrd_basedir ); }
            }
            break;

        case 'c':
            if ( optarg && strlen( optarg ) )
            {
                user_config = optarg;
                if ( stat( user_config, &buf ) )
                { syslog( LOG_ERR, "Error locating User config \"%s\": %s (%d)", rrd_basedir, strerror(errno), errno ); }
                else if ( S_ISREG( buf.st_mode ) )
                {
                    if ( access( user_config, R_OK ) )
                    { syslog( LOG_ERR, "Error accessing User config \"%s\": %s (%d)", rrd_basedir, strerror(errno), errno ); }
                }
                else
                { syslog( LOG_ERR, "User config \"%s\" is not a file", user_config ); }
            }
            break;

        default:
            fprintf( stderr, "Unknown option '%c' with code '%d'\n", i, i );
            exit( 1 );
        }
    }

    /* make sure rrd_basedir always has a trailing slash */
    len = strlen( rrd_basedir );
    if ( rrd_basedir[ len - 1 ] != '/' )
    {
        optarg = malloc(len + 2);
        if (optarg != NULL)
        {
            strcpy( optarg, rrd_basedir );
            optarg[len++] = '/';
            optarg[len] = '\0';
            rrd_basedir = optarg;
        }
    }

    syslog( LOG_NOTICE, "Entering main loop" );

    ret = main_loop( listen );

    syslog( LOG_NOTICE, "Exiting" );

    closelog();

    return (ret);
}
