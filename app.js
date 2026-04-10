// ============================================================
//  app.js — ShanuFx Expense Tracker
//  Main application logic: Firestore, charts, filtering, UI
// ============================================================

import { db } from './firebase.js';
import { requireAuth, logout, currentUser } from './auth.js';

/* ──────────────────────────────────────────────────────────── */
/*  CONSTANTS & STATE                                           */
/* ──────────────────────────────────────────────────────────── */
const CATEGORIES = {
  'Food & Dining':  '🍔',
  'Transport':      '🚗',
  'Bills':          '💡',
  'Shopping':       '🛍️',
  'Entertainment':  '🎮',
  'Health':         '💊',
  'Education':      '📚',
  'Travel':         '✈️',
  'Salary':         '💼',
  'Freelance':      '💻',
  'Investment':     '📈',
  'Other':          '📦',
};

let state = {
  user:         null,
  transactions: [],          // local cache from Firestore
  budget:       0,
  unsubscribe:  null,        // Firestore listener cleanup
  filters: {
    search: '', type: 'all', category: 'all',
    dateFrom: '', dateTo: ''
  },
  activePage: 'dashboard',
  pieChart:  null,
  lineChart: null,
};

/* ──────────────────────────────────────────────────────────── */
/*  ENTRY POINT                                                 */
/* ──────────────────────────────────────────────────────────── */
requireAuth(user => {
  state.user = user;
  initUI(user);
  startRealtimeSync(user.uid);
  loadBudget(user.uid);
  setupKeyboardShortcuts();
});

/* ──────────────────────────────────────────────────────────── */
/*  UI INIT                                                     */
/* ──────────────────────────────────────────────────────────── */
function initUI(user) {
  // Avatar initials
  const initials = user.displayName
    ? user.displayName.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()
    : user.email[0].toUpperCase();
  document.getElementById('user-avatar').textContent = initials;
  document.getElementById('profile-email').textContent = user.email;
  document.getElementById('profile-name').textContent  = user.displayName || 'User';

  // Populate category dropdowns
  populateCategoryDropdowns();

  // Navigation
  document.querySelectorAll('.nav-item[data-page]').forEach(item => {
    item.addEventListener('click', () => navigateTo(item.dataset.page));
  });

  // Sidebar toggle
  document.getElementById('sidebar-toggle').addEventListener('click', toggleSidebar);

  // Theme toggle
  document.getElementById('theme-toggle').addEventListener('click', toggleTheme);

  // Logout
  document.getElementById('logout-btn').addEventListener('click', logout);

  // FAB
  document.getElementById('fab').addEventListener('click', () => openModal());

  // Modal
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('modal-overlay')) closeModal();
  });

  // Type toggle buttons
  document.querySelectorAll('.type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      updateCategoryOptions(btn.dataset.type);
    });
  });

  // Save transaction
  document.getElementById('save-txn-btn').addEventListener('click', saveTransaction);

  // Filter bar
  document.getElementById('search-input').addEventListener('input', e => {
    state.filters.search = e.target.value.toLowerCase();
    renderTransactionList();
  });
  document.getElementById('filter-type').addEventListener('change', e => {
    state.filters.type = e.target.value;
    renderTransactionList();
  });
  document.getElementById('filter-category').addEventListener('change', e => {
    state.filters.category = e.target.value;
    renderTransactionList();
  });
  document.getElementById('filter-date-from').addEventListener('change', e => {
    state.filters.dateFrom = e.target.value;
    renderTransactionList();
  });
  document.getElementById('filter-date-to').addEventListener('change', e => {
    state.filters.dateTo = e.target.value;
    renderTransactionList();
  });

  // Budget save
  document.getElementById('save-budget-btn').addEventListener('click', saveBudget);

  // Export CSV
  document.getElementById('export-csv-btn').addEventListener('click', exportCSV);

  // Initial page
  navigateTo('dashboard');

  // GSAP entrance
  gsap.fromTo('#topbar',
    { opacity: 0, y: -20 },
    { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' }
  );
  gsap.fromTo('#sidebar',
    { opacity: 0, x: -30 },
    { opacity: 1, x: 0, duration: 0.5, ease: 'power3.out', delay: 0.1 }
  );
}

/* ──────────────────────────────────────────────────────────── */
/*  NAVIGATION                                                  */
/* ──────────────────────────────────────────────────────────── */
function navigateTo(page) {
  state.activePage = page;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item[data-page]').forEach(n => n.classList.remove('active'));

  const pageEl = document.getElementById(`page-${page}`);
  const navEl  = document.querySelector(`.nav-item[data-page="${page}"]`);
  if (pageEl) pageEl.classList.add('active');
  if (navEl)  navEl.classList.add('active');

  document.querySelector('.topbar-title span').textContent =
    page.charAt(0).toUpperCase() + page.slice(1);

  if (page === 'dashboard') renderDashboard();
  if (page === 'reports')   renderReports();
  if (page === 'transactions') renderTransactionList();

  // Close mobile sidebar
  if (window.innerWidth <= 768)
    document.getElementById('sidebar').classList.remove('mobile-open');
}

/* ──────────────────────────────────────────────────────────── */
/*  SIDEBAR                                                     */
/* ──────────────────────────────────────────────────────────── */
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const main    = document.getElementById('main-content');
  if (window.innerWidth <= 768) {
    sidebar.classList.toggle('mobile-open');
  } else {
    sidebar.classList.toggle('collapsed');
    main.classList.toggle('sidebar-collapsed');
  }
}

/* ──────────────────────────────────────────────────────────── */
/*  THEME                                                       */
/* ──────────────────────────────────────────────────────────── */
function toggleTheme() {
  const html  = document.documentElement;
  const isDark = html.dataset.theme !== 'light';
  html.dataset.theme = isDark ? 'light' : 'dark';
  const icon = document.getElementById('theme-toggle').querySelector('i');
  icon.className = isDark ? 'fa-solid fa-moon' : 'fa-solid fa-sun';
  localStorage.setItem('sfx-theme', html.dataset.theme);
}
// Restore saved theme
const savedTheme = localStorage.getItem('sfx-theme');
if (savedTheme) document.documentElement.dataset.theme = savedTheme;

/* ──────────────────────────────────────────────────────────── */
/*  FIRESTORE REALTIME SYNC                                     */
/* ──────────────────────────────────────────────────────────── */
function startRealtimeSync(uid) {
  showSkeletons();
  if (state.unsubscribe) state.unsubscribe();

  state.unsubscribe = db
    .collection('users').doc(uid)
    .collection('transactions')
    .orderBy('date', 'desc')
    .onSnapshot(snap => {
      state.transactions = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      renderDashboard();
      if (state.activePage === 'transactions') renderTransactionList();
      if (state.activePage === 'reports')      renderReports();
    }, err => {
      console.error('Firestore sync error:', err);
      showToast('Sync error — check connection.', 'error');
    });
}

/* ──────────────────────────────────────────────────────────── */
/*  DASHBOARD                                                   */
/* ──────────────────────────────────────────────────────────── */
function renderDashboard() {
  const txns    = state.transactions;
  const income  = txns.filter(t => t.type === 'income').reduce((a, t) => a + t.amount, 0);
  const expense = txns.filter(t => t.type === 'expense').reduce((a, t) => a + t.amount, 0);
  const balance = income - expense;

  animateCounter('card-income',  income);
  animateCounter('card-expense', expense);
  animateCounter('card-balance', balance);

  updateBudgetBar(expense);
  renderInsights(txns, expense);
  renderMiniTransactions(txns.slice(0, 5));
  renderPieChart();
  renderLineChart();
}

function animateCounter(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  const isNeg = value < 0;
  const abs   = Math.abs(value);
  const obj   = { val: 0 };
  gsap.to(obj, {
    val: abs, duration: 1, ease: 'power2.out',
    onUpdate: () => {
      el.textContent = (isNeg ? '−' : '') + 'LKR ' + obj.val.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }
  });
  el.className = 'card-value mono ' + (id === 'card-expense' ? 'negative' : id === 'card-balance' && isNeg ? 'negative' : '');
}

/* ──────────────────────────────────────────────────────────── */
/*  BUDGET BAR                                                  */
/* ──────────────────────────────────────────────────────────── */
async function loadBudget(uid) {
  try {
    const doc = await db.collection('users').doc(uid).get();
    if (doc.exists && doc.data().budget) {
      state.budget = doc.data().budget;
      document.getElementById('budget-input').value = state.budget;
    }
  } catch (e) { /* no budget set yet */ }
}

function updateBudgetBar(expense) {
  const budget = state.budget;
  const fill   = document.getElementById('budget-fill');
  const pct    = document.getElementById('budget-pct');
  const amounts = document.getElementById('budget-amounts');

  if (!budget) {
    fill.style.width = '0%';
    pct.textContent  = 'No budget set — configure in Settings';
    if (amounts) amounts.textContent = '';
    return;
  }

  const ratio = Math.min((expense / budget) * 100, 100);
  fill.style.width = ratio + '%';
  fill.className   = 'budget-bar-fill' + (ratio >= 100 ? ' danger' : ratio >= 80 ? ' warning' : '');
  pct.textContent  = `${ratio.toFixed(1)}% of budget used`;
  if (amounts) amounts.textContent = `LKR ${expense.toLocaleString()} / ${budget.toLocaleString()}`;

  if (ratio >= 100)
    showToast('⚠️ Monthly budget exceeded!', 'error');
  else if (ratio >= 80 && ratio < 100)
    showToast('You\'ve used 80%+ of your budget.', 'info');
}

async function saveBudget() {
  const val = parseFloat(document.getElementById('budget-input').value);
  if (!val || val <= 0) { showToast('Enter a valid budget amount.', 'error'); return; }
  state.budget = val;
  await db.collection('users').doc(state.user.uid).set({ budget: val }, { merge: true });
  showToast('Budget saved!', 'success');
  renderDashboard();
}

/* ──────────────────────────────────────────────────────────── */
/*  INSIGHTS                                                    */
/* ──────────────────────────────────────────────────────────── */
function renderInsights(txns, totalExpense) {
  const grid = document.getElementById('insights-grid');
  const insights = [];

  // Month-over-month
  const now   = new Date();
  const curM  = now.getMonth();
  const curY  = now.getFullYear();
  const lastM = curM === 0 ? 11 : curM - 1;
  const lastY = curM === 0 ? curY - 1 : curY;

  const thisMonthExp = txns
    .filter(t => t.type === 'expense' && new Date(t.date).getMonth() === curM && new Date(t.date).getFullYear() === curY)
    .reduce((a, t) => a + t.amount, 0);
  const lastMonthExp = txns
    .filter(t => t.type === 'expense' && new Date(t.date).getMonth() === lastM && new Date(t.date).getFullYear() === lastY)
    .reduce((a, t) => a + t.amount, 0);

  if (lastMonthExp > 0) {
    const diff = ((thisMonthExp - lastMonthExp) / lastMonthExp * 100).toFixed(0);
    const up   = diff > 0;
    insights.push({
      type:  up ? 'alert' : 'info',
      icon:  up ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down',
      text:  `Expenses are ${up ? '📈 up' : '📉 down'} ${Math.abs(diff)}% vs last month (LKR ${thisMonthExp.toLocaleString()} vs ${lastMonthExp.toLocaleString()}).`
    });
  }

  // Top spending category this month
  const catMap = {};
  txns.filter(t => t.type === 'expense' && new Date(t.date).getMonth() === curM)
      .forEach(t => { catMap[t.category] = (catMap[t.category] || 0) + t.amount; });
  const topCat = Object.entries(catMap).sort((a,b) => b[1]-a[1])[0];
  if (topCat) {
    const pct = ((topCat[1] / thisMonthExp) * 100).toFixed(0);
    insights.push({
      type: pct > 50 ? 'warn' : 'info',
      icon: 'fa-fire',
      text: `${CATEGORIES[topCat[0]] || '📦'} ${topCat[0]} is your top category this month — ${pct}% of spending (LKR ${topCat[1].toLocaleString()}).`
    });
  }

  // Budget insight
  if (state.budget && totalExpense > state.budget * 0.8) {
    insights.push({
      type: 'alert', icon: 'fa-triangle-exclamation',
      text: `You've used ${((totalExpense/state.budget)*100).toFixed(0)}% of your monthly budget. Consider reviewing your spending.`
    });
  }

  if (!insights.length) {
    grid.innerHTML = '<div class="insight-card glass"><i class="fa-solid fa-circle-check" style="color:var(--neon-green)"></i><p class="insight-text">All good! Add transactions to see spending insights.</p></div>';
    return;
  }

  grid.innerHTML = insights.map(i => `
    <div class="insight-card glass ${i.type}">
      <i class="fa-solid ${i.icon}"></i>
      <p class="insight-text">${i.text}</p>
    </div>
  `).join('');

  gsap.fromTo('#insights-grid .insight-card',
    { opacity: 0, y: 12 },
    { opacity: 1, y: 0, stagger: 0.1, duration: 0.4, ease: 'power2.out' }
  );
}

/* ──────────────────────────────────────────────────────────── */
/*  RECENT TRANSACTIONS (dashboard mini-list)                  */
/* ──────────────────────────────────────────────────────────── */
function renderMiniTransactions(txns) {
  const el = document.getElementById('recent-txns');
  if (!txns.length) {
    el.innerHTML = `<div class="empty-state">
      <i class="fa-solid fa-receipt"></i>
      <p>No transactions yet. Hit <strong>+</strong> to add one.</p>
    </div>`;
    return;
  }
  el.innerHTML = txns.map(t => buildTxnItemHTML(t)).join('');
  attachTxnActions(el);
  gsap.fromTo('#recent-txns .txn-item',
    { opacity: 0, x: -16 },
    { opacity: 1, x: 0, stagger: 0.07, duration: 0.35, ease: 'power2.out' }
  );
}

/* ──────────────────────────────────────────────────────────── */
/*  FULL TRANSACTION LIST PAGE                                  */
/* ──────────────────────────────────────────────────────────── */
function renderTransactionList() {
  const { search, type, category, dateFrom, dateTo } = state.filters;
  let txns = [...state.transactions];

  if (search)   txns = txns.filter(t =>
    t.note?.toLowerCase().includes(search) ||
    t.category.toLowerCase().includes(search)
  );
  if (type !== 'all')      txns = txns.filter(t => t.type === type);
  if (category !== 'all')  txns = txns.filter(t => t.category === category);
  if (dateFrom) txns = txns.filter(t => t.date >= dateFrom);
  if (dateTo)   txns = txns.filter(t => t.date <= dateTo);

  const el = document.getElementById('all-txns');
  document.getElementById('txn-count').textContent = `${txns.length} record${txns.length !== 1 ? 's' : ''}`;

  if (!txns.length) {
    el.innerHTML = `<div class="empty-state">
      <i class="fa-solid fa-filter"></i>
      <p>No transactions match the current filters.</p>
    </div>`;
    return;
  }

  el.innerHTML = txns.map(t => buildTxnItemHTML(t)).join('');
  attachTxnActions(el);
  gsap.fromTo('#all-txns .txn-item',
    { opacity: 0, y: 10 },
    { opacity: 1, y: 0, stagger: 0.04, duration: 0.3, ease: 'power2.out' }
  );
}

function buildTxnItemHTML(t) {
  const emoji  = CATEGORIES[t.category] || '📦';
  const sign   = t.type === 'income' ? '+' : '−';
  const cls    = t.type;
  const date   = new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `
  <div class="txn-item glass" data-id="${t.id}">
    <div class="txn-icon">${emoji}</div>
    <div class="txn-info">
      <div class="txn-title">${escHtml(t.note || t.category)}</div>
      <div class="txn-meta">
        <span>${date}</span>
        <span class="txn-tag">${escHtml(t.category)}</span>
      </div>
    </div>
    <div class="txn-amount ${cls}">${sign} LKR ${t.amount.toLocaleString('en-US',{minimumFractionDigits:2})}</div>
    <div class="txn-actions">
      <button class="txn-action-btn edit" title="Edit"><i class="fa-solid fa-pen"></i></button>
      <button class="txn-action-btn del"  title="Delete"><i class="fa-solid fa-trash"></i></button>
    </div>
  </div>`;
}

function attachTxnActions(container) {
  container.querySelectorAll('.txn-action-btn.edit').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const id = btn.closest('.txn-item').dataset.id;
      const t  = state.transactions.find(x => x.id === id);
      if (t) openModal(t);
    });
  });
  container.querySelectorAll('.txn-action-btn.del').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const id = btn.closest('.txn-item').dataset.id;
      deleteTransaction(id, btn.closest('.txn-item'));
    });
  });
}

/* ──────────────────────────────────────────────────────────── */
/*  ADD / EDIT TRANSACTION MODAL                               */
/* ──────────────────────────────────────────────────────────── */
let editingId = null;

function openModal(txn = null) {
  editingId = txn?.id || null;
  const overlay = document.getElementById('modal-overlay');
  document.getElementById('modal-title').textContent = txn ? 'Edit Transaction' : 'Add Transaction';

  // Reset form
  document.getElementById('txn-amount').value   = txn?.amount    || '';
  document.getElementById('txn-note').value     = txn?.note      || '';
  document.getElementById('txn-date').value     = txn?.date      || new Date().toISOString().split('T')[0];

  // Type buttons
  const type = txn?.type || 'expense';
  document.querySelectorAll('.type-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.type === type);
  });
  updateCategoryOptions(type);

  // Set category after options rendered
  if (txn?.category) {
    setTimeout(() => {
      document.getElementById('txn-category').value = txn.category;
    }, 0);
  }

  overlay.classList.add('open');
  document.getElementById('txn-amount').focus();
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
  editingId = null;
}

function updateCategoryOptions(type) {
  const sel = document.getElementById('txn-category');
  const incomeOnly  = ['Salary','Freelance','Investment'];
  const expenseOnly = ['Food & Dining','Transport','Bills','Shopping','Entertainment','Health','Education','Travel'];
  const all         = [...new Set([...Object.keys(CATEGORIES)])];

  let cats;
  if (type === 'income')  cats = incomeOnly.concat(['Other']);
  else if (type === 'expense') cats = expenseOnly.concat(['Other']);
  else cats = all;

  sel.innerHTML = cats.map(c => `<option value="${c}">${CATEGORIES[c] || ''} ${c}</option>`).join('');
}

async function saveTransaction() {
  const amountStr = document.getElementById('txn-amount').value;
  const note      = document.getElementById('txn-note').value.trim();
  const date      = document.getElementById('txn-date').value;
  const category  = document.getElementById('txn-category').value;
  const typeBtn   = document.querySelector('.type-btn.active');
  const type      = typeBtn?.dataset.type || 'expense';

  const amount = parseFloat(amountStr);
  if (!amount || amount <= 0) { showToast('Enter a valid amount.', 'error'); return; }
  if (!date)                  { showToast('Select a date.', 'error'); return; }

  const saveBtn = document.getElementById('save-txn-btn');
  saveBtn.disabled = true;
  saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving…';

  const data = { amount, note, date, category, type, createdAt: firebase.firestore.FieldValue.serverTimestamp() };

  try {
    const col = db.collection('users').doc(state.user.uid).collection('transactions');
    if (editingId) {
      await col.doc(editingId).update(data);
      showToast('Transaction updated!', 'success');
    } else {
      await col.add(data);
      showToast('Transaction added!', 'success');
    }
    closeModal();
  } catch (err) {
    console.error(err);
    showToast('Failed to save. Try again.', 'error');
  } finally {
    saveBtn.disabled = false;
    saveBtn.innerHTML = '<i class="fa-solid fa-check"></i> Save Transaction';
  }
}

async function deleteTransaction(id, el) {
  if (!confirm('Delete this transaction?')) return;
  gsap.to(el, { opacity: 0, x: 40, height: 0, marginBottom: 0, padding: 0, duration: 0.3, ease: 'power2.in',
    onComplete: async () => {
      try {
        await db.collection('users').doc(state.user.uid).collection('transactions').doc(id).delete();
        showToast('Transaction deleted.', 'info');
      } catch (e) {
        showToast('Delete failed.', 'error');
      }
    }
  });
}

/* ──────────────────────────────────────────────────────────── */
/*  CHARTS                                                      */
/* ──────────────────────────────────────────────────────────── */
const CHART_COLORS = [
  '#00ffcc','#4d9fff','#f5e642','#ff4d6d',
  '#a78bfa','#34d399','#fb923c','#38bdf8',
];

function renderPieChart() {
  const txns = state.transactions.filter(t => t.type === 'expense');
  const catMap = {};
  txns.forEach(t => { catMap[t.category] = (catMap[t.category] || 0) + t.amount; });
  const labels = Object.keys(catMap);
  const data   = Object.values(catMap);

  const ctx = document.getElementById('pie-chart').getContext('2d');
  if (state.pieChart) state.pieChart.destroy();

  state.pieChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: CHART_COLORS.slice(0, labels.length),
        borderColor: 'rgba(13,13,26,0.8)',
        borderWidth: 2,
        hoverOffset: 8,
      }]
    },
    options: {
      responsive: true,
      cutout: '68%',
      animation: { animateRotate: true, duration: 900, easing: 'easeInOutQuart' },
      plugins: {
        legend: { position: 'bottom', labels: { color: '#8890b5', padding: 14, font: { family: 'Outfit', size: 12 } } },
        tooltip: {
          backgroundColor: 'rgba(13,13,26,0.9)',
          borderColor: 'rgba(255,255,255,0.08)',
          borderWidth: 1,
          titleColor: '#eef0ff',
          bodyColor: '#8890b5',
          callbacks: {
            label: ctx => ` LKR ${ctx.parsed.toLocaleString('en-US',{minimumFractionDigits:2})}`
          }
        }
      }
    }
  });
}

function renderLineChart() {
  const now = new Date();
  const months = [];
  const incomeData = [];
  const expenseData = [];

  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(d.toLocaleString('default', { month: 'short', year: '2-digit' }));
    const m = d.getMonth(), y = d.getFullYear();
    incomeData.push(
      state.transactions
        .filter(t => t.type === 'income' && new Date(t.date).getMonth() === m && new Date(t.date).getFullYear() === y)
        .reduce((a, t) => a + t.amount, 0)
    );
    expenseData.push(
      state.transactions
        .filter(t => t.type === 'expense' && new Date(t.date).getMonth() === m && new Date(t.date).getFullYear() === y)
        .reduce((a, t) => a + t.amount, 0)
    );
  }

  const ctx = document.getElementById('line-chart').getContext('2d');
  if (state.lineChart) state.lineChart.destroy();

  const gradient = ctx.createLinearGradient(0, 0, 0, 220);
  gradient.addColorStop(0, 'rgba(0,255,204,0.15)');
  gradient.addColorStop(1, 'rgba(0,255,204,0)');

  state.lineChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: months,
      datasets: [
        {
          label: 'Income',
          data: incomeData,
          borderColor: '#00ffcc',
          backgroundColor: gradient,
          borderWidth: 2,
          pointBackgroundColor: '#00ffcc',
          pointRadius: 4,
          tension: 0.4,
          fill: true,
        },
        {
          label: 'Expenses',
          data: expenseData,
          borderColor: '#ff4d6d',
          backgroundColor: 'transparent',
          borderWidth: 2,
          pointBackgroundColor: '#ff4d6d',
          pointRadius: 4,
          tension: 0.4,
        }
      ]
    },
    options: {
      responsive: true,
      animation: { duration: 900, easing: 'easeInOutQuart' },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#8890b5', font: { family: 'Outfit' } } },
        y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#8890b5', font: { family: 'JetBrains Mono' },
          callback: v => 'LKR ' + v.toLocaleString() } }
      },
      plugins: {
        legend: { labels: { color: '#8890b5', font: { family: 'Outfit', size: 12 } } },
        tooltip: {
          backgroundColor: 'rgba(13,13,26,0.9)',
          borderColor: 'rgba(255,255,255,0.08)',
          borderWidth: 1,
          titleColor: '#eef0ff',
          bodyColor: '#8890b5',
          callbacks: { label: ctx => ` LKR ${ctx.parsed.y.toLocaleString()}` }
        }
      }
    }
  });
}

/* ──────────────────────────────────────────────────────────── */
/*  REPORTS PAGE                                               */
/* ──────────────────────────────────────────────────────────── */
function renderReports() {
  renderPieChart();
  renderLineChart();

  // Category breakdown table
  const catMap = {};
  state.transactions.filter(t => t.type === 'expense')
    .forEach(t => { catMap[t.category] = (catMap[t.category] || 0) + t.amount; });

  const total = Object.values(catMap).reduce((a, v) => a + v, 0);
  const rows  = Object.entries(catMap)
    .sort((a,b) => b[1]-a[1])
    .map(([cat, amt]) => {
      const pct = total ? ((amt/total)*100).toFixed(1) : 0;
      return `<tr>
        <td>${CATEGORIES[cat]||'📦'} ${cat}</td>
        <td class="mono" style="color:var(--neon-red)">LKR ${amt.toLocaleString('en-US',{minimumFractionDigits:2})}</td>
        <td>
          <div style="display:flex;align-items:center;gap:10px;">
            <div style="flex:1;height:4px;background:rgba(255,255,255,0.05);border-radius:4px;">
              <div style="width:${pct}%;height:100%;background:var(--neon-red);border-radius:4px;"></div>
            </div>
            <span class="mono" style="color:var(--text-muted);font-size:12px;">${pct}%</span>
          </div>
        </td>
      </tr>`;
    }).join('');

  const tbl = document.getElementById('cat-table-body');
  if (tbl) tbl.innerHTML = rows || '<tr><td colspan="3" style="color:var(--text-muted);padding:16px;">No expense data yet.</td></tr>';
}

/* ──────────────────────────────────────────────────────────── */
/*  EXPORT CSV                                                  */
/* ──────────────────────────────────────────────────────────── */
function exportCSV() {
  const headers = ['Date', 'Type', 'Category', 'Note', 'Amount (LKR)'];
  const rows    = state.transactions.map(t =>
    [t.date, t.type, t.category, `"${(t.note||'').replace(/"/g,'""')}"`, t.amount].join(',')
  );
  const csv  = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), {
    href: url, download: `shanufx-expenses-${new Date().toISOString().split('T')[0]}.csv`
  });
  a.click();
  URL.revokeObjectURL(url);
  showToast('CSV exported!', 'success');
}

/* ──────────────────────────────────────────────────────────── */
/*  POPULATE CATEGORY DROPDOWNS                                */
/* ──────────────────────────────────────────────────────────── */
function populateCategoryDropdowns() {
  const filterSel = document.getElementById('filter-category');
  if (filterSel) {
    filterSel.innerHTML = '<option value="all">All Categories</option>' +
      Object.keys(CATEGORIES).map(c => `<option value="${c}">${CATEGORIES[c]} ${c}</option>`).join('');
  }
  updateCategoryOptions('expense');
}

/* ──────────────────────────────────────────────────────────── */
/*  SKELETONS                                                   */
/* ──────────────────────────────────────────────────────────── */
function showSkeletons() {
  const el = document.getElementById('recent-txns');
  if (el) el.innerHTML = [1,2,3].map(() => '<div class="skeleton skeleton-txn"></div>').join('');
}

/* ──────────────────────────────────────────────────────────── */
/*  TOAST                                                       */
/* ──────────────────────────────────────────────────────────── */
window.showToast = function(msg, type = 'info', duration = 3500) {
  const icons = { success: 'fa-circle-check', error: 'fa-circle-xmark', info: 'fa-circle-info' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<i class="fa-solid ${icons[type]}"></i> ${msg}`;
  document.getElementById('toast-container').appendChild(toast);
  setTimeout(() => {
    gsap.to(toast, { opacity: 0, x: 40, duration: 0.3, onComplete: () => toast.remove() });
  }, duration);
};

/* ──────────────────────────────────────────────────────────── */
/*  KEYBOARD SHORTCUTS                                          */
/* ──────────────────────────────────────────────────────────── */
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    const map = {
      'a': () => openModal(),
      'd': () => navigateTo('dashboard'),
      't': () => navigateTo('transactions'),
      'r': () => navigateTo('reports'),
      's': () => navigateTo('settings'),
      'Escape': closeModal,
    };
    if (map[e.key]) map[e.key]();
  });
}

/* ──────────────────────────────────────────────────────────── */
/*  UTILS                                                       */
/* ──────────────────────────────────────────────────────────── */
function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
