(() => {
    const D = window.CALCULATOR_DATA;
    const brl = new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 2,
        maximumFractionDigits: 4
    });
    const num = v => Math.max(0, Number(String(v).replace(',', '.')) || 0);
    const money = v => brl.format(v || 0);
    const key = 'saveincloud-calculadora-v2';

    // ========== SHARED STATE ==========
    const urlParams = new URLSearchParams(window.location.search);
    const sharedData = urlParams.get('q');
    if (sharedData) {
        try {
            localStorage.setItem(key, atob(sharedData));
            window.history.replaceState({}, document.title, window.location.pathname);
        } catch (e) { console.error('Error parsing shared state', e); }
    }

    let state = JSON.parse(localStorage.getItem(key) || '{}');
    const persist = () => localStorage.setItem(key, JSON.stringify(state));
    const get = (id, fallback = '') => state[id] !== undefined ? state[id] : fallback;
    const escape = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));
    const optionHtml = (opts, selected, placeholder = 'Selecione...') => `<option value="">${placeholder}</option>` + opts.map(o => `<option value="${escape(o.name)}" ${o.name===selected?'selected':''}>${escape(o.name)}</option>`).join('');
    const find = (list, name) => list.find(x => x.name === name) || null;

    // ========== HELPERS ==========
    const showToast = (msg) => {
        const toast = document.getElementById('toast');
        if (toast) {
            toast.textContent = msg;
            toast.classList.add('show');
            setTimeout(() => toast.classList.remove('show'), 3000);
        }
    };

    const pulseCard = (cardId) => {
        const card = document.getElementById(cardId);
        if (card) {
            card.classList.remove('pulse');
            void card.offsetWidth;
            card.classList.add('pulse');
        }
    };

    const makeQty = (cls, label, val, disabled = '') => `
        <div class="qty-control ${disabled ? 'disabled' : ''}">
          <button type="button" class="qty-btn qty-minus" tabindex="-1">−</button>
          <input class="field ${cls}" aria-label="${label}" type="number" min="0" step="any" value="${val}" ${disabled}>
          <button type="button" class="qty-btn qty-plus" tabindex="-1">+</button>
        </div>
    `;

    document.addEventListener('click', e => {
        if (e.target.classList.contains('qty-minus') || e.target.classList.contains('qty-plus')) {
            const isPlus = e.target.classList.contains('qty-plus');
            const wrapper = e.target.closest('.qty-control');
            if (wrapper.classList.contains('disabled')) return;

            const input = wrapper.querySelector('input[type="number"]');
            if (!input) return;

            let val = parseFloat(input.value) || 0;
            if (isPlus) {
                val += 1;
            } else {
                val = Math.max(parseFloat(input.getAttribute('min')) || 0, val - 1);
            }
            input.value = val;
            input.dispatchEvent(new Event('input', { bubbles: true }));
        }
    });

    // ========== NUVION ==========
    const nuvionBaseRows = [
        ['disk', 'DISCO', D.resources.slice(0, 3), 0, 1, 'Armazenamento principal atrelado à VM.'],
        ['ip', 'IP FIXO', D.resources.filter(x => x.name.startsWith('IPV')), 730, 1, 'Endereço de IP público e estático.'],
        ['extra', 'RECURSO EXTRA', D.resources.filter(x => ['Gateway', 'VPN', 'Load Balancer Single', 'Load Balancer single + HA Failover'].includes(x.name)), 1, 1, 'Recursos adicionais de rede.'],
        ['traffic', 'TRÁFEGO', D.resources.filter(x => x.name === 'Trafego In/Out'), 0, 1, 'Franquia de tráfego de dados.'],
        ['additionalDisk', 'DISCO ADICIONAL', D.resources.slice(0, 3), 0, 1, 'Armazenamento extra (Block Storage).'],
        ['additionalIp', 'IP FIXO ADICIONAL', D.resources.filter(x => x.name.startsWith('IPV')), 730, 1, 'IPs públicos adicionais.'],
        ['extra2', 'RECURSO EXTRA 2', D.resources.filter(x => ['Gateway', 'VPN', 'Load Balancer Single', 'Load Balancer single + HA Failover'].includes(x.name)), 1, 1, 'Mais recursos adicionais de rede.'],
        ['backup', 'BACKUP', D.resources.filter(x => x.name.startsWith('Backup ')), 0, 1, 'Serviço de cópia de segurança.'],
        ['snapshot', 'SNAPSHOT', D.resources.filter(x => x.name.startsWith('Snapshot ')), 0, 1, 'Imagem instantânea do disco.'],
    ];

    let nuvionVmCount = 1;
    Object.keys(state).forEach(k => {
        const match = k.match(/^n-vm-(\d+)-sel$/);
        if (match) nuvionVmCount = Math.max(nuvionVmCount, parseInt(match[1]));
    });

    function getNuvionRows() {
        let rows = [];
        for (let i = 1; i <= nuvionVmCount; i++) {
            rows.push([`vm-${i}`, `TIER VM ${i}`, D.vm, 730, 1, 'Perfil de processamento e RAM.']);
        }
        return rows.concat(nuvionBaseRows);
    }

    function renderNuvion() {
        const body = document.querySelector('#nuvion-body');
        const rows = getNuvionRows();
        body.innerHTML = rows.map(([id, label, opts, defaultQty, defaultMult, tip]) => {
            const selected = get('n-' + id + '-sel', '');
            const item = find(opts, selected);
            const qty = get('n-' + id + '-qty', defaultQty);
            const mult = get('n-' + id + '-mult', defaultMult);
            const itemPrice = item ? item.price : 0;
            const sub = itemPrice * num(qty) * num(mult);
            const tipHtml = tip ? `<span class="tooltip-icon" data-tip="${tip}">?</span>` : '';

            const isExtraVm = id.startsWith('vm-') && id !== 'vm-1';
            const deleteHtml = isExtraVm ? `<button type="button" class="icon-btn delete-vm" data-vmid="${id.split('-')[1]}" title="Remover este grupo" style="padding:0; color:#ef4444;"><span class="material-symbols-outlined" style="font-size:18px;">delete</span></button>` : '';

            const qtyHtml = makeQty('quantity', `Quantidade ${label}`, qty);
            const multHtml = ['backup', 'snapshot'].includes(id) ? makeQty('multiplier', `Multiplicador ${label}`, mult) : `<span class="fixed-mult">1</span>`;

            return `<tr data-nuvion="${id}"><td><div class="cell-label">${label}${tipHtml}${deleteHtml}</div></td><td><select class="field selection" aria-label="${label}">${optionHtml(opts,selected)}</select></td><td class="price">${item?money(item.price):'—'}</td><td class="unit">${item?escape(item.unit):'—'}</td><td>${qtyHtml}</td><td>${multHtml}</td><td class="subtotal">${money(sub)}</td></tr>`;
        }).join('');
        bindNuvion();
        calcNuvion();
    }

    function bindNuvion() {
        document.querySelectorAll('[data-nuvion]').forEach(row => {
            const id = row.dataset.nuvion;
            row.querySelector('.selection').onchange = e => {
                state['n-' + id + '-sel'] = e.target.value;
                persist();
                renderNuvion();
            };
            row.querySelector('.quantity').oninput = e => {
                state['n-' + id + '-qty'] = e.target.value;
                persist();
                calcNuvion();
            };
            const m = row.querySelector('.multiplier');
            if (m) m.oninput = e => {
                state['n-' + id + '-mult'] = e.target.value;
                persist();
                calcNuvion();
            };
        });
    }

    function calcNuvion() {
        let total = 0;
        const rows = getNuvionRows();
        document.querySelectorAll('[data-nuvion]').forEach(row => {
            const [, , opts] = rows.find(x => x[0] === row.dataset.nuvion);
            const i = find(opts, row.querySelector('.selection').value);
            const itemPrice = i ? i.price : 0;
            const multiplierInput = row.querySelector('.multiplier');
            const multValue = multiplierInput ? multiplierInput.value : 1;

            const s = itemPrice * num(row.querySelector('.quantity').value) * num(multValue);
            row.querySelector('.subtotal').textContent = money(s);
            total += s;
        });
        document.querySelector('#nuvion-total').textContent = money(total);
        document.querySelector('#nuvion-footer').textContent = money(total);
        pulseCard('nuvion-total-card');
    }

    const addVmBtn = document.getElementById('addVmBtn');
    if (addVmBtn) {
        addVmBtn.addEventListener('click', () => {
            nuvionVmCount++;
            renderNuvion();
        });
    }

    document.addEventListener('click', e => {
        const delBtn = e.target.closest('.delete-vm');
        if (delBtn) {
            const vmid = parseInt(delBtn.dataset.vmid);
            for (let i = vmid; i < nuvionVmCount; i++) {
                const nextSel = state[`n-vm-${i+1}-sel`];
                const nextQty = state[`n-vm-${i+1}-qty`];
                if (nextSel !== undefined) state[`n-vm-${i}-sel`] = nextSel;
                else delete state[`n-vm-${i}-sel`];
                if (nextQty !== undefined) state[`n-vm-${i}-qty`] = nextQty;
                else delete state[`n-vm-${i}-qty`];
            }
            delete state[`n-vm-${nuvionVmCount}-sel`];
            delete state[`n-vm-${nuvionVmCount}-qty`];
            nuvionVmCount--;
            persist();
            renderNuvion();
        }
    });

    // ========== CLOUDLETS ==========
    const ENV_LABELS = ['A', 'B', 'C', 'D'];
    const cloudletsRowDefs = [
        { id: 'reserved', label: 'CLOUDLET RESERVADO', defaultTime: 700, defaultQty: 0, tip: 'Recurso garantido cobrado mensalmente, independente do uso.' },
        { id: 'dynamic', label: 'CLOUDLET DINÂMICO', defaultTime: 30, defaultQty: 0, tip: 'Recurso elástico cobrado apenas quando consumido (por hora).' },
        { id: 'disk', label: 'DISCO HIGH PERFORMANCE', defaultTime: 730, defaultQty: 0, tip: 'Armazenamento rápido (NVMe) para a aplicação.' },
        { id: 'disk-std', label: 'DISCO STANDARD (BKP)', defaultTime: 730, defaultQty: 0, tip: 'Armazenamento de menor custo para backups (sem snapshot).' },
        { id: 'traffic', label: 'TRÁFEGO IN/OUT', defaultTime: 1, defaultQty: 0, tip: 'Transferência de dados externa da aplicação.' },
        { id: 'ip', label: 'IP FIXO (IPV4/IPV6)', defaultTime: 730, defaultQty: 1, lockedTime: true, tip: 'Endereço IP público dedicado ao ambiente.' },
        { id: 'snapshot', label: 'SNAPSHOT', defaultTime: 1, defaultQty: 7, tip: 'Cópia de segurança do estado atual do ambiente.' },
    ];

    function buildCloudletsPanel(platformId, platformName, resourceStartIdx, resourceEndIdx) {
        const platformResources = D.cloudlets.slice(resourceStartIdx, resourceEndIdx);
        const resourceGroups = {
            reserved: platformResources.filter(r => r.name.startsWith('Cloudlet Reservado')),
            dynamic: platformResources.filter(r => r.name.startsWith('Cloudlet Dinâmico')),
            disk: platformResources.filter(r => r.name === 'Disco High Performance'),
            'disk-std': platformResources.filter(r => r.name.startsWith('Disco Standard Performance')),
            traffic: platformResources.filter(r => r.name.startsWith('Trafego In/Out')),
            ip: platformResources.filter(r => r.name.startsWith('IPV')),
            snapshot: platformResources.filter(r => r.name.startsWith('Snapshots')),
        };

        let html = '';
        ENV_LABELS.forEach((env, envIdx) => {
            const envPrefix = `c-${platformId}-${envIdx}`;
            html += `<div class="env-block env-${envIdx} ${envIdx === 2 ? 'print-page-break' : ''}" data-env="${env}">`;
            html += `<div class="group-title">Ambiente ${env} — ${platformName}</div>`;
            html += `<div class="table-wrap"><table><thead><tr><th>Recurso</th><th>Seleção do recurso</th><th>Preço unitário</th><th>Unidade de medida</th><th>Tempo de uso</th><th>Qtd. recursos</th><th>Subtotal</th></tr></thead><tbody>`;

            cloudletsRowDefs.forEach(rowDef => {
                const opts = resourceGroups[rowDef.id] || [];
                const keySel = `${envPrefix}-${rowDef.id}-sel`;
                const keyTime = `${envPrefix}-${rowDef.id}-time`;
                const keyQty = `${envPrefix}-${rowDef.id}-qty`;
                const selected = get(keySel, '');
                const item = find(opts, selected);
                const timeVal = get(keyTime, rowDef.defaultTime);
                const qtyVal = get(keyQty, rowDef.defaultQty);
                const itemPrice = item ? item.price : 0;
                const sub = itemPrice * num(timeVal) * num(qtyVal);
                const locked = rowDef.lockedTime ? 'disabled' : '';

                const timeHtml = makeQty('time', `Tempo de uso ${rowDef.label}`, timeVal, locked);
                const qtyHtml = makeQty('resource-count', `Quantidade de recursos ${rowDef.label}`, qtyVal);
                const tipHtml = rowDef.tip ? `<span class="tooltip-icon" data-tip="${rowDef.tip}">?</span>` : '';

                html += `<tr data-cloud="${envPrefix}-${rowDef.id}"><td><div class="cell-label">${rowDef.label}${tipHtml}</div></td>`;
                html += `<td><select class="field selection" aria-label="${rowDef.label}">${optionHtml(opts, selected)}</select></td>`;
                html += `<td class="price">${item?money(item.price):'—'}</td>`;
                html += `<td class="unit">${item?escape(item.unit):'—'}</td>`;
                html += `<td>${timeHtml}</td>`;
                html += `<td>${qtyHtml}</td>`;
                html += `<td class="subtotal">${money(sub)}</td></tr>`;
            });

            html += `</tbody><tfoot><tr><td colspan="6">SUBTOTAL AMBIENTE ${env}</td><td id="${envPrefix}-subtotal">R$ 0,00</td></tr></tfoot></table></div></div>`;
        });
        return html;
    }

    function renderCloudlets() {
        const stdContent = document.querySelector('#cloudlets-standard-content');
        const premContent = document.querySelector('#cloudlets-premium-content');
        stdContent.innerHTML = buildCloudletsPanel('standard', 'Cloudlets Standard', 0, 22);
        premContent.innerHTML = buildCloudletsPanel('premium', 'Cloudlets Premium', 22, 38);
        bindCloudlets();
        calcCloudlets();
    }

    function bindCloudlets() {
        document.querySelectorAll('[data-cloud]').forEach(row => {
            const key = row.dataset.cloud;
            row.querySelector('.selection').onchange = e => {
                state[key + '-sel'] = e.target.value;
                persist();
                renderCloudlets();
            };
            row.querySelector('.time').oninput = e => {
                state[key + '-time'] = e.target.value;
                persist();
                calcCloudlets();
            };
            row.querySelector('.resource-count').oninput = e => {
                state[key + '-qty'] = e.target.value;
                persist();
                calcCloudlets();
            };
        });
    }

    function calcCloudlets() {
        let grandTotal = 0;
        ['standard', 'premium'].forEach(platformId => {
            let platformTotal = 0;
            ENV_LABELS.forEach((env, envIdx) => {
                const envPrefix = `c-${platformId}-${envIdx}`;
                let envSubtotal = 0;
                document.querySelectorAll(`[data-cloud^="${envPrefix}-"]`).forEach(row => {
                    const rowKey = row.dataset.cloud;
                    const def = cloudletsRowDefs.find(d => rowKey.endsWith('-' + d.id));
                    const opts = D.cloudlets.slice(
                        platformId === 'standard' ? 0 : 22,
                        platformId === 'standard' ? 22 : 38
                    ).filter(r => {
                        if (def.id === 'reserved') return r.name.startsWith('Cloudlet Reservado');
                        if (def.id === 'dynamic') return r.name.startsWith('Cloudlet Dinâmico');
                        if (def.id === 'disk') return r.name === 'Disco High Performance';
                        if (def.id === 'disk-std') return r.name.startsWith('Disco Standard Performance');
                        if (def.id === 'traffic') return r.name.startsWith('Trafego In/Out');
                        if (def.id === 'ip') return r.name.startsWith('IPV');
                        if (def.id === 'snapshot') return r.name.startsWith('Snapshots');
                        return false;
                    });
                    const item = find(opts, row.querySelector('.selection').value);
                    const itemPrice = item ? item.price : 0;
                    const s = itemPrice * num(row.querySelector('.time').value) * num(row.querySelector('.resource-count').value);

                    row.querySelector('.subtotal').textContent = money(s);
                    envSubtotal += s;
                });
                document.querySelector('#' + envPrefix + '-subtotal').textContent = money(envSubtotal);
                platformTotal += envSubtotal;
            });
            document.querySelector('#cloudlets-' + platformId + '-total').textContent = money(platformTotal);
            pulseCard(`cloudlets-${platformId}-total-card`);
            grandTotal += platformTotal;
        });
    }

    // ========== STORIN ==========
    const storinRows = [
        ['storage', 'ARMAZENAMENTO', D.storIn.slice(0, 4), 0, 'Espaço em disco utilizado no Object Storage (S3).'],
        ['out', 'TRÁFEGO DE SAÍDA', D.storIn.filter(x => x.name.startsWith('Trafego de Saída')), 0, 'Transferência de dados enviada para a internet.'],
        ['get', 'REQUISIÇÕES GET', D.storIn.filter(x => x.name.startsWith('Requisições GET')), 0, 'Cobrança a cada 1.000 chamadas de leitura (download).'],
        ['put', 'REQUISIÇÕES PUT', D.storIn.filter(x => x.name.startsWith('Requisições PUT')), 0, 'Cobrança a cada 1.000 chamadas de escrita (upload).'],
        ['in', 'TRÁFEGO DE ENTRADA', D.storIn.filter(x => x.name === 'Trafego de Entrada'), 0, 'Transferência de dados recebida (geralmente gratuita).'],
    ];

    function renderStorin() {
        const body = document.querySelector('#storin-body');
        body.innerHTML = storinRows.map(([id, label, opts, qtyDefault, tip]) => {
            const selected = get('s-' + id + '-sel', id === 'storage' ? opts[0].name : (opts[0] ? opts[0].name : ''));
            const item = find(opts, selected);
            const qty = get('s-' + id + '-qty', qtyDefault);
            const itemPrice = item ? item.price : 0;
            const sub = itemPrice * num(qty);

            const qtyHtml = makeQty('quantity', `Quantidade ${label}`, qty);
            const tipHtml = tip ? `<span class="tooltip-icon" data-tip="${tip}">?</span>` : '';

            return `<tr data-storin="${id}"><td><div class="cell-label">${label}${tipHtml}</div></td><td><select class="field selection" aria-label="${label}">${optionHtml(opts,selected)}</select></td><td class="price">${item?money(item.price):'—'}</td><td class="unit">${item?escape(item.unit):'—'}</td><td>${qtyHtml}</td><td class="subtotal">${money(sub)}</td></tr>`;
        }).join('');
        bindStorin();
        calcStorin();
    }

    function bindStorin() {
        document.querySelectorAll('[data-storin]').forEach(row => {
            const id = row.dataset.storin;
            row.querySelector('.selection').onchange = e => {
                state['s-' + id + '-sel'] = e.target.value;
                persist();
                renderStorin();
            };
            row.querySelector('.quantity').oninput = e => {
                state['s-' + id + '-qty'] = e.target.value;
                persist();
                calcStorin();
            };
        });
    }

    function calcStorin() {
        let total = 0;
        document.querySelectorAll('[data-storin]').forEach(row => {
            const [, , opts] = storinRows.find(x => x[0] === row.dataset.storin);
            const item = find(opts, row.querySelector('.selection').value);
            const itemPrice = item ? item.price : 0;
            const s = itemPrice * num(row.querySelector('.quantity').value);

            row.querySelector('.subtotal').textContent = money(s);
            total += s;
        });
        document.querySelector('#storin-total').textContent = money(total);
        document.querySelector('#storin-footer').textContent = money(total);
        pulseCard('storin-total-card');
    }

    // ========== TABS & PRINT ==========
    let activeTab = 'nuvion';
    document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => {
        document.querySelectorAll('.tab,.panel').forEach(x => x.classList.remove('active'));
        t.classList.add('active');
        document.querySelector('#' + t.dataset.target).classList.add('active');
        activeTab = t.dataset.target;
    }));

    document.querySelector('#printBtn').addEventListener('click', () => {
        document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
        document.querySelector('#' + activeTab).classList.add('active');
        window.print();
    });

    document.querySelector('#resetAll').addEventListener('click', () => {
        if (confirm('Deseja limpar todos os campos da calculadora?')) {
            state = {};
            persist();
            renderNuvion();
            renderCloudlets();
            renderStorin();
            showToast('Dados limpos com sucesso!');
        }
    });

    // ========== THEME & SHARE & CSV ==========
    const themeBtn = document.getElementById('themeToggle');
    const themeIcon = document.getElementById('themeIcon');
    if (themeBtn && themeIcon) {
        if (localStorage.getItem('theme') === 'dark') {
            document.body.setAttribute('data-theme', 'dark');
            themeIcon.textContent = 'light_mode';
        }
        themeBtn.addEventListener('click', () => {
            const isDark = document.body.getAttribute('data-theme') === 'dark';
            document.body.setAttribute('data-theme', isDark ? 'light' : 'dark');
            localStorage.setItem('theme', isDark ? 'light' : 'dark');
            themeIcon.textContent = isDark ? 'dark_mode' : 'light_mode';
        });
    }

    const shareLinkBtn = document.getElementById('shareLinkBtn');
    if (shareLinkBtn) {
        shareLinkBtn.addEventListener('click', () => {
            const base64State = btoa(JSON.stringify(state));
            const baseUrl = window.location.href.split('?')[0];
            const link = `${baseUrl}?q=${base64State}`;

            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(link).then(() => {
                    showToast('Link do orçamento copiado com sucesso.');
                }).catch(err => {
                    prompt('Copie o link abaixo:', link);
                });
            } else {
                prompt('Copie o link abaixo:', link);
            }
        });
    }
    // ========== INITIAL RENDER ==========
    renderNuvion();
    renderCloudlets();
    renderStorin();
})();