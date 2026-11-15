/* PDF & Email Export (dengan filter checklist chart & fallback otomatis) */
const LIM={vis:[800,5000],ceil:[500,1500],xw:[15,20],gust:25};
const RWY={WICC:110,WIII:70,WIHH:60,WICA:110,WARR:100,WAHH:90,WADD:90,WAAA:130};
const toast=t=>{const e=document.createElement('div');e.className='toast';e.textContent=t;document.body.append(e);setTimeout(()=>e.remove(),4500)};

init.vis=loadVis;

const ensureJsPDF=async()=>{
 if(window.jspdf?.jsPDF)return window.jspdf.jsPDF;
 for(const src of[
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js'
 ]){
  try{
   await new Promise((res,rej)=>{
    const s=document.createElement('script');s.src=src;s.onload=res;s.onerror=rej;document.head.appendChild(s);
   });
   if(window.jspdf?.jsPDF)return window.jspdf.jsPDF;
  }catch{}
 }
 return null;
};

const imgData=async u=>{
 const cleanU=u.split('?')[0];
 const sep=u.includes('?')?'&':'?';
 const candidates=[
  API+'/api/img?u='+encodeURIComponent(u),
  API+'/api/img?u='+encodeURIComponent(cleanU),
  u+sep+'t='+Date.now()
 ];
 for(const s of candidates){
  try{
   const r=await fetch(s,{signal:AbortSignal.timeout(15000)});
   if(!r.ok)continue;
   const b=await r.blob();
   const i=await createImageBitmap(b);
   const c=document.createElement('canvas');c.width=i.width;c.height=i.height;
   const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);x.drawImage(i,0,0);
   return{d:c.toDataURL('image/jpeg',.85),w:i.width,h:i.height};
  }catch{}
 }
 return new Promise(res=>{
  const im=new Image();im.crossOrigin='anonymous';
  im.onload=()=>{
   try{
    const c=document.createElement('canvas');c.width=im.naturalWidth;c.height=im.naturalHeight;
    const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);x.drawImage(im,0,0);
    res({d:c.toDataURL('image/jpeg',.85),w:c.width,h:c.height});
   }catch{res(null)}
  };
  im.onerror=()=>res(null);
  im.src=cleanU+'?cors='+Date.now();
 });
};

function getSelectedFigs(){
 const satList=(S.sat&&S.sat.pdf!==false)?[[
  'Citra Satelit Himawari-9 (Enhanced IR)',
  S.sat.u,
  'Warna merah, ungu dan putih menandakan puncak awan sangat dingin dan tinggi, biasanya awan hujan/CB. Area ini sebaiknya dihindari.'
 ]]:[];
 const stList=(S.st&&S.st.pdf!==false)?[[
  'Streamline 3000 ft',
  S.st.u,
  'Garis menunjukkan arah aliran angin di ketinggian sekitar 3.000 ft. Garis yang bertemu atau berputar menandakan pertemuan angin yang memicu awan.'
 ]]:[];
 const wtList=(S.ch||[]).filter(c=>c.pdf!==false).map(c=>[
  'Wind & Temp '+c.l+' valid '+c.h+' UTC',
  c.u,
  'Panah/barb menunjukkan arah dan kecepatan angin pada level ini, angka menunjukkan suhu. Gunakan untuk memilih level jelajah.'
 ]);
 const visList=(S.visCharts||[]).filter(c=>c.pdf!==false).map(c=>[
  `${c.label||'Visibility METAR'} — ${c.t}`,
  c.u+(c.u.includes('?')?'&':'?')+'id='+Math.floor(Math.random()*9e6+1e6),
  c.tp==='visibility_fu'
   ?'Prakiraan jarak pandang (Visibility FU) dari BMKG Aviation untuk memantau potensi penurunan visibilitas.'
   :'Titik hijau menandakan visibilitas > 5 km, kuning 2–5 km, oranye 1–2 km, dan merah < 1 km.'
 ]);
 return[...satList,...stList,...wtList,...visList];
}

async function buildPDF(){
 const JsPDF=await ensureJsPDF();
 if(!JsPDF)throw Error('JSPDF_UNAVAILABLE');
 const P=new JsPDF({unit:'mm',format:'a4'}),W=210,Mg=14,CW=W-2*Mg;let y=0,pg=1;
 const foot=()=>{P.setFontSize(8);P.setTextColor(120,140,170);P.text('PTDI Flight Weather Briefing · Hal. '+pg,W/2,291,{align:'center'})},np=()=>{foot();P.addPage();pg++;y=18},ens=h=>{if(y+h>280)np()};
 const txt=(t,s=9.5,c=[11,42,82],b=0,x=Mg,w=CW)=>{P.setFont('helvetica',b?'bold':'normal');P.setFontSize(s);P.setTextColor(...c);P.splitTextToSize(String(t),w).forEach(l=>{ens(s*.45);P.text(l,x,y);y+=s*.46})};
 const h2=t=>{ens(16);y+=3;P.setFillColor(255,122,0);P.rect(Mg,y-4.5,1.6,6,'F');txt(t,13,[11,42,82],1,Mg+4);y+=1.5};
 const note=t=>{const L=P.splitTextToSize('Cara membaca: '+t,CW-8),h=L.length*4+4;ens(h+2);P.setFillColor(234,244,255);P.roundedRect(Mg,y-3,CW,h,2,'F');P.setFontSize(8.5);P.setTextColor(40,80,130);P.setFont('helvetica','normal');L.forEach((l,i)=>P.text(l,Mg+4,y+i*4));y+=h+2};
 P.setFillColor(20,121,255);P.rect(0,0,W,40,'F');P.setFillColor(0,179,214);P.triangle(120,0,W,0,W,40,'F');P.setFillColor(255,196,60);P.circle(190,12,7,'F');
 P.setTextColor(255,255,255);P.setFont('helvetica','bold');P.setFontSize(21);P.text('Official Flight Weather Briefing',Mg,18);P.setFont('helvetica','normal');P.setFontSize(10);P.text('PT Dirgantara Indonesia · Flight Test Operations · Data: BMKG',Mg,26);P.text('Dibuat '+new Date().toISOString().slice(0,16).replace('T',' ')+' UTC',Mg,33);y=52;
 const M=S.metar||[];
 if(M.length){
  h2('METAR / TAF');
  M.forEach(r=>{
   txt(r.c+' — '+r.n,10,[11,42,82],1);
   P.setFont('courier','normal');
   txt(r.m||'METAR tidak tersedia',9,[30,45,70]);
   txt(r.t||'TAF tidak tersedia',9,[30,45,70]);
   y+=3;
  });
 }
 const figs=getSelectedFigs();
 if(!M.length&&!figs.length){
  txt('Belum ada data atau chart yang dipilih untuk dicantumkan ke PDF. Buka menu METAR/TAF, Satelit, Streamline, Wind/Temp, atau Visibility METAR terlebih dahulu.',10,[211,36,58]);
 }
 for(const[t,u,e]of figs){
  if(!u)continue;
  np();h2(t);
  const g=await imgData(u);
  if(g){
   const w=Math.min(CW,(g.w/g.h)*185),h=w*g.h/g.w;
   ens(h);P.addImage(g.d,'JPEG',Mg+(CW-w)/2,y,w,h);y+=h+3;
  }else{
   txt('Gambar tidak dapat dirender otomatis ke canvas (CORS/server offline). Lihat langsung di BMKG:',9,[211,36,58]);
   txt(u,8,[20,121,255]);
  }
  txt('Sumber: BMKG',8,[120,140,170]);
  note(e);
 }
 foot();
 return P;
}

function buildPrintableReport(){
 const fg=(l,u)=>`<figure><figcaption>${l}</figcaption><img class="f" src="${u}"><div class="sr">Sumber: BMKG</div></figure>`;
 const sec=(t,b)=>b?`<section><h2>${t}</h2>${b}</section>`:'';
 const M=S.metar||[];
 const visList=(S.visCharts||[]).filter(c=>c.pdf!==false);
 const wtList=(S.ch||[]).filter(c=>c.pdf!==false);
 return `<div class="cov"><img src="gambar/logo%20ptdi.webp"><img src="gambar/logo%20bmkg.jpg"><img src="gambar/logo%20itb.webp"><div><h1>Official Flight Weather Briefing</h1><small>PT Dirgantara Indonesia · Flight Test Operations FT2000 · Data: BMKG</small></div><div class="r">Dibuat<br><b>${new Date().toISOString().slice(0,16).replace('T',' ')} UTC</b><br>Status: VERIFIED OPERATIONAL</div></div>`
  +sec('1. Multi-Aerodrome METAR / TAF',M.length?M.map(r=>`<div style="margin-bottom:10px"><b>${r.c}</b> — <small>${r.n}</small><div style="font:11px/1.45 'IBM Plex Mono',monospace;white-space:pre-wrap;margin-top:3px">${/^(METAR|SPECI)/.test(r.m)?r.m:'METAR '+(r.m||'-')}
${/^TAF/.test(r.t)?r.t:'TAF '+(r.t||'-')}</div></div>`).join(''):'')
  +sec('2. Himawari-9 Satellite Imagery',(S.sat&&S.sat.pdf!==false)?fg('Himawari-9 Enhanced IR — '+S.sat.t,S.sat.u):'')
  +sec('3. Streamline Analysis (3000 Ft Layer)',(S.st&&S.st.pdf!==false)?fg(S.st.l,S.st.u):'')
  +sec('4. Upper Air Wind &amp; Temperature Charts',wtList.map(c=>fg(c.l+' — '+c.h+' UTC',c.u)).join(''))
  +sec('5. Visibility METAR',visList.map(c=>fg(`${c.label||'Visibility METAR'} — ${c.t}`,c.u+'?id='+Math.floor(Math.random()*9e6+1e6))).join(''))
  +'<div class="nt">Dokumen pendukung briefing. Data wajib dicocokkan dengan kantor meteorologi penerbangan resmi BMKG sebelum operasi.</div>';
}

exportPDF=async function(){
 const b=$('#xp'),o=b.innerHTML;
 b.textContent='Membuat PDF…';b.disabled=true;
 try{
  const P=await buildPDF();
  P.save(`Flight_Weather_Briefing_${new Date().toISOString().slice(0,10)}.pdf`);
  toast('PDF berhasil diunduh');
 }catch(e){
  $('#rep').innerHTML=buildPrintableReport();
  await new Promise(r=>setTimeout(r,800));
  window.print();
 }finally{
  b.innerHTML=o;b.disabled=false;
 }
};

sendMail=async function(){
 const e=prompt('Masukkan alamat email tujuan untuk mengirim PDF briefing:');
 if(!e)return;
 const trimmed=e.trim();
 if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed)){
  toast('Format alamat email tidak valid.');
  return;
 }
 const b=$('#xm'),o=b?b.innerHTML:'';
 if(b){b.textContent='Menyiapkan PDF…';b.disabled=true;}
 const fname=`Flight_Weather_Briefing_${new Date().toISOString().slice(0,10)}.pdf`;
 try{
  const P=await buildPDF();
  const pdfBase64=P.output('datauristring').split(',')[1];
  try{
   const r=await fetch(API+'/send-email',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({email:trimmed,pdf:pdfBase64,filename:fname}),
    signal:AbortSignal.timeout(12000)
   });
   const j=await r.json();
   if(r.ok){
    toast(j.message||('PDF berhasil dikirim ke '+trimmed));
    return;
   }
  }catch{}
  // Fallback otomatis: unduh PDF & buka client email / Gmail compose dengan lampiran siap dilampirkan
  P.save(fname);
  const subj=encodeURIComponent('Official Flight Weather Briefing Report - PTDI');
  const body=encodeURIComponent(`Yth. Penerima,

Terlampir dokumen PDF Official Flight Weather Briefing (${fname}) yang telah diunduh otomatis.
Silakan lampirkan file ${fname} dari folder Downloads Anda.

Salam,
PTDI Flight Test Operations`);
  toast(`PDF (${fname}) diunduh. Membuka email ke ${trimmed}…`);
  setTimeout(()=>{
   window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(trimmed)}&su=${subj}&body=${body}`,'_blank','noopener');
  },600);
 }catch(err){
  toast('Gagal menyiapkan PDF untuk email.');
 }finally{
  if(b){b.innerHTML=o;b.disabled=false;}
 }
};
