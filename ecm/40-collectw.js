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
		var d=conf[name].data;
		var a=[]; for(var i=0;i<d.length;i++) a.push(i);
		x.push(a);
		//x.push(date.gen_interp(interval[0], interval[1], d.length));
		y.push(d);
		l.push(conf[name].title);
		conf[name].color && c.push(conf[name].color);
	    }
	    
	    //alert([x,y]);
	    ctx.append('<div id="diagram">').append('<div id="legend">');
	    var dia=ctx.find('div#diagram'), leg=ctx.find('div#legend');
	    var r=Raphael(dia.get(0));
	    //r.circle(50, 50, 40);
	    r.g.txtattr.font="10px 'Fontin Sans', Fontin-Sans, sans-serif";
	    
	    var g={x:60,y:20,w:dia.innerWidth()-80,h:dia.innerHeight()-40};
	    
	    leg.legend(title, l, c);
	    var ag=r.g.linechart(g.x, g.y, g.w, g.h, x, y, {nostroke: false, width: leg.find('div#mark').css('border-width'), axis: "0 0 0 0", symbol: "", colors:c.length==y.length?c:null});
	    
	    var ey=r.g.axis_edges(y), sy=Math.floor((g.h)/20);
	    var ex=r.g.axis_edges(x), sx=24;
	    var date_labels=date.smart_gen_interp(interval[0], interval[1], sx);
	    var ay=r.g.smart_axis(g.x+gutter, g.y+g.h-gutter, g.h-2*gutter, ey[0], ey[1], sy, 1);
	    var ax=r.g.smart_axis(g.x+gutter, g.y+g.h-gutter, g.w-2*gutter, 0, 24, sx, 0, date_labels);
	    ag.axis.push(ax, ay);
	    
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
	
	var disp=function(ctx, title, conf){
	    stat.text('Rendering view "'+title+'" ..');
	    var range=interval.get_range();
	    var requests=0; for(var name in conf) requests++;
	    for(var name in conf){
		(function(name){
		    $.getJSON(json_url('data:'+name+'['+range[0]+','+range[1]+']'), function(json){
			    var attr=name.match(/\{([^\{]+)\}/)[1];
			    conf[name].data=json[attr];
			    requests--;
			    if(requests==0) draw(ctx, title, range, conf);
			});
		})(name);
	    }
	}
	
	var init_view=function(name, areas){
	    var id=name.replace(/\ /g, '_');
	    stat.text('Configuring view "'+name+'" ..');
	    
	    tabs.append('<li>');
	    var tab=tabs.find('li:last');
	    tab.text(name);

	    var redraw=function(){
		var n=0; for(var title in areas)n++;
		var w=view.innerWidth(), h=view.innerHeight(), gh=h/n;
		view.empty();
		for(var title in areas){
		    view.append('<div id="graph">');
		    var elem=view.find('div:last');
		    elem.width(w); elem.height(gh);
		    disp(elem, title, areas[title]);
		}
	    };
	    
	    tab.bind('click', redraw);
	    interval.bind('change', redraw);

	    /*
	    var graph=ctx.find('div#graph').css({
		    '-moz-border-radius':'10px',
		    '-webkit-border-radius':'10px',
		    '-webkit-box-shadow':'0 1px 3px #666',
		    'background':'#ddd',
		    'margin':'0 auto'
		}).width(600).height(400);
	    var r=Raphael("graph");
	    r.g.txtattr.font="10px 'Fontin Sans', Fontin-Sans, sans-serif";
	    */
	    //setTimeout(init, 100);
	    //setTimeout(draw, 100);
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
	var stat=body.find('#stat');
	stat.text('Loading..');
	var tabs=body.find('#tabs ul');
	var interval=body.find('div#tabs > span');
	interval.set_range=function(d){
	    if(typeof d=='string') d=[d,d];
	    if(d[0]==d[1])d[1]=date.tostr(date.parse(d[0])+60*60*24);
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
			    },
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

	setTimeout(init, 100);

    });
