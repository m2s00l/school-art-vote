const projectUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const endpoint = projectUrl ? `${projectUrl.replace(/\/$/,'')}/functions/v1/art-api` : '';
const KEY = 'art_vote_v4_session';
export function savedToken() { return sessionStorage.getItem(KEY) || ''; }
export function setToken(value: string) { sessionStorage.setItem(KEY,value); }
export function forgetToken() { sessionStorage.removeItem(KEY); }
export function configured() { return !!projectUrl; }
export async function api<T>(action:string, body: Record<string,unknown> = {}, access = savedToken()):Promise<T> {
  if (!endpoint) throw Error('Supabase 연결 주소가 설정되지 않았습니다. README의 배포 설정을 확인하세요.');
  const controller = new AbortController();
  const timer = setTimeout(()=>controller.abort(),35000);
  try {
    const r = await fetch(endpoint,{
      method:'POST',signal:controller.signal,
      headers:{'Content-Type':'application/json', ...(access ? {Authorization:`Bearer ${access}`} : {})},
      body:JSON.stringify({action,...body}),
      cache:'no-store',
    });
    const data = await r.json();
    if (!r.ok) throw Error(data.error || '서버 요청에 실패했습니다.');
    return data as T;
  } catch(e) {
    if ((e as Error).name === 'AbortError') throw Error('서버 응답이 지연되고 있습니다. 다시 시도해 주세요.');
    throw e;
  } finally {clearTimeout(timer);}
}
export type Snapshot = {
 phase:'upload'|'review'|'vote'|'closed'|'results';
 artworks: {id:string; categoryId:number;ownerId:string;title:string;image:string;createdAt:number;approved:boolean}[];
 student: {id:string;name:string;nickname:string}|null;
 submitted:boolean;
 myVotes: Record<number,string[]>;
 rankings?: Record<number,{id:string;points:number}[]>;
 students:{id:string;name:string;nickname:string;submitted:boolean}[];
};
