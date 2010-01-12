/*
 * Simple Picker for Raphael Graphs
 *
 * Copyright (c) 2010 Phoenix Kayo
 * Licensed under the GNU GPL license.
 *
 */

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
	popup.hide();
	popup.timer=setTimeout(popup.show, opt.popup_delay);
	popup.args={x:x, y:y, t:t};
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
  
  var outevt=$.browser=='opera'?function(cx, cy){ /* fucked opera :-[ */
      if(!(cx>=gx&&cx<gx+gw&&cy>=gy&&cy<gy+gh))$a.trigger('mouseleave');
  }:function(){};
  
  var $a=$(p.area.node)
  .mouseenter(function(){
	  /*p.show();
	    p.toFront();*/
	  p.xline.show();
	  p.xline.toFront();
	  p.yline.show();
	  p.yline.toFront();
	  
	  p.area.toFront();
      })
  .mouseleave(function(){
	  popup.hide();
	  /*p.hide();*/
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
		 outevt(c.x, c.y);
	       });
  
  return p;
};
