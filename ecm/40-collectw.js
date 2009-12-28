/*
 * CollectW - JavaScript CollectD UI
 *
 * Copyright (c) 2010 Phoenix Kayo
 * Licensed under the GNU GPL license.
 */

$(function(){
	var json_url=function(action){return '/collectw?'+action;};
  /*
  var si_char=function(d){
    var table = {
      1e-24: "y",
      1e-21: "z",
      1e-18: "a",
      1e-15: "f",
      1e-12: "p",
      1e-9:  "n",
      1e-6:  "µ",
      1e-3:  "m",
      1:     "",
      1e3:   "k",
      1e6:   "M",
      1e9:   "G",
      1e12:  "T",
      1e15:  "P",
      1e18:  "E",
      1e21:  "Z",
      1e24:  "Y"
  };
  var i;
  for(var i in table)if(d<i)break;
  if(i == 0 || i == tablesize) {
    m = 1.0;
    s = "";
    return false;
  } else {
    --i;
    m = si_table[i].factor;
    s = si_table[i].si_char;
    return true;
  }
}*/

	var info=function(){
	    $.getJSON(json_url('info'), function(json){
		    if(json.status==false){
			alert(json.message);
			return;
		    }
		    status.text('Copleting..');
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
	
	
	var date={
	    s2n:function(s){
		s=parseInt(s, 10);
		//s--;
		return s;
	    },
	    n2s:function(n){
		n=parseInt(n, 10);
		//n++;
		return (n>9?'':'0')+n;
	    },
	    parse:function(value){
		var Q=date.s2n;
		var m=value.match(/^(\d{4})\-(\d{2})\-(\d{2})(\_(\d{2})\:(\d{2}))?$/);
		if(!m[0])return null;
		var d=new Date(Q(m[1]), Q(m[2])-1, Q(m[3]), m[4]?Q(m[5]):null, m[4]?Q(m[6]):null);
		return Math.round(d.getTime()/1000);
	    },
	    tostr:function(value){
		var Q=date.n2s;
		var d=new Date(parseInt(value)*1000);
		var r=Q(d.getFullYear())+'-'+Q(d.getMonth()+1)+'-'+Q(d.getDate());
		if(d.getMinutes()>0 || d.getHours()>0) r+='_'+Q(d.getHours())+':'+Q(d.getMinutes());
		return r;
	    },
	    gen_interp:function(beg, end, steps){
		var r=[], b=date.parse(beg), e=date.parse(end), s=Math.round((e-b)/(steps-1)), o=beg.search('_')||end.search('_');
		for(var i=b;i<e;i+=s) r.push(date.tostr(i)); r.push(date.tostr(e));
		return r;
	    }
	};
	
	//alert(['2009-12-18_22:00', date.tostr(date.parse('2009-12-18_22:00'))]);
	//alert(['2009-12-18', date.tostr(date.parse('2009-12-18'))]);
	//alert(date.gen_interp('2009-12-21_18:00', '2009-12-21_18:30', 3));
	
	var draw=function(ctx, title, interval, conf){
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
	    
	    leg.legend(title, l, c);
	    r.g.linechart(60, 20, ctx.innerWidth()-80, ctx.innerHeight()-40, x, y, {nostroke: false, axis: "0 0 1 1", symbol: "", legendpos: "west", legend:l, colors:c.length==y.length?c:null});
	    //stat.text('Are you see? '+d.length+' values');
	}
	
	$.fn.legend=function(title, labels, colors){
	    colors=colors&&colors.length>=labels.length?colors:Raphael.fn.g.colors;
	    this.append('<div id="title">'+title+'</div>');
	    for(var i in labels){
		var m=colors[i].match(/hsb\s*\(\s*([\.\d]+)\s*\,\s*([\.\d]+)\s*\,\s*([\.\d]+)\s*\)/);
		m=m?Raphael.hsb2rgb(m[1],m[2],m[3]).hex:colors[i];
		this.append('<div><div id="mark" style="background:'+m+'"></div>'+labels[i]);
	    }
	};
	
	var disp=function(ctx, title, conf){
	    var range=interval.get();
	    var requests=0; for(var name in conf) requests++;
	    for(var name in conf){
		(function(name){
		    $.getJSON(json_url('data:'+name+'['+range[0]+','+range[1]+']'), function(json){
			    var attr=name.match(/\{([^\{]+)\}/)[1];
			    conf[name].data=json[attr];
			    //alert(json[attr]);
			    requests--;
			    if(requests==0) draw(ctx, title, interval, conf);
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
	interval.set=function(d){
	    if(typeof d=='string') d=[d,d];
	    if(d[0]==d[1])d[1]=date.tostr(date.parse(d[0])+60*60*24);
	    this.html(d.join(' ÷ '));
	    this.trigger('change');
	}
	interval.get=function(){
	    var d=this.html().split(' ÷ ');
	    return d;
	}
	var view=body.find('div#view');
	
	var init_date=function(){
	    $.getJSON(json_url('time'), function(json){
		    var d=json.local.split('_')[0];
		    interval.set(d);
		    d=interval.get();
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
				interval.set(formated);
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
