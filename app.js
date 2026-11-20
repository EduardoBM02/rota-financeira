
const $ = (id) => document.getElementById(id);

// Conexão com o Supabase
const SUPABASE_URL = window.ROTA_CONFIG.SUPABASE_URL;
const SUPABASE_KEY = window.ROTA_CONFIG.SUPABASE_ANON_KEY;

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

const incomeCategories = [
    'Corridas',
    'Bônus e incentivos',
    'Entregas',
    'Outros ganhos'
];

const expenseCategories = [
    'Combustível',
    'Alimentação',
    'Manutenção',
    'Lavagem',
    'Seguro',
    'Documentação',
    'Estacionamento e pedágio',
    'Financiamento',
    'Outros custos'
];

let currentUser = null;
let authMode = 'login';
let toastTimer;

// Retorna os dados do usuário atual
function userData() {
    return currentUser.data;
}

// Retorna as movimentações
function allTransactions() {
    return userData().transactions || [];
}

// Salva os dados do usuário no Supabase
async function saveDB() {
    if (!currentUser) {
        throw new Error('Nenhum usuário autenticado.');
    }
    const { error } = await supabaseClient
        .from('user_finance_data')
        .upsert({
            user_id: currentUser.id,
            data: currentUser.data,
            updated_at: new Date().toISOString()
        }, {
            onConflict: 'user_id'
        });
    if (error) {
        throw error;
    }
}

// Carrega os dados financeiros do usuário
async function loadUserData(authUser) {

    const { data, error } = await supabaseClient
        .from('user_finance_data')
        .select('data')
        .eq('user_id', authUser.id)
        .maybeSingle();
    if (error) {
        throw error;
    }

    const savedData = data?.data || {
        transactions: [],
        goals: []
    };

    return {
        id: authUser.id,
        email: authUser.email,
        name:
            authUser.user_metadata?.name ||
            authUser.email.split('@')[0],
        data: {
            transactions: savedData.transactions || [],
            goals: savedData.goals || []
        }
    };
}


function money(n){
    return Number(n||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
}

function today(){
    return new Date().toISOString().slice(0,10)
}

function dateBR(s){
    if(!s)return '—';
    return new Date(s+'T12:00:00').toLocaleDateString('pt-BR')
    }

function userData(){
    return currentUser.data
}

function allTransactions(){
    return userData().transactions || []
}

function toast(msg){
    const t=$('toast');
    t.textContent=msg;t.classList.add('show');
    clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),2600)
}

function escapeHTML(s){
    return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
}

function setAuth(mode){
    authMode=mode;
        $('authName').classList.toggle('hidden',mode!=='register');
        $('authName').required=mode==='register';$('authTitle').textContent=mode==='login'?'Bem-vindo de volta':'Crie sua conta';
        $('authSubtitle').textContent=mode==='login'?'Entre para acompanhar seus ganhos e despesas.':'Cadastre-se para começar a organizar suas finanças.';$('authSubmit').textContent=mode==='login'?'Entrar':'Criar conta';$('authSwitch').innerHTML=mode==='login'?'Ainda não tem conta? <button class="link-btn" id="toggleAuth" type="button">Criar cadastro</button>':'Já tem uma conta? <button class="link-btn" id="toggleAuth" type="button">Entrar</button>';$('authError').textContent='';$('toggleAuth').onclick=()=>setAuth(authMode==='login'?'register':'login')
}

$('toggleAuth').onclick=()=>setAuth('register');

$('authForm').addEventListener('submit', async e => {
    e.preventDefault();

    const email = $('authEmail').value.trim().toLowerCase();
    const password = $('authPassword').value;
    const name = $('authName').value.trim();

    $('authError').textContent = '';
    $('authSubmit').disabled = true;

    try {
        // CADASTRO
        if (authMode === 'register') {
            if (password.length < 6) {
                throw new Error(
                    'A senha precisa ter pelo menos 6 caracteres.'
                );
            }
            if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
                throw new Error(
                    'A senha precisa conter pelo menos uma letra e um número.'
                );
            }
            const { data, error } = await supabaseClient.auth.signUp({
                email: email,
                password: password,
                options: {
                    data: {
                        name: name || email.split('@')[0]
                    }
                }
            });
            if (error) {
                throw error;
            }
            // Se a confirmação de e-mail estiver habilitada
            if (!data.session) {
                $('authError').textContent =
                    'Cadastro realizado! Confira seu e-mail para confirmar a conta e depois faça login.';
                return;
            }
            await login(data.user);
            toast('Cadastro realizado com sucesso!');
        }
        // LOGIN
        else {
            const { data, error } =
                await supabaseClient.auth.signInWithPassword({
                    email: email,
                    password: password
                });
            if (error) {
                throw error;
            }
            await login(data.user);
        }
    } catch (error) {
        console.error('Erro de autenticação:', error);
        $('authError').textContent =
            error.message || 'Não foi possível realizar a operação.';
    } finally {
        $('authSubmit').disabled = false;
    }
});



async function login(authUser) {

    currentUser = await loadUserData(authUser);

    // Cria o registro financeiro inicial, caso ainda não exista
    await saveDB();

    $('authView').classList.add('hidden');
    $('appView').classList.remove('hidden');

    $('userName').textContent = currentUser.name;
    $('userEmail').textContent = currentUser.email;

    $('userAvatar').textContent =
        (currentUser.name[0] || 'M').toUpperCase();

    $('welcomeText').textContent =
        'Olá, ' + currentUser.name.split(' ')[0] + '!';

    $('todayLabel').textContent =
        new Date().toLocaleDateString('pt-BR', {
            weekday: 'short',
            day: '2-digit',
            month: 'short'
        });

    showPage('dashboard');

    refreshAll();
}

$('logoutBtn').onclick = async () => {
    try {
        const { error } = await supabaseClient.auth.signOut();
        if (error) {
            throw error;
        }
        currentUser = null;

        $('appView').classList.add('hidden');
        $('authView').classList.remove('hidden');
        $('authForm').reset();
        setAuth('login');

    } catch (error) {
        console.error(error);
        toast('Erro ao sair da conta.');
    }
};

// Recupera a sessão quando o aplicativo é aberto
(async function restoreSession() {
    try {
        const {
            data: { session },
            error
        } = await supabaseClient.auth.getSession();
        if (error) {
            throw error;
        }
        if (session?.user) {

            await login(session.user);

        }
    } catch (error) {
        console.error('Erro ao recuperar sessão:', error);

        $('authError').textContent =
            'Não foi possível recuperar sua sessão.';
    }
})();

function showPage(page){
    document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.id==='page-'+page));
    document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.page===page));
    $('pageTitle').textContent=({
        dashboard:'Visão geral',
        transactions:'Movimentações',
        goals:'Metas financeiras',
        reports:'Relatórios'
    })[page];
    if(page==='reports')renderReports();
    if(page==='transactions')renderTransactions()
}
document.querySelectorAll('.nav-item').forEach(b=>b.onclick=()=>showPage(b.dataset.page));
document.querySelectorAll('[data-goto]').forEach(b=>b.onclick=()=>showPage(b.dataset.goto));

function periodStart(period){
    const d=new Date();d.setHours(0,0,0,0);if(period==='day')return d;
    if(period==='week'){const day=(d.getDay()+6)%7;d.setDate(d.getDate()-day);
        return d}if(period==='month')return new Date(d.getFullYear(),d.getMonth(),1);
        return new Date(0)
}

function filterPeriod(items,period){
    if(period==='all')return items;
    const start=periodStart(period);
    return items.filter(t=>new Date(t.date+'T12:00:00')>=start)
}

function totals(items){
    const income=items.filter(t=>t.type==='income').reduce((a,t)=>a+t.amount,0),expense=items.filter(t=>t.type==='expense').reduce((a,t)=>a+t.amount,0);
    return {income,expense,net:income-expense,count:items.length}
}

function refreshAll(){
    renderDashboard();
    renderTransactions();
    renderGoals();
    renderReports()
}
$('dashboardPeriod').onchange=renderDashboard;

function renderDashboard(){
    const items=filterPeriod(allTransactions(),$('dashboardPeriod').value),t=totals(items);
    $('incomeTotal').textContent=money(t.income);
    $('expenseTotal').textContent=money(t.expense);
    $('netTotal').textContent=money(t.net);$('netTotal').style.color=t.net<0?'#ffe0d7':'#fff';
    $('countTotal').textContent=t.count;
    const recent=[...allTransactions()].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5);
    $('recentRows').innerHTML=recent.map(rowHTML).join('');$('recentEmpty').classList.toggle('hidden',recent.length>0);
    renderCategorySummary(items);
    drawOverviewChart()
}

function rowHTML(t){
    return `<tr>
            <td>
                <strong>${escapeHTML(t.description)}</strong>
                ${t.notes?`
                <br>
                <small class="muted">${escapeHTML(t.notes)}</small>`:''}
                </td>
            <td>${escapeHTML(t.category)}</td>
            <td>${dateBR(t.date)}</td>
            <td>
                <span class="type-pill ${t.type==='expense'?'expense':''}">${t.type==='income'?'Ganho':'Despesa'}</span>
                </td>
            <td class="right ${t.type==='income'?'amount-income':'amount-expense'}">${t.type==='income'?'+':'−'} ${money(t.amount)}</td>
            </tr>`
}

function renderCategorySummary(items){
    const expenses=items.filter(t=>t.type==='expense'),groups={};
    expenses.forEach(t=>groups[t.category]=(groups[t.category]||0)+t.amount);
    const sorted=Object.entries(groups).sort((a,b)=>b[1]-a[1]);
    $('categorySummary').innerHTML=sorted.length?sorted.map(([name,val])=>`<div class="category-row"><span>${
        escapeHTML(name)
    }</span><strong>${
        money(val)
    }</strong><div class="bar-track"><div class="bar-fill" style="width:${
        val/Math.max(...sorted.map(x=>x[1]))*100
    }%"></div></div></div>`).join(''):'<p class="empty">Registre despesas para visualizar as categorias.</p>'
}

function drawBars(canvasId,labels,incomes,expenses){
    const c=$(canvasId);if(!c)return;
    const ctx=c.getContext('2d'),w=c.clientWidth||500,h=230,dpr=window.devicePixelRatio||1;
    c.width=w*dpr;
    c.height=h*dpr;
    ctx.scale(dpr,dpr);
    ctx.clearRect(0,0,w,h);
    const max=Math.max(1,...incomes,...expenses)*1.18,left=34,right=10,top=12,bottom=28,chartH=h-top-bottom,chartW=w-left-right;
    ctx.font='10px DM Sans';
    ctx.fillStyle='#91a097';
    ctx.strokeStyle='#edf1ee';
    ctx.lineWidth=1;
    for(let i=0;i<=4;i++){
        let y=top+chartH*i/4;
        ctx.beginPath();
        ctx.moveTo(left,y);
        ctx.lineTo(w-right,y);
        ctx.stroke();
        ctx.fillText((max*(1-i/4)).toFixed(0),2,y+3)
    }
    const step=chartW/labels.length;labels.forEach(
        (label,i)=>{
            const bw=Math.min(15,step*.25),x=left+step*i+step/2;
            const ih=incomes[i]/max*chartH,eh=expenses[i]/max*chartH;
            ctx.fillStyle='#168653';
            ctx.fillRect(x-bw-2,top+chartH-ih,bw,ih);
            ctx.fillStyle='#e99a43';
            ctx.fillRect(x+2,top+chartH-eh,bw,eh);
            ctx.fillStyle='#829087';
            ctx.textAlign='center';
            ctx.fillText(label,x,h-8)
        }
    );
    ctx.textAlign='left'
}

function drawOverviewChart(){
    const labels=[],inc=[],exp=[];
    for(let i=6;i>=0;i--){
        const d=new Date();
        d.setDate(d.getDate()-i);
        const key=d.toISOString().slice(0,10);
        labels.push(d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'}))
        ;const day=allTransactions().filter(t=>t.date===key);
        inc.push(day.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0));
        exp.push(day.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0))
    }
    drawBars('overviewChart',labels,inc,exp)
}

function openTransaction(t=null){
    $('transactionForm').reset();
    $('transactionId').value=t?.id||'';
    $('transactionModalTitle').textContent=t?'Editar movimentação':'Nova movimentação';
    $('description').value=t?.description||'';
    $('amount').value=t?.amount??'';
    $('transactionDate').value=t?.date||today();$('notes').value=t?.notes||'';
    document.querySelector(`input[name="transactionType"][value="${t?.type||'income'}"]`).checked=true;
    fillCategories(t?.type||'income',t?.category);
    $('transactionDialog').showModal()
}

function fillCategories(type,selected=''){
    const select=$('transactionCategory');
    const list=type==='income'?incomeCategories:expenseCategories;
    select.innerHTML=list.map(c=>`<option ${c===selected?'selected':''}>${c}</option>`).join('')
}
document.querySelectorAll('input[name="transactionType"]').forEach(r=>r.onchange=()=>fillCategories(r.value));
$('quickAdd').onclick=$('addTransaction').onclick=()=>openTransaction();

$('transactionForm').addEventListener('submit', async e => {
    e.preventDefault();

    const id = $('transactionId').value;
    const type = document.querySelector('input[name="transactionType"]:checked').value;
    const t = {
        id: id || crypto.randomUUID(),
        type,
        description: $('description').value.trim(),
        amount: Number($('amount').value),
        date: $('transactionDate').value,
        category: $('transactionCategory').value,
        notes: $('notes').value.trim()
    };

    if (!t.description || !t.date || !Number.isFinite(t.amount) || t.amount <= 0) {
        return toast('Confira os campos do registro.');
    }
    const arr = userData().transactions;
    const idx = arr.findIndex(x => x.id === id);

    if (idx >= 0) {
        arr[idx] = t;
    } else {
        arr.push(t);
    }
    try {
        await saveDB();
    } catch (error) {
        console.error(error);
        toast('Erro ao salvar movimentação na nuvem.');
        return;
    }
    $('transactionDialog').close();
    refreshAll();
    toast(id? 'Registro atualizado.':'Movimentação adicionada.');
});

document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>$(b.dataset.close).close());

function renderTransactions(){
    const q=$('searchTransactions').value.toLowerCase(),type=$('typeFilter').value,period=$('transactionPeriod').value,cat=$('categoryFilter').value;
    const cats=[...new Set(allTransactions().map(t=>t.category))].sort();
    $('categoryFilter').innerHTML='<option value="all">Todas</option>'+cats.map(c=>`<option ${c===cat?'selected':''}>${escapeHTML(c)}</option>`).join('');
    const items=filterPeriod(allTransactions(),period).filter(t=>(type==='all'||t.type===type)&&(cat==='all'||t.category===cat)&&(`${t.description} ${t.category}`.toLowerCase().includes(q))).sort((a,b)=>b.date.localeCompare(a.date));
    $('transactionRows').innerHTML=items.map(
        t=>`
        <tr>
            <td>
                <strong>${escapeHTML(t.description)}</strong>
                </td>
            <td>${escapeHTML(t.category)}</td>
            <td>${dateBR(t.date)}</td>
            <td>
                <span class="type-pill ${t.type==='expense'?'expense':''}">${t.type==='income'?'Ganho':'Despesa'}</span>
            </td>
            <td class="right ${t.type==='income'?'amount-income':'amount-expense'}">${t.type==='income'?'+':'−'} ${money(t.amount)}</td>
            <td>
            <div class="action-cell">
                <button class="mini-btn" data-edit="${t.id}">Editar</button>
                <button class="mini-btn delete" data-delete="${t.id}">Excluir</button>
            </div>
            </td>
        </tr>`
    ).join('');

    $('transactionEmpty').classList.toggle('hidden',items.length>0);document.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>openTransaction(allTransactions().find(t=>t.id===b.dataset.edit)));
    
    document.querySelectorAll('[data-delete]').forEach(b => {
        b.onclick = async () => {
            if (confirm('Excluir esta movimentação?')) {
                const previousTransactions = [
                    ...userData().transactions
                ];
                userData().transactions =
                    userData().transactions.filter(
                        t => t.id !== b.dataset.delete
                    );
                try {
                    await saveDB();
                    refreshAll();
                    toast('Movimentação excluída.');
                } catch (error) {
                    userData().transactions = previousTransactions;
                    console.error(error);
                    toast('Erro ao excluir movimentação.');
                }
            }
        };
    });

}

[   
    'searchTransactions',
    'typeFilter',
    'transactionPeriod',
    'categoryFilter'
].forEach(id=>$(id).addEventListener(id==='searchTransactions'?'input':'change',renderTransactions));

$('newGoal').onclick=()=>{
    $('goalForm').reset();
    $('goalCurrent').value=0;
    $('goalDialog').showModal()
};


$('goalForm').addEventListener('submit', async e => {
    e.preventDefault();
    const target = Number($('goalTarget').value);
    const current = Number($('goalCurrent').value);
    if (target <= 0 || current < 0) {
        return toast('Informe valores válidos.');
    }
    const goal = {
        id: crypto.randomUUID(),
        name: $('goalName').value.trim(),
        target,
        current,
        deadline: $('goalDeadline').value
    };
    userData().goals.push(goal);
    try {
        await saveDB();
    } catch (error) {
        userData().goals.pop();
        console.error(error);
        toast('Erro ao salvar meta na nuvem.');
        return;
    }
    $('goalDialog').close();
    renderGoals();
    toast('Meta criada com sucesso.');
});


function renderGoals(){
    const goals=userData().goals||[];
    $('goalsList').innerHTML=goals.length?goals.map(g=>{
        const pct=Math.min(100,g.current/g.target*100);
        return `
        <article class="goal-card">
            <div class="panel-heading"><div>
            <h3>${escapeHTML(g.name)}</h3>
            <p class="muted">${g.deadline?'Prazo: '+dateBR(g.deadline):'Sem prazo definido'}</p>
            </div>
                <button class="mini-btn delete" data-goal-delete="${g.id}">Excluir</button>
            </div>
            <div class="goal-meta">
                <span>${money(g.current)} economizados</span>
                <strong>${pct.toFixed(0)}%</strong>
            </div>
            <div class="goal-progress">
                <span style="width:${pct}%"></span>
            </div>
            <div class="goal-foot">
                <span class="muted">Objetivo: ${money(g.target)}</span>
                <strong>${money(Math.max(0,g.target-g.current))} restantes</strong>
            </div>
            <div class="goal-foot">
                <button class="text-btn" data-goal-add="${g.id}">＋ Registrar economia</button>
                <span class="muted">${pct>=100?'Meta alcançada!':''}</span>
            </div>
        </article>`
    }).join(''):'<article class="panel empty">Você ainda não criou metas. Defina um objetivo para acompanhar sua evolução.</article>';
    
    document.querySelectorAll('[data-goal-delete]').forEach(b => {
        b.onclick = async () => {
            if (confirm('Excluir esta meta?')) {
                const previousGoals = [...userData().goals];
                userData().goals = userData().goals.filter(
                    g => g.id !== b.dataset.goalDelete
                );
                try {
                    await saveDB();
                    renderGoals();
                }
                catch (error) {
                    userData().goals = previousGoals;
                    console.error(error);
                    toast('Erro ao excluir meta.');
                }
            }
        };
    });

    document.querySelectorAll('[data-goal-add]').forEach(b => {
        b.onclick = async () => {
            const g = userData().goals.find(
                x => x.id === b.dataset.goalAdd
            );
            const value = Number(
                prompt('Quanto deseja adicionar à meta? (R$)')
            );
            if (Number.isFinite(value) && value > 0) {
                const previousValue = g.current;
                g.current += value;
                try {
                    await saveDB();
                    renderGoals();
                    toast('Progresso atualizado.');
                } catch (error) {
                    g.current = previousValue;
                    console.error(error);
                    toast('Erro ao atualizar meta.');
                }
            }
        };
    });

}
$('reportPeriod').onchange=renderReports;

function renderReports(){
    if(!currentUser)
        return;
    const items=filterPeriod(allTransactions(),$('reportPeriod').value),t=totals(items);
    $('reportIncome').textContent=money(t.income);
    $('reportExpense').textContent=money(t.expense);
    $('reportNet').textContent=money(t.net);
    $('reportNet').style.color=t.net<0?'#c45b51':'var(--green)';
    $('reportCount').textContent=t.count;
    const groups={};
    items.filter(x=>x.type==='expense').forEach(x=>groups[x.category]=(groups[x.category]||0)+x.amount);
    const sorted=Object.entries(groups).sort((a,b)=>b[1]-a[1]);
    $('reportCategories').innerHTML=sorted.length?sorted.map(
        ([n,v])=>`
        <div class="category-row">
            <span>${escapeHTML(n)}</span>
            <strong>${money(v)}</strong>
            <div class="bar-track">
                <div class="bar-fill" style="width:${v/Math.max(...sorted.map(x=>x[1]))*100}%"></div>
            </div>
        </div>`
    ).join(''):'<p class="empty">Sem despesas neste período.</p>';
    drawDonut('reportChart',sorted)
}

function drawDonut(id,groups){
    const c=$(id),ctx=c.getContext('2d'),w=c.clientWidth||400,h=240,dpr=devicePixelRatio||1;
    c.width=w*dpr;
    c.height=h*dpr;
    ctx.scale(dpr,dpr);
    ctx.clearRect(0,0,w,h);
    const total=groups.reduce((s,x)=>s+x[1],0);
    if(!total){
        ctx.fillStyle='#98a39b';
        ctx.font='12px DM Sans';
        ctx.textAlign='center';
        ctx.fillText('Sem dados para exibir',w/2,h/2);
        return
    }
    const colors=['#168653','#e99a43','#5795cf','#9b83c8','#d36f83','#69aaa0','#b6a04e','#7b8e9e'];
    let angle=-Math.PI/2;
    const cx=Math.min(w*.34,120),cy=h/2,r=Math.min(82,h*.34);
    groups.forEach((g,i)=>{
        const next=angle+g[1]/total*Math.PI*2;
        ctx.beginPath();
        ctx.moveTo(cx,cy);
        ctx.arc(cx,cy,r,angle,next);
        ctx.closePath();
        ctx.fillStyle=colors[i%colors.length];
        ctx.fill();angle=next
    });
    ctx.textAlign='left';
    ctx.font='11px DM Sans';
    groups.slice(0,7).forEach((g,i)=>{
        const y=42+i*25;
        ctx.fillStyle=colors[i%colors.length];
        ctx.fillRect(Math.min(w*.62,220),y-8,8,8);
        ctx.fillStyle='#64736a';
        ctx.fillText(g[0].slice(0,19),Math.min(w*.62,220)+14,y);
        ctx.textAlign='right';
        ctx.fillText(money(g[1]),w-5,y);
        ctx.textAlign='left'
    })
}
$('exportCsv').onclick=()=>{
    const rows=[
        [
            'Data','Tipo','Descrição','Categoria','Valor','Observações'
        ],...allTransactions().sort((a,b)=>a.date.localeCompare(b.date)).map(t=>[
            t.date,t.type==='income'?'Ganho':'Despesa',t.description,t.category,t.amount.toFixed(2).replace('.',','),t.notes||''
        ])
    ];
    const csv='\uFEFF'+rows.map(r=>r.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(';')).join('\n');
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));
    const a=document.createElement('a');
    a.href=url;
    a.download='relatorio-rota-financeira.csv';
    a.click();
    URL.revokeObjectURL(url);
    toast('Relatório exportado.')
};
$('transactionDate').value=today();
window.addEventListener('resize',()=>{
    if(currentUser){
        drawOverviewChart();
        renderReports()
    }
});
