# -*- coding: utf-8 -*-
"""
Backend do Bolão Galileu Copa 2026
Suporta SQLite (dev local) e PostgreSQL (Vercel)
Detecta automaticamente pelo env var POSTGRES_URL.
"""

import os
import requests
from datetime import datetime, timezone, timedelta
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ======================================================================
# CONFIGURAÇÃO DO BANCO DE DADOS (auto-detecta SQLite ou Postgres)
# ======================================================================
POSTGRES_URL = os.environ.get("POSTGRES_URL", "")

if POSTGRES_URL:
    import psycopg2
    # Vercel usa "postgres://" mas psycopg2 exige "postgresql://"
    if POSTGRES_URL.startswith("postgres://"):
        POSTGRES_URL = POSTGRES_URL.replace("postgres://", "postgresql://", 1)
    DB_TYPE = "postgres"
else:
    import sqlite3
    DB_TYPE = "sqlite"

WORLDCUP_API_URL = "https://worldcup26.ir/get/games"

# Fallback: ESPN API pública — sem chave, altamente confiável
ESPN_SCOREBOARD_URL = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard"

# Aliases de nomes ESPN → nomes worldcup26.ir (antes de traduzir para PT)
ESPN_NOME_ALIAS: dict = {
    "Bosnia & Herzegovina": "Bosnia and Herzegovina",
    "Bosnia-Herzegovina": "Bosnia and Herzegovina",
    "DR Congo": "Democratic Republic of the Congo",
    "Congo DR": "Democratic Republic of the Congo",
    "Democratic Republic of Congo": "Democratic Republic of the Congo",
    "USA": "United States",
    "Czechia": "Czech Republic",
    "Korea Republic": "South Korea",
    "Cote d'Ivoire": "Ivory Coast",
    "Côte d'Ivoire": "Ivory Coast",
}


def fetch_api_com_retry(url: str, tentativas: int = 2, timeout: int = 4) -> list:
    """Busca jogos da API externa com retry e backoff exponencial.
    Padrão conservador para caber no limite de 10s da Vercel Hobby:
      2 tentativas × 4s timeout + 1s de espera = ~9s no pior caso.
    Retorna a lista de jogos ou lança exceção após esgotar as tentativas."""
    import time
    ultimo_erro = None
    for i in range(tentativas):
        try:
            resp = requests.get(url, timeout=timeout)
            resp.raise_for_status()
            return resp.json().get("games", [])
        except Exception as e:
            ultimo_erro = e
            if i < tentativas - 1:
                time.sleep(1)  # 1s entre tentativas
    raise ultimo_erro


def q(sql: str) -> str:
    """Converte placeholders ? para %s quando usando PostgreSQL."""
    return sql.replace("?", "%s") if DB_TYPE == "postgres" else sql


def get_db():
    """Cria uma nova conexão com o banco de dados."""
    if DB_TYPE == "postgres":
        return psycopg2.connect(POSTGRES_URL)
    return sqlite3.connect("bolao.db")


def upsert_usuario(cursor, email: str, nome: str):
    """Insere um usuário se não existir (sintaxe difere entre SQLite e Postgres)."""
    if DB_TYPE == "postgres":
        cursor.execute(
            "INSERT INTO usuarios (email, nome) VALUES (%s, %s) ON CONFLICT DO NOTHING",
            (email, nome),
        )
    else:
        cursor.execute(
            "INSERT OR IGNORE INTO usuarios (email, nome) VALUES (?, ?)",
            (email, nome),
        )


# ======================================================================
# TRADUÇÃO DE TIMES (EN → PT) — Copa 2026
# ======================================================================
TRADUCAO_TIMES = {
    "Mexico": "México", "South Africa": "África do Sul",
    "South Korea": "Coreia do Sul", "Czech Republic": "Rep. Tcheca",
    "Canada": "Canadá", "Bosnia and Herzegovina": "Bósnia",
    "Qatar": "Catar", "Switzerland": "Suíça",
    "United States": "EUA", "Paraguay": "Paraguai",
    "Haiti": "Haiti", "Scotland": "Escócia",
    "Brazil": "Brasil", "Morocco": "Marrocos",
    "Australia": "Austrália", "Turkey": "Turquia",
    "Germany": "Alemanha", "Curaçao": "Curaçao",
    "Netherlands": "Holanda", "Japan": "Japão",
    "Sweden": "Suécia", "Tunisia": "Tunísia",
    "Belgium": "Bélgica", "Egypt": "Egito",
    "Iran": "Irã", "New Zealand": "Nova Zelândia",
    "Spain": "Espanha", "Cape Verde": "Cabo Verde",
    "Saudi Arabia": "Arábia Saudita", "Uruguay": "Uruguai",
    "France": "França", "Senegal": "Senegal",
    "Iraq": "Iraque", "Norway": "Noruega",
    "Argentina": "Argentina", "Algeria": "Argélia",
    "Austria": "Áustria", "Jordan": "Jordânia",
    "Portugal": "Portugal",
    "Democratic Republic of the Congo": "Rep. D. Congo",
    "Uzbekistan": "Uzbequistão", "Colombia": "Colômbia",
    "England": "Inglaterra", "Croatia": "Croácia",
    "Ghana": "Gana", "Panama": "Panamá",
    "Ivory Coast": "Costa do Marfim", "Ecuador": "Equador",
}


def espn_para_nome_db(espn_name: str) -> str:
    """Converte nome de time da ESPN (inglês) para o nome no banco (português)."""
    nome_en = ESPN_NOME_ALIAS.get(espn_name, espn_name)
    return TRADUCAO_TIMES.get(nome_en, nome_en)


def _placar_90_por_linhas(competidor: dict):
    total = 0
    encontrou_linha = False
    for linha in competidor.get("linescores", []):
        periodo_raw = linha.get("period") or linha.get("periodNumber")
        if periodo_raw is None:
            continue

        try:
            periodo = int(periodo_raw)
        except (TypeError, ValueError):
            continue

        if periodo not in (1, 2):
            continue

        valor = linha.get("value", linha.get("score", linha.get("displayValue", 0)))
        try:
            total += int(float(str(valor).replace(",", ".")))
            encontrou_linha = True
        except (TypeError, ValueError):
            continue

    return total if encontrou_linha else None


def fetch_espn_placares() -> list:
    """Busca jogos ao vivo/encerrados hoje via ESPN (fallback gratuito e confiável).
    Calcula gols de 90 min (excluindo extra time) via detalhes da partida."""
    resp = requests.get(ESPN_SCOREBOARD_URL, timeout=5)
    resp.raise_for_status()
    eventos = resp.json().get("events", [])

    resultados = []
    for evento in eventos:
        event_id = evento.get("id", "")
        comp = evento.get("competitions", [{}])[0]
        status = comp.get("status", {}).get("type", {})
        state = status.get("state", "pre")
        completed = status.get("completed", False)

        if state == "pre" and not completed:
            continue

        home_team = away_team = home_score = away_score = None
        home_score_90_linhas = away_score_90_linhas = None
        team_map = {}

        for c in comp.get("competitors", []):
            name = c.get("team", {}).get("displayName", "")
            team_id = c.get("id")
            score = int(c.get("score", 0))
            team_map[team_id] = {"name": name, "score": score, "home": c.get("homeAway") == "home"}
            if c.get("homeAway") == "home":
                home_team, home_score = name, score
                home_score_90_linhas = _placar_90_por_linhas(c)
            else:
                away_team, away_score = name, score
                away_score_90_linhas = _placar_90_por_linhas(c)

        home_90 = home_score_90_linhas
        away_90 = away_score_90_linhas

        if home_90 is None or away_90 is None:
            # Calcula 90min: soma apenas gols (scoringPlay) com clock <= 5400s (90 min).
            # Se a ESPN não trouxer detalhes de gols, não grava 0x0 artificial.
            home_90_detalhes = away_90_detalhes = 0
            encontrou_gol = False
            details = comp.get("details", [])
            for detail in details:
                if not detail.get("scoringPlay", False):
                    continue  # ignora cartões e outros eventos
                if detail.get("shootout", False):
                    continue  # ignora pênaltis de disputa
                encontrou_gol = True
                clock = detail.get("clock", {}).get("value", 0)
                if float(clock) > 5400:
                    continue  # gol em prorrogação — não conta nos 90min
                team_id = detail.get("team", {}).get("id")
                score_value = int(detail.get("scoreValue", 1))
                own_goal = detail.get("ownGoal", False)
                if team_id in team_map:
                    is_home = team_map[team_id]["home"]
                    # NOTA: Na ESPN, team_id no scoringPlay já indica o time beneficiado (que recebe o gol),
                    # mesmo quando ownGoal=True. Não devemos inverter is_home.
                    if is_home:
                        home_90_detalhes += score_value
                    else:
                        away_90_detalhes += score_value

            if encontrou_gol or (home_score == 0 and away_score == 0):
                home_90 = home_90_detalhes
                away_90 = away_90_detalhes

        if home_team is not None and away_team is not None:
            resultados.append({
                "home_team_db": espn_para_nome_db(home_team),
                "away_team_db": espn_para_nome_db(away_team),
                "home_score": home_score,
                "away_score": away_score,
                "home_score_90": home_90,
                "away_score_90": away_90,
                "event_id": event_id,
                "ao_vivo": state == "in",
                "completed": completed,
            })

    return resultados


# Offsets UTC dos estádios (para converter horário local → UTC)
STADIUMS_UTC_OFFSET = {
    "1": 6, "2": 6, "3": 6,          # México (UTC-6)
    "4": 5, "5": 5, "6": 5,          # CDT (UTC-5)
    "7": 4, "8": 4, "9": 4,          # EDT (UTC-4)
    "10": 4, "11": 4, "12": 4,
    "13": 7, "14": 7, "15": 7, "16": 7,  # PDT (UTC-7)
}


# ======================================================================
# MODELOS PYDANTIC
# ======================================================================
class NovoPalpiteModel(BaseModel):
    email_usuario: str
    jogo_id: str
    gols_a: int
    gols_b: int


class NovoChuteInicialModel(BaseModel):
    email_usuario: str
    campeao: str
    vice_campeao: str
    placar_final_a: int
    placar_final_b: int


# ======================================================================
# INICIALIZAÇÃO DO BANCO
# ======================================================================
def init_db():
    conn = get_db()
    cursor = conn.cursor()

    auto_id = (
        "SERIAL PRIMARY KEY"
        if DB_TYPE == "postgres"
        else "INTEGER PRIMARY KEY AUTOINCREMENT"
    )

    cursor.execute(
        """CREATE TABLE IF NOT EXISTS jogos (
        jogo_id TEXT PRIMARY KEY,
        time_a TEXT,
        time_b TEXT,
        fase TEXT,
        data_hora TEXT
    )"""
    )

    cursor.execute(
        """CREATE TABLE IF NOT EXISTS resultados_oficiais (
        jogo_id TEXT PRIMARY KEY,
        gols_a INTEGER,
        gols_b INTEGER,
        gols_a_90 INTEGER,
        gols_b_90 INTEGER
    )"""
    )

    # Migração: adiciona colunas de placar 90 min em bancos existentes
    for col in ("gols_a_90", "gols_b_90"):
        try:
            cursor.execute(f"ALTER TABLE resultados_oficiais ADD COLUMN {col} INTEGER")
            conn.commit()
        except Exception:
            conn.rollback()  # Postgres invalida a transação após erro; precisa de rollback

    # Migração: adiciona coluna fonte
    try:
        cursor.execute("ALTER TABLE resultados_oficiais ADD COLUMN fonte TEXT DEFAULT 'worldcup'")
        conn.commit()
    except Exception:
        conn.rollback()

    cursor.execute(
        f"""CREATE TABLE IF NOT EXISTS palpites (
        id {auto_id},
        email_usuario TEXT,
        jogo_id TEXT,
        gols_a INTEGER,
        gols_b INTEGER,
        dtahrinclusao TEXT,
        dtahralteracao TEXT,
        UNIQUE(email_usuario, jogo_id)
    )"""
    )

    # Migração: adiciona colunas em bancos existentes que ainda não as têm
    for col in ("dtahrinclusao", "dtahralteracao"):
        try:
            cursor.execute(f"ALTER TABLE palpites ADD COLUMN {col} TEXT")
        except Exception:
            pass  # coluna já existe

    cursor.execute(
        """CREATE TABLE IF NOT EXISTS usuarios (
        email TEXT PRIMARY KEY,
        nome TEXT
    )"""
    )

    cursor.execute(
        """CREATE TABLE IF NOT EXISTS chute_inicial (
        email_usuario TEXT PRIMARY KEY,
        campeao TEXT,
        vice TEXT,
        gols_a INTEGER,
        gols_b INTEGER
    )"""
    )

    conn.commit()
    conn.close()


try:
    init_db()
except Exception as e:
    print(f"Aviso: Erro ao inicializar banco: {e}")


# ======================================================================
# FASTAPI APP
# ======================================================================
app = FastAPI(title="API Bolão Copa 2026")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ======================================================================
# FUNÇÕES AUXILIARES DE BLOQUEIO
# ======================================================================
def is_fase_grupos_bloqueada(cursor) -> bool:
    """Retorna True se o primeiro jogo da Rodada 1 já começou.
    REGRA: bloqueia TODA a fase de grupos (Rodadas 1, 2 e 3) + Chute Inicial."""
    cursor.execute(
        q("SELECT MIN(data_hora) FROM jogos WHERE fase = ?"), ("Rodada 1",)
    )
    row = cursor.fetchone()
    primeiro_jogo_str = row[0] if row else None
    if not primeiro_jogo_str:
        return False
    try:
        primeiro_jogo_dt = datetime.fromisoformat(
            str(primeiro_jogo_str).replace("Z", "+00:00")
        )
    except Exception:
        return False
    return datetime.now(timezone.utc) >= primeiro_jogo_dt


def is_rodada_bloqueada(fase: str, cursor) -> bool:
    """Verifica se uma fase está bloqueada para palpites."""
    # Fase de grupos: bloqueia TUDO quando Rodada 1 começa
    if fase in ("Rodada 1", "Rodada 2", "Rodada 3"):
        return is_fase_grupos_bloqueada(cursor)

    # 3º Lugar e Final bloqueiam juntos (quando o primeiro jogo de qualquer um começa)
    if fase in ("3º Lugar", "Final"):
        cursor.execute("SELECT MIN(data_hora) FROM jogos WHERE fase IN ('3º Lugar', 'Final')")
    else:
        # Demais fases de mata-mata: bloqueia quando o primeiro jogo DA FASE específica começa
        cursor.execute(q("SELECT MIN(data_hora) FROM jogos WHERE fase = ?"), (fase,))
    row = cursor.fetchone()
    primeiro_jogo_str = row[0] if row else None
    if not primeiro_jogo_str:
        return False
    try:
        primeiro_jogo_dt = datetime.fromisoformat(
            str(primeiro_jogo_str).replace("Z", "+00:00")
        )
    except Exception:
        return False
    return datetime.now(timezone.utc) >= primeiro_jogo_dt


def mapear_fase(jogo: dict) -> str:
    """Converte type/matchday da API worldcup26.ir para a fase do bolão."""
    tipo = jogo.get("type", "")
    matchday = str(jogo.get("matchday", ""))
    if tipo == "group":
        if matchday == "1":
            return "Rodada 1"
        if matchday == "2":
            return "Rodada 2"
        if matchday == "3":
            return "Rodada 3"
    if tipo == "r32":
        return "16-avos"
    if tipo == "r16":
        return "Oitavas"
    if tipo == "qf":
        return "Quartas"
    if tipo == "sf":
        return "Semi"
    if tipo == "third":
        return "3º Lugar"
    if tipo == "final":
        return "Final"
    return tipo.upper()


def converter_data_para_utc(local_date_str: str, stadium_id) -> str:
    """Converte data local MM/DD/YYYY HH:MM para ISO 8601 UTC."""
    try:
        dt_local = datetime.strptime(local_date_str, "%m/%d/%Y %H:%M")
        offset = STADIUMS_UTC_OFFSET.get(str(stadium_id), 5)
        dt_utc = dt_local + timedelta(hours=offset)
        return dt_utc.strftime("%Y-%m-%dT%H:%M:%S+00:00")
    except Exception:
        return local_date_str


_PLACEHOLDERS = (
    'winner', 'runner-up', 'loser', '3rd', 'group', 'match', 'time a',
    'time b', '#', 'vencedor', 'perdedor', 'jogo', 'grupo', 'tbd',
    'to be determined', 'a definir'
)


def _is_placeholder(name: str) -> bool:
    """Retorna True se o nome do time é um placeholder (não é um time real)."""
    if not name:
        return True
    lower = name.lower()
    return any(p in lower for p in _PLACEHOLDERS)


def traduzir_label(label: str) -> str:
    """Traduz labels de mata-mata em inglês para português."""
    if not label:
        return label
    res = label
    res = res.replace('Winner Group', '1º do Grupo').replace('Runner-up Group', '2º do Grupo').replace('3rd Group', '3º do Grupo')
    res = res.replace('Winner Match', 'Vencedor Jogo').replace('Loser Match', 'Perdedor Jogo')
    return res


# ======================================================================
# ROTAS DA API
# ======================================================================
@app.get("/api/")
def read_root():
    return {"status": "API do Bolão rodando com sucesso!", "db": DB_TYPE}


@app.get("/api/jogos")
def listar_jogos():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT jogo_id, time_a, time_b, fase, data_hora FROM jogos ORDER BY data_hora ASC"
    )
    resultados = cursor.fetchall()
    conn.close()

    # Listagem precisa ser rápida: não bloqueia a tela tentando resolver placeholders.
    # Se o banco estiver vazio, faz bootstrap; confrontos do mata-mata são atualizados
    # por /api/sync-teams, cron diário ou chamada em segundo plano do frontend.
    if not resultados:
        try:
            sincronizar_completo()
            conn = get_db()
            cursor = conn.cursor()
            cursor.execute(
                "SELECT jogo_id, time_a, time_b, fase, data_hora FROM jogos ORDER BY data_hora ASC"
            )
            resultados = cursor.fetchall()
            conn.close()
        except Exception as e:
            print(f"Aviso: Sincronização automática inicial falhou: {e}")

    return [
        {
            "jogo_id": r[0],
            "time_a": r[1],
            "time_b": r[2],
            "fase": r[3],
            "data_hora": r[4],
        }
        for r in resultados
    ]


@app.post("/api/palpites")
def salvar_palpite_real(dados: NovoPalpiteModel):
    conn = get_db()
    cursor = conn.cursor()

    # Descobre a fase do jogo e testa bloqueio
    cursor.execute(q("SELECT fase FROM jogos WHERE jogo_id = ?"), (dados.jogo_id,))
    fase_resultado = cursor.fetchone()

    if fase_resultado and is_rodada_bloqueada(fase_resultado[0], cursor):
        conn.close()
        raise HTTPException(
            status_code=403, detail="A rodada já começou. Palpites bloqueados!"
        )

    upsert_usuario(cursor, dados.email_usuario, dados.email_usuario.split("@")[0])

    agora = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S+00:00")

    cursor.execute(
        q(
            """INSERT INTO palpites (email_usuario, jogo_id, gols_a, gols_b, dtahrinclusao)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(email_usuario, jogo_id)
        DO UPDATE SET gols_a=excluded.gols_a, gols_b=excluded.gols_b,
                      dtahralteracao=?"""
        ),
        (dados.email_usuario, dados.jogo_id, dados.gols_a, dados.gols_b, agora, agora),
    )

    conn.commit()
    conn.close()
    return {"status": "sucesso", "mensagem": "Palpite gravado!"}


@app.get("/api/palpites/{email}")
def buscar_palpites_usuario(email: str):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        q("SELECT jogo_id, gols_a, gols_b FROM palpites WHERE email_usuario = ?"),
        (email,),
    )
    resultados = cursor.fetchall()
    conn.close()
    return {r[0]: {"gols_a": r[1], "gols_b": r[2]} for r in resultados}


@app.post("/api/chute")
def salvar_chute_real(dados: NovoChuteInicialModel):
    conn = get_db()
    cursor = conn.cursor()

    # REGRA: Chute Inicial bloqueado quando fase de grupos começa
    if is_fase_grupos_bloqueada(cursor):
        conn.close()
        raise HTTPException(
            status_code=403,
            detail="A fase de grupos já começou. Chute Inicial bloqueado!",
        )

    upsert_usuario(cursor, dados.email_usuario, dados.email_usuario.split("@")[0])

    cursor.execute(
        q(
            """INSERT INTO chute_inicial (email_usuario, campeao, vice, gols_a, gols_b)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(email_usuario)
        DO UPDATE SET campeao=excluded.campeao, vice=excluded.vice,
                      gols_a=excluded.gols_a, gols_b=excluded.gols_b"""
        ),
        (
            dados.email_usuario,
            dados.campeao,
            dados.vice_campeao,
            dados.placar_final_a,
            dados.placar_final_b,
        ),
    )

    conn.commit()
    conn.close()
    return {"status": "sucesso", "mensagem": "Chute Inicial salvo com sucesso!"}


@app.get("/api/chute/{email}")
def buscar_chute_usuario(email: str):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        q("SELECT campeao, vice, gols_a, gols_b FROM chute_inicial WHERE email_usuario = ?"),
        (email,),
    )
    resultado = cursor.fetchone()
    conn.close()
    if resultado:
        return {
            "campeao": resultado[0],
            "vice_campeao": resultado[1],
            "placar_final_a": resultado[2],
            "placar_final_b": resultado[3],
        }
    return None


@app.get("/api/palpites-fase/{fase}")
def buscar_palpites_fase(fase: str):
    conn = get_db()
    cursor = conn.cursor()

    if not is_rodada_bloqueada(fase, cursor):
        conn.close()
        raise HTTPException(
            status_code=403,
            detail="Os palpites dos outros jogadores só serão revelados após o início do primeiro jogo da rodada.",
        )

    cursor.execute(
        q(
            """SELECT u.nome, p.jogo_id, p.gols_a, p.gols_b
        FROM palpites p
        JOIN usuarios u ON p.email_usuario = u.email
        JOIN jogos j ON p.jogo_id = j.jogo_id
        WHERE j.fase = ?"""
        ),
        (fase,),
    )
    resultados = cursor.fetchall()
    conn.close()

    palpites_galera: dict = {}
    for nome, jogo_id, gols_a, gols_b in resultados:
        if jogo_id not in palpites_galera:
            palpites_galera[jogo_id] = []
        palpites_galera[jogo_id].append(
            {"nome": nome, "gols_a": gols_a, "gols_b": gols_b}
        )
    return palpites_galera


@app.get("/api/resultados")
def buscar_resultados_oficiais():
    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT jogo_id, gols_a, gols_b, gols_a_90, gols_b_90 FROM resultados_oficiais")
        resultados = cursor.fetchall()
        conn.close()
        resultado_dict = {}
        for r in resultados:
            entry = {"gols_a": r[1], "gols_b": r[2]}
            if r[3] is not None and r[4] is not None:
                entry["gols_a_90"] = r[3]
                entry["gols_b_90"] = r[4]
            resultado_dict[r[0]] = entry
        return resultado_dict
    except Exception:
        conn.rollback()
        # Fallback: colunas 90 min não existem ainda
        cursor.execute("SELECT jogo_id, gols_a, gols_b FROM resultados_oficiais")
        resultados = cursor.fetchall()
        conn.close()
        return {r[0]: {"gols_a": r[1], "gols_b": r[2]} for r in resultados}


@app.post("/api/sync-live")
@app.get("/api/sync-live")
def sincronizar_placares_ao_vivo():
    """Busca placares ao vivo/encerrados via ESPN e atualiza resultados oficiais.
    ESPN é a fonte primária — gratuita, confiável e atualiza em tempo real.
    Inclui placar de 90 min regulamentares para jogos de mata-mata (via linescores)."""

    conn = get_db()
    cursor = conn.cursor()
    atualizados = 0
    ao_vivo = 0

    try:
        jogos_espn = fetch_espn_placares()
        for jogo in jogos_espn:
            if jogo["ao_vivo"]:
                ao_vivo += 1

            home_db = jogo["home_team_db"]
            away_db = jogo["away_team_db"]
            h_score = int(jogo["home_score"])
            a_score = int(jogo["away_score"])

            # Tenta ordem normal: ESPN home=time_a, ESPN away=time_b
            cursor.execute(
                q("SELECT jogo_id, fase FROM jogos WHERE time_a = ? AND time_b = ? LIMIT 1"),
                (home_db, away_db),
            )
            row = cursor.fetchone()
            gols_a, gols_b = h_score, a_score  # ordem normal
            invertido = False

            if not row:
                # ESPN pode inverter home/away — tenta ordem oposta
                cursor.execute(
                    q("SELECT jogo_id, fase FROM jogos WHERE time_a = ? AND time_b = ? LIMIT 1"),
                    (away_db, home_db),
                )
                row = cursor.fetchone()
                if row:
                    gols_a, gols_b = a_score, h_score
                    invertido = True

            if row:
                jogo_id = row[0]
                fase = row[1]
                is_matamata = fase not in ("Rodada 1", "Rodada 2", "Rodada 3")

                # Placar de 90 min regulamentares (para mata-mata)
                gols_a_90 = gols_b_90 = None
                if is_matamata:
                    h90 = jogo.get("home_score_90")
                    a90 = jogo.get("away_score_90")
                    if h90 is not None and a90 is not None:
                        gols_a_90 = a90 if invertido else h90
                        gols_b_90 = h90 if invertido else a90

                try:
                    if gols_a_90 is not None and gols_b_90 is not None:
                        cursor.execute(
                            q("""INSERT INTO resultados_oficiais (jogo_id, gols_a, gols_b, gols_a_90, gols_b_90, fonte)
                            VALUES (?, ?, ?, ?, ?, 'ESPN')
                            ON CONFLICT(jogo_id) DO UPDATE SET
                            gols_a=excluded.gols_a, gols_b=excluded.gols_b,
                            gols_a_90=excluded.gols_a_90, gols_b_90=excluded.gols_b_90, fonte='ESPN'"""),
                            (jogo_id, gols_a, gols_b, gols_a_90, gols_b_90),
                        )
                    else:
                        cursor.execute(
                            q("""INSERT INTO resultados_oficiais (jogo_id, gols_a, gols_b, fonte)
                            VALUES (?, ?, ?, 'ESPN')
                            ON CONFLICT(jogo_id) DO UPDATE SET
                            gols_a=excluded.gols_a, gols_b=excluded.gols_b, fonte='ESPN'"""),
                            (jogo_id, gols_a, gols_b),
                        )
                    atualizados += 1
                except (ValueError, TypeError):
                    pass

    except Exception as e:
        conn.rollback()
        conn.close()
        raise HTTPException(
            status_code=503,
            detail=f"ESPN API falhou: {str(e)}",
        )

    conn.commit()
    conn.close()

    return {
        "status": "sucesso",
        "fonte": "ESPN",
        "jogos_atualizados": atualizados,
        "jogos_ao_vivo": ao_vivo,
        "mensagem": f"{atualizados} placar(es) sincronizado(s) via ESPN",
    }


@app.get("/api/jogos-ao-vivo")
def verificar_jogos_ao_vivo():
    try:
        jogos_espn = fetch_espn_placares()
        ao_vivo = [j for j in jogos_espn if j.get("ao_vivo")]
        return {"ao_vivo": len(ao_vivo) > 0, "quantidade": len(ao_vivo), "fonte": "ESPN"}
    except Exception:
        return {"ao_vivo": False, "quantidade": 0, "fonte": "ESPN"}


@app.get("/api/status-bloqueio")
def verificar_status_bloqueio():
    """Endpoint para o frontend verificar o status de bloqueio."""
    conn = get_db()
    cursor = conn.cursor()
    grupos_bloqueada = is_fase_grupos_bloqueada(cursor)
    conn.close()
    return {
        "fase_grupos_bloqueada": grupos_bloqueada,
        "chute_inicial_bloqueado": grupos_bloqueada,
    }


@app.get("/api/fix-quartas")
def fix_quartas():
    """Correção pontual: reseta jogo j_100 que foi incorretamente preenchido
    com Noruega x Inglaterra pelo antigo algoritmo de matching ESPN.
    O time_a correto é Argentina e time_b deve aguardar o vencedor de
    Colômbia x Suíça (oitavas, jogo 96)."""
    conn = get_db()
    cursor = conn.cursor()

    # Verifica o estado atual de j_100
    cursor.execute(q("SELECT time_a, time_b FROM jogos WHERE jogo_id = ?"), ("j_100",))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return {"status": "nenhum_jogo", "mensagem": "Jogo j_100 não encontrado."}

    time_a_atual, time_b_atual = row[0], row[1]

    # Corrige: time_a deve ser Argentina, time_b deve ser placeholder
    # (será preenchido quando o vencedor de Colômbia x Suíça for definido)
    cursor.execute(
        q("UPDATE jogos SET time_a = ?, time_b = ? WHERE jogo_id = ?"),
        ("Argentina", "Vencedor Jogo 96", "j_100"),
    )
    conn.commit()

    # Tenta atualizar via ESPN caso o vencedor já esteja definido
    try:
        atualizar_times_matamata_espn(cursor)
        conn.commit()
    except Exception:
        pass

    conn.close()
    return {
        "status": "corrigido",
        "antes": {"time_a": time_a_atual, "time_b": time_b_atual},
        "depois": {"time_a": "Argentina", "time_b": "Vencedor Jogo 96 (ou atualizado via ESPN)"},
    }


@app.get("/api/ranking")
def buscar_ranking():
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT email, nome FROM usuarios")
    usuarios = cursor.fetchall()

    try:
        cursor.execute("SELECT jogo_id, gols_a, gols_b, gols_a_90, gols_b_90 FROM resultados_oficiais")
        resultados = {}
        for row in cursor.fetchall():
            resultados[row[0]] = {
                "gols_a": row[1], "gols_b": row[2],
                "gols_a_90": row[3], "gols_b_90": row[4],
            }
    except Exception:
        conn.rollback()
        cursor.execute("SELECT jogo_id, gols_a, gols_b FROM resultados_oficiais")
        resultados = {}
        for row in cursor.fetchall():
            resultados[row[0]] = {
                "gols_a": row[1], "gols_b": row[2],
                "gols_a_90": None, "gols_b_90": None,
            }

    cursor.execute("SELECT email_usuario, jogo_id, gols_a, gols_b FROM palpites")
    palpites = cursor.fetchall()

    cursor.execute(
        "SELECT email_usuario, campeao, vice, gols_a, gols_b FROM chute_inicial"
    )
    chutes = cursor.fetchall()

    # Verificar se a final foi disputada (dados REAIS, sem mock)
    # Busca placar de 90 min (gols_a_90/gols_b_90) para o Chute Inicial
    cursor.execute(
        q(
            """SELECT j.time_a, j.time_b, r.gols_a, r.gols_b, r.gols_a_90, r.gols_b_90
        FROM jogos j
        JOIN resultados_oficiais r ON j.jogo_id = r.jogo_id
        WHERE j.fase = ?
        ORDER BY j.data_hora DESC
        LIMIT 1"""
        ),
        ("Final",),
    )
    final_row = cursor.fetchone()

    conn.close()

    # Prepara ranking base
    ranking_dit: dict = {}
    for email, nome in usuarios:
        ranking_dit[email] = {
            "nome": nome,
            "email": email,
            "pontos_jogos": 0,
            "pontos_inicial": 0,
            "pontos_totais": 0,
        }

    # Calcula pontos dos palpites de jogos
    # REGRA: usa placar de 90 min regulamentares (sem prorrogação) quando disponível
    for email, jogo_id, p_gols_a, p_gols_b in palpites:
        if jogo_id in resultados:
            res = resultados[jogo_id]
            # Prefere placar de 90 min; se não existir, usa o placar total (fase de grupos)
            r_gols_a = res["gols_a_90"] if res.get("gols_a_90") is not None else res["gols_a"]
            r_gols_b = res["gols_b_90"] if res.get("gols_b_90") is not None else res["gols_b"]

            pontos = 0
            # Placar exato → 3 pontos
            if p_gols_a == r_gols_a and p_gols_b == r_gols_b:
                pontos = 3
            # Acertou vencedor/empate → 1 ponto
            elif (
                (p_gols_a > p_gols_b and r_gols_a > r_gols_b)
                or (p_gols_a < p_gols_b and r_gols_a < r_gols_b)
                or (p_gols_a == p_gols_b and r_gols_a == r_gols_b)
            ):
                pontos = 1

            if email in ranking_dit:
                ranking_dit[email]["pontos_jogos"] += pontos
                ranking_dit[email]["pontos_totais"] += pontos

    # Chute Inicial — Só calcula se a final foi disputada (dados REAIS)
    if final_row:
        time_a_final, time_b_final, gols_a_final, gols_b_final = final_row[:4]
        # Placar de 90 min para o Chute Inicial (se disponível, senão usa total)
        gols_a_90_final = final_row[4] if len(final_row) > 4 and final_row[4] is not None else gols_a_final
        gols_b_90_final = final_row[5] if len(final_row) > 5 and final_row[5] is not None else gols_b_final

        # Campeão/vice é determinado pelo placar TOTAL (quem ganhou o jogo)
        campeao_real = None
        vice_real = None
        if gols_a_final > gols_b_final:
            campeao_real = time_a_final
            vice_real = time_b_final
        elif gols_b_final > gols_a_final:
            campeao_real = time_b_final
            vice_real = time_a_final

        if campeao_real and vice_real:
            for email, c_campeao, c_vice, c_gols_a, c_gols_b in chutes:
                if email in ranking_dit:
                    pontos_chute = 0
                    if c_campeao == campeao_real:
                        pontos_chute += 7
                    if c_vice == vice_real:
                        pontos_chute += 3
                    # Placar do Chute Inicial compara com 90 min regulamentares
                    if c_gols_a == gols_a_90_final and c_gols_b == gols_b_90_final:
                        pontos_chute += 5
                    ranking_dit[email]["pontos_inicial"] += pontos_chute
                    ranking_dit[email]["pontos_totais"] += pontos_chute

    lista_ranking = list(ranking_dit.values())
    lista_ranking.sort(key=lambda x: x["pontos_totais"], reverse=True)
    return lista_ranking


# ======================================================================
# ATUALIZAÇÃO DE TIMES DO MATA-MATA VIA ESPN
# ======================================================================
ESPN_SCHEDULE_URL = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=20260628-20260719&limit=200"


def _parse_datetime_utc(valor):
    if not valor:
        return None
    try:
        dt = datetime.fromisoformat(str(valor).replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except Exception:
        return None


def atualizar_times_matamata_espn(cursor) -> int:
    """Atualiza nomes de times do mata-mata usando ESPN como fonte primária.
    Só atualiza jogos que ainda têm times com placeholders (indefinidos).
    Retorna o número de jogos atualizados."""

    try:
        resp = requests.get(ESPN_SCHEDULE_URL, timeout=8)
        resp.raise_for_status()
        eventos = resp.json().get("events", [])
    except Exception as e:
        print(f"Aviso: ESPN schedule fetch falhou: {e}")
        return 0

    eventos_espn: list = []
    for evento in eventos:
        date_str = evento.get("date", "")
        dt_espn = _parse_datetime_utc(date_str)
        if not dt_espn:
            continue

        comp = evento.get("competitions", [{}])[0]

        home_team = away_team = None
        for c in comp.get("competitors", []):
            name = c.get("team", {}).get("displayName", "")
            if c.get("homeAway") == "home":
                home_team = name
            else:
                away_team = name

        if not home_team or not away_team:
            continue

        home_db = espn_para_nome_db(home_team)
        away_db = espn_para_nome_db(away_team)
        if _is_placeholder(home_db) or _is_placeholder(away_db):
            continue

        eventos_espn.append({
            "dt": dt_espn,
            "home_db": home_db,
            "away_db": away_db,
            "usado": False,
        })

    eventos_espn.sort(key=lambda e: e["dt"])

    # Busca todos os jogos de mata-mata no banco
    cursor.execute(
        "SELECT jogo_id, time_a, time_b, fase, data_hora FROM jogos "
        "WHERE fase NOT IN ('Rodada 1', 'Rodada 2', 'Rodada 3') "
        "ORDER BY data_hora ASC"
    )
    jogos_db = cursor.fetchall()

    atualizados = 0

    # Pré-marca como "usado" eventos ESPN que já correspondem a jogos com
    # times reais no banco.  Isso impede que um evento (ex: Norway vs England)
    # seja reutilizado para preencher outro jogo cujo adversário ainda é placeholder.
    for _jid, time_a, time_b, _fase, _dh in jogos_db:
        if _is_placeholder(time_a) or _is_placeholder(time_b):
            continue  # será resolvido no loop seguinte
        for entry in eventos_espn:
            if entry["usado"]:
                continue
            if (entry["home_db"] == time_a and entry["away_db"] == time_b) or \
               (entry["home_db"] == time_b and entry["away_db"] == time_a):
                entry["usado"] = True
                break

    for jogo_id, time_a, time_b, _fase, data_hora in jogos_db:
        # Só atualiza se pelo menos um time é placeholder.
        if not _is_placeholder(time_a) and not _is_placeholder(time_b):
            continue

        dt_db = _parse_datetime_utc(data_hora)
        if not dt_db:
            continue

        candidatos = []
        for entry in eventos_espn:
            if entry["usado"]:
                continue

            diferenca = abs((entry["dt"] - dt_db).total_seconds())
            mesma_data = entry["dt"].date() == dt_db.date()
            if diferenca <= 6 * 60 * 60 or mesma_data:
                prioridade = 0 if diferenca <= 6 * 60 * 60 else 1
                candidatos.append((prioridade, diferenca, entry))

        if not candidatos:
            continue

        candidatos.sort(key=lambda c: (c[0], c[1]))
        entry = candidatos[0][2]
        cursor.execute(
            q("UPDATE jogos SET time_a = ?, time_b = ? WHERE jogo_id = ?"),
            (entry["home_db"], entry["away_db"], jogo_id),
        )
        entry["usado"] = True
        atualizados += 1

    return atualizados


@app.post("/api/sync-teams")
@app.get("/api/sync-teams")
def sincronizar_times_matamata():
    """Atualiza nomes de times do mata-mata via ESPN (endpoint independente)."""
    conn = get_db()
    cursor = conn.cursor()
    atualizados = atualizar_times_matamata_espn(cursor)
    conn.commit()
    conn.close()
    return {
        "status": "sucesso",
        "times_atualizados": atualizados,
        "mensagem": f"{atualizados} time(s) do mata-mata atualizado(s) via ESPN.",
    }


@app.post("/api/sync-full")
@app.get("/api/sync-full")
def sincronizar_completo():
    """Sincroniza TODOS os jogos da API worldcup26.ir (setup inicial + atualização de times do mata-mata)."""
    erro_worldcup = None
    try:
        jogos_api = fetch_api_com_retry(WORLDCUP_API_URL)
    except Exception as e:
        jogos_api = []
        erro_worldcup = e

    conn = get_db()
    cursor = conn.cursor()

    inseridos = 0
    resultados_inseridos = 0

    if jogos_api:
        # Limpa jogos antigos e reinsere
        cursor.execute("DELETE FROM jogos")

        for jogo in jogos_api:
            jogo_id = f"j_{jogo['id']}"
            tipo = jogo.get("type", "")

            # Traduz nomes dos times
            if tipo == "group":
                nome_en_a = jogo.get("home_team_name_en", "")
                nome_en_b = jogo.get("away_team_name_en", "")
                time_a = TRADUCAO_TIMES.get(nome_en_a, nome_en_a)
                time_b = TRADUCAO_TIMES.get(nome_en_b, nome_en_b)
            else:
                # Mata-mata: tenta nome traduzido, senão nome em inglês, senão label traduzido
                nome_en_a = jogo.get("home_team_name_en", "")
                nome_en_b = jogo.get("away_team_name_en", "")
                time_a = TRADUCAO_TIMES.get(nome_en_a, nome_en_a) if nome_en_a else ""
                time_b = TRADUCAO_TIMES.get(nome_en_b, nome_en_b) if nome_en_b else ""
                if not time_a:
                    time_a = traduzir_label(jogo.get("home_team_label", f"Time A #{jogo['id']}"))
                if not time_b:
                    time_b = traduzir_label(jogo.get("away_team_label", f"Time B #{jogo['id']}"))

            fase = mapear_fase(jogo)
            stadium_id = jogo.get("stadium_id", "1")
            local_date = jogo.get("local_date", "")
            data_hora = converter_data_para_utc(local_date, stadium_id)

            cursor.execute(
                q(
                    """INSERT INTO jogos (jogo_id, time_a, time_b, fase, data_hora)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(jogo_id) DO UPDATE SET
                    time_a=excluded.time_a, time_b=excluded.time_b,
                    fase=excluded.fase, data_hora=excluded.data_hora"""
                ),
                (jogo_id, time_a, time_b, fase, data_hora),
            )
            inseridos += 1

            # Atualiza resultado se o jogo foi disputado
            finished = str(jogo.get("finished", "FALSE")).upper() == "TRUE"
            gols_a = jogo.get("home_score", None)
            gols_b = jogo.get("away_score", None)

            if finished and gols_a is not None and gols_b is not None:
                try:
                    cursor.execute(q("SELECT fonte FROM resultados_oficiais WHERE jogo_id = ?"), (jogo_id,))
                    row = cursor.fetchone()
                    if row and row[0] == 'ESPN':
                        continue  # Não sobrescreve resultado vindo da ESPN

                    cursor.execute(
                        q(
                            """INSERT INTO resultados_oficiais (jogo_id, gols_a, gols_b, fonte)
                        VALUES (?, ?, ?, 'worldcup')
                        ON CONFLICT(jogo_id) DO UPDATE SET gols_a=excluded.gols_a, gols_b=excluded.gols_b, fonte='worldcup'"""
                        ),
                        (jogo_id, int(gols_a), int(gols_b)),
                    )
                    resultados_inseridos += 1
                except (ValueError, TypeError):
                    pass
    else:
        cursor.execute("SELECT COUNT(*) FROM jogos")
        total_jogos = cursor.fetchone()[0]
        if total_jogos == 0:
            conn.close()
            detalhe = "Nenhum jogo retornado pela API."
            if erro_worldcup:
                detalhe = f"Erro ao conectar na API após retries: {str(erro_worldcup)}"
            raise HTTPException(status_code=503, detail=detalhe)

    # Atualiza times do mata-mata via ESPN (sobrescreve placeholders)
    espn_atualizados = 0
    try:
        espn_atualizados = atualizar_times_matamata_espn(cursor)
    except Exception as e:
        print(f"Aviso: Atualização ESPN falhou (não crítico): {e}")

    conn.commit()
    conn.close()

    status_sync = "sucesso" if jogos_api else "parcial"
    origem = "worldcup26.ir + ESPN" if jogos_api else "ESPN"

    return {
        "status": status_sync,
        "fonte": origem,
        "jogos_inseridos": inseridos,
        "resultados_inseridos": resultados_inseridos,
        "times_espn_atualizados": espn_atualizados,
        "mensagem": f"Sincronização {status_sync}! {inseridos} jogos, {resultados_inseridos} resultados, {espn_atualizados} times atualizados via ESPN.",
    }
