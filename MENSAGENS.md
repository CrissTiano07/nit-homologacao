# MENSAGENS DO NIT 13 — Catálogo

Estado: **validado pelo Cristiano em 17/10/2026**, a implementar na 13.2 em laboratório.
Princípio: o que o NIT permite (continuar trabalhando) fica implícito; o texto diz só o que NÃO fazer.
Cada ID terá um teste que confere o texto exato. Texto novo só entra aqui primeiro.

## 1. Gramática

1. **Título:** semáforo + o que aconteceu. Até 4 palavras. MAIÚSCULAS.
2. **Linha 2:** o fato que o NIT viu, com hora. Sem opinião.
3. **Botões:** um verbo. No máximo 2 (+ 📋 PERGUNTAR quando houver).
4. **Cor + ícone + palavra** sempre juntos (daltonismo).

| Cor | Ícone | Significa | Quem age |
|---|---|---|---|
| Verde | ✓ | Deu certo | Ninguém |
| Azul | ℹ | Só para saber | Ninguém |
| Âmbar | ⚠ | Você decide | Operador |
| Vermelho | ❌ | Não salvou | Suporte / gestor |

5. **Palavras proibidas → usar:** divergência/inconsistência → *não bate*; persistência/sincronizar → *salvar*;
   servidor/Firebase → *internet / sistema*; registro → *semáforo / ocorrência*; validar → *conferir*; parsing → *não entendi o texto*.
6. **Perguntas à fonte:** nunca começam com "CEMOB" (implícito). Uma por linha.
7. **Teste dos 5 segundos:** um colega lê e diz o que vai fazer. Hesitou → reescrever.

## 2. Relatório

| ID | Quando | Texto |
|---|---|---|
| NIT-01 ✓ | Processou, conferência ok, nada **novo** a decidir | **✓ PRONTO** · {p} pendentes · {n} normalizados |
| NIT-02 ⚠ | Relatório de outro dia | **⚠ ESTE RELATÓRIO É DE {data}.** Hoje é {hoje}. [USAR] [CANCELAR] |
| NIT-03 ❌ | Nenhum semáforo encontrado no texto | **❌ NÃO ENTENDI O TEXTO.** Cole o relatório inteiro do WhatsApp. |
| NIT-04 ℹ | Reincidência | **ℹ {cod} APAGOU DE NOVO.** {k}ª vez hoje. |
| NIT-05 ℹ | Retificação de horário | Etiqueta no card: **⟲ início corrigido {antes} → {depois}** |
| NIT-05b ℹ | Fonte corrigiu o fim de ocorrência já normalizada | Etiqueta no card: **⟲ fim corrigido {antes} → {depois}** |
| NIT-06 ⚠ | Processou e o relatório trouxe decisão **nova** | **RELATÓRIO ALTERADO!** {k} semáforo(s) precisam de você |
| NIT-07 ℹ | Relatório novo resolveu uma pendência de decisão | **ℹ {cod} RESOLVIDO.** (card de decisão some sozinho) |

## 3. Decisões (card âmbar no topo; fica até ser resolvido)

📋 **PERGUNTAR** = copia a pergunta **e** muda o card para translúcido **⏳ PERGUNTADO {hh:mm}**.
Clicar de novo copia de novo (cobrar). Com várias, copia todas, uma por linha.
O card só some quando o relatório corrigido resolve (NIT-07) ou pela decisão do operador.

| ID | Título | Linha 2 | Botões | Pergunta copiada |
|---|---|---|---|---|
| NIT-10 | **⚠ {cod} NÃO VEIO NO RELATÓRIO** | Pendente desde {ini}. Sumiu no relatório das {h}. | [MANTER] [TIRAR] · 📋 | O {cod} (pendente desde {ini}) não veio no relatório das {h}. Normalizou? |
| NIT-11 | **⚠ {cod} VOLTOU PARA PENDENTE** | Normalizou às {fim}. Agora veio pendente. | [REABRIR] [MANTER NORMALIZADO] · 📋 | O {cod} normalizou às {fim} e voltou como pendente. Apagou de novo? |
| NIT-12 | **⚠ {cod} VEIO 2 VEZES** | Pendente às {h1} e às {h2}. | [📋 PERGUNTAR] | O {cod} veio 2 vezes como pendente ({h1} e {h2}). Qual vale? |
| NIT-13 | **⚠ {cod} HORÁRIO NÃO FECHA** | Início {ini}, fim {fim}. | [📋 PERGUNTAR] | O {cod} diz início {ini} e fim {fim}. Qual é o certo? |
| NIT-14 | **⚠ {cod} SEM HORA DE INÍCIO** | Veio sem a hora que começou. | [📋 PERGUNTAR] | O {cod} veio sem hora de início. Que horas começou? |
| NIT-16 | **⚠ {cod} TEM 2 CARDS** | Um de {h1} e outro de {h2}. | [TIRAR O DE {h1}] [MANTER] | — (não é erro da fonte) |

NIT-15 ("FIM SUMIU") foi unido ao NIT-11: para o motor é o mesmo fato (o normalizado voltou sem fim).

## 4. Depois do clique

| ID | Texto |
|---|---|
| NIT-20 ✓ | **✓ {cod} SAIU DO PAINEL.** Agora: {p} pendentes · {n} normalizados [DESFAZER] |
| NIT-21 ✓ | **↩ DESFEITO. {cod} VOLTOU.** Agora: {p} pendentes · {n} normalizados |
| NIT-22 ⚠ | Linha fixa no topo: **⚠ {k} SEMÁFORO(S) ESPERAM SUA RESPOSTA** |

(NIT-20 vale para MANTER/TIRAR/REABRIR com o verbo correspondente: SAIU / FICOU / REABRIU.)

## 4b. Acréscimos da implementação (17/10/2026 — a validar)

| ID | Quando | Texto |
|---|---|---|
| NIT-10 (normalizado) | Card **normalizado** que o relatório não traz | **⚠ {cod} NÃO VEIO NO RELATÓRIO** · Normalizou às {fim}. Sumiu no relatório das {h}. · 📋 *O {cod} (normalizado às {fim}) não veio no relatório das {h}. Ainda vale?* |
| NIT-16 TIRAR | Confirmação | **✓ {cod} DE {h1} SAIU DO PAINEL.** Agora: … |
| NIT-11 MANTER | Confirmação | **✓ {cod} FICOU NORMALIZADO.** Agora: … |
| Topo | 2 ou mais perguntas | Botão **📋 PERGUNTAR TODAS** |
| Topo | Sempre que há cards | **▲ RECOLHER** / **▼ MOSTRAR ({n})** (abre sozinho quando chega decisão nova) |
| NIT-11 | Semáforo já tem outra pendência | sem o botão REABRIR (um semáforo, uma pendência) |
| Linha | Perguntas já feitas (NIT-12/13/14) | viram etiquetas compactas em **⏳ ESPERANDO A FONTE** |
| NIT-02 | Relatório sem data | **⚠ ESTE RELATÓRIO NÃO TEM DATA.** Hoje é {hoje}. |
| NIT-33 | Vários semáforos / sem semáforo | **❌ 9902 e 9903 NÃO SALVARAM.** · **❌ ALTERAÇÃO NÃO SALVOU.** Avise {suporte}. |
| NIT-35 ❌ | Linha que o motor não aplicou (não deveria acontecer) | **❌ {cod} NÃO ENTROU NO PAINEL.** Processe de novo. Se repetir, avise {suporte}. |

Regras de exibição:
- "RELATÓRIO ALTERADO!" só quando o relatório trouxe decisão nova. Decisão antiga sem resposta → linha NIT-22 + ✓ PRONTO.
- ⏳ PERGUNTADO não conta como "esperando sua resposta" (espera a fonte).
- MANTER do NIT-10 vale enquanto o semáforo estiver fora do relatório; se voltar e sumir de novo, pergunta outra vez.
- Card retirado (TIRAR) que a fonte volta a listar volta ao painel: o mesmo card, com equipe e histórico.
- Retirar nunca apaga: o card fica no banco com a marca `retirado`; DESFAZER devolve.

## 5. Salvamento (canto da tela, sempre visível)

| ID | Situação | Texto |
|---|---|---|
| NIT-30 ✓ | Tudo gravado | **✓ SALVO** |
| NIT-31 ⚠ | Demorando | **⏳ ENVIANDO… Não feche a aba.** |
| NIT-32 ⚠ | Sem internet | **📵 SEM INTERNET. Não feche a aba.** |
| NIT-33 ❌ | Sistema recusou (falha técnica) | **❌ {cod} NÃO SALVOU. Avise {suporte}.** |
| NIT-34 ❌ | Recusa por permissão (`PERMISSION_DENIED`) | **❌ SEU LOGIN NÃO TEM ACESSO. Fale com o gestor.** |

- `{suporte}` = contato configurável (padrão: "o desenvolvedor do NIT"); na 13.3 o gestor edita na página de usuários.
- Fechar a aba com algo pendente: aviso padrão do navegador (texto não personalizável); NIT-31/32 avisam antes.

## 6. Removido

- Botão "Recuperar último relatório" (o relatório está no WhatsApp).
- "2 ABERTAS NO RELATÓRIO" → NIT-12. "Conferir no relatório" → cards de decisão. Toast duplicado.
- Botão "AVISEI" → 📋 PERGUNTAR (ação real + estado ⏳ PERGUNTADO).

## 7. Fora deste catálogo (próxima etapa)

Aparência: cores, translucidez, estilo console (missão ativa acesa / em andamento esmaecida).

## 4c. Lote da homologação de 19/10/2026 (aprovado)

| ID | Antes | Agora |
|---|---|---|
| NIT-10 (estava pendente) | [MANTER] [TIRAR] | **[PENDENTE] [NORMALIZOU] [EXCLUIR]** · 📋 — NORMALIZOU abre a janela de normalizar (fim informado pelo operador) |
| NIT-10 (estava normalizado) | [MANTER] [TIRAR] | **[NORMALIZADO] [EXCLUIR]** · 📋 |
| NIT-20 | SAIU / FICOU NO PAINEL | **✓ {cod} EXCLUÍDO DO PAINEL.** · **✓ {cod} CONTINUA PENDENTE.** · **✓ {cod} CONTINUA NORMALIZADO.** · **✓ {cod} NORMALIZADO ÀS {hh:mm}.** |
| NIT-21 (relatório já mudou o card) | — | **ℹ {cod} JÁ FOI ATUALIZADO PELO RELATÓRIO. Nada a desfazer.** |
| NIT-11 | ⚠ VOLTOU PARA PENDENTE | **⚠ {cod} VOLTOU ATRÁS** · Mesma ocorrência (início {ini}). Normalizou às {fim} e agora veio de novo como pendente. Não é uma nova falha. |
| NIT-11 sem REABRIR | (botão sumia) | linha extra: **Já existe outra pendência do {cod}, a das {h}. Por isso não dá para reabrir esta.** · 📋 *O {cod} aparece pendente às {ini} e às {h}. A das {ini} não normalizou às {fim}?* |
| NIT-12 | ⚠ âmbar, conta | **ℹ azul, não conta** · Pendente às {h1} e às {h2}. Nada a fazer: o NIT ficou com {h1}. Some quando a fonte corrigir. · 📋 *O {cod} aparece 2 vezes como pendente ({h1} e {h2}). O início certo é {h1} ou {h2}?* |
| NIT-16 | TIRAR O DE / MANTER | **EXCLUIR O DE {h}** / **MANTER OS 2** |
| Ver Relatório | — | lembrete na tela (relatório intacto): **⚠ {cods} AINDA ESPERA(M) A RESPOSTA DA FONTE.** O relatório pode sair diferente do da fonte. [GERAR ASSIM MESMO] [ESPERAR] |
| 📜 LINHA DO TEMPO | — | botão no topo; diário do dia: processamentos (novos, normalizaram, apagaram de novo, início/fim corrigido pela fonte, voltaram ao painel, erros da fonte, resolvidos) e decisões do operador |

## 4d. Mudanças de 20/10/2026 (132homolog7)

| ID | Quando | Texto |
|---|---|---|
| NIT-17 ℹ | Operador normalizou à mão e a fonte ainda diz pendente | **ℹ {cod} NORMALIZADO À MÃO** · Você normalizou às {fim}. A fonte ainda diz pendente. Nada a fazer: quando a fonte mandar o fim, vale o horário dela. [REABRIR] — azul, não conta |
| Etiqueta | Card normalizado à mão, até a fonte mandar o fim | **✋ normalizado à mão · aguardando a fonte** |
| Colunas | — | Nada recolhe sozinho. Clique no título recolhe/expande (AGUARDANDO, VIA LIVRE, AMC, SEM NECESSIDADE, ⚠ DECIDIR); recolhida mostra ▸, o número e o nome no alto. Quando a ⚠ DECIDIR aparece, as outras deslizam (largura mínima 230px, rolagem lateral). A escolha vale na tela de cada operador, até recarregar. Exceção: a ⚠ DECIDIR abre sozinha quando chega decisão nova. |

## 4e. 13.2.1 — hora com erro de digitação (23/10/2026)

| ID | Quando | Texto |
|---|---|---|
| (sem aviso) | Hora com erro claro ("06.:50", "06.50", "06h50", "6:50", "06;;50") | Nada na tela. O card e o relatório de saída mostram 06:50. No 📜 LINHA DO TEMPO: **ℹ Hora lida com correção: 446 (início "06.:50" → 06:50)** |
| (sem aviso) | Código sem o zero ("17") | O card é o 017. No 📜: **ℹ Código lido com correção: "17" → 017** |
| (regra do 📜) | A fonte repete o mesmo erro em todo relatório | "Hora/Código lido com correção" aparece **só na 1ª vez** do dia (em cada computador) |
| NIT-14 (variante) | Tem data mas a hora não dá para ler com segurança ("06.:5", "65:30", "0650") | **⚠ {cod} HORA DE INÍCIO ILEGÍVEL** · Veio "{o que veio}". · 📋 *O {cod} veio com a hora de início "{o que veio}". Que horas começou?* |
| Toast (arrastar) | Card arrastado para NORMALIZADOS | **✓ {cod} normalizado às {hh:mm}.** (📜: "{cod} normalizado à mão às {hh:mm}") |
| 📜 (arrastar de volta) | Card arrastado para fora de NORMALIZADOS | **{cod} reaberto (arrastado de NORMALIZADOS)** |

## 4f. 13.2.1 — ajustes de 24/10/2026 (autorizados na homologação)

| Código | Quando | Texto |
|---|---|---|
| NIT-36 (aviso passageiro, sem card) | A mesma linha veio repetida no relatório | Some sozinho: **ℹ 017 VEIO 2 VEZES NO RELATÓRIO. Contado uma vez só.** Na LINHA DO TEMPO, em Erros da fonte: "017 veio 2 vezes (contado 1)". Não vira card no painel (pedido do Cristiano, 24/10: nada a fazer não polui o painel). |
| (botão do topo) | Diário do dia | **📜 LINHA DO TEMPO** (antes "O QUE MUDOU"; "Histórico" já é usado no NIT). Resumo (agora · último relatório · erros da fonte), filtros (Tudo · Erros da fonte · Correções · Ações do operador), um bloco por relatório com totais e diferença para o anterior, códigos em etiquetas por cor; leituras corrigidas recolhidas. |

## 4g. 13.2.1 — textos sem culpa (24/10/2026, homologação)

- LINHA DO TEMPO: "＋ Novos pendentes" → **"＋ Entraram"**; "＋ Novos já normalizados" → **"＋ Entraram normalizados"**; "⟲ Início/Fim corrigido pela fonte" → **"⟲ Início/Fim corrigido no relatório"**; "⚠ Erros da fonte" → **"⚠ Informações incompletas"**; "Erro resolvido" → **"Resolvido"**. As entradas antigas do dia continuam sendo lidas.
- Título da coluna ⚠ DECIDIR ("RELATÓRIO ALTERADO!", "⚠ 1 SEMÁFORO ESPERA SUA RESPOSTA") em **branco**: o âmbar se confundia com os avisos.
- Avisos passageiros no **canto de baixo à direita**, sem segurar o clique.

