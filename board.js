/* 横ビュー（検討ボード）— 商品を列・項目を行に置き換えた見せ方
   正本: docs/PAGE-STRUCTURE-RULES.md / docs/DESIGN.md §5-16

   設計の約束（これを破ると縦横で情報格差が生まれる）:
   1. データも絞り込みも並び替えも「持たない」。compare.js が確定させた items をそのまま描く
   2. 栄養素固有の判断を書かない。タイプ＝NUT.badges / 絞り込み＝NUT.chips / 群＝NUT.ingGroups
   3. 縦ビューが出している情報は、必ずこちらにも対応する行がある（対応表は PAGE-STRUCTURE-RULES §12）
   このモジュール専用の状態は「表示密度」だけ。それ以外は compare.js の state を読む   */
window.BoardView = (function(){
  var C = null;              /* compare.js から渡される文脈 */
  var dense = true;   /* 表示は「ぎっしり」固定（切替UIは廃止・2026-08-15竹森氏指示） */
  var viewList = [], viewIdx = -1, lastFocus = null;

  function esc(s){ return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/"/g,"&quot;"); }
  function yen(x){ return x<10 ? (Math.round(x*10)/10).toFixed(1) : String(Math.round(x)); }

  /* 対数目盛。最安と最高が100倍以上離れるため、線形だと上位が全部同じ長さに潰れる */
  function logw(v,min,max){
    if(v==null||!isFinite(min)||!max||max<=min) return v==null?0:50;
    return Math.max(5,(Math.log(v)-Math.log(min))/(Math.log(max)-Math.log(min))*100);
  }

  /* 同梱成分を NUT.ingGroups の順に振り分ける。最初に当たった群だけに入れる */
  function groupsOf(p){
    var G = C.NUT.ingGroups || [];
    var res = {};
    (p.ings||[]).forEach(function(g){
      var nm=(g.n||"").split("(")[0].split("（")[0].trim(); if(!nm) return;
      for(var i=0;i<G.length;i++){
        if(new RegExp(G[i].pattern).test(nm)){ (res[G[i].key]=res[G[i].key]||[]).push(nm); break; }
      }
    });
    return res;
  }

  /* ---- 吹き出し（群の印にカーソルを合わせた時だけ出す） ---- */
  var tip=null;
  function ensureTip(){
    if(tip) return;
    tip=document.createElement("div"); tip.id="tip"; document.body.appendChild(tip);
  }
  function showTip(el){
    ensureTip();
    var txt=el.getAttribute("data-tip"); if(!txt) return;
    tip.textContent=txt; tip.classList.add("on");
    var r=el.getBoundingClientRect(), w=tip.offsetWidth, h=tip.offsetHeight;
    var x=r.left+r.width/2-w/2, y=r.top-h-8;
    if(x<8) x=8; if(x+w>window.innerWidth-8) x=window.innerWidth-w-8;
    if(y<8) y=r.bottom+8;
    tip.style.left=Math.round(x)+"px"; tip.style.top=Math.round(y)+"px";
  }
  function hideTip(){ if(tip) tip.classList.remove("on"); }

  /* ---- 詳細パネル（中身は縦ビューと同じ detailHtml を使う＝情報格差が出ない） ---- */
  function openDetail(i){
    if(i<0||i>=viewList.length) return;
    var dlg=document.getElementById("dlg"); if(!dlg) return;
    viewIdx=i; var p=viewList[i];
    document.getElementById("dlgph").innerHTML = p.img? '<img src="'+esc(p.img)+'" alt="">' : '';
    document.getElementById("dlgmk").textContent = p.maker||"";
    document.getElementById("dlgttl").textContent = p.name||"";
    document.getElementById("dlgbody").innerHTML = C.detailHtml(p);
    var box=dlg.querySelector(".dlgbox"); if(box) box.scrollTop=0;
    dlg.querySelector('[data-nav="-1"]').disabled = (i===0);
    dlg.querySelector('[data-nav="1"]').disabled  = (i===viewList.length-1);
    if(dlg.hidden){ lastFocus=document.activeElement; dlg.hidden=false; document.body.style.overflow="hidden"; }
    dlg.querySelector(".dlgx").focus();
  }
  function closeDetail(){
    var dlg=document.getElementById("dlg"); if(!dlg||dlg.hidden) return;
    dlg.hidden=true; document.body.style.overflow="";
    if(lastFocus && lastFocus.focus) lastFocus.focus();
  }

  /* ---- 本体の描画 ---- */
  /* 並べ替えできる行の見出し。押すたびに昇順・降順が入れ替わる（縦の列見出しと同じ挙動） */
  function rh(key, label, sub){
    var on = C.state.sort===key;
    var arr = on ? (C.state.dir===1 ? '▲' : '▼') : '';
    return '<th class="rh sortable'+(on?' on':'')+'" data-s="'+key+'" role="button" tabindex="0" '+
      'title="押すと並び替えます（もう一度押すと逆順）">'+esc(label)+
      '<span class="arr">'+arr+'</span>'+(sub?'<small>'+esc(sub)+'</small>':'')+'</th>';
  }
  function render(items, ctx){
    C = ctx;
    viewList = items;
    var NUT=C.NUT, GOAL=C.GOAL, UL=C.UL, UNIT=C.UNIT;
    var bd=document.getElementById("board"); if(!bd) return;

    /* 数値は compare.js の計算をそのまま使う（二重実装しない） */
    var rows = items.map(function(p){
      var bp=C.bestPrice(p);
      var day=bp?bp.day:null;
      var amt=(p.amtMax!=null)?p.amtMax:null;
      return {
        p:p, day:day, amt:amt,
        pct:(amt!=null)? amt/GOAL*100 : null,
        perGoal:(day!=null&&amt)? day/(amt/GOAL) : null,
        over:(UL!=null && amt!=null && amt>=UL),
        ig:groupsOf(p),
        dose:(p.doseMin!=null)?(p.doseMin===p.doseMax? p.doseMin : p.doseMin+"〜"+p.doseMax):null,
        unit:C.dispUnit(p.doseUnit||"粒", p)
      };
    });
    function span(k){
      var v=rows.map(function(r){return r[k];}).filter(function(x){return x!=null;});
      return {min:Math.min.apply(null,v), max:Math.max.apply(null,v)};
    }
    var sRDA=span("perGoal"), sDay=span("day");
    function cells(fn){ return rows.map(fn).join(""); }

    var h="";
    /* 商品（写真・メーカー・商品名・順位・飲む予定リストの＋） */
    h+='<tr><th class="rh">商品</th>'+cells(function(r,i){
      var p=r.p;
      var img=p.img?'<img src="'+esc(p.img)+'" alt="">':'';
      var rk=(C.state.sort==="perGoal"||C.state.sort==="price")?'<span class="rank'+(i<3?' top':'')+'">'+(i+1)+'位</span>':'';
      var on=!!C.state.picked[p.id];
      return '<td class="c"><div class="prod">'+
        '<button class="baddb'+(on?" on":"")+'" data-pick="'+esc(p.id)+'" title="飲む予定リストに入れる">'+(on?"✓":"＋")+'</button>'+
        '<div class="ph" data-open="'+i+'" role="button" tabindex="0" title="押すと調べた内容が開きます">'+img+'</div>'+rk+
        '<span class="mk">'+esc(C.mkName(p))+'</span>'+
        '<span class="nm" data-open="'+i+'" role="button" tabindex="0" title="押すと調べた内容が開きます">'+esc(p.name)+'</span>'+
        '</div></td>';
    })+'</tr>';
    h+='<tr class="sec">'+rh('price','1日の費用')+cells(function(r){
      if(r.day==null) return '<td class="c"><span class="v na">—</span></td>';
      return '<td class="c"><span class="v">'+yen(r.day)+'<small>円</small></span>'+
        '<div class="bar"><i style="width:'+logw(r.day,sDay.min,sDay.max)+'%"></i></div></td>';
    })+'</tr>';

    h+='<tr>'+rh('amt','1日に摂れる量', NUT.goalLabel+'に対する％')+cells(function(r){
      if(r.amt==null) return '<td class="c"><span class="v na">未取得</span></td>';
      var lo=Math.round((r.p.amtMin!=null?r.p.amtMin:r.amt)/GOAL*100), hi=Math.round(r.pct);
      var pctTxt=(lo===hi? lo.toLocaleString() : lo.toLocaleString()+'〜'+hi.toLocaleString())+'%';
      return '<td class="c'+(r.over?" over":"")+'"><span class="v">'+C.fmtAmtPlain(r.p)+'<small>'+UNIT+'</small></span>'+
        '<span class="oneline pct">'+pctTxt+'</span></td>';
    })+'</tr>';

    if(UL!=null && rows.some(function(r){ return r.over; })){
      h+='<tr><th class="rh">上限量<small>'+C.fdec(UL)+UNIT+'/日</small></th>'+cells(function(r){
        return r.over
          ? '<td class="c gc"><span class="tag warn">上限量に注意</span></td>'
          : '<td class="c gc"><span class="none">—</span></td>';
      })+'</tr>';
    }

    h+='<tr>'+rh('perGoal', NUT.goalLabel+'あたり', C.fdec(GOAL)+UNIT+'の費用')+cells(function(r){
      if(r.perGoal==null) return '<td class="c"><span class="v na">—</span></td>';
      return '<td class="c"><span class="v">'+yen(r.perGoal)+'<small>円</small></span>'+
        '<div class="bar"><i class="acc" style="width:'+logw(r.perGoal,sRDA.min,sRDA.max)+'%"></i></div></td>';
    })+'</tr>';

    h+='<tr class="sec"><th class="rh">1日の量</th>'+cells(function(r){
      return '<td class="c gc"><span class="oneline">'+esc(r.dose? r.dose+r.unit : "—")+'</span></td>';
    })+'</tr>';

    h+='<tr><th class="rh">剤形</th>'+cells(function(r){
      var v=r.p.form||"—";
      return '<td class="c gc"><span class="oneline" title="'+esc(v)+'">'+esc(v)+'</span></td>';
    })+'</tr>';

    h+='<tr><th class="rh">特徴</th>'+cells(function(r){
      var t="";
      (NUT.badges||[]).forEach(function(b){ if(C.chipTest(b,r.p)) t+='<span class="tag t1">'+esc(b.label)+'</span>'; });
      if(!C.isOnSale(r.p)) t+='<span class="tag end">販売終了</span>';
      return '<td class="c gc">'+(t||'<span class="none">—</span>')+'</td>';
    })+'</tr>';

    /* 基準値あたりの費用（栄養素をまたいで比べられる唯一の物差し） */


    /* 1日に摂れる量 ＋「基準値の◯%／◯倍」＝縦ビューと同じ表現 */

    /* 耐容上限がある栄養素だけ、警告の行を出す（ビタミンDで5商品が該当） */

    /* 特徴＝縦ビューのバッジと同じ NUT.badges 駆動 */


    /* 同梱成分の群。中身が1件も無い群は行ごと出さない（栄養素を変えても空行が並ばない） */
    var G=(NUT.ingGroups||[]).filter(function(g){
      return rows.some(function(r){ return r.ig[g.key] && r.ig[g.key].length; });
    });
    G.forEach(function(g,gi){
      h+='<tr'+(gi===0?' class="sec"':'')+'><th class="rh">'+esc(g.key)+'</th>'+cells(function(r){
        var v=r.ig[g.key];
        if(!v||!v.length) return '<td class="c gc"><span class="dot no">−</span></td>';
        return '<td class="c gc"><span class="dot" data-tip="'+esc(v.join("・"))+'">●</span></td>';
      })+'</tr>';
    });

    h+='<tr class="sec"><th class="rh">食品区分</th>'+cells(function(r){
      var l=(r.p.legal||"—").split("（")[0].split("(")[0];
      return '<td class="c gc"><span class="oneline" title="'+esc(r.p.legal||"")+'">'+esc(l)+'</span></td>';
    })+'</tr>';
    h+='<tr><th class="rh">詳しく見る</th>'+cells(function(r,i){
      return '<td class="c gc"><button class="openb" data-open="'+i+'">開く →</button></td>';
    })+'</tr>';

    /* 標準で横に9商品が収まる幅にする（2026-08-15竹森氏指示）。
       スクロールしていない状態で商品が半端に切れないよう、端数は左の項目名列に足す */
    var COLS=9, MINW=70, BASEW=110;
    var wrap=document.querySelector(".boardwrap");
    var lw=(window.innerWidth<=600?108:128);
    var avail=(wrap?wrap.clientWidth:1000)-lw;
    var fit=Math.max(1, Math.min(rows.length, COLS));
    var cw;
    if(rows.length<COLS){
      cw=BASEW;                                   /* 商品が少ないときは広げすぎない */
    } else {
      cw=Math.floor(avail/fit);
      if(cw<MINW){                                /* 画面が狭くて9列だと潰れる場合だけ列数を減らす */
        fit=Math.max(1, Math.floor(avail/MINW));
        cw=Math.floor(avail/fit);
      }
      lw += (avail - cw*fit);
    }
    var cg='<colgroup><col style="width:'+lw+'px">'+
      new Array(rows.length+1).join('<col style="width:'+cw+'px">')+'</colgroup>';
    bd.className="board"+(dense?" dense":"");
    bd.style.width=(lw+cw*rows.length)+"px";
    bd.innerHTML=cg+h;

    var hint=document.getElementById("bhint");
    if(hint) hint.textContent = rows.length+"商品を横に並べています。左の項目名は固定されているので、そのまま横にスクロールして見比べてください。";
  }

  /* ---- 一度だけの配線 ---- */
  var wired=false;
  function wire(ctx){
    if(wired) return; wired=true;
    var bd=document.getElementById("board");
    bd.addEventListener("mouseover", function(e){ var d=e.target.closest("[data-tip]"); if(d) showTip(d); });
    bd.addEventListener("mouseout",  function(e){ if(e.target.closest("[data-tip]")) hideTip(); });
    bd.addEventListener("touchstart", function(e){ var d=e.target.closest("[data-tip]"); if(d) showTip(d); }, {passive:true});
    bd.addEventListener("touchend", hideTip);
    bd.addEventListener("touchcancel", hideTip);
    var wrap=document.querySelector(".boardwrap");
    if(wrap) wrap.addEventListener("scroll", hideTip, {passive:true});
    window.addEventListener("scroll", hideTip, {passive:true});

    bd.addEventListener("click", function(e){
      var so=e.target.closest("th.sortable");
      if(so){ ctx.setSort(so.dataset.s); return; }
      var pk=e.target.closest("[data-pick]");
      if(pk){ ctx.togglePick(pk.dataset.pick); return; }
      var el=e.target.closest("[data-open]");
      if(el) openDetail(Number(el.dataset.open));
    });
    bd.addEventListener("keydown", function(e){
      if(e.key!=="Enter" && e.key!==" ") return;
      var so=e.target.closest("th.sortable");
      if(so){ e.preventDefault(); ctx.setSort(so.dataset.s); return; }
      var el=e.target.closest("[data-open]"); if(!el) return;
      e.preventDefault(); openDetail(Number(el.dataset.open));
    });

    var dlg=document.getElementById("dlg");
    if(dlg){
      dlg.addEventListener("click", function(e){
        if(e.target.classList.contains("dlgbd") || e.target.closest(".dlgx")){ closeDetail(); return; }
        var nav=e.target.closest("[data-nav]");
        if(nav) openDetail(viewIdx + Number(nav.dataset.nav));
      });
      document.addEventListener("keydown", function(e){
        if(dlg.hidden) return;
        if(e.key==="Escape") closeDetail();
        if(e.key==="ArrowLeft")  openDetail(viewIdx-1);
        if(e.key==="ArrowRight") openDetail(viewIdx+1);
      });
    }
    document.querySelectorAll("[data-dense]").forEach(function(b){
      b.addEventListener("click", function(){
        dense=(b.dataset.dense==="1");
        document.querySelectorAll("[data-dense]").forEach(function(x){ x.classList.toggle("on", x===b); });
        ctx.rerender();
      });
    });
    var rt; window.addEventListener("resize", function(){
      clearTimeout(rt); rt=setTimeout(function(){ if(!document.getElementById("boardview").hidden) ctx.rerender(); },150);
    });
  }

  return { render:function(items,ctx){ wire(ctx); render(items,ctx); }, close:closeDetail };
})();
