(function(){
'use strict';

/* ─── FIREBASE CONFIG ─── */
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyC2fezwrXSOeDCytG84RES-dJ04teLvmuo",
  authDomain: "ainvested-703ec.firebaseapp.com",
    databaseURL: "https://ainvested-703ec-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "ainvested-703ec",
  storageBucket: "ainvested-703ec.firebasestorage.app",
  messagingSenderId: "453797298902",
  appId: "1:453797298902:web:9c4adbc200e23dadaaff77",
  measurementId: "G-X7BH0LW5BT"
};

firebase.initializeApp(FIREBASE_CONFIG);
const auth = firebase.auth();
const db = firebase.database();

const APP_VER = 'v2.1-bills';

/* ─── CONSTANTS ─── */
const CATEGORIES = [
  'Food & Dining','Groceries','Transport','Shopping',
  'Utilities','Entertainment','Health & Wellness','Home','Others'
];
const DEFAULT_PAYMENT_METHODS = ['Cash', 'Card', 'QR', 'Bank Transfer'];
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
let currentUser = null;   // { uid, name, email }
let amountStr = '';
let pendingCount = 0;
let authReady = false;
let summaryFilter = 'both';
let isSubAccount = false;
let editTarget = null;    // { uid, id } when editing
let lastMerchant = '';
let lastPayment = 'Cash';

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
  if(user){
    if(!currentUser){
      Promise.all([loadUserProfile(user.uid), loadSettings(user.uid)]).then(([profile, settings])=>{
        currentUser = { uid:user.uid, name:profile?.name||user.displayName||'User', email:user.email };
        isSubAccount = !!settings.ownerUid;
        $('dash-greeting').textContent = 'Hello, '+currentUser.name;
        $('dash-ver').textContent = APP_VER;
        showScreen('dash-screen');
        refreshDash();
        refreshReviewBadge();
        attachListeners(user.uid);
      });
    }
  }else{
    currentUser = null;
    isSubAccount = false;
    detachListeners();
    showScreen('login-screen');
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
function saveUserProfile(uid, name){
  return userRef(uid).update({ name, updatedAt: firebase.database.ServerValue.TIMESTAMP });
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
  return settingsRef(uid).update(settings);
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
function deleteExpense(uid, expId){
  return expRef(uid).child(expId).remove();
}
function updateExpense(uid, expId, data){
  return expRef(uid).child(expId).update(data);
}
function loadOwnerLinks(ownerUid){
  return ownerLinksRef(ownerUid).once('value').then(s=>s.val()||{});
}

function loadPaymentMethods(uid){
  return loadSettings(uid).then(s=>{
    if(Array.isArray(s.paymentMethods) && s.paymentMethods.length>0) return s.paymentMethods;
    return DEFAULT_PAYMENT_METHODS;
  });
}

function checkEditAllowed(expense, isOwnerView){
  const isOwn = expense._uid === currentUser.uid;
  // Main viewing Sub's expense: always allowed
  if(isOwnerView && !isOwn) return true;
  // Your own expense: allowed if Main/solo, or if Sub and still pending
  if(isOwn) {
    if(!isSubAccount) return true; // Main or solo user
    return expense.status === 'pending'; // Sub: only pending
  }
  return false;
}

/* ─── REAL-TIME LISTENERS ─── */
let _expCallback = null;
let _linksCallback = null;
let _partnerExpCallbacks = {}; // { puid: callback }

function attachListeners(uid){
  detachListeners();
  // own expenses
  _expCallback = snap=>{
    if(!currentUser || currentUser.uid!==uid) return;
    refreshDash();
  };
  expRef(uid).on('value', _expCallback);

  // owner links (for review badge + settings)
  _linksCallback = snap=>{
    if(!currentUser || currentUser.uid!==uid) return;
    const links = snap.val() || {};
    const approved = Object.entries(links).filter(([id,l])=>l.status==='approved');

    // detach old partner listeners
    Object.entries(_partnerExpCallbacks).forEach(([puid, cb])=>{
      expRef(puid).off('value', cb);
    });
    _partnerExpCallbacks = {};

    // attach new partner listeners for real-time updates from sub accounts
    approved.forEach(([puid])=>{
      const cb = snap=>{
        if(!currentUser) return;
        refreshDash();  // partner added/changed/deleted
      };
      _partnerExpCallbacks[puid] = cb;
      expRef(puid).on('value', cb);
    });

    refreshReviewBadge();
    if($('settings-screen').classList.contains('active')) renderSettings();
  };
  ownerLinksRef(uid).on('value', _linksCallback);
}
function detachListeners(){
  if(_expCallback && currentUser){ expRef(currentUser.uid).off('value', _expCallback); _expCallback=null; }
  if(_linksCallback && currentUser){ ownerLinksRef(currentUser.uid).off('value', _linksCallback); _linksCallback=null; }
  // cleanup partner listeners
  Object.entries(_partnerExpCallbacks).forEach(([puid, cb])=>{
    expRef(puid).off('value', cb);
  });
  _partnerExpCallbacks = {};
}

/* ─── LOGIN ─── */
$('btn-login').addEventListener('click',doLogin);
$('login-password').addEventListener('keydown',e=>{ if(e.key==='Enter') doLogin(); });

function doLogin(){
  const email=$('login-email').value.trim();
  const password=$('login-password').value;
  const name=$('login-name').value.trim();
  if(!email||!password){ alert('Enter email and password'); return; }
  if(!authReady){ alert('Auth initializing, try again in 2 seconds'); return; }

  auth.signInWithEmailAndPassword(email, password)
    .then(cred=>{
      currentUser = { uid:cred.user.uid, name:name||cred.user.displayName||'User', email:cred.user.email };
      if(name) saveUserProfile(cred.user.uid, name);
      $('dash-greeting').textContent = 'Hello, '+currentUser.name;
      showScreen('dash-screen');
      refreshDash();
      refreshReviewBadge();
      attachListeners(cred.user.uid);
    })
    .catch(err=>{
      if(err.code==='auth/user-not-found'){
        if(!name){ alert('Enter your name to create a new account'); return; }
        if(password.length<6){ alert('Password must be at least 6 characters'); return; }
        return auth.createUserWithEmailAndPassword(email, password)
          .then(cred=>{
            currentUser = { uid:cred.user.uid, name, email:cred.user.email };
            saveUserProfile(cred.user.uid, name);
            $('dash-greeting').textContent = 'Hello, '+currentUser.name;
            showScreen('dash-screen');
            refreshDash();
            refreshReviewBadge();
            attachListeners(cred.user.uid);
          });
      }
      alert(err.message);
    });
}

$('btn-switch-user').addEventListener('click',()=>{
  auth.signOut().then(()=>{
    currentUser=null;
    detachListeners();
    $('login-email').value='';
    $('login-name').value='';
    $('login-password').value='';
    showScreen('login-screen');
  });
});

/* ─── DASHBOARD ─── */
function refreshDash(){
  if(!currentUser) return;
  const uid = currentUser.uid;
  const today = fmtDate(now());
  const monthPrefix = today.slice(0,7);

  loadSettings(uid).then(settings=>{
    isSubAccount = !!settings.ownerUid;
    summaryFilter = settings.partnerFilter || 'both';

    // Load own expenses
    loadExpenses(uid).then(own=>{
      let combined = own.map(e=>({...e,_user:currentUser.name,_uid:uid}));

      // If this user has an owner, only show own data (Farah case)
      // If this user IS an owner (has approved links), merge partner data
      loadOwnerLinks(uid).then(links=>{
        const approved = Object.entries(links).filter(([id,l])=>l.status==='approved');

        if(approved.length > 0){
          // Owner view: merge all approved partners' APPROVED expenses
          const fetches = approved.map(([puid])=> loadExpenses(puid).then(list=> list.filter(e=>e.status!=='rejected').map(e=>({...e,_user:links[puid].name,_uid:puid}))) );
          Promise.all(fetches).then(partnerLists=>{
            partnerLists.forEach(pl=> combined = combined.concat(pl));
            renderDash(combined, today, monthPrefix, approved);
          });
        }else{
          // Solo or partner-only: show own data only
          renderDash(combined, today, monthPrefix, approved);
        }
      });
    });
  });
}

function renderDash(combined, today, monthPrefix, approvedPartners){
  // Filter for hero totals based on global summaryFilter
  let heroData = combined;
  const hasPartners = approvedPartners && approvedPartners.length > 0;
  const isOwnerView = hasPartners;
  if(hasPartners && summaryFilter !== 'both'){
    heroData = combined.filter(e => {
      if(summaryFilter === 'me') return e._uid === currentUser.uid;
      if(summaryFilter === 'ibu') return e._uid !== currentUser.uid;
      return true;
    });
  }
  
  const todaySum = heroData.filter(e=>e.date===today).reduce((a,e)=>a+e.amount,0);
  const monthSum = heroData.filter(e=>e.date.startsWith(monthPrefix)).reduce((a,e)=>a+e.amount,0);
  $('hero-today').textContent = fmtMoney(todaySum);
  $('hero-month').textContent = fmtMoney(monthSum);

  // Update filter labels on hero blocks (show only if owner has partners)
  if(hasPartners){
    const filterLabel = summaryFilter==='both' ? 'Both' : summaryFilter==='me' ? 'Me' : 'Ibu';
    $('hero-filter').textContent = filterLabel;
    $('hero-filter-month').textContent = filterLabel;
    $('hero-today-block').style.cursor = 'pointer';
    $('hero-month-block').style.cursor = 'pointer';
  }else{
    $('hero-filter').textContent = '';
    $('hero-filter-month').textContent = '';
    $('hero-today-block').style.cursor = 'default';
    $('hero-month-block').style.cursor = 'default';
  }

  // Quick tiles (all data)
  const tiles = $('quick-tiles');
  tiles.innerHTML = '';
  const freq = {};
  combined.forEach(e=>{ freq[e.merchant]=(freq[e.merchant]||0)+1; });
  const hist = Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([m])=>m);
  const toShow = [...new Set([...hist, ...QUICK_TILES.map(t=>t.merchant)])].slice(0,6);
  toShow.forEach(m=>{
    const el = document.createElement('div');
    el.className = 'tile';
    el.textContent = m;
    el.addEventListener('click',()=>openAdd(m,detectCategory(m)));
    tiles.appendChild(el);
  });

  // Recent list (filtered like hero)
  const recent = $('recent-list');
  recent.innerHTML = '';
  const recentList = heroData.sort((a,b)=>(b.timestamp||0)-(a.timestamp||0)).slice(0,20);
  if(recentList.length===0){
    recent.innerHTML='<div class="item"><div class="item-left"><span class="item-name">No expenses yet</span></div></div>';
  }else{
    recentList.forEach(e=>{
      const isPartner = e._uid !== currentUser.uid;
      const tag = isPartner ? `<span class="partner-tag">${esc(e._user)}</span>` : '';
      const statusLabel = e.status==='pending' ? ' <span style="color:var(--danger);font-size:0.7rem">[PENDING]</span>' : '';
      const canEdit = checkEditAllowed(e, isOwnerView);
      const isOwner = isOwnerView && e._uid !== currentUser.uid;

      const item = document.createElement('div');
      item.className = 'item';
      item.style.cursor = canEdit ? 'pointer' : 'default';
      item.dataset.uid = e._uid;
      item.dataset.id = e.id;

      // Build inline actions row
      let inlineActions = '';
      if(isOwner && e.status === 'pending'){
        inlineActions = `<span class="inline-approve" data-id="${esc(e.id)}" data-uid="${esc(e._uid)}">✓ Approve</span>`;
      }

      item.innerHTML = `
        <div class="item-left">
          <div class="item-name-row">
            <span class="item-name">${esc(e.merchant)}${tag}${statusLabel}</span>
            ${inlineActions}
          </div>
          <span class="item-meta">${e.category} · ${e.payment || 'Cash'} · ${e.date}</span>
        </div>
        <span class="item-amount">${fmtMoney(e.amount)}</span>
      `;
      // Tap to edit
      if(canEdit){
        item.addEventListener('click',(ev)=>{
          // Don't edit if tapped on inline approve button
          if(ev.target.classList.contains('inline-approve')) return;
          openEdit(e);
        });
      }
      recent.appendChild(item);
    });

    // Inline approve listeners
    recent.querySelectorAll('.inline-approve').forEach(btn=>{
      btn.addEventListener('click',(ev)=>{
        ev.stopPropagation();
        const id=btn.dataset.id, uid=btn.dataset.uid;
        updateExpenseStatus(uid, id, 'approved').then(()=>{
          refreshDash();
          refreshReviewBadge();
        });
      });
    });
  }
}

/* ─── ADD EXPENSE ─── */
$('btn-add').addEventListener('click',()=>openAdd());
$('btn-add-back').addEventListener('click',()=>{ showScreen('dash-screen'); refreshDash(); });

function openAdd(preMerchant,preCategory){
  editTarget = null;
  amountStr='';
  $('amount-display').textContent='0.00';
  const merchant = preMerchant || lastMerchant || '';
  $('add-merchant').value = merchant;
  const cat = preCategory || (merchant ? detectCategory(merchant) : 'Others');
  $('cat-detected').textContent=cat;
  $('btn-save').textContent = 'Save';
  $('btn-delete').classList.add('hidden');
  loadPaymentMethods(currentUser.uid).then(methods=>{
    const payment = lastPayment || methods[0];
    buildPayChips(methods, payment);
  });
  buildSuggest();
  showScreen('add-screen');
  if(!merchant) setTimeout(()=>$('add-merchant').focus(),50);
}

function openEdit(expense){
  editTarget = { uid: expense._uid, id: expense.id };
  amountStr = String(expense.amount);
  $('amount-display').textContent = expense.amount.toFixed(2);
  $('add-merchant').value = expense.merchant;
  $('cat-detected').textContent = expense.category;
  $('btn-save').textContent = 'Update';
  $('btn-delete').classList.remove('hidden');
  loadPaymentMethods(expense._uid).then(methods=>{
    const payment = expense.payment || methods[0];
    buildPayChips(methods, payment);
  });
  buildSuggest();
  showScreen('add-screen');
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

// payment method chips
let currentPayMethods = DEFAULT_PAYMENT_METHODS.slice();
function buildPayChips(methods, selected){
  currentPayMethods = methods;
  const wrap = $('pay-chips');
  wrap.innerHTML = methods.map(m => {
    const cls = m === selected ? 'tile on' : 'tile';
    return `\u003cdiv class="${cls}" data-m="${esc(m)}"\u003e${esc(m)}\u003c/div\u003e`;
  }).join('');
  wrap.querySelectorAll('.tile').forEach(el => {
    el.addEventListener('click', () => {
      wrap.querySelectorAll('.tile').forEach(t => t.classList.remove('on'));
      el.classList.add('on');
      $('add-payment').value = el.dataset.m;
    });
  });
}
function setPayChip(val){
  const wrap = $('pay-chips');
  const match = wrap.querySelector(`[data-m="${esc(val)}"]`);
  if(match){
    wrap.querySelectorAll('.tile').forEach(t => t.classList.remove('on'));
    match.classList.add('on');
    $('add-payment').value = val;
  }
}

// category override (kept for hidden field, merchant still auto-detects)
$('cat-detected').addEventListener('click',()=>{
  $('cat-detected').classList.toggle('hidden');
  $('add-category').classList.toggle('hidden');
  if(!$('add-category').classList.contains('hidden')) $('add-category').focus();
});
$('add-category').addEventListener('change',()=>{
  $('cat-detected').textContent=$('add-category').value;
  $('cat-detected').classList.remove('hidden');
  $('add-category').classList.add('hidden');
});

// save / update
$('btn-save').addEventListener('click',()=>{
  const merchant=$('add-merchant').value.trim();
  const amount=parseMoney(amountStr);
  const category = detectCategory(merchant);
  const payment = $('add-payment').value || 'Cash';
  if(!merchant){ alert('Enter merchant'); return; }
  if(amount<=0){ alert('Enter amount'); return; }

  if(editTarget){
    // UPDATE MODE
    const data = { merchant, amount, category, payment };
    updateExpense(editTarget.uid, editTarget.id, data).then(()=>{
      lastMerchant = merchant;
      lastPayment = payment;
      editTarget = null;
      showScreen('dash-screen');
      refreshDash();
    });
  }else{
    // CREATE MODE
    const ts = Date.now();
    const expense = {
      merchant, amount, category, payment,
      date: fmtDate(now()),
      timestamp: ts,
      status: 'pending'
    };

    loadSettings(currentUser.uid).then(settings=>{
      if(!settings.ownerUid){
        expense.status = 'approved';
      }
      saveExpense(currentUser.uid, expense).then(()=>{
        lastMerchant = merchant;
        lastPayment = payment;
        showScreen('dash-screen');
        refreshDash();
      });
    });
  }
});

// delete (shown only in edit mode)
$('btn-delete').addEventListener('click',()=>{
  if(!editTarget){ return; }
  if(confirm('Delete this expense? Cannot undo.')){
    deleteExpense(editTarget.uid, editTarget.id).then(()=>{
      editTarget = null;
      showScreen('dash-screen');
      refreshDash();
    });
  }
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
    
    // Sync saved filter into global state
    summaryFilter = settings.partnerFilter || 'both';

    // Load payment methods
    const pms = Array.isArray(settings.paymentMethods) ? settings.paymentMethods : DEFAULT_PAYMENT_METHODS;
    $('set-payment-methods').value = pms.join(', ');
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
          if(confirm('Remove Sub link?')) removeLink(uid,puid).then(renderSettings);
        });
      });
    }else{
      $('approved-panel').classList.add('hidden');
    }
  });
}

$('btn-save-payments').addEventListener('click',()=>{
  if(!currentUser) return;
  const raw = $('set-payment-methods').value.trim();
  const pms = raw ? raw.split(',').map(s=>s.trim()).filter(s=>s.length>0) : DEFAULT_PAYMENT_METHODS;
  saveSettings(currentUser.uid, { paymentMethods: pms }).then(()=>{
    alert('Payment methods saved');
  });
});

$('btn-save-owner').addEventListener('click',()=>{
  const ownerUid = $('set-owner-uid').value.trim();
  if(!ownerUid){ alert('Enter Main Account ID'); return; }
  if(ownerUid===currentUser.uid){ alert('Cannot link to yourself'); return; }
  loadUserProfile(ownerUid).then(profile=>{
    if(!profile){ alert('Main account not found'); return; }
    saveSettings(currentUser.uid, { ownerUid }).then(()=>{
      requestLink(currentUser.uid, ownerUid, currentUser.name).then(()=>{
        alert('Link request sent. Waiting for Main approval.');
        renderSettings();
      });
    });
  });
});

$('btn-clear-owner').addEventListener('click',()=>{
  if(!confirm('Unlink from Main?')) return;
  loadSettings(currentUser.uid).then(settings=>{
    const oldOwner = settings.ownerUid;
    saveSettings(currentUser.uid, { ownerUid: null }).then(()=>{
      if(oldOwner) removeLink(oldOwner, currentUser.uid);
      renderSettings();
      refreshDash();
    });
  });
});

/* ─── HERO FILTER CLICK ─── */

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
      $('login-email').value='';
      $('login-name').value='';
      $('login-password').value='';
      showScreen('login-screen');
    });
  }
});

/* ─── HERO FILTER CLICK ─── */
/* ─── HERO FILTER CLICK ─── */
const FILTER_ORDER = ['both','me','ibu'];
$('hero-today-block').addEventListener('click',()=>cycleHeroFilter());
$('hero-month-block').addEventListener('click',()=>cycleHeroFilter());

function cycleHeroFilter(){
  if(!currentUser) return;
  loadSettings(currentUser.uid).then(s=>{
    if(s.ownerUid) return;
    loadOwnerLinks(currentUser.uid).then(links=>{
      const approved = Object.entries(links).filter(([id,l])=>l.status==='approved');
      if(approved.length===0) return;
      const idx = FILTER_ORDER.indexOf(summaryFilter);
      summaryFilter = FILTER_ORDER[(idx+1) % FILTER_ORDER.length];
      saveSettings(currentUser.uid, { partnerFilter: summaryFilter }).then(()=>{
        refreshDash();
      });
    });
  });
}

/* ─── BILLS ─── */
function billsRef(uid){ return db.ref('bills/'+uid); }

function loadBills(uid){
  return billsRef(uid).once('value').then(s=>{
    const v = s.val() || {};
    return Object.entries(v).map(([id, o])=>({id, ...o}));
  });
}

function saveBill(uid, bill){
  const key = billsRef(uid).push().key;
  return billsRef(uid).child(key).set(bill).then(()=>key);
}

function updateBill(uid, billId, data){
  return billsRef(uid).child(billId).update(data);
}

function deleteBill(uid, billId){
  return billsRef(uid).child(billId).remove();
}

/* ─── BILLS NAV ─── */
$('btn-bills').addEventListener('click',()=>{
  showScreen('bills-screen');
  renderBills();
});
$('btn-bills-back').addEventListener('click',()=>showScreen('dash-screen'));

/* ─── BILLS RENDER ─── */
function computeBacklog(bill, monthKey){
  const pm = bill.paidMonths || {};
  const paidKeys = Object.keys(pm);
  if(paidKeys.length === 0) return 0; // never paid → no backlog
  const [year, month] = monthKey.split('-').map(Number);
  let backlog = 0;
  for(let y = year, m = month; ;){
    const key = `${y}-${String(m).padStart(2,'0')}`;
    if(pm[key]) break;
    if(key !== monthKey) backlog++;
    m--;
    if(m === 0){ m = 12; y--; }
    if(backlog > 24) break;
  }
  return backlog;
}

function togglePaid(uid, billId, monthKey, isPaid){
  if(isPaid){
    billsRef(uid).child(billId).child('paidMonths').child(monthKey).remove().then(() => renderBills());
  }else{
    billsRef(uid).child(billId).child('paidMonths').child(monthKey).set(true).then(() => renderBills());
  }
}

function renderBills(){
  const list = $('bills-list');
  list.innerHTML = '<div class="item"><div class="item-left"><span class="item-name">Loading...</span></div></div>';
  if(!currentUser) return;

  loadBills(currentUser.uid).then(bills=>{
    if(bills.length === 0){
      list.innerHTML = '<div class="item"><div class="item-left"><span class="item-name">No bills yet. Tap + Add to create one.</span></div></div>';
      $('bills-summary').classList.add('hidden');
      return;
    }

    const nowDate = now();
    const monthKey = fmtDate(nowDate).slice(0,7); // "2026-05"

    // Compute summary
    let paidCount = 0, backlogCount = 0;
    bills.forEach(b => {
      const pm = b.paidMonths || {};
      if(pm[monthKey]) paidCount++;
      backlogCount += computeBacklog(b, monthKey);
    });

    // Summary strip
    const sumEl = $('bills-summary');
    if(paidCount > 0 || backlogCount > 0){
      sumEl.classList.remove('hidden');
      sumEl.innerHTML = `<span>☑ ${paidCount}/${bills.length} paid</span>` + (backlogCount > 0 ? `<span class="bill-due-overdue">⏳ ${backlogCount} month${backlogCount>1?'s':''}</span>` : '');
    } else {
      sumEl.classList.add('hidden');
    }

    // Sort: unpaid this month first, then upcoming soonest, inactive last
    bills.sort((a,b)=>{
      const pa = !!(a.paidMonths||{})[monthKey];
      const pb = !!(b.paidMonths||{})[monthKey];
      if(pa !== pb) return pa ? 1 : -1; // unpaid first
      const na = a.active===false ? 1 : 0;
      const nb = b.active===false ? 1 : 0;
      if(na !== nb) return na - nb;
      const da = Math.ceil((new Date(computeNextDueDate(a.dueDay)) - nowDate) / 86400000);
      const db = Math.ceil((new Date(computeNextDueDate(b.dueDay)) - nowDate) / 86400000);
      return da - db;
    });

    list.innerHTML = '';
    bills.forEach(b=>{
      const pm = b.paidMonths || {};
      const isPaid = !!pm[monthKey];
      const backlog = computeBacklog(b, monthKey);
      const nextDue = computeNextDueDate(b.dueDay);
      const daysUntil = Math.ceil((new Date(nextDue) - nowDate) / 86400000);
      let dueLabel, dueClass;
      if(daysUntil === 0){ dueLabel = 'today'; dueClass = 'bill-due-overdue'; }
      else if(daysUntil < 0){ dueLabel = Math.abs(daysUntil)+'d ago'; dueClass = 'bill-due-overdue'; }
      else if(daysUntil <= 3){ dueLabel = 'in '+daysUntil+'d'; dueClass = 'bill-due-soon'; }
      else { dueLabel = 'in '+daysUntil+'d'; dueClass = ''; }

      const isInactive = b.active === false;
      const checkChar = isPaid ? '☑' : '☐';

      let metaParts = [`Day ${b.dueDay}`, `<span class="${dueClass}">${dueLabel}</span>`];
      if(backlog > 0) metaParts.push(`<span class="bill-due-overdue">+${backlog} unpaid</span>`);

      const row = document.createElement('div');
      row.className = 'item bill-row' + (isInactive ? ' bill-inactive' : '') + (isPaid ? ' bill-paid' : '');
      row.dataset.id = b.id;
      row.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;flex:1;min-width:0">
          <span class="bill-check">${checkChar}</span>
          <div style="flex:1;min-width:0">
            <span class="item-name">${esc(b.name)}</span>
            <span class="item-meta">${metaParts.join(' · ')}</span>
          </div>
          <button class="btn-ghost btn-xs bill-edit-btn" title="Edit">✎</button>
        </div>
      `;

      // Tap anywhere on the row → toggle paid (except edit btn)
      row.addEventListener('click', e => {
        if(e.target.classList.contains('bill-edit-btn')) return;
        togglePaid(currentUser.uid, b.id, monthKey, isPaid);
      });

      // Edit button
      row.querySelector('.bill-edit-btn').addEventListener('click', e => {
        e.stopPropagation();
        loadBills(currentUser.uid).then(all=>{
          const bill = all.find(x=>x.id===b.id);
          if(bill) openBillModal('edit', bill);
        });
      });

      list.appendChild(row);
    });
  });
}

/* ─── NEXT DUE DATE CALC ─── */
function computeNextDueDate(dueDay){
  const today = now();
  const y = today.getFullYear();
  const m = today.getMonth(); // 0-indexed

  // Days in given month
  function daysInMonth(yr, mn){
    return new Date(yr, mn+1, 0).getDate();
  }

  const day = Math.min(dueDay, daysInMonth(y, m));
  let candidate = new Date(y, m, day);

  if(candidate < today){
    // Try next month
    const nm = m + 1;
    const ny = y + Math.floor(nm / 12);
    const nmonth = nm % 12;
    const nday = Math.min(dueDay, daysInMonth(ny, nmonth));
    candidate = new Date(ny, nmonth, nday);
  }

  return fmtDate(candidate);
}

/* ─── BILL MODAL ─── */
let editingBill = null;
let billAmountStr = '';

$('btn-bill-add').addEventListener('click',()=>openBillModal('add'));
$('btn-bill-modal-close').addEventListener('click',closeBillModal);

document.querySelectorAll('#bill-modal .numpad button').forEach(btn=>{
  btn.addEventListener('click',()=>{
    const k=btn.dataset.k;
    if(k==='C'){ billAmountStr=''; }
    else if(k==='.'&&billAmountStr.includes('.')){}
    else if(k==='0'&&billAmountStr===''){}
    else {
      const next=billAmountStr+k;
      const parts=next.split('.');
      if(parts[1]&&parts[1].length>2){}
      else if(next.replace('.','').length>8){}
      else { billAmountStr=next; }
    }
    $('bill-amount-display').textContent=billAmountStr?parseFloat(billAmountStr).toFixed(2):'0.00';
  });
});

// Reminder days chips toggle
$('reminder-days-chips').addEventListener('click',(e)=>{
  const chip = e.target.closest('.tile');
  if(!chip || !chip.dataset.days) return;
  chip.classList.toggle('on');
});

$('btn-bill-save').addEventListener('click',saveBillHandler);
$('btn-bill-delete').addEventListener('click',deleteBillHandler);

function openBillModal(mode, bill){
  editingBill = bill || null;
  $('bill-modal-error').style.display = 'none';

  if(mode === 'add'){
    $('bill-modal-title').textContent = 'Add Bill';
    $('bill-name').value = '';
    billAmountStr = '';
    $('bill-amount-display').textContent = '0.00';
    $('bill-due-day').value = '1';
    $('bill-active').checked = true;
    $('btn-bill-save').textContent = 'Save Bill';
    $('btn-bill-delete').classList.add('hidden');
    // Set default reminder days: all 3 selected
    $('reminder-days-chips').querySelectorAll('.tile').forEach(t=>t.classList.add('on'));
  }else{
    $('bill-modal-title').textContent = 'Edit Bill';
    $('bill-name').value = bill.name;
    billAmountStr = String(bill.amount || 0);
    $('bill-amount-display').textContent = (bill.amount||0).toFixed(2);
    $('bill-due-day').value = bill.dueDay;
    $('bill-active').checked = bill.active !== false;
    $('btn-bill-save').textContent = 'Update Bill';
    $('btn-bill-delete').classList.remove('hidden');

    // Set reminder days chips
    const days = bill.reminderDays || [3,1,0];
    $('reminder-days-chips').querySelectorAll('.tile').forEach(t=>{
      if(days.includes(parseInt(t.dataset.days))){
        t.classList.add('on');
      }else{
        t.classList.remove('on');
      }
    });
  }

  $('bill-modal').classList.remove('hidden');
  setTimeout(()=>$('bill-name').focus(), 100);
}

function closeBillModal(){
  $('bill-modal').classList.add('hidden');
  editingBill = null;
}

function saveBillHandler(){
  const name = $('bill-name').value.trim();
  const amount = parseFloat(billAmountStr) || 0;
  const dueDay = parseInt($('bill-due-day').value) || 1;
  const active = $('bill-active').checked;
  const errEl = $('bill-modal-error');

  if(!name){ errEl.textContent = 'Enter bill name'; errEl.style.display='block'; return; }
  // Amount is optional for bill tracking
  if(dueDay < 1 || dueDay > 31){ errEl.textContent = 'Due day must be 1-31'; errEl.style.display='block'; return; }

  const reminderDays = [];
  $('reminder-days-chips').querySelectorAll('.tile.on').forEach(t=>{
    reminderDays.push(parseInt(t.dataset.days));
  });
  reminderDays.sort((a,b)=>b-a);

  if(reminderDays.length === 0){
    errEl.textContent = 'Select at least one reminder'; errEl.style.display='block'; return;
  }

  errEl.style.display = 'none';

  const data = { name, amount, dueDay, reminderDays, active, updatedAt: firebase.database.ServerValue.TIMESTAMP };

  if(editingBill){
    updateBill(currentUser.uid, editingBill.id, data).then(()=>{
      closeBillModal();
      renderBills();
    });
  }else{
    data.createdAt = firebase.database.ServerValue.TIMESTAMP;
    saveBill(currentUser.uid, data).then(()=>{
      closeBillModal();
      renderBills();
    });
  }
}

function deleteBillHandler(){
  if(!editingBill){ return; }
  if(!confirm('Delete this bill reminder? Cannot undo.')) return;
  deleteBill(currentUser.uid, editingBill.id).then(()=>{
    closeBillModal();
    renderBills();
  });
}

/* ─── INIT ─── */
if('serviceWorker' in navigator){
  navigator.serviceWorker.register('sw.js').catch(console.error);
}

})();
