/** sapi_fcgx.c --- 
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

#include"collectw.h"
#ifdef __SAPI_FCGX_H__

#include<stdio.h>
#include<stdlib.h>
#include<string.h>
#include<unistd.h>
#include<getopt.h>
#include<regex.h>

#define TRY(code) if(code){fprintf(stderr,"Fatal error: " #code ".. Exiting..\n");exit(3);}

/*
const char **arguments_token(const char *query_string){
  int len=strlen(query_string), i, n, t;
  char *args_line=malloc(len+1), **args;
  strcpy(args_line, query_string);
  args_line[len]='\0';
  for(n=0,i=0;i<len;i++)if(args_line[i]=='&')n++;
  args=malloc(n);
  args[0]=args_line;
  for(t=1,i=0;i<len;i++)if(args_line[i]=='&'){
      args_line[i]='\0';
      args[t]=args_line+i+1;
      t++;
    }
  return args;
}

void arguments_free(const char **args){
  free(args[0]);
  free(args);
}
*/

help(){
  printf(COLLECTW_FCGX_HELP "\n");
}

main(int argc, char **argv){
  const char *listen=SAPI_FCGX_LISTEN, *rrddir=NULL, *config=NULL, *query, **args;
  int socket, i, c;
  FCGX_Request request;
  
  for(;c!=-1;){
    int longindex=0;
    static struct option longopts[] = {
      {"help", no_argument, 0, 'h'},
      {"fcgx-listen", required_argument, 0, 'l'},
      {"rrd-basedir", required_argument, 0, 'b'},
      {"user-config", required_argument, 0, 'c'},
      {0, 0, 0, 0}
    };
    switch(c=getopt_long(argc, argv, "+hl:b:c:", longopts, &longindex)){
    case -1: break;
    case 'h': help(); exit(0); break;
    case 'l': optarg && (listen=optarg); break;
    case 'b': optarg && (rrddir=optarg); break;
    case 'c': optarg && (config=optarg); break;
    default: fprintf(stderr, "Unknown option '%c' with code '%d'..\n", c, c); exit(1);
    }
  }
  
  /* Init collectw */
  if(collectw_init(rrddir, config)) exit(2);
  
  /* Init queries */
  struct{
    const char *re;
    unsigned char n;
    regex_t *pg;
    int(*cb)(Stream stream, const char **param);
  }reque[]={
    // url schema: collectw?info
    {"^info$", 0,
     NULL, collectw_info},
    // url schema: collectw?data:PATH(DS)[START,END]
    {"^data:([[:alnum:]\\_\\.\\-]+\\.rrd)\\(([[:alpha:]]+)\\)\\[[[:digit:]]{4}\\-[[:digit:]]{2}\\-[[:digit:]]{2}[[:space:]][[:digit:]]{2}\\:[[:digit:]]{2}\\,\\]$", 5,
     NULL, collectw_data},
    // any others
    {"^.*$", 0,
     NULL, collectw_none},
    {NULL, 0,
     NULL, NULL}
  };
  unsigned char max_n=0;
  
  {
#define ERRBUF_SIZE 256
    char errs=0;
    char errbuf[ERRBUF_SIZE];
    for(i=0;reque[i].re;i++){
      reque[i].pg=malloc(sizeof(regex_t));
      max_n=max_n<reque[i].n?reque[i].n:max_n;
      c=regcomp(reque[i].pg, reque[i].re, REG_EXTENDED);
      if(c){
	regerror(c, reque[i].pg, errbuf, ERRBUF_SIZE);
	fprintf(stderr, "ERROR: Regex compiling failed: %s..\n", errbuf);
	errs++;
      }
    }
    if(errs>0){
      exit(2);
    }
  }
  
  /* Init daemon */
  TRY( FCGX_Init() );
  
  TRY( !(socket=FCGX_OpenSocket(listen, 100)) );
  /* if listen is a unix-socket, then sets permissions */
  if(!strchr(listen, ':')) TRY( chmod(listen, 0777) );
  TRY( FCGX_InitRequest(&request, socket, 0) );
  
  /* Init main cicle */
  {
    regmatch_t match[max_n];
    unsigned char n,l;
    char *param[max_n];
    
    for (;;) {
      TRY( FCGX_Accept_r(&request) );
      query=FCGX_GetParam("QUERY_STRING", request.envp);
      //args=arguments_token(query);
      //FPrintF(request.out, "Content-Type: application/json; charset=utf-8\r\n");
      FPrintF(request.out, "Content-Type: text/plain; charset=utf-8\r\n");
      //FPrintF(request.out, "X-JSON: ['ok']\r\n");
      FPrintF(request.out, "\r\n");
      if(query){
#ifdef DEBUG
	// url schema: collectw?env
	if(strstr(query, "env")){
	  for(i=0;request.envp[i];i++){
	    FPrintF(request.out, "%s\r\n", request.envp[i]);
	  }
	}else{
#endif
	  for(i=0;reque[i].re;i++){
	    if(!reque[i].cb)continue;
	    if(REG_NOMATCH==regexec(reque[i].pg, query, max_n, match, 0))continue;
	    
	    /* Fill params */
	    for(n=0;n<reque[i].n;n++){
	      if(match[n].rm_so>0){
		l=match[n].rm_eo-match[n].rm_so;
		param[n]=malloc(l+1);
		strncpy(param[n], query+match[n].rm_so, l);
		param[n][l]='\0';
	      }else{
		param[n]=NULL;
	      }
	    }
	    
	    /* Call handler */
	    reque[i].cb(request.out, (const char **)param);
	    
	    /* Clear params */
	    for(n=0;n<reque[i].n;n++){
	      if(param[n])free(param[n]);
	      param[n]=NULL;
	    }
	    
	    break;
	  }
#ifdef DEBUG
	}
#endif
      }
    }
    
    //arguments_free(args);
    FPrintF(request.out, "\r\n");
    FCGX_Finish_r(&request);
  }

  /* Freeing regexes */
  for(i=0;reque[i].re;i++){
    regfree(reque[i].pg);
    free(reque[i].pg);
  }
  
  return 0;
}

#endif
