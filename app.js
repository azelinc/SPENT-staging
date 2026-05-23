(function(){
'use strict';

/* ─── FIREBASE CONFIG ─── */
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyC2fezwrXSOeDCytG84RES-dJ04teLvmuo",
  authDomain: "ainvested-703ec.firebaseapp.com",
  databaseURL: "https://ainvested-703ec-default-rtdb.firebaseio.com",
  projectId: "ainvested-703ec",
  storageBucket: "ainvested-703ec.firebasestorage.app",
  messagingSenderId: "453797298902",
  appId: "1:453797298902:web:ea0018b9a52dd73eaaff77"
};

firebase.initializeApp(FIREBASE_CONFIG);
const auth = firebase.auth();
const db = firebase.database();

const APP_VER = 'v2.0-firebase';

/* ─── CONSTANTS ─── */
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
let currentUser = null;   // { uid, name, pin }
let amountStr = '';
let pendingCount = 0;
let authReady = false;

/* ─── HELPERS ─── */
function $(id){ return document.getElementById(id); }
function now(){ return new Date(); }
function fmtDate(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function fmtMoney(n){ return 'RM '+n.toFixed(2); }
function parseMoney(s){ const v=parseFloat(s); return isNaN(v)?0:v; }
function esc(s){ const d=document.createElement('div'); d.textContent=s; return d.innerHTML; }
function detectCategory(merchant){
  const m=merchant.toLowerCase();
  for(const[cat,keywords] of Object.entries(CAT_MAP)){
    if(keywords.some(k=>m.includes(k))) return cat.replace(/\b\w/g,l=>l.toUpperCase()).replace('&',' & ').replace('N Go','N Go');
  }
  return 'Others';
}

/* ─── NAV ─── */
function showScreen(id){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  $(id).classList.add('active');
}

/* ─── AUTH ─── */
auth.onAuthStateChanged(user=>{
  authReady = true;
  if(!user){
    auth.signInAnonymously().catch(console.error);
    return;
  }
  // anonymous user now has stable uid
  if(currentUser){
    refreshDash();
    refreshReviewBadge();
  }
});

/* ─── USER PROFILE ─── */
function userRef(uid){ return db.ref('users/'+uid); }
function expRef(uid){ return db.ref('users/'+uid+'/expenses'); }
function settingsRef(uid){ return db.ref('users/'+uid+'/settings'); }
function ownerLinksRef(ownerUid){ return db.ref('owners/'+ownerUid+'/links'); }

function loadUserProfile(uid){
  return userRef(uid).once('value').then(s=>s.val()||null);
}
function saveUserProfile(uid, name, pin){
  return userRef(uid).update({ name, pin, updatedAt: firebase.database.ServerValue.TIMESTAMP });
}
function saveExpense(uid, expense){
  const key = expRef(uid).push().key;
  return expRef(uid).child(key).set(expense).then(()=>key);
}
function updateExpenseStatus(uid, expId, status){
  return expRef(uid).child(expId).update({ status });
}
function loadExpenses(uid){
  return expRef(uid).once('value').then(s=>{
    const v=s.val()||{};
    return Object.entries(v).map(([id,o])=>({id,...o}));
  });
}
function loadSettings(uid){
  return settingsRef(uid).once('value').then(s=>s.val()||{});
}
function saveSettings(uid, settings){
  return settingsRef(uid).set(settings);
}
function requestLink(partnerUid, ownerUid, partnerName){
  return ownerLinksRef(ownerUid).child(partnerUid).set({ status:'pending', name: partnerName, requestedAt: firebase.database.ServerValue.TIMESTAMP });
}
function approveLink(ownerUid, partnerUid){
  return ownerLinksRef(ownerUid).child(partnerUid).update({ status:'approved', approvedAt: firebase.database.ServerValue.TIMESTAMP });
}
function rejectLink(ownerUid, partnerUid){
  return ownerLinksRef(ownerUid).child(partnerUid).update({ status:'rejected', rejectedAt: firebase.database.ServerValue.TIMESTAMP });
}
function removeLink(ownerUid, partnerUid){
  return ownerLinksRef(ownerUid).child(partnerUid).remove();
}
function loadOwnerLinks(ownerUid){
  return ownerLinksRef(ownerUid).once('value').then(s=>s.val()||{});
}

/* ─── LOGIN ─── */
$('btn-login').addEventListener('click',doLogin);
$('login-pin').addEventListener('keydown',e=>{ if(e.key==='Enter') doLogin(); });

function doLogin(){
  const name=$('login-name').value.trim();
  const pin=$('login-pin').value.trim();
  if(!name||pin.length!==4||!/\d{4}/.test(pin)){ alert('Enter name and 4-digit PIN'); return; }
  if(!authReady){ alert('Auth initializing, try again in 2 seconds'); return; }

  const uid = auth.currentUser ? auth.currentUser.uid : null;
  if(!uid){ alert('Auth not ready'); return; }

  loadUserProfile(uid).then(profile=>{
    if(profile){
      if(profile.pin!==pin){ alert('Wrong PIN'); return; }
      currentUser = { uid, name: profile.name || name, pin };
    }else{
      currentUser = { uid, name, pin };
      saveUserProfile(uid, name, pin);
    }
    $('dash-greeting').textContent = 'Hello, '+currentUser.name;
    showScreen('dash-screen');
    refreshDash();
    refreshReviewBadge();
  });
}

$('btn-switch-user').addEventListener('click',()=>{
  currentUser=null;
  $('login-name').value='';
  $('login-pin').value='';
  showScreen('login-screen');
});

/* ─── DASHBOARD ─── */
function refreshDash(){
  if(!currentUser) return;
  const uid = currentUser.uid;
  const today = fmtDate(now());
  const monthPrefix = today.slice(0,7);

  loadSettings(uid).then(settings=>{
    const ownerUid = settings.ownerUid || null;

    // Load own expenses
    loadExpenses(uid).then(own=>{
      let combined = own.map(e=>({...e,_user:currentUser.name,_uid:uid}));

      // If this user has an owner, only show own data (Farah case)
      // If this user IS an owner (has approved links), merge partner data
      loadOwnerLinks(uid).then(links=>{
        const approved = Object.entries(links).filter(([id,l])=>l.status==='approved');
        const isOwner = approved.length > 0;

        if(isOwner && !ownerUid){
          // Owner view: merge all approved partners' APPROVED expenses
          const fetches = approved.map(([puid])=> loadExpenses(puid).then(list=> list.filter(e=>e.status!=='rejected').map(e=>({...e,_user:links[puid].name,_uid:puid}))) );
          Promise.all(fetches).then(partnerLists=>{
            partnerLists.forEach(pl=> combined = combined.concat(pl));
            renderDash(combined, today, monthPrefix);
          });
        }else{
          // Partner view or solo: show own data only
          renderDash(combined, today, monthPrefix);
        }
      });
    });
  });
}

function renderDash(combined, today, monthPrefix){
  const todaySum = combined.filter(e=>e.date===today).reduce((a,e)=>a+e.amount,0);
  const monthSum = combined.filter(e=>e.date.startsWith(monthPrefix)).reduce((a,e)=>a+e.amount,0);
  $('hero-today').textContent = fmtMoney(todaySum);
  $('hero-month').textContent = fmtMoney(monthSum);

  // Quick tiles
  const tiles = $('quick-tiles');
  tiles.innerHTML = '';
  const freq = {};
  combined.forEach(e=>{ freq[e.merchant]=(freq[e.merchant]||0)+1; });
  const hist = Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([m])=>m);
  const toShow = [...new Set([...hist, ...QUICK_TILES.map(t=>t.merchant)])].slice(0,12);
  toShow.forEach(m=>{
    const el = document.createElement('div');
    el.className = 'tile';
    el.textContent = m;
    el.addEventListener('click',()=>openAdd(m,detectCategory(m)));
    tiles.appendChild(el);
  });

  // Recent list
  const recent = $('recent-list');
  recent.innerHTML = '';
  const recentList = combined.sort((a,b)=>(b.timestamp||0)-(a.timestamp||0)).slice(0,20);
  if(recentList.length===0){
    recent.innerHTML='<div class="item"><div class="item-left"><span class="item-name">No expenses yet</span></div></div>';
  }else{
    recentList.forEach(e=>{
      const isPartner = e._uid !== currentUser.uid;
      const tag = isPartner ? `<span class="partner-tag">${esc(e._user)}</span>` : '';
      const statusLabel = e.status==='pending' ? ' <span style="color:var(--danger);font-size:0.7rem">[PENDING]</span>' : '';
      const item = document.createElement('div');
      item.className = 'item';
      item.innerHTML = `
        <div class="item-left">
          <span class="item-name">${esc(e.merchant)}${tag}${statusLabel}</span>
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
  if(!currentUser){ box.innerHTML=''; return; }
  loadExpenses(currentUser.uid).then(list=>{
    const matches=[];
    list.forEach(e=>{ if(e.merchant.toLowerCase().includes(val)) matches.push(e.merchant); });
    QUICK_TILES.forEach(t=>{ if(t.merchant.toLowerCase().includes(val)) matches.push(t.merchant); });
    const uniq=[...new Set(matches)].slice(0,6);
    box.innerHTML=uniq.map(m=>`<span class="suggest-chip" onclick="window.setMerchant('${esc(m)}')">${esc(m)}</span>`).join('');
  });
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

  const ts = Date.now();
  const expense = {
    merchant, amount, category,
    date: fmtDate(now()),
    timestamp: ts,
    status: 'pending'
  };

  loadSettings(currentUser.uid).then(settings=>{
    // If linked to an owner, stay pending. If solo, auto-approve.
    if(!settings.ownerUid){
      expense.status = 'approved';
    }
    saveExpense(currentUser.uid, expense).then(()=>{
      showScreen('dash-screen');
      refreshDash();
    });
  });
});

/* ─── REVIEW SCREEN ─── */
$('btn-review').addEventListener('click',()=>{
  showScreen('review-screen');
  renderReview();
});
$('btn-review-back').addEventListener('click',()=>{ showScreen('dash-screen'); });

function refreshReviewBadge(){
  if(!currentUser) return;
  const uid = currentUser.uid;
  loadOwnerLinks(uid).then(links=>{
    const approved = Object.entries(links).filter(([id,l])=>l.status==='approved');
    if(approved.length===0){ $('btn-review').classList.add('hidden'); return; }
    let count = 0;
    const fetches = approved.map(([puid])=> loadExpenses(puid).then(list=>{
      list.forEach(e=>{ if(e.status==='pending') count++; });
    }));
    Promise.all(fetches).then(()=>{
      pendingCount = count;
      if(count>0){
        $('btn-review').classList.remove('hidden');
        $('pending-badge').textContent = count;
        $('pending-badge').classList.remove('hidden');
      }else{
        $('btn-review').classList.remove('hidden');
        $('pending-badge').classList.add('hidden');
      }
    });
  });
}

function renderReview(){
  const list = $('review-list');
  list.innerHTML = '<div class="item"><div class="item-left"><span class="item-name">Loading...</span></div></div>';
  if(!currentUser) return;

  loadOwnerLinks(currentUser.uid).then(links=>{
    const approved = Object.entries(links).filter(([id,l])=>l.status==='approved');
    if(approved.length===0){ list.innerHTML='<div class="item"><div class="item-left"><span class="item-name">No partners linked</span></div></div>'; return; }

    let pendingItems = [];
    const fetches = approved.map(([puid])=> loadExpenses(puid).then(expenses=>{
      expenses.filter(e=>e.status==='pending').forEach(e=>{
        pendingItems.push({...e,_uid:puid,_user:links[puid].name});
      });
    }));

    Promise.all(fetches).then(()=>{
      pendingItems.sort((a,b)=>(b.timestamp||0)-(a.timestamp||0));
      if(pendingItems.length===0){
        list.innerHTML='<div class="item"><div class="item-left"><span class="item-name">No pending expenses to review</span></div></div>';
        return;
      }
      list.innerHTML = '';
      pendingItems.forEach(e=>{
        const item = document.createElement('div');
        item.className = 'item review-item';
        item.innerHTML = `
          <div class="item-left">
            <span class="item-name">${esc(e.merchant)} <span class="partner-tag">${esc(e._user)}</span></span>
            <span class="item-meta">${e.category} · ${e.date}</span>
          </div>
          <span class="item-amount">${fmtMoney(e.amount)}</span>
          <div class="review-actions">
            <button class="btn-approve" data-id="${esc(e.id)}" data-uid="${esc(e._uid)}">Approve</button>
            <button class="btn-reject" data-id="${esc(e.id)}" data-uid="${esc(e._uid)}">Reject</button>
          </div>
        `;
        list.appendChild(item);
      });

      list.querySelectorAll('.btn-approve').forEach(btn=>{
        btn.addEventListener('click',()=>{
          const id=btn.dataset.id, uid=btn.dataset.uid;
          updateExpenseStatus(uid, id, 'approved').then(()=>{ renderReview(); refreshReviewBadge(); refreshDash(); });
        });
      });
      list.querySelectorAll('.btn-reject').forEach(btn=>{
        btn.addEventListener('click',()=>{
          const id=btn.dataset.id, uid=btn.dataset.uid;
          updateExpenseStatus(uid, id, 'rejected').then(()=>{ renderReview(); refreshReviewBadge(); refreshDash(); });
        });
      });
    });
  });
}

/* ─── SETTINGS ─── */
$('btn-settings').addEventListener('click',()=>{
  showScreen('settings-screen');
  renderSettings();
});
$('btn-settings-back').addEventListener('click',()=>showScreen('dash-screen'));

function renderSettings(){
  if(!currentUser) return;
  const uid = currentUser.uid;
  $('set-my-uid').textContent = uid;
  $('app-version').textContent = APP_VER;

  loadSettings(uid).then(settings=>{
    const ownerUid = settings.ownerUid || '';
    $('set-owner-uid').value = ownerUid;
    if(ownerUid){ $('btn-clear-owner').classList.remove('hidden'); }
    else { $('btn-clear-owner').classList.add('hidden'); }
  });

  // Owner panels
  loadOwnerLinks(uid).then(links=>{
    const pending = Object.entries(links).filter(([id,l])=>l.status==='pending');
    const approved = Object.entries(links).filter(([id,l])=>l.status==='approved');

    const pendingDiv = $('pending-links');
    if(pending.length>0){
      $('owner-panel').classList.remove('hidden');
      pendingDiv.innerHTML = '';
      pending.forEach(([puid, l])=>{
        const row = document.createElement('div');
        row.className = 'link-request';
        row.innerHTML = `
          <span>${esc(l.name)} <code>${esc(puid)}</code></span>
          <div class="btn-row">
            <button class="btn-primary btn-sm" data-uid="${esc(puid)}" data-action="approve">Approve</button>
            <button class="btn-danger btn-sm" data-uid="${esc(puid)}" data-action="reject">Reject</button>
          </div>
        `;
        pendingDiv.appendChild(row);
      });
      pendingDiv.querySelectorAll('button').forEach(btn=>{
        btn.addEventListener('click',()=>{
          const puid=btn.dataset.uid;
          if(btn.dataset.action==='approve') approveLink(uid,puid).then(renderSettings);
          else rejectLink(uid,puid).then(renderSettings);
        });
      });
    }else{
      $('owner-panel').classList.add('hidden');
    }

    const approvedDiv = $('approved-links');
    if(approved.length>0){
      $('approved-panel').classList.remove('hidden');
      approvedDiv.innerHTML = '';
      approved.forEach(([puid, l])=>{
        const row = document.createElement('div');
        row.className = 'link-request';
        row.innerHTML = `
          <span>${esc(l.name)} <code>${esc(puid)}</code></span>
          <button class="btn-danger btn-sm" data-uid="${esc(puid)}">Remove</button>
        `;
        approvedDiv.appendChild(row);
      });
      approvedDiv.querySelectorAll('button').forEach(btn=>{
        btn.addEventListener('click',()=>{
          const puid=btn.dataset.uid;
          if(confirm('Remove partner link?')) removeLink(uid,puid).then(renderSettings);
        });
      });
    }else{
      $('approved-panel').classList.add('hidden');
    }
  });
}

$('btn-save-owner').addEventListener('click',()=>{
  const ownerUid = $('set-owner-uid').value.trim();
  if(!ownerUid){ alert('Enter partner Account ID'); return; }
  if(ownerUid===currentUser.uid){ alert('Cannot link to yourself'); return; }
  loadUserProfile(ownerUid).then(profile=>{
    if(!profile){ alert('Partner account not found'); return; }
    saveSettings(currentUser.uid, { ownerUid }).then(()=>{
      requestLink(currentUser.uid, ownerUid, currentUser.name).then(()=>{
        alert('Link request sent. Waiting for partner approval.');
        renderSettings();
      });
    });
  });
});

$('btn-clear-owner').addEventListener('click',()=>{
  if(!confirm('Unlink from owner?')) return;
  loadSettings(currentUser.uid).then(settings=>{
    const oldOwner = settings.ownerUid;
    saveSettings(currentUser.uid, {}).then(()=>{
      if(oldOwner) removeLink(oldOwner, currentUser.uid);
      renderSettings();
      refreshDash();
    });
  });
});

$('btn-save-pin').addEventListener('click',()=>{
  const p=$('set-pin').value.trim();
  if(!/^\d{4}$/.test(p)){ alert('PIN must be 4 digits'); return; }
  saveUserProfile(currentUser.uid, currentUser.name, p).then(()=>{
    currentUser.pin = p;
    alert('PIN updated');
    $('set-pin').value='';
  });
});

$('btn-export').addEventListener('click',()=>{
  if(!currentUser) return;
  Promise.all([loadUserProfile(currentUser.uid), loadExpenses(currentUser.uid)]).then(([profile, expenses])=>{
    const payload = { name: profile.name, uid: currentUser.uid, expenses };
    const blob = new Blob([JSON.stringify(payload,null,2)], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `spent_${profile.name}_${fmtDate(now())}.json`;
    a.click();
  });
});

$('btn-clear').addEventListener('click',()=>{
  if(!currentUser) return;
  if(confirm('DELETE ALL DATA for '+currentUser.name+'? Cannot undo.')){
    userRef(currentUser.uid).remove().then(()=>{
      currentUser = null;
      $('login-name').value='';
      $('login-pin').value='';
      showScreen('login-screen');
    });
  }
});

/* ─── INIT ─── */
if('serviceWorker' in navigator){
  navigator.serviceWorker.register('sw.js').catch(console.error);
}

})();
