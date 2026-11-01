# testes/ — Bateria do motor do NIT

Roda o `index.html` e o `nit.js` **reais** deste repositório num navegador simulado, com um Firebase falso em memória.
**Não acessa o Firebase de produção nem nenhum dado real.**

## Como rodar

Pré-requisito: [Node.js](https://nodejs.org) instalado (versão LTS).

```bash
cd testes
npm install      # só na primeira vez (baixa o jsdom)
npm test         # roda os cenários T01–T21
```

O resultado aparece na tela e é salvo em `testes/bateria-resultado.json`.

## Como ler o resultado

Cada cenário mostra `PASSOU`, `PARCIAL`, `FALHOU` ou `NÃO IMPLEMENTADO`, o que foi observado e a regra do contrato (`CONTRATO-ENTRADA-CEMOB.md`).

**Linha de base em 13/10/2026 (produção):**

```text
RESUMO { PASSOU: 8, PARCIAL: 3, FALHOU: 7, 'NÃO IMPLEMENTADO': 4 }
```

**NIT 13.1 (laboratório, 14/10/2026):** expectativas de T06, T07, T10b, T12 e T20 atualizadas para a regra "um semáforo, uma pendência" (BUSINESS-RULES BR-CON-010+).

```text
bateria.js          RESUMO { PASSOU: 14, FALHOU: 4, 'NÃO IMPLEMENTADO': 4 }
bateria-13-1.js     RESUMO 13.1 { PASSOU: 33 }
classificacao-13-1  RESUMO classificação { PASSOU: 35, FALHOU: 0 }
bateria-gravacao    RESUMO gravação { PASSOU: 7 }
bateria-causa       RESUMO causa { PASSOU: 4 }
```

**NIT 13.2 (laboratório, 17/10/2026):** mensagens do `MENSAGENS.md` (cards de decisão, ✓ PRONTO, salvamento). Expectativas de texto atualizadas; T08, T09, T13 e T14 passam a ser detectados (NIT-10/NIT-11).

```text
bateria.js          RESUMO { PASSOU: 18, 'NÃO IMPLEMENTADO': 4 }
bateria-13-1.js     RESUMO 13.1 { PASSOU: 33 }   (com NIT_RELATORIO_REAL)
classificacao-13-1  RESUMO classificação { PASSOU: 33, FALHOU: 0 }
bateria-gravacao    RESUMO gravação { PASSOU: 6 }
bateria-causa       RESUMO causa { PASSOU: 4 }
bateria-13-2        RESUMO 13.2 { PASSOU: 17 }   (um teste por mensagem do catálogo)
```

Rodar com o relatório real (opcional): `NIT_RELATORIO_REAL=/caminho/relatorio.txt node bateria-13-1.js`.

As falhas são **defeitos conhecidos do motor**, documentados no `HANDOFF.md` e no `TODO.md` — não são erros da bateria.

**Regra de uso:** antes de publicar uma mudança no `nit.js`, rode `npm test`.
- O resumo **igual ou melhor** que a linha de base → pode seguir.
- Algum cenário que **passava e passou a falhar** → a mudança quebrou algo. Não publique.

## Arquivos

| Arquivo | Função |
|---|---|
| `harness.js` | sobe o NIT simulado (navegador + Firebase falso + login de teste) |
| `bateria.js` | define e executa os cenários T01–T21 |
| `package.json` | fixa a versão do `jsdom` usada |
| `bateria-13-1.js` | regra 13.1 integrada: 33 cenários + invariantes (≤1 pendente, nenhuma pendência perdida, idempotência, conferência concorda) |
| `bateria-hora.js` | hora com erro de digitação (BR-CON-022), inclui o relatório real de 23/10 (446 "06.:50") |
| `gerar-mudancas.js` | roteiro manual das mudanças de 20/10 (colunas à mão, normalização manual provisória), conferido no NIT real: `node gerar-mudancas.js <saida> <aaaa-mm-dd>` |
| `bateria-causa.js` | causa sincronizada entre operadores, causa como a fonte escreveu, relatório de saída (`NIT_RELATORIOS_1610=pasta` para os relatórios reais) |
| `bateria-gravacao.js` | rede lenta, sem conexão, recusa do servidor, recuperação do último relatório (usa a simulação de rede do harness) |
| `bateria-13-2.js` | mensagens 13.2: texto exato de cada ID, botões, PERGUNTADO, DESFAZER, totais, dois operadores |
| `bateria-movel.js` | NIT Móvel: regras da lista do celular (dia, ordem, tempo, busca, "novo") |
| `bateria-movel-desvio.js` | NIT Móvel: só ADM no celular vai para `movel.html` (`subirNIT({ celular: true })`) |
| `movel-tela/rodar.js` | NIT Móvel na tela, navegador real com Firebase falso: `node movel-tela/rodar.js "$(npm root -g)" ..` (gera prints na pasta) |
| `classificacao-13-1.js` | só a classificação: decisão por linha, ordem invertida, relatório real |

Ao corrigir um defeito, atualize a linha de base acima.
