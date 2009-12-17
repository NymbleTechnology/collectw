/** collectw.h --- 
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

#ifndef __COLLECTW_H__
#define __COLLECTW_H__

#ifndef COLLECTW_INTERFACE
#error You must use one of interfaces.
#else
#include COLLECTW_INTERFACE

int collectw_init(const char *rrd_basedir,
		  const char *user_config);

int collectw_none(Stream stream, const char **param);
int collectw_info(Stream stream, const char **param);
int collectw_data(Stream stream, const char **param);

#endif

#endif//__COLLECTW_H__
