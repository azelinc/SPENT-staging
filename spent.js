(function(){
'use strict';

/* ─── CONFIG ─── */
const STORAGE_VER = 'spent_v1';
const CATEGORIES = [
  'Food & Dining','Groceries','Transport','Shopping',
  'Utilities','Entertainment','Health & Wellness','Home','Others'
];
const CAT_MAP = {
  'food & dining': ['mamak','kfc','mcd','tealive','starbucks','grabfood','foodpanda','nando','pizza','sushi','ramen','nasik','warung','restoran','cafe','kopitiam','dimsum','bakery','7eats','domino'],
  'groceries': ['99 speedmart','aeon','jaya grocer','village grocer','lotus','tesco','mydin','guardian','watson','ekono','mr diy','shell select','petronas mesra','7-eleven','family mart','grocer'],
  'transport': ['grab','shell','petron','petronas','caltex','bp','bhp','touch n go','toll','parking','bas','ktm','lrt','mrt','flight','airasia','mas','firefly','fuel','minyak','petrol','diesel','uber','inDriver'],
  'shopping': ['shopee','lazada','tiktok shop','zalora','h&m','uniqlo','padini','cotton on','nike','adidas','switch','machine','apple','samsung',' Courts','harvey','ikea','mr diy','laptop','phone','watch'],
  'utilities': ['tnb','syabas','indah water','astro','unifi','maxis','digi','celcom','hotlink','umobile','yes','time','tm','electric','water','internet','broadband','phone bill','billplz','utility'],
  'entertainment': ['netflix','spotify','youtube','disney','hbo','prime video','cinema','tickets','concert','gaming','steam','playstation','xbox','bowling','ktv','karaoke','arcade','zoo','aquaria','travel','hotel','agoda','booking','airbnb','trip','cuti'],
  'health & wellness': ['pharmacy','clinic','hospital','dental','physio','gym','fitness','yoga','pilates','saloon','barber','spa','massage','supplement','vitamin','medical','doktor','ubat'],
  'home': ['mortgage','rent','renovation','furniture','cleaning','laundry','repair','plumber','electrician','contractor','security','alarm','cctv','garden','taman','rumah']
};

const QUICK_TILES = [
  { merchant: 'Grab', category: 'Transport' },
  { merchant: 'Shell', category: 'Transport' },
  { merchant: '99 Speedmart', category: 'Groceries' },
  { merchant: 'Shopee', category: 'Shopping' },
  { merchant: 'Foodpanda', category: 'Food & Dining' },
  { merchant: 'Tealive', category: 'Food & Dining' },
  { merchant: 'Jaya Grocer', category: 'Groceries' },
  { merchant: 'TNB', category: 'Utilities' },
  { merchant: 'Unifi', category: 'Utilities' },
  { merchant: 'Netflix', category: 'Entertainment' },
  { merchant: 'Mamak', category: 'Food & Dining' },
  { merchant: 'Petronas', category: 'Transport' }
];

/* ─── STATE ─── */
let currentUser = null;
let amountStr = '';

/* ─── HELPERS ─── */
function $(id){ return document.getElementById(id); }
function hash(s){ let h=0; for(let i=0;i<s.length;i++) h=((h<<5)-h)+s.charCodeAt(i)|0; return Math.abs(h).toString(36); }
function lsKey(user){ return `${STORAGE_VER}_${hash(user.name.toLowerCase())}`; }
function now(){ return new Date(); }
function fmtDate(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function fmtMoney(n){ return 'RM '+n.toFixed(2); }
function parseMoney(s){ const v=parseFloat(s); return isNaN(v)?0:v; }
function esc(s){ const d=document.createElement('div'); d.textContent=s; return d.innerHTML; }

function getData(user){
  const raw=localStorage.getItem(lsKey(user));
  return raw?JSON.parse(raw):{pin:user.pin, expenses:[], settings:{}};
}
function setData(user,data){ localStorage.setItem(lsKey(user),JSON.stringify(data)); }

function detectCategory(merchant){
  const m=merchant.toLowerCase();
  for(const[cat,keywords] of Object.entries(CAT_MAP)){
    if(keywords.some(k=>m.includes(k))) return cat.replace(/\b\w/g,l=>l.toUpperCase()).replace('&',' & ').replace('N Go','N Go');
  }
  return 'Others';
}

/* ─── USERS ─── */
function getAllUsers(){
  const users=[];
  for(let i=0;i<localStorage.length;i++){
    const key=localStorage.key(i);
    if(key&&key.startsWith(STORAGE_VER+'_')){
      try{
        const d=JSON.parse(localStorage.getItem(key));
        // recover name from key hash? no — we don't have reverse hash.
        // instead scan keys for name in settings.name if stored, else skip
      }catch(e){}
    }
  }
  // better: keep a registry key
  const reg=JSON.parse(localStorage.getItem(STORAGE_VER+'_users')||'[]');
  return reg;
}
function addUserToRegistry(name){
  const reg=JSON.parse(localStorage.getItem(STORAGE_VER+'_users')||'[]');
  const n=name.toLowerCase();
  if(!reg.includes(n)) reg.push(n);
  localStorage.setItem(STORAGE_VER+'_users',JSON.stringify(reg));
}
function getPartner(){
  const data=getData(currentUser);
  return data.settings.partner||null;
}
function setPartner(name){
  const data=getData(currentUser);
  data.settings.partner=name?name.toLowerCase():null;
  setData(currentUser,data);
}
function getPartnerData(){
  const p=getPartner();
  if(!p) return null;
  const key=`${STORAGE_VER}_${hash(p)}`;
  const raw=localStorage.getItem(key);
  return raw?JSON.parse(raw):null;
}

function getCombinedExpenses(){
  const data=getData(currentUser);
  let list=data.expenses.map(e=>({...e,_user:currentUser.name}));
  const partner=getPartnerData();
  if(partner&&partner.expenses){
    list=list.concat(partner.expenses.map(e=>({...e,_user:getPartner()})));
  }
  return list;
}

/* ─── NAV ─── */
function showScreen(id){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  $(id).classList.add('active');
}

/* ─── LOGIN ─── */
$('btn-login').addEventListener('click',doLogin);
$('login-pin').addEventListener('keydown',e=>{ if(e.key==='Enter') doLogin(); });

function doLogin(){
  const name=$('login-name').value.trim();
  const pin=$('login-pin').value.trim();
  if(!name||pin.length!==4||!/\d{4}/.test(pin)){ alert('Enter name and 4-digit PIN'); return; }
  const key=lsKey({name:name.toLowerCase()});
  const raw=localStorage.getItem(key);
  if(raw){
    const data=JSON.parse(raw);
    if(data.pin!==pin){ alert('Wrong PIN'); return; }
  }else{
    setData({name:name.toLowerCase(),pin},{pin,expenses:[],settings:{}});
  }
  addUserToRegistry(name.toLowerCase());
  currentUser={name,pin};
  $('dash-greeting').textContent='Hello, '+name;
  showScreen('dash-screen');
  refreshDash();
}

$('btn-switch-user').addEventListener('click',()=>{
  currentUser=null;
  $('login-name').value='';
  $('login-pin').value='';
  showScreen('login-screen');
});

/* ─── DASHBOARD ─── */
function refreshDash(){
  const data=getData(currentUser);
  const today=fmtDate(now());
  const monthPrefix=today.slice(0,7);
  const combined=getCombinedExpenses();

  const todaySum=combined.filter(e=>e.date===today).reduce((a,e)=>a+e.amount,0);
  const monthSum=combined.filter(e=>e.date.startsWith(monthPrefix)).reduce((a,e)=>a+e.amount,0);

  $('hero-today').textContent=fmtMoney(todaySum);
  $('hero-month').textContent=fmtMoney(monthSum);

  // quick tiles (from combined history frequency)
  const tiles=$('quick-tiles');
  tiles.innerHTML='';
  const freq={};
  combined.forEach(e=>{ freq[e.merchant]=(freq[e.merchant]||0)+1; });
  const hist=Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([m])=>m);
  const toShow=[...new Set([...hist,...QUICK_TILES.map(t=>t.merchant)])].slice(0,12);
  toShow.forEach(m=>{
    const el=document.createElement('div');
    el.className='tile';
    el.textContent=m;
    el.addEventListener('click',()=>openAdd(m,detectCategory(m)));
    tiles.appendChild(el);
  });

  // recent (combined, tagged)
  const recent=$('recent-list');
  recent.innerHTML='';
  const recentList=combined.sort((a,b)=>b.timestamp-a.timestamp).slice(0,20);
  if(recentList.length===0){
    recent.innerHTML='<div class="item"><div class="item-left"><span class="item-name">No expenses yet</span></div></div>';
  }else{
    recentList.forEach(e=>{
      const isPartner=e._user&&e._user.toLowerCase()!==currentUser.name.toLowerCase();
      const tag=isPartner?`<span class="partner-tag">${esc(e._user)}</span>`:'';
      const item=document.createElement('div');
      item.className='item';
      item.innerHTML=`
        <div class="item-left">
          <span class="item-name">${esc(e.merchant)}${tag}</span>
          <span class="item-meta">${e.category} · ${e.date}</span>
        </div>
        <span class="item-amount">${fmtMoney(e.amount)}</span>
      `;
      recent.appendChild(item);
    });
  }
}

/* ─── ADD EXPENSE ─── */
$('btn-add').addEventListener('click',()=>openAdd());
$('btn-add-back').addEventListener('click',()=>{ showScreen('dash-screen'); refreshDash(); });

function openAdd(preMerchant,preCategory){
  amountStr='';
  $('amount-display').textContent='0.00';
  $('add-merchant').value=preMerchant||'';
  const cat=preCategory||(preMerchant?detectCategory(preMerchant):'Others');
  $('cat-detected').textContent=cat;
  $('add-category').value=cat;
  buildSuggest();
  showScreen('add-screen');
  if(!preMerchant) setTimeout(()=>$('add-merchant').focus(),50);
}

// numpad
document.querySelectorAll('.numpad button').forEach(btn=>{
  btn.addEventListener('click',()=>{
    const k=btn.dataset.k;
    if(k==='C'){ amountStr=''; }
    else if(k==='.'&&amountStr.includes('.')){}
    else if(k==='0'&&amountStr===''){}
    else {
      const next=amountStr+k;
      const parts=next.split('.');
      if(parts[1]&&parts[1].length>2){}
      else if(next.replace('.','').length>8){}
      else { amountStr=next; }
    }
    $('amount-display').textContent=amountStr?parseFloat(amountStr).toFixed(2):'0.00';
  });
});

// merchant input + suggest
$('add-merchant').addEventListener('input',()=>{
  buildSuggest();
  const cat=detectCategory($('add-merchant').value);
  $('cat-detected').textContent=cat;
  $('add-category').value=cat;
});

function buildSuggest(){
  const val=$('add-merchant').value.toLowerCase().trim();
  const box=$('merchant-suggest');
  if(!val){ box.innerHTML=''; return; }
  const matches=[];
  const combined=getCombinedExpenses();
  combined.forEach(e=>{
    if(e.merchant.toLowerCase().includes(val)) matches.push(e.merchant);
  });
  QUICK_TILES.forEach(t=>{ if(t.merchant.toLowerCase().includes(val)) matches.push(t.merchant); });
  const uniq=[...new Set(matches)].slice(0,6);
  box.innerHTML=uniq.map(m=>`<span class="suggest-chip" onclick="window.setMerchant('${esc(m)}')">${esc(m)}</span>`).join('');
}
window.setMerchant=function(m){ $('add-merchant').value=m; buildSuggest(); $('cat-detected').textContent=detectCategory(m); $('add-category').value=detectCategory(m); };

// category override
$('cat-detected').addEventListener('click',()=>{
  $('cat-detected').classList.toggle('hidden');
  $('add-category').classList.toggle('hidden');
  if(!$('add-category').classList.contains('hidden')) $('add-category').focus();
});
$('add-category').addEventListener('change',()=>{ $('cat-detected').textContent=$('add-category').value; $('cat-detected').classList.remove('hidden'); $('add-category').classList.add('hidden'); });

// save
$('btn-save').addEventListener('click',()=>{
  const merchant=$('add-merchant').value.trim();
  const amount=parseMoney(amountStr);
  const category=$('cat-detected').textContent;
  if(!merchant){ alert('Enter merchant'); return; }
  if(amount<=0){ alert('Enter amount'); return; }

  const data=getData(currentUser);
  data.expenses.push({
    id: Date.now().toString(36)+Math.random().toString(36).slice(2,5),
    merchant,
    amount,
    category,
    date: fmtDate(now()),
    timestamp: Date.now()
  });
  setData(currentUser,data);
  showScreen('dash-screen');
  refreshDash();
});

/* ─── SETTINGS ─── */
$('btn-settings').addEventListener('click',()=>{
  showScreen('settings-screen');
  renderPartnerUI();
});
$('btn-settings-back').addEventListener('click',()=>showScreen('dash-screen'));

function renderPartnerUI(){
  const current=getPartner();
  const reg=getAllUsers();
  const others=reg.filter(u=>u!==currentUser.name.toLowerCase());

  if(current){
    $('partner-current').innerHTML=`Linked to <b>${esc(current)}</b>`;
    $('partner-current').classList.remove('hidden');
    $('btn-link-partner').classList.add('hidden');
    $('btn-unlink-partner').classList.remove('hidden');
    $('partner-select').classList.add('hidden');
  }else{
    $('partner-current').textContent='No partner linked';
    $('partner-current').classList.remove('hidden');
    $('btn-link-partner').classList.remove('hidden');
    $('btn-unlink-partner').classList.add('hidden');
    const sel=$('partner-select');
    sel.innerHTML='<option value="">Select partner...</option>';
    if(others.length===0){
      sel.innerHTML+='<option disabled>No other accounts found</option>';
    }else{
      others.forEach(u=>{
        const opt=document.createElement('option');
        opt.value=u; opt.textContent=u.charAt(0).toUpperCase()+u.slice(1);
        sel.appendChild(opt);
      });
    }
    sel.classList.remove('hidden');
  }
}

$('btn-link-partner').addEventListener('click',()=>{
  const val=$('partner-select').value;
  if(!val){ alert('Select a partner'); return; }
  setPartner(val);
  renderPartnerUI();
  alert(`Linked to ${val}`);
});

$('btn-unlink-partner').addEventListener('click',()=>{
  if(confirm('Unlink partner?')){
    setPartner(null);
    renderPartnerUI();
  }
});

$('btn-save-pin').addEventListener('click',()=>{
  const p=$('set-pin').value.trim();
  if(!/^\d{4}$/.test(p)){ alert('PIN must be 4 digits'); return; }
  const data=getData(currentUser);
  data.pin=p; currentUser.pin=p;
  setData(currentUser,data);
  alert('PIN updated');
  $('set-pin').value='';
});

$('btn-export').addEventListener('click',()=>{
  const data=getData(currentUser);
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=`spent_${currentUser.name}_${fmtDate(now())}.json`;
  a.click();
});

$('btn-import').addEventListener('click',()=>$('import-file').click());
$('import-file').addEventListener('change',e=>{
  const f=e.target.files[0]; if(!f) return;
  const r=new FileReader();
  r.onload=()=>{
    try{
      const data=JSON.parse(r.result);
      if(!Array.isArray(data.expenses)) throw new Error('bad format');
      if(confirm(`Import ${data.expenses.length} expenses? This merges into current data.`)){
        const old=getData(currentUser);
        old.expenses=old.expenses.concat(data.expenses);
        setData(currentUser,old);
        refreshDash();
        showScreen('dash-screen');
      }
    }catch(err){ alert('Invalid file'); }
  };
  r.readAsText(f);
  $('import-file').value='';
});

$('btn-clear').addEventListener('click',()=>{
  if(confirm('DELETE ALL DATA for '+currentUser.name+'? Cannot undo.')){
    localStorage.removeItem(lsKey(currentUser));
    setData(currentUser,{pin:currentUser.pin,expenses:[],settings:{}});
    refreshDash();
    showScreen('dash-screen');
  }
});

/* ─── INIT ─── */
if('serviceWorker' in navigator){
  navigator.serviceWorker.register('sw.js').catch(console.error);
}

})();
