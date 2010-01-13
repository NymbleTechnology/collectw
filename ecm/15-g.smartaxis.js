/*
 * CollectW - JavaScript CollectD UI
 *
 * Copyright (c) 2010 Phoenix Kayo
 * Licensed under the GNU GPL license.
 */

(function(){
  var edges=function(d, e){
    if(typeof d=='undefined'){
    }else if(typeof d=='number'){
      (typeof e=='undefined') && (e=[d, d]);
      (d<e[0]) && (e[0]=d); (d>e[1]) && (e[1]=d);
    }else{
      for(var i in d){
	e=arguments.callee(d[i], e);
      }
    }
    return e;
  };
  var short_label=$.short_number;
  var upof=function(ev, l, s){
      ev.push(ev[1]-ev[0]);
      var m=Number(ev[2]).toExponential(0).toString().split('e');
      for(var i=0;i<2;i++)m[i]=parseInt(m[i], 10);
      if(m[0]<5)m[1]--; // fix for small delta
      var r=Math.pow(10, m[1]), rv={u:[Math.ceil(ev[0]/r),Math.floor(ev[1]/r)]};
      rv.e=[rv.u[0]*r, rv.u[1]*r];
      rv.u.push(rv.u[1]-rv.u[0]);
      rv.e.push(rv.e[1]-rv.e[0]);
      // calc scale coords
      rv.p=l/ev[2];// calc num of pixels per delta value
      rv.c=(rv.e[0]-ev[0])*rv.p;// calc coord
      rv.l=(ev[1]-rv.e[1])*rv.p+rv.c;// calc length
      // calc num of steps
      for(rv.s=rv.u[2];rv.s<5;rv.s*=2){}
      for(;rv.s*s>l;rv.s=Math.round(rv.s/2));
      return rv;
  };

   var axis=function (x, y, length, from, to, orientation, label, steps, labels, type, dashsize) {
      var r=this, ev=[from, to], line=[[x,y]];

      if(typeof orientation!='number')orientation=0;

      switch(orientation){
      case 0: line.push([+length,0]); break;
      case 1: line.push([0,-length]); break;
      case 2: line.push([-length,0]); break;
      case 3: line.push([0,+length]); break;
      }
      line[1][0]+=line[0][0]; line[1][1]+=line[0][1];
      var axis='M'+line[0][0]+' '+line[0][1]+'L'+line[1][0]+' '+line[1][1];

      if(!steps){
	  var rv=upof(ev, length, (orientation%2)?40:20);
	  steps=rv.s;
	  if(!labels){
	      labels=[];
	      var p=rv.e[2]/steps;
	      for(var i=0;i<=steps;i++)labels.push(short_label(rv.e[0]+p*i));
	  }
	  switch(orientation){
	  case 0: x+=rv.c; break;
	  case 1: y-=rv.c; break;
	  case 2: x-=rv.c; break;
	  case 3: y+=rv.c; break;
	  }
	  length-=rv.l;
      }

      var res;

      if(ev[0]<ev[1]){
	  res=r.g.axis(x, y, length, ev[0], ev[1], steps, orientation, labels, type, dashsize);
	  res.attr({path:res.attr('path')+axis});

	  res.remove = function () {
	      this.text.remove();
	      this.line.remove();
	      this.constructor.prototype.remove.call(this);
	  };
      }else{
	  res=r.path(axis);
      }

      if(label){

      }

      return res;
  }

  Raphael.fn.g.axis_edges=edges;
  Raphael.fn.g.smart_axis=axis;
})();
