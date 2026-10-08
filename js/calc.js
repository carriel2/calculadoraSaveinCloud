// Calculadora em blocos — mesmas linhas, padrões, fórmulas e chaves de estado da CalculadoraSave
// (js/app.js), mas organizada em blocos adicionados sob demanda ("+ Adicionar Nuvion", "+ Adicionar Storin"...).
// Como as chaves são as mesmas, um link "?q=" gerado pela calculadora pode ser importado aqui.
window.Calc = (() => {
    const D = window.CALCULATOR_DATA;
    const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const brlPrice = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 5 });
    const nf = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 });
    const num = v => Math.max(0, Number(String(v).replace(',', '.')) || 0);
    const money = v => brl.format(v || 0);
    const moneyPrice = v => brlPrice.format(v || 0);
    const roundMoney = v => Math.round(Number(((v || 0) * 100).toPrecision(12))) / 100;
    const escape = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));
    const find = (list, name) => list.find(x => x.name === name) || null;

    let state = {};
    let onChange = () => {};
    const get = (id, fallback = '') => state[id] !== undefined ? state[id] : fallback;
    const blocks = () => (Array.isArray(state._blocks) ? state._blocks : (state._blocks = []));

    const compactSelectionName = name => String(name)
        .replace('Volume Block Storage ', '')
        .replace('Backup Block Storage ', 'Backup ')
        .replace('Snapshot Block Storage ', 'Snapshot ')
        .replace('Disco Standard Performance p/ backup (sem snapshot) ', 'Disco backup ')
        .replace('Cloudlet ', '')
        .replace('Trafego In/Out ', 'Tráfego ')
        .replace('Trafego de Saída ', 'Saída ')
        .replace('Requisições ', '')
        .replace(' (menos discos de bkp)', '');
    const selectionOptionHtml = (opts, selected) => `<option value="">Selecione...</option>` + opts.map(o => `<option value="${escape(o.name)}" ${o.name === selected ? 'selected' : ''}>${escape(compactSelectionName(o.name))}</option>`).join('');

    function parseVmName(name) {
        const [, vcpu, ram] = name.replace('+RAM', '').split('-');
        const ramGb = Number(ram);
        return { vcpu: Number(vcpu), ram: ramGb < 1 ? `${ramGb * 1024} MB` : `${ramGb} GB` };
    }
    const formatVmOptionLabel = vm => { const s = parseVmName(vm.name); return `${vm.name} · ${s.vcpu} vCPU · ${s.ram} RAM`; };
    const vmOptionHtml = (opts, selected) => `<option value="">Selecione...</option>` + opts.map(vm =>
        `<option value="${escape(vm.name)}" ${vm.name === selected ? 'selected' : ''}>${escape(formatVmOptionLabel(vm))}</option>`).join('');

    const makeQty = (cls, label, val, disabled = '') => `
        <div class="qty-control ${disabled ? 'disabled' : ''}">
          <button type="button" class="qty-btn qty-minus" tabindex="-1">−</button>
          <input class="field ${cls}" aria-label="${label}" type="number" min="0" step="any" value="${escape(val)}" ${disabled}>
          <button type="button" class="qty-btn qty-plus" tabindex="-1">+</button>
        </div>`;
    const tip = t => t ? `<span class="tooltip-icon no-print" data-tip="${t}">?</span>` : '';

    // ========== DEFINIÇÕES (iguais à calculadora) ==========
    const EXTRA_NAMES = ['Gateway', 'VPN', 'Load Balancer Single', 'Load Balancer single + HA Failover'];
    const NUVION_ROWS = [
        { id: 'vm', label: 'TIER VM', opts: D.vm, defaultQty: 730, tip: 'Perfil de processamento e RAM.' },
        { id: 'disk', label: 'DISCO', opts: D.resources.slice(0, 3), defaultQty: 0, tip: 'Armazenamento principal atrelado à VM.' },
        { id: 'ip', label: 'IP FIXO', opts: D.resources.filter(x => x.name.startsWith('IPV')), defaultQty: 730, tip: 'Endereço de IP público e estático.' },
        { id: 'extra', label: 'RECURSO EXTRA', opts: D.resources.filter(x => EXTRA_NAMES.includes(x.name)), defaultQty: 1, tip: 'Recursos adicionais de rede.' },
        { id: 'traffic', label: 'TRÁFEGO', opts: D.resources.filter(x => x.name === 'Trafego In/Out'), defaultQty: 0, tip: 'Franquia de tráfego de dados.' },
        { id: 'additionalDisk', label: 'DISCO ADICIONAL', opts: D.resources.slice(0, 3), defaultQty: 0, tip: 'Armazenamento extra (Block Storage).' },
        { id: 'additionalIp', label: 'IP FIXO ADICIONAL', opts: D.resources.filter(x => x.name.startsWith('IPV')), defaultQty: 730, tip: 'IPs públicos adicionais.' },
        { id: 'extra2', label: 'RECURSO EXTRA 2', opts: D.resources.filter(x => EXTRA_NAMES.includes(x.name)), defaultQty: 1, tip: 'Mais recursos adicionais de rede.' },
        { id: 'backup', label: 'BACKUP', opts: D.resources.filter(x => x.name.startsWith('Backup ')), defaultQty: 0, mult: true, tip: 'Serviço de cópia de segurança.' },
        { id: 'snapshot', label: 'SNAPSHOT', opts: D.resources.filter(x => x.name.startsWith('Snapshot ')), defaultQty: 0, mult: true, tip: 'Imagem instantânea do disco.' },
    ];
    const CLOUDLET_ROWS = [
        { id: 'reserved', label: 'CLOUDLET RESERVADO', defaultTime: 700, defaultQty: 0, match: r => r.name.startsWith('Cloudlet Reservado'), tip: 'Recurso garantido cobrado mensalmente, independente do uso.' },
        { id: 'dynamic', label: 'CLOUDLET DINÂMICO', defaultTime: 30, defaultQty: 0, match: r => r.name.startsWith('Cloudlet Dinâmico'), tip: 'Recurso elástico cobrado apenas quando consumido (por hora).' },
        { id: 'disk', label: 'DISCO HIGH PERFORMANCE', defaultTime: 730, defaultQty: 0, match: r => r.name === 'Disco High Performance', tip: 'Armazenamento rápido (NVMe) para a aplicação.' },
        { id: 'disk-std', label: 'DISCO STANDARD (BKP)', defaultTime: 730, defaultQty: 0, match: r => r.name.startsWith('Disco Standard Performance'), tip: 'Armazenamento de menor custo para backups (sem snapshot).' },
        { id: 'traffic', label: 'TRÁFEGO IN/OUT', defaultTime: 1, defaultQty: 0, match: r => r.name.startsWith('Trafego In/Out'), tip: 'Transferência de dados externa da aplicação.' },
        { id: 'ip', label: 'IP FIXO (IPV4/IPV6)', defaultTime: 730, defaultQty: 1, lockedTime: true, match: r => r.name.startsWith('IPV'), tip: 'Endereço IP público dedicado ao ambiente.' },
        { id: 'snapshot', label: 'SNAPSHOT', defaultTime: 1, defaultQty: 7, match: r => r.name.startsWith('Snapshots'), tip: 'Cópia de segurança do estado atual do ambiente.' },
    ];
    const PLATFORMS = {
        standard: { name: 'Cloudlets Standard', items: D.cloudlets.slice(0, 22) },
        premium: { name: 'Cloudlets Premium', items: D.cloudlets.slice(22, 38) },
    };
    const STORIN_ROWS = [
        { id: 'storage', label: 'ARMAZENAMENTO', opts: D.storIn.slice(0, 4), tip: 'Espaço em disco utilizado no Object Storage (S3).' },
        { id: 'out', label: 'TRÁFEGO DE SAÍDA', opts: D.storIn.filter(x => x.name.startsWith('Trafego de Saída')), tip: 'Transferência de dados enviada para a internet.' },
        { id: 'get', label: 'REQUISIÇÕES GET', opts: D.storIn.filter(x => x.name.startsWith('Requisições GET')), tip: 'Cobrança a cada 1.000 chamadas de leitura (download).' },
        { id: 'put', label: 'REQUISIÇÕES PUT', opts: D.storIn.filter(x => x.name.startsWith('Requisições PUT')), tip: 'Cobrança a cada 1.000 chamadas de escrita (upload).' },
        { id: 'in', label: 'TRÁFEGO DE ENTRADA', opts: D.storIn.filter(x => x.name === 'Trafego de Entrada'), tip: 'Transferência de dados recebida (geralmente gratuita).' },
    ];
    const ENV_LETTER = e => e < 26 ? String.fromCharCode(65 + e) : String(e + 1);

    // ========== BLOCOS ==========
    // { t: 'nuvion', g } | { t: 'cl', p: 'standard'|'premium', e } | { t: 'storin' }
    const blockId = b => b.t === 'nuvion' ? `n${b.g}` : b.t === 'cl' ? `c-${b.p}-${b.e}` : 's';
    const blockPrefix = b => b.t === 'nuvion' ? `n-g${b.g}-` : b.t === 'cl' ? `c-${b.p}-${b.e}-` : 's-';
    const nameKey = b => b.t === 'nuvion' ? `n-g${b.g}-name` : b.t === 'cl' ? `c-${b.p}-${b.e}-name` : 's-name';
    const defaultName = b => b.t === 'nuvion' ? `Grupo ${b.g}` : b.t === 'cl' ? `Ambiente ${ENV_LETTER(b.e)}` : 'Armazenamento, tráfego e requisições';
    const blockName = b => get(nameKey(b), '') || defaultName(b);
    const productOf = b => b.t === 'nuvion' ? 'nuvion' : b.t === 'storin' ? 'storin' : (b.p === 'standard' ? 'cloudletsStandard' : 'cloudletsPremium');

    // Linhas calculadas de um bloco (mesmas fórmulas da calculadora).
    function blockRows(b) {
        const pre = blockPrefix(b);
        if (b.t === 'nuvion') return NUVION_ROWS.map(def => {
            const key = pre + def.id;
            const item = find(def.opts, get(key + '-sel', ''));
            const qty = get(key + '-qty', def.defaultQty);
            const mult = def.mult ? get(key + '-mult', 1) : 1;
            return { def, key, item, qty, mult, sub: roundMoney((item ? item.price : 0) * num(qty) * num(mult)), used: !!item && num(qty) * num(mult) > 0 };
        });
        if (b.t === 'cl') return CLOUDLET_ROWS.map(def => {
            const key = pre + def.id;
            const opts = PLATFORMS[b.p].items.filter(def.match);
            const item = find(opts, get(key + '-sel', ''));
            const time = get(key + '-time', def.defaultTime);
            const qty = get(key + '-qty', def.defaultQty);
            return { def, key, opts, item, time, qty, sub: roundMoney((item ? item.price : 0) * num(time) * num(qty)), used: !!item && num(time) * num(qty) > 0 };
        });
        return STORIN_ROWS.map(def => {
            const key = pre + def.id;
            const item = find(def.opts, get(key + '-sel', def.opts[0] ? def.opts[0].name : ''));
            const qty = get(key + '-qty', 0);
            return { def, key, item, qty, sub: roundMoney((item ? item.price : 0) * num(qty)), used: !!item && num(qty) > 0 };
        });
    }
    const blockTotal = b => roundMoney(blockRows(b).reduce((s, r) => s + r.sub, 0));

    function rowHtml(b, r) {
        const priceCells = `<td class="price">${r.item ? moneyPrice(r.item.price) : '—'}</td><td class="unit">${r.item ? escape(r.item.unit) : '—'}</td>`;
        const label = `<td><div class="cell-label">${r.def.label}${tip(r.def.tip)}</div></td>`;
        if (b.t === 'nuvion') {
            const sel = r.def.id === 'vm' ? vmOptionHtml(r.def.opts, r.item ? r.item.name : '') : selectionOptionHtml(r.def.opts, r.item ? r.item.name : '');
            return `<tr data-key="${r.key}">${label}
                <td class="selection-cell"><select class="field selection" aria-label="${r.def.label}">${sel}</select></td>${priceCells}
                <td>${makeQty('quantity', `Quantidade ${r.def.label}`, r.qty)}</td>
                <td>${r.def.mult ? makeQty('multiplier', `Multiplicador ${r.def.label}`, r.mult) : '<span class="fixed-mult">1</span>'}</td>
                <td class="subtotal" data-sub="${r.key}">${money(r.sub)}</td></tr>`;
        }
        if (b.t === 'cl') {
            return `<tr data-key="${r.key}">${label}
                <td class="selection-cell"><select class="field selection" aria-label="${r.def.label}">${selectionOptionHtml(r.opts, r.item ? r.item.name : '')}</select></td>${priceCells}
                <td>${makeQty('time', `Tempo de uso ${r.def.label}`, r.time, r.def.lockedTime ? 'disabled' : '')}</td>
                <td>${makeQty('quantity', `Quantidade de recursos ${r.def.label}`, r.qty)}</td>
                <td class="subtotal" data-sub="${r.key}">${money(r.sub)}</td></tr>`;
        }
        return `<tr data-key="${r.key}">${label}
            <td class="selection-cell"><select class="field selection" aria-label="${r.def.label}">${selectionOptionHtml(r.def.opts, r.item ? r.item.name : '')}</select></td>${priceCells}
            <td>${makeQty('quantity', `Quantidade ${r.def.label}`, r.qty)}</td>
            <td class="subtotal" data-sub="${r.key}">${money(r.sub)}</td></tr>`;
    }

    const HEADS = {
        nuvion: ['Recurso', 'Seleção do recurso', 'Preço unitário', 'Unidade de medida', 'Quantidade', 'Multiplicador', 'Subtotal'],
        cl: ['Recurso', 'Seleção do recurso', 'Preço unitário', 'Unidade de medida', 'Tempo de uso', 'Qtd. recursos', 'Subtotal'],
        storin: ['Recurso', 'Seleção do recurso', 'Preço unitário', 'Unidade de medida', 'Quantidade', 'Subtotal'],
    };
    const META = {
        nuvion: { eyebrow: 'NUVION · CLOUD VMs', cls: 'blk-nuvion', hint: 'Referência: 1 mês = 730 horas. O multiplicador é aplicado a Backup e Snapshot para estimativa de quantidade de retenção.' },
        cl: { cls: 'env-block', hint: 'Referência: 1 mês = 730 horas.' },
        storin: { eyebrow: 'STORIN · OBJECT STORAGE (S3)', cls: 'blk-storin', hint: 'Armazenamento: GB usados no mês conforme a faixa. Tráfego de saída: GB excedentes. GET e PUT: blocos de 1.000 requisições acima das franquias.' },
    };

    function blockHtml(b, idx) {
        const bid = blockId(b);
        const meta = META[b.t];
        const eyebrow = b.t === 'cl' ? `${PLATFORMS[b.p].name.toUpperCase()} · APP PLATFORM` : meta.eyebrow;
        const heads = HEADS[b.t];
        const canDup = b.t !== 'storin';
        return `<section class="panel active calc-block ${meta.cls}" data-block="${idx}" id="blk-${bid}">
            <div class="panel-head">
                <div class="blk-title">
                    <p class="eyebrow">${eyebrow}</p>
                    <input type="text" class="blk-name" data-block="${idx}" value="${escape(blockName(b))}" aria-label="Nome do bloco" title="Nome exibido na proposta">
                </div>
                <div class="blk-side">
                    <div class="total-card" id="card-${bid}"><span>Subtotal mensal</span><strong data-total="${bid}">${money(blockTotal(b))}</strong></div>
                    <div class="blk-actions no-print">
                        ${canDup ? `<button type="button" class="icon-btn" data-act="dup" data-block="${idx}" title="Duplicar bloco"><span class="material-symbols-outlined">content_copy</span></button>` : ''}
                        <button type="button" class="icon-btn danger-icon" data-act="del" data-block="${idx}" title="Remover bloco"><span class="material-symbols-outlined">delete</span></button>
                    </div>
                </div>
            </div>
            <div class="table-wrap"><table>
                <thead><tr>${heads.map(h => `<th>${h}</th>`).join('')}</tr></thead>
                <tbody>${blockRows(b).map(r => rowHtml(b, r)).join('')}</tbody>
                <tfoot><tr><td colspan="${heads.length - 1}">SUBTOTAL</td><td data-total="${bid}">${money(blockTotal(b))}</td></tr></tfoot>
            </table></div>
            <p class="hint">${meta.hint}</p>
        </section>`;
    }

    const container = () => document.getElementById('blocks');

    function render() {
        const list = blocks();
        container().innerHTML = list.map(blockHtml).join('');
        document.getElementById('blocks-empty').hidden = list.length > 0;
        document.getElementById('add-storin').disabled = list.some(b => b.t === 'storin');
    }

    function refreshTotals(pulseId) {
        blocks().forEach(b => {
            const bid = blockId(b);
            blockRows(b).forEach(r => { const el = container().querySelector(`[data-sub="${r.key}"]`); if (el) el.textContent = money(r.sub); });
            container().querySelectorAll(`[data-total="${bid}"]`).forEach(el => { el.textContent = money(blockTotal(b)); });
        });
        if (pulseId) {
            const card = document.getElementById('card-' + pulseId);
            if (card) { card.classList.remove('pulse'); void card.offsetWidth; card.classList.add('pulse'); }
        }
    }

    // ========== EVENTOS ==========
    document.addEventListener('click', e => {
        const btn = e.target.closest('.qty-minus, .qty-plus');
        if (!btn) return;
        const wrapper = btn.closest('.qty-control');
        if (wrapper.classList.contains('disabled')) return;
        const input = wrapper.querySelector('input[type="number"]');
        let val = parseFloat(input.value) || 0;
        val = btn.classList.contains('qty-plus') ? val + 1 : Math.max(parseFloat(input.getAttribute('min')) || 0, val - 1);
        input.value = val;
        input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    function bindContainer() {
        const box = container();
        box.addEventListener('change', e => {
            const sel = e.target.closest('select.selection'); if (!sel) return;
            state[sel.closest('tr').dataset.key + '-sel'] = sel.value;
            render(); onChange();
        });
        box.addEventListener('input', e => {
            const el = e.target;
            if (el.classList.contains('blk-name')) { state[nameKey(blocks()[el.dataset.block])] = el.value; onChange(); return; }
            const tr = el.closest('tr[data-key]'); if (!tr) return;
            const field = el.classList.contains('multiplier') ? 'mult' : el.classList.contains('time') ? 'time' : 'qty';
            state[`${tr.dataset.key}-${field}`] = el.value;
            refreshTotals(blockId(blocks()[el.closest('[data-block]').dataset.block]));
            onChange();
        });
        box.addEventListener('click', e => {
            const btn = e.target.closest('button[data-act]'); if (!btn) return;
            const idx = +btn.dataset.block; const b = blocks()[idx];
            if (btn.dataset.act === 'del') {
                const pre = blockPrefix(b);
                Object.keys(state).forEach(k => { if (k.startsWith(pre)) delete state[k]; });
                blocks().splice(idx, 1);
            } else if (btn.dataset.act === 'dup') {
                const nb = newBlock(b.t, b.p);
                const from = blockPrefix(b), to = blockPrefix(nb);
                Object.keys(state).forEach(k => { if (k.startsWith(from)) state[to + k.slice(from.length)] = state[k]; });
                state[nameKey(nb)] = `${blockName(b)} (cópia)`;
                blocks().splice(idx + 1, 0, nb);
            }
            render(); onChange();
        });
    }

    function newBlock(t, p) {
        if (t === 'nuvion') {
            let g = 0;
            blocks().forEach(b => { if (b.t === 'nuvion') g = Math.max(g, b.g); });
            Object.keys(state).forEach(k => { const m = k.match(/^n-g(\d+)-/); if (m) g = Math.max(g, +m[1]); });
            return { t, g: g + 1 };
        }
        if (t === 'cl') {
            let e = -1;
            blocks().forEach(b => { if (b.t === 'cl' && b.p === p) e = Math.max(e, b.e); });
            Object.keys(state).forEach(k => { const m = k.match(new RegExp(`^c-${p}-(\\d+)-`)); if (m) e = Math.max(e, +m[1]); });
            return { t, p, e: e + 1 };
        }
        return { t: 'storin' };
    }

    function add(t, p) {
        if (t === 'storin' && blocks().some(b => b.t === 'storin')) return;
        const b = newBlock(t, p);
        blocks().push(b);
        render(); onChange();
        const el = document.getElementById('blk-' + blockId(b));
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // Estado vindo da calculadora (sem _blocks): cria blocos para o que estiver preenchido.
    function deriveBlocks() {
        if (Array.isArray(state._blocks)) return;
        Object.keys(state).forEach(k => { // migração de chaves antigas, como na calculadora
            const m = k.match(/^n-vm-(\d+)-(sel|qty)$/);
            if (m) { state[`n-g${m[1]}-vm-${m[2]}`] = state[k]; delete state[k]; }
            const o = k.match(/^n-(disk|ip|extra|traffic|additionalDisk|additionalIp|extra2|backup|snapshot)-(sel|qty|mult)$/);
            if (o) { state[`n-g1-${o[1]}-${o[2]}`] = state[k]; delete state[k]; }
        });
        const list = [];
        const hasSel = pre => Object.keys(state).some(k => k.startsWith(pre) && k.endsWith('-sel') && state[k]);
        let maxG = 0;
        Object.keys(state).forEach(k => { const m = k.match(/^n-g(\d+)-/); if (m) maxG = Math.max(maxG, +m[1]); });
        for (let g = 1; g <= maxG; g++) if (hasSel(`n-g${g}-`)) list.push({ t: 'nuvion', g });
        ['standard', 'premium'].forEach(p => {
            let maxE = -1;
            Object.keys(state).forEach(k => { const m = k.match(new RegExp(`^c-${p}-(\\d+)-`)); if (m) maxE = Math.max(maxE, +m[1]); });
            for (let e = 0; e <= maxE; e++) if (hasSel(`c-${p}-${e}-`)) list.push({ t: 'cl', p, e });
        });
        if (STORIN_ROWS.some(r => num(state[`s-${r.id}-qty`]) > 0)) list.push({ t: 'storin' });
        state._blocks = list;
    }

    // ========== LEITURA PARA A PROPOSTA ==========
    function qtyLabel(unit, qty) {
        const u = String(unit).toLowerCase();
        if (u.includes('1000 requisi')) return `${nf.format(qty)} × 1.000 req.`;
        if (u.includes('gb')) return `${nf.format(qty)} GB`;
        if (u.includes('hora')) return `${nf.format(qty)} h`;
        return nf.format(qty);
    }

    const PRODUCT_NAMES = { nuvion: 'Nuvion', cloudletsStandard: 'Cloudlets Standard', cloudletsPremium: 'Cloudlets Premium', storin: 'Storin' };

    function collect() {
        const totals = { nuvion: 0, cloudletsStandard: 0, cloudletsPremium: 0, storin: 0 };
        const sections = [];
        blocks().forEach(b => {
            const rows = blockRows(b).filter(r => r.used).map(r => {
                let qtyText;
                if (b.t === 'cl') qtyText = `${nf.format(num(r.qty))} × ${nf.format(num(r.time))}${String(r.item.unit).toLowerCase().includes('hora') ? ' h' : ''}`;
                else qtyText = qtyLabel(r.item.unit, num(r.qty)) + (num(r.mult || 1) !== 1 ? ` × ${nf.format(num(r.mult))}` : '');
                return {
                    label: r.def.label,
                    spec: b.t === 'nuvion' && r.def.id === 'vm' ? formatVmOptionLabel(r.item) : r.item.name,
                    price: r.item.price, unit: r.item.unit, qtyText, sub: r.sub,
                };
            });
            if (!rows.length) return;
            const product = productOf(b);
            const total = roundMoney(rows.reduce((s, r) => s + r.sub, 0));
            totals[product] = roundMoney(totals[product] + total);
            sections.push({ product, productName: PRODUCT_NAMES[product], name: blockName(b), rows, total });
        });
        const monthly = roundMoney(Object.values(totals).reduce((s, v) => s + v, 0));
        return { sections, totals, monthly, productNames: PRODUCT_NAMES };
    }

    // ========== API ==========
    document.querySelectorAll('[data-add]').forEach(btn => btn.addEventListener('click', () => add(btn.dataset.add, btn.dataset.platform)));

    return {
        init(initialState, changeCb) {
            state = initialState || {}; onChange = changeCb || onChange;
            deriveBlocks(); bindContainer(); render();
        },
        setState(s) { state = s || {}; deriveBlocks(); render(); onChange(); },
        getState() { blocks(); return state; },
        collect,
        money, moneyPrice, roundMoney,
    };
})();
