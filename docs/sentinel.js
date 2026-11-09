const ids=['espana','futbol','marcadores','github','seguridad'];
const search=document.querySelector('#search');
const status=document.querySelector('#status');
const counter=document.querySelector('#favorite-count');
const feedback=document.querySelector('#favorite-status');
const key='sentinel.public.favorites.v1';
const format=new Intl.DateTimeFormat('es-ES',{dateStyle:'medium',timeStyle:'short',timeZone:'Europe/Madrid'});
const favorites=new Map();
const idFor=(section,item)=>JSON.stringify([section,item.title,item.url??'']);
let snapshot;
try {
  const stored=JSON.parse(localStorage.getItem(key)??'[]');
  if(Array.isArray(stored))for(const item of stored.slice(0,150)){
    if(item&&ids.includes(item.section)&&typeof item.title==='string'&&typeof item.meta==='string')favorites.set(idFor(item.section,item),item);
  }
} catch { /* Continue without persistent storage. */ }
function element(tag,text,style){
  const node=document.createElement(tag);
  node.textContent=text;
  if(style)node.className=style;
  return node;
}
function toggle(section,item,button){
  const id=idFor(section,item);
  const removed=favorites.delete(id);
  if(!removed){
    if(favorites.size>=150){feedback.textContent='Quita un favorito antes de guardar otro. El límite es 150.';return;}
    favorites.set(id,{section,title:item.title,meta:item.meta,url:item.url,description:item.description});
  }
  let saved=true;
  try {localStorage.setItem(key,JSON.stringify([...favorites.values()]));}catch{saved=false;}
  render();
  const next=[...document.querySelectorAll('.favorite-button')].find(node=>node.dataset.id===id&&node.dataset.group===button.dataset.group);
  (next??document.querySelector('a[href="#favoritos"]'))?.focus();
  feedback.textContent=(removed?'Eliminado de favoritos: ':'Guardado en favoritos: ')+item.title+(saved?'':'. El cambio solo se conserva en esta sesión.');
}
function card(section,item,group){
  const article=element('article','');
  const heading=element('h3',item.title);
  if(typeof item.url==='string'&&item.url.startsWith('https://')){
    const link=element('a',item.title+' ↗');link.href=item.url;heading.replaceChildren(link);
  }
  article.append(heading,element('p',item.meta,'meta'));
  if(item.description)article.append(element('p',item.description));
  const id=idFor(section,item);
  const saved=favorites.has(id);
  const button=element('button',saved?'★ Quitar de favoritos':'☆ Guardar','favorite-button');
  button.type='button';
  button.dataset.id=id;
  button.dataset.group=group;
  button.setAttribute('aria-label',(saved?'Quitar de favoritos: ':'Guardar en favoritos: ')+item.title);
  button.setAttribute('aria-pressed',String(saved));
  button.addEventListener('click',()=>toggle(section,item,button));
  article.append(button);
  return article;
}
function render(){
  const query=search.value.trim().toLowerCase();
  const matches=item=>[item.title,item.meta,item.description].join(' ').toLowerCase().includes(query);
  counter.textContent=String(favorites.size);
  const savedGrid=document.querySelector('#favoritos .grid');
  const saved=[...favorites.values()].reverse().filter(matches);
  savedGrid.replaceChildren(...saved.map(item=>card(item.section,item,'favoritos')));
  if(!saved.length)savedGrid.append(element('p',query?'No hay favoritos que coincidan.':'Todavía no has guardado ningún favorito.'));
  if(!snapshot)return;
  for(const section of ids){
    const grid=document.querySelector('#'+section+' .grid');
    const rows=(snapshot.sections[section]??[]).filter(matches);
    grid.replaceChildren(...rows.map(item=>card(section,item,section)));
    if(!rows.length)grid.append(element('p',query?'No hay coincidencias.':'Sin datos publicados para esta sección.'));
  }
}
async function update(){
  try{
    const response=await fetch('./sentinel-data.json',{cache:'no-cache',signal:AbortSignal.timeout(12000)});
    if(!response.ok)throw new Error('Datos no disponibles');
    snapshot=await response.json();
    status.textContent='Última actualización: '+format.format(new Date(snapshot.updatedAt))+' (Madrid)'+(snapshot.unavailable.length?' · Cobertura parcial':'');
    render();
  }catch{
    if(!snapshot)status.textContent='No se pudo cargar la edición. Se reintentará automáticamente.';
  }
}
search.addEventListener('input',render);
render();
void update();
setInterval(()=>{if(!document.hidden)void update();},5*60*1000);
