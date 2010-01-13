/*
 * CollectW - JavaScript CollectD UI
 *
 * Copyright (c) 2010 Phoenix Kayo
 * Licensed under the GNU GPL license.
 */

(function(){
   var number={
     table:{
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
     }
   };
   number.smart_round=function(v, r){
     //if(r===undefined)return v;
     r=Math.pow(10, r||1);
     return Math.round(v*r)/r;
   };
   number.smart_short=function(v, r){
     var T=number.table;
     var R=number.smart_round;
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
     return '';
   };

   Raphael.fn.g.short_number=number.smart_short;

   Raphael.fn.g.axis_edges=function(d, e){
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

   Raphael.fn.g.smart_axis=function (x, y, length, from, to, orientation, label, steps, labels, type, dashsize) {
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
	 for(var i=0;i<=steps;i++)labels.push(number.smart_short(rv.e[0]+p*i));
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

       res.remove=function(){
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
   };

   Raphael.fn.g.picker=function(gx, gy, gw, gh, ex, ey, opt){
     var r=this;
     ex=ex.length==2?ex:[0.0,1.0],
     ey=ey.length==2?ey:[0.0,1.0],
     opt=opt||{};
     opt.gutter=typeof opt.gutter=='number'?opt.gutter:10;
     opt.format=typeof opt.format=='function'?opt.format:function(v, e){return v.x+' '+v.y;};
     opt.holder=opt.holder||r.node;
     opt.plines=opt.plines||{x:{},y:{}};
     opt.popup=opt.popup||'none'; //blob,
     opt.popup_delay=typeof opt.popup_delay=='number'?opt.popup_delay:1000;

     var p=r.set();
     if(opt.plines.x){
       p.xline=r.path('');
       p.xline.attr(opt.plines.x);
       p.push(p.xline);
     }
     if(opt.plines.y){
       p.yline=r.path('');
       p.yline.attr(opt.plines.y);
       p.push(p.yline);
     }

     p.area=r.rect(gx, gy, gw, gh).attr({'fill':'#000','fill-opacity':0.0,'stroke':'none'});
     p.hide();

     var popup={
       show:function(x, y, t){
	 if(opt.popup=='none')return;
	 if(typeof t=='string'){
	   if(t.match(/undefined/)!='undefined'){
	     popup.hide();
	     popup.timer=setTimeout(popup.show, opt.popup_delay);
	     popup.args={x:x, y:y, t:t};
	   }
	 }else{
	   var a=popup.args;
	   popup.object=r.g[opt.popup](a.x, a.y-2, a.t);
	   p.area.toFront();
	 }
       },
       hide:function(){
	 if(opt.popup=='none')return;
	 if(popup.object){
	   popup.object.remove();
	   popup.object=undefined;
	 }
	 if(popup.timer){
	   clearTimeout(popup.timer);
	   popup.timer=undefined;
	 }
       }
     };
     /*
      var outevt=$.browser=='opera'?function(cx, cy){ // fucked opera :-[
      if(!(cx>=gx&&cx<gx+gw&&cy>=gy&&cy<gy+gh))$a.trigger('mouseleave');
      }:function(){};
      */
     var $a=$(p.area.node)
       .mouseenter(function(){
		     p.xline.show();
		     p.xline.toFront();
		     p.yline.show();
		     p.yline.toFront();

		     p.area.toFront();
		   })
       .mouseleave(function(){
		     popup.hide();
		     p.xline.hide();
		     p.yline.hide();
		   })
       .mousemove(function(e){
		    var d=opt.holder.offset();
		    var c={x:e.pageX-d.left, y:e.pageY-d.top};
		    if(p.xline)p.xline.attr({path:'M'+gx+' '+c.y+'L'+(gx+gw)+' '+c.y});
		    if(p.yline)p.yline.attr({path:'M'+c.x+' '+gy+'L'+c.x+' '+(gy+gh)});
		    /* update popup */
		    var v={x:(c.x-gx)*(ex[1]-ex[0])/gw+ex[0], y:ey[1]-(c.y-gy)*(ey[1]-ey[0])/gh};
		    popup.show(c.x, c.y, opt.format(v, {x:ex, y:ey}));
		    //outevt(c.x, c.y);
		  });

     return p;
   };

 })();
