# BUSINESS-RULES.md — NIT

> Regras de negócio e contratos consolidados a partir da auditoria dos ciclos 1–8 e das decisões posteriormente validadas durante a investigação de integridade do processamento CEMOB.
>
> Este documento separa explicitamente **contratos que devem ser preservados**, **comportamentos confirmados pelo código** e **pontos ainda sujeitos a validação**. Encontrar um comportamento no código não basta, por si só, para transformá-lo em regra normativa.

## 1. Convenções

| Estado | Significado |
|---|---|
| 🔵 CONTRATO | Regra consolidada que deve ser preservada |
| 🟢 CONFIRMADO | Comportamento sustentado pelo código e fluxo auditado |
| 🟡 VALIDAR | Comportamento observado cuja intenção/regra ainda precisa ser confirmada |
| 🟠 LEGADO | Existe no código, mas não representa o fluxo principal atual |
| 🔴 CONFLITO | Código, documentação ou componentes apresentam comportamentos incompatíveis |

Ao modificar o sistema, **não converter automaticamente 🟢 em 🔵**. Contratos são decisões de preservação; comportamentos confirmados descrevem o sistema atual.

---

# 2. Identidade da ocorrência

## BR-ID-001 — `eventoId` identifica a ocorrência
**Estado:** 🔵 CONTRATO

A identidade forte da ocorrência semafórica é `eventoId`.

Conceitualmente:

```text
eventoId = codigo + inicio
```

Alterações não devem substituir essa identidade por `codigo` isoladamente.

## BR-ID-002 — `codigo` sozinho não identifica uma ocorrência
**Estado:** 🔵 CONTRATO

O mesmo código pode aparecer em momentos diferentes e representar ocorrências distintas.

```text
codigo = chave auxiliar
eventoId = identidade forte
```

## BR-ID-003 — Mesmo código + início diferente pode representar novo evento
**Estado:** 🟢 CONFIRMADO

O fluxo de reprocessamento/reincidência permite que o mesmo `codigo` produza outro `eventoId` quando o início é diferente.

Isso não autoriza tratar automaticamente toda alteração de `inicio` como nova ocorrência quando já existe uma ocorrência conhecida e a nova entrada contradiz dados anteriormente recebidos. Nesses casos, a situação pode exigir reconciliação antes da criação de nova identidade.

## BR-ID-004 — Herança preserva identidade
**Estado:** 🔵 CONTRATO

Quando uma ocorrência é reconhecida como continuidade/herança, seu `eventoId` é preservado.

## BR-ID-005 — `ID_OCORRENCIA` exportado corresponde a `eventoId`
**Estado:** 🟢 CONFIRMADO

A exportação não deve substituir `eventoId` por `codigo`.

## BR-ID-006 — Contradição da fonte não autoriza troca silenciosa de identidade
**Estado:** 🔵 CONTRATO

Quando uma ocorrência conhecida recebe posteriormente informação incompatível capaz de alterar sua identidade, o NIT não deve concluir silenciosamente que se trata de nova ocorrência, retificação ou continuidade.

Enquanto a contradição não estiver reconciliada, a identidade operacional conhecida deve ser protegida.

Uma reconciliação confirmada deve privilegiar a preservação da ocorrência e de seu histórico quando ficar estabelecido que a nova informação representa retificação da mesma ocorrência.

---

# 3. Estado da ocorrência × estado operacional

## BR-OP-001 — As duas dimensões são diferentes
**Estado:** 🔵 CONTRATO

O estado da falha/ocorrência e o estado da operação não são sinônimos.

```text
OCORRÊNCIA
├── estado da ocorrência
│   ├── PENDENTE
│   ├── NORMALIZADO
│   └── SEM_NECESSIDADE
│
└── estado operacional
    ├── espera
    ├── despacho
    ├── apoio
    ├── rendição
    └── encerramento
```

## BR-OP-002 — Encerrar operação não significa normalizar ocorrência
**Estado:** 🔵 CONTRATO

O encerramento operacional encerra a atuação/equipe naquele ciclo. A normalização representa o encerramento técnico da ocorrência.

Uma implementação não deve tratar essas ações como equivalentes.

## BR-OP-003 — `coluna` e `colunaN` possuem significados diferentes
**Estado:** 🔵 CONTRATO

- `coluna`: posição operacional atual no Kanban.
- `colunaN`: trajetória operacional construída ao longo da ocorrência.

Não substituir um pelo outro.

## BR-OP-004 — `sub` e `pl` não são sinônimos
**Estado:** 🔵 CONTRATO

No modelo auditado:

```text
sub = natureza operacional (vl | amc | sn)
pl  = condição simplificada usada pelo estado
```

Alterações devem preservar a diferença semântica entre os campos.

## BR-OP-005 — Retificação do estado da ocorrência não reescreve automaticamente o estado operacional
**Estado:** 🔵 CONTRATO

Uma reconciliação CEMOB pode alterar o estado atual da ocorrência sem tornar falsos os fatos operacionais anteriormente registrados.

Portanto, uma transição confirmada:

```text
NORMALIZADO → PENDENTE
```

não deve, por si só:

- reativar automaticamente equipe anteriormente encerrada;
- restaurar automaticamente viatura;
- apagar ou recriar despacho;
- apagar chegada;
- apagar apoio;
- apagar rendição;
- restaurar agendamento;
- reescrever silenciosamente a trajetória operacional.

O estado operacional corrente deve ser tratado separadamente conforme o fluxo operacional aplicável.

---

# 4. Despacho

## BR-DES-001 — Despacho altera o estado operacional
**Estado:** 🟢 CONFIRMADO

O despacho atualiza o snapshot da ocorrência e registra a ação no histórico.

## BR-DES-002 — Primeiro despacho deve permanecer identificável
**Estado:** 🔵 CONTRATO

`tsFirstDispatch` representa o primeiro despacho.

Se já existe, novos despachos/rendições não devem sobrescrevê-lo.

## BR-DES-003 — `tsDespacho` representa o marco operacional atual
**Estado:** 🟢 CONFIRMADO

`tsDespacho` não significa necessariamente “primeiro despacho”. Ele pode ser atualizado por nova assunção operacional, inclusive rendição.

```text
tsFirstDispatch = primeiro despacho
tsDespacho      = despacho/assunção operacional atual
```

## BR-DES-004 — Chegada e despacho são marcos temporais distintos
**Estado:** 🟢 CONFIRMADO

`tsChegada` não deve ser tratado automaticamente como equivalente a `tsDespacho`.

---

# 5. Apoio

## BR-APO-001 — Apoio não substitui a equipe principal
**Estado:** 🟢 CONFIRMADO

O despacho principal utiliza:

```text
equipe
viatura
```

O apoio utiliza:

```text
equipeApoio
viaturaApoio
```

Registrar apoio não deve, por si só, apagar/substituir a equipe principal.

## BR-APO-002 — Apoio participa da trajetória operacional
**Estado:** 🟢 CONFIRMADO

Apoio gera registro histórico e influencia a derivação de `colunaN`.

---

# 6. Rendição

## BR-REN-001 — Rendição pressupõe operação em andamento
**Estado:** 🟢 CONFIRMADO

A interface/fluxo auditado só disponibiliza rendição após despacho.

## BR-REN-002 — Rendição troca a responsabilidade operacional
**Estado:** 🟢 CONFIRMADO

Na execução, a nova equipe passa a ocupar os campos principais:

```text
equipe
viatura
sub
```

A rendição também atualiza `tsDespacho`, recalcula `colunaN` e move o card para a coluna operacional correspondente.

## BR-REN-003 — Rendição pode ser Via Livre ou AMC
**Estado:** 🟢 CONFIRMADO

Tipos observados:

```text
vl
amc
```

## BR-REN-004 — Equipe que entra é obrigatória
**Estado:** 🟢 CONFIRMADO

A rendição não deve ser executada sem equipe de entrada válida.

## BR-REN-005 — Rendição pode ser imediata ou agendada
**Estado:** 🟢 CONFIRMADO

Os dois caminhos pertencem ao fluxo atual.

## BR-REN-006 — Agendar não altera imediatamente o estado operacional
**Estado:** 🟢 CONFIRMADO

O compromisso é persistido em:

```text
/kanban/{eventoId}/agendamento
```

mas a equipe/coluna corrente não deve ser alterada apenas pelo agendamento.

## BR-REN-007 — Hora agendada e hora real são conceitos diferentes
**Estado:** 🟢 CONFIRMADO

A execução pode ocorrer em horário diferente do inicialmente programado. O timestamp histórico deve representar a execução efetiva informada.

## BR-REN-008 — Executar rendição remove o agendamento correspondente
**Estado:** 🟢 CONFIRMADO

Após execução, o agendamento deixa de representar compromisso pendente.

## BR-REN-009 — Cancelar agendamento não altera a operação atual
**Estado:** 🟢 CONFIRMADO

Cancelar compromisso futuro não equivale a executar uma rendição.

## BR-REN-010 — Executor automático de rendição agendada
**Estado:** 🟡 VALIDAR

A auditoria encontrou persistência do agendamento, mas não encontrou executor automático. Não assumir que exista scheduler operacional para isso.

---

# 7. Histórico operacional

## BR-HIS-001 — Ações operacionais relevantes são registradas no histórico
**Estado:** 🟢 CONFIRMADO

Despacho, apoio e rendição possuem eventos históricos observados.

## BR-HIS-002 — Histórico é append-only
**Estado:** 🔵 CONTRATO

Persistência:

```text
/kanban/{eventoId}/historico/{pushKey}
```

Novos eventos devem ser acrescentados sem sobrescrever eventos anteriores.

## BR-HIS-003 — Estado atual permanece no nó principal
**Estado:** 🔵 CONTRATO

O sistema mantém:

```text
snapshot atual + histórico
```

O histórico não substitui a necessidade de um estado corrente.

## BR-HIS-004 — `colunaN` é derivável da trajetória histórica
**Estado:** 🟢 CONFIRMADO

Regra observada:

```text
despacho → inicia/reinicia segmento
apoio    → acrescenta tipo ao segmento
rendição → fecha segmento e inicia outro
```

## BR-HIS-005 — Histórico pode auxiliar reconstrução de estado legado
**Estado:** 🟢 CONFIRMADO

Compatibilidade com registros antigos não deve ser removida sem verificar consumidores e dados existentes.

## BR-HIS-006 — Retificação não apaga fatos históricos
**Estado:** 🔵 CONTRATO

Uma correção posterior da fonte CEMOB ou uma decisão de reconciliação não deve apagar silenciosamente eventos operacionais que efetivamente foram registrados.

A correção do estado atual deve coexistir com a preservação da trajetória anterior.

## BR-HIS-007 — Reversão de decisão não apaga a decisão anterior
**Estado:** 🔵 CONTRATO

Quando uma decisão humana de reconciliação for posteriormente corrigida ou revertida, a decisão original e sua reversão devem permanecer auditáveis.

Reverter estado não significa apagar história.

---

# 8. Normalização e reconciliação

## BR-NOR-001 — Data e hora de fim são obrigatórias na normalização manual
**Estado:** 🟢 CONFIRMADO

A Central valida os dois campos antes de concluir a ação.

## BR-NOR-002 — Momento operacional de fim e momento do registro são distintos
**Estado:** 🔵 CONTRATO

```text
data_fim = data operacional do fim
hora_fim = hora operacional do fim
ts_norm  = momento do registro da normalização
```

Não substituir `data_fim`/`hora_fim` por `Date.now()` indiscriminadamente.

## BR-NOR-003 — Normalização move a ocorrência para Normalizados
**Estado:** 🟢 CONFIRMADO

O estado auditado recebe:

```text
status = "NORMALIZADO"
coluna = "coluna-normalizados"
```

além de `data_fim`, `hora_fim`, `ts_norm`, observações e operador.

## BR-NOR-004 — Normalização pode acrescentar observação sem destruir a anterior
**Estado:** 🟢 CONFIRMADO

Quando não há nova observação, o fluxo pode preservar a já existente.

## BR-NOR-005 — Ocorrência pode nascer normalizada
**Estado:** 🟢 CONFIRMADO

Se o relatório recebido já contém `Fim`, o parser pode classificar a ocorrência como `NORMALIZADO` e persistir os dados de fim desde sua criação.

Isso é diferente da normalização manual posterior.

## BR-NOR-006 — Ocorrência normalizada não participa da herança
**Estado:** 🔵 CONTRATO

No fluxo de continuidade auditado, apenas ocorrência não normalizada é candidata à herança.

A reconciliação explícita prevista em `BR-NOR-007` não constitui herança e não altera este contrato.

## BR-NOR-007 — NORMALIZADO → PENDENTE pode ocorrer por reconciliação explícita
**Estado:** 🔵 CONTRATO

Uma ocorrência normalizada pode retornar a `PENDENTE` quando nova evidência CEMOB contradiz a normalização anterior e uma decisão humana confirma que a nova representação corresponde à mesma ocorrência.

Exemplo:

```text
VERSÃO ANTERIOR
Início: 10:00
Fim:    10:40
Estado: NORMALIZADO

NOVA VERSÃO
Início: 10:00
Fim:    ausente
```

A retirada de `Fim` deve ser tratada como possível retificação da fonte.

Essa situação:

- não constitui automaticamente reincidência;
- não constitui herança;
- não autoriza criação silenciosa de novo `eventoId`;
- não autoriza criação silenciosa de segundo card;
- não autoriza apagamento do histórico.

Antes da decisão humana, a contradição deve ser diagnosticada e o estado conhecido deve permanecer protegido.

> 14/10/2026: confirmado pelo responsável. Até a decisão, o card continua normalizado e a conferência mostra "Atividade incomum: normalizado voltou sem fim". A decisão humana será o botão "Retornar aos pendentes" (NIT 13.2), reversível.

## BR-NOR-008 — Reconciliação preserva identidade quando confirmada como retificação
**Estado:** 🔵 CONTRATO

Quando o operador confirmar que a contradição representa retificação da mesma ocorrência:

```text
eventoId anterior = eventoId posterior
```

A ocorrência permanece a mesma.

Devem ser preservados, quando existentes:

- `eventoId`;
- card;
- histórico operacional;
- trajetória já registrada;
- fatos operacionais anteriores.

A representação CEMOB atual pode ser corrigida sem recriar a ocorrência.

## BR-NOR-009 — Consequência deve ser apresentada antes da decisão
**Estado:** 🔵 CONTRATO

Quando a reconciliação exigir decisão humana, o NIT deve apresentar o impacto projetado antes da persistência.

A apresentação deve priorizar os indicadores utilizados operacionalmente pelo usuário, incluindo, quando aplicável:

```text
Ocorrências
Pendentes
Normalizados
```

Exemplo conceitual:

```text
ANTES                 APÓS CONFIRMAR

Ocorrências   24      24
Pendentes      3       4
Normalizados  21      20
```

A interface deve responder de forma intuitiva à pergunta operacional:

```text
"O que aconteceu aqui?"
```

## BR-NOR-010 — Decisão humana resolve o caso, não ensina o motor
**Estado:** 🔵 CONTRATO

Uma escolha realizada pelo operador durante uma reconciliação:

- pode resolver o estado daquela ocorrência;
- pode ser registrada para auditoria;
- pode gerar evidência para investigação posterior;

mas não deve:

- alterar automaticamente contratos;
- alterar regras determinísticas;
- modificar invariantes;
- ensinar automaticamente ao sistema que casos futuros equivalentes devem receber a mesma decisão.

Produção gera evidência para avaliação; não modifica diretamente aquilo que define o comportamento correto do motor.

## BR-NOR-011 — Decisão incorreta deve ser recuperável quando tecnicamente seguro
**Estado:** 🔵 CONTRATO

Nas operações protegidas pelo mecanismo de reconciliação, uma decisão humana incorreta deve poder ser corrigida pelo próprio NIT sem exigir, como procedimento normal, exclusão manual de registros no Firebase.

Quando uma reversão simples puder destruir ou sobrescrever fatos operacionais posteriores, o sistema não deve restaurar cegamente um estado antigo.

Nesse caso, deve preservar os fatos posteriores e encaminhar a situação para nova reconciliação.

---

# 9. Classificação inicial da ocorrência

## BR-CLA-001 — O parser pode produzir estados diferentes antes de ação manual
**Estado:** 🟢 CONFIRMADO

O fluxo auditado reconhece, entre outros:

```text
Fim preenchido
→ NORMALIZADO

indicadores de sem necessidade
→ SEM_NECESSIDADE

caso contrário / necessidade ativa
→ PENDENTE
```

## BR-CLA-002 — Classificação automática não deve inventar informação ausente
**Estado:** 🔵 CONTRATO

O sistema é assistido pelo operador: pode detectar condições a partir do relatório recebido, mas não deve fabricar dados operacionais que não estejam presentes.

---

# 10. Continuidade, herança e reincidência

## BR-CON-001 — Resolver primeiro por `eventoId`
**Estado:** 🟢 CONFIRMADO

A identidade forte tem prioridade.

## BR-CON-002 — `codigo` pode ser usado como chave auxiliar
**Estado:** 🟢 CONFIRMADO

Quando não há correspondência exata por `eventoId`, o código pode participar da tentativa de continuidade/herança.

O uso auxiliar de `codigo` não autoriza colapsar silenciosamente identidades incompatíveis.

## BR-CON-003 — Somente ocorrência não normalizada é candidata à herança
**Estado:** 🔵 CONTRATO

Normalizados não devem ser reabertos implicitamente pelo mecanismo de herança.

Uma eventual volta de `NORMALIZADO → PENDENTE` deve ocorrer pelo fluxo explícito de reconciliação definido na seção 8.

## BR-CON-004 — Herança mantém identidade
**Estado:** 🔵 CONTRATO

Continuidade não deve criar novo `eventoId` para a mesma ocorrência herdada.

## BR-CON-005 — Herança atualiza `dataReferencia`
**Estado:** 🟢 CONFIRMADO

A data do plantão atual pode mudar sem alterar o início real da ocorrência.

## BR-CON-006 — Mesmo código pode representar reincidência
**Estado:** 🟢 CONFIRMADO

Código repetido não prova continuidade.

## BR-CON-007 — Detecção de lacuna não substitui decisão do operador
**Estado:** 🔵 CONTRATO

O sistema pode indicar possível lacuna, mas o operador continua responsável por obter/conferir/processar o relatório externo.

## BR-CON-008 — O sistema não lê WhatsApp automaticamente
**Estado:** 🟢 CONFIRMADO

Não assumir integração automática com a fonte externa quando ela não existe.

## BR-CON-009 — Contradição não resolvida deve falhar de forma segura
**Estado:** 🔵 CONTRATO

Quando o NIT encontrar uma situação incompatível que não consiga classificar com segurança como continuidade, reincidência ou retificação, não deve inventar silenciosamente uma solução.

O comportamento esperado é:

```text
detectar
→ preservar estado conhecido
→ diagnosticar
→ impedir alteração estrutural perigosa
→ solicitar revisão/decisão quando necessária
```

Uma situação não compreendida é preferível a uma decisão automática capaz de corromper identidade, histórico ou contagem.


## BR-CON-010 — Um semáforo tem no máximo uma ocorrência pendente
**Estado:** 🔵 CONTRATO — decidido pelo responsável em 14/10/2026 (NIT 13.1)

Uma nova ocorrência do mesmo semáforo só existe **depois do fim explícito** da anterior.

```text
anterior com fim  e  fim ≤ novo início  → nova ocorrência
anterior sem fim                        → continua a mesma ocorrência
```

Problema adicional no mesmo evento atualiza a mesma ocorrência (observações, tipo, problema).

## BR-CON-011 — Reincidência é marcada pela data do relatório
**Estado:** 🔵 CONTRATO — 14/10/2026

A marca ↺ REINC vale quando a ocorrência anterior do mesmo semáforo aparece no relatório do mesmo dia (`dataReferencia`) ou é encerrada nele — inclusive se começou no dia anterior. Anterior encerrada em dia que não aparece no relatório atual → nova ocorrência **sem** marca.

A marca é visual. A criação da nova ocorrência depende da condição temporal (BR-CON-010), não da marca.

## BR-CON-012 — Sobreposição ou dados insuficientes não criam reincidência
**Estado:** 🔵 CONTRATO — 14/10/2026

Se o fim da anterior é **posterior** ao novo início, ou falta data/hora para comparar, o NIT **não** cria reincidência automaticamente: preserva a pendência, guarda a linha no card e sinaliza na conferência. A comparação usa data e hora completas (a meia-noite não engana a regra).

## BR-CON-013 — Identidade estável com horários anteriores
**Estado:** 🔵 CONTRATO — 14/10/2026

A chave do card no Firebase não muda. Quando a fonte corrige o início, o card passa a ter:

```text
inicio          → início atual (referência do encerramento)
inicioAnterior  → início imediatamente anterior
aliases/{id}    → todos os eventoId anteriores (reconhecimento)
```

Só o **início atual** encerra a ocorrência. Horários anteriores reconhecem o card, mas não o encerram e não impedem o encerramento. Correção de horário é registrada (toast "⟲ Horário corrigido") e não exige ação do operador. Cards antigos (sem `aliases`) são reconhecidos pela própria chave: nenhuma migração.

## BR-CON-014 — Duas linhas abertas do mesmo semáforo são inconsistência da fonte
**Estado:** 🔵 CONTRATO — 14/10/2026

O NIT mantém **um** card pendente, guarda a outra linha no card (`aliases`) e alerta na conferência. Nenhuma linha é descartada em silêncio.

## BR-CON-015 — Identidade sem início é fixa
**Estado:** 🔵 CONTRATO — 14/10/2026

Sem Início, `eventoId = codigo + "_SI" + data do plantão (+ "_n" se houver mais de uma)`. Não usa `Date.now()`. Cards antigos com ID de horário continuam reconhecidos.

## BR-CON-016 — Pendências duplicadas legadas
**Estado:** 🔵 CONTRATO — 14/10/2026

Pares de pendentes do mesmo semáforo criados antes da BR-CON-010 são preservados (nada é apagado ou mesclado automaticamente) e sinalizados na conferência. O operador resolve com "Retirar do painel" (NIT 13.2), reversível e indicado na conferência.

## BR-CON-017 — Card cujo início sumiu e o semáforo aparece com um único horário já encerrado
**Estado:** 🔵 CONTRATO — decidido pelo responsável em 15/10/2026 (substitui a decisão provisória C16)

O relatório é cumulativo no dia: uma linha só some se a fonte a editou. Se o início do card pendente não aparece mais e o semáforo vem com **uma única** outra linha, já encerrada, e nenhuma aberta, é **correção de horário com encerramento no mesmo card** (CONTRATO §13, caso real 468/790): mesma chave, equipe e histórico preservados, início anterior guardado, registro na conferência ("⟲ Horário corrigido"). Com várias linhas encerradas, ou uma encerrada e outra aberta, o card **não** é normalizado: a situação é sinalizada.

## BR-CON-018 — Decisão única para carga inicial, reprocessamento e conferência
**Estado:** 🔵 CONTRATO — 14/10/2026

As três etapas usam a mesma classificação (`_classificarLinhas`), que olha o relatório **inteiro** e o estado dos cards, em ordem de horário — nunca pela ordem das linhas. A conferência reclassifica o estado gravado: se o motor aplicou tudo, toda linha volta como "manter" ou como inconsistência conhecida.

---

# 11. Exportação

## BR-EXP-001 — `/kanban` é a origem operacional da exportação
**Estado:** 🟢 CONFIRMADO

Google Sheets não é o estado operacional primário.

## BR-EXP-002 — Frontend resolve identidade/estado antes do backend
**Estado:** 🔵 CONTRATO

O backend recebe o estado resolvido; não deve recriar arbitrariamente a identidade da ocorrência.

## BR-EXP-003 — `eventoId` é exportado como `ID_OCORRENCIA`
**Estado:** 🟢 CONFIRMADO

Essa correspondência deve permanecer consistente.

## BR-EXP-004 — Normalização usa `ts_norm`
**Estado:** 🟢 CONFIRMADO

O timestamp de registro da normalização possui função própria na exportação.

## BR-EXP-005 — Herança pode gerar nova linha no Sheets
**Estado:** 🟢 CONFIRMADO

Continuidade da identidade não significa necessariamente atualização da mesma linha física em todos os plantões.

## BR-EXP-006 — Atualização considera a linha mais recente do mesmo `eventoId`
**Estado:** 🟢 CONFIRMADO

## BR-EXP-007 — `colunaN` tem prioridade quando disponível
**Estado:** 🟢 CONFIRMADO

Fallback/reconstrução não deve substituir uma `colunaN` válida sem motivo.

## BR-EXP-008 — Google Sheets é destino de exportação
**Estado:** 🔵 CONTRATO

O frontend fala com a API; não precisa conhecer a implementação interna da planilha.

## BR-EXP-009 — Scheduler atual de `cron_export.py`
**Estado:** 🟡 VALIDAR

A existência do código não comprova que exista scheduler ativo em produção.

---

# 12. Reboques

## BR-REB-001 — Reboques é domínio operacional separado
**Estado:** 🔵 CONTRATO

O módulo usa:

```text
/reboques/plantao_ativo
```

e não altera o `/kanban` do Semáforo.

## BR-REB-002 — `status` do reboquista representa estado do recurso
**Estado:** 🔵 CONTRATO

Estados observados:

```text
DISPONÍVEL ↔ ATUANDO
```

Não confundir esse `status` com estado de ocorrência semafórica.

## BR-REB-003 — Evento pode existir sem reboquista
**Estado:** 🟢 CONFIRMADO

Uma ocorrência de reboque pode aguardar designação.

## BR-REB-004 — Evento pode ter zero, um ou vários reboquistas
**Estado:** 🟢 CONFIRMADO

## BR-REB-005 — Relação evento ↔ reboquista é bidirecional
**Estado:** 🔵 CONTRATO

O vínculo existe nos dois lados:

```text
reboquista.eventoId
evento.reboquistas
```

Alterações de alocação/transferência devem manter os dois lados consistentes.

## BR-REB-006 — Transferência remove vínculo anterior
**Estado:** 🟢 CONFIRMADO

Um reboquista movido para outro evento deixa de pertencer ao anterior.

## BR-REB-007 — Finalização individual libera o recurso
**Estado:** 🟢 CONFIRMADO

A finalização observada:

```text
remove do evento
status = disponível
eventoId = ""
ocorrencia = ""
recalcula ordem
```

## BR-REB-008 — Finalização do evento atualmente remove o evento ativo
**Estado:** 🟡 VALIDAR

O código auditado libera os vinculados e remove `/eventos/{evId}`. Não transformar isso em regra permanente até confirmar a intenção operacional.

## BR-REB-009 — Histórico permanente de eventos de Reboques
**Estado:** 🟡 VALIDAR

Não foi encontrado histórico persistente após finalização.

## BR-REB-010 — “Limpar Plantão” remove o conjunto operacional
**Estado:** 🟡 VALIDAR

O comportamento existe, mas sua permanência como regra de negócio precisa validação.

## BR-REB-011 — Drag & Drop pode representar operação de negócio
**Estado:** 🟢 CONFIRMADO

Reordenar, alocar e transferir podem gravar alterações reais no Firebase. Não tratar todo drag & drop como mudança puramente visual.

---

# 13. Guardião e integridade do processamento

## BR-GUA-001 — Estado projetado deve preceder persistência protegida
**Estado:** 🔵 CONTRATO

Nos fluxos protegidos pelo Guardião, o NIT deve determinar o resultado projetado da operação antes de persistir uma alteração capaz de afetar integridade.

Conceitualmente:

```text
entrada
→ interpretação
→ estado projetado
→ validação
→ apresentação ao operador
→ decisão quando necessária
→ persistência
```

## BR-GUA-002 — Confirmação humana complementa proteção automática
**Estado:** 🔵 CONTRATO

A confirmação do operador não substitui invariantes automáticos.

Uma decisão humana não deve ser utilizada como autorização genérica para produzir silenciosamente:

- duplicidade;
- perda de ocorrência;
- troca indevida de identidade;
- apagamento de histórico;
- corrupção estrutural.

## BR-GUA-003 — Divergência deve ser explicável
**Estado:** 🔵 CONTRATO

Diferenças entre a entrada CEMOB e o estado projetado pelo NIT devem ser identificadas antes da persistência sempre que puderem afetar a integridade do processamento.

Comparação apenas de totais não é suficiente quando conjuntos diferentes podem produzir a mesma quantidade.

## BR-GUA-004 — Operação deve permanecer intuitiva
**Estado:** 🔵 CONTRATO

A apresentação do Guardião deve acompanhar o modelo mental já utilizado pelo operador:

```text
olhar totais CEMOB
→ olhar NIT
→ comparar
→ perceber diferença
→ perguntar "o que aconteceu?"
→ receber explicação
→ decidir quando necessário
```

O Guardião não deve exigir que o operador aprenda um método paralelo de conferência para realizar uma atividade já conhecida.

## BR-GUA-005 — Casos relevantes do Guardião devem ser auditáveis
**Estado:** 🔵 CONTRATO

Toda intervenção do Guardião que exija decisão humana deve gerar um registro permanente e auditável da:

- detecção;
- situação relevante;
- decisão;
- consequência;
- eventual reversão.

Ruídos de representação absorvidos automaticamente pelo parser não precisam gerar caso de integridade.

O schema físico do Registro de Integridade deve ser definido na implementação/documentação de dados correspondente; esta regra estabelece apenas o contrato funcional.

## BR-GUA-006 — Produção gera evidência, não regra automática
**Estado:** 🔵 CONTRATO

Casos detectados em produção podem alimentar investigação, testes e evolução posterior do NIT.

O fluxo correto é:

```text
produção
→ evidência
→ investigação
→ validação
→ gabarito/teste
→ eventual alteração do motor
```

Nunca:

```text
decisão do operador
→ alteração automática da regra determinística
```

## BR-GUA-007 — Erro tratável é preferível a dano estrutural
**Estado:** 🔵 CONTRATO

O sistema não precisa eliminar todos os erros possíveis antes de entrar em operação.

Quando não for possível tratar uma inconsistência com segurança, deve privilegiar preservação, observabilidade e recuperação em vez de uma correção automática que possa comprometer identidade, histórico ou estado persistido.

---

# 14. Componentes legados e compatibilidade

Os itens abaixo **não são regras de negócio**, mas impõem uma regra de manutenção: não remover sem provar ausência de consumidores.

| Componente | Estado |
|---|---|
| `NitNormalizar` | 🟠 possível implementação legada/alternativa |
| modal antigo de despacho | 🟠 implementação alternativa |
| `/api/v1/despacho` | 🟠 compatibilidade/legado |
| `/api/v1/normalizar` | 🟠 compatibilidade/legado |
| referências a Railway | 🟠 infraestrutura histórica |
| `routes/config.py` | 🟠 aparentemente não registrado |
| `NitCentral` | 🟢 fluxo principal atual |
| `routes/export.py` | 🟢 fluxo principal de exportação |

### Regra de manutenção

**Nada marcado como legado deve ser apagado apenas porque parece antigo.**

Antes de remover:

1. localizar consumidores;
2. verificar listeners/handlers;
3. verificar chamadas de API;
4. verificar dados históricos;
5. confirmar que o fluxo principal não depende do componente;
6. só então propor remoção.

---

# 15. Regras de segurança para mudanças

Qualquer alteração funcional deve preservar, até decisão explícita em contrário:

1. identidade forte por `eventoId`;
2. distinção entre `eventoId` e `codigo`;
3. distinção entre estado da ocorrência e estado operacional;
4. distinção entre normalização e encerramento operacional;
5. histórico append-only;
6. separação entre `coluna` e `colunaN`;
7. preservação de `tsFirstDispatch`;
8. significado operacional de `tsDespacho`;
9. continuidade sem herdar ocorrências normalizadas;
10. consistência bidirecional de Reboques;
11. separação operacional entre Semáforo e Reboques;
12. ausência de remoção automática de legado sem auditoria de consumidores;
13. ausência de criação silenciosa de novo `eventoId` durante reconciliação de retificação;
14. ausência de duplicação silenciosa de card;
15. ausência de perda silenciosa de ocorrência;
16. preservação do histórico durante retificação e reversão;
17. separação entre decisão operacional pontual e alteração das regras determinísticas;
18. falha segura diante de situação não compreendida.

Para a entrega do Guardião destinada à expansão operacional do NIT, aplica-se adicionalmente o seguinte critério:

> **A entrega não exige eliminar todos os erros possíveis. Exige impedir que erros não tratados provoquem silenciosamente dano estrutural, garantindo integridade, observabilidade, recuperabilidade, falha segura e operação intuitiva.**

---

# 16. Questões abertas

Estas questões permanecem fora do conjunto de contratos até validação:

```text
VALIDAR:
- Evento finalizado de Reboques deve ser removido ou arquivado?
- Deve existir histórico permanente de Reboques?
- Qual deve ser a persistência entre plantões de Reboques?
- Existe/será necessário executor automático de rendições agendadas?
- Qual infraestrutura deve executar cron_export.py?
```

A questão:

```text
NORMALIZADO pode voltar a PENDENTE?
```

não permanece aberta.

A decisão consolidada é:

```text
SIM, por reconciliação explícita de retificação,
com preservação de identidade e histórico,
sem reabertura implícita por herança,
sem reativação automática do estado operacional
e com decisão humana quando a contradição exigir interpretação.
```

Uma IA ou desenvolvedor não deve responder as demais questões abertas por inferência a partir do comportamento atual.

---

# 17. Protocolo para nova regra

Antes de acrescentar uma regra a este documento:

```text
1. localizar o domínio
2. localizar o fluxo
3. localizar o estado
4. localizar a persistência
5. localizar consumidores
6. verificar histórico
7. confrontar documentação
8. classificar evidência
9. se for decisão nova, registrar decisão/ADR
10. somente então atualizar BUSINESS-RULES.md
```

A regra fundamental é:

```text
"O código atualmente faz X"
            ≠
"O sistema deve fazer X"
```

Casos encontrados em produção não alteram esse protocolo. Um novo incidente aumenta a evidência disponível; não altera automaticamente o contrato.

---

# 18. Documentos relacionados

- `ARCHITECTURE.md` — arquitetura e responsabilidades.
- `DATA-MODEL.md` — entidades, campos, IDs e relações.
- `WORKFLOW.md` — fluxos operacionais ponta a ponta.
- `CONTEXT.MD` — visão curta de entrada e estado geral.
- `DECISIONS.md` / ADRs — decisões arquiteturais.
- `AI-INSTRUCTIONS.md` — protocolo de atuação de agentes de IA.
- `TODO.md` — questões abertas, investigações e próximas ações.
- Contrato de Entrada CEMOB — tolerâncias, validações e casos adversos da entrada CEMOB.

---

**Status:** regras e contratos consolidados a partir da auditoria disponível e das decisões validadas para integridade/reconciliação do processamento CEMOB.

**Próxima etapa da entrega:** refletir os contratos consolidados no `WORKFLOW.md` e, em seguida, transformá-los em casos de teste de aceitação antes da implementação.

## BR-CON-019 — Fim corrigido pela fonte (13.2, autorizado 18/10/2026)

Ocorrência já normalizada cuja linha (mesmo início) volta com **outro fim**: o card recebe o fim novo, guarda o anterior em `fimAnterior` e mostra "⟲ fim corrigido {antes} → {depois}". Fim **antes do início** não é aplicado: o card fica como está e o NIT-13 pergunta à fonte.

## BR-CON-020 — Linha sem início não apaga início conhecido (13.2, autorizado 19/10/2026)

Se o relatório traz o semáforo **só** com linha sem início e o card pendente já tem início, o card fica como está (critério C1: proteger o processado contra o bruto). O NIT-14 pergunta à fonte. Quando há linha com início e linha sem início, a correção de horário vem da linha **com** início.

## BR-CON-021 — Identidade de linha sem início não colide (13.2, autorizado 19/10/2026)

O id de linha sem início é `{código}_SI{data}`. Se esse id já pertence a outra ocorrência (card que nasceu sem início e depois ganhou início ou foi normalizado), a nova pendência recebe `{código}_SI{data}_{n}` (próximo livre). Sem isso a pendência nova se perdia em silêncio.

## BR-DEC-001 — Decisões do operador (13.2)

- NIT-10 MANTER vale enquanto o semáforo estiver fora do relatório; voltou e sumiu de novo → pergunta outra vez.
- NIT-11 MANTER NORMALIZADO vale enquanto a fonte insistir na linha sem fim; a fonte devolveu o fim → a decisão é esquecida.
- NIT-11 REABRIR não é oferecido se o semáforo já tem outra pendência (BR-CON-010).
- TIRAR nunca apaga: grava `retirado` no card; DESFAZER limpa. Card retirado que a fonte volta a listar volta ao painel (mesmo card).

## BR-DEC-002 — Normalização manual é provisória (13.2, 20/10/2026)

- Normalizar à mão (✓ do card ou NORMALIZOU do NIT-10) grava `normManual {ts, por, fim}` no card: o painel mostra normalizado na hora, com a etiqueta ✋.
- Enquanto a fonte ainda listar a linha aberta, o card NÃO volta a pendente e não gera NIT-11 ("voltou atrás"); aparece o NIT-17 azul (não conta). Normalizado à mão que some do relatório não gera NIT-10.
- Quando a fonte manda a linha com fim, vale o horário da fonte (BR-CON-019 se for diferente: ⟲ fim corrigido) e `normManual` é apagado.
- REABRIR no NIT-17 devolve o card a pendente e apaga `normManual`; DESFAZER restaura.
- O relatório de saída usa o estado atual do painel (não marca nada).

## BR-CON-022 — Hora com erro de digitação (13.2.1, autorizado 23/10/2026)

- Em "Início:" e "Fim:", entre a hora e os minutos o NIT aceita de 1 a 3 sinais entre `. : ; , h` (com ou sem espaço): `06.:50`, `06.50`, `06;;50`, `06h50`, `6:50` → `06:50`. Vale só se a hora for 0–23 e os minutos 0–59.
- A leitura não incomoda o operador; fica registrada no 📜 O QUE MUDOU ("Hora lida com correção").
- Sem separador (`0650`), minuto incompleto (`06.:5`) ou hora impossível (`65:30`): não é adivinhado. O card fica sem início e o NIT-14 mostra o que veio.
- Card já existente sem início (BR-CON-021) recebe a hora quando ela passa a ser lida: mesmo card, sem duplicar.
- Origem: relatório real de 23/10/2026, semáforo 446 "Início: 23/10/2026 06.:50".

## BR-DEC-003 — Card SEM início normalizado à mão continua sendo o card do semáforo (13.2.1, 23/10/2026)

- Caso real (446 e 933, 23/10): card nascido sem início, normalizado à mão; quando a fonte mandou a linha com início e fim, o NIT criava outro card e o relatório de saída mostrava o semáforo 2 vezes.
- Regra: enquanto for provisório (BR-DEC-002), o card sem início normalizado à mão:
  1. continua recebendo a linha SEM início do mesmo semáforo (a fonte ainda diz pendente → aviso azul NIT-17, sem card novo);
  2. recebe a primeira linha COM início anterior ou igual ao fim que o operador informou (mesma ocorrência): encerrada → vale início e fim da fonte (⟲ fim corrigido, deixa de ser provisório); aberta → recebe o início e segue provisório.
- Linha que começa depois do fim informado é outra ocorrência (reincidência): não é absorvida.

## BR-DEC-004 — Todo caminho de normalizar à mão segue a mesma regra (13.2.1, 23/10/2026)

- Botão ✓, NORMALIZOU do "não veio", **Central (aba Normalizar)** e **arrastar para NORMALIZADOS** gravam: coluna NORMALIZADOS, status NORMALIZADO, data/hora do fim e a marca `normManual` (provisório, BR-DEC-002/003).
- Arrastar para NORMALIZADOS normaliza na **hora atual**, sem janela (decisão do Cristiano, 23/10). Antes só trocava a coluna: o banco ficava PENDENTE sem fim, aparecia "VOLTOU ATRÁS" e, sem início, o card duplicava.
- A Central antes não marcava `normManual`: aparecia "VOLTOU ATRÁS" e, sem início, o card duplicava.
- **Arrastar para fora de NORMALIZADOS = reabrir:** status PENDENTE, sem fim, sem `normManual`; registrado no 📜. Se a fonte disser normalizado, o próximo relatório normaliza de novo. Antes o banco continuava NORMALIZADO com o card em outra coluna.

## BR-DEC-005 — Um semáforo não vira dois cards por erro da fonte (13.2.1, pedido do Cristiano em 23/10/2026)

"Tudo que afeta a contagem devemos corrigir." Achados forçando duplicação (`testes/bateria-duplicacao.js`, casos fixos em `testes/bateria-duplicacao-casos.js`):

- **Código sem o zero:** os códigos da CEMOB têm 3 dígitos ou mais (017, 084, 1106; conferido nos 23 relatórios de 23/10). "17" é lido como **017**. No 📜: "ℹ Código lido com correção: "17" → 017".
- **Linha sem início de semáforo já normalizado:** o relatório é cumulativo. Se a linha de um normalizado some e o semáforo aparece numa linha SEM início, é a linha dele que perdeu a hora. Ordem: o normalizado de mesmo fim; o pendente sem início; o normalizado sem início; o único normalizado que ficou sem linha. Linha aberta nesse caso segue a regra do normalizado que volta sem fim (pergunta, BR-NOR-007). Falha nova sem início, com a linha do normalizado presente, continua abrindo card novo.
- **Linha encerrada sem início fechando pendente com início:** fecha o card e **mantém o início** que ele tinha (antes o início era apagado).
- **Card sem início que nasceu normalizado pela fonte** também é provisório (como BR-DEC-003): recebe a linha com início quando ela chegar. Antes cada relatório abria outro (_SI, _SI_2, _SI_3…).
- **A mesma linha repetida** no relatório (mesmo início, mesma seção, mesmo fim) é uma ocorrência só.
- **Fonte corrige o início de ocorrência já normalizada:** a linha do card some e aparece uma só, encerrada, de mesmo fim ou sobreposta → mesmo card com o início corrigido (⟲ Início corrigido pela fonte). Voltar ao início anterior também é reconhecido. Reincidência real (linha do card presente + outra linha) continua virando dois cards.
- **Normalizado volta ABERTO com outro início** que começa antes do fim dele: é a mesma ocorrência (um semáforo não tem duas falhas ao mesmo tempo). Normalizado pela fonte → pergunta "VOLTOU ATRÁS" (BR-NOR-007), sem card novo; normalizado à mão → recebe o início corrigido e segue provisório.
- **Pendente com início cuja linha some e aparece uma linha ENCERRADA sem início** (com fim depois do início dele): é o fim desse pendente; mantém o início.

## BR-ADM-001 — ADM limpa o painel, com cópia (13.2.2, pedido do supervisor; decisões do Cristiano em 24/10/2026)

- Motivo: relatório errado entrou e o status não pode ser compartilhado. O operador avisa o ADM; o ADM decide.
- Só quem tem `nit_admins/{chave}: true` (gravado pelo console) vê **🧹 LIMPAR PAINEL**. A segurança é a **regra do banco**, não o botão escondido.
- Limpa **cards (`kanban`) + avisos (`meta/decisoes_ativas`)**. A LINHA DO TEMPO fica e registra "🧹 Painel limpo (N cards). Cópia guardada.".
- Antes de apagar, guarda a cópia em `lixeira/c{ts}` (quem, quando, cards, avisos) — na MESMA gravação (tudo ou nada). Guarda só as **5 últimas**.
- **↩ RESTAURAR** (só ADM) devolve o último painel limpo; cards que entraram depois continuam (não sobrescreve). Registra "↩ Painel restaurado (N cards).".

