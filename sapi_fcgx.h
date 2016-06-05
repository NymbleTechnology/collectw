/** sapi_fcgx.h ---
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

#ifndef __SAPI_FCGX_H__
#define __SAPI_FCGX_H__

#include <fcgiapp.h>

#define Stream FCGX_Stream*
#define FPrintF FCGX_FPrintF
#define PutStr FCGX_PutStr
#define PutChar FCGX_PutChar

#endif//__SAPI_FCGX_H__
