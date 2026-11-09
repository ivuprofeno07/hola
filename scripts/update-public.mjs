import { writeFile } from 'node:fs/promises';
import { parseRssOrAtomXml } from '../src/utils/feedParser.ts';
import { editorialFeeds } from '../server/editorialFeeds.ts';
import { getSportsScoreboard } from '../server/sportsScoreboard.ts';
import { sportsDay } from '../src/utils/sportsDates.ts';

const now = new Date();
const headers = { 'User-Agent': 'Sentinel public edition' };
async function request(url, extra = {}) {
  const response = await fetch(url, { headers: { ...headers, ...extra }, signal: AbortSignal.timeout(14000) });
  if (!response.ok) throw new Error('HTTP ' + response.status);
  return response;
}
async function news(category) {
  const feeds = editorialFeeds.filter(item => item.category === category && item.language === 'es');
  const results = await Promise.allSettled(feeds.map(async feed => {
    const response = await request(feed.url);
    return parseRssOrAtomXml(await response.text(), feed.name)
      .filter(item => item.url.startsWith('https://') && Date.parse(item.publishedAt) <= now.getTime() + 300000);
  }));
  const rows = results.flatMap(result => result.status === 'fulfilled' ? result.value : []);
  if (!rows.length) throw new Error('Sin noticias');
  rows.sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt));
  return [...new Map(rows.map(item=>[item.url,item])).values()].slice(0,12).map(item=>({
    title:item.title, url:item.url, meta:item.author+' · '+item.publishedAt.slice(0,10), description:item.description.slice(0,160)
  }));
}
async function github() {
  const recent = new Date(now.getTime() - 30*86400000).toISOString().slice(0,10);
  const query = new URLSearchParams({q:'is:public archived:false fork:false stars:>=1000 pushed:>='+recent,sort:'stars',per_page:'12'});
  const token=process.env.GH_TOKEN;
  const data=await (await request('https://api.github.com/search/repositories?'+query,token?{Authorization:'Bearer '+token}:{})).json();
  if(!Array.isArray(data.items)||!data.items.length)throw new Error('Sin repositorios');
  return data.items.filter(item=>item.html_url?.startsWith('https://github.com/')).map(item=>({
    title:item.full_name,url:item.html_url,meta:item.stargazers_count.toLocaleString('es-ES')+' estrellas · '+(item.language??'GitHub'),description:(item.description??'').slice(0,180)
  }));
}
async function security() {
  const data=await (await request('https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json')).json();
  return data.vulnerabilities.sort((a,b)=>b.dateAdded.localeCompare(a.dateAdded)).slice(0,9).map(item=>({
    title:item.cveID+' · '+item.vulnerabilityName,meta:'CISA KEV · '+item.dateAdded,
    url:'https://www.cisa.gov/known-exploited-vulnerabilities-catalog',description:item.shortDescription.slice(0,180)
  }));
}
async function scores() {
  const day=sportsDay(now);
  const board=await getSportsScoreboard(day,'football',['esp.1']);
  if(board.unavailable.length)throw new Error('Marcadores no disponibles');
  const format=new Intl.DateTimeFormat('es-ES',{dateStyle:'medium',timeStyle:'short',timeZone:'Europe/Madrid'});
  return board.matches.map(item=>({
    title:item.homeTeam+' – '+item.awayTeam,meta:'LaLiga · '+format.format(new Date(item.matchTime)),
    url:item.sourceUrl,description:item.homeScore!=null&&item.awayScore!=null?item.homeScore+' – '+item.awayScore:item.status==='POSTPONED'?'Aplazado':'Sin resultado publicado'
  }));
}
const sources = {espana:()=>news('spain'),futbol:()=>news('football'),marcadores:scores,github,seguridad:security};
const results=await Promise.allSettled(Object.values(sources).map(run=>run()));
const snapshot={updatedAt:now.toISOString(),sections:{},unavailable:[]};
for(const [index,id] of Object.keys(sources).entries()){
  const result=results[index];
  if(result.status==='fulfilled')snapshot.sections[id]=result.value;
  else {snapshot.unavailable.push(id);console.warn(id,result.reason?.message);}
}
if(snapshot.unavailable.length===results.length)throw new Error('Ninguna fuente respondió');
await writeFile(new URL('../docs/sentinel-data.json',import.meta.url),JSON.stringify(snapshot)+'\n');
console.log('Edición pública:',Object.fromEntries(Object.entries(snapshot.sections).map(([key,rows])=>[key,rows.length])));
