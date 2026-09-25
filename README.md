# ☁️ Calculadora de Estimativa — Save in Cloud (v6)

Esta aplicação web interativa foi convertida a partir da planilha **Calculadora_SaveinCloud_Versao_Definitiva.xlsx**. Ela funciona integralmente no lado do cliente (navegador): não requer banco de dados, PHP, Node.js, API ou configurações complexas no Apache.

## ✨ Novidades e Funcionalidades desta Versão

1. **Nova Arquitetura Modular:** CSS reestruturado e dividido em módulos para facilitar a manutenção e escalabilidade.
2. **Abas Separadas e Dinâmicas:**
   * **Nuvion:** Suporte a adição de múltiplos grupos dinâmicos de VMs.
   * **Cloudlets (Standard & Premium):** 4 ambientes simultâneos por aba (A, B, C, D) com subtotais por ambiente. O campo "Tempo de uso" foi inteligentemente bloqueado para a linha de *IP Fixo (IPv4/IPv6)*.
   * **Storin:** Abas exclusivas para simulação de Object Storage.
3. **Compartilhamento de Orçamento:** Geração de link exclusivo (codificado em Base64) que permite copiar e compartilhar o estado exato preenchido na calculadora.
4. **Exportação Profissional:**
   * **Imprimir / Salvar PDF:** Layout de impressão limpo focado apenas na aba ativa.
5. **Dark Mode & Tooltips:** Suporte nativo a Tema Escuro (salvo no navegador) e ícones de ajuda `[?]` integrados e explicativos para cada recurso.
6. **Notificações em Toast:** Alertas modernos flutuantes (substituindo os antigos `alerts` nativos do navegador).

## 🎨 Melhorias de Interface (Atualização)

Ajustes de usabilidade e consistência visual aplicados às tabelas de recursos (Nuvion, Cloudlets Standard/Premium e Storin):

1. **Padronização dos Tiers de VM:** os selects de "TIER VM" agora exibem o nome no formato `SKU · vCPU · RAM` (ex.: `ST-1-2 · 1 vCPU · 2 GB RAM`), mantendo o identificador técnico como valor interno do select — sem impacto nos cálculos de preço.
2. **Rótulos mais limpos:** removido o texto de detalhe duplicado que aparecia abaixo de cada select (vCPU/RAM, nome completo do recurso), deixando cada linha da tabela mais compacta.
3. **Grupos de VM reorganizados:** o nome de cada grupo (ex.: "Grupo 1") agora ocupa sua própria linha de cabeçalho na tabela, com campo de nome editável e botão de exclusão do grupo — sem mais competir por espaço com a coluna "TIER VM".
4. **Tabelas sem scrollbar horizontal:** revisão completa da largura das colunas (Recurso, Seleção, Preço, Unidade, Quantidade, Multiplicador e Subtotal) para as tabelas do Nuvion, Cloudlets e Storin, eliminando a barra de rolagem lateral inferior.
5. **Layout responsivo (mobile):** em telas menores, cada linha da tabela é reorganizada automaticamente em formato de card, preservando a legibilidade sem necessidade de rolagem horizontal.
6. **Impressão/PDF ajustada:** correções no layout de impressão para exibir a tabela em formato tradicional (sem quebrar em cards) e evitar corte de valores nas colunas de preço e subtotal.

## 📂 Estrutura de Pastas e Conteúdo

A aplicação utiliza o padrão de separação de responsabilidades. Mantenha esta estrutura intacta:

```text
/
├── css/                  # Módulos de estilização
│   ├── base.css          # (Opcional) Resets e tipografia
│   ├── components.css    # Botões, inputs, tooltips, toast, tabelas
│   ├── layout.css        # Estrutura geral, container, topbar
│   ├── print.css         # Regras exclusivas para geração de PDF
│   ├── themes.css        # Variáveis de cor (Light e Dark mode)
│   └── style.css         # Arquivo mestre que importa todos os módulos acima
├── app.js                # Regras de cálculo, interface e persistência local
├── data.js               # Catálogo de recursos, unidades e preços extraído da planilha
├── logo.png              # Logotipo da Save in Cloud
├── index.html            # Página principal
└── README.md             # Este arquivo
