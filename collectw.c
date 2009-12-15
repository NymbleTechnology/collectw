

#include<string.h>
#include<stdio.h>
#include<stdlib.h>
#include<sys/types.h>
#include<dirent.h>
#include<rrd.h>

#include"collectw.h"

static const char *collectw_rrd_basedir=NULL;

int collectw_init(const char *rrd_basedir){
  rrd_basedir && strlen(rrd_basedir) && (collectw_rrd_basedir=rrd_basedir) || (collectw_rrd_basedir=COLLECTW_RRD_BASEDIR);
}

static int _collectw_info(Stream stream, const char *path){
  DIR *f;
  int i;
  struct dirent *d;
  
  if(!path || !strlen(path))return 2;
  if(!(f=opendir(path)))return 1;
  
  FPrintF(stream, "{");
  for(i=0;d=readdir(f);){
    /* ignore . and .. */
    if(!strcmp(d->d_name, ".")||!strcmp(d->d_name, ".."))continue;
    /* paste comma before non-first elements */
    i && FPrintF(stream, ","); i++;
    /* output element name */
    FPrintF(stream, "'%s':", d->d_name);
    /* make full file path */
    char file[strlen(path)+strlen(d->d_name)+2];
    strcpy(file, path);
    strcat(file, "/");
    strcat(file, d->d_name);
    /* if file is batabase, then gives info about it */
    if(strstr(d->d_name, ".rrd")){
      int k, len;
      char *beg, *end, *arg[]={0, file, 0}, fp[]="ds[", bp[]="].type";
      rrd_info_t *info, *infos=rrd_info(2, arg);
      FPrintF(stream, "[");
      for(k=0, info=infos; info; info=info->next){
	if(strstr(info->key, fp)==info->key && (end=strstr(info->key, bp))){
	  if(k)FPrintF(stream, ","); k++;
	  beg=info->key+strlen(fp);
	  len=end-beg;
	  char name[len+1];
	  strncpy(name, beg, len);
	  name[len]='\0';
	  FPrintF(stream, "'%s'", name);
	}
      }
      FPrintF(stream, "]");
      if(infos)rrd_info_free(infos);  
    }else{ /* else go into */
      _collectw_info(stream, file);
    }
  }
  closedir(f);
  FPrintF(stream, "}");
  return 0;
}

int collectw_info(Stream stream){
  return _collectw_info(stream, collectw_rrd_basedir);
}

int collectw_data(Stream stream, const char *path){
  
  //char * arg[] = { 0, c_file, 0 };
  //return rrd_info(2, arg);
}
