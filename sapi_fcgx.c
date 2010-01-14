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
#include<signal.h>
#include<setjmp.h>
#include<getopt.h>
#include<regex.h>

#include"urlcode.h"

#define TRY(code) if(code){fprintf(stderr,"Fatal error: " #code ".. Exiting..\n");exit(3);}

jmp_buf jmp_mark;

void
term(int i){
  fprintf(stderr, "Terminating..\n");
  longjmp(jmp_mark, 1);
}

help(){
  printf(COLLECTW_FCGX_HELP "\n");
}

main(int argc, char **argv){
  const char *listen=SAPI_FCGX_LISTEN, *rrddir=NULL, *config=NULL;
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
  
  fprintf(stderr, "Initializing..\n");
  fflush(stderr);
  /* Init collectw */
  if(collectw_init(rrddir, config)) exit(2);
  
  /* Init queries */
  struct{
    int(*cb)(Stream stream, const char **param);
    regex_t *pg;
    const char *re;
    const char *rs;
  }reque[]={
    /*
      Format of arguments line:
      
      [char1][char2][char3]...[charN]
      
      Where [charX]:
      
      ~           - no return as argument
      /           - end of argument list
      \NUMBER     - return as argument NUMBER
      
     */
    // url schema: collectw?info
    {collectw_info, NULL, "^info$", "/"},
    // url schema: collectw?data:[DATE_FROM,DATE_TO]{PATH1:DS1,PATH2:DS2,...}
    {collectw_data, NULL, "^data:\\[([-:_0-9]*),([-:_0-9]*)\\]\\{([-_,:/a-z0-9]*)\\}$", "~\0\1\2/"},
    // [0-9]{4}-[0-9]{2}-[0-1][0-9] [0-1][0-9]:[0-5][0-9]:[0-5][0-9]
    {collectw_load, NULL, "^load$", "/"},
    {collectw_save, NULL, "^save:(.*$)", "~\0/"},
    {collectw_time, NULL, "^time$", "/"},
    // default
    {collectw_none, NULL, "^.*$", "/"},
    {NULL, NULL, NULL, NULL}
  };
  unsigned char max_n=0;
  
  {
#define ERRBUF_SIZE 256
    const char *rp;
    unsigned char n;
    char errs=0;
    char errbuf[ERRBUF_SIZE];
    for(i=0;reque[i].re;i++){
      /* calculate number of substitutions */
      for(n=0,rp=reque[i].re;rp=strchr(rp, '(');(rp==reque[i].re || *(rp-1)!='\\') && n++, rp++);
      max_n=n>max_n?n:max_n;
      /* initialize regexp */
      reque[i].pg=malloc(sizeof(regex_t));
      c=regcomp(reque[i].pg, reque[i].re, REG_EXTENDED);
      if(c){
	regerror(c, reque[i].pg, errbuf, ERRBUF_SIZE);
	fprintf(stderr, "ERROR: Regex compiling failed: %s..\n", errbuf);
	errs++;
      }
    }
    max_n++;
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
    const char *raw_query/*, **args*/;
    char *query;
    struct sigaction sa;
    sigset_t sigset;
    
    regmatch_t match[max_n];
    unsigned int n,l;
    char *param[max_n];
    
    for(n=0;n<max_n;n++)param[n]=NULL;
    
    /* Signal handling */
    sigemptyset(&sigset);
    //sigaddset(&sigset, SIGHUP);
    sigaddset(&sigset, SIGINT);
    //sigaddset(&sigset, SIGTERM);
    sigemptyset(&sa.sa_mask);
    sa.sa_handler=term;
    sigaction(SIGINT, &sa, 0);
    
    if(!setjmp(jmp_mark)){
      fprintf(stderr, "Running main cicle..\n");
      fflush(stderr);
      for(;;){
	TRY( FCGX_Accept_r(&request) );
	raw_query=FCGX_GetParam("QUERY_STRING", request.envp);
	//FPrintF(request.out, "Content-Type: application/json; charset=utf-8\r\n");
	FPrintF(request.out, "Content-Type: text/plain; charset=utf-8\r\n");
	//FPrintF(request.out, "X-JSON: ['ok']\r\n");
	FPrintF(request.out, "\r\n");
	if(raw_query){
	  query=url_decode(raw_query);
	  fprintf(stderr, "Processing query: %s ..\n", query);
	  fflush(stderr);
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
	      fprintf(stderr, "Request: %s ..\n", reque[i].re);
	      fflush(stderr);
	      /* Fill params */
	      for(n=0;reque[i].rs[n]!='/';n++){
		//fprintf(stderr, "Found subst: %d\n", n);
		if(match[n].rm_so>0 && reque[i].rs[n]!='~'){
		  //fprintf(stderr, "Fill param: %d\n", reque[i].rs[n]);
		  l=match[n].rm_eo-match[n].rm_so;
		  param[reque[i].rs[n]]=malloc(l+1);
		  strncpy(param[reque[i].rs[n]], query+match[n].rm_so, l);
		  param[reque[i].rs[n]][l]='\0';
		}
	      }
	      
	      /* Call handler */
	      reque[i].cb(request.out, (const char **)param);
	      
	      /* Clear params */
	      for(n=0;n<reque[i].rs[n];n++){
		if(param[n])free(param[n]);
		param[n]=NULL;
	      }
	      
	      break;
	    }
#ifdef DEBUG
	  }
#endif
	  url_free(query);
	}
	
	FPrintF(request.out, "\r\n");
	FCGX_Finish_r(&request);
      }
    }
    fprintf(stderr, "Exiting..\n");
  }
  
  /* Freeing regexes */
  for(i=0;reque[i].re;i++){
    regfree(reque[i].pg);
    free(reque[i].pg);
  }
  
  return 0;
}

#endif
