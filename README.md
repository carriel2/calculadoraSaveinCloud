# ☁️ Calculadora de Estimativa — Save in Cloud (v2)

Esta aplicação web interativa foi convertida a partir da planilha **Calculadora_SaveinCloud_Versao_Definitiva.xlsx**. Ela funciona integralmente no lado do cliente (navegador): não requer banco de dados, PHP, Node.js, API ou configurações complexas no Apache.

## ✨ Novidades e Funcionalidades desta Versão

1. **Nova Arquitetura Modular:** CSS reestruturado e dividido em módulos para facilitar a manutenção e escalabilidade.
2. **Abas Separadas e Dinâmicas:** * **Nuvion:** Suporte a adição de múltiplos grupos dinâmicos de VMs.
   * **Cloudlets (Standard & Premium):** 4 ambientes simultâneos por aba (A, B, C, D) com subtotais por ambiente. O campo "Tempo de uso" foi inteligentemente bloqueado para a linha de *IP Fixo (IPv4/IPv6)*.
   * **Storin:** Abas exclusivas para simulação de Object Storage.
3. **Compartilhamento de Orçamento:** Geração de link exclusivo (codificado em Base64) que permite copiar e compartilhar o estado exato preenchido na calculadora.
4. **Exportação Profissional:**
   * **Imprimir / Salvar PDF:** Layout de impressão limpo focado apenas na aba ativa.
5. **Dark Mode & Tooltips:** Suporte nativo a Tema Escuro (salvo no navegador) e ícones de ajuda `[?]` integrados e explicativos para cada recurso.
6. **Notificações em Toast:** Alertas modernos flutuantes (substituindo os antigos `alerts` nativos do navegador).

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