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
  opt.plines=opt.plines||{x:1,y:1};
  opt.popup=opt.popup||'none'; //blob,
  opt.popup_delay=typeof opt.popup_delay=='number'?opt.popup_delay:1000;
  
  var p=r.set();
  if(opt.plines.x){
    p.xline=r.path('');
    p.push(p.xline);
  }
  if(opt.plines.y){
    p.yline=r.path('');
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
  
  $(p.area.node)
    .hover(function(){p.show();p.area.toFront();},function(){popup.hide();p.hide();})
    .mousemove(function(e){
		 var d=opt.holder.offset();
		 var c={x:e.pageX-d.left, y:e.pageY-d.top};
		 if(p.xline)p.xline.attr({path:'M'+gx+' '+c.y+'L'+(gx+gw)+' '+c.y});
		 if(p.yline)p.yline.attr({path:'M'+c.x+' '+gy+'L'+c.x+' '+(gy+gh)});
		 /* update popup */
		 var v={x:(c.x-gx)*(ex[1]-ex[0])/gw+ex[0], y:ey[1]-(c.y-gy)*(ey[1]-ey[0])/gh};
		 popup.show(c.x, c.y, opt.format(v, {x:ex, y:ey}));
	       });
  return p;
};
