const ns = 'http://www.w3.org/2000/svg';
const svg = document.querySelector('#world-map');
const status = document.querySelector('#map-status');
let places = [], view = [-180, -85, 360, 170];
function element(tag, attrs) {
  const node = document.createElementNS(ns, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  return node;
}
function renderView() {
  svg.setAttribute('viewBox', view.join(' '));
  document.querySelectorAll('.place-dot').forEach(n => n.setAttribute('r', view[2] * .0045));
  const labelBoxes = [];
  document.querySelectorAll('.place-label').forEach(n => {
    const font = view[2] * .013;
    const x = Number(n.getAttribute('x')) + view[2] * .008;
    const y = Number(n.getAttribute('y')) - view[2] * .006;
    n.setAttribute('font-size', font);
    n.setAttribute('dx', view[2] * .008);
    n.setAttribute('dy', -view[2] * .006);
    const box = {x, y:y-font, w:n.textContent.length*font*.6, h:font*1.35};
    const inside = x>=view[0] && x+box.w<=view[0]+view[2] && y>=view[1] && y<=view[1]+view[3];
    const overlaps = labelBoxes.some(b => box.x < b.x+b.w+font*.35 && box.x+box.w+font*.35 > b.x && box.y < b.y+b.h+font*.3 && box.y+box.h+font*.3 > b.y);
    n.style.display = inside && !overlaps ? '' : 'none';
    if(inside && !overlaps) labelBoxes.push(box);
  });
}
function fitPlaces() {
  if (!places.length) { view = [-180, -85, 360, 170]; renderView(); return; }
  const lngs = places.map(p => (p.lng + 360) % 360).sort((a,b) => a-b);
  let gap = -1, start = lngs[0];
  lngs.forEach((n,i) => { const next = lngs[(i+1)%lngs.length] + (i===lngs.length-1?360:0); if(next-n>gap){gap=next-n;start=next%360;} });
  const xs = places.map(p => {let x=(p.lng+360)%360;while(x<start)x+=360;return x;});
  const ys = places.map(p => -p.lat);
  let w=Math.max(35,Math.max(...xs)-Math.min(...xs)+24), h=Math.max(20,Math.max(...ys)-Math.min(...ys)+18);
  const ratio=svg.clientWidth/Math.max(1,svg.clientHeight);
  if(w/h<ratio)w=h*ratio;else h=w/ratio;
  if(w>360){view=[-180,-85,360,170];}else{view=[(Math.min(...xs)+Math.max(...xs)-w)/2,(Math.min(...ys)+Math.max(...ys)-h)/2,w,h];}
  renderView();
}
function zoom(factor) {
  const w=Math.min(720,Math.max(8,view[2]*factor)), h=w*view[3]/view[2];
  view=[view[0]+(view[2]-w)/2,view[1]+(view[3]-h)/2,w,h];renderView();
}
document.querySelector('#zoom-in').onclick=()=>zoom(.75);
document.querySelector('#zoom-out').onclick=()=>zoom(1.3333);
document.querySelector('#fit-map').onclick=()=>{fitPlaces();status.textContent=places.length?'Drag to explore · Fit places to return':'Visited places will appear here soon.';};
document.querySelector('#world-view').onclick=()=>{view=[-180,-85,360,170];renderView();};
let dragging;
svg.addEventListener('pointerdown',e=>{if(e.target.closest('[data-place]'))return;dragging={x:e.clientX,y:e.clientY,v:[...view]};svg.setPointerCapture(e.pointerId);});
svg.addEventListener('pointermove',e=>{if(!dragging)return;const scale=Math.max(view[2]/svg.clientWidth,view[3]/svg.clientHeight);view=[dragging.v[0]-(e.clientX-dragging.x)*scale,dragging.v[1]-(e.clientY-dragging.y)*scale,view[2],view[3]];renderView();});
svg.addEventListener('pointerup',()=>dragging=null);
svg.addEventListener('pointercancel',()=>dragging=null);
async function loadMap() {
  try {
    const [landResponse,placesResponse]=await Promise.all([fetch('data/land.geojson'),fetch('data/places.json',{cache:'no-cache'})]);
    if(!landResponse.ok||!placesResponse.ok)throw new Error('Map unavailable');
    const land=await landResponse.json(), input=await placesResponse.json();
    places=input.filter(p=>typeof p.name==='string'&&Number.isFinite(p.lat)&&Number.isFinite(p.lng)&&Math.abs(p.lat)<=90&&Math.abs(p.lng)<=180);
    const grid=document.querySelector('#map-grid'),ground=document.querySelector('#map-land');
    grid.replaceChildren();ground.replaceChildren();document.querySelector('#map-points').replaceChildren();
    for(let offset=-360;offset<=720;offset+=360){
      for(let x=-180;x<=180;x+=30)grid.append(element('path',{d:`M${x+offset},-85V85`,class:'map-gridline'}));
      for(let y=-60;y<=60;y+=30)grid.append(element('path',{d:`M${-180+offset},${y}H${180+offset}`,class:'map-gridline'}));
      for(const feature of land.features){const polygons=feature.geometry.type==='Polygon'?[feature.geometry.coordinates]:feature.geometry.coordinates;let d='';for(const polygon of polygons)for(const ring of polygon)d+=ring.map((p,i)=>`${i?'L':'M'}${(p[0]+offset).toFixed(3)},${(-p[1]).toFixed(3)}`).join('')+'Z';ground.append(element('path',{d,class:'map-land', 'fill-rule':'evenodd'}));}
    }
    const points=document.querySelector('#map-points');
    places.forEach(p=>{
      for(let offset=-360;offset<=720;offset+=360){const group=element('g',{'data-place':p.name});const dot=element('circle',{cx:p.lng+offset,cy:-p.lat,class:'place-dot'});const title=element('title',{});title.textContent=p.name;dot.append(title);const label=element('text',{x:p.lng+offset,y:-p.lat,class:'place-label'});label.textContent=p.name;group.append(dot,label);points.append(group);}
    });
    document.querySelector('#place-count').textContent=`${places.length} places`;
    status.textContent=places.length?'Drag to explore · Fit places to return':'Visited places will appear here soon.';
    fitPlaces();

  }catch(error){status.textContent='The map could not load. Please refresh to try again.';}
}
loadMap();
new ResizeObserver(()=>fitPlaces()).observe(svg);
new BroadcastChannel('travel-map').onmessage=()=>loadMap();
document.addEventListener('visibilitychange',()=>{if(!document.hidden)loadMap();});
const lightbox=document.querySelector('#photo-lightbox'),lightboxImage=document.querySelector('#lightbox-image');
let photos=[],current=0;
function showPhoto(index){current=(index+photos.length)%photos.length;const p=photos[current];lightboxImage.src=p.src;lightboxImage.alt=p.alt;document.querySelector('#lightbox-caption').textContent=`${p.title} / ${String(current+1).padStart(2,'0')} of ${photos.length}`;if(!lightbox.open)lightbox.showModal();}
document.querySelector('#close-photo').onclick=()=>lightbox.close();
document.querySelector('#previous-photo').onclick=()=>showPhoto(current-1);
document.querySelector('#next-photo').onclick=()=>showPhoto(current+1);
lightbox.addEventListener('keydown',e=>{if(e.key==='ArrowLeft'){e.preventDefault();showPhoto(current-1);}if(e.key==='ArrowRight'){e.preventDefault();showPhoto(current+1);}});
lightbox.addEventListener('click',e=>{if(e.target===lightbox)lightbox.close();});
fetch('data/photos.json').then(r=>{if(!r.ok)throw new Error();return r.json();}).then(data=>{
  photos=data;const gallery=document.querySelector('#photo-gallery');
  document.querySelector('.gallery-heading .eyebrow').textContent=`01—${String(photos.length).padStart(2,'0')}`;
  photos.forEach((p,i)=>{const button=document.createElement('button');button.className='gallery-photo';button.setAttribute('aria-label',`View ${p.title}`);const img=document.createElement('img');img.src=p.src;img.alt=p.alt;img.width=p.width;img.height=p.height;img.loading='lazy';img.decoding='async';button.append(img);button.onclick=()=>showPhoto(i);gallery.append(button);});
}).catch(()=>{document.querySelector('#photo-gallery').textContent='The photographs could not load. Please refresh to try again.';});
