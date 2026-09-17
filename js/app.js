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

    // ========== NUVION (COM MÚLTIPLOS GRUPOS E NOMES CUSTOMIZADOS) ==========
    const nuvionRowTemplate = [
        { id: 'vm', label: 'TIER VM', opts: D.vm, defaultQty: 730, defaultMult: 1, tip: 'Perfil de processamento e RAM.' },
        { id: 'disk', label: 'DISCO', opts: D.resources.slice(0, 3), defaultQty: 0, defaultMult: 1, tip: 'Armazenamento principal atrelado à VM.' },
        { id: 'ip', label: 'IP FIXO', opts: D.resources.filter(x => x.name.startsWith('IPV')), defaultQty: 730, defaultMult: 1, tip: 'Endereço de IP público e estático.' },
        { id: 'extra', label: 'RECURSO EXTRA', opts: D.resources.filter(x => ['Gateway', 'VPN', 'Load Balancer Single', 'Load Balancer single + HA Failover'].includes(x.name)), defaultQty: 1, defaultMult: 1, tip: 'Recursos adicionais de rede.' },
        { id: 'traffic', label: 'TRÁFEGO', opts: D.resources.filter(x => x.name === 'Trafego In/Out'), defaultQty: 0, defaultMult: 1, tip: 'Franquia de tráfego de dados.' },
        { id: 'additionalDisk', label: 'DISCO ADICIONAL', opts: D.resources.slice(0, 3), defaultQty: 0, defaultMult: 1, tip: 'Armazenamento extra (Block Storage).' },
        { id: 'additionalIp', label: 'IP FIXO ADICIONAL', opts: D.resources.filter(x => x.name.startsWith('IPV')), defaultQty: 730, defaultMult: 1, tip: 'IPs públicos adicionais.' },
        { id: 'extra2', label: 'RECURSO EXTRA 2', opts: D.resources.filter(x => ['Gateway', 'VPN', 'Load Balancer Single', 'Load Balancer single + HA Failover'].includes(x.name)), defaultQty: 1, defaultMult: 1, tip: 'Mais recursos adicionais de rede.' },
        { id: 'backup', label: 'BACKUP', opts: D.resources.filter(x => x.name.startsWith('Backup ')), defaultQty: 0, defaultMult: 1, tip: 'Serviço de cópia de segurança.' },
        { id: 'snapshot', label: 'SNAPSHOT', opts: D.resources.filter(x => x.name.startsWith('Snapshot ')), defaultQty: 0, defaultMult: 1, tip: 'Imagem instantânea do disco.' }
    ];

    let nuvionGroupCount = 1;

    Object.keys(state).forEach(k => {
        const matchOldVm = k.match(/^n-vm-(\d+)-sel$/);
        if (matchOldVm) {
            nuvionGroupCount = Math.max(nuvionGroupCount, parseInt(matchOldVm[1]));
            state[`n-g${matchOldVm[1]}-vm-sel`] = state[k];
            delete state[k];
            if (state[`n-vm-${matchOldVm[1]}-qty`]) {
                state[`n-g${matchOldVm[1]}-vm-qty`] = state[`n-vm-${matchOldVm[1]}-qty`];
                delete state[`n-vm-${matchOldVm[1]}-qty`];
            }
        }
        const matchNew = k.match(/^n-g(\d+)-vm-sel$/);
        if (matchNew) nuvionGroupCount = Math.max(nuvionGroupCount, parseInt(matchNew[1]));
    });

    const oldBaseKeys = ['disk', 'ip', 'extra', 'traffic', 'additionalDisk', 'additionalIp', 'extra2', 'backup', 'snapshot'];
    oldBaseKeys.forEach(bk => {
        if (state[`n-${bk}-sel`] !== undefined) {
            state[`n-g1-${bk}-sel`] = state[`n-${bk}-sel`];
            delete state[`n-${bk}-sel`];
        }
        if (state[`n-${bk}-qty`] !== undefined) {
            state[`n-g1-${bk}-qty`] = state[`n-${bk}-qty`];
            delete state[`n-${bk}-qty`];
        }
        if (state[`n-${bk}-mult`] !== undefined) {
            state[`n-g1-${bk}-mult`] = state[`n-${bk}-mult`];
            delete state[`n-${bk}-mult`];
        }
    });

    function getNuvionRows() {
        let rows = [];
        for (let i = 1; i <= nuvionGroupCount; i++) {
            nuvionRowTemplate.forEach(tpl => {
                rows.push({
                    groupId: i,
                    rowId: `g${i}-${tpl.id}`,
                    isVmRow: tpl.id === 'vm',
                    ...tpl
                });
            });
        }
        return rows;
    }

    function renderNuvion() {
        const body = document.querySelector('#nuvion-body');
        const rows = getNuvionRows();
        let html = '';

        rows.forEach((row) => {
            const stateKey = `n-${row.rowId}`;
            const selected = get(`${stateKey}-sel`, '');
            const item = find(row.opts, selected);
            const qty = get(`${stateKey}-qty`, row.defaultQty);
            const mult = get(`${stateKey}-mult`, row.defaultMult);
            const itemPrice = item ? item.price : 0;
            const sub = itemPrice * num(qty) * num(mult);
            const tipHtml = row.tip ? `<span class="tooltip-icon no-print" data-tip="${row.tip}">?</span>` : '';

            const isFirstOfGroup = row.isVmRow;
            const deleteHtml = (isFirstOfGroup && row.groupId > 1) ? `<button type="button" class="icon-btn delete-vm no-print" data-groupid="${row.groupId}" title="Remover este grupo" style="padding:0; margin-left:8px; color:#ef4444;"><span class="material-symbols-outlined" style="font-size:18px;">delete</span></button>` : '';

            // Aqui está a mágica: Trocamos o badge fixo por um input editável!
            const customName = get(`n-g${row.groupId}-name`, `Grupo ${row.groupId}`);
            const groupBadge = isFirstOfGroup ? `<input type="text" class="field group-name" data-groupid="${row.groupId}" value="${escape(customName)}" placeholder="Nome do grupo..." style="margin-left:8px; width:130px; padding:2px 6px; font-size:11px; font-weight:bold; color:var(--blue2); background:transparent; border:1px dashed var(--input-border); min-width:unset; height:24px;">` : '';

            const qtyHtml = makeQty('quantity', `Quantidade ${row.label}`, qty);
            const multHtml = ['backup', 'snapshot'].includes(row.id) ? makeQty('multiplier', `Multiplicador ${row.label}`, mult) : `<span class="fixed-mult">1</span>`;

            const trStyle = (isFirstOfGroup && row.groupId > 1) ? `border-top: 3px solid var(--blue2);` : '';

            html += `<tr data-nuvion="${row.rowId}" style="${trStyle}">
                <td><div class="cell-label">${row.label}${groupBadge}${tipHtml}${deleteHtml}</div></td>
                <td>${row.isVmRow ? vmComboHtml(row, selected) : `<select class="field selection" aria-label="${row.label}">${optionHtml(row.opts, selected)}</select>`}</td>
                <td class="price">${item ? money(item.price) : '—'}</td>
                <td class="unit">${item ? escape(item.unit) : '—'}</td>
                <td>${qtyHtml}</td>
                <td>${multHtml}</td>
                <td class="subtotal">${money(sub)}</td>
            </tr>`;
        });

        body.innerHTML = html;
        bindNuvion();
        calcNuvion();
        bindVmCombos();
    }

    function bindNuvion() {
        document.querySelectorAll('[data-nuvion]').forEach(tr => {
            const key = `n-${tr.dataset.nuvion}`;
            tr.querySelector('.selection').onchange = e => {
                state[`${key}-sel`] = e.target.value;
                persist();
                renderNuvion();
            };
            tr.querySelector('.quantity').oninput = e => {
                state[`${key}-qty`] = e.target.value;
                persist();
                calcNuvion();
            };
            const m = tr.querySelector('.multiplier');
            if (m) m.oninput = e => {
                state[`${key}-mult`] = e.target.value;
                persist();
                calcNuvion();
            };
        });
        document.querySelectorAll('.group-name').forEach(input => {
            input.onchange = e => {
                state[`n-g${e.target.dataset.groupid}-name`] = e.target.value;
                persist();
            };
        });
    }

    function calcNuvion() {
        let total = 0;
        const rows = getNuvionRows();
        document.querySelectorAll('[data-nuvion]').forEach(tr => {
            const rowDef = rows.find(x => x.rowId === tr.dataset.nuvion);
            if (!rowDef) return;

            const i = find(rowDef.opts, tr.querySelector('.selection').value);
            const itemPrice = i ? i.price : 0;
            const multiplierInput = tr.querySelector('.multiplier');
            const multValue = multiplierInput ? multiplierInput.value : 1;

            const s = itemPrice * num(tr.querySelector('.quantity').value) * num(multValue);
            tr.querySelector('.subtotal').textContent = money(s);
            total += s;
        });
        document.querySelector('#nuvion-total').textContent = money(total);
        document.querySelector('#nuvion-footer').textContent = money(total);
        pulseCard('nuvion-total-card');
    }

    const addVmBtn = document.getElementById('addVmBtn');
    if (addVmBtn) {
        addVmBtn.addEventListener('click', () => {
            nuvionGroupCount++;
            renderNuvion();
        });
    }

    document.addEventListener('click', e => {
        const delBtn = e.target.closest('.delete-vm');
        if (delBtn) {
            const gid = parseInt(delBtn.dataset.groupid);
            for (let i = gid; i < nuvionGroupCount; i++) {
                // Sobe o nome
                if (state[`n-g${i+1}-name`] !== undefined) state[`n-g${i}-name`] = state[`n-g${i+1}-name`];
                else delete state[`n-g${i}-name`];
                nuvionRowTemplate.forEach(tpl => {
                    const currKey = `n-g${i}-${tpl.id}`;
                    const nextKey = `n-g${i+1}-${tpl.id}`;
                    if (state[`${nextKey}-sel`] !== undefined) state[`${currKey}-sel`] = state[`${nextKey}-sel`];
                    else delete state[`${currKey}-sel`];
                    if (state[`${nextKey}-qty`] !== undefined) state[`${currKey}-qty`] = state[`${nextKey}-qty`];
                    else delete state[`${currKey}-qty`];
                    if (state[`${nextKey}-mult`] !== undefined) state[`${currKey}-mult`] = state[`${nextKey}-mult`];
                    else delete state[`${currKey}-mult`];
                });
            }
            delete state[`n-g${nuvionGroupCount}-name`];
            nuvionRowTemplate.forEach(tpl => {
                delete state[`n-g${nuvionGroupCount}-${tpl.id}-sel`];
                delete state[`n-g${nuvionGroupCount}-${tpl.id}-qty`];
                delete state[`n-g${nuvionGroupCount}-${tpl.id}-mult`];
            });
            nuvionGroupCount--;
            persist();
            renderNuvion();
        }
    });

    // ========== SELETOR DE INSTÂNCIA (TIER VM) — COMBOBOX DESCRITIVO ==========
    function parseVmName(name) {
        const normalized = name.replace('+RAM', '');
        const parts = normalized.split('-');
        const vcpu = Number(parts[1]);
        const ramGb = Number(parts[2]);
        return {
            vcpu,
            ram: ramGb < 1 ? `${ramGb * 1024} MB` : `${ramGb} GB`,
            hasExtraRam: name.includes('+RAM')
        };
    }

    function vmOptionCardHtml(vm, isSelected) {
        const details = parseVmName(vm.name);
        const monthly = vm.price * 730;
        return `
            <button type="button" class="vm-option-card ${isSelected ? 'is-selected' : ''}" data-vm-name="${escape(vm.name)}">
                <span class="vm-option-name">${escape(vm.name.replace('+RAM', ''))}${details.hasExtraRam ? '<small>+RAM</small>' : ''}</span>
                <span>${details.vcpu}</span>
                <span>${details.ram}</span>
                <span>${money(vm.price)}</span>
                <span class="vm-option-monthly">${money(monthly)}/mês</span>
            </button>
        `;
    }

    function vmComboHtml(row, selected) {
        const item = find(row.opts, selected);
        const details = item ? parseVmName(item.name) : null;
        const label = item ? item.name.replace('+RAM', '') : 'Selecione...';
        const meta = details ? `<span class="vm-combo-meta">${details.vcpu} vCPU · ${details.ram}</span>` : '';

        return `
            <div class="vm-combo">
                <select class="field selection vm-native-select" aria-label="${row.label}">${optionHtml(row.opts, selected)}</select>
                <button type="button" class="vm-combo-trigger" aria-haspopup="listbox" aria-expanded="false">
                    <span class="vm-combo-trigger-text">
                        <span class="vm-combo-trigger-label">${escape(label)}</span>
                        ${meta}
                    </span>
                    <span class="material-symbols-outlined vm-combo-caret">expand_more</span>
                </button>
            </div>
        `;
    }

    let activeVmSelect = null;

    function openVmComboPanel(trigger, select) {
        const panel = document.getElementById('vmComboPanel');
        const list = document.getElementById('vmComboPanelList');
        if (!panel || !list || !D.vm) return;

        activeVmSelect = select;

        list.innerHTML = D.vm.map(vm => vmOptionCardHtml(vm, vm.name === select.value)).join('');

        list.querySelectorAll('.vm-option-card').forEach(card => {
            card.addEventListener('click', () => {
                if (!activeVmSelect) return;
                activeVmSelect.value = card.dataset.vmName;
                activeVmSelect.dispatchEvent(new Event('change', { bubbles: true }));
                closeVmComboPanel();
            });
        });

        const rect = trigger.getBoundingClientRect();
        const panelWidth = Math.max(rect.width, 480);
        let left = rect.left;
        if (left + panelWidth > window.innerWidth - 12) {
            left = window.innerWidth - panelWidth - 12;
        }
        left = Math.max(12, left);

        panel.style.width = panelWidth + 'px';
        panel.style.top = (rect.bottom + 6) + 'px';
        panel.style.left = left + 'px';
        panel.hidden = false;

        trigger.classList.add('open');
        trigger.setAttribute('aria-expanded', 'true');
    }

    function closeVmComboPanel() {
        const panel = document.getElementById('vmComboPanel');
        if (panel) panel.hidden = true;
        document.querySelectorAll('.vm-combo-trigger.open').forEach(t => {
            t.classList.remove('open');
            t.setAttribute('aria-expanded', 'false');
        });
        activeVmSelect = null;
    }

    function bindVmCombos() {
        document.querySelectorAll('.vm-combo').forEach(combo => {
            const trigger = combo.querySelector('.vm-combo-trigger');
            const select = combo.querySelector('.vm-native-select');
            if (!trigger || !select) return;

            trigger.addEventListener('click', (e) => {
                e.stopPropagation();
                const wasOpen = trigger.classList.contains('open');
                closeVmComboPanel();
                if (!wasOpen) openVmComboPanel(trigger, select);
            });
        });
    }

    document.addEventListener('click', (e) => {
        const panel = document.getElementById('vmComboPanel');
        if (panel && !panel.hidden && !panel.contains(e.target) && !e.target.closest('.vm-combo-trigger')) {
            closeVmComboPanel();
        }
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeVmComboPanel();
    });
    window.addEventListener('scroll', () => closeVmComboPanel(), true);
    window.addEventListener('resize', () => closeVmComboPanel());

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
                const tipHtml = rowDef.tip ? `<span class="tooltip-icon no-print" data-tip="${rowDef.tip}">?</span>` : '';

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
            const tipHtml = tip ? `<span class="tooltip-icon no-print" data-tip="${tip}">?</span>` : '';

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

    // ========== RESET MODAL ==========
    const confirmModal = document.getElementById('confirmModal');

    document.querySelector('#resetAll').addEventListener('click', () => {
        confirmModal.classList.add('show');
    });

    document.getElementById('cancelResetBtn').addEventListener('click', () => {
        confirmModal.classList.remove('show');
    });

    document.getElementById('confirmResetBtn').addEventListener('click', () => {
        state = {};
        persist();
        nuvionGroupCount = 1;
        renderNuvion();
        renderCloudlets();
        renderStorin();
        confirmModal.classList.remove('show');
        showToast('Dados limpos com sucesso!');
    });

    confirmModal.addEventListener('click', (e) => {
        if (e.target === confirmModal) {
            confirmModal.classList.remove('show');
        }
    });

    // ========== THEME & SHARE ==========
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