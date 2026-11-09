const ids = ['espana','futbol','marcadores','github','seguridad'];
const field = document.querySelector('#search');
const status = document.querySelector('#status');
const date = new Intl.DateTimeFormat('es-ES',{dateStyle:'medium',timeStyle:'short',timeZone:'Europe/Madrid'});
let snapshot;
function element(tag,value,className) {
  const node=document.createElement(tag);
  node.textContent=value;
  if(className) node.className=className;
  return node;
}
function render() {
  if(!snapshot) return;
  const query=field.value.trim().toLowerCase();
  for(const id of ids) {
    const grid=document.querySelector('#'+id+' .grid');
    const rows=(snapshot.sections[id]??[]).filter(row=>[row.title,row.meta,row.description].join(' ').toLowerCase().includes(query));
    grid.replaceChildren(...rows.map(row=>{
      const card=element('article','');
      const heading=element('h3',row.title);
      if(typeof row.url==='string'&&row.url.startsWith('https://')){
        const link=element('a',row.title+' ↗');
        link.href=row.url;
        heading.replaceChildren(link);
      }
      card.append(heading,element('p',row.meta,'meta'));
      if(row.description)card.append(element('p',row.description));
      return card;
    }));
    if(!rows.length)grid.append(element('p',query?'No hay coincidencias.':'Sin datos publicados para esta sección.'));
  }
}
async function update(){
  try {
    const response=await fetch('./sentinel-data.json',{cache:'no-cache',signal:AbortSignal.timeout(12000)});
    if(!response.ok)throw new Error('Datos no disponibles');
    snapshot=await response.json();
    status.textContent='Última actualización: '+date.format(new Date(snapshot.updatedAt))+' (Madrid)'+(snapshot.unavailable.length?' · Cobertura parcial':'');
    render();
  }catch{
    if(!snapshot)status.textContent='No se pudo cargar la edición. Se reintentará automáticamente.';
  }
}
field.addEventListener('input',render);
void update();
setInterval(()=>{if(!document.hidden)void update();},5*60*1000);