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
        data: today(), validade: 60, prazo: 1, // propostas são mensais; o prazo pode ser aumentado no Resumo
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
        const prazo = Math.max(1, Math.round(num(state.prazo)) || 1);
        $('#prazo-unit').textContent = prazo === 1 ? 'mês' : 'meses';
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
            <colgroup><col style="width:19%"><col style="width:31%"><col style="width:17%"><col style="width:15%"><col style="width:18%"></colgroup>
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
        const prazo = Math.max(1, Math.round(num(s.prazo)) || 1);
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
            ? `<p><strong>Responsável SaveInCloud:</strong> ${esc(s.responsavel)}${s.emailResp ? ` &nbsp;|&nbsp; <strong>Contato:</strong> ${EMAIL_RE.test(s.emailResp.trim()) ? `<a href="mailto:${esc(s.emailResp.trim())}">${esc(s.emailResp)}</a>` : esc(s.emailResp)}` : ''}</p>` : '';

        // Conteúdo em blocos soltos; paginate() distribui pelas folhas do papel timbrado.
        // O conteúdo flui contínuo; data-break (botão "Quebra de página") força uma folha nova.
        return `
        <article class="sheet">
            <h1 class="doc-title">${esc(s.titulo || 'Proposta Comercial')}</h1>
            <table class="info">
                <tr><td><b>Cliente:</b> ${cliente}</td><td><b>Contato:</b> ${contato || '—'}</td></tr>
                <tr><td><b>Data:</b> ${fmtDate(s.data)}</td><td><b>Validade:</b> ${num(s.validade)} dias</td></tr>
            </table>
            <h2>1. Objetivo</h2>
            <p>Apresentar uma solução de infraestrutura em nuvem para a ${cliente}${s.foco ? `, com foco em ${esc(s.foco)}` : ''}.</p>
            <h2>2. Solução proposta</h2>
            <p>A solução será dimensionada conforme os requisitos técnicos e comerciais validados com o cliente:</p>
            <ul>${products.map(p => PRODUCT_TEXT[p]).join('')}</ul>
            <h2>3. Escopo de implantação</h2>
            <ol>${lines(s.escopo).map(l => `<li>${esc(l)}</li>`).join('')}</ol>

            <h2>4. Investimento</h2>
            <p class="keep-next">Valores mensais estimados com base na calculadora SaveInCloud (referência: 1 mês = 730 horas).</p>
            ${investimento}

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
            <div class="sign">
                <h2>5. Próximos passos</h2>
                <p>Após a aprovação, as partes confirmarão o escopo, o cronograma e as condições contratuais para iniciar a implantação.</p>
                ${responsavel}
                <p><strong>Aceite do cliente:</strong> _____________________________________ &nbsp; <strong>Data:</strong> ____/____/______</p>
            </div>
        </article>`;
    }

    /* ---- paginação no papel timbrado ----
       Cada .sheet é uma folha A4 com o timbrado de fundo; a área útil é o content-box (fora do cabeçalho e rodapé). */
    // getBoundingClientRect já vem com o zoom de tela aplicado; padding/margin do getComputedStyle não.
    const reportZoom = () => parseFloat(report.style.zoom) || 1;
    function sheetLimit(sh) {
        const cs = getComputedStyle(sh);
        return sh.getBoundingClientRect().bottom - (parseFloat(cs.paddingBottom) + parseFloat(cs.borderBottomWidth)) * reportZoom();
    }
    function overflows(sh) {
        const last = sh.lastElementChild;
        if (!last) return false;
        return last.getBoundingClientRect().bottom + parseFloat(getComputedStyle(last).marginBottom) * reportZoom() > sheetLimit(sh) + 1;
    }
    const checkOverflow = () => report.querySelectorAll('.sheet').forEach(sh => sh.classList.toggle('overflowing', overflows(sh)));

    // Títulos e textos de introdução não ficam sozinhos no fim da folha: vão junto com o bloco seguinte.
    const keepsWithNext = el => /^H[1-6]$/.test(el.tagName) || el.classList.contains('keep-next');

    // Na tela, reduz as folhas proporcionalmente quando a janela é mais estreita que um A4
    // (em vez de espremer o conteúdo). Na impressão o zoom é anulado pelo CSS.
    const A4_WIDTH_PX = 210 * 96 / 25.4;
    function fitReport() {
        const avail = document.documentElement.clientWidth - 24;
        report.style.zoom = String(Math.min(1, avail / A4_WIDTH_PX));
    }

    // Bloco (filho direto da folha) onde está o cursor.
    function blockAtSelection() {
        const sel = window.getSelection();
        let node = sel && sel.anchorNode;
        while (node && !(node.parentElement && node.parentElement.classList.contains('sheet'))) node = node.parentElement;
        return node && node.nodeType === 1 && report.contains(node) ? node : null;
    }

    function newSheet() {
        const a = document.createElement('article');
        a.className = 'sheet';
        a.contentEditable = 'true';
        a.spellcheck = true;
        a.lang = 'pt-BR';
        report.appendChild(a);
        return a;
    }

    // Redistribui todos os blocos pelas folhas: mantém as edições (move os próprios nós) e
    // nunca deixa um título sozinho no fim da folha.
    function paginate() {
        if (report.hidden) return;
        const blocks = [];
        report.querySelectorAll('.sheet').forEach(sh => [...sh.children].forEach(el => {
            if (el.tagName === 'SECTION') { // propostas salvas no formato anterior
                const kids = [...el.children];
                if (el.classList.contains('sign')) {
                    const d = document.createElement('div');
                    d.className = 'sign';
                    d.append(...kids);
                    blocks.push(d);
                } else {
                    blocks.push(...kids);
                }
            } else if (el.tagName === 'HEADER') {
                blocks.push(...[...el.children].filter(k => k.tagName !== 'IMG'));
            } else {
                blocks.push(el);
            }
        }));
        report.innerHTML = '';
        let sheet = newSheet();
        blocks.forEach(b => {
            if (b.dataset.break && sheet.children.length) sheet = newSheet();
            sheet.appendChild(b);
            if (sheet.children.length > 1 && overflows(sheet)) {
                sheet.removeChild(b);
                const carry = [];
                while (sheet.children.length > 1 && keepsWithNext(sheet.lastElementChild)) carry.unshift(sheet.removeChild(sheet.lastElementChild));
                sheet = newSheet();
                carry.forEach(c => sheet.appendChild(c));
                sheet.appendChild(b);
            }
        });
        checkOverflow();
        scheduleSave();
    }

    let reportDirty = false;
    function showReport(html, repaginate = true) {
        report.innerHTML = html;
        report.hidden = false; $('#toolbar').hidden = false;
        $('#printBtn').hidden = false; $('#printHint').hidden = false;
        $('#generateLabel').textContent = 'Regerar proposta';
        report.querySelectorAll('.sheet').forEach(sh => { sh.contentEditable = 'true'; sh.spellcheck = true; sh.lang = 'pt-BR'; });
        fitReport();
        const run = () => (repaginate ? paginate() : checkOverflow());
        // espera o timbrado/fontes para medir certo
        (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => setTimeout(run, 0));
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

    const markEdited = () => { reportDirty = true; checkOverflow(); scheduleSave(); };
    report.addEventListener('input', markEdited);

    /* =========================================================
     * Links e marca-texto no editor
     * ========================================================= */
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const PHONE_RE = /^\+?[\d\s().-]{8,}$/;
    // Aceita site, e-mail ou telefone; nunca esquemas perigosos (javascript:, data: ...).
    function normalizeUrl(raw) {
        const u = String(raw || '').trim();
        if (!u) return null;
        if (/^(https?:\/\/|mailto:|tel:)/i.test(u)) return u;
        if (/^[a-z][a-z0-9+.-]*:/i.test(u)) return null;
        if (EMAIL_RE.test(u)) return 'mailto:' + u;
        if (PHONE_RE.test(u)) return 'tel:' + u.replace(/[^\d+]/g, '');
        if (/^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(u)) return 'https://' + u;
        return null;
    }
    const isSafeHref = href => /^(https?:|mailto:|tel:)/i.test(href || '');
    const displayHref = href => String(href || '').replace(/^mailto:|^tel:/i, '').replace(/^https?:\/\//i, '');
    function decorateLink(a) {
        if (/^https?:/i.test(a.getAttribute('href') || '')) { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
        else { a.removeAttribute('target'); a.removeAttribute('rel'); }
    }

    // A seleção se perde ao focar os campos do modal: guarda e restaura o intervalo.
    let savedRange = null;
    let editingLink = null;
    function saveSelection() {
        const sel = window.getSelection();
        savedRange = sel.rangeCount && report.contains(sel.anchorNode) ? sel.getRangeAt(0).cloneRange() : null;
    }
    function restoreSelection() {
        if (!savedRange) return false;
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(savedRange);
        return true;
    }
    const linkAtSelection = () => {
        const sel = window.getSelection();
        const node = sel.rangeCount ? sel.anchorNode : null;
        const el = node && (node.nodeType === 1 ? node : node.parentElement);
        const a = el && el.closest('a');
        return a && report.contains(a) ? a : null;
    };

    const linkModal = $('#linkModal');
    function openLinkModal(existing) {
        hideBubble();
        saveSelection();
        if (!existing && !savedRange) { showToast('Clique no documento onde o link deve entrar (ou selecione uma palavra).'); return; }
        editingLink = existing || null;
        const selectedText = savedRange ? savedRange.toString() : '';
        $('#linkTitle').textContent = existing ? 'Editar link' : 'Inserir link';
        $('#linkText').value = existing ? existing.textContent : selectedText;
        $('#linkUrl').value = existing ? displayHref(existing.getAttribute('href')) : (normalizeUrl(selectedText) ? selectedText.trim() : '');
        $('#linkRemove').hidden = !existing;
        $('#linkError').hidden = true;
        linkModal.classList.add('show');
        ($('#linkUrl').value ? $('#linkText') : $('#linkUrl')).focus();
    }
    const closeLinkModal = () => { linkModal.classList.remove('show'); editingLink = null; };

    function applyLink() {
        const href = normalizeUrl($('#linkUrl').value);
        if (!href) { $('#linkError').hidden = false; return; }
        const text = $('#linkText').value.trim() || displayHref(href);
        if (editingLink) {
            editingLink.setAttribute('href', href);
            if (editingLink.textContent !== text) editingLink.textContent = text;
            decorateLink(editingLink);
        } else {
            restoreSelection();
            const range = savedRange;
            const a = document.createElement('a');
            a.setAttribute('href', href);
            decorateLink(a);
            if (range.collapsed || range.toString() !== text) {
                // sem seleção (ou texto alterado no modal): insere um link novo no cursor
                a.textContent = text;
                range.deleteContents();
                range.insertNode(a);
            } else {
                // palavra selecionada vira link, preservando a formatação dela
                a.appendChild(range.extractContents());
                range.insertNode(a);
            }
            const sel = window.getSelection();
            const after = document.createRange();
            after.setStartAfter(a);
            after.collapse(true);
            sel.removeAllRanges();
            sel.addRange(after);
        }
        closeLinkModal();
        markEdited();
    }
    function removeLink(a) {
        if (!a) return;
        a.replaceWith(...a.childNodes);
        hideBubble();
        markEdited();
    }
    $('#linkOk').addEventListener('click', applyLink);
    $('#linkCancel').addEventListener('click', closeLinkModal);
    $('#linkRemove').addEventListener('click', () => { const a = editingLink; closeLinkModal(); removeLink(a); });
    linkModal.addEventListener('click', e => { if (e.target === linkModal) closeLinkModal(); });
    linkModal.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); applyLink(); }
        if (e.key === 'Escape') closeLinkModal();
    });

    // Balão ao clicar num link: abrir, editar ou remover. Ctrl/Cmd + clique abre direto.
    const bubble = $('#linkBubble');
    let bubbleLink = null;
    function showBubble(a) {
        bubbleLink = a;
        const href = a.getAttribute('href');
        const url = $('#linkBubbleUrl');
        url.textContent = displayHref(href) || '(sem endereço)';
        url.href = isSafeHref(href) ? href : '#';
        bubble.hidden = false;
        const r = a.getBoundingClientRect();
        const left = Math.min(window.scrollX + r.left, window.scrollX + document.documentElement.clientWidth - bubble.offsetWidth - 8);
        bubble.style.left = Math.max(8, left) + 'px';
        bubble.style.top = (window.scrollY + r.bottom + 6) + 'px';
    }
    function hideBubble() { bubble.hidden = true; bubbleLink = null; }
    function openLink(a) {
        const href = a && a.getAttribute('href');
        if (isSafeHref(href)) window.open(href, '_blank', 'noopener');
    }
    report.addEventListener('click', e => {
        const a = e.target.closest('a');
        if (!a || !report.contains(a)) { hideBubble(); return; }
        if (e.ctrlKey || e.metaKey) { e.preventDefault(); openLink(a); return; }
        showBubble(a);
    });
    bubble.addEventListener('mousedown', e => e.preventDefault());
    bubble.addEventListener('click', e => {
        const b = e.target.closest('button');
        if (!b || !bubbleLink) return;
        if (b.dataset.bubble === 'open') openLink(bubbleLink);
        if (b.dataset.bubble === 'edit') openLinkModal(bubbleLink);
        if (b.dataset.bubble === 'remove') removeLink(bubbleLink);
    });
    document.addEventListener('mousedown', e => { if (!bubble.hidden && !bubble.contains(e.target) && !e.target.closest('#report a')) hideBubble(); });
    window.addEventListener('scroll', () => { if (!bubble.hidden) hideBubble(); }, { passive: true });

    // Endereços digitados viram link sozinhos ao apertar espaço ou Enter (ex.: www.site.com, nome@empresa.com).
    const AUTOLINK_RE = /((?:https?:\/\/|www\.)[^\s<]+[^\s<.,;:!?)\]]|[^\s@<>()]+@[^\s@<>()]+\.[a-z]{2,})$/i;
    report.addEventListener('keydown', e => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openLinkModal(linkAtSelection()); return; }
        if (e.key !== ' ' && e.key !== 'Enter') return;
        const sel = window.getSelection();
        if (!sel.rangeCount || !sel.isCollapsed) return;
        const node = sel.anchorNode;
        if (!node || node.nodeType !== 3 || node.parentElement.closest('a')) return;
        const before = node.textContent.slice(0, sel.anchorOffset);
        const m = before.match(AUTOLINK_RE);
        if (!m) return;
        const href = normalizeUrl(m[1]);
        if (!href) return;
        const range = document.createRange();
        range.setStart(node, sel.anchorOffset - m[1].length);
        range.setEnd(node, sel.anchorOffset);
        const a = document.createElement('a');
        a.setAttribute('href', href);
        decorateLink(a);
        range.surroundContents(a);
        const after = document.createRange();
        after.setStartAfter(a);
        after.collapse(true);
        sel.removeAllRanges();
        sel.addRange(after);
        markEdited();
    });

    // Marca-texto: aplica a cor de fundo na seleção (ou remove).
    function highlight(color) {
        const sel = window.getSelection();
        if (!sel.rangeCount || sel.isCollapsed || !report.contains(sel.anchorNode)) { showToast('Selecione o trecho que deve receber o marca-texto.'); return false; }
        document.execCommand('styleWithCSS', false, true);
        document.execCommand('hiliteColor', false, color === 'none' ? 'transparent' : color);
        document.execCommand('styleWithCSS', false, false);
        return true;
    }

    const toolbar = $('#toolbar');
    toolbar.addEventListener('mousedown', e => e.preventDefault()); // mantém a seleção do documento
    toolbar.addEventListener('click', e => {
        const b = e.target.closest('button'); if (!b) return;
        if (b.dataset.act === 'link') { openLinkModal(linkAtSelection()); return; }
        if (b.dataset.hl) { if (!highlight(b.dataset.hl)) return; }
        if (b.dataset.cmd) document.execCommand(b.dataset.cmd, false, null);
        if (b.dataset.block) document.execCommand('formatBlock', false, b.dataset.block);
        if (b.dataset.act === 'paginate') { paginate(); showToast('Páginas reorganizadas.'); }
        if (b.dataset.act === 'break') {
            const blk = blockAtSelection();
            if (!blk) { showToast('Clique no trecho que deve começar numa nova página.'); return; }
            if (blk.dataset.break) delete blk.dataset.break; else blk.dataset.break = '1';
            paginate();
            showToast(blk.dataset.break ? 'Quebra de página inserida.' : 'Quebra de página removida.');
        }
        reportDirty = true; checkOverflow(); scheduleSave();
    });

    const slug = v => String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w]+/g, '_').replace(/^_|_$/g, '');
    const fileBase = () => `Proposta_Comercial_SaveInCloud_${slug(state.cliente) || 'cliente'}`;
    $('#printBtn').addEventListener('click', () => {
        const prev = document.title;
        document.title = fileBase(); // vira o nome sugerido do PDF
        paginate(); // garante que nada invada o cabeçalho/rodapé do timbrado
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
    if (savedReport) { showReport(savedReport, false); reportDirty = true; }

    // Também aceita abrir a página com ?q= da calculadora (mesmo formato do link "Link" dela).
    const q = new URLSearchParams(location.search).get('q');
    if (q) {
        try { Calc.setState(JSON.parse(atob(q))); updateSummary(); showToast('Estimativa importada da calculadora.'); } catch { /* link inválido */ }
        history.replaceState({}, document.title, location.pathname);
    }

    window.addEventListener('resize', () => { fitReport(); checkOverflow(); });
})();
