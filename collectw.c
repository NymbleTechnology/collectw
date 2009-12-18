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

#include<string.h>
#include<stdio.h>
#include<stdlib.h>
#include<sys/types.h>
#include<sys/stat.h>
#include<unistd.h>
#include<dirent.h>
#define __USE_XOPEN
#include<time.h>
#include<rrd.h>

#include"collectw.h"

static const char *collectw_rrd_basedir=COLLECTW_RRD_BASEDIR;
static const char *collectw_user_config=COLLECTW_USER_CONFIG;

int collectw_init(const char *rrd_basedir, const char *user_config){
  struct stat buf;
  int ret=0;
  
  rrd_basedir && strlen(rrd_basedir) && (collectw_rrd_basedir=rrd_basedir);
  user_config && strlen(user_config) && (collectw_user_config=user_config);
  
  if(stat(collectw_rrd_basedir, &buf)){
    fprintf(stderr, "ERROR: RRD basedir set as \"%s\", but it's unavailable or not exists.\n", collectw_rrd_basedir);
    ret++;
  }else{
    if(buf.st_mode&&S_IFDIR){
      if(access(collectw_rrd_basedir, R_OK)){
	fprintf(stderr, "ERROR: RRD basedir set as \"%s\", but it has no read access.\n", collectw_rrd_basedir);
	ret++;
      }
    }else{
      fprintf(stderr, "ERROR: RRD basedir set as \"%s\", but it's not a directory.\n", collectw_rrd_basedir);
      ret++;
    }
  }
  
  if(stat(collectw_user_config, &buf)){
    fprintf(stderr, "ERROR: User config set as \"%s\", but it's unavailable or not exists.\n", collectw_user_config);
    ret++;
  }else{
    if(buf.st_mode&&S_IFREG){
      if(access(collectw_user_config, R_OK)){
	fprintf(stderr, "ERROR: User config set as \"%s\", but it has no read access.\n", collectw_user_config);
	ret++;
      }
    }else{
      fprintf(stderr, "ERROR: User config set as \"%s\", but it's not a file.\n", collectw_user_config);
      ret++;
    }
  }
  
  return ret;
}

#define RRD_EXT ".rrd"

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
    { /* output element name */
      char *p;
      p=strstr(d->d_name, RRD_EXT);
      p && (p[0]='\0');
      FPrintF(stream, "'%s':", d->d_name);
      p && (p[0]='.');
    }
    { /* make full file path */
      char file[strlen(path)+strlen(d->d_name)+2];
      strcpy(file, path);
      strcat(file, "/");
      strcat(file, d->d_name);
      /* if file is batabase, then gives info about it */
      if(strstr(d->d_name, RRD_EXT)){
	int k, len;
	char *beg, *end, *arg[]={0, file, 0}, fp[]="ds[", bp[]="].type";
	rrd_info_t *info, *infos=rrd_info(2, arg);
	FPrintF(stream, "[");
	for(k=0, info=infos; info; info=info->next){
#if 1
	  if(strstr(info->key, fp)==info->key && (end=strstr(info->key, bp))){
	    if(k)FPrintF(stream, ","); k++;
	    beg=info->key+strlen(fp);
	    len=end-beg;
	    char name[len+1];
	    strncpy(name, beg, len);
	    name[len]='\0';
	    FPrintF(stream, "'%s'", name);
	  }
#else
	  FPrintF(stream, "'%s' ", info->key);
#endif
	}
	FPrintF(stream, "]");
	if(infos)rrd_info_free(infos);  
      }else{ /* else go into */
	_collectw_info(stream, file);
      }
    }
  }
  closedir(f);
  FPrintF(stream, "}");
  return 0;
}

#define ERROR(message) {FPrintF(stream, "{status:false,message:'%s'}", message);return 3;}

int collectw_none(Stream stream, const char **param){
  ERROR("Unsupported request!");
}

int collectw_info(Stream stream, const char **param){
  return _collectw_info(stream, collectw_rrd_basedir);
}

#define ALL_TYPES "MIN,AVERAGE,MAX"

static int _collectw_data(Stream stream,
			  const char *path,
			  const char *ds,
			  const char *type,
			  time_t *start,
			  time_t *end,
			  unsigned long *step){
  char fullpath[strlen(collectw_rrd_basedir)+strlen(path)+1+strlen(RRD_EXT)+1];
  unsigned long ds_cnt=0, l, n, i;
  char **ds_name, k=0;
  rrd_value_t *data;
  
  fullpath[0]='\0';
  strcat(fullpath, collectw_rrd_basedir);
  strlen(fullpath) && strcat(fullpath, "/");
  strcat(fullpath, path);
  strcat(fullpath, RRD_EXT);
  
  if(rrd_fetch_r(fullpath, type, start, end, step, &ds_cnt, &ds_name, &data))ERROR(rrd_get_error());
  
  l=(*end-*start) / *step;
  
  FPrintF(stream, "{");
  for(i=0;i<ds_cnt;i++) {
    if(ds && strlen(ds) && !strstr(ds, ds_name[i])){
      free(ds_name[i]);
      continue;
    }
    
    k && FPrintF(stream, ","); k=1;
    FPrintF(stream, "%s:[", ds_name[i]);
    
    for(n=0;n<l;n++){
      n && FPrintF(stream, ",");
      FPrintF(stream, "%f", data[n*ds_cnt+i]);
    }
    
    FPrintF(stream, "]");
    
    free(ds_name[i]);
  }
  FPrintF(stream, "}");
  
  free(ds_name);
  free(data);
  
  return 0;
}

#define DATE_FMT "%Y-%m-%d"
#define TIME_FMT "%Y-%m-%d_%H:%M"

/* params: path ds type start end */

int collectw_data(Stream stream, const char **param){
  unsigned long step=1;
  const char *prs;
  struct tm t;
  time_t start, end;
  
  if(!param[0] || !strlen(param[0]))ERROR("Path is empty!");
  //if(!param[2] || !strlen(param[2]))ERROR("Type is empty!");
  param[2] || (param[2]=ALL_TYPES);
  
  if(!param[3] || !strlen(param[3]))ERROR("Start time is empty!");
  memset(&t, 0, sizeof(t));
  prs=strptime(param[3], strchr(param[3], '_')?TIME_FMT:DATE_FMT, &t);
  if(!prs)ERROR("Start time incorrect!");
  start=mktime(&t);
  
  if(!param[4] || !strlen(param[4]))ERROR("End time is empty!");
  memset(&t, 0, sizeof(t));
  prs=strptime(param[4], strchr(param[4], '_')?TIME_FMT:DATE_FMT, &t);
  if(!prs)ERROR("End time incorrect!");
  end=mktime(&t);
  
  return _collectw_data(stream, param[0], param[1], param[2], &start, &end, &step);
}
