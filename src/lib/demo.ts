import type { Artwork, Category, DemoData, Student, Votes } from '../types';
export const categories: Category[] = [
 {id:1,title:'감정의 형태',en:'FORM OF FEELING',subtitle:'손끝으로 표현한 감정의 순간',color:'#e9e7e2'},
 {id:2,title:'낯선 상상',en:'BEYOND IMAGINATION',subtitle:'일상 너머의 새로운 장면',color:'#e5e8e8'},
 {id:3,title:'나만의 세계',en:'MY OWN WORLD',subtitle:'각자의 시선으로 그린 이야기',color:'#ece9e4'},
 {id:4,title:'우리의 이야기',en:'STORIES TOGETHER',subtitle:'서로 다른 생각이 만나는 곳',color:'#e4e6e2'},
];
const art = (id:string,categoryId:number,title:string,seed:string,ownerId='demo-other'):Artwork => ({id,categoryId,title,ownerId,image:`https://images.unsplash.com/${seed}?auto=format&fit=crop&w=900&q=80`,createdAt:Date.now()-86400000,approved:true});
export const sampleArtworks: Artwork[] = [
 art('a101',1,'머무르는 온기','photo-1513364776144-60967b0f800f'),art('a102',1,'한 조각의 빛','photo-1460661419201-fd4cecdf8a8b'),art('a103',1,'푸른 순간','photo-1549490349-8643362247b5'),art('a104',1,'기억의 정원','photo-1579783902614-a3fb3927b6a5'),
 art('a201',2,'경계 너머','photo-1515405295579-ba7b45403062'),art('a202',2,'흐르는 도시','photo-1547891654-e66ed7ebb968'),art('a203',2,'꿈의 계단','photo-1541961017774-22349e4a1262'),art('a204',2,'낯선 풍경','photo-1577083552431-6e5fd01aa342'),
 art('a301',3,'작은 우주','photo-1494438639946-1ebd1d20bf85'),art('a302',3,'나의 계절','photo-1571115764595-644a1f56a55c'),art('a303',3,'반짝이는 조각','photo-1579783902614-a3fb3927b6a5'),art('a304',3,'틈 사이','photo-1543857778-c4a1a3e0b2eb'),
 art('a401',4,'함께 걷는 길','photo-1513519245088-0e12902e5a38'),art('a402',4,'우리의 색','photo-1501472312651-726afe119ff1'),art('a403',4,'이야기의 조각','photo-1561214115-f2f134cc4912'),art('a404',4,'서로 다른 별','photo-1561839561-b13bcfe95249'),
];
export const initialDemo = ():DemoData=>({phase:'vote',categories,artworks:sampleArtworks,students:[{id:'demo-other',name:'전시 작가',nickname:'작가'},{id:'demo-10201',name:'홍길동',nickname:'길동'}],submissions:[]});
export const emptyVotes = ():Votes=>({1:[],2:[],3:[],4:[]});
export const phaseLabels:Record<DemoData['phase'],string>={upload:'작품 등록',review:'작품 검토',vote:'투표 진행',closed:'투표 마감',results:'결과 공개'};
export const STORAGE_KEY='atelier04_demo_v1';
export const loadDemo=():DemoData=>{try{const value=localStorage.getItem(STORAGE_KEY);if(value){const parsed=JSON.parse(value) as DemoData;if(parsed.artworks && parsed.submissions && parsed.categories && parsed.students) return parsed;}}catch{}return initialDemo();};
export const shuffleStable=(items:Artwork[],user:string,category:number)=>{
 const code=`${user}-${category}`.split('').reduce((h,c)=>((h*31+c.charCodeAt(0))>>>0),7);
 const hash=(str:string)=>str.split('').reduce((h,c)=>((h*33+c.charCodeAt(0))>>>0),code);
 return [...items].sort((a,b)=>hash(a.id)-hash(b.id));
};
export const makeWebp=async(file:File):Promise<string>=>{
 if(!file.type.startsWith('image/')) throw new Error('이미지 파일만 업로드할 수 있습니다.');
 if(file.size>15*1024*1024) throw new Error('15MB 이하의 이미지 파일을 선택해 주세요.');
 const url=URL.createObjectURL(file);
 try{
  const image=await new Promise<HTMLImageElement>((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('이미지를 열 수 없습니다.'));img.src=url;});
  const ratio=Math.min(1,1600/Math.max(image.width,image.height));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.width*ratio));canvas.height=Math.max(1,Math.round(image.height*ratio));
  canvas.getContext('2d')?.drawImage(image,0,0,canvas.width,canvas.height);
  return canvas.toDataURL('image/webp',0.74);
 }finally{URL.revokeObjectURL(url);}
};
export const downloadCsv=(rows:(string|number)[][],filename:string)=>{
 const csv='\uFEFF'+rows.map(r=>r.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\r\n');
 const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),500);
};
export const tally=(data:DemoData,categoryId:number)=>{
 const counts=new Map<string,number>();for(const a of data.artworks.filter(a=>a.categoryId===categoryId && a.approved))counts.set(a.id,0);
 for(const s of data.submissions)for(const id of s.votes[categoryId]||[])if(counts.has(id))counts.set(id,(counts.get(id)||0)+1);
 return data.artworks.filter(a=>counts.has(a.id)).map(a=>({...a,points:counts.get(a.id)||0})).sort((a,b)=>b.points-a.points || a.id.localeCompare(b.id));
};
