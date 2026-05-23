     1|(function(){
     2|'use strict';
     3|
     4|/* ─── FIREBASE CONFIG ─── */
     5|const FIREBASE_CONFIG = {
  apiKey: "AIzaSyC2fezwrXSOeDCytG84RES-dJ04teLvmuo",
     7|  authDomain: "ainvested-703ec.firebaseapp.com",
     8|  databaseURL: "https://ainvested-703ec-default-rtdb.firebaseio.com",
     9|  projectId: "ainvested-703ec",
    10|  storageBucket: "ainvested-703ec.firebasestorage.app",
    11|  messagingSenderId: "453797298902",
    12|  appId: "1:453797298902:web:ea0018b9a52dd73eaaff77"
    13|};
    14|
    15|firebase.initializeApp(FIREBASE_CONFIG);
    16|const auth = firebase.auth();
    17|const db = firebase.database();
    18|
    19|const APP_VER = 'v2.0-firebase';
    20|
    21|/* ─── CONSTANTS ─── */
    22|const CATEGORIES = [
    23|  'Food & Dining','Groceries','Transport','Shopping',
    24|  'Utilities','Entertainment','Health & Wellness','Home','Others'
    25|];
    26|const CAT_MAP = {
    27|  'food & dining': ['mamak','kfc','mcd','tealive','starbucks','grabfood','foodpanda','nando','pizza','sushi','ramen','nasik','warung','restoran','cafe','kopitiam','dimsum','bakery','7eats','domino'],
    28|  'groceries': ['99 speedmart','aeon','jaya grocer','village grocer','lotus','tesco','mydin','guardian','watson','ekono','mr diy','shell select','petronas mesra','7-eleven','family mart','grocer'],
    29|  'transport': ['grab','shell','petron','petronas','caltex','bp','bhp','touch n go','toll','parking','bas','ktm','lrt','mrt','flight','airasia','mas','firefly','fuel','minyak','petrol','diesel','uber','inDriver'],
    30|  'shopping': ['shopee','lazada','tiktok shop','zalora','h&m','uniqlo','padini','cotton on','nike','adidas','switch','machine','apple','samsung',' Courts','harvey','ikea','mr diy','laptop','phone','watch'],
    31|  'utilities': ['tnb','syabas','indah water','astro','unifi','maxis','digi','celcom','hotlink','umobile','yes','time','tm','electric','water','internet','broadband','phone bill','billplz','utility'],
    32|  'entertainment': ['netflix','spotify','youtube','disney','hbo','prime video','cinema','tickets','concert','gaming','steam','playstation','xbox','bowling','ktv','karaoke','arcade','zoo','aquaria','travel','hotel','agoda','booking','airbnb','trip','cuti'],
    33|  'health & wellness': ['pharmacy','clinic','hospital','dental','physio','gym','fitness','yoga','pilates','saloon','barber','spa','massage','supplement','vitamin','medical','doktor','ubat'],
    34|  'home': ['mortgage','rent','renovation','furniture','cleaning','laundry','repair','plumber','electrician','contractor','security','alarm','cctv','garden','taman','rumah']
    35|};
    36|const QUICK_TILES = [
    37|  { merchant: 'Grab', category: 'Transport' },
    38|  { merchant: 'Shell', category: 'Transport' },
    39|  { merchant: '99 Speedmart', category: 'Groceries' },
    40|  { merchant: 'Shopee', category: 'Shopping' },
    41|  { merchant: 'Foodpanda', category: 'Food & Dining' },
    42|  { merchant: 'Tealive', category: 'Food & Dining' },
    43|  { merchant: 'Jaya Grocer', category: 'Groceries' },
    44|  { merchant: 'TNB', category: 'Utilities' },
    45|  { merchant: 'Unifi', category: 'Utilities' },
    46|  { merchant: 'Netflix', category: 'Entertainment' },
    47|  { merchant: 'Mamak', category: 'Food & Dining' },
    48|  { merchant: 'Petronas', category: 'Transport' }
    49|];
    50|
    51|/* ─── STATE ─── */
    52|let currentUser = null;   // { uid, name, pin }
    53|let amountStr = '';
    54|let pendingCount = 0;
    55|let authReady = false;
    56|
    57|/* ─── HELPERS ─── */
    58|function $(id){ return document.getElementById(id); }
    59|function now(){ return new Date(); }
    60|function fmtDate(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
    61|function fmtMoney(n){ return 'RM '+n.toFixed(2); }
    62|function parseMoney(s){ const v=parseFloat(s); return isNaN(v)?0:v; }
    63|function esc(s){ const d=document.createElement('div'); d.textContent=s; return d.innerHTML; }
    64|function detectCategory(merchant){
    65|  const m=merchant.toLowerCase();
    66|  for(const[cat,keywords] of Object.entries(CAT_MAP)){
    67|    if(keywords.some(k=>m.includes(k))) return cat.replace(/\b\w/g,l=>l.toUpperCase()).replace('&',' & ').replace('N Go','N Go');
    68|  }
    69|  return 'Others';
    70|}
    71|
    72|/* ─── NAV ─── */
    73|function showScreen(id){
    74|  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
    75|  $(id).classList.add('active');
    76|}
    77|
    78|/* ─── AUTH ─── */
    79|auth.onAuthStateChanged(user=>{
    80|  authReady = true;
    81|  if(!user){
    82|    auth.signInAnonymously().catch(console.error);
    83|    return;
    84|  }
    85|  // anonymous user now has stable uid
    86|  if(currentUser){
    87|    refreshDash();
    88|    refreshReviewBadge();
    89|  }
    90|});
    91|
    92|/* ─── USER PROFILE ─── */
    93|function userRef(uid){ return db.ref('users/'+uid); }
    94|function expRef(uid){ return db.ref('users/'+uid+'/expenses'); }
    95|function settingsRef(uid){ return db.ref('users/'+uid+'/settings'); }
    96|function ownerLinksRef(ownerUid){ return db.ref('owners/'+ownerUid+'/links'); }
    97|
    98|function loadUserProfile(uid){
    99|  return userRef(uid).once('value').then(s=>s.val()||null);
   100|}
   101|function saveUserProfile(uid, name, pin){
   102|  return userRef(uid).update({ name, pin, updatedAt: firebase.database.ServerValue.TIMESTAMP });
   103|}
   104|function saveExpense(uid, expense){
   105|  const key = expRef(uid).push().key;
   106|  return expRef(uid).child(key).set(expense).then(()=>key);
   107|}
   108|function updateExpenseStatus(uid, expId, status){
   109|  return expRef(uid).child(expId).update({ status });
   110|}
   111|function loadExpenses(uid){
   112|  return expRef(uid).once('value').then(s=>{
   113|    const v=s.val()||{};
   114|    return Object.entries(v).map(([id,o])=>({id,...o}));
   115|  });
   116|}
   117|function loadSettings(uid){
   118|  return settingsRef(uid).once('value').then(s=>s.val()||{});
   119|}
   120|function saveSettings(uid, settings){
   121|  return settingsRef(uid).set(settings);
   122|}
   123|function requestLink(partnerUid, ownerUid, partnerName){
   124|  return ownerLinksRef(ownerUid).child(partnerUid).set({ status:'pending', name: partnerName, requestedAt: firebase.database.ServerValue.TIMESTAMP });
   125|}
   126|function approveLink(ownerUid, partnerUid){
   127|  return ownerLinksRef(ownerUid).child(partnerUid).update({ status:'approved', approvedAt: firebase.database.ServerValue.TIMESTAMP });
   128|}
   129|function rejectLink(ownerUid, partnerUid){
   130|  return ownerLinksRef(ownerUid).child(partnerUid).update({ status:'rejected', rejectedAt: firebase.database.ServerValue.TIMESTAMP });
   131|}
   132|function removeLink(ownerUid, partnerUid){
   133|  return ownerLinksRef(ownerUid).child(partnerUid).remove();
   134|}
   135|function loadOwnerLinks(ownerUid){
   136|  return ownerLinksRef(ownerUid).once('value').then(s=>s.val()||{});
   137|}
   138|
   139|/* ─── LOGIN ─── */
   140|$('btn-login').addEventListener('click',doLogin);
   141|$('login-pin').addEventListener('keydown',e=>{ if(e.key==='Enter') doLogin(); });
   142|
   143|function doLogin(){
   144|  const name=$('login-name').value.trim();
   145|  const pin=$('login-pin').value.trim();
   146|  if(!name||pin.length!==4||!/\d{4}/.test(pin)){ alert('Enter name and 4-digit PIN'); return; }
   147|  if(!authReady){ alert('Auth initializing, try again in 2 seconds'); return; }
   148|
   149|  const uid = auth.currentUser ? auth.currentUser.uid : null;
   150|  if(!uid){ alert('Auth not ready'); return; }
   151|
   152|  loadUserProfile(uid).then(profile=>{
   153|    if(profile){
   154|      if(profile.pin!==pin){ alert('Wrong PIN'); return; }
   155|      currentUser = { uid, name: profile.name || name, pin };
   156|    }else{
   157|      currentUser = { uid, name, pin };
   158|      saveUserProfile(uid, name, pin);
   159|    }
   160|    $('dash-greeting').textContent = 'Hello, '+currentUser.name;
   161|    showScreen('dash-screen');
   162|    refreshDash();
   163|    refreshReviewBadge();
   164|  });
   165|}
   166|
   167|$('btn-switch-user').addEventListener('click',()=>{
   168|  currentUser=null;
   169|  $('login-name').value='';
   170|  $('login-pin').value='';
   171|  showScreen('login-screen');
   172|});
   173|
   174|/* ─── DASHBOARD ─── */
   175|function refreshDash(){
   176|  if(!currentUser) return;
   177|  const uid = currentUser.uid;
   178|  const today = fmtDate(now());
   179|  const monthPrefix = today.slice(0,7);
   180|
   181|  loadSettings(uid).then(settings=>{
   182|    const ownerUid = settings.ownerUid || null;
   183|
   184|    // Load own expenses
   185|    loadExpenses(uid).then(own=>{
   186|      let combined = own.map(e=>({...e,_user:currentUser.name,_uid:uid}));
   187|
   188|      // If this user has an owner, only show own data (Farah case)
   189|      // If this user IS an owner (has approved links), merge partner data
   190|      loadOwnerLinks(uid).then(links=>{
   191|        const approved = Object.entries(links).filter(([id,l])=>l.status==='approved');
   192|        const isOwner = approved.length > 0;
   193|
   194|        if(isOwner && !ownerUid){
   195|          // Owner view: merge all approved partners' APPROVED expenses
   196|          const fetches = approved.map(([puid])=> loadExpenses(puid).then(list=> list.filter(e=>e.status!=='rejected').map(e=>({...e,_user:links[puid].name,_uid:puid}))) );
   197|          Promise.all(fetches).then(partnerLists=>{
   198|            partnerLists.forEach(pl=> combined = combined.concat(pl));
   199|            renderDash(combined, today, monthPrefix);
   200|          });
   201|        }else{
   202|          // Partner view or solo: show own data only
   203|          renderDash(combined, today, monthPrefix);
   204|        }
   205|      });
   206|    });
   207|  });
   208|}
   209|
   210|function renderDash(combined, today, monthPrefix){
   211|  const todaySum = combined.filter(e=>e.date===today).reduce((a,e)=>a+e.amount,0);
   212|  const monthSum = combined.filter(e=>e.date.startsWith(monthPrefix)).reduce((a,e)=>a+e.amount,0);
   213|  $('hero-today').textContent = fmtMoney(todaySum);
   214|  $('hero-month').textContent = fmtMoney(monthSum);
   215|
   216|  // Quick tiles
   217|  const tiles = $('quick-tiles');
   218|  tiles.innerHTML = '';
   219|  const freq = {};
   220|  combined.forEach(e=>{ freq[e.merchant]=(freq[e.merchant]||0)+1; });
   221|  const hist = Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([m])=>m);
   222|  const toShow = [...new Set([...hist, ...QUICK_TILES.map(t=>t.merchant)])].slice(0,12);
   223|  toShow.forEach(m=>{
   224|    const el = document.createElement('div');
   225|    el.className = 'tile';
   226|    el.textContent = m;
   227|    el.addEventListener('click',()=>openAdd(m,detectCategory(m)));
   228|    tiles.appendChild(el);
   229|  });
   230|
   231|  // Recent list
   232|  const recent = $('recent-list');
   233|  recent.innerHTML = '';
   234|  const recentList = combined.sort((a,b)=>(b.timestamp||0)-(a.timestamp||0)).slice(0,20);
   235|  if(recentList.length===0){
   236|    recent.innerHTML='<div class="item"><div class="item-left"><span class="item-name">No expenses yet</span></div></div>';
   237|  }else{
   238|    recentList.forEach(e=>{
   239|      const isPartner = e._uid !== currentUser.uid;
   240|      const tag = isPartner ? `<span class="partner-tag">${esc(e._user)}</span>` : '';
   241|      const statusLabel = e.status==='pending' ? ' <span style="color:var(--danger);font-size:0.7rem">[PENDING]</span>' : '';
   242|      const item = document.createElement('div');
   243|      item.className = 'item';
   244|      item.innerHTML = `
   245|        <div class="item-left">
   246|          <span class="item-name">${esc(e.merchant)}${tag}${statusLabel}</span>
   247|          <span class="item-meta">${e.category} · ${e.date}</span>
   248|        </div>
   249|        <span class="item-amount">${fmtMoney(e.amount)}</span>
   250|      `;
   251|      recent.appendChild(item);
   252|    });
   253|  }
   254|}
   255|
   256|/* ─── ADD EXPENSE ─── */
   257|$('btn-add').addEventListener('click',()=>openAdd());
   258|$('btn-add-back').addEventListener('click',()=>{ showScreen('dash-screen'); refreshDash(); });
   259|
   260|function openAdd(preMerchant,preCategory){
   261|  amountStr='';
   262|  $('amount-display').textContent='0.00';
   263|  $('add-merchant').value=preMerchant||'';
   264|  const cat=preCategory||(preMerchant?detectCategory(preMerchant):'Others');
   265|  $('cat-detected').textContent=cat;
   266|  $('add-category').value=cat;
   267|  buildSuggest();
   268|  showScreen('add-screen');
   269|  if(!preMerchant) setTimeout(()=>$('add-merchant').focus(),50);
   270|}
   271|
   272|// numpad
   273|document.querySelectorAll('.numpad button').forEach(btn=>{
   274|  btn.addEventListener('click',()=>{
   275|    const k=btn.dataset.k;
   276|    if(k==='C'){ amountStr=''; }
   277|    else if(k==='.'&&amountStr.includes('.')){}
   278|    else if(k==='0'&&amountStr===''){}
   279|    else {
   280|      const next=amountStr+k;
   281|      const parts=next.split('.');
   282|      if(parts[1]&&parts[1].length>2){}
   283|      else if(next.replace('.','').length>8){}
   284|      else { amountStr=next; }
   285|    }
   286|    $('amount-display').textContent=amountStr?parseFloat(amountStr).toFixed(2):'0.00';
   287|  });
   288|});
   289|
   290|// merchant input + suggest
   291|$('add-merchant').addEventListener('input',()=>{
   292|  buildSuggest();
   293|  const cat=detectCategory($('add-merchant').value);
   294|  $('cat-detected').textContent=cat;
   295|  $('add-category').value=cat;
   296|});
   297|
   298|function buildSuggest(){
   299|  const val=$('add-merchant').value.toLowerCase().trim();
   300|  const box=$('merchant-suggest');
   301|  if(!val){ box.innerHTML=''; return; }
   302|  if(!currentUser){ box.innerHTML=''; return; }
   303|  loadExpenses(currentUser.uid).then(list=>{
   304|    const matches=[];
   305|    list.forEach(e=>{ if(e.merchant.toLowerCase().includes(val)) matches.push(e.merchant); });
   306|    QUICK_TILES.forEach(t=>{ if(t.merchant.toLowerCase().includes(val)) matches.push(t.merchant); });
   307|    const uniq=[...new Set(matches)].slice(0,6);
   308|    box.innerHTML=uniq.map(m=>`<span class="suggest-chip" onclick="window.setMerchant('${esc(m)}')">${esc(m)}</span>`).join('');
   309|  });
   310|}
   311|window.setMerchant=function(m){ $('add-merchant').value=m; buildSuggest(); $('cat-detected').textContent=detectCategory(m); $('add-category').value=detectCategory(m); };
   312|
   313|// category override
   314|$('cat-detected').addEventListener('click',()=>{
   315|  $('cat-detected').classList.toggle('hidden');
   316|  $('add-category').classList.toggle('hidden');
   317|  if(!$('add-category').classList.contains('hidden')) $('add-category').focus();
   318|});
   319|$('add-category').addEventListener('change',()=>{ $('cat-detected').textContent=$('add-category').value; $('cat-detected').classList.remove('hidden'); $('add-category').classList.add('hidden'); });
   320|
   321|// save
   322|$('btn-save').addEventListener('click',()=>{
   323|  const merchant=$('add-merchant').value.trim();
   324|  const amount=parseMoney(amountStr);
   325|  const category=$('cat-detected').textContent;
   326|  if(!merchant){ alert('Enter merchant'); return; }
   327|  if(amount<=0){ alert('Enter amount'); return; }
   328|
   329|  const ts = Date.now();
   330|  const expense = {
   331|    merchant, amount, category,
   332|    date: fmtDate(now()),
   333|    timestamp: ts,
   334|    status: 'pending'
   335|  };
   336|
   337|  loadSettings(currentUser.uid).then(settings=>{
   338|    // If linked to an owner, stay pending. If solo, auto-approve.
   339|    if(!settings.ownerUid){
   340|      expense.status = 'approved';
   341|    }
   342|    saveExpense(currentUser.uid, expense).then(()=>{
   343|      showScreen('dash-screen');
   344|      refreshDash();
   345|    });
   346|  });
   347|});
   348|
   349|/* ─── REVIEW SCREEN ─── */
   350|$('btn-review').addEventListener('click',()=>{
   351|  showScreen('review-screen');
   352|  renderReview();
   353|});
   354|$('btn-review-back').addEventListener('click',()=>{ showScreen('dash-screen'); });
   355|
   356|function refreshReviewBadge(){
   357|  if(!currentUser) return;
   358|  const uid = currentUser.uid;
   359|  loadOwnerLinks(uid).then(links=>{
   360|    const approved = Object.entries(links).filter(([id,l])=>l.status==='approved');
   361|    if(approved.length===0){ $('btn-review').classList.add('hidden'); return; }
   362|    let count = 0;
   363|    const fetches = approved.map(([puid])=> loadExpenses(puid).then(list=>{
   364|      list.forEach(e=>{ if(e.status==='pending') count++; });
   365|    }));
   366|    Promise.all(fetches).then(()=>{
   367|      pendingCount = count;
   368|      if(count>0){
   369|        $('btn-review').classList.remove('hidden');
   370|        $('pending-badge').textContent = count;
   371|        $('pending-badge').classList.remove('hidden');
   372|      }else{
   373|        $('btn-review').classList.remove('hidden');
   374|        $('pending-badge').classList.add('hidden');
   375|      }
   376|    });
   377|  });
   378|}
   379|
   380|function renderReview(){
   381|  const list = $('review-list');
   382|  list.innerHTML = '<div class="item"><div class="item-left"><span class="item-name">Loading...</span></div></div>';
   383|  if(!currentUser) return;
   384|
   385|  loadOwnerLinks(currentUser.uid).then(links=>{
   386|    const approved = Object.entries(links).filter(([id,l])=>l.status==='approved');
   387|    if(approved.length===0){ list.innerHTML='<div class="item"><div class="item-left"><span class="item-name">No partners linked</span></div></div>'; return; }
   388|
   389|    let pendingItems = [];
   390|    const fetches = approved.map(([puid])=> loadExpenses(puid).then(expenses=>{
   391|      expenses.filter(e=>e.status==='pending').forEach(e=>{
   392|        pendingItems.push({...e,_uid:puid,_user:links[puid].name});
   393|      });
   394|    }));
   395|
   396|    Promise.all(fetches).then(()=>{
   397|      pendingItems.sort((a,b)=>(b.timestamp||0)-(a.timestamp||0));
   398|      if(pendingItems.length===0){
   399|        list.innerHTML='<div class="item"><div class="item-left"><span class="item-name">No pending expenses to review</span></div></div>';
   400|        return;
   401|      }
   402|      list.innerHTML = '';
   403|      pendingItems.forEach(e=>{
   404|        const item = document.createElement('div');
   405|        item.className = 'item review-item';
   406|        item.innerHTML = `
   407|          <div class="item-left">
   408|            <span class="item-name">${esc(e.merchant)} <span class="partner-tag">${esc(e._user)}</span></span>
   409|            <span class="item-meta">${e.category} · ${e.date}</span>
   410|          </div>
   411|          <span class="item-amount">${fmtMoney(e.amount)}</span>
   412|          <div class="review-actions">
   413|            <button class="btn-approve" data-id="${esc(e.id)}" data-uid="${esc(e._uid)}">Approve</button>
   414|            <button class="btn-reject" data-id="${esc(e.id)}" data-uid="${esc(e._uid)}">Reject</button>
   415|          </div>
   416|        `;
   417|        list.appendChild(item);
   418|      });
   419|
   420|      list.querySelectorAll('.btn-approve').forEach(btn=>{
   421|        btn.addEventListener('click',()=>{
   422|          const id=btn.dataset.id, uid=btn.dataset.uid;
   423|          updateExpenseStatus(uid, id, 'approved').then(()=>{ renderReview(); refreshReviewBadge(); refreshDash(); });
   424|        });
   425|      });
   426|      list.querySelectorAll('.btn-reject').forEach(btn=>{
   427|        btn.addEventListener('click',()=>{
   428|          const id=btn.dataset.id, uid=btn.dataset.uid;
   429|          updateExpenseStatus(uid, id, 'rejected').then(()=>{ renderReview(); refreshReviewBadge(); refreshDash(); });
   430|        });
   431|      });
   432|    });
   433|  });
   434|}
   435|
   436|/* ─── SETTINGS ─── */
   437|$('btn-settings').addEventListener('click',()=>{
   438|  showScreen('settings-screen');
   439|  renderSettings();
   440|});
   441|$('btn-settings-back').addEventListener('click',()=>showScreen('dash-screen'));
   442|
   443|function renderSettings(){
   444|  if(!currentUser) return;
   445|  const uid = currentUser.uid;
   446|  $('set-my-uid').textContent = uid;
   447|  $('app-version').textContent = APP_VER;
   448|
   449|  loadSettings(uid).then(settings=>{
   450|    const ownerUid = settings.ownerUid || '';
   451|    $('set-owner-uid').value = ownerUid;
   452|    if(ownerUid){ $('btn-clear-owner').classList.remove('hidden'); }
   453|    else { $('btn-clear-owner').classList.add('hidden'); }
   454|  });
   455|
   456|  // Owner panels
   457|  loadOwnerLinks(uid).then(links=>{
   458|    const pending = Object.entries(links).filter(([id,l])=>l.status==='pending');
   459|    const approved = Object.entries(links).filter(([id,l])=>l.status==='approved');
   460|
   461|    const pendingDiv = $('pending-links');
   462|    if(pending.length>0){
   463|      $('owner-panel').classList.remove('hidden');
   464|      pendingDiv.innerHTML = '';
   465|      pending.forEach(([puid, l])=>{
   466|        const row = document.createElement('div');
   467|        row.className = 'link-request';
   468|        row.innerHTML = `
   469|          <span>${esc(l.name)} <code>${esc(puid)}</code></span>
   470|          <div class="btn-row">
   471|            <button class="btn-primary btn-sm" data-uid="${esc(puid)}" data-action="approve">Approve</button>
   472|            <button class="btn-danger btn-sm" data-uid="${esc(puid)}" data-action="reject">Reject</button>
   473|          </div>
   474|        `;
   475|        pendingDiv.appendChild(row);
   476|      });
   477|      pendingDiv.querySelectorAll('button').forEach(btn=>{
   478|        btn.addEventListener('click',()=>{
   479|          const puid=btn.dataset.uid;
   480|          if(btn.dataset.action==='approve') approveLink(uid,puid).then(renderSettings);
   481|          else rejectLink(uid,puid).then(renderSettings);
   482|        });
   483|      });
   484|    }else{
   485|      $('owner-panel').classList.add('hidden');
   486|    }
   487|
   488|    const approvedDiv = $('approved-links');
   489|    if(approved.length>0){
   490|      $('approved-panel').classList.remove('hidden');
   491|      approvedDiv.innerHTML = '';
   492|      approved.forEach(([puid, l])=>{
   493|        const row = document.createElement('div');
   494|        row.className = 'link-request';
   495|        row.innerHTML = `
   496|          <span>${esc(l.name)} <code>${esc(puid)}</code></span>
   497|          <button class="btn-danger btn-sm" data-uid="${esc(puid)}">Remove</button>
   498|        `;
   499|        approvedDiv.appendChild(row);
   500|      });
   501|