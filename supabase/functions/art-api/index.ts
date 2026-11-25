import { createClient } from 'npm:@supabase/supabase-js@2';

const url = Deno.env.get('SUPABASE_URL') || '';
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const adminPassword = Deno.env.get('ART_ADMIN_PASSWORD') || '';
const originAllow = new Set(['https://m2s00l.github.io', 'http://localhost:5173', 'http://127.0.0.1:5173']);
const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const enc = new TextEncoder();
const ttlMs = 12 * 60 * 60 * 1000;

type Actor = { studentId: string | null; admin: boolean };
function json(payload: unknown, status = 200, origin = ''): Response {
  const allowed = originAllow.has(origin) ? origin : 'https://m2s00l.github.io';
  return new Response(JSON.stringify(payload), {
    status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': allowed, 'Vary': 'Origin', 'Cache-Control': 'no-store', 'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info', 'Access-Control-Allow-Methods': 'POST,OPTIONS' },
  });
}
async function hash(value: string) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(value)))).map(x => x.toString(16).padStart(2, '0')).join('');
}
function token() { const b = crypto.getRandomValues(new Uint8Array(32)); return Array.from(b).map(x => x.toString(16).padStart(2, '0')).join(''); }
function ok<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw Error(result.error.message);
  return result.data as T;
}
async function issue(studentId: string | null, admin: boolean) {
  const value = token();
  ok(await db.from('app_sessions').insert({ token_hash: await hash(value), student_id: studentId, is_admin: admin, expires_at: new Date(Date.now() + ttlMs).toISOString() }));
  return value;
}
async function actor(req: Request): Promise<Actor> {
  const value = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
  if (!/^[0-9a-f]{64}$/.test(value)) throw Error('로그인이 필요합니다.');
  const row = ok(await db.from('app_sessions').select('student_id,is_admin,expires_at').eq('token_hash', await hash(value)).maybeSingle());
  if (!row || new Date(row.expires_at).getTime() < Date.now()) throw Error('로그인이 만료되었습니다. 다시 로그인해 주세요.');
  return { studentId: row.student_id, admin: row.is_admin };
}
function requireAdmin(a: Actor) { if (!a.admin) throw Error('관리자만 사용할 수 있습니다.'); }
function requireStudent(a: Actor) { if (!a.studentId || a.admin) throw Error('학생 로그인이 필요합니다.'); return a.studentId; }
function phaseFromDb(value: string) { return ({ registration: 'upload', review: 'review', voting: 'vote', closed: 'closed', results: 'results' } as Record<string,string>)[value] || 'upload'; }
function phaseToDb(value: string) { return ({ upload: 'registration', review: 'review', vote: 'voting', closed: 'closed', results: 'results' } as Record<string,string>)[value]; }

async function snapshot(a: Actor) {
  const settings = ok(await db.from('settings').select('phase').eq('id', 1).single());
  const phase = phaseFromDb(settings.phase);
  const works = ok(await db.from('artworks').select('id,student_id,category_id,title,image_path,created_at').order('created_at', { ascending: false }).limit(1000));
  const paths = works.map((x: any) => x.image_path);
  const signed = paths.length ? ok(await db.storage.from('artworks').createSignedUrls(paths, 60 * 60)) : [];
  const imageUrl = new Map(paths.map((p: string,i: number) => [p, signed[i]?.signedUrl || '']));
  const publicWorks = works.map((x: any) => ({ id:x.id, categoryId:x.category_id, ownerId: x.student_id === a.studentId ? 'ME' : '', title:x.title, image:imageUrl.get(x.image_path) || '', createdAt:new Date(x.created_at).getTime(), approved:true }));
  let me = null;
  let myVotes: Record<number,string[]> = {1:[],2:[],3:[],4:[],5:[]};
  let submitted = false;
  if (a.studentId) {
    const student = ok(await db.from('students').select('student_number,name').eq('id',a.studentId).single());
    me = { id:student.student_number, name:student.name, nickname:student.name };
    submitted = !!ok(await db.from('vote_submissions').select('student_id').eq('student_id',a.studentId).maybeSingle());
    if (submitted) {
      const myRows = ok(await db.from('votes').select('artwork_id,artworks(category_id)').eq('voter_id',a.studentId));
      for (const v of myRows as any[]) {
        const c = v.artworks?.category_id;
        if (myVotes[c]) myVotes[c].push(v.artwork_id);
      }
    }
  }
  let rankings: Record<number, { id:string; points:number }[]> | undefined;
  if (a.admin || phase === 'results') {
    const rows = ok(await db.from('votes').select('artwork_id').limit(10000));
    const count: Record<string,number> = {};
    for (const row of rows) count[row.artwork_id] = (count[row.artwork_id] || 0) + 1;
    rankings = {1:[],2:[],3:[],4:[],5:[]};
    for (const work of works) rankings[work.category_id].push({id:work.id,points:count[work.id]||0});
    Object.values(rankings).forEach(list => list.sort((x,y) => y.points - x.points || x.id.localeCompare(y.id)));
  }
  let students: { id:string; name:string; nickname:string; submitted:boolean }[] = [];
  if (a.admin) {
    const persons = ok(await db.from('students').select('id,student_number,name').order('student_number').limit(1000));
    const completion = ok(await db.from('vote_submissions').select('student_id').limit(1000));
    const completed = new Set(completion.map((x:any) => x.student_id));
    students = persons.map((x:any) => ({id:x.student_number,name:x.name,nickname:x.name,submitted:completed.has(x.id)}));
    const numMap = new Map(persons.map((x:any) => [x.id,x.student_number]));
    publicWorks.forEach((x:any,i:number) => x.ownerId = numMap.get(works[i].student_id) || '');
  }
  return { phase, artworks:publicWorks, student:me, submitted, myVotes, rankings, students };
}

async function handle(req: Request, origin: string) {
  const body = await req.json();
  const action = String(body.action || '');
  if (action === 'student-login') {
    const number = String(body.studentNumber || '').trim();
    const name = String(body.name || '').trim();
    if (!/^\d{4,8}$/.test(number) || name.length < 1 || name.length > 50) throw Error('학번과 이름을 정확하게 입력해 주세요.');
    const found = ok(await db.from('students').select('id,name').eq('student_number',number).maybeSingle());
    if (!found || found.name !== name) throw Error('학생 명단에 일치하는 학번과 이름이 없습니다.');
    return { token:await issue(found.id,false) };
  }
  if (action === 'admin-login') {
    if (!adminPassword || adminPassword.length < 12) throw Error('서버의 ART_ADMIN_PASSWORD를 12자 이상으로 설정해야 합니다.');
    const sourceHash = await hash((req.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim() + ':admin');
    const recent = ok(await db.from('admin_login_attempts').select('*').eq('source_hash',sourceHash).maybeSingle());
    if (recent && Date.now() - new Date(recent.window_start).getTime() < 15*60*1000 && recent.attempts >= 8) throw Error('관리자 로그인 시도 횟수를 초과했습니다. 15분 뒤 다시 시도하세요.');
    if (String(body.password || '') !== adminPassword) {
      const inWindow = !!recent && Date.now() - new Date(recent.window_start).getTime() < 15*60*1000;
      ok(await db.from('admin_login_attempts').upsert({ source_hash:sourceHash, attempts:inWindow ? recent.attempts+1 : 1, window_start: inWindow ? recent.window_start : new Date().toISOString() }));
      throw Error('관리자 비밀번호가 올바르지 않습니다.');
    }
    ok(await db.from('admin_login_attempts').delete().eq('source_hash',sourceHash));
    return {token:await issue(null,true)};
  }
  const a = await actor(req);
  if (action === 'snapshot') return await snapshot(a);
  if (action === 'logout') {
    const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i,'') || '';
    ok(await db.from('app_sessions').delete().eq('token_hash',await hash(bearer)));
    return {success:true};
  }
  if (action === 'save-artwork') {
    const studentId = requireStudent(a);
    const settings = ok(await db.from('settings').select('phase').eq('id',1).single());
    if (settings.phase !== 'registration') throw Error('작품 등록 기간이 아닙니다.');
    const category = Number(body.categoryId);
    const title = String(body.title || '').trim();
    const editingId = body.editingId ? String(body.editingId) : null;
    if (![1,2,3,4,5].includes(category) || !title || title.length > 100) throw Error('섹션과 제목을 확인해 주세요.');
    let old = null;
    if (editingId) {
      old = ok(await db.from('artworks').select('id,student_id,category_id,image_path').eq('id',editingId).maybeSingle());
      if (!old || old.student_id !== studentId) throw Error('본인 작품만 수정할 수 있습니다.');
    }
    const path = `${studentId}/${category}-${crypto.randomUUID()}.webp`;
    let newPath: string | null = null;
    if (body.image) {
      const image = String(body.image);
      if (!/^data:image\/webp;base64,[A-Za-z0-9+/=]+$/.test(image)) throw Error('WebP 이미지 형식만 허용됩니다.');
      const bytes = Uint8Array.from(atob(image.split(',')[1]), c=>c.charCodeAt(0));
      if (bytes.length > 1500000) throw Error('압축된 작품 이미지가 1.5MB를 초과했습니다.');
      ok(await db.storage.from('artworks').upload(path, bytes, {contentType:'image/webp', upsert:false}));
      newPath = path;
    }
    if (!newPath && !old) throw Error('작품 이미지를 첨부해 주세요.');
    try {
      if (old) {
        if (old.category_id !== category) {
          const exists = ok(await db.from('artworks').select('id').eq('student_id',studentId).eq('category_id',category).maybeSingle());
          if (exists && exists.id !== editingId) throw Error('해당 섹션에 이미 등록한 작품이 있습니다.');
        }
        ok(await db.from('artworks').update({category_id:category,title,image_path:newPath || old.image_path,updated_at:new Date().toISOString()}).eq('id',old.id).eq('student_id',studentId));
        if (newPath) await db.storage.from('artworks').remove([old.image_path]);
      } else {
        ok(await db.from('artworks').insert({student_id:studentId,category_id:category,title,image_path:newPath}));
      }
    } catch(e) {
      if (newPath) await db.storage.from('artworks').remove([newPath]);
      throw e;
    }
    return {success:true};
  }
  if (action === 'delete-artwork') {
    const id = String(body.artworkId || '');
    const existing = ok(await db.from('artworks').select('id,student_id,image_path').eq('id',id).maybeSingle());
    if (!existing) throw Error('작품을 찾을 수 없습니다.');
    if (!a.admin) {
      requireStudent(a);
      if (existing.student_id !== a.studentId) throw Error('본인 작품만 삭제할 수 있습니다.');
      const setting = ok(await db.from('settings').select('phase').eq('id',1).single());
      if (setting.phase !== 'registration') throw Error('작품 등록 기간이 아닙니다.');
    }
    ok(await db.from('artworks').delete().eq('id',id));
    await db.storage.from('artworks').remove([existing.image_path]);
    return {success:true};
  }
  if (action === 'submit') {
    const studentId = requireStudent(a);
    const ballot = body.ballot;
    if (!Array.isArray(ballot) || ballot.some(x => typeof x !== 'string' || !/^[0-9a-f-]{36}$/i.test(x))) throw Error('투표 데이터가 올바르지 않습니다.');
    ok(await db.rpc('submit_art_ballot',{p_student:studentId,p_ballot:ballot}));
    return {success:true};
  }
  if (action === 'phase') {
    requireAdmin(a);
    const phase = phaseToDb(String(body.phase));
    if (!phase) throw Error('잘못된 운영 단계입니다.');
    ok(await db.from('settings').update({phase,updated_at:new Date().toISOString()}).eq('id',1));
    return {success:true};
  }
  if (action === 'import-students') {
    requireAdmin(a);
    const students = body.students;
    if (!Array.isArray(students) || students.length < 1 || students.length > 500 || students.some(x=>!/^\d{4,8}$/.test(x.id)||!x.name||x.name.length>50)) throw Error('학생 명단을 확인해 주세요.');
    const dedup = Array.from(new Map(students.map((x:any)=>[x.id,{student_number:x.id,name:x.name}])).values());
    ok(await db.from('students').upsert(dedup, {onConflict:'student_number'}));
    return {success:true,count:dedup.length};
  }
  throw Error('지원하지 않는 요청입니다.');
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin') || '';
  if (req.method === 'OPTIONS') return json({},200,origin);
  if (req.method !== 'POST') return json({error:'POST 요청만 허용됩니다.'},405,origin);
  if (!originAllow.has(origin)) return json({error:'허용되지 않은 웹사이트 주소입니다.'},403,origin);
  try {
    if (!url || !serviceKey) throw Error('Supabase 환경 변수가 없습니다.');
    return json(await handle(req,origin),200,origin);
  } catch(e) {
    const message = e instanceof Error ? e.message : '요청 처리에 실패했습니다.';
    return json({error:message},400,origin);
  }
});
