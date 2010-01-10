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
  /* t: t,b,l,r */
  var axis=function(x, y, w, h, t, e){
    var d=[SELF.date.parse(e[0]), SELF.date.parse(e[1])];
    var date_mode = d[0]!=null && d[1]!=null;
    var space=10;
    var label=[];
    /*
    var gutter=10;
    var a=[0,0,0,0];
    switch(t){
    case 'l': a=[x+gutter,   y+gutter,   0, h-2*gutter]; break;
    case 'r': a=[x+w-gutter, y+gutter,   0, h-2*gutter]; break;
    case 't': a=[x+gutter,   y+gutter,   w-2*gutter, 0]; break;
    case 'b': a=[x+gutter,   y+h-gutter, w-2*gutter, 0]; break;
    }
    a[2]+=a[0];
    a[3]+=a[1];
    var axis = this.set();
    axis.push(this.path('M'+a[0]+' '+a[1]+'L'+a[2]+' '+a[3]));
    */
    var probe_label=this.text(0, 0, "00:00");
    var label_length=probe_label.getBBox().height+space;
    probe_label.remove();

    var axis=this.g.axis();
    return axis;
  };
  var axis=function (x, y, length, from, to, steps, orientation, labels, type, dashsize) {
        dashsize = dashsize == null ? 2 : dashsize;
        type = type || "t";
        steps = steps || 10;
        var path = type == "|" || type == " " ? ["M", x + .5, y, "l", 0, .001] : orientation == 1 || orientation == 3 ? ["M", x + .5, y, "l", 0, -length] : ["M", x, y + .5, "l", length, 0],
            ends = this.g.snapEnds(from, to, steps),
            f = ends.from,
            t = ends.to,
            i = ends.power,
            j = 0,
	    text = this.set(),
	    d = (t - f) / steps;
        var label = f,
	    rnd = i > 0 ? i : 0,
            dx = length / steps;
        if (+orientation == 1 || +orientation == 3) {
            var Y = y,
                addon = (orientation - 1 ? 1 : -1) * (dashsize + 3 + !!(orientation - 1));
            while (Y >= y - length) {
                type != "-" && type != " " && (path = path.concat(["M", x - (type == "+" || type == "|" ? dashsize : !(orientation - 1) * dashsize * 2), Y + .5, "l", dashsize * 2 + 1, 0]));
                text.push(this.text(x + addon, Y, (labels && labels[j++]) || short_label(Math.round(label) == label ? label : +label.toFixed(rnd))).attr(this.g.txtattr).attr({"text-anchor": orientation - 1 ? "start" : "end"}));
                label += d;
                Y -= dx;
            }
            if (Math.round(Y + dx - (y - length))) {
                type != "-" && type != " " && (path = path.concat(["M", x - (type == "+" || type == "|" ? dashsize : !(orientation - 1) * dashsize * 2), y - length + .5, "l", dashsize * 2 + 1, 0]));
                text.push(this.text(x + addon, y - length, (labels && labels[j]) || short_label(Math.round(label) == label ? label : +label.toFixed(rnd))).attr(this.g.txtattr).attr({"text-anchor": orientation - 1 ? "start" : "end"}));
            }
        } else {
            var X = x,
                label = f,
                rnd = i > 0 ? i : 0,
                addon = (orientation ? -1 : 1) * (dashsize + 9 + !orientation),
                dx = length / steps,
                txt = 0,
                prev = 0;
            while (X <= x + length) {
                type != "-" && type != " " && (path = path.concat(["M", X + .5, y - (type == "+" ? dashsize : !!orientation * dashsize * 2), "l", 0, dashsize * 2 + 1]));
                text.push(txt = this.text(X, y + addon, (labels && labels[j++]) || short_label(Math.round(label) == label ? label : +label.toFixed(rnd))).attr(this.g.txtattr));
                var bb = txt.getBBox();
                if (prev >= bb.x - 5) {
                    text.pop(text.length - 1).remove();
                } else {
                    prev = bb.x + bb.width;
                }
                label += d;
                X += dx;
            }
            if (Math.round(X - dx - x - length)) {
                type != "-" && type != " " && (path = path.concat(["M", x + length + .5, y - (type == "+" ? dashsize : !!orientation * dashsize * 2), "l", 0, dashsize * 2 + 1]));
                text.push(this.text(x + length, y + addon, (labels && labels[j]) || short_label(Math.round(label) == label ? label : +label.toFixed(rnd))).attr(this.g.txtattr));
            }
        }
        var res = this.path(path);
        res.text = text;
        res.all = this.set([res, text]);
        res.remove = function () {
            this.text.remove();
            this.constructor.prototype.remove.call(this);
        };
        return res;
    };
  Raphael.fn.g.axis_edges=edges;
  Raphael.fn.g.smart_axis=axis;
})();
