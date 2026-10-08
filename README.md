# ☁️ Gerador de Propostas — SaveInCloud

Monta propostas comerciais no padrão SaveInCloud com a calculadora de estimativa embutida
(mesmas linhas, padrões e fórmulas da versão anterior) e entrega um documento **editável no navegador**
(folhas A4), exportado em PDF pela impressão do navegador. Funciona inteiramente no lado do cliente:
não requer banco de dados, backend, API ou IA.

## ✨ Funcionalidades

1. **Página única:**
   * **Dados do cliente:** cliente, contato, data, validade, responsável, foco da solução,
     escopo e considerações.
   * **Produtos da proposta:** começa vazio; use **+ Adicionar Nuvion** (grupo de VM),
     **+ Adicionar Cloudlets Standard/Premium** (ambiente) e **+ Adicionar Storin**. Cada bloco tem a tabela
     da calculadora, nome editável (vira o título da tabela na proposta), subtotal e botões de duplicar/remover.
   * **Resumo:** total por produto, total mensal e prazo do contrato (padrão **1 mês**, com botões +/− para
     mais meses); total do contrato = total mensal × prazo.
2. **Documento editável no papel timbrado:** "Gerar proposta" monta Objetivo, Solução proposta, Escopo, Investimento (uma tabela
   por bloco), Resumo, Considerações e Próximos passos sobre o papel timbrado da SaveInCloud (`assets/papel-timbrado.png`), distribuídos automaticamente pelas folhas A4 sem invadir cabeçalho e rodapé. Tudo pode ser editado no navegador; "Reorganizar páginas" redistribui o conteúdo após edições.
3. **PDF:** "Baixar PDF" abre a impressão (Salvar como PDF; desative cabeçalhos/rodapés e mantenha gráficos de fundo).
4. **Salvar / Abrir:** rascunho automático no navegador e arquivo `.json` com a proposta (inclui as edições do texto).
5. **Importar calculadora:** aceita links `?q=` no formato do botão "Link" da calculadora anterior.
6. **Dark Mode, tooltips `[?]` e toasts**, como na calculadora.
7. **Calculadora avulsa em `/calculadora/`:** a calculadora original (abas Nuvion, Cloudlets e Storin), acessível
   pelo menu do topo. Usa os mesmos preços (`js/data.js`) e tem o botão **Levar para proposta**, que abre o
   gerador já com a estimativa.

## 📂 Estrutura

```text
/
├── css/
│   ├── calc.css          # Estilos da calculadora (temas, layout, componentes)
│   └── proposal.css      # Dados do cliente, blocos, resumo, editor e documento A4/impressão
├── js/
│   ├── data.js           # Catálogo de recursos, unidades e preços (fonte única dos preços)
│   ├── calc.js           # Calculadora em blocos (Nuvion, Cloudlets, Storin)
│   └── app.js            # Dados da proposta, documento, editor, salvar/abrir/importar
├── assets/logo.png       # Logotipo da SaveInCloud
├── index.html            # Gerador de propostas (página principal)
├── calculadora/          # Calculadora avulsa (/calculadora/): index.html, css/ e js/app.js próprios
├── css/nav.css           # Menu do topo compartilhado entre as duas páginas
├── k8s/                  # Deployment, Service e Ingress (namespace laboratorio)
├── .github/workflows/    # CI/CD: build da imagem no GHCR + deploy no Kubernetes
├── Dockerfile, Caddyfile, docker-compose.yaml
└── README.md
```

### Atualizar preços

Edite `js/data.js` — o formato é o mesmo da calculadora.

## Rodar localmente

```bash
docker compose up --build
```
