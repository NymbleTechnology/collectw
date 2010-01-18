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
#include<math.h>

#include"collectw.h"

#define ERROR(message) {FPrintF(stream, "{status:false,message:\"%s\"}", message);return 3;}

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

int collectw_load(Stream stream, const char **param){
  if(!collectw_user_config)ERROR("Config file not defined!");
  FILE* file=fopen(collectw_user_config, "r");
  if(!file)ERROR("Config file not found or access denied!");
  char buf[1024];
  size_t cnt;
  for(; !feof(file); (cnt=fread(buf, 1, sizeof(buf)-1, file))>0 && ((buf[cnt]='\0') || 1) && FPrintF(stream, buf));
  fclose(file);
  return 0;
}

int collectw_save(Stream stream, const char **param){
  if(!param[0])ERROR("Empty config!");
  if(!collectw_user_config)ERROR("Config file not defined!");
  FILE* file=fopen(collectw_user_config, "w");
  if(!file)ERROR("Config file not found or access denied!");
  fwrite(param[0], 1, strlen(param[0]), file);
  fclose(file);
  FPrintF(stream, "{status:true,message:'Config saved..'}");
  return 0;
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

int collectw_none(Stream stream, const char **param){
  ERROR("Unsupported request!");
}

int collectw_info(Stream stream, const char **param){
  return _collectw_info(stream, collectw_rrd_basedir);
}

static int collectw_output_value(Stream stream, rrd_value_t *value){
#ifdef ZERO_INSTEAD_OF_NAN_AND_INF
  if(isnan(*value) || isinf(*value)){
    FPrintF(stream, "0");
  }else{
    FPrintF(stream, "%g", *value);
  }
#else
  if(isnan(*value)){
    FPrintF(stream, "NaN");
  }else{
    if(isinf(*value)){
      FPrintF(stream, "%sInfinity", signbit(*value)?"-":"");
    }else{
      FPrintF(stream, "%g", *value);
    }
  }
#endif
}

static int _collectw_data(Stream stream,
			  const char *path,
			  const char *ds,
			  const char *type,
			  time_t *from,
			  time_t *to,
			  unsigned long *step,
			  rrd_value_t *min,
			  rrd_value_t *max){
  char fullpath[strlen(collectw_rrd_basedir)+strlen(path)+1+strlen(RRD_EXT)+1];
  unsigned long ds_cnt=0, l, n, i;
  char **ds_name, k=0;
  rrd_value_t *data;
  rrd_value_t *value;
  
  fullpath[0]='\0';
  strcat(fullpath, collectw_rrd_basedir);
  strlen(fullpath) && strcat(fullpath, "/");
  strcat(fullpath, path);
  strcat(fullpath, RRD_EXT);
  
  if(rrd_fetch_r(fullpath, type, from, to, step, &ds_cnt, &ds_name, &data)){
    //ERROR(rrd_get_error());
    //FPrintF(stream, "[]");
    FPrintF(stream, "\"%s\"", rrd_get_error());
    return 4;
  }
  
  l = (*to-*from) / *step;
  
  for(i=0;i<ds_cnt;i++) {
    if(!ds || !strlen(ds) || strcmp(ds, ds_name[i])){
      free(ds_name[i]);
      continue;
    }
    
    FPrintF(stream, "[");
    
    for(n=0;n<l;n++){
      value=data+n*ds_cnt+i;
      n && FPrintF(stream, ",");
      collectw_output_value(stream, value);
      /* calc max and min values */
      if(!isnan(*value)){
	if(isnan(*min) || *min>*value)*min=*value;
	if(isnan(*max) || *max<*value)*max=*value;
      }
    }
    
    FPrintF(stream, "]");
    
    free(ds_name[i]);
  }
  
  free(ds_name);
  free(data);
  
  return 0;
}

#define DATE_FMT "%Y-%m-%d"
#define TIME_FMT "%Y-%m-%d_%H:%M"

/* params: path ds type start end */

int collectw_data(Stream stream, const char **param){
  const char *types[]={"AVERAGE", "MIN", "MAX", NULL};
  const char *return_types[]={"avg", "min", "max", NULL};
  unsigned long stepping=1, step;
  const char *d;
  time_t start, end, from, to, now;
  rrd_value_t min, max;
  
  now=time(&now);
  
  {
    struct tm t;
    
    d=param[0];
    if(!d || !strlen(d))ERROR("Start time is empty!");
    memset(&t, 0, sizeof(t));
    d=strptime(d, strchr(d, '_')?TIME_FMT:DATE_FMT, &t);
    if(!d)ERROR("Start time incorrect!");
    start=mktime(&t);
    
    d=param[1];
    if(!d || !strlen(d))ERROR("End time is empty!");
    memset(&t, 0, sizeof(t));
    d=strptime(d, strchr(d, '_')?TIME_FMT:DATE_FMT, &t);
    if(!d)ERROR("End time incorrect!");
    end=mktime(&t);
  }
  
  {
    d=param[2];
    if(!d || !strlen(d))ERROR("Elements is empty!");
  }
  
  FPrintF(stream, "[");
  {
    char elements[strlen(d)], *key, *val, t;
    strcpy(elements, d);
    
    for(key=strtok(elements,","); key; key=strtok((char*)0,",")) {
      val=strrchr(key, ':');
      if(val){
	val[0]='\0';
	val++;
      }else{
	val="value";
      }
      
      min=NAN; max=NAN;
      
      key==elements || FPrintF(stream, ",");
      FPrintF(stream, "{");
      
      for(t=0; types[t]; t++){
	t && FPrintF(stream, ",");
	FPrintF(stream, "%s:", return_types[t]);
	from=start; to=end; step=stepping;
	_collectw_data(stream, key, val, types[t], &from, &to, &step, &min, &max);
      }
      
      FPrintF(stream, ",lim:[");
      collectw_output_value(stream, &min);
      FPrintF(stream, ",");
      collectw_output_value(stream, &max);
      FPrintF(stream, "]");
      
      FPrintF(stream, "}");
    }
  }
  FPrintF(stream, "]");
}

int collectw_time(Stream stream, const char **param){
  time_t now;
  struct tm t;
  
  memset(&t, 0, sizeof(t));
  now=time(&now);
  if(!localtime_r(&now, &t))ERROR("No local time!");
  
  char buf[32];
  if(!strftime(buf, sizeof(buf), TIME_FMT, &t))ERROR("Error formating time!");
  
  FPrintF(stream, "{local:'%s'}", buf);
  return 0;
}
