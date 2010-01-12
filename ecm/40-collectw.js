/*
 * CollectW - JavaScript CollectD UI
 *
 * Copyright (c) 2010 Phoenix Kayo
 * Licensed under the GNU GPL license.
 */

$(function(){
	var json_url=function(action){return '/collectw?'+action;};
	
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
		    }
		    var c=opt_add(select, json, '', '');
		    select.attr('multiple', 1).attr('size', c);
		});
	};
	
	var date=$.simple_date;
	
	var draw=function(ctx, title, interval, conf){
	    var gutter=10, linewidth=2, hoverlinewidth=3;
	    var x=[], y=[], l=[], c=[];
	    
	    for(var name in conf){
		var d=conf[name].data.avg;
		var a=[]; for(var i=0;i<d.length;i++) a.push(i);
		x.push(a);
		//x.push(date.gen_interp(interval[0], interval[1], d.length));
		y.push(d);
		l.push(conf[name].title);
		conf[name].color && c.push(conf[name].color);
	    }
	    
	    ctx.append('<div id="diagram">').append('<div id="legend">');
	    var dia=ctx.find('div#diagram'), leg=ctx.find('div#legend');
	    var r=Raphael(dia.get(0));
	    //r.circle(50, 50, 40);
	    r.g.txtattr.font="10px 'Fontin Sans', Fontin-Sans, sans-serif";
	    
	    var ey=r.g.axis_edges(y), ex=r.g.axis_edges(x);
	    var g={x:80,y:40,w:dia.innerWidth()-160,h:dia.innerHeight()-80};
	    
	    leg.legend(title, l, c);
	    
	    var b=r.spinner(g.x+g.w/2, g.y+g.h/2, 20, 30, 12, 8, '#000').start();
	    
	    setTimeout(function(){
		    if(ey[0]<ey[1]){
			var ag=r.g.linechart(g.x, g.y, g.w, g.h, x, y, {nostroke: false, width: linewidth, axis: "0 0 0 0", symbol: "", colors:c.length==y.length?c:null, gutter:0.001});
		    }
		    var sy=Math.floor((g.h)/20), sx=24;
		    if(ey[0]<ey[1]){
			var ay=r.g.smart_axis(g.x, g.y+g.h, g.h, ey[0], ey[1], sy, 1);
			//ag.axis.push(ay);
		    }
		    var date_labels=date.smart_gen_interp(interval[0], interval[1], sx);
		    var ax=r.g.smart_axis(g.x, g.y+g.h, g.w, 0, 24, sx, 0, date_labels);
		    //ag.axis.push(ax);
		    
		    r.g.picker(g.x, g.y, g.w, g.h, [date.parse(interval[0]), date.parse(interval[1])], ey, 
			       {holder:dia, popup:'popup', gutter:0, format:function(v, e){
				       return $.short_number(v.y, 2)+' at '+date.tostr(Math.round(v.x)).replace(/_/g, ' ');
			    }});
		    
		    leg.nodes
			.bind('mouseenter', function(){
				var s=$(this);
				var l=ag.lines[s.attr('num')];
				
				s.addClass('hover');
				l.toFront();
				l.attr({'stroke-width':hoverlinewidth});
			    })
			.bind('mouseleave', function(){
				var s=$(this);
				var l=ag.lines[s.attr('num')];
				
				s.removeClass('hover');
				l.attr({'stroke-width':linewidth});
			    });
		    b.stop().remove();
		}, 100);
	}
	
	$.fn.legend=function(title, labels, colors){
	    colors=colors&&colors.length>=labels.length?colors:Raphael.fn.g.colors;
	    this.append('<div id="title">'+title+'</div>');
	    for(var i in labels){
		var m=colors[i].match(/hsb\s*\(\s*([\.\d]+)\s*\,\s*([\.\d]+)\s*\,\s*([\.\d]+)\s*\)/);
		m=m?Raphael.hsb2rgb(m[1],m[2],m[3]).hex:colors[i];
		this.append('<div id="node" num="'+i+'"><div id="mark" style="background:'+m+'"></div>'+labels[i]);
	    }
	    this.nodes=this.find('div#node');
	    return this;
	};
	
	var init_view=function(view_title, graphs){
	    var view_id=name.replace(/\ /g, '_');
	    stat.text('Configuring view "'+view_title+'" ..');
	    
	    tabs.append('<li>');
	    var tab=tabs.find('li:last');
	    tab.text(view_title);
	    
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
			    
			    view.append('<div id="graph">');
			    var graph=view.find('div:last');
			    graph.width(w); graph.height(gh);
			    
			    draw(graph, graph_title, range, lines);
			}
		    });
	    };
	    
	    tab.bind('click', redraw);
	    interval.bind('change', redraw);
	}
	
	var init=function(){
	    init_date();
	    stat.text('Loading user config..');
	    $.getJSON(json_url('load'), function(json){
		    stat.append(' done');
		    for(var name in json)init_view(name, json[name]);
		    tabs.find('li:first').click();
		});
	}
	
	var body=$('body');
	body.append('<div id="tabs"><ul>');
	body.find('div#tabs').append('<span>');
	body.append('<div id="cal">');
	body.append('<div id="view">');
	body.append('<div id="stat">');
	var stat=body.find('#stat'); /* for debug */ window.stat=stat;
	stat.text('Loading..');
	var tabs=body.find('#tabs ul');
	var interval=body.find('div#tabs > span');
	interval.set_range=function(d){
	    if(typeof d=='string') d=[d,d];
	    this.html(d.join(' ÷ '));
	    this.trigger('change');
	}
	interval.get_range=function(){
	    var d=this.html().split(' ÷ ');
	    return d;
	}
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
