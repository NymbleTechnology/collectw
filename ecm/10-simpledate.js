/*
 * CollectW - JavaScript CollectD UI
 *
 * Copyright (c) 2010 Phoenix Kayo
 * Licensed under the GNU GPL license.
 */

(function($){
  var SELF={
    s2n:function(s){
      s=parseInt(s, 10);
      return s;
    },
    n2s:function(n){
      n=parseInt(n, 10);
      return (n>9?'':'0')+n;
    },
    parse:function(value){
      if(typeof value!='string')return null;
      var Q=SELF.s2n;
      var m=value.match(/^(\d{4})\-(\d{2})\-(\d{2})(\_(\d{2})\:(\d{2}))?$/);
      if(!m[0])return null;
      var d=new Date(Q(m[1]), Q(m[2])-1, Q(m[3]), m[4]?Q(m[5]):null, m[4]?Q(m[6]):null);
      return Math.round(d.getTime()/1000);
    },
    odate:function(value){
      var d=new Date(value*1000);
      return {Y:d.getFullYear(),m:d.getMonth()+1,d:d.getDate(),H:d.getHours(),M:d.getMinutes()};
    },
    tostr:function(value){
      if(typeof value!='number')return null;
      var Q=SELF.n2s, D=SELF.odate;
      var d=D(value);
      var r=Q(d.Y)+'-'+Q(d.m)+'-'+Q(d.d);
      if(d.M>0 || d.H>0) r+='_'+Q(d.H)+':'+Q(d.M);
      return r;
    },
    simple_gen_interp:function(beg, end, steps){
      var Q=SELF.parse, R=SELF.tostr;
      var r=[], b=Q(beg), e=Q(end), s=Math.round((e-b)/(steps-1))/*, o=beg.search('_')||end.search('_')*/;
      for(var i=b;i<e;i+=s) r.push(R(i)); r.push(R(e));
      return r;
    },
    smart_gen_interp:function(beg, end, steps){
      var Q=SELF.parse, R=SELF.tostr, D=SELF.odate, F=SELF.n2s;
      var r=[], f=[], b=Q(beg), e=Q(end), s=Math.round((e-b)/(steps));
      for(var i=b;i<e;i+=s) r.push(D(i)); r.push(D(e));
      f[0]=F(r[0].Y)+'-'+F(r[0].m)+'-'+F(r[0].d);
      for(var i=1;i<r.length;i++){
	if(r[i].Y!=r[i-1].Y || r[i].m!=r[i-1].m || r[i].d!=r[i-1].d)f[i]=F(r[i].Y)+'-'+F(r[i].m)+'-'+F(r[i].d);
	else f[i]=F(r[i].H)+':'+F(r[i].M);
      }
      return f;
    }
  };
  $.simple_date=SELF;
})(jQuery);
