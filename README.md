# ⚽ Bolão Galileu — Copa do Mundo 2026

Bem-vindo ao **Bolão Galileu**! Reúna seus amigos, faça seus palpites e descubra quem realmente entende de futebol.

---

## 🏆 Como funciona

O Bolão Galileu é um sistema de palpites para a Copa do Mundo 2026. Cada participante se identifica com **nome** e **e-mail**, faz seus palpites nos jogos e acompanha o ranking em tempo real.

Os placares dos jogos são atualizados automaticamente via API conforme as partidas acontecem — sem necessidade de inserir resultados manualmente.

---

## 📋 Regras de Pontuação

### Palpites dos Jogos

| Resultado do Palpite                                                   | Pontos       |
| ---------------------------------------------------------------------- | ------------ |
| ✅ Acertou o **placar exato** (ex: palpitou 2×1 e o jogo terminou 2×1) | **3 pontos** |
| 🟡 Acertou o **vencedor** (ou o empate), mas errou o placar            | **1 ponto**  |
| ❌ Errou o resultado                                                   | **0 pontos** |

> **⚠️ Atenção:** O placar deve estar correto **para o time certo**. Se o jogo termina Argentina 2×1 Espanha e você palpitou 1×2 (Espanha vencendo), isso é considerado **erro** — mesmo que os números estejam invertidos. O placar de cada time é posicional.

### Chute Inicial (Palpite da Final)

Antes do início da Copa, cada participante pode fazer um **Chute Inicial**, prevendo:

- 🥇 Quem será o **Campeão**
- 🥈 Quem será o **Vice-Campeão**
- 📊 O **placar exato da final** (tempo regulamentar)

| Acerto                              | Pontos        |
| ----------------------------------- | ------------- |
| Acertou o **Campeão**               | **+7 pontos** |
| Acertou o **Vice-Campeão**          | **+3 pontos** |
| Acertou o **placar exato** da final | **+5 pontos** |

Os pontos do Chute Inicial são **cumulativos** — é possível somar até **15 pontos extras** acertando tudo.

---

## 🔒 Regras de Bloqueio dos Palpites

### Fase de Grupos

- O participante pode palpitar nos jogos das **3 rodadas** da fase de grupos e no **Chute Inicial**.
- **Ao iniciar o primeiro jogo da 1ª rodada**, todos os palpites da fase de grupos (Rodadas 1, 2 e 3) **e** o Chute Inicial são **bloqueados permanentemente**.
- Não é possível editar nenhum palpite da fase de grupos após esse momento.

### Fases Eliminatórias (Mata-Mata)

- Após a definição dos classificados de cada fase (16-avos, oitavas, quartas, semifinais e final), o sistema **libera os palpites** das novas partidas.
- Os palpites da fase eliminatória são **bloqueados quando o primeiro jogo daquela fase específica começar**.

### Resumo do Bloqueio

| Fase                             | Quando bloqueia                         |
| -------------------------------- | --------------------------------------- |
| Rodadas 1, 2 e 3 + Chute Inicial | Ao iniciar o **1º jogo da Rodada 1**    |
| 16-avos                          | Ao iniciar o **1º jogo dos 16-avos**    |
| Oitavas                          | Ao iniciar o **1º jogo das Oitavas**    |
| Quartas                          | Ao iniciar o **1º jogo das Quartas**    |
| Semifinais                       | Ao iniciar o **1º jogo das Semifinais** |
| Final                            | Ao iniciar a **Final**                  |

---

## 🏅 Ranking

O ranking é calculado automaticamente somando:

- **Pontos dos Jogos** — soma de todos os palpites (3 pontos por placar exato e resultado correto, ou 1 ponto por resultado correto (vitória ou empate))
- **Pontos do Chute Inicial** — calculados após a final ser disputada

Os participantes são ordenados do **maior para o menor** total de pontos.

---

## 🔑 Identificação e Resgate de Palpites

- O participante se identifica com **nome** e **e-mail** ao acessar o bolão.
- Os dados são salvos no navegador (localStorage) para acesso rápido.
- Caso limpe o cache do navegador, basta inserir o **mesmo e-mail** para resgatar todos os palpites realizados.
- O e-mail é a chave única de identificação — **use sempre o mesmo e-mail**.

---

## 📡 Atualização dos Resultados

Os placares são atualizados automaticamente:

- **Jogo ao vivo**: atualização a cada **30 segundos**
- **Sem jogos ao vivo**: atualização a cada **5 minutos**

Os resultados vêm da API [worldcup26.ir](https://worldcup26.ir), que fornece dados em tempo real da Copa do Mundo 2026.

---

**Boa sorte e bons palpites! ⚽🏆**
