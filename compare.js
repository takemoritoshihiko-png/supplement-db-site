/* 比較ページ共通エンジン（正本: docs/PAGE-STRUCTURE-RULES.md）
   ページ側で window.NUT（栄養素設定）と PRODUCTS（データ）を定義してから読み込む */
(function(){
  var GOAL=NUT.goal, UL=NUT.ul, UNIT=NUT.unit, DEC=NUT.dec||0;
  var DIET=NUT.diet||null;
  var LSKEY="sdb-"+NUT.slug;
  var state = { view:"list", sort:"price", dir:1, f:{ onsale:true }, mk:"", ing:"", you:{sex:null,age:null}, picked:{}, open:{}, sharedView:false };
  (NUT.chips||[]).forEach(function(c){ state.f[c.f]=false; });
  try { var sv = JSON.parse(localStorage.getItem(LSKEY)||"{}"); if(sv.picked) state.picked=sv.picked; } catch(e){}
  try { var sy = JSON.parse(localStorage.getItem("sdb-you")||"{}"); if(sy.sex||sy.age){ state.you={sex:sy.sex||null, age:sy.age||null}; } } catch(e){}

  var ownKeys = pickedKeys(state.picked);
  applyHash();
  /* A5: 保存の分離（共有URL閲覧中は受け手のpickedを上書きしない） */
  function pickedKeys(o){ return Object.keys(o||{}).filter(function(k){ return o[k]; }).sort(); }
  function loadOwnPicked(){ try{ var s=JSON.parse(localStorage.getItem(LSKEY)||"{}"); return s.picked||{}; }catch(e){ return {}; } }
  function savePicked(){ if(state.sharedView) return; try{ localStorage.setItem(LSKEY, JSON.stringify({picked:state.picked})); }catch(e){} }
  function saveYou(){ try{ localStorage.setItem("sdb-you", JSON.stringify({sex:state.you.sex, age:state.you.age})); }catch(e){} }
  function toArr(v){ if(v==null) return []; return Array.isArray(v) ? v : [v]; }
  /* B21: URL状態共有 — 状態をハッシュに自動反映(共有URLで再現可能) */
  function applyHash(){
    var h=location.hash.replace(/^#/,''); if(!h) return;
    var q={}; h.split('&').forEach(function(kv){ var i=kv.indexOf('='); if(i>0) q[kv.slice(0,i)]=decodeURIComponent(kv.slice(i+1)); });
    if(q.view==='board') state.view='board';
    if(q.sex) state.you.sex=q.sex; if(q.age) state.you.age=q.age;
    if(q.ing) state.ing=q.ing; if(q.mk) state.mk=q.mk;
    if(q.sort){ var p=q.sort.split('.'); if(p[0]) state.sort=p[0]; state.dir=(p[1]==='d')?-1:1; }
    if(q.f!==undefined){ Object.keys(state.f).forEach(function(k){ state.f[k]=false; }); q.f.split(',').forEach(function(k){ if(k in state.f) state.f[k]=true; }); }
    if(q.p){
      var np={}; q.p.split(',').forEach(function(id){ if(id) np[id]=true; });
      /* 自分の保存リストと同じ内容（＝自分のURLの再読込）なら閲覧モードにしない */
      if(pickedKeys(np).join(',')!==ownKeys.join(',')) state.sharedView=true;
      state.picked=np;
    }
  }
  function updateHash(){
    var parts=[];
    if(state.view!=='list') parts.push('view='+state.view);
    if(state.you.sex) parts.push('sex='+state.you.sex);
    if(state.you.age) parts.push('age='+state.you.age);
    if(state.ing) parts.push('ing='+encodeURIComponent(state.ing));
    if(state.mk) parts.push('mk='+encodeURIComponent(state.mk));
    if(!(state.sort==='price'&&state.dir===1)) parts.push('sort='+state.sort+'.'+(state.dir===1?'a':'d'));
    var fs=Object.keys(state.f).filter(function(k){return state.f[k];});
    if(!(fs.length===1&&fs[0]==='onsale')) parts.push('f='+fs.join(','));
    var pids=Object.keys(state.picked).filter(function(k){return state.picked[k];});
    if(pids.length) parts.push('p='+pids.join(','));
    try{ history.replaceState(null,'', parts.length ? ('#'+parts.join('&')) : location.pathname+location.search); }catch(e){}
  }
  function fnum(x){ return (x>=1000)?x.toLocaleString():String(x); }
  function dietAvg(){ return (DIET && state.you.sex && state.you.age) ? DIET[state.you.sex][state.you.age] : null; }
  function fdec(x){ return DEC>0 ? x.toFixed(DEC) : fnum(Math.round(x)); }
  /* B1: 充足%が200%以上のときは「約◯.◯倍」表記に切り替える */
  function pctPair(min,max){
    if(Math.max(min,max)>=200){
      var a=(Math.round(min/10)/10).toFixed(1), b=(Math.round(max/10)/10).toFixed(1);
      return "約"+(a===b?a:a+"〜"+b)+"倍";
    }
    return "約"+(min===max?fnum(min):fnum(min)+"〜"+fnum(max))+"%";
  }
  /* A2: 列ヘッダーのsticky位置を絞り込みバーの実高に追従させる */
  function syncCtrlH(){
    var c=document.querySelector(".controls"); if(!c) return;
    var h=(window.innerWidth<=600)?0:c.offsetHeight;
    document.documentElement.style.setProperty("--ctrlh", h+"px");
  }
  /* A4: 下部バーの実高に合わせて本文下端の余白を調整する */
  function syncBarPad(){
    var b=document.getElementById("sumbar");
    var on=!!(b && b.classList.contains("show"));
    document.body.style.paddingBottom=(on ? b.offsetHeight+24 : 130)+"px";
  }
  /* DESIGN v1.0: 半円アークゲージ(pct=0〜100で弧が伸びる) */
  function gaugeSvg(pct,size,sw){
    var r=(size-sw-2)/2, c=size/2, h=c+sw/2+1, len=Math.PI*r;
    var f=Math.max(0,Math.min(1,pct/100));
    var x0=c-r, x1=c+r;
    var track='<path d="M'+x0+' '+c+' A '+r+' '+r+' 0 0 1 '+x1+' '+c+'" fill="none" stroke="var(--track)" stroke-width="'+sw+'" stroke-linecap="round"/>';
    var fill=f>0?'<path d="M'+x0+' '+c+' A '+r+' '+r+' 0 0 1 '+x1+' '+c+'" fill="none" stroke="var(--g2)" stroke-width="'+sw+'" stroke-linecap="round" stroke-dasharray="'+(len*f)+' '+(len+9)+'"/>':'';
    return '<svg class="gg" width="'+size+'" height="'+h+'" viewBox="0 0 '+size+' '+h+'" aria-hidden="true">'+track+fill+'</svg>';
  }
  function isDeadV(v){ return /販売終了|売り切れ|在庫切れ/.test(v.status||""); }
  function bestPrice(p){
    var best=null, sub=null;
    toArr(p.variants).forEach(function(v){
      if(isDeadV(v)) return;
      if(v.sub!=null && v.days!=null && v.days>0){ var s=v.sub/v.days; if(sub==null||s<sub) sub=s; }
      if(v.reg==null || v.days==null || v.days<=0) return;
      var d=v.reg/v.days;
      if(best==null || d<best.day) best={day:d};
    });
    if(best) best.sub=sub;
    return best;
  }
  /* 費用の幅(1日目安量が幅の商品はコスト幅で返す)+税抜/セール検知 */
  function costRange(p){
    var mn=null,mx=null,tax=false;
    toArr(p.variants).forEach(function(v){
      if(isDeadV(v)||v.reg==null) return;
      var a=null,b=null;
      if(v.qty!=null && p.doseMin!=null && p.doseMax!=null && p.doseMax!==p.doseMin){ a=v.reg*p.doseMin/v.qty; b=v.reg*p.doseMax/v.qty; }
      else if(v.days!=null && v.days>0){ a=v.reg/v.days; b=a; }
      else return;
      if(mn==null || a<mn){ mn=a; mx=b; tax=/税抜|セール/.test(v.note||""); }
    });
    return mn==null?null:{min:mn,max:mx,tax:tax};
  }
  function isOnSale(p){ return toArr(p.variants).some(function(v){ return (v.status||"").indexOf("販売中")>=0 || (v.status||"").indexOf("在庫あり")>=0; }); }
  function isChew(p){ return /グミ|チュアブル/.test(p.form||""); }
  function chipTest(c,p){
    if(c.kind==="flag") return p[c.field]===true;
    if(c.kind==="chew") return isChew(p);
    if(c.kind==="comp") return (p.comp||"").indexOf("単一")>=0;
    if(c.kind==="tech") return new RegExp(c.pattern).test(p.tech||"");
    if(c.kind==="legal") return new RegExp(c.pattern).test(p.legal||"");
    return false;
  }
  function mkName(p){
    return (p.maker||"").split("(")[0].split("（")[0]
      .replace(/(株式会社|有限会社|合同会社)/g,"").trim();
  }
  function dispUnit(u, p){
    u=u||"";
    if(p && isChew(p) && /粒|カプセル|錠|個/.test(u)) return "個";
    if(/カプセル|ソフトジェル|ソフトゼル|錠|タブレット|ベジ/.test(u)) return "粒";
    return u;
  }
  function formShort(p){
    var f=p.form||"";
    if(f.indexOf("未確認")>=0) return NUT.shortLabel;
    if(/グミ|チュアブル/.test(f)) return "グミ";
    if(/ソフト/.test(f)) return "ソフト";
    if(/カプセル/.test(f)) return "カプセル";
    if(/錠|タブレット/.test(f)) return "錠剤";
    if(/顆粒|粉|パウダー/.test(f)) return "粉末";
    if(/液|ジェル|ドロップ|オイル/.test(f)) return "液状";
    return NUT.shortLabel;
  }
  function fmtAmt(p){
    if(p.amtMin==null) return "未取得";
    var a=(p.amtMin===p.amtMax)?fnum(p.amtMin):(fnum(p.amtMin)+"〜"+fnum(p.amtMax));
    return a+UNIT;
  }
  /* 基準値(NUT.goal)あたりの費用。内容量も1日粒数もバラバラな商品を1つの物差しに揃える。
     栄養素が変われば goal も単位も変わるので、値は必ずここで計算して両ビューが共有する */
  function perGoal(p){
    var b=bestPrice(p);
    if(!b || p.amtMax==null || !p.amtMax) return null;
    return b.day/(p.amtMax/GOAL);
  }
  function fmtAmtPlain(p){
    if(p.amtMin==null) return "未取得";
    return (p.amtMin===p.amtMax)?fnum(p.amtMin):(fnum(p.amtMin)+"〜"+fnum(p.amtMax));
  }
  function findP(id){ for(var i=0;i<PRODUCTS.length;i++){ if(PRODUCTS[i].id===id) return PRODUCTS[i]; } return null; }

  /* 成分名の正規化（全栄養素共通辞書） */
  function canonOf(name){
    var n=(name||"").toLowerCase();
    if(/k2/.test(n)) return "ビタミンK2";
    if(/ボーンペップ/.test(n)) return "ボーンペップ(卵黄ペプチド)";
    if(/コラーゲン/.test(n)) return "コラーゲン";
    if(/cpp|ccp|cbp|ペプチド/.test(n)) return "ミルク由来ペプチド(CPP等)";
    if(/カルシウム|calcium/.test(n)) return "カルシウム";
    if(/マグネシウム|magnesium/.test(n)) return "マグネシウム";
    if(/乳酸菌/.test(n)) return "乳酸菌";
    if(/ビタミンk(?!2)|vitamin k(?!2)/.test(n)) return "ビタミンK";
    if(/葉酸|folic/.test(n)) return "葉酸";
    if(/^鉄|iron/.test(n)) return "鉄";
    if(/ビタミンc|vitamin c/.test(n)) return "ビタミンC";
    if(/ビタミンd|vitamin d|v\.d/.test(n)) return "ビタミンD";
    if(/亜鉛|zinc/.test(n)) return "亜鉛";
    if(/b12/.test(n)) return "ビタミンB12";
    if(/b1(?!2)/.test(n)) return "ビタミンB1";
    if(/b2/.test(n)) return "ビタミンB2";
    if(/b6/.test(n)) return "ビタミンB6";
    if(/サーモンオイル|亜麻仁|dha|epa|omega|オメガ/.test(n)) return "オメガ3系オイル";
    if(/カリウム|potassium/.test(n)) return "カリウム";
    if(/ナトリウム|sodium/.test(n)) return "ナトリウム";
    if(/メチオニン/.test(n)) return "メチオニン";
    if(/ルチン|ヘスペリジン|ビタミンp/.test(n)) return "ビタミンP(ルチン・ヘスペリジン)";
    if(/ナイアシン/.test(n)) return "ナイアシン";
    if(/パントテン酸/.test(n)) return "パントテン酸";
    if(/ローズヒップ/.test(n)) return "ローズヒップ";
    if(/ヒアルロン酸/.test(n)) return "ヒアルロン酸";
    if(/セラミド/.test(n)) return "セラミド";
    if(/エラスチン/.test(n)) return "エラスチン";
    if(/プロテオグリカン/.test(n)) return "プロテオグリカン";
    if(/銅/.test(n)) return "銅";
    return (name||"").split("(")[0].split("（")[0].trim();
  }
  function nutTags(p){
    var set={};
    (NUT.ingFallbacks||[]).forEach(function(fb){ if(p[fb.flagField]) set[fb.tag]=1; });
    toArr(p.ings).forEach(function(g){ var c=canonOf(g.n); if(c) set[c]=1; });
    return set;
  }
  PRODUCTS.forEach(function(p){ p._nut=nutTags(p); });
  function nutAmt(p, tag){
    var min=0, max=0, unit="", found=false;
    toArr(p.ings).forEach(function(g){
      if(canonOf(g.n)!==tag) return;
      if(g.a1==null&&g.a2==null){ found=true; return; }
      min+=(g.a1!=null?g.a1:g.a2)||0; max+=(g.a2!=null?g.a2:g.a1)||0; unit=g.u||unit; found=true;
    });
    (NUT.ingFallbacks||[]).forEach(function(fb){
      if(tag===fb.tag && !unit && p[fb.amtField]!=null){ min=p[fb.amtField]; max=p[fb.amtField]; unit=fb.unit; found=true; }
    });
    if(!found) return null;
    if(!unit && min===0 && max===0) return {min:null,max:null,unit:""};
    return {min:min,max:max,unit:unit};
  }
  function fmtNut(na){
    if(!na||na.min==null) return '<span style="color:var(--ink3);font-size:12px">配合量未取得</span>';
    var v=(na.min===na.max)?na.min:(na.min+"〜"+na.max);
    return '<b>'+v+na.unit+'</b>';
  }

  function renderSum(){
    var bar=document.getElementById("sumbar");
    var ids=Object.keys(state.picked).filter(function(k){return state.picked[k] && findP(k);});
    if(ids.length===0){ bar.classList.remove("show"); bar.classList.remove("expanded"); syncBarPad(); return; }
    bar.classList.add("show");
    var sMin=0,sMax=0,otherNote=0,naNote=0;
    ids.forEach(function(id){ var p=findP(id); if(!p) return; if(p.amtMax==null){ naNote++; return; } sMin+=p.amtMin; sMax+=p.amtMax; if((p.others||0)>0||toArr(p.ings).length>0) otherNote++; });
    var diet=dietAvg();
    var totMin=sMin+(diet||0), totMax=sMax+(diet||0);
    var pctMin=Math.round(totMin/GOAL*100), pctMax=Math.round(totMax/GOAL*100);
    var over=(UL!=null)&&(totMax>=UL);
    var verdict, cls;
    if(over){ verdict="⚠️ 耐容上限("+fnum(UL)+UNIT+"/成人)に達します — この組み合わせは摂りすぎに注意"; cls="warn"; }
    else if(totMin>=GOAL){ verdict="✓ "+NUT.goalLabel+"("+fdec(GOAL)+UNIT+")を満たします"+(UL!=null?"（耐容上限"+fnum(UL)+UNIT+"との差 約"+fdec(UL-totMax)+UNIT+"）":""); cls="ok"; }
    else { verdict=NUT.goalLabel+"まであと約"+fdec(GOAL-totMin)+UNIT; cls=""; }
    var dietTxt=(diet!=null)?("食事(平均) "+diet+UNIT+" ＋ "):"";
    var rMin=Math.round(totMin*10)/10, rMax=Math.round(totMax*10)/10;
    var totTxt=(rMin===rMax)?(fnum(rMin)+UNIT):(fnum(rMin)+"〜"+fnum(rMax)+UNIT);
    var plist='';
    ids.forEach(function(id){ var p=findP(id); if(!p) return;
      var bp=bestPrice(p);
      plist+='<div class="pli"><button class="plx" data-id="'+id+'" aria-label="リストから外す">✕</button><span class="pln">'+p.name+'</span><span class="plm">'+mkName(p)+'</span><span class="pla">'+fmtAmt(p)+'/日</span>'+(bp?'<span class="pla">約'+(Math.round(bp.day*10)/10)+'円/日</span>':'')+'</div>';
    });
    document.getElementById('picklist').innerHTML=plist;
    var cMin=0, cMax=0, costMiss=0, taxN=0;
    ids.forEach(function(id){ var p=findP(id); if(!p) return; var cr=costRange(p); if(cr){ cMin+=cr.min; cMax+=cr.max; if(cr.tax) taxN++; } else costMiss++; });
    function fy(x){ return (Math.round(x*10)/10).toLocaleString(); }
    var costCore = cMin>0 ? '費用 <b>約'+(Math.round(cMin)===Math.round(cMax)?fy(cMin):fy(cMin)+'〜'+fy(cMax))+'円/日</b>' : (costMiss?'費用 —':'');
    var costNotes=[];
    if(costMiss) costNotes.push('価格未取得'+costMiss+'品を除く');
    if(taxN) costNotes.push('税抜'+taxN+'品を含む');
    var costTxt = costCore ? '　｜　'+costCore+(costNotes.length?'<span style="font-size:10.5px;color:var(--ink3)">（'+costNotes.join('・')+'）</span>':'') : '';
    /* A1: スマホ用のコンパクト1行 */
    var cpTxt='飲む予定リスト '+ids.length+'品　・　合計 '+totTxt;
    if(cMin>0) cpTxt+='　・　約'+(Math.round(cMin)===Math.round(cMax)?fy(cMin):fy(cMin)+'〜'+fy(cMax))+'円/日';
    var cpMark=(cls==="warn")?"⚠":(cls==="ok"?"✓":"");
    document.getElementById("sumcompact").innerHTML =
      '<span class="ct">'+cpTxt+'</span>'+(cpMark?'<span class="cv '+cls+'">'+cpMark+'</span>':'')
      +'<span class="cx">'+(bar.classList.contains("expanded")?"▾":"▴")+'</span>';
    document.getElementById("sumline").innerHTML =
      '<a href="javascript:void(0)" id="pltoggle">飲む予定リスト '+ids.length+'品 '+(document.getElementById("picklist").classList.contains("open")?"▾":"▴")+'</a>　｜　'+dietTxt+'サプリの'+NUT.name+'合計 '+(sMin===sMax?fnum(sMin):fnum(sMin)+"〜"+fnum(sMax))+UNIT+' ＝ <b>1日合計 '+totTxt+'</b>'
      +'（'+NUT.goalLabel+'の'+pctPair(pctMin,pctMax)+'）'+costTxt+'　<span class="verdict '+cls+'">'+verdict+'</span>';
    var viz=document.getElementById("sumbarviz");
    var scale=(UL!=null)?Math.max(UL, totMax):Math.max(GOAL, totMax);
    viz.classList.toggle("over", over);
    viz.querySelector(".diet").style.width=((diet||0)/scale*100)+"%";
    viz.querySelector(".supp").style.left=((diet||0)/scale*100)+"%";
    viz.querySelector(".supp").style.width=(sMax/scale*100)+"%";
    viz.querySelector(".goalmark").style.left=(GOAL/scale*100)+"%";
    var note;
    if(DIET){
      note = (diet==null?"上の「1日に必要な栄養素」で性別・年代を選ぶと、食事の平均摂取分も足して判定します。":"食事分は公的統計の平均値です（あなた自身の食事ではありません）。")
        + " バーの緑線＝"+NUT.goalLabel+fdec(GOAL)+UNIT+"・右端＝"+fnum(scale)+UNIT+(scale===UL?"（耐容上限）":"")+"。"+(UL==null?(NUT.sumStaticNote||""):"");
    } else {
      note = "バーの緑線＝"+NUT.goalLabel+fdec(GOAL)+UNIT+"・右端＝"+fnum(scale)+UNIT+"。"+(NUT.sumStaticNote||"");
    }
    if(otherNote>0) note += " 選択には"+NUT.name+"以外の配合成分を含む商品があります（他成分の合算は今後対応）。";
    if(naNote>0) note += " 選択には"+NUT.name+"量が未取得の商品があり、合算に含まれていません。";
    document.getElementById("sumnote").textContent=note;
    syncBarPad();
  }

  function detailHtml(p){
    var h='';
    h+='<div class="how" style="margin-top:0"><b>配合成分の量（1日目安量あたり）:</b> '+NUT.name+' '+fmtAmt(p)
      +(toArr(p.ings).length?('　'+toArr(p.ings).map(function(g){
        var v=(g.a1==null)?'量未確認':((g.a1===g.a2?g.a1:g.a1+'〜'+g.a2)+(g.u||''));
        return g.n+' '+v;
      }).join('　')):'（'+NUT.name+'のみ）')+'</div>';
    var packs="", seen={}, refOnly=0, buyable=0;
    toArr(p.variants).forEach(function(v){
      if(v.qty==null && v.reg==null && !v.note) return;
      var key=(v.qty==null?"x":v.qty)+"-"+(v.reg==null?"x":v.reg);
      if(seen[key]) return; seen[key]=1;
      var days=v.days!=null?"・約"+v.days+"日分":"";
      var seller=v.seller?("["+v.seller.split("(")[0]+"] "):"";
      var isRef = /参考|希望小売|定価/.test(v.seller||"");
      var hasUrl = v.url && v.url.indexOf("http")===0 && !isRef;
      if(isRef) refOnly++;
      var tagO = hasUrl ? '<a href="'+v.url+'" target="_blank" rel="noopener" class="pack' : '<span class="pack';
      var tagC = hasUrl ? ' ↗</a>' : '</span>';
      if(hasUrl) buyable++;
      if(v.reg!=null){
        var per=(v.days!=null)?'<span class="per">→1日 約'+(Math.round(v.reg/v.days*10)/10)+'円</span>':'';
        packs+=tagO+'">'+seller+(v.qty!=null?v.qty+(v.unit||""):"")+days+' <b>'+v.reg.toLocaleString()+'円</b>'+(v.sub!=null?'/定期'+v.sub.toLocaleString()+'円':'')+per+(v.note?'<span class="per">'+v.note+'</span>':'')+tagC;
      } else { packs+=tagO+' na">'+seller+(v.qty!=null?v.qty+(v.unit||""):"")+days+' '+(v.note||"価格未取得")+tagC; }
    });
    if(packs!=="") h+='<div class="how" style="margin-top:10px"><b>買う（容量ごとの価格）:</b>'+(refOnly?'<span class="per">リンクが無いものは、メーカーが示した価格や販売ページ未取得のため、その値段で買えるとは限りません</span>':'')+'</div><div class="buyline" style="margin-top:6px">'+packs+'</div>';
    if(!buyable) h+='<div class="how" style="color:var(--warn)">この商品は、表示している価格で買える販売ページをまだ確認できていません。</div>';
    if(p.intake) h+='<div class="how"><b>メーカーの飲み方（原文）:</b> 「'+p.intake+'」</div>';
    var prof=[];
    if(p.cert) prof.push('製造・認証: '+p.cert);
    if(p.legal && p.legal.indexOf('未確認')<0) prof.push('食品区分: '+p.legal.split('(')[0]);
    if(p.tech) prof.push('製剤技術: '+p.tech);
    if(p.target) prof.push('対象者: '+p.target);
    if(p.allergen) prof.push('アレルギー物質: '+p.allergen);
    if(p.animal) prof.push('動物由来原料: '+p.animal);
    if(prof.length) h+='<div class="how"><b>品質・仕様:</b> '+prof.join('　/　')+'</div>';
    if(p.raw) h+='<div class="how" style="font-size:12px"><b>原材料名（原文）:</b> '+p.raw+'</div>';
    if(p.caution) h+='<div class="how" style="font-size:12px"><b>パッケージの注意書き（抜粋）:</b> '+p.caution+'</div>';
    h+='<div class="meta">この内容の出どころ（買う場所ではありません）: <a href="'+p.url+'" target="_blank" rel="noopener">'+mkName(p)+'の公式ページ ↗</a>　確認日 '+NUT.confirm+'</div>';
    return h;
  }
  /* A5: 共有URLで開いたときの閲覧モードバナー */
  function renderSharedBanner(){
    var el=document.getElementById("sharedbanner"); if(!el) return;
    if(!state.sharedView){ el.style.display="none"; el.innerHTML=""; return; }
    el.style.display="";
    el.innerHTML='<span class="sbt">🔗 共有されたリストを表示しています（あなたの保存リストには影響しません）</span>'
      +'<button type="button" id="sbadopt">自分のリストに取り込む</button>'
      +'<button type="button" id="sbclose">共有リストを閉じる</button>';
  }
  function render(){
    var items=PRODUCTS.slice();
    if(state.f.onsale) items=items.filter(isOnSale);
    (NUT.chips||[]).forEach(function(c){ if(state.f[c.f]) items=items.filter(function(p){ return chipTest(c,p); }); });
    if(state.mk) items=items.filter(function(p){return mkName(p)===state.mk;});
    if(state.ing) items=items.filter(function(p){return p._nut[state.ing];});
    items.forEach(function(p){ p._bp=bestPrice(p); p._na=state.ing?nutAmt(p,state.ing):null; });
    if(state.sort==="perGoal") items.sort(function(a,b){var x=perGoal(a),y=perGoal(b);return ((x==null?1e9:x)-(y==null?1e9:y))*state.dir;});
    if(state.sort==="price") items.sort(function(a,b){var x=a._bp?a._bp.day:1e9,y=b._bp?b._bp.day:1e9;return (x-y)*state.dir;});
    if(state.sort==="amt"){
      if(state.ing){
        items.sort(function(a,b){var x=(a._na&&a._na.max!=null)?a._na.max:-1,y=(b._na&&b._na.max!=null)?b._na.max:-1;return (y-x)*state.dir;});
      } else {
        items.sort(function(a,b){var x=(a.amtMax==null)?-1:a.amtMax,y=(b.amtMax==null)?-1:b.amtMax;return (y-x)*state.dir;});
      }
    }
    document.querySelector('th[data-s="amt"] .tl').textContent = state.ing ? (state.ing+"/日") : (NUT.name+"/日");
    document.querySelector('th[data-s="price"] .tl').textContent = state.ing ? "価格/日(商品全体)" : "価格/日";
    var inote=document.getElementById("ingnote");
    if(state.ing){
      inote.style.display="";
      inote.innerHTML='「<b>'+state.ing+'</b>」で絞り込み中 — 「'+state.ing+'/日」列は各商品の'+state.ing+'の量です。<b>価格/日は'+NUT.name+'商品全体の価格</b>で、'+state.ing+'だけの単価ではありません。';
    } else { inote.style.display="none"; }
    document.getElementById("count").textContent=items.length+"件 / 全"+PRODUCTS.length+"件";
    /* ここまでが両ビュー共通（絞り込み・並び替え・件数）。以降は描き方だけが違う */
    var lv=document.getElementById("listview"), bv=document.getElementById("boardview");
    if(lv&&bv){ lv.hidden=(state.view==="board"); bv.hidden=(state.view!=="board"); }
    document.querySelectorAll("[data-view]").forEach(function(x){ x.classList.toggle("on", x.dataset.view===state.view); });
    if(state.view==="board" && window.BoardView){
      BoardView.render(items, boardCtx());
      renderSharedBanner(); renderSum(); updateHash(); syncCtrlH(); return;
    }
    var el=document.getElementById("list"); el.innerHTML="";
    var bestId=null, bestDay=Infinity;
    PRODUCTS.forEach(function(p){ if(!isOnSale(p)) return; var b=bestPrice(p); if(b&&b.day<bestDay){ bestDay=b.day; bestId=p.id; } });
    items.forEach(function(p){
      var bp=p._bp, on=!!state.picked[p.id], op=!!state.open[p.id];
      var pg=perGoal(p);
      var pct=(p.amtMax!=null)?Math.round(p.amtMax/GOAL*100):null;
      var pctTxt=(pct==null)?null:pctPair(Math.round(p.amtMin/GOAL*100), pct);
      var tags="";
      if(p.id===bestId) tags+='<span class="b best">価格/日 最安</span>';
      (NUT.badges||[]).forEach(function(bg){ if(chipTest(bg,p)) tags+='<span class="b '+(bg.cls||'')+'">'+bg.label+'</span>'; });
      if(UL!=null && p.amtMax!=null && p.amtMax>=UL) tags+='<span class="b warn">上限量に注意</span>';
      if(!isOnSale(p)) tags+='<span class="b end">販売終了・在庫切れ</span>';
      var ingNames=toArr(p.ings).map(function(g){ return (g.n||"").split("(")[0].split("（")[0].replace("ビタミン","").replace("Vitamin ","").trim(); }).filter(function(n){return n;});
      var ingTxt="";
      if(ingNames.length){
        var shown=ingNames.slice(0,4).join("・");
        ingTxt='<span class="ingline">＋'+shown+(ingNames.length>4?"・他"+(ingNames.length-4):"")+'</span>';
      }
      var bv=null;
      toArr(p.variants).forEach(function(v){ if(v.reg!=null&&v.days!=null){ if(bv==null||v.reg/v.days<bv.reg/bv.days) bv=v; } });
      var packCell;
      var fl=formShort(p); fl=(fl===NUT.shortLabel)?"":("・"+fl);
      if(bv){
        packCell=(bv.qty!=null?bv.qty+dispUnit(bv.unit,p):"")+' <b>'+bv.reg.toLocaleString()+'円</b><span class="sub">約'+bv.days+'日分'+fl+((bv.note||"").indexOf("税抜")>=0?"・税抜":"")+((bv.note||"").indexOf("セール")>=0?"・セール価格":"")+'</span>';
      } else {
        var v0=toArr(p.variants)[0];
        /* 統一ルール: 行セルは定型短句のみ(長文の注記は詳細行に置く) */
        var sn=(v0&&v0.note)?(v0.note.indexOf("オープン価格")>=0?"オープン価格":(v0.note.indexOf("海外専売")>=0?"国内価格なし":((v0.note.indexOf("米国")>=0||v0.note.indexOf("日本価格未取得")>=0)?"日本価格未取得":"価格未取得"))):"価格未取得";
        if(v0&&v0.reg!=null){ packCell=(v0.qty!=null?v0.qty+dispUnit(v0.unit,p):"")+' <b>'+v0.reg.toLocaleString()+'円</b><span class="sub">'+(v0.days!=null?("約"+v0.days+"日分"):"日数は詳細参照")+fl+'</span>'; }
        else packCell=(v0&&v0.qty!=null)?(v0.qty+dispUnit(v0.unit,p)+'<span class="sub">'+sn+fl+'</span>'):'<span style="color:var(--ink3);font-size:12px">'+sn+'</span>';
      }
      var doseCell=(p.doseMin!=null)
        ? (p.doseMin===p.doseMax?p.doseMin:p.doseMin+"〜"+p.doseMax)+dispUnit(p.doseUnit||"粒",p)
        : '<span style="color:var(--ink3)">未確認</span>';
      var doseShort=(p.doseMin!=null)?((p.doseMin===p.doseMax?p.doseMin:p.doseMin+"〜"+p.doseMax)+dispUnit(p.doseUnit||"粒",p)+"/日"):"";
      var amtShort;
      if(state.ing){
        var na=p._na;
        amtShort=state.ing+" "+((na&&na.min!=null)?((na.min===na.max?na.min:na.min+"〜"+na.max)+na.unit):"未取得");
      } else { amtShort=fmtAmt(p)+((pctTxt!=null)?'（'+pctTxt+'）':''); }
      packCell+='<span class="m-extra">'+(doseShort?"・"+doseShort:"")+"・"+amtShort+((pg!=null&&!state.ing)?("・"+NUT.goalLabel+"あたり約"+((pg<10)?(Math.round(pg*10)/10).toFixed(1):Math.round(pg))+"円"):"")+'</span>';
      var amtCell;
      if(state.ing){
        amtCell=fmtNut(p._na!==undefined?p._na:nutAmt(p,state.ing));
      } else {
        amtCell=(p.amtMin!=null)
          ? '<b>'+fmtAmt(p)+'</b><span class="pc">'+NUT.goalLabel+'の'+pctTxt+'</span>'
          : '<span style="color:var(--ink3)">未取得</span>';
      }
      var goalCell = (pg!=null)
        ? '<b>約'+((pg<10)?(Math.round(pg*10)/10).toFixed(1):Math.round(pg))+'円</b>'
        : '<span style="color:var(--ink3)">—</span>';
      var priceCell = bp
        ? '<b>約'+(Math.round(bp.day*10)/10)+'円</b>'+(bp.sub!=null?'<span class="sb">定期 約'+(Math.round(bp.sub*10)/10)+'円</span>':'')
        : '<span style="color:var(--ink3)">—</span>';
      el.innerHTML+='<tr class="main'+(on?' sel':'')+'" data-id="'+p.id+'">'
        +'<td class="pcol"><button class="addb'+(on?' on':'')+'" data-id="'+p.id+'" title="飲む予定リストに入れる">'+(on?'✓':'＋')+'</button></td>'
        +'<td class="prod"><div class="prodflex"><div class="thumb">'+(p.img?'<img src="'+p.img+'" alt="'+p.name+'" loading="lazy">':formShort(p))+'</div><div><span class="mk2">'+mkName(p)+'</span><div class="nm2">'+p.name+'</div><div class="rowchips">'+tags+ingTxt+'</div></div></div></td>'
        +'<td class="num packc">'+packCell+'</td>'
        +'<td class="num dosec">'+doseCell+'</td>'
        +'<td class="num amtc'+(!state.ing&&UL!=null&&p.amtMax!=null&&p.amtMax>=UL?' ul':'')+'">'+amtCell+'</td>'
        +'<td class="num goalc">'+goalCell+'</td>'
        +'<td class="num pricec">'+priceCell+'</td>'
        +'<td class="chev">'+(op?'▴':'▾')+'</td></tr>'
        +'<tr class="detail'+(op?' open':'')+'" data-for="'+p.id+'"><td colspan="8">'+detailHtml(p)+'</td></tr>';
    });
    el.querySelectorAll(".addb").forEach(function(b){
      b.addEventListener("click", function(ev){
        ev.stopPropagation();
        state.picked[b.dataset.id]=!state.picked[b.dataset.id];
        savePicked(); render();
      });
    });
    el.querySelectorAll("tr.main").forEach(function(tr){
      tr.addEventListener("click", function(){
        state.open[tr.dataset.id]=!state.open[tr.dataset.id];
        render();
      });
    });
    el.querySelectorAll("tr.detail").forEach(function(tr){
      tr.addEventListener("click", function(e){
        if(e.target.closest("a")) return;
        state.open[tr.dataset.for]=false;
        render();
      });
    });
    renderSharedBanner();
    renderSum();
    updateHash();
  }
  /* 横ビューへ渡す文脈。board.js は独自にデータを触らず、この窓口だけを使う */
  function boardCtx(){
    return {
      NUT:NUT, GOAL:GOAL, UL:UL, UNIT:UNIT, state:state,
      bestPrice:bestPrice, perGoal:perGoal, chipTest:chipTest, isOnSale:isOnSale,
      mkName:mkName, dispUnit:dispUnit, fmtAmtPlain:fmtAmtPlain, fdec:fdec, fnum:fnum,
      pctPair:pctPair, detailHtml:detailHtml,
      togglePick:function(id){ state.picked[id]=!state.picked[id]; savePicked(); render(); },
      rerender:render
    };
  }
  function buildMk(){
    var sel=document.getElementById("mksel"), names={};
    PRODUCTS.forEach(function(p){ names[mkName(p)]=1; });
    Object.keys(names).sort().forEach(function(n){
      var o=document.createElement("option"); o.value=n; o.textContent=n; sel.appendChild(o);
    });
    sel.addEventListener("change", function(){ state.mk=sel.value; sel.classList.toggle("on", !!sel.value); render(); });
  }
  function buildIng(){
    var sel=document.getElementById("ingsel"), counts={};
    PRODUCTS.forEach(function(p){ Object.keys(p._nut).forEach(function(n){ counts[n]=(counts[n]||0)+1; }); });
    Object.keys(counts).sort(function(a,b){ return counts[b]-counts[a] || a.localeCompare(b,"ja"); }).forEach(function(n){
      var o=document.createElement("option"); o.value=n; o.textContent=n+"（"+counts[n]+"件）"; sel.appendChild(o);
    });
    sel.addEventListener("change", function(){
      state.ing=sel.value; sel.classList.toggle("on", !!sel.value);
      var noIng = !sel.value;
      var chipBox=document.getElementById("dchips");
      if(chipBox) chipBox.style.display = noIng ? "" : "none";
      if(!noIng){
        (NUT.chips||[]).forEach(function(c){
          if(c.persist) return;
          state.f[c.f]=false;
          var cb=document.querySelector('.controls input[data-f="'+c.f+'"]'); if(cb) cb.checked=false;
        });
      }
      render();
    });
  }
  function renderYou(){
    document.querySelectorAll("#youbtns button").forEach(function(b){
      b.classList.toggle("on", state.you[b.dataset.k]===b.dataset.v);
    });
    var el=document.getElementById("youstat");
    document.getElementById("youbtns").style.display = DIET ? "" : "none";
    var d=dietAvg();
    var mb='<span class="mbar"><i></i><i></i><i class="a"></i><i class="t"></i></span>';
    var tiles='<div class="stt"><div class="l">'+NUT.goalLabelFull+(NUT.goalSuffix||"")+'</div><div class="v">'+fdec(GOAL)+'<small>'+UNIT+'/日</small></div>'+mb+'</div>';
    if(DIET){
      if(d!=null){
        var gap=GOAL-d;
        tiles+='<div class="stt"><div class="l">あなたの年代の平均摂取（令和5年調査）</div><div class="v">'+fdec(d)+'<small>'+UNIT+'/日</small></div>'+mb+'</div>';
        tiles+= gap>0
          ? '<div class="stt gap"><div><div class="l">'+NUT.goalLabel+'まで</div><div class="v">あと'+fdec(gap)+'<small>'+UNIT+'</small></div></div>'+gaugeSvg(d/GOAL*100,58,8)+'</div>'
          : '<div class="stt ok2"><div class="l">'+NUT.goalLabel+'との比較</div><div class="v" style="font-size:16px">達しています</div></div>';
      } else {
        tiles+='<div class="stt"><div class="l">あなたの年代の平均摂取</div><div class="v" style="font-size:13.5px;color:var(--ink3);font-weight:700">上の性別・年代を選ぶと表示されます</div></div>';
      }
    }
    var caveat = DIET
      ? (d!=null ? '' : (NUT.youUnselectedText||''))
      : (NUT.youStaticText||'');
    el.innerHTML='<div class="statgrid">'+tiles+'</div>'+(caveat?'<div class="caveat">'+caveat+'</div>':'');
  }
  document.getElementById("youbtns").addEventListener("click", function(e){
    var b=e.target.closest("button"); if(!b) return;
    state.you[b.dataset.k]=(state.you[b.dataset.k]===b.dataset.v)?null:b.dataset.v;
    saveYou(); renderYou(); render();
  });
  function syncMsort(){
    document.querySelectorAll("#msort button").forEach(function(b){
      var on=b.dataset.s===state.sort;
      b.classList.toggle("on", on);
      if(!b.dataset.label) b.dataset.label=b.textContent.replace(/ [▲▼]$/,"");
      b.textContent=b.dataset.label+(on?(state.dir===1?" ▲":" ▼"):"");
    });
  }
  document.querySelectorAll("#msort button").forEach(function(b){
    b.addEventListener("click", function(){
      if(state.sort===b.dataset.s){ state.dir=-state.dir; } else { state.sort=b.dataset.s; state.dir=1; }
      document.querySelectorAll("th.sortable").forEach(function(x){
        x.classList.toggle("on",x.dataset.s===state.sort);
        x.querySelector(".arr").textContent=(x.dataset.s===state.sort)?(state.dir===1?"▲":"▼"):"";
      });
      syncMsort(); render();
    });
  });
  document.querySelectorAll("th.sortable").forEach(function(th){
    th.addEventListener("click", function(){
      if(state.sort===th.dataset.s){ state.dir=-state.dir; } else { state.sort=th.dataset.s; state.dir=1; }
      syncMsort();
      document.querySelectorAll("th.sortable").forEach(function(x){
        x.classList.toggle("on",x.dataset.s===state.sort);
        x.querySelector(".arr").textContent = (x.dataset.s===state.sort) ? (state.dir===1?"▲":"▼") : "";
      });
      render();
    });
  });
  document.querySelectorAll(".flt input").forEach(function(i){
    i.addEventListener("change", function(){ state.f[i.dataset.f]=i.checked; render(); });
  });
  /* B5: 「すべて外す」は2段階（1回目=武装・3秒で解除、2回目=実行） */
  var clearBtn=document.getElementById("clearpick"), clearTid=null;
  function disarmClear(){ if(clearTid){ clearTimeout(clearTid); clearTid=null; } clearBtn.classList.remove("arm"); clearBtn.textContent="すべて外す"; }
  clearBtn.addEventListener("click", function(){
    if(!clearBtn.classList.contains("arm")){
      clearBtn.classList.add("arm"); clearBtn.textContent="もう一度押すと全て外します";
      if(clearTid) clearTimeout(clearTid);
      clearTid=setTimeout(disarmClear, 3000);
      return;
    }
    disarmClear();
    state.picked={}; savePicked(); render();
  });
  document.getElementById("sumbar").addEventListener("click", function(ev){
    var t=ev.target;
    if(t.id==="pltoggle"){ var pl=document.getElementById("picklist"); var open=pl.classList.toggle("open"); t.textContent=t.textContent.replace(open?"▴":"▾", open?"▾":"▴"); }
    if(t.classList.contains("plx")){ state.picked[t.dataset.id]=false; savePicked(); render(); var pl2=document.getElementById("picklist"); if(pl2&&Object.keys(state.picked).some(function(k){return state.picked[k];})) pl2.classList.add("open"); }
    /* A1: スマホの畳み／展開トグル */
    if(t.id==="sumcompact"||t.closest("#sumcompact")){ document.getElementById("sumbar").classList.toggle("expanded"); renderSum(); }
  });
  document.querySelectorAll("[data-view]").forEach(function(b){
    b.addEventListener("click", function(){ state.view=b.dataset.view; render(); });
  });
  buildMk(); buildIng();
  /* URL/保存状態をUIへ反映 */
  (function(){
    var isel=document.getElementById('ingsel'); if(state.ing){ isel.value=state.ing; isel.classList.add('on'); var box=document.getElementById('dchips'); if(box) box.style.display='none'; }
    var msel=document.getElementById('mksel'); if(state.mk){ msel.value=state.mk; msel.classList.add('on'); }
    document.querySelectorAll('.flt input').forEach(function(i){ i.checked=!!state.f[i.dataset.f]; });
    document.querySelectorAll('th.sortable').forEach(function(x){
      var on=x.dataset.s===state.sort; x.classList.toggle('on',on);
      x.querySelector('.arr').textContent=on?(state.dir===1?'▲':'▼'):'';
    });
    syncMsort();
    var sb=document.getElementById('sharebtn');
    if(sb) sb.addEventListener('click', function(){
      var t=sb.textContent;
      (navigator.clipboard?navigator.clipboard.writeText(location.href):Promise.reject()).then(function(){ sb.textContent='コピーしました ✓'; setTimeout(function(){ sb.textContent=t; },1500); },function(){ prompt('このURLをコピーしてください', location.href); });
    });
  })();
  /* A5: バナーの操作 */
  (function(){
    var el=document.getElementById("sharedbanner"); if(!el) return;
    el.addEventListener("click", function(ev){
      var t=ev.target;
      if(t.id==="sbadopt"){
        state.sharedView=false; savePicked(); ownKeys=pickedKeys(state.picked); render();
      } else if(t.id==="sbclose"){
        state.picked=loadOwnPicked(); state.sharedView=false; ownKeys=pickedKeys(state.picked); render();
      }
    });
  })();
  /* A2/A4: 幅・高さの変化に追従 */
  window.addEventListener("resize", function(){ syncCtrlH(); syncBarPad(); });
  renderYou(); render();
  syncCtrlH(); syncBarPad();
})();
