/*
 * CollectW - JavaScript CollectD UI
 *
 * Copyright (c) 2010 Phoenix Kayo
 * Licensed under the GNU GPL license.
 */

(function($){
  var T={
    1e-24: 'y',
    1e-21: 'z',
    1e-18: 'a',
    1e-15: 'f',
    1e-12: 'p',
    1e-9:  'n',
    1e-6:  'µ',
    1e-3:  'm',
    1:     '',
    1e3:   'k',
    1e6:   'M',
    1e9:   'G',
    1e12:  'T',
    1e15:  'P',
    1e18:  'E',
    1e21:  'Z',
    1e24:  'Y'
  };
  var R=function(v, r){
    //if(r===undefined)return v;
    r=Math.pow(10, r||1);
    return Math.round(v*r)/r;
  };
  $.short_number=function(v, r){
    if(v>=0&&v<1e-24)return '0';
    if(v>=1e24)return '∞';
    var j,c;
    for(var i in T){
      if(undefined===j){j=i;continue;}
      c=j*1e3;
      if(v>=j&&v<c)return''+R(v/j, r)+T[j];
      if(v>=c&&v<i)return''+R(v/i, r)+T[i];
      //if(v>=j&&v<i)return''+Math.round(v/j*r)/r+T[j];
      j=i;
    }
  };
})(jQuery);
