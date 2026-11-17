'use strict';

const {resources, streets, survey, arrivals=[]} = window.YULIN_DATA;
const studyRoute = window.buildStudyRouting(streets,[...resources,...arrivals]);
const byId = new Map(resources.map(resource => [resource.id, resource]));
const arrivalModes = {walk:'直接到第 1 站',metro:'地铁',bus:'公交',taxi:'打车'};
const colors = {
  咖啡馆:'#b44308', 书店:'#087642', 餐饮:'#d3222d', 服饰店:'#007da3',
  街巷与广场:'#8b30c6', 特色街区:'#a66300', 小吃与甜点:'#c71979', 交通站点:'#263fce'
};
const categories = Object.keys(colors);
const symbols = ['咖','书','食','衣','景','街','甜','站'];
const symbol = cat => symbols[categories.indexOf(cat)];
const moods = {
  随便逛逛:[], 吃点好的:['餐饮','小吃与甜点','咖啡馆'], 拍照出片:['街巷与广场','特色街区'],
  逛街购物:['服饰店','特色街区'], 探索小店:['书店','咖啡馆','服饰店'], 慢慢放松:['咖啡馆','书店','街巷与广场']
};
const times = {'1 小时':60,'2 小时':120,'3 小时':180,'半日':240,'一日':480};
const routeData = [
  {id:'art',name:'文艺老街',tags:'街巷 · 咖啡 · 书店',summary:'从芳草街的一杯咖啡出发，留些时间逛书店和街巷。',tone:'#286b68',tint:'#d7e6d9',art:'heart',icon:'book',stops:['p01','p09','p12','p13']},
  {id:'food',name:'美食烟火',tags:'面馆 · 川菜 · 火锅',summary:'从街坊面馆逛到玉林小吃街，按自己的口味挑几站。',tone:'#a33c17',tint:'#ffdcbf',art:'swirl',icon:'food',stops:['p20','p18','p16','p37','p15']},
  {id:'photo',name:'小众打卡',tags:'服饰 · 广场 · 街角',summary:'逛逛特色服饰店，再去附近广场和街角随手拍。',tone:'#775410',tint:'#f8e5a8',art:'smile',icon:'camera',stops:['p23','p25','p27','p33','p36']},
  {id:'all',name:'玉林全景漫游',tags:'综合路线 · 半日或一日',summary:'沿玉林—芳草街的调研范围慢慢走，看街巷、社区与沿街小店。',tone:'#87441d',tint:'#f7e5c2',icon:'map',stops:['p01','p09','p02','p27','p13','p20','p37','p15','p29']}
];
const routes = new Map(routeData.map(route => [route.id, route]));
const iconPaths = {
  book:'<path d="M12 6c-3-3-7-3-10-2v15c3-1 7-1 10 2 3-3 7-3 10-2V4c-3-1-7-1-10 2zm0 0v15"/>',
  food:'<path d="M3 13h18c-1 5-5 8-9 8s-8-3-9-8zm4 8h10M8 10c0-2 2-2 2-4M13 10c0-2 2-3 2-6M18 10l3-7"/>',
  camera:'<path d="M3 7h4l2-3h6l2 3h4v13H3z"/><circle cx="12" cy="13" r="4"/>',
  map:'<path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2zm6-2v16m6-14v16"/>',
  arrow:'<path d="M4 12h15m-6-6 6 6-6 6"/>'
};
const icon = (name, size = 20) => `<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${iconPaths[name]}</svg>`;
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const $ = selector => document.querySelector(selector);
const key = 'yulin-walk-v5';
let saved = {};
try { saved = JSON.parse(localStorage.getItem(key) || '{}') || {}; } catch {}
const planIds = Array.isArray(saved.plan) ? saved.plan.filter(id => byId.has(id)) : [];
const state = {
  plan:[...new Set(planIds)],
  stopTarget:Number.isInteger(saved.stopTarget)?Math.min(resources.length,Math.max(0,saved.stopTarget)):0,
  arrivalMode:Object.hasOwn(arrivalModes,saved.arrivalMode)?saved.arrivalMode:'walk',
  arrivalId:arrivals.some(p=>p.id===saved.arrivalId)?saved.arrivalId:'',
  planName:typeof saved.planName==='string'?saved.planName.trim().slice(0,60):'',
  draft:[], options:[], option:0,
  tags:new Set(Array.isArray(saved.tags) ? saved.tags.filter(tag => categories.includes(tag)) : []),
  interests:Array.isArray(saved.interests)?[...new Set(saved.interests.filter(x=>x in moods && x!=='随便逛逛'))]:[],
  clothing:['women','trend'].includes(saved.clothing)?saved.clothing:'',
  time:Object.hasOwn(times,saved.time) ? saved.time : '2 小时',
  mapCategories:new Set(categories), query:'', mapRoute:'', onlyPlan:false,
  selected:null, reference:'', viewport:null, skipped:new Map()
};

const visitTime = resource => resource.visitMinutes ?? '待估算';
const addLabel = id => state.plan.includes(id) ? '✓ 已加入' : '＋ 加入计划';
const arrow = icon('arrow',17);
const photos = window.YULIN_PHOTOS;
function streetPhoto(point) {
  let options = photos;
  if (point) {
    const area = /芳草|芳华|芳沁|蓝草|蓓蕾/.test(point.address) ? 'fangcao' :
      /玉林东|倪家桥|人民南/.test(point.address) ? 'east' : '';
    const nearby = photos.filter(photo=>photo.file.startsWith(area || 'yulin-street'));
    if (nearby.length) options=nearby;
  }
  const index = point ? Number(point.id.slice(1)) % options.length : 0;
  const photo = options[index];
  if (!photo) return '';
  return `<figure class="street-photo"><img src="assets/${photo.file}" alt="成都${photo.label}街景" loading="lazy"><figcaption>附近街景 · ${photo.label}<br><a href="${photo.page}" target="_blank" rel="noopener noreferrer">TurnOnTheNight</a> · <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener noreferrer">CC BY-SA 4.0</a> · 2024 年拍摄，缩放版</figcaption></figure>`;
}
const badge = text => `<span class="badge">${text}</span>`;
const btn = (label, href, primary = false) => `<a class="btn${primary?' primary':''}" href="${href}">${label}</a>`;
const action = (label, id, value='', classes='') => `<button class="btn ${classes}" type="button" data-action="${id}" data-value="${value}">${label}</button>`;
const status = '历史记录 · 待核验';
let toastTimer;
function notify(message) {
  clearTimeout(toastTimer);
  $('#toast').textContent = message;
  toastTimer = setTimeout(() => $('#toast').textContent = '', 2600);
}
function persist() {
  if (!state.plan.length) state.planName='';
  $('#count').textContent = state.plan.length;
  try {
    localStorage.setItem(key,JSON.stringify({plan:state.plan,planName:state.planName,stopTarget:state.stopTarget,arrivalMode:state.arrivalMode,arrivalId:state.arrivalId,tags:[...state.tags],interests:state.interests,clothing:state.clothing,time:state.time}));
    return true;
  } catch { return false; }
}
function heading(title, description, tools = '') {
  return `<div class="page-heading"><div><h1>${title}</h1><p>${description}</p></div>${tools}</div>`;
}
function routeCard(route) {
  return `<a href="#route/${route.id}" class="route-card" style="--tone:${route.tone};--tint:${route.tint}">
    <div class="route-art"><span class="route-icon">${icon(route.icon)}</span><img src="assets/${route.art}.webp" alt=""></div>
    <div class="route-card-content flex items-center justify-between gap-3"><div><h3>${route.name}</h3><p class="muted">${route.tags}</p></div><span class="card-arrow">${arrow}</span></div>
  </a>`;
}
function routeCards() {
  const panorama = routes.get('all');
  return `<div class="route-grid">${routeData.slice(0,3).map(routeCard).join('')}</div>
    <a class="panorama" href="#route/all"><img src="assets/van.webp" alt=""><div><h3>${panorama.name}</h3><p class="muted">${panorama.tags}</p></div><span class="card-arrow">${arrow}</span></a>`;
}
function home() {
  return `<section class="hero">
    <div class="hero-copy">
      <div class="kicker">成都街巷漫步指南</div>
      <h1>玉林<span>漫游</span></h1>
      <span class="hero-english" lang="en">YULIN WALK</span>
      <p>挑你想逛的地点，放进同一份清单，出门前就知道下一站去哪。</p>
      <div class="actions flex flex-wrap">${btn('开始选地点 '+arrow,'#filter',true)}</div>
      <small class="hero-steps">选兴趣 → 看推荐路线 → 保存行程</small>
    </div>
    <div class="collage" aria-hidden="true">
      <img class="swirl" src="assets/swirl.webp" alt="">
      <img class="van" src="assets/van.webp" alt="">
      <img class="look" src="assets/look.webp" alt="">
      <img class="arrow" src="assets/arrow.webp" alt="">
      <img class="heart" src="assets/heart.webp" alt="">
    </div>
    <div class="location"><span class="location-mark"></span> 四川成都 · 玉林—芳草街</div>
  </section>`;
}
function choice(name,value,selected,type='radio') {
  return `<label class="choice"><input type="${type}" name="${name}" value="${value}" ${selected?'checked':''}><span>${value}</span></label>`;
}
function preferredTags() {
  return [...new Set([...state.tags,...state.interests.flatMap(interest=>moods[interest])])];
}
const showsClothing = () => state.tags.has('服饰店') || state.interests.includes('逛街购物');
function clothingFit(point) {
  if (point.category!=='服饰店'||!showsClothing()||!state.clothing) return true;
  if (/男装|海澜之家/i.test(point.name)) return false;
  return state.clothing==='women'
    ? /女装|女裤/.test(point.name)
    : /欧韩|潮牌|潮流|街头|买手|集合店/.test(point.name);
}
function matches(point) {
  const tags=preferredTags();
  return (!tags.length||tags.includes(point.category))&&clothingFit(point);
}
function stay(point) {
  return ({'服饰店':[5,12],'书店':[8,20],'餐饮':[20,45],'咖啡馆':[10,25],'小吃与甜点':[5,12],'街巷与广场':[5,15],'特色街区':[8,20],'交通站点':[2,5]})[point.category]||[5,15];
}
function stayTotal(ids) {
  return ids.reduce(([a,b],id)=>{const [min,max]=stay(byId.get(id));return [a+min,b+max];},[0,0]);
}
function interestsPanel() {
  return `<div class="chips">${Object.keys(moods).filter(name=>name!=='随便逛逛').map(name=>{
    const i=state.interests.indexOf(name);
    return `<button type="button" class="btn" data-action="interest" data-value="${name}" aria-pressed="${i>=0}">${i>=0?`${i+1}. `:''}${name}</button>`;
  }).join('')}</div>
  <p class="map-caption">可选一项或多项。未选择时推荐周边地点。</p>
  ${state.interests.map((name,i)=>`<div class="rank-row"><span>${i+1}. ${name}</span><button type="button" class="btn small" data-action="rank-up" data-value="${name}" ${i===0?'disabled':''} aria-label="上移${name}">↑</button><button type="button" class="btn small" data-action="rank-down" data-value="${name}" ${i===state.interests.length-1?'disabled':''} aria-label="下移${name}">↓</button></div>`).join('')}`;
}
function filterSummary() {
  const tags = preferredTags();
  return `<p><strong>${state.interests.join(' → ')||'随便逛逛'}</strong> · ${state.time}</p><p>${tags.length ? tags.join('、') : '全部类别'}</p>
    <p><strong>${resources.filter(matches).length}</strong> 个历史资源匹配</p>
    ${times[state.time]>=240?'<p><a class="text-link" href="#route/all">看看玉林全景漫游 →</a></p>':''}`;
}
function filter() {
  return `${heading('今天想怎么逛？','选择兴趣和可用时间，先生成一份可以调整的漫游草案。')}
  <div class="two-col">
    <form class="panel" id="filters">
      <fieldset><legend>今天想做什么？</legend><div id="interest-order">${interestsPanel()}</div></fieldset>
      <fieldset><legend>感兴趣的资源 <small class="muted">（可多选）</small></legend><div class="chips">${categories.map(tag=>choice('tag',tag,state.tags.has(tag),'checkbox')).join('')}</div><p class="muted text-sm mt-2">兴趣和资源标签都可影响推荐。</p></fieldset>
      <fieldset id="clothing-options" ${showsClothing()?'':'hidden disabled'}><legend>逛服饰店时，你更想看什么？ <small>（可跳过）</small></legend>
        <select id="clothing" class="control" aria-label="服饰偏好">${[['','随便看看'],['women','女装 · 名称明确标注'],['trend','潮流 / 欧韩 · 按名称筛选']].map(([value,label])=>`<option value="${value}" ${value===state.clothing?'selected':''}>${label}</option>`).join('')}</select>
        <p class="map-caption">女装和潮流选项按店名筛选，只影响服饰店推荐。</p>
      </fieldset>
      <fieldset><legend>你有多少时间？</legend><div class="chips">${Object.keys(times).map(time=>choice('time',time,time===state.time)).join('')}</div></fieldset>
      <fieldset><legend>想逛多少站？ <small>（可选）</small></legend>
        <div id="stop-target-field">${stopTargetField()}</div>
      </fieldset>
      <div class="actions flex flex-wrap">${action('生成漫游草案 '+arrow,'suggest','','primary')}${action('直接浏览地图','explore')}${action('重置选择','reset')}</div>
    </form>
    <aside class="panel"><h2>当前选择</h2><div id="filter-summary" aria-live="polite">${filterSummary()}</div></aside>
  </div>`;
}
function stopCost(point) { return stay(point)[1]; }
function routeBudget() { return Math.floor(times[state.time]*.75); }
function draftCandidates() {
  return resources.filter(point=>matches(point)&&point.category!=='交通站点'&&point.xy)
    .sort((a,b)=>stopCost(a)-stopCost(b));
}
function feasibleCount(candidates=draftCandidates(),budget=routeBudget()) {
  let count=0;
  for (const point of candidates) {
    budget-=stopCost(point);
    if (budget<0) break;
    count++;
  }
  return count;
}
function stopTargetField() {
  const max=feasibleCount();
  const selected=Math.min(state.stopTarget,max);
  const options=Array.from({length:max},(_,i)=>`<option value="${i+1}" ${selected===i+1?'selected':''}>${i+1} 站</option>`);
  return `<label class="control-label" for="stop-target">目标站数</label>
    <select class="control" id="stop-target" ${max?'':'disabled'} aria-describedby="stop-target-help">
      <option value="0">${max?'自动安排':'暂无可安排站点'}</option>${options.join('')}
    </select>
    <p id="stop-target-help" class="map-caption" aria-live="polite">${max?`按当前兴趣和时间，可选 ${max===1?'1 站':`1–${max} 站`}。`:'请调整兴趣、服饰偏好或可用时间。'} 按建议停留上限估算，预留四分之一时间给步行。</p>`;
}
function syncStopTarget() {
  state.stopTarget=Math.min(state.stopTarget,feasibleCount());
  $('#stop-target-field').innerHTML=stopTargetField();
}
function draftOptions() {
  const candidates=draftCandidates();
  const exact=Math.min(state.stopTarget,feasibleCount(candidates));
  const limit=exact||candidates.length;
  if (!candidates.length) return [];
  const rankedCategory=category=>{
    const index=state.interests.findIndex(name=>moods[name].includes(category));
    return index<0?state.interests.length:index;
  };
  const center=candidates.reduce(([x,y],p)=>[x+p.xy[0]/candidates.length,y+p.xy[1]/candidates.length],[0,0]);
  const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
  const results=[];
  for (const [title, origin, rankWeight, diversity] of [
    ['兴趣优先',center,115,30],['少绕路',center,22,15],['多逛几类',[center[0]+90,center[1]],42,95]
  ]) {
    const ids=[], seen=new Set();
    let remaining=routeBudget(), position=origin;
    while (ids.length<limit) {
      const available=candidates.filter(point=>!ids.includes(point.id));
      const after=exact ? exact-ids.length-1 : 0;
      // Reserve enough budget for the cheapest remaining stops before ranking the next stop.
      const cheapest=available.slice(0,after).reduce((total,p)=>total+stopCost(p),0);
      const nextCheapest=available[after];
      const pool=available.filter((point,index)=>{
        const cost=stopCost(point);
        const reserved=index<after ? cheapest-cost+stopCost(nextCheapest) : cheapest;
        return cost+reserved<=remaining;
      });
      if (!pool.length) break;
      const score=p=>distance(position,p.xy)+rankWeight*rankedCategory(p.category)+(seen.has(p.category)?diversity:0);
      pool.sort((a,b)=>score(a)-score(b));
      const next=pool[0];
      ids.push(next.id);seen.add(next.category);remaining-=stopCost(next);position=next.xy;
    }
    if (ids.length&&!results.some(x=>x.ids.join()===ids.join())) results.push({title,ids});
  }
  return results;
}
function fitDraft(ids) {
  const points=ids.map(id=>byId.get(id).xy);
  const approach=arrivalStop(ids);
  if (approach) points.push(approach.xy,...(studyRoute(approach.id,ids[0])||[]));
  ids.slice(1).forEach((id,i)=>points.push(...(studyRoute(ids[i],id)||[])));
  if (!points.length) return baseView;
  const xs=points.map(p=>p[0]), ys=points.map(p=>p[1]);
  const minX=Math.min(...xs), maxX=Math.max(...xs), minY=Math.min(...ys), maxY=Math.max(...ys);
  const width=Math.min(720,Math.max(135,maxX-minX+74,(maxY-minY+82)*720/620));
  const height=width*620/720;
  return [(minX+maxX-width)/2,(minY+maxY-height)/2,width,height];
}
function draftPage() {
  const ids=state.draft;
  const minutes=stayTotal(ids).join('–');
  const tags=preferredTags();
  return `${heading('推荐漫游草案','按你的兴趣和时间先选几站。点站名看详情，去掉不想逛的站，再保存行程。',btn('调整兴趣','#filter'))}
    <div class="two-col">
      <section class="panel">
        <h2>选择路线</h2>
        <div class="chips">${state.options.map((option,i)=>`<button type="button" class="btn" data-action="draft-option" data-value="${i}" aria-pressed="${state.option===i}">${option.title} · ${option.ids.length} 站</button>`).join('')}</div>
        <p class="map-caption">${escape(tags.join(' · ')||'探索周边')} · ${state.time}预算 · ${minutes} 分钟建议停留</p>
        ${state.stopTarget>ids.length?`<p class="note">按当前预算和偏好推荐 ${ids.length} / ${state.stopTarget} 站，可增加时间或放宽偏好。</p>`:''}
        ${ids.length?ids.map((id,i)=>{
          const point=byId.get(id);
          return `<div class="list-row"><span class="order">${i+1}</span><div class="row-text">${action(escape(point.name),'detail',id,'stop-detail')}<small>${point.category} · ${escape(point.address)} · ${stay(point).join('–')} 分钟停留</small></div>${action('移出','omit',id,'small')}</div>`;
        }).join(''):'<p class="empty">当前偏好和时间下没有找到合适的停靠点，可调整兴趣、服饰偏好或时长。</p>'}
        <div class="actions flex flex-wrap mt-4">${ids.length?action('保存这份行程 '+arrow,'save-draft','','primary'):''}${action('重新生成','suggest')}${btn('自己去地图挑','#map')}</div>
      </section>
      <aside class="panel">
        ${arrivalPanel(ids)}
        <h2>草案地图</h2>
        ${mapBox()}
        <p class="map-caption">建议优先选相近的地点，并给步行留出时间。停留合计未计入步行。</p>
        ${walkingSegments(ids)}
      </aside>
    </div>`;
}
function mapBox(interactive=true) {
  return `<div class="mapbox">
    <div class="map-label">GIS 街区规划图 · 非导航</div>
    <svg id="street-map" viewBox="0 0 720 620" aria-label="玉林街道规划图" ${interactive?'':'role="img"'}></svg>
    ${interactive?`<div class="map-controls">${[['+','zoom-in','放大'],['−','zoom-out','缩小'],['⌂','zoom-reset','重置地图视图']].map(([sym,id,label])=>`<button type="button" aria-label="${label}" data-action="${id}">${sym}</button>`).join('')}</div>`:''}
  </div>`;
}
const mapPanels = {filters:{visible:true,width:225},detail:{visible:true,width:250}};
function panelButton(key,label) {
  const visible=mapPanels[key].visible;
  return `<button type="button" class="btn small" data-action="toggle-panel" data-value="${key}" aria-expanded="${visible}" aria-controls="map-${key}-pane">${visible?'收起':'展开'}${label}</button>`;
}
function mapPage() {
  return `${heading('玉林资源探索地图','点击点位即可打开详情。想先看看怎么走，可以按兴趣生成草案。',btn('按兴趣生成草案','#filter',true))}
    <div class="map-toolbar" aria-label="地图面板">
      ${panelButton('filters','筛选')}${panelButton('detail','地点详情')}
    </div>
    <div class="map-layout map-adjustable" style="--filter-width:${mapPanels.filters.visible?mapPanels.filters.width:0}px;--detail-width:${mapPanels.detail.visible?mapPanels.detail.width:0}px">
      <div class="map-pane map-filter-pane" id="map-filters-pane" ${mapPanels.filters.visible?'':'hidden'}>
      <aside class="panel">
        <h2>资源筛选</h2>
        <div id="category-actions" class="category-actions">${action('全选','all-cats','','small')}${action('清空','no-cats','','small')}</div>
        <div class="map-categories">${categories.map(cat=>`<label class="check"><input type="checkbox" name="map-cat" value="${cat}" ${state.mapCategories.has(cat)?'checked':''}><span class="dot" style="--dot:${colors[cat]}"></span>${cat}</label>`).join('')}</div>
        <div class="map-mode" id="map-mode">
          ${action('浏览地点','browse-map','','small')}${action(`我的计划（${state.plan.length}）`,'plan-map','','small')}
        </div>
        <label class="control-label" for="map-search">搜索地点或地址</label><input id="map-search" class="control" type="search" placeholder="如：书店、玉林西路" value="${escape(state.query)}">
        <label class="control-label" for="map-route">查看主题停靠点</label>
        <select id="map-route" class="control"><option value="">全部地点</option>${routeData.map(route=>`<option value="${route.id}" ${state.mapRoute===route.id?'selected':''}>${route.name}</option>`).join('')}</select>
        <p id="map-result" class="map-caption" aria-live="polite"></p><div class="resource-list" id="resource-list"></div>
        <div class="mt-3">${btn('查看我的计划 '+arrow,'#plan')}</div>
      </aside>
      <button type="button" class="pane-resize" data-resize="filters" aria-label="调整筛选栏宽度（左右方向键）"></button>
      </div>
      <div class="map-center">
        ${mapBox()}
        <p class="map-caption" id="map-caption">街道来自调研 GIS 图层。点位来自历史 POI，出发前请复核。</p>
        <div id="map-legend" class="map-legend" aria-label="点位图例"></div>
        <div id="map-arrival"></div><div id="map-walking"></div>
      </div>
      <div class="map-pane map-detail-pane" id="map-detail-pane" ${mapPanels.detail.visible?'':'hidden'}>
        <button type="button" class="pane-resize" data-resize="detail" aria-label="调整详情栏宽度（左右方向键）"></button>
        <aside class="panel map-detail" id="point-detail" aria-live="polite"></aside>
      </div>
    </div>`;
}
const baseView = [0,0,720,620];
function streetLayer() {
  const labels = new Set(['一环路南三段','永丰路','二环路南三段','玉林西路','玉林东路','玉林南路','芳草街','芳草东街','玉林中路','倪家桥路','人民南路四段']);
  const named = streets.filter(street=>labels.has(street.name));
  return `<rect width="720" height="620" fill="#eae8d9"/>
    <g fill="none" stroke-linecap="round" stroke-linejoin="round">
    ${streets.map(street=>`<path d="${street.d}" stroke="#cbc6b6" stroke-width="${/环路|人民南路/.test(street.name)?13:7}"/>`).join('')}
    ${streets.map(street=>`<path d="${street.d}" stroke="#fffdf6" stroke-width="${/环路|人民南路/.test(street.name)?10:5}"/>`).join('')}
    </g>
    <g fill="#615c4c" font-size="11" stroke="#f6f3e7" stroke-width="3" paint-order="stroke">${named.map(street=>`<text x="${street.xy[0]+6}" y="${street.xy[1]-4}">${escape(street.name)}</text>`).join('')}</g>`;
}
const mapBaseMarkup = streetLayer();
function mapRedraw({route,detail=false,customIds} = {}) {
  const svg = $('#street-map');
  if (!svg) return;
  if (!streets.length || typeof SVGSVGElement === 'undefined') {
    svg.hidden = true;
    const label = $('.map-label');
    if (label) label.textContent = '底图不可用，请使用资源列表';
    return;
  }
  const routeIds = customIds ?? (route?.stops.filter(id=>!state.skipped.get(route.id)?.has(id)) || []);
  const orderedIds = state.onlyPlan && !detail ? state.plan : routeIds;
  const order = new Map(orderedIds.map((id,i)=>[id,i+1]));
  const possible = detail ? routeIds.map(id=>byId.get(id)).filter(Boolean) : resources.filter(available);
  const priority = resource => (matches(resource)?1:0) + (order.has(resource.id)?2:0) + (resource.id===state.selected?4:0);
  const markers = possible.filter(resource=>resource.xy).sort((a,b)=>priority(a)-priority(b)).map(resource=>{
    const [x,y] = resource.xy;
    const active = !detail && state.selected===resource.id;
    const number = order.get(resource.id);
    const dim = !detail && !state.onlyPlan && !active && !number && !matches(resource);
    const radius = active ? 14 : number ? 12 : dim ? 6 : 10;
    const saved = !detail && !state.onlyPlan && state.plan.includes(resource.id);
    return `<g transform="translate(${x} ${y})" class="marker ${active?'active':''} ${dim?'dim':''}" ${detail?'':`role="button" tabindex="0" aria-haspopup="dialog" aria-label="${escape(resource.name)} · ${resource.category}" aria-pressed="${active}" data-action="point" data-value="${resource.id}"`}>
      <circle r="14" fill="transparent"/><circle class="pin" r="${radius}" fill="${colors[resource.category]}"/><text text-anchor="middle" y="3.6">${number || symbol(resource.category)}</text>${saved?'<circle cx="8" cy="-8" r="3.5" fill="#236b47" stroke="white"/>':''}
    </g>`;
  }).join('');
  const journey = customIds || (!detail && state.onlyPlan ? state.plan : null);
  const layout = journey ? state.viewport || fitDraft(journey) : detail ? baseView : state.viewport || baseView;
  svg.setAttribute('viewBox',layout.join(' '));
  const drawnIds = state.onlyPlan&&!detail ? state.plan : route?.id!=='all' ? routeIds : [];
  const segments = drawnIds.slice(1).map((id,i)=>studyRoute(drawnIds[i],id)).filter(points=>points?.length>1);
  const lines = segments.map(points=>`<polyline data-study-route points="${points.map(point=>point.join(',')).join(' ')}" class="study-route"/>`).join('');
  const approach=journey && arrivalStop(journey);
  const approachPoints=approach && studyRoute(approach.id,journey[0]);
  const entry=approach ? `<g class="arrival-pin" transform="translate(${approach.xy.join(' ')})"><title>起步点：${escape(approach.name)}</title><circle r="11"/><text text-anchor="middle" y="4">起</text></g>` : '';
  const approachLine=approachPoints?.length>1 ? `<polyline class="arrival-line" points="${approachPoints.map(p=>p.join(',')).join(' ')}"/>` : '';
  svg.innerHTML = mapBaseMarkup +
    (route?.id==='all'&&survey&&!(!detail&&state.onlyPlan) ? `<path data-survey d="${survey}" fill="none" stroke="#b3430d" stroke-width="3.4" opacity=".76" stroke-linecap="round" stroke-linejoin="round"/>` : '') + lines + approachLine + markers + entry;
}
function available(resource) {
  if (state.onlyPlan) return state.plan.includes(resource.id);
  const route = routes.get(state.mapRoute);
  if (route) return route.stops.includes(resource.id) && !state.skipped.get(route.id)?.has(resource.id);
  const query = state.query.trim().toLowerCase();
  return state.mapCategories.has(resource.category) && (!query || [resource.name,resource.address,resource.category].some(text=>text?.toLowerCase().includes(query)));
}
function renderMap() {
  if (state.onlyPlan && !state.plan.length) state.onlyPlan=false;
  const availableResources = state.onlyPlan ? state.plan.map(id=>byId.get(id)) : resources.filter(available);
  const route = routes.get(state.mapRoute);
  const ordered = state.onlyPlan || Boolean(route);
  const planMode=$('[data-action="plan-map"]');
  planMode.textContent=`我的计划（${state.plan.length}）`;
  planMode.setAttribute('aria-pressed',String(state.onlyPlan));
  $('[data-action="browse-map"]').setAttribute('aria-pressed',String(!state.onlyPlan));
  $('#category-actions').hidden=ordered;
  document.querySelectorAll('input[name="map-cat"]').forEach(input=>input.disabled=ordered);
  const matched = ordered ? availableResources : availableResources.filter(matches);
  const previous = byId.get(state.selected);
  if (!previous || !available(previous) || (state.preferMatch && matched.length && !matched.includes(previous))) state.selected = (matched[0] || availableResources[0])?.id ?? null;
  state.preferMatch=false;
  $('#map-result').textContent = ordered ? `${availableResources.length} 个${state.onlyPlan?'已加入地点':'主题停靠点'}` : `${matched.length} 个兴趣匹配 · ${availableResources.length} 个可见`;
  $('#map-arrival').innerHTML = state.onlyPlan ? arrivalPanel(state.plan) : '';
  $('#map-walking').innerHTML = ordered ? walkingSegments(availableResources.map(resource=>resource.id)) : '';
  const listing = [...matched,...availableResources.filter(resource=>!matched.includes(resource))];
  $('#resource-list').innerHTML = listing.length ? listing.map((resource,i)=>`<button type="button" data-action="point" data-value="${resource.id}" aria-pressed="${resource.id===state.selected}"><span class="map-key" style="--dot:${colors[resource.category]}">${ordered?i+1:symbol(resource.category)}</span><span>${escape(resource.name)}${state.plan.includes(resource.id)?' ✓':''}</span></button>`).join('') : '<p class="map-caption">没有找到地点。试试清除搜索或恢复类别。</p>';
  if (!matched.length) $('#resource-list').insertAdjacentHTML('beforebegin','<div id="empty-map">'+action('清除筛选','clear-map','','small')+'</div>');
  $('#map-legend').innerHTML = ordered
    ? `<span>数字表示${state.onlyPlan?'清单':'主题'}停靠顺序</span>${!state.onlyPlan&&route.id==='all'?'<span><i class="legend-line"></i>历史调研轨迹</span>':''}`
    : categories.map(cat=>`<span><i class="map-key" style="--dot:${colors[cat]}">${symbol(cat)}</i>${cat}</span>`).join('');
  $('#map-caption').textContent = ordered ? '蓝线沿调研街道绘制，仅供规划参考。实际步行请打开上方分段导航。' : '深色点匹配当前兴趣，浅色点仍可查看。历史点位请在出发前复核。';
  const point = byId.get(state.selected);
  $('#point-detail').innerHTML = point ? pointCard(point) : '<h2>资源详情</h2><p class="muted">恢复类别筛选或先添加地点，即可在这里查看资源。</p>';
  mapRedraw({route});
}
function openPoint(id) {
  const point=byId.get(id);
  if (!point) return;
  const dialog=$('#stop-dialog');
  $('#stop-dialog-content').innerHTML=pointCard(point);
  if (!dialog.open) dialog.showModal();
}
function pointCard(point) {
  const hasCoordinates = point.gcj?.every(Number.isFinite) && point.address;
  const mapURL = hasCoordinates ? 'https://uri.amap.com/marker?position='+point.gcj.join(',')+'&name='+encodeURIComponent(point.name)+'&coordinate=gaode' : '';
  return `
    <h2>${escape(point.name)}</h2>${badge(escape(point.category))} ${badge(status)}
    <p><strong>记录地址</strong><br>${escape(point.address || '待补充')}</p>
    <p><strong>建议停留</strong> ${stay(point).join('–')} 分钟</p>
    ${preferredTags().includes(point.category)?`<p class="stop-match">符合所选兴趣 · ${point.category}</p>`:''}
    ${action(addLabel(point.id),'add',point.id,'primary')}
    ${hasCoordinates?`<a class="btn small" target="_blank" rel="noopener noreferrer" href="${escape(mapURL)}">在高德地图查看 ↗</a>`:''}
    ${point.address?action('复制地址','copy',point.id,'small'):''}
    <p class="muted">来源：玉林调研 POI</p>
    <div class="area-photo">${streetPhoto(point)}</div>`;
}
function walkingHref(from,to) {
  const params=new URLSearchParams({from:[...from.gcj,from.name].join(','),to:[...to.gcj,to.name].join(','),mode:'walk',src:'yulinwalk'});
  return 'https://uri.amap.com/navigation?'+params;
}
function arrivalChoices(ids) {
  if (!ids.length||!['metro','bus'].includes(state.arrivalMode)) return [];
  const first=byId.get(ids[0]);
  const distance=stop=>Math.hypot(stop.xy[0]-first.xy[0],stop.xy[1]-first.xy[1]);
  return arrivals.filter(stop=>stop.mode===state.arrivalMode).sort((a,b)=>distance(a)-distance(b));
}
function arrivalStop(ids) {
  const choices=arrivalChoices(ids);
  return choices.find(stop=>stop.id===state.arrivalId)||choices[0];
}
function arrivalPanel(ids) {
  if (!ids.length) return '';
  const first=byId.get(ids[0]);
  const stop=arrivalStop(ids);
  const choices=arrivalChoices(ids);
  const markerParams=new URLSearchParams({position:first.gcj.join(','),name:first.name,coordinate:'gaode',src:'yulinwalk'});
  return `<section class="arrival-panel" aria-label="到达起点">
    <h3>怎么到玉林</h3>
    <label class="control-label" for="arrival-mode">到达方式</label>
    <select id="arrival-mode" class="control">${Object.entries(arrivalModes).map(([mode,label])=>`<option value="${mode}" ${state.arrivalMode===mode?'selected':''}>${label}</option>`).join('')}</select>
    ${choices.length?`<label class="control-label" for="arrival-stop">${state.arrivalMode==='metro'?'地铁站和出口':'下车公交站'}</label>
    <select id="arrival-stop" class="control"><option value="">推荐：${escape(choices[0].name)}</option>${choices.map(p=>`<option value="${p.id}" ${p.id===state.arrivalId?'selected':''}>${escape(p.name)}</option>`).join('')}</select>
    <p class="map-caption">按首站的直线距离推荐出口或站点。线路经停与出口开放情况请出发前核对。</p>`:''}
    ${stop?`<a class="btn small" href="${escape(walkingHref(stop,first))}" target="_blank" rel="noopener noreferrer">从${escape(stop.name)}走到第 1 站 ↗</a>`:
    state.arrivalMode==='taxi'?`<div class="first-stop"><span class="order">1</span><div><strong>${escape(first.name)}</strong><p>${escape(first.address||'可按地点名称搜索')}</p></div></div>
    <div class="arrival-actions">${first.address?action('复制首站地址','copy',first.id,'small'):''}<a class="btn small" href="https://uri.amap.com/marker?${escape(markerParams)}" target="_blank" rel="noopener noreferrer">在高德打开 ↗</a></div>`:
    `<p class="map-caption">从 ${escape(first.name)} 开始。</p>`}
  </section>`;
}
function walkingSegments(ids) {
  const links = ids.slice(1).map((id,i)=>{
    const from = byId.get(ids[i]);
    const to = byId.get(id);
    if (!from?.gcj?.every(Number.isFinite) || !to?.gcj?.every(Number.isFinite)) return '';
    return `<li><a class="walk-card" href="${escape(walkingHref(from,to))}" target="_blank" rel="noopener noreferrer">
      <span class="walk-order">${i+1} → ${i+2}</span><span class="walk-dest"><small>从 ${escape(from.name)}</small><strong>到 ${escape(to.name)}</strong></span><span class="walk-open">高德 ↗</span>
    </a></li>`;
  }).filter(Boolean);
  if (!links.length) return '';
  return `<section class="walking" aria-label="分段步行">
    <div class="walking-heading"><h3>分段步行</h3><span>${links.length} 段</span></div>
    <ol class="walk-list" id="walking-links">${links.slice(0,3).join('')}</ol>
    ${links.length>3?`<details class="walk-more"><summary>展开其余 ${links.length-3} 段</summary><ol class="walk-list" start="4">${links.slice(3).join('')}</ol></details>`:''}
  </section>`;
}
function routeDetail(route) {
  const skipped = state.skipped.get(route.id) || new Set();
  const stops = route.stops.filter(id=>byId.has(id));
  return `${heading(route.name,route.summary,btn('返回路线列表','#routes'))}
  <div class="two-col">
    <section class="panel">
      <div class="flex items-center flex-wrap gap-2 mb-3">${badge(route.tags)} ${badge('方案设计中')}</div>
      <h2>参考游览节点</h2>
      ${stops.map((id,i)=>{
        const point=byId.get(id);
        return `<div class="list-row"><span class="order">${i+1}</span><div class="row-text"><strong>${escape(point.name)}</strong><small>${point.category} · ${status}</small></div>
          <label class="check"><input type="checkbox" name="route-stop" value="${id}" ${skipped.has(id)?'':'checked'} aria-label="纳入 ${escape(point.name)}"><span>纳入</span></label></div>`;
      }).join('')}
      <div class="actions flex flex-wrap mt-4">${action('加入已选节点','add-route',route.id,'primary')}${action('在资源地图查看','show-route',route.id)}</div>
    </section>
    <aside class="panel">
      <h2>停靠点地图</h2>
      ${mapBox(false)}
      <p class="map-caption">${route.id==='all'?'橙线为历史调研轨迹。实际步行请查看下方分段导航。':'蓝线沿调研街道绘制，数字表示停靠顺序。实际步行可打开分段导航。'}</p>
      <div id="route-walking">${walkingSegments(stops.filter(id=>!skipped.has(id)))}</div>
      ${route.id==='all'?streetPhoto():''}
    </aside>
  </div>`;
}
function routeName() {
  if (state.planName) return state.planName;
  const first=byId.get(state.plan[0]);
  return first ? `${first.category}漫游路线` : '';
}
function plan() {
  const [minMinutes,minutes] = stayTotal(state.plan);
  const unknown = state.plan.some(id=>!Number.isFinite(byId.get(id).visitMinutes));
  const over = minutes-times[state.time];
  return `${heading('我的漫游计划','出发时照着站序走。点站名查看地点，再打开两站之间的步行导航。',btn('继续找地点','#map'))}
  ${state.plan.length?`<section class="panel my-route">
    <div><p class="map-caption">本次路线 · ${state.plan.length} 站</p><h2>${escape(routeName())}</h2>
    <p class="route-endpoints"><strong>起点</strong> ${escape(byId.get(state.plan[0]).name)}
    ${state.plan.length>1?`<br><strong>终点</strong> ${escape(byId.get(state.plan.at(-1)).name)}`:''}</p></div>
    <form id="route-naming"><label class="control-label" for="route-name">给你的路线起个名字</label>
    <div class="route-name-controls"><input id="route-name" class="control" maxlength="60" value="${escape(routeName())}" required><button class="btn small" type="submit">保存名称</button></div></form>
  </section>`:''}
  <div class="two-col">
    <section class="panel"><h2>按顺序出发 <span class="badge">${state.plan.length}</span></h2>
      ${state.plan.length?`<div id="plan-list">${state.plan.map((id,i)=>{
          const resource=byId.get(id);
          return `<div class="list-row" draggable="true" data-plan-id="${id}">
            <span class="grip" aria-hidden="true">⠿</span><span class="order">${i+1}</span><div class="row-text">${action(escape(resource.name),'detail',id,'stop-detail')}<small>${resource.category} · ${escape(resource.address)} · 约 ${stay(resource).join('–')} 分钟</small></div>
            <div class="plan-actions">${[['↑','up','上移',i===0],['↓','down','下移',i===state.plan.length-1],['×','remove','移除',false]].map(([sym,cmd,label,disable])=>`<button class="btn icon-only" type="button" data-action="${cmd}" data-value="${id}" aria-label="${label} ${escape(resource.name)}" ${disable?'disabled':''}>${sym}</button>`).join('')}</div></div>`;
        }).join('')}</div>`:'<div class="empty"><p>行程还是空的。先按兴趣生成一份可修改的草案。</p><a class="btn primary" href="#filter">生成漫游草案 →</a></div>'}
    </section>
    <aside class="panel"><h2>出发前</h2>
      ${arrivalPanel(state.plan)}
      ${state.plan.length>1?walkingSegments(state.plan):state.plan.length?'<p class="note">再加一站即可查看两站之间的步行导航。</p>':''}
      ${state.plan.length?action('查看行程地图 '+arrow,'review-plan','','primary'):''}
      <h3 class="mt-4">停留时间</h3>
      <p class="metric-space"><strong class="metric-number">${minMinutes}–${minutes}</strong> 分钟估计停留</p>
      <p class="muted">合计仅包含停留时间，未计入步行。${unknown?'部分节点缺少时长，合计不完整。':''}</p>
      <label class="control-label" for="plan-time">可用时间</label>
      <select id="plan-time" class="control">${Object.keys(times).map(time=>`<option ${time===state.time?'selected':''}>${time}</option>`).join('')}</select>
      ${over>0?`<p class="note mt-3">估计停留时间已超出 ${over} 分钟。可移除节点或增加可用时间。</p>`:''}
      ${state.plan.length>1?`<label class="control-label" for="reference">参考排序</label><select id="reference" class="control"><option value="">保留当前顺序</option>${routeData.map(route=>`<option value="${route.id}" ${state.reference===route.id?'selected':''}>参考 ${route.name}</option>`).join('')}</select><p class="map-caption">参考线内节点按建议顺序排列，其余保留原有顺序。</p>${action('应用参考排序','sort-plan','','small')}`:''}

      <p class="map-caption">清单保存在当前浏览器。清除站点数据后，清单会一并清除。</p>
    </aside>
  </div>`;
}
function about() {
  return `${heading('数据与素材说明','成都玉林—芳草街 Citywalk 行前规划项目。')}
  <section class="panel">
    <h2>调研资料</h2>
    <p>地图道路来自 mid 中的「街道.shp」，全景页的调研线来自「20251126玉林路/线.shp」。资源名称、地址与坐标从「YULINExport_Output」筛选导入，共 ${resources.length} 条历史记录。</p>
    <p>商户营业和地址仍待现场复核。停留时长按类别给出建议值。主题节点按参考顺序编号，分段导航由高德地图提供。</p>
    <p>巴士、纸纹与贴纸取自用户提供的研究汇报 PPT，供本地预览使用。</p>
  </section>`;
}

function currentPage() {
  const [page,id] = location.hash.slice(1).split('/');
  return page==='route' && routes.has(id) ? [page,id] :
    ['home','filter','routes','map','plan','draft','about'].includes(page) ? [page] : ['home'];
}
let lastHash = '';
function renderPage({navigation=false}={}) {
  const [page,id] = currentPage();
  const content = $('#content');
  const views = {home,filter,map:mapPage,plan,draft:draftPage,about,routes:()=>heading('主题路线','选一条路线，查看建议停靠点和分段导航。')+routeCards()};
  if (page==='map' && lastHash!==location.hash && id===undefined) {
    const incoming = location.hash.split('/')[1];
    if (routes.has(incoming)) {
      state.onlyPlan=false;
      state.mapRoute=incoming;
      state.viewport=null;
    }
  }
  lastHash = location.hash;
  const activeNav = page==='route' ? 'routes' : page;
  document.querySelectorAll('[data-nav]').forEach(link=>{
    if (link.dataset.nav===activeNav) link.setAttribute('aria-current','page');
    else link.removeAttribute('aria-current');
  });
  content.innerHTML = page==='route' ? routeDetail(routes.get(id)) : views[page]();
  if (page==='map') renderMap();
  if (page==='draft') mapRedraw({detail:true,customIds:state.draft});
  if (page==='route') mapRedraw({route:routes.get(id),detail:true});
  document.title = page==='home' ? '玉林漫游 · YULIN WALK' : `${content.querySelector('h1')?.textContent || '主题路线'} · 玉林漫游`;
  if (navigation) {
    window.scrollTo({top:0,behavior:'instant'});
    content.focus({preventScroll:true});
  }
}
function go(hash) {
  if (location.hash===hash) renderPage();
  else location.hash=hash;
}
function refreshMap(focusAction) {
  $('#empty-map')?.remove();
  const list = $('#resource-list');
  const scroll = list.scrollTop;
  const source = focusAction?.closest('svg') ? '#street-map' : '#resource-list';
  renderMap();
  list.scrollTop = scroll;
  if (focusAction?.dataset.action==='point' && document.activeElement===document.body) {
    document.querySelector(`${source} [data-value="${state.selected}"]`)?.focus({preventScroll:true});
  }
}
function resetInterest() {
  state.tags.clear();
  state.interests=[];state.clothing='';state.stopTarget=0;
}
function savePlan(message) {
  const stored = persist();
  if (currentPage()[0]==='map') refreshMap();
  else renderPage();
  notify(stored ? message : message+'（浏览器本地存储不可用）');
}
function movePlan(id, offset) {
  const index = state.plan.indexOf(id);
  const next = index+offset;
  if (index<0 || next<0 || next>=state.plan.length) return;
  [state.plan[index],state.plan[next]] = [state.plan[next],state.plan[index]];
  savePlan('已调整游览顺序');
  const button = $(`[data-action="${offset<0?'up':'down'}"][data-value="${id}"]:not(:disabled)`) || $(`[data-action="remove"][data-value="${id}"]`);
  button?.focus({preventScroll:true});
}
function defaultMapView() {
  if (currentPage()[0]==='draft') return fitDraft(state.draft);
  if (state.onlyPlan&&state.plan.length) return fitDraft(state.plan);
  return baseView;
}
function zoom(factor) {
  const [x,y,w,h] = state.viewport || (defaultMapView());
  const width = Math.min(720,Math.max(85,w*factor));
  const height = width*620/720;
  setViewport([x+(w-width)/2,y+(h-height)/2,width,height]);
}
function setViewport([x,y,w,h]) {
  state.viewport = [Math.min(720-w,Math.max(0,x)),Math.min(620-h,Math.max(0,y)),w,h];
  $('#street-map')?.setAttribute('viewBox',state.viewport.join(' '));
}
function syncClothing() {
  const field=$('#clothing-options');
  field.hidden=field.disabled=!showsClothing();
}
function updateInterests(action,name) {
  syncClothing();
  syncStopTarget();
  persist();
  $('#interest-order').innerHTML=interestsPanel();
  $('#filter-summary').innerHTML=filterSummary();
  $(`[data-action='${action}'][data-value='${name}']:not(:disabled)`)?.focus();
}
function shiftInterest(name,delta) {
  const i=state.interests.indexOf(name), to=i+delta;
  if (i<0||to<0||to>=state.interests.length) return;
  [state.interests[i],state.interests[to]]=[state.interests[to],state.interests[i]];
  updateInterests(delta<0?'rank-up':'rank-down',name);
}
function resizePane(key,width) {
  const layout=$('.map-adjustable');
  if (!layout) return;
  const other=mapPanels[key==='filters'?'detail':'filters'];
  const max=Math.max(180,Math.min(365,layout.clientWidth-(other.visible?other.width:0)-360));
  mapPanels[key].width=Math.min(max,Math.max(180,width));
  layout.style.setProperty(key==='filters'?'--filter-width':'--detail-width',`${mapPanels[key].width}px`);
}
const handlers = {
  'toggle-panel'(key) {
    mapPanels[key].visible=!mapPanels[key].visible;
    const visible=mapPanels[key].visible;
    $('#map-'+key+'-pane').hidden=!visible;
    const button=$('[data-action="toggle-panel"][data-value="'+key+'"]');
    button.setAttribute('aria-expanded',String(visible));
    button.textContent=(visible?'收起':'展开')+(key==='filters'?'筛选':'地点详情');
    $('.map-adjustable').style.setProperty(key==='filters'?'--filter-width':'--detail-width',`${visible?mapPanels[key].width:0}px`);
  },
  suggest() {
    const target=$('#stop-target');
    if (target&&!target.reportValidity()) return;
    if (target) state.stopTarget=Number(target.value)||0;
    persist();
    state.options=draftOptions();state.option=0;state.draft=[...(state.options[0]?.ids||[])];state.viewport=null;go('#draft');
  },
  'draft-option'(index) {
    state.option=Number(index);state.draft=[...state.options[state.option].ids];state.viewport=null;renderPage();
    $(`[data-action='draft-option'][data-value='${index}']`)?.focus();
  },
  interest(name) {
    const i=state.interests.indexOf(name);
    if (i<0) state.interests.push(name);else state.interests.splice(i,1);
    updateInterests('interest',name);
  },
  'rank-up'(name) { shiftInterest(name,-1); },
  'rank-down'(name) { shiftInterest(name,1); },
  omit(id) {
    state.draft=state.draft.filter(stop=>stop!==id);state.viewport=null;
    renderPage();
    document.querySelector('#content [data-action="omit"], #content [data-action="suggest"]')?.focus();
  },
  'save-draft'() {
    if (!state.draft.length) return;
    if (!state.plan.length) {
      const subject=state.interests[0] || [...state.tags][0] || byId.get(state.draft[0]).category;
      state.planName=subject+' · '+(state.options[state.option]?.title || '玉林漫游');
    }
    state.plan=[...new Set([...state.plan,...state.draft])];
    savePlan('草案已加入我的计划');
    go('#plan');
  },
  detail(id) { openPoint(id); },
  explore() { state.preferMatch=true;state.viewport=null;state.onlyPlan=false;state.mapRoute='';state.query='';state.mapCategories=new Set(categories);go('#map'); },
  reset() { resetInterest();state.time='2 小时';persist();renderPage(); },
  'browse-map'() { state.onlyPlan=false;state.mapRoute='';renderPage(); },
  'plan-map'() {
    if (!state.plan.length) { go('#plan');return; }
    state.onlyPlan=true;state.mapRoute='';state.viewport=null;state.selected=state.plan[0];renderPage();
  },
  'all-cats'() { state.mapCategories=new Set(categories);renderPage();$('[data-action="all-cats"]').focus(); },
  'no-cats'() { state.mapCategories.clear();renderPage();$('[data-action="no-cats"]').focus(); },
  'clear-map'() { resetInterest();state.mapRoute='';state.query='';state.mapCategories=new Set(categories);state.onlyPlan=false;persist();renderPage(); },
  point(id, origin) {
    state.selected=id;
    const point=byId.get(id);
    if (origin.closest('#resource-list') && point?.xy && state.viewport) {
      const [x,y]=point.xy;
      const [, , width,height]=state.viewport;
      setViewport([x-width/2,y-height/2,width,height]);
    }
    refreshMap(origin);
    openPoint(id);
  },
  add(id) {
    if (!byId.has(id)) return;
    if (state.plan.includes(id)) { notify('这个地点已在计划中'); return; }
    state.plan.push(id);
    savePlan('已加入我的漫游计划');
    if ($('#stop-dialog').open) {
      openPoint(id);
      $('#stop-dialog-content [data-action="add"]')?.focus({preventScroll:true});
    } else $('#point-detail [data-action="add"]')?.focus({preventScroll:true});
  },
  'add-route'(id) {
    const allowed=routes.get(id).stops.filter(stop=>byId.has(stop)&&!state.skipped.get(id)?.has(stop));
    if (!allowed.length) { notify('请至少选择一个节点'); return; }
    state.plan=[...new Set([...state.plan,...allowed])];
    savePlan('已保存所选路线节点');
    go('#plan');
  },
  'show-route'(id) {
    state.mapRoute=id;
    state.query='';
    state.onlyPlan=false;
    state.mapCategories=new Set(categories);
    state.selected=routes.get(id).stops.find(stop=>!state.skipped.get(id)?.has(stop));
    go('#map/'+id);
  },
  'review-plan'() {
    state.onlyPlan=state.plan.length>0;
    state.mapRoute='';
    state.viewport=null;
    state.mapCategories=new Set(categories);
    go('#map');
  },
  'sort-plan'() {
    const reference=routes.get(state.reference);
    if (!reference) { notify('请选择一条参考路线'); return; }
    const order=new Map(reference.stops.map((id,i)=>[id,i]));
    state.plan.sort((a,b)=>(order.get(a)??Infinity)-(order.get(b)??Infinity));
    savePlan('已按主题路线调整参考顺序');
  },
  remove(id) {
    const index=state.plan.indexOf(id);
    state.plan=state.plan.filter(stop=>stop!==id);
    savePlan('已移除节点');
    const neighbor=state.plan[Math.min(index,state.plan.length-1)];
    if (neighbor) $(`[data-action="remove"][data-value="${neighbor}"]`)?.focus({preventScroll:true});
  },
  up(id) { movePlan(id,-1); },
  down(id) { movePlan(id,1); },
  async copy(id) {
    const address=byId.get(id)?.address;
    if (!address) return;
    try { await navigator.clipboard.writeText(address); notify('已复制地址'); }
    catch {
      const field=document.createElement('textarea');
      field.value=address;
      field.setAttribute('readonly','');
      field.style.position='fixed';
      field.style.left='-9999px';
      document.body.append(field);
      field.select();
      let copied=false;
      try { copied=document.execCommand('copy'); } catch {}
      field.remove();
      notify(copied?'已复制地址':'复制未成功，请手动选择详情中的地址');
      $('#point-detail [data-action="copy"]')?.focus();
    }
  },
  'zoom-in'() { zoom(.75); },
  'zoom-out'() { zoom(1/.75); },
  'zoom-reset'() { setViewport(defaultMapView()); }
};
document.addEventListener('click',event=>{
  const button=event.target.closest('[data-action]');
  if (button) handlers[button.dataset.action]?.(button.dataset.value,button);
});
document.addEventListener('keydown',event=>{
  const handle=event.target.closest('[data-resize]');
  if (handle && ['ArrowLeft','ArrowRight'].includes(event.key)) {
    event.preventDefault();
    const key=handle.dataset.resize;
    const direction=(event.key==='ArrowRight'?1:-1)*(key==='filters'?1:-1);
    resizePane(key,mapPanels[key].width+direction*16);
    return;
  }
  const marker=event.target.closest('g.marker[data-action]');
  if (marker && ['Enter',' '].includes(event.key)) {
    event.preventDefault();
    handlers.point(marker.dataset.value,marker);
  }
});
document.addEventListener('change',event=>{
  const input=event.target;
  if (input.id==='arrival-mode'||input.id==='arrival-stop') {
    if (input.id==='arrival-mode') { state.arrivalMode=input.value;state.arrivalId=''; }
    else state.arrivalId=input.value;
    state.viewport=null;
    persist();
    renderPage();
    $('#'+input.id)?.focus({preventScroll:true});
  } else if (input.closest('#filters')) {
    if (input.name==='tag') {
      if (input.checked) state.tags.add(input.value);
      else state.tags.delete(input.value);
    } else if (input.id==='clothing') state.clothing=input.value;
    else if (input.name==='time') state.time=input.value;
    else if (input.id==='stop-target' && input.validity.valid) state.stopTarget=Number(input.value)||0;
    syncClothing();
    if (input.id!=='stop-target') syncStopTarget();
    persist();
    $('#filter-summary').innerHTML=filterSummary();
  } else if (input.name==='map-cat') {
    if (input.checked) state.mapCategories.add(input.value);
    else state.mapCategories.delete(input.value);
    refreshMap();
  } else if (input.id==='map-route') {
    state.mapRoute=input.value;
    state.onlyPlan=false;
    state.query='';
    state.viewport=null;
    renderPage();
    $('#map-route').focus();
  }
  else if (input.id==='reference') state.reference=input.value;
  else if (input.id==='plan-time') { state.time=input.value;persist();renderPage();$('#plan-time')?.focus(); }
  else if (input.name==='route-stop') {
    const route=routes.get(currentPage()[1]);
    const skipped=state.skipped.get(route.id) || new Set();
    if (input.checked) skipped.delete(input.value);
    else skipped.add(input.value);
    state.skipped.set(route.id,skipped);
    mapRedraw({route,detail:true});
    $('#route-walking').innerHTML=walkingSegments(route.stops.filter(id=>!skipped.has(id)));
  }
});
document.addEventListener('input',event=>{
  if (event.target.id!=='map-search') return;
  state.query=event.target.value;
  state.mapRoute='';
  state.onlyPlan=false;
  $('#map-route').value='';
  refreshMap();
});
document.addEventListener('submit',event=>{
  if (event.target.id==='filters') { event.preventDefault(); handlers.suggest(); }
  if (event.target.id==='route-naming') {
    event.preventDefault();
    const name=$('#route-name').value.trim();
    if (!name) { notify('请输入路线名称');return; }
    state.planName=name;
    savePlan('路线名称已保存');
    $('#route-name').focus();
  }
});
let dragging = null;
document.addEventListener('dragstart',event=>{
  const row=event.target.closest('[data-plan-id]');
  if (!row) return;
  dragging=row.dataset.planId;
  event.dataTransfer.setData('text/plain',dragging);
  event.dataTransfer.effectAllowed='move';
});
document.addEventListener('dragover',event=>{
  const row=event.target.closest('[data-plan-id]');
  if (!row || !dragging) return;
  event.preventDefault();
  document.querySelector('.drop-target')?.classList.remove('drop-target');
  row.classList.add('drop-target');
});
document.addEventListener('dragend',()=>{
  dragging=null;
  document.querySelector('.drop-target')?.classList.remove('drop-target');
});
document.addEventListener('drop',event=>{
  const row=event.target.closest('[data-plan-id]');
  if (!dragging || !row) return;
  event.preventDefault();
  const from=state.plan.indexOf(dragging), to=state.plan.indexOf(row.dataset.planId);
  dragging=null;
  if (from<0 || to<0 || from===to) {
    row.classList.remove('drop-target');
    return;
  }
  const [id]=state.plan.splice(from,1);
  state.plan.splice(to,0,id);
  savePlan('已调整游览顺序');
});
let panelDrag=null;
let pan = null;
$('#content').addEventListener('pointerdown',event=>{
  const handle=event.target.closest('[data-resize]');
  if (handle && event.button===0) {
    handle.setPointerCapture(event.pointerId);
    const key=handle.dataset.resize;
    panelDrag={key,pointer:event.pointerId,x:event.clientX,width:mapPanels[key].width};
    return;
  }
  const svg=event.target.closest('#street-map');
  if (!svg || !['map','draft'].includes(currentPage()[0]) || event.target.closest('.marker') || event.button!==0) return;
  const matrix=svg.getScreenCTM();
  if (!matrix) return;
  svg.setPointerCapture(event.pointerId);
  pan={pointer:event.pointerId,x:event.clientX,y:event.clientY,scale:matrix.a,view:state.viewport||(defaultMapView())};
});
$('#content').addEventListener('pointermove',event=>{
  if (panelDrag?.pointer===event.pointerId) {
    const {key,x,width}=panelDrag;
    resizePane(key,width+(event.clientX-x)*(key==='filters'?1:-1));
    return;
  }
  if (!pan || pan.pointer!==event.pointerId) return;
  const [x,y,w,h]=pan.view;
  setViewport([x-(event.clientX-pan.x)/pan.scale,y-(event.clientY-pan.y)/pan.scale,w,h]);
});
for (const eventName of ['pointerup','pointercancel','lostpointercapture']) {
  $('#content').addEventListener(eventName,event=>{ if (pan?.pointer===event.pointerId) pan=null; if (panelDrag?.pointer===event.pointerId) panelDrag=null; });
}
window.addEventListener('hashchange',()=> {
  if (location.hash!=='#content') renderPage({navigation:true});
});
persist();
renderPage();


