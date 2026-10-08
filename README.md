# ☁️ Gerador de Propostas — Save in Cloud

Monta propostas comerciais no padrão Save in Cloud com a calculadora de estimativa embutida
(mesmas linhas, padrões e fórmulas da versão anterior) e entrega um documento **editável no navegador**
(folhas A4), exportado em PDF pela impressão do navegador. Funciona inteiramente no lado do cliente:
não requer banco de dados, backend, API ou IA.

## ✨ Funcionalidades

1. **Página única:**
   * **Dados do cliente:** cliente, contato, data, validade, prazo do contrato, responsável, foco da solução,
     escopo e considerações.
   * **Produtos da proposta:** começa vazio; use **+ Adicionar Nuvion** (grupo de VM),
     **+ Adicionar Cloudlets Standard/Premium** (ambiente) e **+ Adicionar Storin**. Cada bloco tem a tabela
     da calculadora, nome editável (vira o título da tabela na proposta), subtotal e botões de duplicar/remover.
   * **Resumo:** total por produto, total mensal e total do contrato (total mensal × prazo).
2. **Documento editável:** "Gerar proposta" monta Objetivo, Solução proposta, Escopo, Investimento (uma tabela
   por bloco), Resumo, Considerações e Próximos passos. Tudo pode ser editado no navegador, com barra de formatação.
3. **PDF:** "Baixar PDF" abre a impressão (Salvar como PDF; desative cabeçalhos/rodapés e mantenha gráficos de fundo).
4. **Salvar / Abrir:** rascunho automático no navegador e arquivo `.json` com a proposta (inclui as edições do texto).
5. **Importar calculadora:** aceita links `?q=` no formato do botão "Link" da calculadora anterior.
6. **Dark Mode, tooltips `[?]` e toasts**, como na calculadora.

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
├── assets/logo.png       # Logotipo da Save in Cloud
├── index.html            # Página principal
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
