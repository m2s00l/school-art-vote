import type { Artwork, Category, DemoData, Student, Votes } from '../types';
export const categories: Category[] = [
 {id:1,title:'멸종위기 동물 드로잉',en:'ENDANGERED ANIMALS',subtitle:'',color:'#ededeb'},
 {id:2,title:'미래의 방 공간 디자인',en:'FUTURE ROOM',subtitle:'',color:'#e7e7e5'},
 {id:3,title:'K캐릭터',en:'K-CHARACTER',subtitle:'',color:'#efefed'},
 {id:4,title:'인체 드로잉',en:'FIGURE DRAWING',subtitle:'',color:'#e9e9e7'},
 {id:5,title:'전래동화 표지 디자인',en:'FOLKTALE COVER',subtitle:'',color:'#e5e5e3'},
];
export const initialDemo = ():DemoData=>({phase:'upload',categories,artworks:[],students:[],submissions:[]});
export const emptyVotes = ():Votes=>({1:[],2:[],3:[],4:[],5:[]});
export const phaseLabels:Record<DemoData['phase'],string>={upload:'작품 등록',review:'작품 검토',vote:'투표 진행',closed:'투표 마감',results:'결과 공개'};
export const STORAGE_KEY='school_art_vote_demo_v2';
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
