# Calculadora Save in Cloud — Aplicação Web Estática (v2)

Esta aplicação foi convertida a partir da planilha **Calculadora_SaveinCloud_Versao_Definitiva.xlsx**. Ela funciona integralmente no navegador: não requer banco de dados, PHP, Node.js, API ou configuração adicional no Apache.

## Novidades desta versão

1. **Abas separadas** para **Cloudlets Standard** e **Cloudlets Premium**
2. **4 ambientes simultâneos** em cada aba de Cloudlets (A, B, C, D) — subtotais por ambiente + total da plataforma
3. **Campo "Tempo de uso" bloqueado** para a linha **IP Fixo (IPv4/IPv6)** nas calculadoras Cloudlets
4. **Botão Imprimir/Salvar PDF** imprime **apenas a calculadora da aba ativa**
5. **Logotipo Save in Cloud** inserido no cabeçalho

## Conteúdo

- `index.html` — página principal da calculadora.
- `style.css` — layout responsivo, impressão/PDF por aba ativa.
- `app.js` — regras de cálculo, interface e persistência local.
- `data.js` — catálogo de recursos, unidades e preços, extraído da planilha definitiva.
- `logo.png` — logotipo Save in Cloud.
- `README.md` — este arquivo.

## Publicação em Apache

1. Extraia este pacote em seu computador.
2. Envie **todos os arquivos**, mantendo-os na mesma pasta, por FTP/SFTP/cPanel para o diretório público desejado. Exemplos:
   - domínio principal: `public_html/calculadora/`
   - subdomínio: diretório raiz configurado para o subdomínio.
3. Acesse: `https://seu-dominio.com/calculadora/`

O Apache entregará automaticamente o arquivo `index.html`. Não é necessário alterar `.htaccess`.

## Atualização de preços

Os valores atuais estão centralizados em `data.js`. Ao atualizar a tabela de preços, substitua esse arquivo por uma nova versão gerada a partir da planilha, ou edite as entradas de preço/unidade com cuidado.

## Comportamento da aplicação

- Cálculo em tempo real, conforme as fórmulas da planilha.
- Dados preenchidos ficam salvos somente no navegador do usuário (`localStorage`); não são enviados para o servidor.
- Botão de limpar dados e opção de imprimir/salvar como PDF (apenas aba ativa).
- Interface responsiva para desktop e dispositivos móveis.

## Observação comercial

A aplicação apresenta estimativas. Recomenda-se manter a mensagem de que valores estão sujeitos à validação comercial.
