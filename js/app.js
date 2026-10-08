(() => {
    'use strict';

    const { money, moneyPrice, roundMoney } = window.Calc;
    const $ = sel => document.querySelector(sel);
    const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const num = v => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
    const lines = txt => String(txt || '').split('\n').map(l => l.trim()).filter(Boolean);
    const fmtDate = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ''); return m ? `${m[3]}/${m[2]}/${m[1]}` : ''; };
    const today = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };

    /* =========================================================
     * Estado da proposta (dados do cliente + estado da calculadora)
     * ========================================================= */
    const DEFAULT_ESCOPO = [
        'Levantamento e validação dos requisitos do ambiente.',
        'Provisionamento e configuração dos recursos contratados.',
        'Testes e homologação com a equipe do cliente.',
        'Migração ou ativação em janela acordada, com plano de retorno quando aplicável.',
    ].join('\n');
    const DEFAULT_CONSIDERACOES = [
        'Tráfego desconsiderado. (Caso necessário, considerar R$ 0,15/GB).',
        'Orçamento baseado nas informações fornecidas via e-mail.',
    ].join('\n');

    const blankState = () => ({
        titulo: 'Proposta Comercial',
        cliente: '', contato: '', cargo: '',
        data: today(), validade: 60, prazo: 36,
        responsavel: '', emailResp: '', foco: '',
        escopo: DEFAULT_ESCOPO,
        consideracoes: DEFAULT_CONSIDERACOES,
        calc: {},
    });

    const exampleState = () => ({
        ...blankState(),
        cliente: 'Empresa Exemplo', contato: 'Fulano de Tal', cargo: 'Gerente de TI',
        responsavel: 'Seu Nome', emailResp: 'seu.nome@saveincloud.com',
        foco: 'Armazenamento de Backups, Máquinas Virtuais e Redundância para DR',
        calc: {
            _blocks: [{ t: 'nuvion', g: 1 }, { t: 'nuvion', g: 2 }, { t: 'cl', p: 'standard', e: 0 }, { t: 'storin' }],
            'n-g1-name': 'Aplicação',
            'n-g1-vm-sel': 'ST-8-32', 'n-g1-vm-qty': 730,
            'n-g1-disk-sel': 'Volume Block Storage SSD Standard', 'n-g1-disk-qty': 500,
            'n-g1-ip-sel': 'IPV4 Alocado', 'n-g1-ip-qty': 730,
            'n-g1-extra-sel': 'Load Balancer Single', 'n-g1-extra-qty': 1,
            'n-g2-name': 'Banco de dados',
            'n-g2-vm-sel': 'PRI-16-64', 'n-g2-vm-qty': 730,
            'n-g2-disk-sel': 'Volume Block Storage NVMe Balanceado', 'n-g2-disk-qty': 1000,
            'n-g2-backup-sel': 'Backup Block Storage NVMe Balanceado', 'n-g2-backup-qty': 1000, 'n-g2-backup-mult': 2,
            'c-standard-0-reserved-sel': 'Cloudlet Reservado 6-20', 'c-standard-0-reserved-qty': 8,
            'c-standard-0-ip-sel': 'IPV4 Alocado',
            's-storage-sel': 'Disco usado de 5T a 20T', 's-storage-qty': 10000,
        },
    });

    let state = blankState();

    /* =========================================================
     * Persistência no navegador — falha silenciosamente
     * ========================================================= */
    const LS_STATE = 'proposta-save:v3:state';
    const LS_REPORT = 'proposta-save:v3:report';
    const store = {
        get(k) { try { return localStorage.getItem(k); } catch { return null; } },
        set(k, v) { try { localStorage.setItem(k, v); return true; } catch { return false; } },
        del(k) { try { localStorage.removeItem(k); } catch { /* sem storage */ } },
    };
    const report = $('#report');
    let saveTimer = null;
    function scheduleSave() {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => {
            state.calc = Calc.getState();
            let ok = store.set(LS_STATE, JSON.stringify(state));
            if (report.hidden) store.del(LS_REPORT); else ok = store.set(LS_REPORT, report.innerHTML) && ok;
            $('#saveStatus').textContent = ok ? `Rascunho salvo neste navegador às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : '';
        }, 500);
    }

    /* =========================================================
     * Toast, modais, tema e abas (mesmo comportamento da calculadora)
     * ========================================================= */
    function showToast(msg) {
        const toast = $('#toast');
        toast.textContent = msg;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3000);
    }

    function confirmDialog(text, okLabel = 'Confirmar') {
        const modal = $('#confirmModal');
        $('#confirmText').textContent = text;
        if (modal.classList.contains('show')) return Promise.resolve(false);
        $('#confirmOk').textContent = okLabel;
        modal.classList.add('show');
        return new Promise(resolve => {
            const close = v => { modal.classList.remove('show'); modal.onclick = $('#confirmOk').onclick = $('#confirmCancel').onclick = null; resolve(v); };
            $('#confirmOk').onclick = () => close(true);
            $('#confirmCancel').onclick = () => close(false);
            modal.onclick = e => { if (e.target === modal) close(false); };
        });
    }

    const themeIcon = $('#themeIcon');
    const applyTheme = t => {
        document.body.setAttribute('data-theme', t);
        themeIcon.textContent = t === 'dark' ? 'light_mode' : 'dark_mode';
    };
    if (store.get('theme') === 'dark') applyTheme('dark');
    $('#themeToggle').addEventListener('click', () => {
        const next = document.body.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        applyTheme(next);
        store.set('theme', next);
    });

    /* =========================================================
     * Campos da proposta e resumo
     * ========================================================= */
    function fillBindings() {
        document.querySelectorAll('[data-bind]').forEach(el => { el.value = state[el.dataset.bind] ?? ''; });
    }
    document.querySelectorAll('[data-bind]').forEach(el => el.addEventListener('input', () => {
        state[el.dataset.bind] = el.type === 'number' ? num(el.value) : el.value;
        if (el.dataset.bind === 'prazo') updateSummary();
        scheduleSave();
    }));

    function updateSummary() {
        const c = Calc.collect();
        const prazo = Math.max(0, num(state.prazo));
        Object.entries(c.totals).forEach(([k, v]) => { $('#sum-' + k).textContent = money(v); });
        $('#sum-monthly').textContent = money(c.monthly);
        $('#grand-total-label').textContent = `Total do contrato (${prazo} ${prazo === 1 ? 'mês' : 'meses'})`;
        $('#grand-total').textContent = money(roundMoney(c.monthly * prazo));
    }

    /* =========================================================
     * Documento
     * ========================================================= */
    function itemsTable(title, rows, total, footLabel) {
        const body = rows.map(r => `<tr>
            <td class="res">${esc(r.label)}</td>
            <td>${esc(r.spec)}</td>
            <td class="num">${esc(moneyPrice(r.price))}<br><small>${esc(r.unit)}</small></td>
            <td class="num">${esc(r.qtyText)}</td>
            <td class="num">${esc(money(r.sub))}</td>
        </tr>`).join('');
        return `<table class="inv items">
            <colgroup><col style="width:17%"><col style="width:33%"><col style="width:18%"><col style="width:15%"><col style="width:17%"></colgroup>
            <thead>
                <tr class="grp"><th colspan="5">${esc(title)}</th></tr>
                <tr class="cols"><th>Recurso</th><th>Especificação</th><th class="num">Preço unitário</th><th class="num">Quantidade</th><th class="num">Subtotal</th></tr>
            </thead>
            <tbody>${body}</tbody>
            <tfoot><tr><td colspan="4">${esc(footLabel)}</td><td class="num">${esc(money(total))}</td></tr></tfoot>
        </table>`;
    }

    const PRODUCT_TEXT = {
        nuvion: '<li><strong>Nuvion:</strong> Máquinas virtuais e recursos de infraestrutura.</li>',
        cloudlets: '<li><strong>Cloudlets:</strong> Plataforma para implantação e operação de aplicações na nuvem.</li>',
        storin: '<li><strong>Storin:</strong> Armazenamento de objetos compatível com a API S3.</li>',
    };

    function buildDocument(s, c) {
        const prazo = Math.max(0, num(s.prazo));
        const total = roundMoney(c.monthly * prazo);
        const cliente = esc(s.cliente || '[cliente]');
        const contato = [s.contato, s.cargo].filter(Boolean).map(esc).join(' | ');
        const has = p => c.sections.some(sec => sec.product === p);

        const used = [];
        if (has('nuvion')) used.push('nuvion');
        if (has('cloudletsStandard') || has('cloudletsPremium')) used.push('cloudlets');
        if (has('storin')) used.push('storin');
        const products = used.length ? used : Object.keys(PRODUCT_TEXT);

        // Uma tabela por bloco, na ordem em que foram adicionados.
        const investimento = c.sections.map(sec =>
            itemsTable(`${sec.productName} — ${sec.name}`, sec.rows, sec.total, 'Subtotal mensal')).join('');

        const summaryRows = Object.entries(c.totals).filter(([p]) => has(p)).map(([p, v]) => [c.productNames[p], v]);

        const consideracoes = lines(s.consideracoes);
        const responsavel = s.responsavel
            ? `<p><strong>Responsável Save in Cloud:</strong> ${esc(s.responsavel)}${s.emailResp ? ` &nbsp;|&nbsp; <strong>Contato:</strong> ${esc(s.emailResp)}` : ''}</p>` : '';

        return `
        <article class="sheet" contenteditable="true" spellcheck="true" lang="pt-BR">
            <header class="doc-head">
                <h1 class="doc-title">${esc(s.titulo || 'Proposta Comercial')}</h1>
                <img src="assets/logo.png" alt="Save in Cloud">
            </header>
            <table class="info">
                <tr><td><b>Cliente:</b> ${cliente}</td><td><b>Contato:</b> ${contato || '—'}</td></tr>
                <tr><td><b>Data:</b> ${fmtDate(s.data)}</td><td><b>Validade:</b> ${num(s.validade)} dias</td></tr>
            </table>
            <section>
                <h2>1. Objetivo</h2>
                <p>Apresentar uma solução de infraestrutura em nuvem para a ${cliente}${s.foco ? `, com foco em ${esc(s.foco)}` : ''}.</p>
            </section>
            <section>
                <h2>2. Solução proposta</h2>
                <p>A solução será dimensionada conforme os requisitos técnicos e comerciais validados com o cliente:</p>
                <ul>${products.map(p => PRODUCT_TEXT[p]).join('')}</ul>
            </section>
            <section>
                <h2>3. Escopo de implantação</h2>
                <ol>${lines(s.escopo).map(l => `<li>${esc(l)}</li>`).join('')}</ol>
            </section>
        </article>

        <article class="sheet" contenteditable="true" spellcheck="true" lang="pt-BR">
            <section>
                <h2>4. Investimento</h2>
                <p>Valores mensais estimados com base na calculadora Save in Cloud (referência: 1 mês = 730 horas).</p>
                ${investimento}
            </section>
        </article>

        <article class="sheet" contenteditable="true" spellcheck="true" lang="pt-BR">
            <section>
                <h3>Resumo do investimento</h3>
                <table class="inv">
                    <thead><tr class="cols"><th>Plataforma</th><th class="num">Valor mensal</th></tr></thead>
                    <tbody>
                        ${summaryRows.map(([n, v]) => `<tr><td>${esc(n)}</td><td class="num">${esc(money(v))}</td></tr>`).join('')}
                        <tr class="sub"><td>Total mensal</td><td class="num">${esc(money(c.monthly))}</td></tr>
                        <tr><td>Prazo do contrato</td><td class="num">${prazo} ${prazo === 1 ? 'mês' : 'meses'}</td></tr>
                        <tr class="grand"><td>TOTAL GERAL — ${prazo} ${prazo === 1 ? 'mês' : 'meses'}</td><td class="num">${esc(money(total))}</td></tr>
                    </tbody>
                </table>
                ${consideracoes.length ? `<div class="doc-notes"><h4>Considerações a respeito da estimativa</h4><ol>${consideracoes.map(l => `<li>${esc(l)}</li>`).join('')}</ol></div>` : ''}
            </section>
            <section class="sign">
                <h2>5. Próximos passos</h2>
                <p>Após a aprovação, as partes confirmarão o escopo, o cronograma e as condições contratuais para iniciar a implantação.</p>
                ${responsavel}
                <p><strong>Aceite do cliente:</strong> _____________________________________ &nbsp; <strong>Data:</strong> ____/____/______</p>
            </section>
        </article>`;
    }

    // Sinaliza na tela folhas que passam de uma página A4.
    const A4_PX = 29.7 * 96 / 2.54;
    const checkOverflow = () => report.querySelectorAll('.sheet').forEach(sh => sh.classList.toggle('overflowing', sh.offsetHeight > A4_PX + 2));

    let reportDirty = false;
    function showReport(html) {
        report.innerHTML = html;
        report.hidden = false; $('#toolbar').hidden = false;
        $('#printBtn').hidden = false; $('#printHint').hidden = false;
        $('#generateLabel').textContent = 'Regerar proposta';
        requestAnimationFrame(checkOverflow);
    }
    function hideReport() {
        report.innerHTML = ''; report.hidden = true; $('#toolbar').hidden = true;
        $('#printBtn').hidden = true; $('#printHint').hidden = true;
        $('#generateLabel').textContent = 'Gerar proposta';
        reportDirty = false;
    }

    $('#generateBtn').addEventListener('click', async () => {
        const c = Calc.collect();
        if (!c.sections.length) {
            showToast('Adicione um produto e selecione ao menos um recurso.');
            return;
        }
        if (reportDirty && !(await confirmDialog('Regerar a proposta substitui as edições feitas no documento. Deseja continuar?', 'Sim, regerar'))) return;
        showReport(buildDocument(state, c));
        reportDirty = false;
        scheduleSave();
        report.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    report.addEventListener('input', () => { reportDirty = true; checkOverflow(); scheduleSave(); });

    const toolbar = $('#toolbar');
    toolbar.addEventListener('mousedown', e => { if (e.target.closest('button')) e.preventDefault(); }); // mantém a seleção
    toolbar.addEventListener('click', e => {
        const b = e.target.closest('button'); if (!b) return;
        if (b.dataset.cmd) document.execCommand(b.dataset.cmd, false, null);
        if (b.dataset.block) document.execCommand('formatBlock', false, b.dataset.block);
        reportDirty = true; checkOverflow(); scheduleSave();
    });

    const slug = v => String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w]+/g, '_').replace(/^_|_$/g, '');
    const fileBase = () => `Proposta_Comercial_SaveinCloud_${slug(state.cliente) || 'cliente'}`;
    $('#printBtn').addEventListener('click', () => {
        const prev = document.title;
        document.title = fileBase(); // vira o nome sugerido do PDF
        window.print();
        document.title = prev;
    });

    /* =========================================================
     * Salvar / abrir / limpar / exemplo / importar link
     * ========================================================= */
    function loadState(s, reportHtml, dirty = false) {
        state = { ...blankState(), ...s };
        if (!state.calc || typeof state.calc !== 'object') state.calc = {};
        fillBindings();
        Calc.setState(state.calc);
        if (reportHtml) { showReport(reportHtml); reportDirty = dirty; } else hideReport();
        updateSummary();
        scheduleSave();
    }

    $('#saveBtn').addEventListener('click', () => {
        state.calc = Calc.getState();
        const payload = { app: 'proposta-save', version: 3, state, reportHtml: report.hidden ? null : report.innerHTML, reportDirty };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob); a.download = fileBase() + '.json';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        showToast('Proposta salva.');
    });

    $('#openBtn').addEventListener('click', () => $('#fileOpen').click());
    $('#fileOpen').addEventListener('change', async e => {
        const file = e.target.files[0]; e.target.value = '';
        if (!file) return;
        try {
            const data = JSON.parse(await file.text());
            if (data.app !== 'proposta-save' || data.version !== 3 || !data.state) throw new Error('formato');
            loadState(data.state, data.reportHtml, !!data.reportDirty);
            showToast('Proposta aberta.');
        } catch {
            showToast('Arquivo inválido: não é uma proposta salva por este gerador.');
        }
    });

    $('#resetAll').addEventListener('click', async () => {
        if (!(await confirmDialog('Deseja realmente limpar todos os campos da proposta e da calculadora? Esta ação não pode ser desfeita.', 'Sim, limpar'))) return;
        loadState(blankState(), null);
        showToast('Dados limpos com sucesso!');
    });

    $('#exampleBtn').addEventListener('click', async e => {
        e.preventDefault();
        if (state.cliente && !(await confirmDialog('Substituir os dados atuais pelo exemplo?', 'Sim, substituir'))) return;
        loadState(exampleState(), null);
        showToast('Exemplo carregado.');
    });

    const importModal = $('#importModal');
    const closeImport = () => importModal.classList.remove('show');
    $('#importBtn').addEventListener('click', () => {
        $('#importLink').value = ''; $('#importError').hidden = true;
        importModal.classList.add('show');
        $('#importLink').focus();
    });
    $('#importCancel').addEventListener('click', closeImport);
    importModal.addEventListener('click', e => { if (e.target === importModal) closeImport(); });
    $('#importOk').addEventListener('click', () => {
        try {
            const raw = $('#importLink').value.trim();
            const q = new URL(raw, location.href).searchParams.get('q');
            const calc = JSON.parse(atob(q));
            if (!calc || typeof calc !== 'object') throw new Error('formato');
            Calc.setState(calc);
            updateSummary();
            closeImport();
            showToast('Estimativa importada da calculadora.');
        } catch {
            $('#importError').hidden = false;
        }
    });

    /* =========================================================
     * Inicialização: restaura o rascunho do navegador
     * ========================================================= */
    let saved = null;
    try { saved = JSON.parse(store.get(LS_STATE) || 'null'); } catch { saved = null; }
    if (saved) state = { ...blankState(), ...saved };
    fillBindings();
    Calc.init(state.calc, () => { updateSummary(); scheduleSave(); });
    updateSummary();
    const savedReport = saved && store.get(LS_REPORT);
    if (savedReport) { showReport(savedReport); reportDirty = true; }

    // Também aceita abrir a página com ?q= da calculadora (mesmo formato do link "Link" dela).
    const q = new URLSearchParams(location.search).get('q');
    if (q) {
        try { Calc.setState(JSON.parse(atob(q))); updateSummary(); showToast('Estimativa importada da calculadora.'); } catch { /* link inválido */ }
        history.replaceState({}, document.title, location.pathname);
    }

    window.addEventListener('resize', checkOverflow);
})();
