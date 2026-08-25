// stats.js — 统计卡片

function buildStats(root, todos, allFiles) {
  root.createDiv({ cls: PLUGIN_ID+'-section-title', text: T.stats });
  var statsEl = root.createDiv({ cls: PLUGIN_ID+'-stats' });
  var noteCount = allFiles.filter(function(f){ return f.basename!=='Home'&&f.basename!=='欢迎'; }).length;
  var statConfig = [
    { label:E.pencil+' 笔记总数', max:50, color:'#818cf8', type:'static', value:noteCount },
    { label:E.check+' 待办总数', max:20, color:'#c084fc', type:'dynamic', field:'todoCount' },
    { label:E.check+' 已完成',   max:1,  color:'#22c55e', type:'dynamic', field:'doneCount' },
    { label:E.check+' 完成率',   max:100,color:'#34d399', type:'dynamic', field:'donePct', suffix:'%' }
  ];
  var statValEls = [], statFillEls = [];
  statConfig.forEach(function(cfg){
    var card = statsEl.createDiv({ cls: PLUGIN_ID+'-stat' });
    card.style.setProperty('--stat-clr', cfg.color);
    card.createDiv({ cls: PLUGIN_ID+'-stat-label', text: cfg.label });
    var valEl = card.createDiv({ cls: PLUGIN_ID+'-stat-val' });
    statValEls.push(valEl);
    if (cfg.max > 0) {
      var bar = card.createDiv({ cls: PLUGIN_ID+'-stat-bar' });
      var fill = bar.createDiv({ cls: PLUGIN_ID+'-stat-fill', attr:{style:'width:0%'} });
      statFillEls.push(fill);
    } else {
      statFillEls.push(null);
    }
  });

  function updateStats() {
    var doneCount = todos.filter(function(t){ return t.done; }).length;
    var todoCount = todos.length;
    var donePct = todoCount > 0 ? Math.round(doneCount/todoCount*100) : 0;
    var values = [noteCount, todoCount, doneCount, donePct];
    values.forEach(function(val,i){
      statValEls[i].textContent = '' + val + (statConfig[i].suffix||'');
      if (statFillEls[i]) {
        var max = statConfig[i].max;
        var pct = Math.min(100, max > 0 ? Math.round(val/max*100) : 0);
        statFillEls[i].style.width = pct + '%';
      }
    });
  }
  updateStats();
  return updateStats;
}
