#include<fcgi_config.h>
#include<stdlib.h>
#include<unistd.h>
#include<fcgiapp.h>

main(){
  FCGX_Request request;
  int socket;
  
  FCGX_Init();
  
  socket=FCGX_OpenSocket("main.sock", 0);
  FCGX_InitRequest(&request, socket, 0);
  
  while (FCGX_Accept_r(&request) == 0) {
    FCGX_FPrintF(request.out, "Okay!");
    FCGX_Finish_r(&request);
  }
  
  return 0;
}
