/*
 * CollectW - JavaScript CollectD UI
 *
 * Copyright (c) 2010 Phoenix Kayo
 * Licensed under the GNU GPL license.
 */

$(function(){
    var json_url=demo_mode?(function(action){return 'collectw-'+action.split(':')[0]+'.json';}):(function(action){return '/collectw?'+action;});

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

    var date=$.simple_date;

    var draw=function(ctx, title, interval, conf){
      var gutter=10, linewidth=2, hoverlinewidth=3, fillopacity=0.2, hoverfillopacity=0.4;
      var x=[], y=[], l=[], c=[], z=[];

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
	      /* fill y array */
	      y.push(d);
	      l.push(conf[name].title);
	      conf[name].color && c.push(conf[name].color);
	    }

	    ctx.append('<div id="diagram">').append('<div id="legend">');
	    var dia=ctx.find('div#diagram'), leg=ctx.find('div#legend');
	    var r=Raphael(dia.get(0));

	    r.g.txtattr.font="10px 'Fontin Sans', Fontin-Sans, sans-serif";

	    var ex=[date.parse(interval[0]), date.parse(interval[1])], ey=r.g.smart_edges(y);

	    var g={x:40,y:40,w:dia.innerWidth()-80,h:dia.innerHeight()-60};

	    leg.legend(title, l, c);

	    var b=r.spinner(g.x+g.w/2, g.y+g.h/2, 20, 30, 12, 8, '#000').start();

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
		$.getJSON(json_url('data:'+'['+range.join(',')+']'+'{'+elems.join(',')+'}'), function(json){
			if(!json)return;
			stat.text('Rendering view "'+view_title+'" ..');
			view.empty();

			var i=0;
			for(var graph_title in graphs){
			    var lines=graphs[graph_title];

			    for(var line_id in lines){
				var e=json[i];
				lines[line_id].data={avg:e[0],min:e[1],max:e[2]};
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
	    interval.bind('change', redraw);
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
	    interval.html(d.join(' ÷ '));
	    interval.trigger('change');
	};
	interval.get_range=function(){
	    var d=interval.html().split(' ÷ ');
	    return d;
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
			    cal.stop().animate({height:state?0:pick.outerHeight()}, 500);
			    state=!state;
			    return false;
			});
		    pick.css('position', 'absolute');
		});
	}

	setTimeout(init, 1);
    });
