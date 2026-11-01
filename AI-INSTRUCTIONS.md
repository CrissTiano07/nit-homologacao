# AI-INSTRUCTIONS.md — NIT

> Protocolo obrigatório para agentes de IA que analisam, mantêm ou desenvolvem este repositório.
>
> Objetivo: permitir que uma IA entre no projeto com pouco contexto de conversa, compreenda o sistema existente e trabalhe com segurança em um ambiente brownfield.

# 1. Princípio fundamental

Este é um sistema existente em produção/operação. Não trate o repositório como projeto novo.

A prioridade é:

```text
compreender → localizar → verificar → planejar → aprovar → alterar → validar → documentar
```

Nunca:

```text
supor → reescrever → "modernizar" → descobrir depois o que quebrou
```

---

# 2. Ordem mínima de leitura

Antes de qualquer alteração, leia:

```text
1. CONTEXT.MD
2. documento específico do problema
3. código envolvido
```

Escolha o documento específico conforme a tarefa:

```text
arquitetura / integração
→ ARCHITECTURE.md

entidades / campos / IDs / Firebase
→ DATA-MODEL.md

regras / contratos / invariantes
→ BUSINESS-RULES.md

fluxo operacional
→ WORKFLOW.md

decisões arquiteturais
→ DECISIONS.md + docs/adr/

questões abertas
→ TODO.md
```

Não é necessário carregar todos os documentos em toda tarefa.

## 2.1 Protocolo agnóstico de fornecedor

Este protocolo é independente da IA, agente, IDE, integração ou fornecedor utilizado.

ChatGPT, Claude, Gemini, Copilot, Cursor ou qualquer outro agente com acesso ao repositório deve adotar:

```text
CONTEXT.MD
      ↓
AI-INSTRUCTIONS.md
      ↓
documentação específica da tarefa
      ↓
código
```

Arquivos ou mecanismos específicos de uma ferramenta podem funcionar como porta de entrada, mas não devem duplicar nem substituir o protocolo canônico deste arquivo.

---

# 3. Fonte de verdade

Em caso de divergência:

```text
código atual + comportamento validado
            ↓
evidência da auditoria
            ↓
ADRs / contratos aprovados
            ↓
documentação descritiva
            ↓
comentários antigos / histórico de chat
```

Mas atenção:

```text
"O código faz X"
      ≠
"O sistema deve fazer X"
```

Código comprova comportamento atual. Ele não transforma automaticamente esse comportamento em regra desejada.

Quando houver conflito entre código e contrato/ADR, **não escolha silenciosamente um lado**. Registre o conflito e peça decisão.

---

# 4. Classificação obrigatória das descobertas

Use estes estados:

| Estado | Significado |
|---|---|
| 🟢 CONFIRMADO | código e fluxo observado sustentam o comportamento |
| 🔵 CONTRATO | regra arquitetural/de negócio que deve ser preservada |
| 🟡 VALIDAR | comportamento observado, mas intenção ainda não confirmada |
| 🟠 LEGADO | existe, mas não representa o fluxo principal atual |
| 🔴 CONFLITO | fontes/componentes apresentam comportamentos incompatíveis |

Nunca promova automaticamente:

```text
🟢 CONFIRMADO → 🔵 CONTRATO
```

Uma decisão consciente é necessária.

---

# 5. Protocolo obrigatório antes de editar

Para qualquer mudança funcional:

```text
1. encontre o domínio
2. encontre o fluxo
3. encontre o estado
4. encontre a persistência
5. encontre os consumidores
6. verifique o histórico
7. verifique a documentação
8. apresente o plano
9. aguarde aprovação
10. implemente
11. valide
12. atualize a documentação
```

## 5.0 Lição de 01/11/2026 — o teste só vale se o simulado for tão exigente quanto o real

No NIT Móvel, do pacote 1 ao 6, o botão "Entrar com Google" estava morto: o Firebase era usado antes de ser ligado. Os testes passavam porque o Firebase falso aceitava o que o real recusa. Seis pacotes trocaram o *caminho do login* (janela, redirecionamento, Cloud) quando o defeito era o *botão*.

Regras daqui em diante:

- **O falso imita as recusas do real.** Firebase falso: sem `initializeApp`, `auth()`/`database()` dão erro (`testes/movel-tela/fakefb.js`). Ao criar um simulado, liste o que o real **recusa** e faça o falso recusar também.
- **Prove que o teste pega o defeito:** rode a bateria contra a versão defeituosa e confira que ela **falha**.
- **Antes de culpar o ambiente** (navegador, rede, iPhone), confirme no aparelho real que o básico funciona: a página carregou a versão certa e o botão reage.
- **Versão visível na tela** e erro de partida na tela (nunca botão mudo). Confira no repositório publicado que o pacote está no ar antes de diagnosticar.

## 5.1 Encontre o domínio

Determine primeiro:

```text
Semáforo?
Reboques?
Backend/exportação?
Infraestrutura?
Interface compartilhada?
```

Não transfira automaticamente regras de um domínio para outro.

## 5.2 Encontre o fluxo

Não altere uma função isoladamente sem saber de onde ela é chamada e o que acontece depois.

Mapeie:

```text
entrada
↓
handler
↓
estado
↓
persistência
↓
efeitos colaterais
↓
consumidores
```

## 5.3 Encontre o estado

Pergunte:

```text
qual estado existe antes?
qual estado deve existir depois?
qual dimensão está mudando?
```

No Semáforo, sempre diferencie:

```text
estado da ocorrência
≠
estado operacional
```

## 5.4 Encontre a persistência

Verifique se a mudança toca:

```text
Firebase /kanban
Firebase /reboques
historico
agendamento
localStorage / metadados locais
backend
Google Sheets
```

## 5.5 Encontre consumidores

Antes de renomear, remover ou mudar semântica de campo/função/endpoint, pesquise todos os consumidores.

Não conclua que algo é inútil porque não aparece no fluxo que você abriu primeiro.

## 5.6 Governança de acesso e alterações no repositório

A existência de acesso técnico de escrita ao GitHub, ao clone local ou a qualquer workspace **não constitui autorização para alterar o projeto**.

A IA pode usar o acesso disponível para leitura, busca, auditoria e diagnóstico. Para escrever, deve respeitar o protocolo de aprovação.

Antes de editar, apresente de forma objetiva:

```text
OBJETIVO
ARQUIVOS AFETADOS
ALTERAÇÕES PROPOSTAS
IMPACTO E RISCOS
VALIDAÇÃO PREVISTA
```

Regras obrigatórias:

1. Alterações exigem aprovação explícita do usuário.
2. A aprovação vale somente para o escopo apresentado e aprovado.
3. Permissão técnica de escrita não amplia o escopo autorizado.
4. Se durante a execução surgir necessidade de alteração fora do escopo aprovado, interrompa essa parte e solicite nova aprovação.
5. Não faça refatorações, limpezas, renomeações ou correções paralelas apenas porque foram descobertas durante uma tarefa aprovada.
6. Após a execução, informe quais arquivos foram modificados, o que mudou, quais validações foram executadas e quais documentos foram atualizados.
7. `commit`, `push`, criação ou merge de Pull Request, exclusão de arquivos, alteração de branches e outras ações sobre o repositório exigem autorização explícita quando não estiverem claramente incluídas no escopo já aprovado.
8. Ações destrutivas ou irreversíveis continuam sujeitas às regras adicionais de segurança deste documento, mesmo quando a escrita já tiver sido autorizada.

Em resumo:

```text
capacidade técnica de escrever
            ≠
autorização para escrever
            ≠
autorização para qualquer alteração
```

---

# 6. Contratos que a IA não pode quebrar

## 6.1 Identidade

```text
eventoId = identidade forte
codigo   ≠ identidade completa
```

Mesmo código pode representar eventos diferentes.

Herança preserva `eventoId`.

Na exportação:

```text
eventoId → ID_OCORRENCIA
```

## 6.2 Normalização

```text
normalização ≠ encerramento operacional
```

`data_fim` + `hora_fim` representam o momento operacional informado.

`ts_norm` representa o momento de registro.

Não substitua esses conceitos por um único timestamp.

## 6.3 Continuidade

```text
ocorrência NORMALIZADA
→ não participa da herança atual
```

Não implemente `NORMALIZADO → PENDENTE` por inferência. Decidido em 14/10/2026: só por decisão humana explícita (BR-NOR-007, botão "Retornar aos pendentes" na 13.2); até lá, alerta na conferência.

## 6.4 Estado operacional

```text
coluna ≠ colunaN
sub ≠ pl
tsFirstDispatch ≠ tsDespacho
```

`coluna` representa posição atual.

`colunaN` representa trajetória operacional.

`tsFirstDispatch` preserva o primeiro despacho.

`tsDespacho` pode representar a assunção operacional corrente.

## 6.5 Histórico

No Semáforo:

```text
snapshot atual + histórico append-only
```

Não sobrescreva eventos históricos para representar o estado atual.

## 6.6 Reboques

```text
Semáforo ≠ Reboques
```

Não unifique artificialmente os modelos.

A relação:

```text
reboquista.eventoId
        ↕
evento.reboquistas
```

deve permanecer consistente.

## 6.7 Persistência

```text
Firebase = estado operacional persistente
Google Sheets = destino de exportação
```

Não transforme Sheets em fonte operacional primária sem nova decisão arquitetural.

---

# 7. Fluxos principais atuais

## Semáforo

```text
CEMOB
  ↓
parser
  ↓
identidade
  ↓
ocorrência
  ↓
Firebase / Kanban
  ↓
NitCentral
  ├── despacho
  ├── apoio
  ├── rendição
  └── normalização
  ↓
continuidade / herança
  ↓
exportação
  ↓
Google Sheets
```

`NitCentral` é o fluxo operacional principal identificado pela auditoria.

## Reboques

```text
plantão
  ↓
reboquistas
  ↓
eventos
  ↓
alocação / transferência
  ↓
atendimento
  ↓
finalização
```

Consulte `WORKFLOW.md` para detalhes.

---

# 8. Legado: regra de não remoção por inferência

Os seguintes itens foram identificados como legado, alternativa ou compatibilidade:

```text
NitNormalizar
modal antigo de despacho
/api/v1/despacho
/api/v1/normalizar
routes/config.py
referências a Railway
```

Regra obrigatória:

> 🟠 LEGADO não significa "pode apagar".

Antes de remover qualquer componente:

```text
1. pesquise referências
2. pesquise handlers/listeners
3. pesquise chamadas de API
4. pesquise consumidores indiretos
5. verifique dados existentes
6. verifique documentação
7. confirme que o fluxo principal não depende dele
8. apresente evidência da ausência de consumidores
9. obtenha aprovação
```

---

# 9. Questões que a IA NÃO deve decidir sozinha

Continuam `VALIDAR`:

```text
NORMALIZADO pode voltar a PENDENTE?
deve existir histórico permanente de Reboques?
evento finalizado de Reboques deve ser removido ou arquivado?
qual a persistência de Reboques entre plantões?
deve existir executor automático para rendição agendada?
quem executa cron_export.py?
em qual infraestrutura?
quando?
com qual logging/monitoramento?
```

Se uma tarefa depender de uma dessas respostas:

```text
pare
↓
mostre a evidência encontrada
↓
explique o impacto
↓
peça decisão
```

Não escolha a solução "mais comum" ou "mais moderna" como substituto de decisão do projeto.

---

# 10. Como propor uma mudança

Antes de editar, apresente um plano curto:

```text
OBJETIVO
o que será corrigido/adicionado

DOMÍNIO
Semáforo / Reboques / Backend / Infra

FLUXO AFETADO
entrada → processamento → persistência → saída

ARQUIVOS PROVÁVEIS
lista objetiva

CONTRATOS AFETADOS
IDs/regras relevantes

RISCOS
o que pode quebrar

VALIDAÇÃO
como provar que funcionou
```

Não produza refatoração paralela não solicitada.

---

# 11. Escopo mínimo

A mudança deve ser a menor capaz de resolver o problema aprovado.

Evite:

```text
"já que estou aqui..."
```

Não:

- reorganize pastas sem necessidade;
- renomeie APIs por estética;
- substitua tecnologias sem decisão;
- converta código legado em nova arquitetura no mesmo patch;
- reformate arquivos inteiros para corrigir poucas linhas;
- altere contratos para simplificar implementação.

Mudanças estruturais devem ser propostas separadamente.

---

# 12. Validação

Nunca considere uma alteração pronta apenas porque o código foi gerado sem erro de sintaxe.

Valide no nível adequado.

## Frontend

Verifique:

```text
carregamento
interação
estado visual
estado Firebase
histórico
reprocessamento
efeitos em cards/contadores
```

## Semáforo

Quando aplicável, teste:

```text
criação
reprocessamento
despacho
apoio
rendição
normalização
continuidade/herança
exportação
```

## Reboques

Quando aplicável, teste:

```text
plantão
criação de evento
alocação
transferência
finalização individual
finalização do evento
ordenação
relatório
```

## Backend/exportação

Sempre que possível, validar primeiro sem escrever na planilha:

```text
DRY_RUN=true
```

O fluxo auditado possui esse mecanismo para simular a exportação sem escrita no Google Sheets.

Somente depois da validação deve-se considerar execução com escrita real.

---

# 13. Dados reais e efeitos destrutivos

Não execute automaticamente ações destrutivas ou irreversíveis em dados operacionais.

Exemplos:

```text
limpar plantão
remover eventos
reescrever histórico
apagar nós Firebase
escrever em Sheets de produção
migrar IDs
```

Primeiro:

```text
identifique impacto
↓
use ambiente/teste/simulação quando disponível
↓
mostre plano
↓
obtenha aprovação
```

---

# 14. Documentação após mudança

Se uma alteração aprovada mudar comportamento consolidado, atualize o documento correspondente.

```text
arquitetura
→ ARCHITECTURE.md

modelo de dados
→ DATA-MODEL.md

regra
→ BUSINESS-RULES.md

fluxo
→ WORKFLOW.md

decisão arquitetural
→ novo ADR + DECISIONS.md

visão de entrada
→ CONTEXT.MD somente se necessário

pendência resolvida/criada
→ TODO.md
```

Não replique a mesma explicação inteira em todos os documentos.

---

# 15. ADRs

ADRs aceitos registram decisões arquiteturais significativas.

Não reescreva silenciosamente um ADR aceito para justificar arquitetura nova.

Quando uma decisão mudar:

```text
novo ADR
↓
explica contexto e nova decisão
↓
ADR antigo = substituído
↓
DECISIONS.md atualizado
```

Consulte `DECISIONS.md`.

---

# 16. Quando encontrar conflito

Se encontrar:

```text
código A diz X
código B diz Y
documentação diz Z
```

não "corrija" imediatamente.

Classifique:

```text
🔴 CONFLITO
```

Depois apresente:

```text
1. evidência A
2. evidência B
3. documentação relacionada
4. fluxo afetado
5. impacto de cada interpretação
6. decisão necessária
```

A resolução vem antes da implementação.

---

# 17. Quando encontrar algo não documentado

Não invente intenção.

Registre:

```text
🟢 CONFIRMADO
```

se o comportamento estiver comprovado, ou:

```text
🟡 VALIDAR
```

se a intenção de negócio não puder ser estabelecida.

Depois indique qual documento precisaria ser atualizado caso a interpretação seja aprovada.

---

# 18. Proibição de "melhorias" silenciosas

Uma IA não deve alterar comportamento apenas porque considera outra solução:

```text
mais limpa
mais moderna
mais elegante
mais RESTful
mais performática
mais padronizada
```

Esses podem ser argumentos para uma proposta.

Não são autorização para mudar o sistema.

---

# 19. Comunicação durante uma tarefa

Seja objetivo.

Durante investigação, reporte:

```text
STATUS
o que já foi comprovado

BLOQUEIO
o que impede avançar, se houver

EVIDÊNCIA
arquivo/função/estado relevante

HIPÓTESE
somente quando realmente necessária

PRÓXIMO PASSO
uma ação concreta
```

Não esconda incerteza atrás de linguagem afirmativa.

---

# 20. Definição de pronto

Uma tarefa funcional só está pronta quando:

```text
[ ] escopo aprovado foi implementado
[ ] contratos relevantes foram preservados
[ ] fluxo principal continua funcionando
[ ] persistência foi verificada
[ ] efeitos colaterais relevantes foram testados
[ ] legado relacionado foi preservado ou sua remoção foi aprovada
[ ] nenhuma questão VALIDAR foi decidida implicitamente
[ ] documentação afetada foi atualizada
[ ] resultado e limitações foram reportados
```

---

# 21. Resumo operacional para qualquer IA

Se houver pouco contexto, siga exatamente isto:

```text
LEIA CONTEXT.MD
      ↓
IDENTIFIQUE O DOMÍNIO
      ↓
LEIA O DOCUMENTO ESPECÍFICO
      ↓
LOCALIZE O FLUXO NO CÓDIGO
      ↓
LOCALIZE ESTADO + PERSISTÊNCIA + CONSUMIDORES
      ↓
CONFIRA BUSINESS-RULES + ADRs
      ↓
CLASSIFIQUE INCERTEZAS
      ↓
APRESENTE PLANO
      ↓
AGUARDE APROVAÇÃO
      ↓
FAÇA A MENOR MUDANÇA POSSÍVEL
      ↓
VALIDE O FLUXO COMPLETO
      ↓
ATUALIZE A DOCUMENTAÇÃO
```

A meta não é gerar código rapidamente.

A meta é **alterar o NIT sem perder conhecimento, identidade, estado, histórico ou comportamento operacional já consolidado**.

---

# 22. Estado documental

```text
ARCHITECTURE.md      ✓
DATA-MODEL.md        ✓
BUSINESS-RULES.md    ✓
WORKFLOW.md          ✓
CONTEXT.MD           ✓
DECISIONS.md + ADRs  ✓
AI-INSTRUCTIONS.md   ✓
TODO.md              ← próxima etapa
```

**Próximo passo documental:** construir `TODO.md` exclusivamente com questões abertas, investigações, pendências e melhorias comprovadamente identificadas — sem transformá-lo em depósito de ideias aleatórias.
