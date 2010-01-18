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

  var Profile=function(){
    var now=function(){
      return (new Date()).getTime();
    };
    return {
      episode:[/*[title,start,length]*/],
      clear:function(){
        this.episode=[];
      },
      close:function(){
        if(this.episode.length>0){
          var last=this.episode.pop();
          if(last.length<3)last.push(now()-last[1]);
          this.episode.push(last);
        }
      },
      profile:function(title){
        this.close();
        if(title){
          this.episode.push([title,now()]);
        }
      },
      result:function(){
        this.close();
        var t='';
        for(var i=0;i<this.episode.length;i++){
          t+=this.episode[i][0]+': '+this.episode[i][2]+' ms\n';
        }
        alert(t);
      }
    };
  };

  Raphael.fn.g.smart_edges=function(d, e){
    if(typeof d=='undefined'){
    }else if(typeof d=='number'){
      if(!isNaN(d)){
	(typeof e=='undefined') && (e=[d, d]);
	(d<e[0]) && (e[0]=d); (d>e[1]) && (e[1]=d);
      }
    }else{
      for(var i in d){
	e=arguments.callee(d[i], e);
      }
    }
    return e;
  };

  var upof=function(ev, l, s){
    ev.push(ev[1]-ev[0]);
    var m=Number(ev[2]).toExponential(0).toString().split('e'), i;
    for(i=0;i<2;i++)m[i]=parseInt(m[i], 10);
    if(m[0]<5)m[1]--; // fix for small delta
    var r=Math.pow(10, m[1]), rv={u:[Math.ceil(ev[0]/r),Math.floor(ev[1]/r)]};
    // calc step size and num of steps; recalc initial value
    var max_steps=Math.floor(l/s);
    for(i in {1:0, 2:0, 3:0, 4:0, 5:0, 6:0, 8:0, 10:0}){
      var steps=Math.floor((rv.u[1]-rv.u[0])/i);
      if(steps<=max_steps){
        rv.u[0]=rv.u[1]-i*steps;
        rv.s=steps;
        break;
      }
    }
    // post calc
    rv.e=[rv.u[0]*r, rv.u[1]*r];
    rv.u.push(rv.u[1]-rv.u[0]);
    rv.e.push(rv.e[1]-rv.e[0]);
    // calc scale coords
    rv.p=l/ev[2];// calc num of pixels per delta value
    rv.c=(rv.e[0]-ev[0])*rv.p;// calc coord
    rv.l=(ev[1]-rv.e[1])*rv.p+rv.c;// calc length
    
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

  Raphael.fn.g.smart_line=function(gx, gy, gw, gh, vx, vy, ex, ey, opt){
    var r=this, dx=ex[1]-ex[0], dy=ey[1]-ey[0], sx=gw/dx, sy=gh/dy, px=ex[0], py=ey[0];
    var opt=opt||{};
        opt.colors=opt.colors||Raphael.fn.g.colors;
    opt.width=opt.width||1;
    opt.fillopacity=typeof opt.fillopacity=='number'?opt.fillopacity:0.5;

    var p=new Profile();

    if(!vx && vy && vy.length){
      vx=[];
      for(var g=0;g<vy.length;g++){
	var y=vy[g], x=[], l;
	if(y.avg)y=y.avg;
	l=y.length;
	for(var i=0;i<l;i++){
	  x.push(px+i*dx/l);
	}
	vx.push(x);
      }
    }

    if(typeof vx[0]=='number'){
      var ox=x; vx=[];
      for(var g=0;g<vy.length;g++)vx.push(ox);
    }

    var res=r.set(), lines=r.set(), areas=r.set();
    res.push(lines, areas); res.lines=lines; res.areas=areas;

    res.add_line=function(x, y){
      var i, c=false, line='';
      if(y.avg)y=y.avg;
      //p.profile('Draw Line '+g);
      for(i=0;i<y.length;i++){
	if(isNaN(y[i])){
	  c=false;
	  continue;
	}
	line+=(c?'L':'M')+(gx+(x[i]-px)*sx)+' '+(gy+(py-y[i])*sy+gh)+' ';
	c=true;
      }

      lines.push(r.path(line).attr({'stroke-width':opt.width, 'stroke':opt.colors[g]}));
    };
    res.add_area=function(x, y){
      var i, c=false, area='';
      //p.profile('Draw Area '+g);
      if(y.max && y.min){
	var min='', max='';
	c=false;
	for(i=0;i<y.avg.length;i++){
	  if(isNaN(y.avg[i])){
	    if(c){
	      area+=min+max+'Z ';
	      min='';
	      max='';
	    }
	    c=false;
	    continue;
	  }
	  min=min+(c?'L':'M')+(gx+(x[i]-px)*sx)+' '+(gy+(py-y.min[i])*sy+gh)+' ';
	  max='L'+(gx+(x[i]-px)*sx)+' '+(gy+(py-y.max[i])*sy+gh)+' '+max;
	  c=true;
	}
	area+=min+max+'Z ';
	areas.push(r.path(area).attr({'stroke':opt.colors[g], 'stroke-width':opt.width, 'fill':opt.colors[g], 'opacity':opt.fillopacity}));
      }
    };

    if(1){
      for(var g=0;g<vy.length;g++){
        var x=vx[g], y=vy[g];
        res.add_line(x, y);
        res.add_area(x, y);
      }
      //p.result();
    }else{
      var actions=[];
      for(var g=0;g<vy.length;g++){
        actions.push([res.add_line, vx[g], vy[g]]);
        actions.push([res.add_area, vx[g], vy[g]]);
      }

      var process=function(){
        if(actions.length>0){
          var a=actions.shift();
          var f=a.shift();
          f.apply(this, a);
          setTimeout(process, 0);
        }
      };
      process();
    }

    return res;
  };

  Raphael.fn.g.smart_pick=function(gx, gy, gw, gh, ex, ey, opt){
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
	  popup.object=r.g[opt.popup](a.x, a.y-4, a.t);
	  //p.area.toFront();
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
      });

    return p;
  };

})();
