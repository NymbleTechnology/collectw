/*
 * CollectW - JavaScript CollectD UI
 *
 * Copyright (c) 2010 Phoenix Kayo
 * Licensed under the GNU GPL license.
 */

$(function(){
  var mustr=function(s, n){
    var r='';
    for(var i=0;i<n;i++)r+=s;
    return r;
  };

  var tostr=function(o, t, n, l){
    var r='';
    t=t||' ';
    l=l||0;
    n=n||'\n';

    if(o==null)r='null';
    if(typeof o=='undefined')r='undefined';
    else if(typeof o=='string')r='"'+o+'"';
    else if(typeof o=='boolean')r=''+(o?'true':'false')+'';
    else if(typeof o=='number')r=''+o+'';
    else if(typeof o=='function')r=''+o+'';
    else if($.isArray(o)){
      r+='['+n;
      for(var i=0;i<o.length;i++){
        i && (r+=','+n);
        r+=mustr(t, l+1)+tostr(o[i], t, n, l+1);
      }
      r+=n+mustr(t, l)+']';
    }else{
      r+='{'+n;
      var f=true;
      for(var i in o){
        !f && (r+=','+n); f=false;
        r+=mustr(t, l+1)+tostr(i, t, n)+': '+tostr(o[i], t, n, l+1);
      }
      r+=n+mustr(t, l)+'}';
    }
    return r;
  };

  var date=$.simple_date;

  var json_url=demo_mode?(function(action){return 'collectw-'+action.split(':')[0]+'.json';}):(function(action){return '/collectw?'+action;});

  var cached=(function(){
    var cache={
      keys:[/* key, ... */],
      data:{/* key:{e(xpire):seconds|null, d(ata):value}, ... */},
      max_length:100,
      expire:{min:60,max:null}
    };
    var gennow=function(){
      var d=new Date();
      return Math.round(d.getTime()/1000);
    };
    var genkey=function(range, key){
      return range.join('+')+'='+key;
    };
    var get=function(range, keys, func){
      var now=gennow(), req_keys=[], ret={};
      for(var k in keys){ // fill cached actual data
	var key=keys[k], ck=genkey(range, key), d=cache.data[ck];
	if(d && (!d.e || d.e && d.e>now)) { // check if exists and not expired
	  ret[key]=d.d;
	}else{
	  req_keys.push(key);
	}
      }
      if(req_keys.length){ // not all cached
	$.getJSON(json_url('data:['+range.join(',')+']{'+req_keys.join(',')+'}'), function(json){
          for(var i=0;i<json.length;i++){ // fill new data
	    var key=req_keys[i];
	    ret[key]=json[i];
	  }
	  var datas=[], now=gennow();
	  for(var k in keys){
	    var key=keys[k], ck=genkey(range, key), d=ret[key];
	    cache.data[ck]={d:d,e:cache.expire[(now<date.parse(range[1]))?'min':'max']};
            if(cache.data[ck].e)cache.data[ck].e+=now;
	    datas.push(ret[key]);
	  }
	  func(datas);
	});
      }else{ // all cached
	setTimeout(function(){
	  var datas=[];
	  for(var k in keys){
	    var key=keys[k];
	    datas.push(ret[key]);
	  }
	  func(datas);
	}, 0);
      }
    };
    return {
      get:get
    };
  })();

  var info=function(){
    $.getJSON(json_url('info'), function(json){
      if(json.status==false){
	alert(json.message);
	return;
      }
      status.text('Completting..');
      ctx.append($('<select>').attr('id', 'nodes'));
      var select=ctx.find('select#nodes');
      var opt_add=function(select, node, path, indent){
	var count=0;
	indent+='-';
	for(var i in node){
	  count++;
	  var n=node[i];
	  if(typeof n=='string'){
	    select.append($('<option>').attr('value', path+'/'+n).text(indent+n));
	  }else{
	    select.append($('<optgroup>').text(indent+i));
	    count+=opt_add(select, n, path+'/'+i, indent);
	  }
	}
	return count;
      };
      var c=opt_add(select, json, '', '');
      select.attr('multiple', 1).attr('size', c);
	});
      };

      var draw=function(ctx, title, interval, conf){
        var gutter=10, linewidth=1, hoverlinewidth=2, fillopacity=0.2, hoverfillopacity=0.4;
        var x=[], y=[], l=[], c=[], z=[], ex=[date.parse(interval[0]), date.parse(interval[1])], ey;

	for(var name in conf){
	  var d=conf[name].data;
	  /* calc time edges */
	  /*
	    if(z==undefined){
	    z=Math.round(d.avg.length/2);
	    z=[z,z];
	    }
	    for(var i=0;i<d.avg.length;i++){
	    if(isNaN(d.avg[i])){
	    (z[0]>i) && (z[0]=i);
	    (z[1]<i) && (z[1]=i);
	    }
	    }
	  */
	  if(!ey)ey=d.lim;
	  else{
	    (ey[0]>d.lim[0]) && (ey[0]=d.lim[0]);
	    (ey[1]<d.lim[1]) && (ey[1]=d.lim[1]);
	  }
	  /* fill y array */
	  y.push(d);
	  l.push(conf[name].title);
	  conf[name].color && c.push(conf[name].color);
	}

	ctx.append('<div id="diagram">').append('<div id="legend">');
	var dia=ctx.find('div#diagram'), leg=ctx.find('div#legend');
	var r=Raphael(dia.get(0));

	r.g.txtattr.font="10px 'Fontin Sans', Fontin-Sans, sans-serif";

	var g={x:40,y:40,w:dia.innerWidth()-80,h:dia.innerHeight()-60};

	leg.legend(title, l, c);

	var b=r.spinner(g.x+g.w/2, g.y+g.h/2, 20, 30, 12, 8, '#000').start();

        if(ex[0]==ex[1]||ey[0]==ey[1]){
	  stat.text('Data not present..');
        }else{
	  setTimeout(function(){
	    var ag=r.g.smart_line(g.x, g.y, g.w, g.h, false, y, ex, ey, {width:linewidth, fillopacity:fillopacity, colors:c.length==y.length?c:null});
	    ag.axis=r.set();

	    var sx=12;
	    var ay=r.g.smart_axis(g.x, g.y+g.h, g.h, ey[0], ey[1], 1);

	    var date_labels=date.smart_gen_interp(interval[0], interval[1], sx);
	    var ax=r.g.smart_axis(g.x, g.y+g.h, g.w, 0, sx, 0, 't', sx, date_labels);
	    ag.axis.push(ax, ay);
	    var pline_style={stroke:'#000','stroke-dasharray':'-','stroke-linecap':'butt','stroke-opacity':0.4};

	    r.g.smart_pick(g.x, g.y, g.w, g.h, ex, ey,
			   {holder:dia, popup:'popup', plines:{x:pline_style,y:pline_style}, gutter:0, format:function(v, e){
			     var d=date.tostr(Math.round(v.x)).split('_');
			     return r.g.short_number(v.y, 2)+' at '+d[1]+'\n'+d[0];
			   }});

	    leg.nodes
	      .bind('mouseenter', function(){
		var s=$(this), i=s.attr('num');
		var l=ag.lines[i], a=ag.areas[i];

		s.addClass('hover');
		a.toFront();
		a.attr({'opacity':hoverfillopacity});
		l.toFront();
		l.attr({'stroke-width':hoverlinewidth});
	      })
	      .bind('mouseleave', function(){
		var s=$(this), i=s.attr('num');
		var l=ag.lines[i], a=ag.areas[i];

		s.removeClass('hover');
		l.attr({'stroke-width':linewidth});
		a.attr({'opacity':fillopacity});
	      });
	    b.stop().remove();
	  }, 100);
        }
      };

  $.fn.legend=function(title, labels, colors){
    colors=colors&&colors.length>=labels.length?colors:Raphael.fn.g.colors;
    this.append('<div id="title">'+title+'</div>');
    for(var i in labels){
      var m=colors[i].match(/hsb\s*\(\s*([\.\d]+)\s*\,\s*([\.\d]+)\s*\,\s*([\.\d]+)\s*\)/);
      m=m?Raphael.hsb2rgb(m[1],m[2],m[3]).hex:colors[i];
      this.append('<div id="node" num="'+i+'"><div id="mark" style="background:'+m+'"></div>'+labels[i]+'</div>');
    }
    this.nodes=this.find('div#node');
    return this;
  };

  var init_view=function(view_title, graphs){
    var view_id=name.replace(/\ /g, '_');
    stat.text('Configuring view "'+view_title+'" ..');

    tabs.append('<li>'+view_title+'</li>');
    var tab=tabs.find('li:last');

    var redraw=function(){
      tabs.current=$(this);

      var n=0; for(var title in graphs)n++;
      var w=view.innerWidth(), h=view.innerHeight(), gh=h/n;

      /* make query */
      var range=interval.get_range();
	  var elems=[];
      for(var graph_title in graphs){
	for(var line_id in graphs[graph_title]){
	  elems.push(line_id);
	}
      }
      /* send query */
      range[1]=date.tostr(date.parse(range[1])+(60*60*24));
      cached.get(range, elems, function(json){
	//alert(tostr(json));
	if(!json)return;
	stat.text('Rendering view "'+view_title+'" ..');
	view.empty();

	var i=0;
	for(var graph_title in graphs){
	  var lines=graphs[graph_title];

	  for(var line_id in lines){
	    lines[line_id].data=json[i];
	    i++;
	  }

	  view.append('<div id="graph"></div>');
	  var graph=view.find('div:last');
	  graph.width(w); graph.height(gh);

	  draw(graph, graph_title, range, lines);
	}
      });
    };

    tab.bind('click', redraw);
  };

  var init=function(){
    init_date();
    stat.text('Loading user config..');
    $.getJSON(json_url('load'), function(json){
      stat.append(' done');
      for(var name in json)init_view(name, json[name]);
      if(demo_mode)tabs.append('<li><a href="http://sourceforge.net/projects/collectw/">SourceForge Project Page</a></li>');
      tabs.find('li:first').click();
    });
  };

  var body=$('body');
  body.append('<div id="tabs"><ul></ul><span></span></div>');
  body.append('<div id="cal"></div>');
  body.append('<div id="view"></div>');
  body.append('<div id="stat"></div>');
  var stat=body.find('#stat'); /* for debug */ window.stat=stat;
  stat.text('Loading..');
  var tabs=body.find('#tabs ul');
  var interval=body.find('div#tabs > span');
  interval.set_range=function(d){
    if(typeof d=='string') d=[d,d];
    interval.old_range=interval.get_range();
    interval.html(d.join(' ÷ '));
  };
  interval.get_range=function(){
    var d=interval.html().split(' ÷ ');
    return d;
  };
  interval.changed=function(){
    return interval.get_range()!=interval.old_range;
  };
  var view=body.find('div#view');

  var init_date=function(){
    $.getJSON(json_url('time'), function(json){
      var d=json.local.split('_')[0];
      interval.set_range(d);
      d=interval.get_range();
      var cal=body.find('div#cal');
      cal.DatePicker({
	flat: true,
	format:'Y-m-d',
	date: d,
	current: d[0],
	calendars: 2,
	mode: 'range',
	starts: 1,
	onChange: function(formated, dates){
	  interval.set_range(formated);
	}
      });
      var pick=cal.find('div.datepicker');
      var state=false;
      interval.bind('click', function(){
	cal.stop().animate({height:state?0:pick.outerHeight()}, 500, state?function(){
          if(interval.changed())interval.trigger('change');
        }:function(){});
	state=!state;
	return false;
      });
      pick.css('position', 'absolute');
      interval.bind('change', function(){
        tabs.current.trigger('click');
      });
    });
  };

  setTimeout(init, 1);
});
