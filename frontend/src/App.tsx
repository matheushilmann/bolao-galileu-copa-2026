import { useState, useEffect, useRef, useCallback } from 'react';

interface Jogo {
  jogo_id: string;
  time_a: string;
  time_b: string;
  fase: string;
  data_hora: string;
}

interface UsuarioRanking {
  nome: string;
  email: string;
  pontos_jogos: number;
  pontos_inicial: number;
  pontos_totais: number;
}

interface ChuteInicial {
  campeao: string;
  vice_campeao: string;
  placar_final_a: number | string;
  placar_final_b: number | string;
}

const getBandeira = (timeNome: string) => {
  const mapaPaises: Record<string, string> = {
    // Copa 2026 — Grupo A
    'México': 'mx', 'África do Sul': 'za', 'Coreia do Sul': 'kr', 'Rep. Tcheca': 'cz',
    // Grupo B
    'Canadá': 'ca', 'Bósnia': 'ba', 'Catar': 'qa', 'Suíça': 'ch',
    // Grupo C
    'Brasil': 'br', 'Marrocos': 'ma', 'Haiti': 'ht', 'Escócia': 'gb-sct',
    // Grupo D
    'EUA': 'us', 'Paraguai': 'py', 'Austrália': 'au', 'Turquia': 'tr',
    // Grupo E
    'Alemanha': 'de', 'Curaçao': 'cw', 'Costa do Marfim': 'ci', 'Equador': 'ec',
    // Grupo F
    'Holanda': 'nl', 'Japão': 'jp', 'Suécia': 'se', 'Tunísia': 'tn',
    // Grupo G
    'Bélgica': 'be', 'Egito': 'eg', 'Irã': 'ir', 'Nova Zelândia': 'nz',
    // Grupo H
    'Espanha': 'es', 'Cabo Verde': 'cv', 'Arábia Saudita': 'sa', 'Uruguai': 'uy',
    // Grupo I
    'França': 'fr', 'Senegal': 'sn', 'Iraque': 'iq', 'Noruega': 'no',
    // Grupo J
    'Argentina': 'ar', 'Argélia': 'dz', 'Áustria': 'at', 'Jordânia': 'jo',
    // Grupo K
    'Portugal': 'pt', 'Rep. D. Congo': 'cd', 'Uzbequistão': 'uz', 'Colômbia': 'co',
    // Grupo L
    'Inglaterra': 'gb-eng', 'Croácia': 'hr', 'Gana': 'gh', 'Panamá': 'pa',
  };
  const codigo = mapaPaises[timeNome];
  if (!codigo) return 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';
  return `https://flagcdn.com/w80/${codigo}.png`;
};

const MAPA_GRUPOS: Record<string, string> = {
  // Grupo A
  'México': 'Grupo A', 'África do Sul': 'Grupo A', 'Coreia do Sul': 'Grupo A', 'Rep. Tcheca': 'Grupo A',
  // Grupo B
  'Canadá': 'Grupo B', 'Bósnia': 'Grupo B', 'Catar': 'Grupo B', 'Suíça': 'Grupo B',
  // Grupo C
  'Brasil': 'Grupo C', 'Marrocos': 'Grupo C', 'Haiti': 'Grupo C', 'Escócia': 'Grupo C',
  // Grupo D
  'EUA': 'Grupo D', 'Paraguai': 'Grupo D', 'Austrália': 'Grupo D', 'Turquia': 'Grupo D',
  // Grupo E
  'Alemanha': 'Grupo E', 'Curaçao': 'Grupo E', 'Costa do Marfim': 'Grupo E', 'Equador': 'Grupo E',
  // Grupo F
  'Holanda': 'Grupo F', 'Japão': 'Grupo F', 'Suécia': 'Grupo F', 'Tunísia': 'Grupo F',
  // Grupo G
  'Bélgica': 'Grupo G', 'Egito': 'Grupo G', 'Irã': 'Grupo G', 'Nova Zelândia': 'Grupo G',
  // Grupo H
  'Espanha': 'Grupo H', 'Cabo Verde': 'Grupo H', 'Arábia Saudita': 'Grupo H', 'Uruguai': 'Grupo H',
  // Grupo I
  'França': 'Grupo I', 'Senegal': 'Grupo I', 'Iraque': 'Grupo I', 'Noruega': 'Grupo I',
  // Grupo J
  'Argentina': 'Grupo J', 'Argélia': 'Grupo J', 'Áustria': 'Grupo J', 'Jordânia': 'Grupo J',
  // Grupo K
  'Portugal': 'Grupo K', 'Rep. D. Congo': 'Grupo K', 'Uzbequistão': 'Grupo K', 'Colômbia': 'Grupo K',
  // Grupo L
  'Inglaterra': 'Grupo L', 'Croácia': 'Grupo L', 'Gana': 'Grupo L', 'Panamá': 'Grupo L',
};

const SELECOES_DISPONIVEIS = Object.keys(MAPA_GRUPOS).sort();

// DICIONÁRIO DE EXIBIÇÃO
const FASES_MAP: Record<string, string> = {
  'Rodada 1': '1ª rodada',
  'Rodada 2': '2ª rodada',
  'Rodada 3': '3ª rodada',
  '16-avos': '16-avos',
  'Oitavas': 'Oitavas',
  'Quartas': 'Quartas',
  'Semi': 'Semi',
  '3º Lugar': '3º Lugar',
  'Final': 'Final'
};

const FASES_ORDEM = Object.keys(FASES_MAP);

export default function App() {
  const [usuario, setUsuario] = useState<{ nome: string, email: string } | null>(null);
  const [nomeLogin, setNomeLogin] = useState('');
  const [emailLogin, setEmailLogin] = useState('');

  const [aba, setAba] = useState<'jogos' | 'chute' | 'palpites' | 'ranking'>('jogos');
  const [subAbaPalpites, setSubAbaPalpites] = useState<'meus' | 'galera'>('meus');

  const [jogos, setJogos] = useState<Jogo[]>([]);
  const [ranking, setRanking] = useState<UsuarioRanking[]>([]);
  const [palpites, setPalpites] = useState<Record<string, { gols_a?: number, gols_b?: number }>>({});
  const [palpitesGalera, setPalpitesGalera] = useState<Record<string, Array<{ nome: string, gols_a: number, gols_b: number }>>>({});
  const [erroGalera, setErroGalera] = useState<string>('');
  const [chuteInicial, setChuteInicial] = useState<ChuteInicial>({
    campeao: '', vice_campeao: '', placar_final_a: '', placar_final_b: ''
  });
  const [resultadosOficiais, setResultadosOficiais] = useState<Record<string, { gols_a: number, gols_b: number, gols_a_90?: number, gols_b_90?: number }>>({});

  // Animação de gol: rastreia quais jogos tiveram placar alterado recentemente
  const [golsRecentes, setGolsRecentes] = useState<Set<string>>(new Set());
  const prevResultados = useRef<Record<string, { gols_a: number, gols_b: number }>>({});

  const [rodadaSelecionada, setRodadaSelecionada] = useState<string>('Rodada 1');
  const [dropdownAberto, setDropdownAberto] = useState<'campeao' | 'vice' | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'warning'; title: string; text: string } | null>(null);

  // Grupos colapsáveis na aba de palpites
  const [gruposExpandidos, setGruposExpandidos] = useState<Record<string, boolean>>({});
  const grupoRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const scrollAlvoRef = useRef<string | null>(null);

  const exibirFeedback = (title: string, text: string, type: 'success' | 'error' | 'warning' = 'success') => {
    setFeedback({ title, text, type });
  };

  const realizarLogin = (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (nomeLogin.trim() !== '' && emailLogin.trim() !== '') {
      const dadosUsuario = { nome: nomeLogin, email: emailLogin };
      setUsuario(dadosUsuario);
      localStorage.setItem('usuarioBolao', JSON.stringify(dadosUsuario));
    } else {
      exibirFeedback("Campos Obrigatórios", "Por favor, preencha nome e e-mail para entrar.", "warning");
    }
  };

  const getStatusJogo = (dataHoraStr: string) => {
    const horaJogo = new Date(dataHoraStr).getTime();
    const agora = new Date().getTime();
    if (agora < horaJogo) return 'nao_iniciado';
    // 180min = 90min regulamentares + intervalo + 30min prorrogação + pênaltis + margem
    if (agora >= horaJogo && agora < horaJogo + (180 * 60 * 1000)) return 'em_andamento';
    return 'encerrado';
  };

  const isFaseDeGruposBloqueada = (): boolean => {
    const jogosRodada1 = jogos.filter(j => j.fase === 'Rodada 1');
    if (jogosRodada1.length === 0) return false;
    const primeiraData = jogosRodada1.reduce((min, j) => {
      const dt = new Date(j.data_hora).getTime();
      return dt < min ? dt : min;
    }, Infinity);
    return Date.now() >= primeiraData;
  };

  // Verifica se uma fase eliminatória está bloqueada para palpites.
  // REGRA: bloqueia TODOS os jogos da fase quando o 1º jogo daquela fase começa.
  const isFaseEliminatoriaBloqueada = (fase: string): boolean => {
    const jogosDaFase = jogos.filter(j => j.fase === fase);
    if (jogosDaFase.length === 0) return false;
    const primeiraData = jogosDaFase.reduce((min, j) => {
      const dt = new Date(j.data_hora).getTime();
      return dt < min ? dt : min;
    }, Infinity);
    return Date.now() >= primeiraData;
  };

  const isJogoEditavel = (jogo: Jogo): boolean => {
    // Jogos com times ainda indefinidos não podem ser editados
    if (!isTimeDefinido(jogo.time_a) || !isTimeDefinido(jogo.time_b)) return false;
    if (['Rodada 1', 'Rodada 2', 'Rodada 3'].includes(jogo.fase)) {
      return !isFaseDeGruposBloqueada();
    }
    // Mata-mata: bloqueia TODOS os jogos da fase quando o 1º jogo dessa fase começa
    return !isFaseEliminatoriaBloqueada(jogo.fase);
  };

  useEffect(() => {
    const usuarioSalvo = localStorage.getItem('usuarioBolao');
    if (usuarioSalvo) setUsuario(JSON.parse(usuarioSalvo));

    const inicializar = async () => {
      try {
        const aplicarJogos = (resJogos: Jogo[]) => {
          setJogos(resJogos);

          if (resJogos.length > 0) {
            let abaAtiva = 'Rodada 1';
            // Tenta encontrar a fase de grupos ativa
            let gruposEncerrados = true;
            for (const fase of ['Rodada 1', 'Rodada 2', 'Rodada 3']) {
              const jogosDaFase = resJogos.filter((j: Jogo) => j.fase === fase);
              if (jogosDaFase.length > 0) {
                const todosEncerrados = jogosDaFase.every((j: Jogo) => getStatusJogo(j.data_hora) === 'encerrado');
                if (!todosEncerrados) {
                  abaAtiva = fase;
                  gruposEncerrados = false;
                  break;
                }
              }
            }
            // Se todas as rodadas de grupo terminaram, navega para a próxima fase de mata-mata disponível
            if (gruposEncerrados) {
              for (const fase of ['16-avos', 'Oitavas', 'Quartas', 'Semi', '3º Lugar', 'Final']) {
                const jogosDaFase = resJogos.filter((j: Jogo) => j.fase === fase);
                const todosTimesDefinidos = jogosDaFase.length > 0 && jogosDaFase.every((j: Jogo) => isTimeDefinido(j.time_a) && isTimeDefinido(j.time_b));
                if (todosTimesDefinidos) {
                  const todosEncerrados = jogosDaFase.every((j: Jogo) => getStatusJogo(j.data_hora) === 'encerrado');
                  if (!todosEncerrados) {
                    abaAtiva = fase;
                    break;
                  }
                }
              }
            }
            setRodadaSelecionada(abaAtiva);
          }
        };

        const [resJogosRaw, resResultados, resRanking] = await Promise.all([
          fetch('/api/jogos').then(r => r.json()),
          fetch('/api/resultados').then(r => r.json()),
          fetch('/api/ranking').then(r => r.json())
        ]);

        const resJogos = resJogosRaw;

        aplicarJogos(resJogos);
        setResultadosOficiais(resResultados);
        setRanking(resRanking);

        const temMatamataIndefinido = resJogos.some((jogo: Jogo) =>
          !['Rodada 1', 'Rodada 2', 'Rodada 3'].includes(jogo.fase)
          && (!isTimeDefinido(jogo.time_a) || !isTimeDefinido(jogo.time_b))
        );

        if (temMatamataIndefinido) {
          fetch('/api/sync-teams', { method: 'POST' })
            .then(r => r.ok ? r.json() : null)
            .then(async dados => {
              if (!dados || dados.times_atualizados <= 0) return;
              const jogosAtualizados = await fetch('/api/jogos').then(r => r.json());
              aplicarJogos(jogosAtualizados);
            })
            .catch(() => { /* atualização silenciosa em segundo plano */ });
        }
      } catch (e) {
        console.error("Erro ao carregar dados", e);
      }
    };
    inicializar();
  }, []);

  // Polling automático de placares ao vivo
  useEffect(() => {
    const state = { intervalo: undefined as ReturnType<typeof setInterval> | undefined };

    // Verifica pelo horário local se há algum jogo em andamento agora
    // Não dependemos da API externa reportar "jogos_ao_vivo"
    const temJogoAoVivoAgora = () => {
      const agora = Date.now();
      return jogos.some(j => {
        const inicio = new Date(j.data_hora).getTime();
        return agora >= inicio && agora < inicio + 2 * 60 * 60 * 1000;
      });
    };

    const sincronizarPlacares = async () => {
      // Decide o próximo intervalo pelo horário local antes da chamada
      const aoVivo = temJogoAoVivoAgora();
      const novoIntervalo = aoVivo ? 30000 : 300000;

      try {
        const res = await fetch('/api/sync-live', { method: 'POST' });
        if (res.ok) {
          // Sempre atualiza resultados e ranking após sync-live bem-sucedido
          const [resResultados, resRanking] = await Promise.all([
            fetch('/api/resultados').then(r => r.json()),
            fetch('/api/ranking').then(r => r.json()),
          ]);
          setResultadosOficiais(resResultados);
          setRanking(resRanking);
        } else {
          // sync-live falhou — busca apenas o banco local
          try {
            const resResultados = await fetch('/api/resultados').then(r => r.json());
            setResultadosOficiais(resResultados);
          } catch (_) { /* silencioso */ }
        }
      } catch (e) {
        // Erro de rede — busca apenas o banco local
        try {
          const resResultados = await fetch('/api/resultados').then(r => r.json());
          setResultadosOficiais(resResultados);
        } catch (_) { /* silencioso */ }
      }

      clearInterval(state.intervalo);
      state.intervalo = setInterval(sincronizarPlacares, novoIntervalo);
    };

    // Inicia em 2s se há jogo ao vivo agora, senão aguarda 10s
    const delay = temJogoAoVivoAgora() ? 2000 : 10000;
    const timer = setTimeout(() => { sincronizarPlacares(); }, delay);

    return () => {
      clearTimeout(timer);
      clearInterval(state.intervalo);
    };
  }, [jogos]);

  useEffect(() => {
    const carregarDadosUsuario = async () => {
      if (!usuario) return;
      try {
        const resPalpites = await fetch(`/api/palpites/${usuario.email}`);
        if (resPalpites.ok) setPalpites(await resPalpites.json());

        const resChute = await fetch(`/api/chute/${usuario.email}`);
        if (resChute.ok) {
          const dadosChute = await resChute.json();
          if (dadosChute) setChuteInicial(dadosChute);
        }
      } catch (erro) {
        console.error("Erro ao buscar dados do usuário.", erro);
      }
    };
    carregarDadosUsuario();
  }, [usuario]);

  useEffect(() => {
    if (aba === 'palpites' && subAbaPalpites === 'galera' && rodadaSelecionada) {
      const carregarPalpitesGalera = async () => {
        try {
          setErroGalera('');
          const resposta = await fetch(`/api/palpites-fase/${rodadaSelecionada}`);
          if (resposta.ok) {
            setPalpitesGalera(await resposta.json());
          } else {
            const erroDados = await resposta.json();
            setErroGalera(erroDados.detail || 'Não foi possível visualizar os palpites.');
          }
        } catch (e) {
          setErroGalera('Erro ao conectar com o servidor.');
        }
      };
      carregarPalpitesGalera();
    }
  }, [aba, subAbaPalpites, rodadaSelecionada]);

  // Detecta mudanças de placar e dispara a animação de gol
  useEffect(() => {
    const alterados = new Set<string>();
    for (const jogoId of Object.keys(resultadosOficiais)) {
      const prev = prevResultados.current[jogoId];
      const curr = resultadosOficiais[jogoId];
      if (prev && (prev.gols_a !== curr.gols_a || prev.gols_b !== curr.gols_b)) {
        alterados.add(jogoId);
      }
    }
    prevResultados.current = resultadosOficiais;

    if (alterados.size > 0) {
      setGolsRecentes(alterados);
      // Remove a classe de animação após ela terminar (1.8s + margem)
      const timer = setTimeout(() => setGolsRecentes(new Set()), 2200);
      return () => clearTimeout(timer);
    }
  }, [resultadosOficiais]);

  // Calcula quais grupos devem começar expandidos e qual recebe o scroll
  const calcularEstadoGrupos = useCallback((grupos: Record<string, Jogo[]>) => {
    const agora = Date.now();
    let menorDiff = Infinity;
    let grupoAlvo: string | null = null;

    const novoEstado: Record<string, boolean> = {};

    for (const [nomeGrupo, jogosGrupo] of Object.entries(grupos)) {
      const todosEncerrados = jogosGrupo.every(j => getStatusJogo(j.data_hora) === 'encerrado');

      // Grupo expandido se tiver algum jogo não encerrado
      novoEstado[nomeGrupo] = !todosEncerrados;

      // Encontra o jogo mais próximo no futuro (ou em andamento) deste grupo
      for (const j of jogosGrupo) {
        const status = getStatusJogo(j.data_hora);
        if (status === 'em_andamento') {
          // Prioridade máxima: jogo ao vivo
          menorDiff = -1;
          grupoAlvo = nomeGrupo;
        } else if (status === 'nao_iniciado' && menorDiff !== -1) {
          const diff = new Date(j.data_hora).getTime() - agora;
          if (diff < menorDiff) {
            menorDiff = diff;
            grupoAlvo = nomeGrupo;
          }
        }
      }
    }

    // Se há um grupo alvo, garante que ele esteja expandido
    if (grupoAlvo) novoEstado[grupoAlvo] = true;

    setGruposExpandidos(novoEstado);
    scrollAlvoRef.current = grupoAlvo;
  }, []);


  const isTimeDefinido = (nomeTime: string) => {
    if (!nomeTime) return false;
    const lower = nomeTime.toLowerCase();
    return !(
      lower.includes('winner') ||
      lower.includes('runner-up') ||
      lower.includes('loser') ||
      lower.includes('3rd') ||
      lower.includes('group') ||
      lower.includes('match') ||
      lower.includes('time a') ||
      lower.includes('time b') ||
      lower.includes('vencedor') ||
      lower.includes('perdedor') ||
      lower.includes('jogo') ||
      lower.includes('grupo') ||
      lower.includes('tbd') ||
      lower.includes('to be determined') ||
      lower.includes('a definir')
    );
  };

  const isAbaBloqueada = (faseNome: string) => {
    if (['Rodada 1', 'Rodada 2', 'Rodada 3'].includes(faseNome)) return false;

    // Ordem das fases eliminatórias para verificar dependências
    const fasesEliminatorias = ['16-avos', 'Oitavas', 'Quartas', 'Semi', '3º Lugar', 'Final'];
    const indiceFase = fasesEliminatorias.indexOf(faseNome);
    if (indiceFase === -1) return true;

    // Verifica se a fase de grupos terminou (pré-requisito para 16-avos)
    if (indiceFase === 0) {
      const jogosGrupos = jogos.filter(j => ['Rodada 1', 'Rodada 2', 'Rodada 3'].includes(j.fase));
      const gruposEncerrados = jogosGrupos.length > 0 && jogosGrupos.every(j => getStatusJogo(j.data_hora) === 'encerrado');
      if (!gruposEncerrados) return true;
    }

    // Verifica se TODAS as fases anteriores já encerraram seus jogos E possuem resultado oficial
    // NOTA: "3º Lugar" e "Final" não dependem um do outro — ambos dependem apenas da Semi
    for (let i = 0; i < indiceFase; i++) {
      const faseAnterior = fasesEliminatorias[i];
      // Pula "3º Lugar" ao verificar dependências da "Final" (são fases paralelas)
      if (faseNome === 'Final' && faseAnterior === '3º Lugar') continue;
      // Pula "Final" ao verificar dependências de "3º Lugar" (mesma lógica)
      if (faseNome === '3º Lugar' && faseAnterior === 'Final') continue;
      const jogosFaseAnterior = jogos.filter(j => j.fase === faseAnterior);
      if (jogosFaseAnterior.length === 0) return true;
      const todosEncerradosComResultado = jogosFaseAnterior.every(j =>
        getStatusJogo(j.data_hora) === 'encerrado' && resultadosOficiais[j.jogo_id]?.gols_a !== undefined
      );
      if (!todosEncerradosComResultado) return true;
    }

    // Verifica se a fase atual tem jogos e se TODOS os times estão definidos
    const jogosDaFase = jogos.filter(j => j.fase === faseNome);
    if (jogosDaFase.length === 0) return true;
    const todosJogosDefinidos = jogosDaFase.every(j => isTimeDefinido(j.time_a) && isTimeDefinido(j.time_b));
    return !todosJogosDefinidos;
  };

  const calcularPontosPalpite = (jogoId: string) => {
    const palpite = palpites[jogoId];
    if (!palpite || palpite.gols_a === undefined || palpite.gols_b === undefined) return null;
    const oficial = resultadosOficiais[jogoId];
    if (!oficial) return { pontos: 0, label: 'Aguardando Oficial', classe: 'bg-gray-100 text-gray-500 border-gray-200' };

    // REGRA: usa placar de 90 min regulamentares (sem prorrogação) quando disponível
    const r_a = oficial.gols_a_90 !== undefined && oficial.gols_a_90 !== null ? oficial.gols_a_90 : oficial.gols_a;
    const r_b = oficial.gols_b_90 !== undefined && oficial.gols_b_90 !== null ? oficial.gols_b_90 : oficial.gols_b;

    const v_a = palpite.gols_a > palpite.gols_b && r_a > r_b;
    const v_b = palpite.gols_a < palpite.gols_b && r_a < r_b;
    const emp = palpite.gols_a === palpite.gols_b && r_a === r_b;

    if (palpite.gols_a === r_a && palpite.gols_b === r_b) return { pontos: 3, label: 'Placar Exato (+3)', classe: 'bg-green-100 text-green-800 border-green-300' };
    if (v_a || v_b || emp) return { pontos: 1, label: 'Resultado (+1)', classe: 'bg-amber-100 text-amber-800 border-amber-300' };
    return { pontos: 0, label: 'Errou (0)', classe: 'bg-red-100 text-red-800 border-red-300' };
  };

  const sanitizarValorPlacar = (valor: string): string => {
    let clean = valor.replace(/\D/g, '');
    if (clean === '') return '';
    return parseInt(clean, 10).toString();
  };

  const handlePalpiteChange = (jogoId: string, time: 'gols_a' | 'gols_b', valorRaw: string) => {
    const valor = sanitizarValorPlacar(valorRaw);
    setPalpites(prev => ({
      ...prev,
      [jogoId]: {
        ...prev[jogoId],
        [time]: valor === '' ? undefined : parseInt(valor, 10)
      }
    }));
  }; const salvarTodosPalpites = async () => {
    if (!usuario) return;

    let jogosParaSalvar: Jogo[] = [];
    const isFaseDeGrupos = ['Rodada 1', 'Rodada 2', 'Rodada 3'].includes(rodadaSelecionada);

    if (isFaseDeGrupos) {
      jogosParaSalvar = jogos.filter(j => ['Rodada 1', 'Rodada 2', 'Rodada 3'].includes(j.fase));
    } else {
      jogosParaSalvar = jogos.filter(j => j.fase === rodadaSelecionada);
    }

    // Validar se existem campos editáveis vazios
    const jogosEditaveis = jogosParaSalvar.filter(jogo => isJogoEditavel(jogo));
    const temCamposVazios = jogosEditaveis.some(jogo => {
      const palpite = palpites[jogo.jogo_id];
      return !palpite ||
        palpite.gols_a === undefined ||
        palpite.gols_b === undefined ||
        isNaN(palpite.gols_a) ||
        isNaN(palpite.gols_b);
    });

    if (temCamposVazios) {
      exibirFeedback("Palpites Incompletos", "Por favor, preencha todos os palpites antes de salvar!", "warning");
      return;
    }

    const promessas = jogosParaSalvar
      .filter(jogo => isJogoEditavel(jogo))
      .map(jogo => {
        const palpite = palpites[jogo.jogo_id];
        if (palpite && palpite.gols_a !== undefined && palpite.gols_b !== undefined) {
          return fetch('/api/palpites', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email_usuario: usuario.email,
              jogo_id: jogo.jogo_id,
              gols_a: palpite.gols_a,
              gols_b: palpite.gols_b
            })
          });
        }
        return null;
      })
      .filter(p => p !== null) as Promise<Response>[];

    if (promessas.length === 0) {
      exibirFeedback("Sem Palpites", "Nenhum palpite preenchido para salvar.", "warning");
      return;
    }

    try {
      setSalvando(true);
      await Promise.all(promessas);
      exibirFeedback("Sucesso!", "Todos os palpites foram salvos com sucesso!", "success");

      const resPalpites = await fetch(`/api/palpites/${usuario.email}`);
      if (resPalpites.ok) setPalpites(await resPalpites.json());

    } catch (e) {
      exibirFeedback("Erro ao Salvar", "Erro ao salvar os palpites. Verifique a sua conexão.", "error");
    } finally {
      setSalvando(false);
    }
  };
  const salvarChuteInicial = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!usuario) return;

    if (isFaseDeGruposBloqueada()) {
      exibirFeedback("Chute Bloqueado", "A fase de grupos já começou. Não é possível editar o Chute Inicial.", "warning");
      return;
    }

    if (
      !chuteInicial.campeao ||
      !chuteInicial.vice_campeao ||
      chuteInicial.placar_final_a === '' ||
      chuteInicial.placar_final_b === '' ||
      chuteInicial.placar_final_a === undefined ||
      chuteInicial.placar_final_b === undefined
    ) {
      exibirFeedback("Chute Incompleto", "Por favor, preencha todos os campos do Chute Inicial antes de salvar!", "warning");
      return;
    }

    if (parseInt(chuteInicial.placar_final_a.toString(), 10) < parseInt(chuteInicial.placar_final_b.toString(), 10)) {
      exibirFeedback(
        "Placar Inválido",
        "O Campeão (Time 1) deve ter um placar maior ou igual ao Vice-Campeão (Time 2).",
        "warning"
      );
      return;
    }

    const carga = {
      email_usuario: usuario.email, campeao: chuteInicial.campeao, vice_campeao: chuteInicial.vice_campeao,
      placar_final_a: chuteInicial.placar_final_a, placar_final_b: chuteInicial.placar_final_b
    };
    try {
      const response = await fetch('/api/chute', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(carga)
      });
      if (response.ok) {
        exibirFeedback("Sucesso!", "Chute Inicial gravado com sucesso!", "success");
      } else {
        exibirFeedback("Erro ao Salvar", "Falha ao salvar o Chute Inicial.", "error");
      }
    } catch (e) {
      exibirFeedback("Erro de Conexão", "Erro de conexão com o servidor.", "error");
    }
  };

  const formatarData = (dataStr: string) => {
    const data = new Date(dataStr);
    const dias = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    return `${String(data.getDate()).padStart(2, '0')}/${String(data.getMonth() + 1).padStart(2, '0')} • ${dias[data.getDay()]} • ${String(data.getHours()).padStart(2, '0')}:${String(data.getMinutes()).padStart(2, '0')}`;
  };

  // Aqui nós garantimos que filtramos usando a chave interna (Rodada 1)
  const jogosExibidos = jogos.filter(jogo => jogo.fase === rodadaSelecionada);

  const jogosAgrupados = jogosExibidos.reduce((acc, jogo) => {
    const chave = rodadaSelecionada.includes('Rodada') ? (MAPA_GRUPOS[jogo.time_a] || 'Grupo Indefinido') : FASES_MAP[rodadaSelecionada];
    if (!acc[chave]) acc[chave] = [];
    acc[chave].push(jogo);
    return acc;
  }, {} as Record<string, Jogo[]>);

  // Recalcula estado dos grupos quando rodada ou jogos mudam
  // (declarado após jogosAgrupados para evitar referência antes da inicialização)
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (aba === 'palpites' && Object.keys(jogosAgrupados).length > 0) {
      calcularEstadoGrupos(jogosAgrupados);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aba, rodadaSelecionada, JSON.stringify(Object.keys(jogosAgrupados).sort())]);

  // Faz o scroll para o grupo alvo após render
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (aba !== 'palpites') return;
    const alvo = scrollAlvoRef.current;
    if (!alvo || !grupoRefs.current[alvo]) return;
    const timer = setTimeout(() => {
      grupoRefs.current[alvo]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      scrollAlvoRef.current = null;
    }, 120);
    return () => clearTimeout(timer);
  }, [gruposExpandidos, aba]);

  const toggleGrupo = (nomeGrupo: string) => {
    setGruposExpandidos(prev => ({ ...prev, [nomeGrupo]: !prev[nomeGrupo] }));
  };

  if (!usuario) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <h2 className="mt-6 text-center text-3xl font-extrabold text-blue-700">Bolão Galileu Copa do Mundo 2026</h2>
          <p className="mt-2 text-center text-sm text-gray-600">Identifique-se para fazer seus palpites</p>
        </div>
        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-gray-100">
            <form className="space-y-6" onSubmit={realizarLogin}>
              <div>
                <label className="block text-sm font-medium text-gray-700">Nome de Exibição</label>
                <input type="text" required value={nomeLogin} onChange={(e) => setNomeLogin(e.target.value)} className="mt-1 block w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">E-mail</label>
                <input type="email" required value={emailLogin} onChange={(e) => setEmailLogin(e.target.value)} className="mt-1 block w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <button type="submit" className="w-full py-2.5 px-4 rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 font-medium transition-colors">Entrar no Bolão</button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">

        <header className="bg-gradient-to-r from-blue-700 to-blue-500 rounded-2xl shadow-lg p-8 text-center text-white">
          <h1 className="text-3xl font-extrabold tracking-tight">Bolão Galileu Copa do Mundo 2026</h1>
          <p className="mt-2 text-blue-100 font-medium">Mostre que você entende de futebol</p>
          <p className="mt-4 text-xs text-blue-200 bg-blue-800/40 inline-block px-3 py-1 rounded-full">Usuário: {usuario.nome} ({usuario.email})</p>
        </header>



        <nav className="flex justify-center space-x-2 bg-gray-200 p-1 rounded-xl">
          <button onClick={() => setAba('jogos')} className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all ${aba === 'jogos' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>Jogos da Rodada</button>
          <button onClick={() => setAba('chute')} className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all ${aba === 'chute' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>Chute Inicial</button>
          <button onClick={() => setAba('palpites')} className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all ${aba === 'palpites' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>Palpites</button>
          <button onClick={() => setAba('ranking')} className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all ${aba === 'ranking' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>Ranking</button>
        </nav>

        <main className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">

          {aba === 'jogos' && (
            <div className="space-y-6">

              <div className="flex w-full justify-between pb-4 border-b border-gray-100 gap-1 sm:gap-2">
                {FASES_ORDEM.map(rodada => {
                  const bloqueada = isAbaBloqueada(rodada);
                  return (
                    <button key={rodada} disabled={bloqueada} onClick={() => setRodadaSelecionada(rodada)}
                      className={`flex-1 py-2 px-1 text-[10px] sm:text-xs md:text-sm font-bold rounded-lg text-center transition-all ${rodadaSelecionada === rodada ? 'bg-blue-600 text-white shadow-md' : bloqueada ? 'bg-gray-100 text-gray-300 cursor-not-allowed opacity-60' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                      {FASES_MAP[rodada]}
                    </button>
                  );
                })}
              </div>

              <div className="space-y-8">
                {jogosExibidos.length === 0 ? (
                  <p className="text-center text-gray-500 py-10 italic">Nenhum jogo encontrado para esta fase no momento.</p>
                ) : (
                  Object.entries(jogosAgrupados).sort().map(([nomeBloco, jogosDoBloco]) => (
                    <div key={nomeBloco} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                      <div className="bg-gray-50 border-b border-gray-200 px-4 py-2 text-center text-xs font-extrabold text-gray-600 uppercase tracking-widest">
                        {nomeBloco}
                      </div>

                      <div className="divide-y divide-gray-100">
                        {jogosDoBloco.map(jogo => {
                          const timesIndefinidos = !isTimeDefinido(jogo.time_a) || !isTimeDefinido(jogo.time_b);
                          const bloqueado = timesIndefinidos || (['Rodada 1', 'Rodada 2', 'Rodada 3'].includes(jogo.fase) ? isFaseDeGruposBloqueada() : isFaseEliminatoriaBloqueada(jogo.fase));
                          return (
                            <div key={jogo.jogo_id} className="p-5 flex flex-col hover:bg-blue-50/30 transition-colors">
                              <div className="text-center text-xs text-gray-400 font-bold mb-3">{formatarData(jogo.data_hora)}</div>

                              <div className="flex items-center space-x-2 sm:space-x-4 w-full justify-center">
                                <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0 justify-end">
                                  <span className="font-bold text-gray-700 text-xs sm:text-base text-right leading-tight">{jogo.time_a}</span>
                                  <img src={getBandeira(jogo.time_a)} className="w-6 h-6 sm:w-8 sm:h-8 rounded-full border border-gray-300 flex-shrink-0" />
                                </div>

                                <div className="flex items-center gap-1 flex-shrink-0">
                                  <input type="text" inputMode="numeric" pattern="[0-9]*" disabled={bloqueado}
                                    className={`w-10 sm:w-12 h-10 text-center text-sm sm:text-lg font-bold rounded-md border outline-none ${bloqueado ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed' : 'border-gray-300 focus:ring-2 focus:ring-blue-500 bg-white'}`}
                                    value={palpites[jogo.jogo_id]?.gols_a ?? ''} onChange={(e) => handlePalpiteChange(jogo.jogo_id, 'gols_a', e.target.value)} />
                                  <span className="text-gray-300 font-bold px-1">X</span>
                                  <input type="text" inputMode="numeric" pattern="[0-9]*" disabled={bloqueado}
                                    className={`w-10 sm:w-12 h-10 text-center text-sm sm:text-lg font-bold rounded-md border outline-none ${bloqueado ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed' : 'border-gray-300 focus:ring-2 focus:ring-blue-500 bg-white'}`}
                                    value={palpites[jogo.jogo_id]?.gols_b ?? ''} onChange={(e) => handlePalpiteChange(jogo.jogo_id, 'gols_b', e.target.value)} />
                                </div>

                                <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0 justify-start">
                                  <img src={getBandeira(jogo.time_b)} className="w-6 h-6 sm:w-8 sm:h-8 rounded-full border border-gray-300 flex-shrink-0" />
                                  <span className="font-bold text-gray-700 text-xs sm:text-base text-left leading-tight">{jogo.time_b}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                    </div>
                  ))
                )}
              </div>

              {jogosExibidos.length > 0 && (
                <div className="mt-8 flex justify-center sticky bottom-4 z-50">
                  <button
                    onClick={salvarTodosPalpites}
                    disabled={salvando}
                    className={`px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-800 hover:from-blue-700 hover:to-blue-900 text-white font-extrabold rounded-full shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-0.5 flex items-center space-x-3 text-base ${salvando ? 'opacity-80 cursor-not-allowed' : ''}`}
                  >
                    {salvando ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>Salvando palpites...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"></path>
                        </svg>
                        <span>
                          {['Rodada 1', 'Rodada 2', 'Rodada 3'].includes(rodadaSelecionada)
                            ? 'Salvar Todos os Palpites (Fase de Grupos)'
                            : `Salvar Palpites (${FASES_MAP[rodadaSelecionada]})`
                          }
                        </span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}

          {aba === 'chute' && (
            <form onSubmit={salvarChuteInicial} className="space-y-6">
              <h2 className="text-xl font-bold text-gray-800 border-b pb-4">Seu Chute Inicial</h2>
              {isFaseDeGruposBloqueada() && (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 p-5 rounded-xl text-center">
                  <p className="font-bold text-base mb-1">🔒 Chute Inicial Bloqueado</p>
                  <p className="text-sm">A fase de grupos já começou. Não é possível alterar o Chute Inicial.</p>
                </div>
              )}
              <fieldset disabled={isFaseDeGruposBloqueada()} className="space-y-4 disabled:opacity-60">
                <div className="relative">
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Quem será o Campeão? (Time 1)</label>
                  <div className="relative flex items-center">
                    {SELECOES_DISPONIVEIS.includes(chuteInicial.campeao) && (
                      <img src={getBandeira(chuteInicial.campeao)} className="absolute left-3 w-7 h-7 rounded-full border border-gray-200 z-10" />
                    )}
                    <input type="text" className={`w-full p-3 rounded-lg border border-gray-300 outline-none focus:ring-2 focus:ring-blue-500 bg-white ${SELECOES_DISPONIVEIS.includes(chuteInicial.campeao) ? 'pl-12' : ''}`} placeholder="Digite o nome da seleção..."
                      value={chuteInicial.campeao} onChange={e => setChuteInicial({ ...chuteInicial, campeao: e.target.value })} onFocus={() => setDropdownAberto('campeao')} onBlur={() => setDropdownAberto(null)} />
                  </div>
                  {dropdownAberto === 'campeao' && chuteInicial.campeao.length >= 1 && (
                    <ul className="absolute z-10 w-full bg-white border border-gray-200 mt-1 max-h-48 overflow-y-auto rounded-lg shadow-xl">
                      {SELECOES_DISPONIVEIS.filter(s => s.toLowerCase().includes(chuteInicial.campeao.toLowerCase())).map(selecao => (
                        <li key={selecao} onMouseDown={(e) => { e.preventDefault(); setChuteInicial({ ...chuteInicial, campeao: selecao }); setDropdownAberto(null); }} className="px-4 py-3 hover:bg-blue-50 cursor-pointer flex items-center gap-3 border-b border-gray-50">
                          <img src={getBandeira(selecao)} className="w-6 h-6 rounded-full border border-gray-200" /><span className="font-semibold text-gray-700">{selecao}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="relative">
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Quem será o Vice-Campeão? (Time 2)</label>
                  <div className="relative flex items-center">
                    {SELECOES_DISPONIVEIS.includes(chuteInicial.vice_campeao) && (
                      <img src={getBandeira(chuteInicial.vice_campeao)} className="absolute left-3 w-7 h-7 rounded-full border border-gray-200 z-10" />
                    )}
                    <input type="text" className={`w-full p-3 rounded-lg border border-gray-300 outline-none focus:ring-2 focus:ring-blue-500 bg-white ${SELECOES_DISPONIVEIS.includes(chuteInicial.vice_campeao) ? 'pl-12' : ''}`} placeholder="Digite o nome da seleção..."
                      value={chuteInicial.vice_campeao} onChange={e => setChuteInicial({ ...chuteInicial, vice_campeao: e.target.value })} onFocus={() => setDropdownAberto('vice')} onBlur={() => setDropdownAberto(null)} />
                  </div>
                  {dropdownAberto === 'vice' && chuteInicial.vice_campeao.length >= 1 && (
                    <ul className="absolute z-10 w-full bg-white border border-gray-200 mt-1 max-h-48 overflow-y-auto rounded-lg shadow-xl">
                      {SELECOES_DISPONIVEIS.filter(s => s.toLowerCase().includes(chuteInicial.vice_campeao.toLowerCase())).map(selecao => (
                        <li key={selecao} onMouseDown={(e) => { e.preventDefault(); setChuteInicial({ ...chuteInicial, vice_campeao: selecao }); setDropdownAberto(null); }} className="px-4 py-3 hover:bg-blue-50 cursor-pointer flex items-center gap-3 border-b border-gray-50">
                          <img src={getBandeira(selecao)} className="w-6 h-6 rounded-full border border-gray-200" /><span className="font-semibold text-gray-700">{selecao}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Placar Exato da Final (90 min)</label>
                  <div className="flex items-center space-x-3">
                    <input type="text" inputMode="numeric" pattern="[0-9]*" placeholder="0" className="w-10 sm:w-12 h-10 text-center text-sm sm:text-lg font-bold rounded-md border outline-none border-gray-300 focus:ring-2 focus:ring-blue-500 bg-white" value={chuteInicial.placar_final_a ?? ''}
                      onChange={e => {
                        const clean = sanitizarValorPlacar(e.target.value);
                        setChuteInicial({ ...chuteInicial, placar_final_a: clean === '' ? '' : parseInt(clean, 10) });
                      }} />
                    <span className="text-gray-300 font-bold px-1">X</span>
                    <input type="text" inputMode="numeric" pattern="[0-9]*" placeholder="0" className="w-10 sm:w-12 h-10 text-center text-sm sm:text-lg font-bold rounded-md border outline-none border-gray-300 focus:ring-2 focus:ring-blue-500 bg-white" value={chuteInicial.placar_final_b ?? ''}
                      onChange={e => {
                        const clean = sanitizarValorPlacar(e.target.value);
                        setChuteInicial({ ...chuteInicial, placar_final_b: clean === '' ? '' : parseInt(clean, 10) });
                      }} />
                  </div>
                </div>
              </fieldset>
              <button type="submit" disabled={isFaseDeGruposBloqueada()} className={`w-full font-bold py-3.5 px-4 rounded-xl mt-6 shadow-sm ${isFaseDeGruposBloqueada() ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}>Confirmar Chute Inicial</button>
            </form>
          )}

          {aba === 'palpites' && (
            <div className="space-y-6">
              <div className="flex space-x-2 bg-gray-100 p-1 rounded-lg">
                <button onClick={() => setSubAbaPalpites('meus')} className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${subAbaPalpites === 'meus' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600'}`}>Meus Palpites</button>
                <button onClick={() => setSubAbaPalpites('galera')} className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${subAbaPalpites === 'galera' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600'}`}>Palpites da Galera</button>
              </div>

              <div className="flex w-full justify-between pb-4 border-b border-gray-100 gap-1 sm:gap-2">
                {FASES_ORDEM.map(rodada => {
                  const bloqueada = isAbaBloqueada(rodada);
                  return (
                    <button key={rodada} disabled={bloqueada} onClick={() => setRodadaSelecionada(rodada)}
                      className={`flex-1 py-2 px-1 text-[10px] sm:text-xs md:text-sm font-bold rounded-lg text-center transition-all ${rodadaSelecionada === rodada ? 'bg-blue-600 text-white shadow-md' : bloqueada ? 'bg-gray-100 text-gray-300 cursor-not-allowed opacity-60' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                      {FASES_MAP[rodada]}
                    </button>
                  );
                })}
              </div>

              {subAbaPalpites === 'meus' && (
                <div className="space-y-3">
                  {jogosExibidos.length === 0 ? (
                    <p className="text-center text-gray-500 py-10 italic">Nenhum palpite para exibir nesta fase.</p>
                  ) : (
                    Object.entries(jogosAgrupados).sort().map(([nomeBloco, jogosDoBloco]) => {
                      const expandido = gruposExpandidos[nomeBloco] ?? true;
                      const todosEncerrados = jogosDoBloco.every(j => getStatusJogo(j.data_hora) === 'encerrado');
                      const temAoVivo = jogosDoBloco.some(j => getStatusJogo(j.data_hora) === 'em_andamento');
                      return (
                        <div
                          key={`res_${nomeBloco}`}
                          className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm"
                          ref={el => { grupoRefs.current[nomeBloco] = el; }}
                        >
                          {/* Cabeçalho clicável do grupo */}
                          <button
                            onClick={() => toggleGrupo(nomeBloco)}
                            className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200 hover:bg-gray-100 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <svg
                                className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${expandido ? 'rotate-90' : ''}`}
                                fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                              </svg>
                              <span className="text-xs font-extrabold text-gray-600 uppercase tracking-widest">{nomeBloco}</span>
                              {temAoVivo && (
                                <span className="flex items-center gap-1 bg-red-50 border border-red-100 text-red-600 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                  <span className="relative flex h-1.5 w-1.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span><span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-600"></span></span>
                                  AO VIVO
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] font-semibold text-gray-400">
                              {todosEncerrados ? 'Encerrado' : `${jogosDoBloco.length} jogo${jogosDoBloco.length > 1 ? 's' : ''}`}
                            </span>
                          </button>

                          {/* Conteúdo expansível */}
                          {expandido && (
                            <div className="divide-y divide-gray-100">
                              {jogosDoBloco.map(jogo => {
                                const statusJogo = getStatusJogo(jogo.data_hora);
                                const statusPontos = calcularPontosPalpite(jogo.jogo_id);
                                return (
                                  <div key={jogo.jogo_id} className="p-5 flex flex-col hover:bg-blue-50/20 transition-colors">
                                    <div className="text-center text-xs text-gray-400 font-bold mb-3">{formatarData(jogo.data_hora)}</div>
                                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 w-full">
                                      <div className="flex items-center space-x-2 sm:space-x-4 flex-1 w-full justify-center">
                                        <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0 justify-end">
                                          <span className="font-bold text-gray-700 text-xs sm:text-base text-right leading-tight">{jogo.time_a}</span>
                                          <img src={getBandeira(jogo.time_a)} className="w-6 h-6 sm:w-8 sm:h-8 rounded-full border border-gray-300 flex-shrink-0" />
                                        </div>
                                        <div className="flex items-center gap-1 flex-shrink-0">
                                          <div className="w-10 sm:w-12 h-10 flex items-center justify-center text-center text-sm sm:text-lg font-bold rounded-md border border-blue-100 bg-blue-50 text-blue-800 shadow-sm">
                                            {palpites[jogo.jogo_id]?.gols_a ?? '-'}
                                          </div>
                                          <span className="text-gray-300 font-bold px-1">X</span>
                                          <div className="w-10 sm:w-12 h-10 flex items-center justify-center text-center text-sm sm:text-lg font-bold rounded-md border border-blue-100 bg-blue-50 text-blue-800 shadow-sm">
                                            {palpites[jogo.jogo_id]?.gols_b ?? '-'}
                                          </div>
                                        </div>
                                        <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0 justify-start">
                                          <img src={getBandeira(jogo.time_b)} className="w-6 h-6 sm:w-8 sm:h-8 rounded-full border border-gray-300 flex-shrink-0" />
                                          <span className="font-bold text-gray-700 text-xs sm:text-base text-left leading-tight">{jogo.time_b}</span>
                                        </div>
                                      </div>
                                      <div className="flex-shrink-0 w-32 flex flex-col items-center sm:items-end gap-1">
                                        {statusJogo === 'nao_iniciado'
                                          ? <div className="min-w-[120px] text-center px-3.5 py-1.5 text-xs font-bold border rounded-full bg-gray-100 text-gray-500 border-gray-200">Aguardando</div>
                                          : statusJogo === 'em_andamento'
                                            ? <div className="min-w-[120px] text-center px-3.5 py-1.5 text-xs font-bold border rounded-full bg-blue-100 text-blue-700 border-blue-200 animate-pulse">Ao Vivo</div>
                                            : <>
                                                <div className={`min-w-[120px] text-center px-3.5 py-1.5 text-xs font-bold border rounded-full ${statusPontos?.classe}`}>{statusPontos?.label}</div>
                                                {resultadosOficiais[jogo.jogo_id] && (() => {
                                                  const of = resultadosOficiais[jogo.jogo_id];
                                                  const temProrr = of.gols_a_90 !== undefined && of.gols_a_90 !== null
                                                    && of.gols_b_90 !== undefined && of.gols_b_90 !== null
                                                    && (of.gols_a !== of.gols_a_90 || of.gols_b !== of.gols_b_90);
                                                  const p90a = of.gols_a_90 !== undefined && of.gols_a_90 !== null ? of.gols_a_90 : of.gols_a;
                                                  const p90b = of.gols_b_90 !== undefined && of.gols_b_90 !== null ? of.gols_b_90 : of.gols_b;
                                                  return (
                                                    <div className="flex flex-col items-center">
                                                      <span className="text-[10px] font-extrabold text-gray-500">{p90a} x {p90b}</span>
                                                      {temProrr && (
                                                        <span className="text-[8px] font-semibold text-purple-400">{of.gols_a}x{of.gols_b} prorr.</span>
                                                      )}
                                                    </div>
                                                  );
                                                })()}
                                              </>
                                        }
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {subAbaPalpites === 'galera' && (
                <div className="space-y-3">
                  {erroGalera ? (
                    <div className="bg-amber-50 border text-amber-800 p-4 rounded-xl text-center">{erroGalera}</div>
                  ) : jogosExibidos.length === 0 ? (
                    <p className="text-center text-gray-500 py-10 italic">Nenhum palpite para exibir nesta fase.</p>
                  ) : (
                    Object.entries(jogosAgrupados).sort().map(([nomeBloco, jogosDoBloco]) => {
                      const expandido = gruposExpandidos[nomeBloco] ?? true;
                      const todosEncerrados = jogosDoBloco.every(j => getStatusJogo(j.data_hora) === 'encerrado');
                      const temAoVivo = jogosDoBloco.some(j => getStatusJogo(j.data_hora) === 'em_andamento');
                      return (
                        <div
                          key={`galera_${nomeBloco}`}
                          className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm"
                          ref={el => { grupoRefs.current[nomeBloco] = el; }}
                        >
                          {/* Cabeçalho clicável do grupo */}
                          <button
                            onClick={() => toggleGrupo(nomeBloco)}
                            className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200 hover:bg-gray-100 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <svg
                                className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${expandido ? 'rotate-90' : ''}`}
                                fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                              </svg>
                              <span className="text-xs font-extrabold text-gray-600 uppercase tracking-widest">{nomeBloco}</span>
                              {temAoVivo && (
                                <span className="flex items-center gap-1 bg-red-50 border border-red-100 text-red-600 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                  <span className="relative flex h-1.5 w-1.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span><span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-600"></span></span>
                                  AO VIVO
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] font-semibold text-gray-400">
                              {todosEncerrados ? 'Encerrado' : `${jogosDoBloco.length} jogo${jogosDoBloco.length > 1 ? 's' : ''}`}
                            </span>
                          </button>

                          {/* Conteúdo expansível */}
                          {expandido && (
                            <div className="grid grid-cols-1 gap-6 p-4">
                              {jogosDoBloco.map(jogo => {
                                const oficial = resultadosOficiais[jogo.jogo_id];
                                const statusJogo = getStatusJogo(jogo.data_hora);
                                return (
                                  <div key={jogo.jogo_id} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                                    <div className="bg-gray-50 px-4 py-4 border-b border-gray-200 flex flex-col justify-center items-center relative">
                                      {statusJogo === 'em_andamento' && (
                                        <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-red-50 px-2 py-0.5 rounded border border-red-100">
                                          <span className="relative flex h-2 w-2">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600"></span>
                                          </span>
                                          <span className="text-[10px] font-bold text-red-600 uppercase">Ao Vivo</span>
                                        </div>
                                      )}
                                      <div className="text-center text-xs text-gray-400 font-bold mb-3">{formatarData(jogo.data_hora)}</div>
                                      <div className="flex items-center space-x-2 sm:space-x-4 w-full justify-center">
                                        <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0 justify-end">
                                          <span className="font-bold text-gray-700 text-xs sm:text-base text-right leading-tight">{jogo.time_a}</span>
                                          <img src={getBandeira(jogo.time_a)} className="w-6 h-6 sm:w-8 sm:h-8 rounded-full border border-gray-300 flex-shrink-0" />
                                        </div>
                                        <div className={`flex flex-col items-center justify-center px-3 py-1 bg-white border border-gray-200 rounded-lg shadow-sm min-w-[60px] sm:min-w-[70px] flex-shrink-0 transition-transform${golsRecentes.has(jogo.jogo_id) ? ' goal-flash' : ''}`}>
                                          {oficial ? (() => {
                                            const temProrrogacao = oficial.gols_a_90 !== undefined && oficial.gols_a_90 !== null
                                              && oficial.gols_b_90 !== undefined && oficial.gols_b_90 !== null
                                              && (oficial.gols_a !== oficial.gols_a_90 || oficial.gols_b !== oficial.gols_b_90);
                                            const placar90a = oficial.gols_a_90 !== undefined && oficial.gols_a_90 !== null ? oficial.gols_a_90 : oficial.gols_a;
                                            const placar90b = oficial.gols_b_90 !== undefined && oficial.gols_b_90 !== null ? oficial.gols_b_90 : oficial.gols_b;
                                            return (
                                              <>
                                                <div className="flex items-center font-extrabold text-sm sm:text-base text-blue-800">
                                                  {placar90a} <span className="text-gray-300 font-medium mx-1">x</span> {placar90b}
                                                </div>
                                                {temProrrogacao && (
                                                  <div className="flex items-center gap-1 mt-0.5">
                                                    <span className="text-[9px] font-bold text-purple-500">{oficial.gols_a}x{oficial.gols_b}</span>
                                                    <span className="text-[8px] font-semibold text-purple-400 leading-tight">prorr.</span>
                                                  </div>
                                                )}
                                              </>
                                            );
                                          })() : (
                                            <span className="text-gray-400 font-bold px-1">X</span>
                                          )}
                                        </div>
                                        <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0 justify-start">
                                          <img src={getBandeira(jogo.time_b)} className="w-6 h-6 sm:w-8 sm:h-8 rounded-full border border-gray-300 flex-shrink-0" />
                                          <span className="font-bold text-gray-700 text-xs sm:text-base text-left leading-tight">{jogo.time_b}</span>
                                        </div>
                                      </div>
                                    </div>
                                    <div className="p-5 bg-white text-sm">
                                      {(palpitesGalera[jogo.jogo_id] || []).length === 0 ? (
                                        <p className="text-gray-400 text-center py-4 italic">Nenhum palpite registrado nesta partida.</p>
                                      ) : (
                                        <div>
                                          <div className="grid grid-cols-3 gap-4 py-2 text-xs font-bold text-gray-400 uppercase tracking-wider bg-gray-50/50 rounded-lg px-4 border border-gray-100 mb-3">
                                            <div className="text-left pl-1">Jogador</div>
                                            <div className="text-center">Palpite</div>
                                            <div className="text-right pr-1">Pontos</div>
                                          </div>
                                          <div className="divide-y divide-gray-100">
                                            {palpitesGalera[jogo.jogo_id].map((p, idx) => {
                                              let ptos = '-';
                                              let badgeClasse = 'bg-gray-100 text-gray-400 border-gray-200';
                                              if (oficial) {
                                                // REGRA: usa placar de 90 min regulamentares (sem prorrogação) quando disponível
                                                const r_a = oficial.gols_a_90 !== undefined && oficial.gols_a_90 !== null ? oficial.gols_a_90 : oficial.gols_a;
                                                const r_b = oficial.gols_b_90 !== undefined && oficial.gols_b_90 !== null ? oficial.gols_b_90 : oficial.gols_b;
                                                if (p.gols_a === r_a && p.gols_b === r_b) {
                                                  ptos = '+3 Pts'; badgeClasse = 'bg-green-100 text-green-800 border-green-200 shadow-sm';
                                                } else if (
                                                  (p.gols_a > p.gols_b && r_a > r_b) ||
                                                  (p.gols_a < p.gols_b && r_a < r_b) ||
                                                  (p.gols_a === p.gols_b && r_a === r_b)
                                                ) {
                                                  ptos = '+1 Pt'; badgeClasse = 'bg-amber-100 text-amber-800 border-amber-200 shadow-sm';
                                                } else {
                                                  ptos = '0 Pts'; badgeClasse = 'bg-red-50 text-red-500 border-red-100';
                                                }
                                              }
                                              return (
                                                <div key={idx} className="grid grid-cols-3 gap-4 py-3 items-center hover:bg-blue-50/20 rounded-lg px-4 transition-colors">
                                                  <div className="text-left font-semibold text-gray-700 truncate">{p.nome}</div>
                                                  <div className="text-center">
                                                    <span className="inline-flex items-center justify-center font-extrabold text-blue-700 bg-blue-50 px-3 py-1 rounded-lg border border-blue-100 text-xs sm:text-sm min-w-[55px]">
                                                      {p.gols_a} x {p.gols_b}
                                                    </span>
                                                  </div>
                                                  <div className="text-right">
                                                    <span className={`inline-flex items-center justify-center px-2.5 py-1 text-xs font-extrabold rounded-full border ${badgeClasse}`}>
                                                      {ptos}
                                                    </span>
                                                  </div>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          )}

          {aba === 'ranking' && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-gray-800 border-b pb-4">Classificação Geral</h2>
              <div className="overflow-x-auto rounded-xl border border-gray-200">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 text-gray-600 text-sm uppercase tracking-wider">
                      <th className="p-4 font-semibold border-b">Pos</th>
                      <th className="p-4 font-semibold border-b">Nome</th>
                      <th className="p-4 font-semibold border-b text-center">Pts Jogos</th>
                      <th className="p-4 font-semibold border-b text-center">Pts Iniciais</th>
                      <th className="p-4 font-semibold border-b text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {ranking.map((usr, index) => (
                      <tr key={index} className="hover:bg-blue-50 transition-colors">
                        <td className="p-4 font-medium text-gray-900">{index + 1}º</td>
                        <td className="p-4 font-medium text-gray-900">{usr.nome}</td>
                        <td className="p-4 text-center text-gray-600">{usr.pontos_jogos}</td>
                        <td className="p-4 text-center text-gray-600">{usr.pontos_inicial}</td>
                        <td className="p-4 text-right font-bold text-green-600 text-lg">{usr.pontos_totais}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </main>
      </div>

      {feedback && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-gray-100 overflow-hidden transform transition-all duration-300 scale-100">
            <div className="p-6 text-center">
              {feedback.type === 'success' && (
                <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
                  <svg className="h-10 w-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                </div>
              )}
              {feedback.type === 'error' && (
                <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-4">
                  <svg className="h-10 w-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                  </svg>
                </div>
              )}
              {feedback.type === 'warning' && (
                <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-amber-100 mb-4">
                  <svg className="h-10 w-10 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                </div>
              )}

              <h3 className="text-xl font-bold text-gray-900 mb-2">{feedback.title}</h3>
              <p className="text-gray-500 text-sm">{feedback.text}</p>
            </div>
            <div className="bg-gray-50 px-6 py-4 flex justify-center">
              <button
                onClick={() => setFeedback(null)}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-sm shadow-sm transition-colors w-full sm:w-auto"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
