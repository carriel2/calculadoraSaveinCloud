#!/usr/bin/env python3
"""
Atualiza os preços de Nuvion e Storin em js/data.js a partir do site da SaveInCloud.

- Só mexe nas chaves "vm", "resources" e "storIn". "cloudlets" fica intocado.
- Mantém nomes e ordem que o calc.js/app.js esperam (slice(0, 3), filtros por nome etc.).
- Se qualquer preço esperado não for encontrado, aborta com erro e NÃO grava nada.

Uso:
    python update_prices.py js/data.js            # atualiza o arquivo
    python update_prices.py js/data.js --dry-run  # só mostra as diferenças
Saída: código 0 = sem mudanças, 10 = arquivo alterado, 1 = erro.
"""
import argparse
import html
import json
import re
import sys
import urllib.request

BASE = "https://saveincloud.com/pt-BR/precos-nuvem/"
PAGES = {
    "vm": "nuvion",
    "disk": "volume-block-storage",
    "net": "redes",
    "backup": "backups-snapshots",
    "storin": "storin-object-storage",
}
HOURS_PER_MONTH = 730  # mesma base usada pelo site
PREFIX = "window.CALCULATOR_DATA = "
MONEY = r"R\$\s*([\d.]+(?:,\d+)?)"


class ScrapeError(Exception):
    pass


def fetch_text(slug):
    req = urllib.request.Request(BASE + slug, headers={"User-Agent": "calculadora-saveincloud-price-sync/1.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        raw = r.read().decode("utf-8")
    raw = re.sub(r"<(script|style)[^>]*>.*?</\1>", "", raw, flags=re.S)
    text = html.unescape(re.sub(r"<[^>]+>", "|", raw))
    text = re.sub(r"\s+", " ", text)
    return re.sub(r"(\s*\|\s*)+", " | ", text)


def brl(s):
    return float(s.replace(".", "").replace(",", "."))


def find(text, pattern, what):
    m = re.search(pattern, text, flags=re.I)
    if not m:
        raise ScrapeError(f"preço não encontrado: {what}")
    return brl(m.group(1))


def section(text, start, end):
    i = text.find(start)
    j = text.find(end, i + len(start)) if i >= 0 else -1
    if i < 0 or j < 0:
        raise ScrapeError(f"seção não encontrada: {start!r} .. {end!r}")
    return text[i:j]


def scrape_vms(text):
    # "PRI-4-32 | +RAM | 4 | 32 GB | R$ 0,95 | R$ 693,50/mês" -> ("PRI-4-32+RAM", 0.95, 693.50)
    row = re.compile(r"\b((?:ST|PRI|HC)-\d+-[\d.]+) \| (\+RAM \| )?\d+ \| [\d.,]+ [MG]B \| " + MONEY + r" \| " + MONEY + r"/mês")
    vms, seen = [], set()
    for name, ram, hourly, monthly in row.findall(text):
        name += "+RAM" if ram else ""
        if name in seen:
            continue
        seen.add(name)
        # O site exibe o R$/hora arredondado em 3 casas; o R$/mês (hora × 730) é o valor preciso.
        price = round(brl(monthly) / HOURS_PER_MONTH, 6)
        if abs(price - brl(hourly)) > 0.001:
            raise ScrapeError(f"{name}: R$/mês ({monthly}) não corresponde ao R$/hora ({hourly})")
        vms.append({"name": name, "price": price, "unit": "por hora"})
    if len(vms) < 10:
        raise ScrapeError(f"poucas VMs encontradas ({len(vms)}), layout do site mudou?")
    return vms


def scrape_resources(disk, net, backup):
    redes = section(net, "Redes Nuvion | Tráfego", "Redes Cloudlets | Tráfego")
    snap = section(backup, "Os Snapshots dos volumes Nuvion", "Os Snapshots do Cloudlets")
    p = {
        "Volume Block Storage SSD Standard": find(disk, r"SSD Standard \| [^|]+ \| [^|]+ \| " + MONEY, "volume SSD"),
        "Volume Block Storage NVMe Balanceado": find(disk, r"NVMe Balanceado \| [^|]+ \| [^|]+ \| " + MONEY, "volume NVMe Bal"),
        "Volume Block Storage NVMe High Performance": find(disk, r"NVMe High Performance \| [^|]+ \| [^|]+ \| " + MONEY, "volume NVMe HP"),
        "Trafego In/Out": find(redes, MONEY + r"/Gb/mês \| Tráfego Saída", "tráfego"),
        "IPV4 Alocado": round(find(redes, MONEY + r"/mês \| por IPv4", "IPv4") / HOURS_PER_MONTH, 5),
        "IPV6 Alocado": round(find(redes, MONEY + r"/mês \| por IPv6", "IPv6") / HOURS_PER_MONTH, 5),
        "Gateway": find(redes, MONEY + r"/mês \| por gateway", "gateway"),
        "VPN": find(redes, MONEY + r"/mês \| por VPN", "VPN"),
        "Load Balancer Single": find(redes, MONEY + r"/mês \| por Single", "LB single"),
        "Load Balancer single + HA Failover": find(redes, MONEY + r"/mês \| por HA FAILOVER", "LB HA"),
        "Snapshot Block Storage SSD Standard": find(snap, r"SSD Standard \| " + MONEY, "snapshot SSD"),
        "Snapshot Block Storage NVMe Balanceado": find(snap, r"NVMe Balanceado \| " + MONEY, "snapshot NVMe Bal"),
        "Snapshot Block Storage NVMe High Performance": find(snap, r"NVMe High Performance \| " + MONEY, "snapshot NVMe HP"),
    }
    # O site informa um preço único de backup Nuvion "para todos os tipos de volumes"
    bkp = find(backup, r"custo dos backups é " + MONEY, "backup Nuvion")
    for t in ("SSD Standard", "NVMe Balanceado", "NVMe High Performance"):
        p[f"Backup Block Storage {t}"] = bkp
    return p


def scrape_storin(text):
    # O site só publica o preço da primeira faixa de disco; as demais faixas ficam como estão.
    out = find(text, MONEY + r"/GiB/Mês \| Tráfego Saída", "Storin tráfego de saída")
    req = find(text, MONEY + r" \| A cada 1000 requisições", "Storin requisições")
    return {
        "Disco usado até 500G": find(text, MONEY + r"/GiB/Mês \| Por mês de disco", "Storin disco"),
        "Trafego de Entrada": 0.0 if re.search(r"entrada sempre gratuito", text, re.I) else None,
        "Trafego de Saída acima de 1Tb não cumulativo": out,
        "Requisições GET acima de 20 mil requisições/mês não cumulativo": req,
        "Requisições PUT acima de 5 mil requisições/mês não cumulativo": req,
    }


def apply(items, prices, label, changes):
    names = {i["name"] for i in items}
    missing = [n for n in prices if n not in names]
    if missing:
        raise ScrapeError(f"{label}: itens do scraper sem correspondência no data.js: {missing}")
    for item in items:
        new = prices.get(item["name"])
        if new is not None and new != item["price"]:
            changes.append(f"{label}: {item['name']}: {item['price']} -> {new}")
            item["price"] = new


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("data_js")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    src = open(args.data_js, encoding="utf-8").read().strip()
    if not src.startswith(PREFIX):
        raise ScrapeError("data.js não começa com window.CALCULATOR_DATA")
    data = json.loads(src[len(PREFIX):].rstrip(";"))

    t = {k: fetch_text(slug) for k, slug in PAGES.items()}
    changes = []

    old_vms = {v["name"]: v["price"] for v in data["vm"]}
    new_vms = scrape_vms(t["vm"])
    for v in new_vms:
        if v["name"] not in old_vms:
            changes.append(f"vm: NOVA {v['name']} = {v['price']}")
        elif old_vms[v["name"]] != v["price"]:
            changes.append(f"vm: {v['name']}: {old_vms[v['name']]} -> {v['price']}")
    for n in old_vms.keys() - {v["name"] for v in new_vms}:
        changes.append(f"vm: REMOVIDA {n}")
    data["vm"] = new_vms

    apply(data["resources"], scrape_resources(t["disk"], t["net"], t["backup"]), "resources", changes)
    apply(data["storIn"], scrape_storin(t["storin"]), "storIn", changes)

    for c in changes:
        print(c)
    if not changes:
        print("Nenhuma mudança de preço.")
        return 0
    if not args.dry_run:
        with open(args.data_js, "w", encoding="utf-8") as f:
            f.write(PREFIX + json.dumps(data, ensure_ascii=False) + ";\n")
        print(f"{args.data_js} atualizado ({len(changes)} mudanças).")
    return 10


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (ScrapeError, OSError, ValueError, KeyError) as e:
        print(f"ERRO: {e}", file=sys.stderr)
        sys.exit(1)
