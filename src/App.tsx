import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, ArrowUpRight, Check, CheckCircle2, Download, Eye, FileImage, Grid2X2, ImagePlus, LayoutDashboard, LogOut, Menu, Pencil, Plus, Search, Settings2, ShieldAlert, Shuffle, Sparkles, Trash2, Trophy, Users, Vote, X } from 'lucide-react';
import { categories, downloadCsv, emptyVotes, makeWebp, phaseLabels, shuffleStable } from './lib/demo';
import { api, configured, forgetToken, savedToken, setToken, type Snapshot } from './lib/api';
import type { Artwork, Phase, Screen, Student, Votes, Category } from './types';

const blank:Snapshot = {phase:'upload',artworks:[],student:null,submitted:false,myVotes:emptyVotes(),students:[]};

function App(){
 const [data,setData] = useState<Snapshot>(blank);
 const [screen,setScreen] = useState<Screen>('home');
 const [student,setStudent] = useState<Student|null>(null);
 const [isAdmin,setAdmin] = useState(false);
 const [currentCategory,setCurrentCategory] = useState(1);
 const [votes,setVotes] = useState<Votes>(emptyVotes());
 const [enterId,setEnterId] = useState(''); const [enterName,setEnterName] = useState('');
 const [adminPass,setAdminPass] = useState('');
 const [notice,setNotice] = useState(''); const [busy,setBusy] = useState(false);
 const [preview,setPreview] = useState<Artwork|null>(null);
 const [uploadCategory,setUploadCategory] = useState(1);const [uploadTitle,setUploadTitle] = useState('');const [uploadImage,setUploadImage] = useState('');const [editingId,setEditingId] = useState<string|null>(null);
 const [adminTab,setAdminTab] = useState<'overview'|'artworks'|'students'|'results'>('overview');
 const [csvText,setCsvText] = useState('');const [filter,setFilter] = useState('');const [confirmSubmit,setConfirmSubmit]=useState(false);
 const [mobileOpen,setMobileOpen] = useState(false);const [ready,setReady] = useState(false);
 const page=(s:Screen)=>{setScreen(s);setMobileOpen(false);window.scrollTo({top:0,behavior:'smooth'});};
 const refresh=async(access?:string,admin?:boolean)=>{
  const next=await api<Snapshot>('snapshot',{},access);
  setData(next);
  if(admin === true) {setAdmin(true);setStudent(null);}
  else if(admin === false || next.student) {setAdmin(false);setStudent(next.student);}
  return next;
 };
 useEffect(()=>{
  let live=true;
  (async()=>{
   if(savedToken()) {
    try {
     const next=await api<Snapshot>('snapshot');
     if(!live)return;
     setData(next);
     if(next.student) {setStudent(next.student);setAdmin(false);page('upload');}
     else {setAdmin(true);page('admin');}
    } catch {forgetToken();}
   }
   if(live)setReady(true);
  })();
  return()=>{live=false;};
 },[]);
 useEffect(()=>{if(!notice)return;const id=setTimeout(()=>setNotice(''),6500);return()=>clearTimeout(id);},[notice]);
 const task=async(fn:()=>Promise<void>)=>{setBusy(true);try{await fn();}catch(e){setNotice(e instanceof Error?e.message:'오류가 발생했습니다.');}finally{setBusy(false);}};
 const enter=()=>task(async()=>{
  if(!/^\d{4,8}$/.test(enterId.trim())||!enterName.trim()) throw Error('학번과 이름을 정확하게 입력해 주세요.');
  const result=await api<{token:string}>('student-login',{studentNumber:enterId.trim(),name:enterName.trim()});
  setToken(result.token);
  const next=await refresh(result.token,false);
  setVotes(next.myVotes||emptyVotes());page('upload');setNotice('로그인되었습니다. 작품과 투표 기록은 서버에 저장됩니다.');
 });
 const loginAdmin=()=>task(async()=>{
  const result=await api<{token:string}>('admin-login',{password:adminPass});
  setToken(result.token);setAdminPass('');await refresh(result.token,true);page('admin');setNotice('관리자로 로그인했습니다.');
 });
 const leave=()=>task(async()=>{
  try{await api('logout');}catch{}
  forgetToken();setStudent(null);setAdmin(false);setData(blank);setVotes(emptyVotes());setEnterId('');setEnterName('');page('home');
 });
 const personalArt=data.artworks.filter(a=>a.ownerId==='ME');
 const shown=useMemo(()=>shuffleStable(data.artworks.filter(a=>a.categoryId===currentCategory&&a.approved),student?.id||'guest',currentCategory),[data.artworks,currentCategory,student?.id]);
 const selectedVotes=data.submitted?data.myVotes:votes;
 const selectedCount=Object.values(selectedVotes).reduce((sum,ids)=>sum+ids.length,0);
 const canVote=!!student&&data.phase==='vote'&&!data.submitted;
 const canUpload=!!student&&data.phase==='upload';
 const resultsVisible=data.phase==='results'||isAdmin;
 const choose=(id:string,category=currentCategory)=>{
  if(!canVote){setNotice('현재는 투표를 선택할 수 없습니다.');return;}
  const artwork=data.artworks.find(a=>a.id===id);
  if(!artwork)return;
  if(artwork.ownerId==='ME'){setNotice('본인의 작품에는 투표할 수 없습니다.');return;}
  setVotes(prev=>{
   const old=prev[category]||[];
   if(old.includes(id))return {...prev,[category]:old.filter(x=>x!==id)};
   if(old.length>=3){setNotice('섹션별 최대 3개까지 선택할 수 있습니다.');return prev;}
   return {...prev,[category]:[...old,id]};
  });
 };
 const submit=()=>task(async()=>{
  if(!canVote)return;
  const ballot=Object.values(votes).flat();
  if(ballot.length<1||ballot.length>15)throw Error('1~15개의 작품을 선택해 주세요.');
  await api('submit',{ballot});
  const next=await refresh();setVotes(next.myVotes||emptyVotes());setConfirmSubmit(false);page('my-votes');setNotice('최종 투표가 서버에 저장되었습니다.');
 });
 const onImage=(file?:File)=>{if(!file)return;task(async()=>{setUploadImage(await makeWebp(file));});};
 const saveArtwork=()=>task(async()=>{
  if(!canUpload)return;
  if(!uploadTitle.trim() || (!uploadImage&&!editingId))throw Error('제목과 작품 사진을 입력해 주세요.');
  await api('save-artwork',{categoryId:uploadCategory,title:uploadTitle.trim(),image:uploadImage.startsWith('data:')?uploadImage:undefined,editingId});
  await refresh();setUploadTitle('');setUploadImage('');setEditingId(null);setCurrentCategory(uploadCategory);setNotice('선택한 섹션에 작품이 저장되었습니다.');
 });
 const editArtwork=(a:Artwork)=>{setUploadCategory(a.categoryId);setUploadTitle(a.title);setUploadImage(a.image);setEditingId(a.id);page('upload');};
 const deleteArtwork=(a:Artwork)=>{
  if(!window.confirm(`'${a.title}' 작품을 삭제할까요?`))return;
  task(async()=>{await api('delete-artwork',{artworkId:a.id});await refresh();setPreview(null);setNotice('작품을 삭제했습니다.');});
 };
 const changePhase=(phase:Phase)=>task(async()=>{await api('phase',{phase});await refresh();setNotice(`${phaseLabels[phase]} 단계로 변경했습니다.`);});
 const importStudents=()=>task(async()=>{
  const lines=csvText.split(/\r?\n/).filter(Boolean);
  const students=lines.map(l=>{const [id,name]=l.split(/[\t,]/).map(s=>s.trim());return {id,name};}).filter(x=>/^\d{4,8}$/.test(x.id)&&x.name&&x.name!=='이름');
  if(!students.length)throw Error('학번,이름 형식으로 입력해 주세요.');
  const result=await api<{count:number}>('import-students',{students});
  await refresh();setCsvText('');setNotice(`${result.count}명의 명단을 저장했습니다.`);
 });
 const ranked=(cat:number)=>{
  const list=data.rankings?.[cat]||[];
  return list.map((r,i)=>({...(data.artworks.find(a=>a.id===r.id)||{id:r.id,title:'삭제된 작품',ownerId:''}),points:r.points,rank:i+1}));
 };
 const exportResults=()=>downloadCsv([['구역','순위','작품 ID','제목','학번','득표수'],...categories.flatMap(c=>ranked(c.id).map(a=>[c.title,a.rank,a.id,a.title,a.ownerId,a.points]))],'art-vote-results.csv');
 const exportParticipation=()=>downloadCsv([['학번','이름','투표 여부'],...data.students.map(s=>[s.id,s.name,s.submitted?'완료':'미완료'])],'art-vote-participation.csv');
 const nav:[Screen,string][]=[['upload','작품 등록'],['gallery','투표하기'],['results','투표 결과']];
 return <div className="site">
 <header className="header"><div className="header-inner"><button className="brand" onClick={()=>page('home')}><span>미술 작품 투표</span></button><nav className="desktop-nav">{(student||isAdmin)&&nav.map(([id,label])=><button className={screen===id?'active':''} onClick={()=>page(id)} key={id}>{label}</button>)}</nav><div className="header-actions"><span className="demo-pill"><span className="status-dot"/> 서버 연결</span>{(student||isAdmin)?<button className="user-button" onClick={leave}><span>{student?.name||'관리자'}</span><LogOut size={15}/></button>:null}<button className="icon-button burger" onClick={()=>setMobileOpen(!mobileOpen)} aria-label="메뉴"><Menu size={20}/></button></div></div></header>
 {mobileOpen&&(student||isAdmin)&&<nav className="mobile-nav">{nav.map(([id,label])=><button key={id} onClick={()=>page(id)}>{label}</button>)}{isAdmin&&<button onClick={()=>page('admin')}>관리자</button>}</nav>}
 <main>
 {screen==='home'&&<section className="section login-page"><div className="login-simple"><h1>미술 작품 투표</h1><p>학번과 이름을 입력해 주세요.</p>{!student&&!isAdmin?<div className="login-form-simple"><label>학번<input inputMode="numeric" placeholder="예: 30901" value={enterId} onChange={e=>setEnterId(e.target.value)}/></label><label>이름<input placeholder="이름" value={enterName} onChange={e=>setEnterName(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')enter();}}/></label><button className="btn dark full" disabled={busy||!ready} onClick={enter}>입장하기 <ArrowRight size={17}/></button><p className="login-warning">학번과 이름이 일치하는 학생만 입장합니다. 비밀번호가 없으므로 타인이 학번과 이름을 알고 있다면 대신 접속할 수 있습니다.</p></div>:<div className="welcome-card"><h3>{student?.name||'관리자'}님</h3><button className="btn dark" onClick={()=>page(isAdmin?'admin':'upload')}>시작하기</button></div>}</div></section>}
 {screen==='upload'&&<section className="section page-section"><PageHeading kicker="UPLOAD" title="작품 등록" subtitle="원하는 섹션에만 작품을 등록해도 됩니다."/>{!student&&!isAdmin?<EmptyState text="학생으로 로그인해 주세요."/>:<><CategorySwitch items={categories} value={uploadCategory} onChange={v=>{setUploadCategory(v);setUploadTitle('');setUploadImage('');setEditingId(null);}}/>{student&&<div className="admin-box"><div className="panel-heading"><h3>{editingId?'작품 수정':'작품 새로 등록'}</h3><span>{categories.find(c=>c.id===uploadCategory)?.title}</span></div>{!canUpload&&<p className="warning-note">현재는 작품 등록 기간이 아닙니다.</p>}<label className="form-label">작품 제목<input className="form-input" value={uploadTitle} onChange={e=>setUploadTitle(e.target.value)} maxLength={100} placeholder="작품 제목" disabled={!canUpload||busy}/></label><label className="form-label">작품 사진<input type="file" accept="image/*" disabled={!canUpload||busy} onChange={e=>onImage(e.target.files?.[0])}/></label>{uploadImage&&<img className="upload-preview" src={uploadImage} alt="업로드 미리보기"/>}<button className="btn dark" disabled={!canUpload||busy} onClick={saveArtwork}><ImagePlus size={17}/>{editingId?'변경 저장':'작품 등록'}</button>{editingId&&<button className="mini-button" onClick={()=>{setEditingId(null);setUploadTitle('');setUploadImage('');}}>수정 취소</button>}</div>}<div className="admin-box"><h3>등록된 작품</h3><div className="admin-art-list">{(isAdmin?data.artworks.filter(a=>a.categoryId===uploadCategory):personalArt.filter(a=>a.categoryId===uploadCategory)).map(a=><div className="admin-art-row" key={a.id}><img src={a.image} alt={a.title}/><div><strong>{a.title}</strong><span>{categories.find(c=>c.id===a.categoryId)?.title}</span></div><button className="icon-button" onClick={()=>setPreview(a)} aria-label="작품 보기"><Eye size={17}/></button>{student&&canUpload&&<button className="icon-button" onClick={()=>editArtwork(a)} aria-label="작품 수정"><Pencil size={17}/></button>}{(isAdmin||canUpload)&&<button className="icon-button danger" onClick={()=>deleteArtwork(a)} aria-label="작품 삭제"><Trash2 size={17}/></button>}</div>)}{!(isAdmin?data.artworks:personalArt).some(a=>a.categoryId===uploadCategory)&&<EmptyState text="아직 등록한 작품이 없습니다."/>}</div></div></>}</section>}
 {screen==='gallery'&&<section className="section page-section"><PageHeading kicker="GALLERY" title="투표하기" subtitle="각 섹션에서 최대 3개까지 선택하세요."/><CategorySwitch items={categories} value={currentCategory} onChange={setCurrentCategory}/><div className="gallery-heading"><h2>{categories.find(c=>c.id===currentCategory)?.title}</h2><div className="gallery-meta"><Shuffle size={16}/> 작품 순서 개인별 배치 · {shown.length}개</div></div><div className="gallery-vote-help">{canVote?`선택 ${selectedVotes[currentCategory]?.length||0}/3 · 체크박스로 선택하고 이미지를 누르면 확대됩니다.`:data.submitted?'이미 최종 제출했습니다.':data.phase!=='vote'?'현재 투표 기간이 아닙니다.':'학생으로 로그인해 주세요.'}</div><div className="gallery-grid">{shown.map((a,i)=><ArtworkCard key={a.id} a={a} index={i} onClick={()=>setPreview(a)} vote={selectedVotes[currentCategory]?.includes(a.id)} owner={a.ownerId==='ME'} onVote={canVote?()=>choose(a.id):undefined} showVote={!!student&&data.phase==='vote'}/>)}</div>{!shown.length&&<EmptyState text="현재 섹션에 등록된 작품이 없습니다."/>}{student&&<div className="submit-bar"><div><strong>내가 선택한 작품: {selectedCount} / 15</strong><p>한 섹션에 3개 이하, 전체에서 1개 이상이면 제출할 수 있습니다.</p></div><button className="btn dark" disabled={!canVote||selectedCount<1||busy} onClick={()=>setConfirmSubmit(true)}>최종 투표 제출 <Check size={17}/></button></div>}</section>}
 {screen==='my-votes'&&<section className="section page-section"><PageHeading kicker="MY BALLOT" title="내 투표 확인" subtitle="내가 제출한 작품을 확인하세요."/>{categories.map(c=><div className="admin-box" key={c.id}><h3>{c.title}</h3>{(selectedVotes[c.id]||[]).map(id=><div key={id}>{data.artworks.find(a=>a.id===id)?.title||'작품'}</div>)}</div>)}</section>}
 {screen==='results'&&<section className="section page-section"><PageHeading kicker="RESULTS" title="투표 결과" subtitle="섹션별 작품 순위"/>{!resultsVisible?<EmptyState text="관리자가 투표 결과를 공개한 뒤 확인할 수 있습니다."/>:<><CategorySwitch items={categories} value={currentCategory} onChange={setCurrentCategory}/><div className="result-table"><div className="table-head"><span>순위</span><span>작품</span><span>득표수</span></div>{ranked(currentCategory).map(a=><div className="table-row" key={a.id}><span>{a.rank}위</span><span>{a.title}{a.ownerId==='ME'?' (내 작품)':''}</span><strong>{a.points}표</strong></div>)}</div></>}</section>}
 {screen==='admin'&&<section className="section page-section"><PageHeading kicker="ADMIN" title="관리자" subtitle="운영 단계와 학생 명단을 관리합니다."/>{!isAdmin?<div className="admin-gate"><ShieldAlert size={24}/><h3>관리자 로그인</h3><p>학생용 학번·이름 로그인과 별도로 보호됩니다.</p><input type="password" className="form-input" placeholder="관리자 비밀번호" value={adminPass} onChange={e=>setAdminPass(e.target.value)} onKeyDown={e=>e.key==='Enter'&&loginAdmin()}/><button className="btn dark" onClick={loginAdmin} disabled={busy}>관리자 로그인</button></div>:<><div className="admin-tabs">{([['overview','대시보드'],['artworks','작품 관리'],['students','학생 관리'],['results','결과 관리']] as const).map(([id,label])=><button className={adminTab===id?'active':''} onClick={()=>setAdminTab(id)} key={id}>{label}</button>)}</div>
 {adminTab==='overview'&&<><div className="dashboard-cards"><Metric label="등록 학생" value={data.students.length}/><Metric label="등록 작품" value={data.artworks.length}/><Metric label="투표 완료" value={data.students.filter(s=>s.submitted).length}/><Metric label="참여율" value={`${data.students.length?Math.round(data.students.filter(s=>s.submitted).length/data.students.length*100):0}%`}/></div><div className="admin-box"><h3>운영 단계</h3><div className="phase-buttons">{(['upload','review','vote','closed','results'] as Phase[]).map(p=><button key={p} className={data.phase===p?'active':''} onClick={()=>changePhase(p)} disabled={busy}>{phaseLabels[p]}</button>)}</div></div></>}
 {adminTab==='artworks'&&<div className="admin-box"><h3>작품 관리</h3><div className="search-field"><Search size={17}/><input value={filter} placeholder="제목 또는 학번 검색" onChange={e=>setFilter(e.target.value)}/></div><div className="admin-art-list">{data.artworks.filter(a=>a.title.includes(filter)||a.ownerId.includes(filter)).map(a=><div className="admin-art-row" key={a.id}><img src={a.image} alt={a.title}/><div><strong>{a.title}</strong><span>{categories.find(c=>c.id===a.categoryId)?.title} · {a.ownerId}</span></div><button className="icon-button" onClick={()=>setPreview(a)}><Eye size={17}/></button><button className="icon-button danger" onClick={()=>deleteArtwork(a)}><Trash2 size={17}/></button></div>)}</div></div>}
 {adminTab==='students'&&<div className="admin-two-col"><div className="admin-box"><div className="panel-heading"><h3>학생 명단</h3><button className="mini-button" onClick={exportParticipation}><Download size={15}/> CSV</button></div><div className="student-list">{data.students.map(s=><div className="student-row" key={s.id}><span>{s.id}</span><span>{s.name}</span><span>{s.submitted?'완료':'미완료'}</span></div>)}</div></div><div className="admin-box"><h3>학생 명단 추가·수정</h3><p>학번,이름 형식으로 줄마다 입력</p><textarea rows={9} value={csvText} onChange={e=>setCsvText(e.target.value)} placeholder={'30901,테스트1\n30902,테스트2'}/><button className="btn dark" disabled={busy} onClick={importStudents}>명단 저장</button></div></div>}
 {adminTab==='results'&&<div className="admin-box"><div className="panel-heading"><h3>구역별 순위</h3><button className="mini-button" onClick={exportResults}><Download size={15}/> 결과 CSV</button></div><CategorySwitch items={categories} value={currentCategory} onChange={setCurrentCategory}/><div className="result-table"><div className="table-head"><span>순위</span><span>작품</span><span>득표수</span></div>{ranked(currentCategory).map(a=><div className="table-row" key={a.id}><span>{a.rank}위</span><span>{a.title}</span><strong>{a.points}표</strong></div>)}</div></div>}
 </>}</section>}
 </main>
 <footer className="footer"><div className="footer-inner"><strong>미술 작품 투표</strong><button className="mini-button" onClick={()=>page('admin')}><Settings2 size={14}/> 관리자</button></div></footer>
 {preview&&<div className="modal-backdrop" onMouseDown={()=>setPreview(null)}><div className="art-modal" onMouseDown={e=>e.stopPropagation()}><button className="modal-close" onClick={()=>setPreview(null)}><X size={20}/></button><div className="modal-image"><img src={preview.image} alt={preview.title}/></div><div className="modal-details"><h2>{preview.title}</h2><p>{categories.find(c=>c.id===preview.categoryId)?.title}</p>{canVote&&<button className="btn dark" onClick={()=>choose(preview.id,preview.categoryId)}>{selectedVotes[preview.categoryId]?.includes(preview.id)?'선택 취소':'이 작품 선택'}</button>}</div></div></div>}
 {confirmSubmit&&<div className="modal-backdrop"><div className="confirm-modal"><h2>투표를 최종 제출할까요?</h2><p>총 {selectedCount}개의 작품을 선택했습니다. 제출 후 변경할 수 없습니다.</p><div className="confirm-actions"><button className="btn outline" onClick={()=>setConfirmSubmit(false)}>취소</button><button className="btn dark" onClick={submit} disabled={busy}>제출하기</button></div></div></div>}
 {notice&&<div role="status" className="toast"><Sparkles size={16}/>{notice}<button onClick={()=>setNotice('')}><X size={14}/></button></div>}
 {!configured()&&<div className="toast">Supabase 프로젝트 URL을 설정해 주세요.</div>}
 </div>;
}
function PageHeading({kicker,title,subtitle}:{kicker:string;title:string;subtitle:string}){return <div className="page-heading"><div className="kicker">{kicker}</div><h1>{title}</h1><p>{subtitle}</p></div>;}
function CategorySwitch({items,value,onChange}:{items:Category[];value:number;onChange:(id:number)=>void}){return <div className="category-switch">{items.map(c=><button key={c.id} className={value===c.id?'active':''} onClick={()=>onChange(c.id)}>{c.title}</button>)}</div>;}
function ArtworkCard({a,index,onClick,vote,onVote,showVote,owner}:{a:Artwork;index:number;onClick:()=>void;vote?:boolean;onVote?:()=>void;showVote:boolean;owner:boolean}){
 return <article className={`art-card ${vote?'art-card-selected':''}`}><div className="art-image-wrap"><button className="art-image" onClick={onClick}><img src={a.image} loading="lazy" alt={a.title}/><span className="view-art"><Eye size={17}/> 확대</span></button>{showVote&&<button type="button" className={`vote-checkbox ${vote?'selected':''}`} aria-pressed={!!vote} disabled={!onVote||owner} onClick={e=>{e.stopPropagation();onVote?.();}}><span className="vote-checkbox-icon">{vote&&<Check size={18}/>}</span><span className="vote-checkbox-label">{owner?'내 작품':vote?'선택됨':'선택'}</span></button>}</div><div className="art-description"><span>NO. {String(index+1).padStart(3,'0')}</span><h3>{a.title}</h3></div></article>;
}
function EmptyState({text}:{text:string}){return <div className="empty-state"><FileImage size={32}/><p>{text}</p></div>;}
function Metric({label,value}:{label:string;value:string|number}){return <div className="metric"><div className="metric-header"><span>{label}</span></div><strong>{value}</strong></div>;}
export default App;
