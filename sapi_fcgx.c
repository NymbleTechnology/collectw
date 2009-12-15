#include"collectw.h"
#ifdef __SAPI_FCGX_H__

#include<stdio.h>
#include<stdlib.h>
#include<string.h>
#include<unistd.h>

#define TRY(code) if(code){fprintf(stderr,"Fatal error: " #code ".. Exiting..\n");exit(-1);}

char **arguments_token(const char *query_string){
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

void arguments_free(char **args){
  free(args[0]);
  free(args);
}

main(){
  char *listen=SAPI_FCGX_LISTEN;
  int socket, i;
  FCGX_Request request;
  char *query, **args;
  
  TRY( FCGX_Init() );
  
  TRY( !(socket=FCGX_OpenSocket(listen, 100)) );
  /* if listen is a unix-socket, then sets permissions */
  if(!strchr(listen, ':')) TRY( chmod(listen, 0777) );
  TRY( FCGX_InitRequest(&request, socket, 0) );
  
  for (;;) {
    TRY( FCGX_Accept_r(&request) );
    query=FCGX_GetParam("QUERY_STRING", request.envp);
    args=arguments_token(query);
    //FPrintF(request.out, "Content-Type: application/json; charset=utf-8\r\n");
    FPrintF(request.out, "Content-Type: text/plain; charset=utf-8\r\n");
    //FPrintF(request.out, "X-JSON: ['ok']\r\n");
    FPrintF(request.out, "\r\n");
    if(strlen(query)==0)collectw_info(request.out);
    else if(strstr(query, "env")){
      for(i=0;request.envp[i];i++){
	FPrintF(request.out, "%s\r\n", request.envp[i]);
      }
    }else if(args[0]){
      
    }
    arguments_free(args);
    FPrintF(request.out, "\r\n");
    FCGX_Finish_r(&request);
  }
  
  return 0;
}

#endif
