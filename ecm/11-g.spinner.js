/*
 * Raphael-based Spinner
 *
 * Copyright (c) 2008 - 2009 Dmitry Baranovskiy (http://raphaeljs.com)
 * Licensed under the MIT (http://www.opensource.org/licenses/mit-license.php) license.
 *
 * Edited by Phoenix Kayo (2010)
 */
Raphael.fn.spinner=function(x, y, R1, R2, count, stroke_width, colour) {
  var sectorsCount = count || 12,
  color = colour || '#000',
  width = stroke_width || 15,
  r1 = Math.min(R1, R2) || 35,
  r2 = Math.max(R1, R2) || 60,
  cx = width + x,
  cy = width + y,
  r = this,
  spinner = r.set(),
  sectors = [],
  opacity = [],
  beta = 2 * Math.PI / sectorsCount,

  pathParams = {stroke: color, 'stroke-width': width, 'stroke-linecap': 'round'};
  Raphael.getColor.reset();
  for (var i = 0; i < sectorsCount; i++) {
    var alpha = beta * i - Math.PI / 2,
    cos = Math.cos(alpha),
    sin = Math.sin(alpha);
    opacity[i] = 1 / sectorsCount * i;
    sectors[i] = r.path([['M', cx + r1 * cos, cy + r1 * sin], ['L', cx + r2 * cos, cy + r2 * sin]]).attr(pathParams);
    spinner.push(sectors[i]);
    if (color == 'rainbow') {
      sectors[i].attr('stroke', Raphael.getColor());
    }
  }
  var tick, runned;
  var ticker=function() {
    opacity.unshift(opacity.pop());
    for (var i = 0; i < sectorsCount; i++) {
      sectors[i].attr('opacity', opacity[i]);
    }
    r.safari();
    if(runned){
      tick = setTimeout(ticker, 1000 / sectorsCount);
    }
  };
  spinner.start=function(){
    runned=true;
    ticker();
    return this;
  };
  spinner.stop=function(){
    runned=false;
    clearTimeout(tick);
    return this;
  };
  return spinner;
};
