// Draw only along the imported street centerlines. This map has no crossing or access rules.
window.buildStudyRouting = function (streets, resources) {
  const segments = [];
  const toPoint = pair => pair.split(' ').map(Number);
  for (const street of streets) {
    for (const part of street.d.split('M').filter(Boolean)) {
      const points = part.trim().split('L').map(toPoint);
      for (let i=1;i<points.length;i++) {
        const a=points[i-1], b=points[i];
        if (a[0]!==b[0] || a[1]!==b[1]) segments.push({a,b,cuts:[0,1]});
      }
    }
  }
  const vector = ([x,y],[u,v]) => [u-x,v-y];
  const cross = ([x,y],[u,v]) => x*v-y*u;
  const at = ({a,b},t) => a.map((value,i)=>value+(b[i]-value)*t);
  const distance = ([x,y],[u,v]) => Math.hypot(x-u,y-v);

  for (let i=0;i<segments.length;i++) {
    const first=segments[i], ab=vector(first.a,first.b);
    for (const second of segments.slice(i+1)) {
      const cd=vector(second.a,second.b);
      const denominator=cross(ab,cd);
      if (Math.abs(denominator)<1e-8) continue;
      const offset=vector(first.a,second.a);
      const t=cross(offset,cd)/denominator, u=cross(offset,ab)/denominator;
      if (t>=0 && t<=1 && u>=0 && u<=1) {
        first.cuts.push(t);
        second.cuts.push(u);
      }
    }
  }

  const snaps=new Map();
  for (const resource of resources) {
    if (!resource.xy) continue;
    let closest=null;
    for (const segment of segments) {
      const [dx,dy]=vector(segment.a,segment.b);
      const [px,py]=vector(segment.a,resource.xy);
      const t=Math.max(0,Math.min(1,(px*dx+py*dy)/(dx*dx+dy*dy)));
      const point=at(segment,t), gap=distance(point,resource.xy);
      if (!closest || gap<closest.gap) closest={segment,t,point,gap};
    }
    if (closest && closest.gap<=42) {
      closest.segment.cuts.push(closest.t);
      snaps.set(resource.id,closest.point);
    }
  }

  const nodes=new Map(), edges=new Map();
  const key = point => point.map(value=>Math.round(value*100)/100).join(',');
  const connect = (a,b) => {
    const from=key(a), to=key(b);
    if (from===to) return;
    const weight=distance(a,b);
    nodes.set(from,a);
    nodes.set(to,b);
    if (!edges.has(from)) edges.set(from,[]);
    if (!edges.has(to)) edges.set(to,[]);
    edges.get(from).push([to,weight]);
    edges.get(to).push([from,weight]);
  };
  for (const segment of segments) {
    const cuts=segment.cuts.sort((a,b)=>a-b).map(t=>at(segment,t));
    for (let i=1;i<cuts.length;i++) connect(cuts[i-1],cuts[i]);
  }
  const cache=new Map();
  return (from,to)=>{
    const pair=from+':'+to;
    if (cache.has(pair)) return cache.get(pair);
    if (!snaps.has(from)||!snaps.has(to)) return null;
    const source=key(snaps.get(from)), target=key(snaps.get(to));
    if (!nodes.has(source)||!nodes.has(target)) return null;
    const costs=new Map([[source,0]]), predecessors=new Map(), pending=new Set([source]);
    while (pending.size) {
      let best=null;
      for (const id of pending) if (best===null || costs.get(id)<costs.get(best)) best=id;
      if (best===target) break;
      pending.delete(best);
      for (const [next,weight] of edges.get(best)) {
        const candidate=costs.get(best)+weight;
        if (candidate >= (costs.get(next)??Infinity)) continue;
        costs.set(next,candidate);
        predecessors.set(next,best);
        pending.add(next);
      }
    }
    if (!costs.has(target)) { cache.set(pair,null);return null; }
    const points=[];
    for (let id=target;id;id=predecessors.get(id)) points.push(nodes.get(id).map(n=>Math.round(n*10)/10));
    points.reverse();
    cache.set(pair,points);
    return points;
  };
};

