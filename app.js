// ============================================================
// LicenciaBCL - App de Práctica Licencia B Chile
// ============================================================
const LETRAS = ['A', 'B', 'C', 'D'];

// --- Usuarios (Hardcoded) ---
const USUARIOS = {
  "admin": "admin123",
  "estudiante": "licencia2026",
  "seura": "practicatim"
};

// --- Estado global ---
let estadoApp = {
  usuarioActual: null,
  pantallaActual: 'login',
  modoJuego: null,         // 'examen' | 'practica' | 'categoria' | 'repaso'
  categoriaFiltro: null,
  preguntasSession: [],
  indiceActual: 0,
  respuestaDada: false,
  correctas: 0,
  incorrectas: 0,
  timerInterval: null,
  tiempoRestante: 0,
  historialExamenes: [],
  estadisticasCat: {}
};

// --- Persistencia ---
function getStatsKey() {
  return 'licenciaB_stats_' + (estadoApp.usuarioActual || 'guest');
}

function cargarEstadisticas() {
  try {
    const s = localStorage.getItem(getStatsKey());
    if (s) {
      const data = JSON.parse(s);
      estadoApp.historialExamenes = data.historialExamenes || [];
      estadoApp.estadisticasCat = data.estadisticasCat || {};
      estadoApp.preguntasFalladas = data.preguntasFalladas || {};
    }
  } catch(e) {}
}

function guardarEstadisticas() {
  try {
    localStorage.setItem(getStatsKey(), JSON.stringify({
      historialExamenes: estadoApp.historialExamenes,
      estadisticasCat: estadoApp.estadisticasCat,
      preguntasFalladas: estadoApp.preguntasFalladas || {}
    }));
  } catch(e) {}
}

function registrarRespuesta(preguntaId, categoria, correcta) {
  if (!estadoApp.estadisticasCat[categoria]) {
    estadoApp.estadisticasCat[categoria] = { respondidas: 0, correctas: 0 };
  }
  estadoApp.estadisticasCat[categoria].respondidas++;
  if (correcta) estadoApp.estadisticasCat[categoria].correctas++;
  if (!estadoApp.preguntasFalladas) estadoApp.preguntasFalladas = {};
  if (!correcta) {
    estadoApp.preguntasFalladas[preguntaId] = (estadoApp.preguntasFalladas[preguntaId] || 0) + 1;
  } else if (estadoApp.preguntasFalladas[preguntaId]) {
    estadoApp.preguntasFalladas[preguntaId] = Math.max(0, estadoApp.preguntasFalladas[preguntaId] - 1);
  }
  guardarEstadisticas();
}

// --- Navegación de pantallas ---
function mostrarPantalla(id) {
  const current = document.querySelector('.screen.active');
  if (current) {
    current.classList.add('slide-out');
    setTimeout(() => current.classList.remove('active', 'slide-out'), 350);
  }
  const next = document.getElementById('screen-' + id);
  setTimeout(() => { next.classList.add('active'); }, 50);
  estadoApp.pantallaActual = id;
}

// --- Inicio ---
function iniciarHome() {
  actualizarStatsBar();
  mostrarPantalla('home');
}

function actualizarStatsBar() {
  let totalR = 0, totalC = 0;
  Object.values(estadoApp.estadisticasCat).forEach(s => {
    totalR += s.respondidas;
    totalC += s.correctas;
  });
  document.getElementById('stat-total-respondidas').textContent = totalR;
  document.getElementById('stat-total-correctas').textContent = totalC;
  document.getElementById('stat-examenes').textContent = estadoApp.historialExamenes.length;
}

// --- Mezclar array ---
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// --- Modo Examen ---
function iniciarExamen() {
  estadoApp.modoJuego = 'examen';
  estadoApp.categoriaFiltro = null;
  estadoApp.preguntasSession = shuffle(PREGUNTAS).slice(0, CONFIG_EXAMEN.totalPreguntas);
  estadoApp.indiceActual = 0;
  estadoApp.correctas = 0;
  estadoApp.incorrectas = 0;
  estadoApp.tiempoRestante = CONFIG_EXAMEN.tiempoMinutos * 60;
  iniciarQuiz();
  iniciarTimer();
}

// --- Modo Práctica ---
function iniciarPractica(categoria) {
  estadoApp.modoJuego = categoria ? 'categoria' : 'practica';
  estadoApp.categoriaFiltro = categoria || null;
  let pool = categoria ? PREGUNTAS.filter(p => p.categoria === categoria) : PREGUNTAS;
  estadoApp.preguntasSession = shuffle(pool);
  estadoApp.indiceActual = 0;
  estadoApp.correctas = 0;
  estadoApp.incorrectas = 0;
  iniciarQuiz();
}

// --- Modo Repaso de Errores ---
function iniciarRepaso() {
  const falladas = estadoApp.preguntasFalladas || {};
  const ids = Object.keys(falladas).filter(id => falladas[id] > 0).map(Number);
  let pool = PREGUNTAS.filter(p => ids.includes(p.id));
  if (pool.length === 0) {
    alert('¡Aún no tienes preguntas falladas para repasar! Primero practica un poco.');
    return;
  }
  estadoApp.modoJuego = 'repaso';
  estadoApp.categoriaFiltro = null;
  estadoApp.preguntasSession = shuffle(pool);
  estadoApp.indiceActual = 0;
  estadoApp.correctas = 0;
  estadoApp.incorrectas = 0;
  iniciarQuiz();
}

// --- Quiz Core ---
function iniciarQuiz() {
  const modoLabel = document.getElementById('quiz-mode-label');
  const timerContainer = document.getElementById('quiz-timer-container');
  if (estadoApp.modoJuego === 'examen') {
    modoLabel.textContent = 'Examen';
    modoLabel.className = 'quiz-mode-badge';
    timerContainer.style.display = 'flex';
  } else {
    const labels = { practica: 'Práctica', categoria: 'Categoría', repaso: 'Repaso' };
    modoLabel.textContent = labels[estadoApp.modoJuego] || 'Práctica';
    modoLabel.className = 'quiz-mode-badge practice';
    timerContainer.style.display = 'none';
  }
  mostrarPantalla('quiz');
  renderPregunta();
}

function renderPregunta() {
  const pregunta = estadoApp.preguntasSession[estadoApp.indiceActual];
  const total = estadoApp.preguntasSession.length;
  const idx = estadoApp.indiceActual;
  estadoApp.respuestaDada = false;

  // Progreso
  const progress = ((idx + 1) / total) * 100;
  document.getElementById('quiz-progress-fill').style.width = progress + '%';
  document.getElementById('quiz-progress-text').textContent = `Pregunta ${idx+1}/${total}`;

  // Categoría badge
  const cat = CATEGORIAS[pregunta.categoria];
  document.getElementById('question-category-badge').innerHTML =
    `<span>${cat.emoji}</span> ${cat.nombre}`;
  document.getElementById('question-category-badge').style.borderColor = cat.color + '44';
  document.getElementById('question-category-badge').style.color = cat.color;

  // Pregunta
  document.getElementById('question-text').textContent = pregunta.pregunta;

  // Opciones
  const grid = document.getElementById('options-grid');
  grid.innerHTML = '';
  pregunta.opciones.forEach((opcion, i) => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.id = 'option-' + i;
    btn.innerHTML = `<span class="option-letter">${LETRAS[i]}</span><span>${opcion}</span>`;
    btn.addEventListener('click', () => seleccionarRespuesta(i));
    grid.appendChild(btn);
  });

  // Ocultar explicación
  document.getElementById('explanation-box').style.display = 'none';

  // Botón siguiente
  const btnNext = document.getElementById('btn-next-question');
  if (estadoApp.modoJuego === 'examen') {
    btnNext.textContent = 'Siguiente →';
    btnNext.disabled = true;
  } else {
    btnNext.textContent = 'Siguiente →';
    btnNext.disabled = true;
  }

  // Score inline
  actualizarScoreInline();
}

function seleccionarRespuesta(indiceOpcion) {
  if (estadoApp.respuestaDada) return;
  estadoApp.respuestaDada = true;

  const pregunta = estadoApp.preguntasSession[estadoApp.indiceActual];
  const correcta = indiceOpcion === pregunta.respuesta;

  // Actualizar contadores
  if (correcta) estadoApp.correctas++;
  else estadoApp.incorrectas++;

  // Registrar en estadísticas
  registrarRespuesta(pregunta.id, pregunta.categoria, correcta);

  // Colorear opciones
  const botonesOpciones = document.querySelectorAll('.option-btn');
  botonesOpciones.forEach((btn, i) => {
    btn.classList.add('disabled');
    if (i === indiceOpcion && correcta) btn.classList.add('selected-correct');
    else if (i === indiceOpcion && !correcta) btn.classList.add('selected-wrong');
    else if (i === pregunta.respuesta) btn.classList.add('show-correct');
  });

  // Mostrar explicación en modo práctica, categoría y repaso
  if (estadoApp.modoJuego !== 'examen') {
    document.getElementById('explanation-text').textContent = pregunta.explicacion;
    document.getElementById('explanation-box').style.display = 'flex';
  }

  // Habilitar botón siguiente
  const btnNext = document.getElementById('btn-next-question');
  const esUltima = estadoApp.indiceActual >= estadoApp.preguntasSession.length - 1;
  btnNext.disabled = false;
  btnNext.textContent = esUltima ? 'Ver Resultado →' : 'Siguiente →';

  actualizarScoreInline();
}

function actualizarScoreInline() {
  const el = document.getElementById('quiz-score-inline');
  if (estadoApp.modoJuego !== 'examen' && estadoApp.respuestaDada) {
    el.innerHTML = `<span style="color:var(--success)">✓ ${estadoApp.correctas}</span> · <span style="color:var(--danger)">✗ ${estadoApp.incorrectas}</span>`;
  } else if (estadoApp.modoJuego === 'examen') {
    const respondidas = estadoApp.correctas + estadoApp.incorrectas;
    if (respondidas > 0) {
      el.innerHTML = `<span style="color:var(--success)">✓ ${estadoApp.correctas}</span> · <span style="color:var(--danger)">✗ ${estadoApp.incorrectas}</span>`;
    } else {
      el.textContent = '';
    }
  } else {
    el.textContent = '';
  }
}

function siguientePregunta() {
  if (!estadoApp.respuestaDada && estadoApp.modoJuego !== 'examen') {
    return;
  }
  if (estadoApp.modoJuego === 'examen' && !estadoApp.respuestaDada) {
    // En examen se puede avanzar sin responder
    estadoApp.incorrectas++;
    registrarRespuesta(estadoApp.preguntasSession[estadoApp.indiceActual].id,
      estadoApp.preguntasSession[estadoApp.indiceActual].categoria, false);
  }

  estadoApp.indiceActual++;
  if (estadoApp.indiceActual >= estadoApp.preguntasSession.length) {
    finalizarSession();
  } else {
    renderPregunta();
  }
}

// --- Timer ---
function iniciarTimer() {
  clearInterval(estadoApp.timerInterval);
  actualizarDisplayTimer();
  estadoApp.timerInterval = setInterval(() => {
    estadoApp.tiempoRestante--;
    actualizarDisplayTimer();
    if (estadoApp.tiempoRestante <= 0) {
      clearInterval(estadoApp.timerInterval);
      finalizarSession(true);
    }
  }, 1000);
}

function actualizarDisplayTimer() {
  const min = Math.floor(estadoApp.tiempoRestante / 60);
  const seg = estadoApp.tiempoRestante % 60;
  const display = document.getElementById('quiz-timer-display');
  const container = document.getElementById('quiz-timer-container');
  display.textContent = `${String(min).padStart(2,'0')}:${String(seg).padStart(2,'0')}`;
  if (estadoApp.tiempoRestante <= 60) {
    container.classList.add('urgent');
  } else {
    container.classList.remove('urgent');
  }
}

// --- Finalizar ---
function finalizarSession(tiempoAgotado) {
  clearInterval(estadoApp.timerInterval);

  const total = estadoApp.preguntasSession.length;
  const correctas = estadoApp.correctas;
  const incorrectas = total - correctas;
  const porcentaje = Math.round((correctas / total) * 100);
  const aprobado = estadoApp.modoJuego === 'examen'
    ? correctas >= CONFIG_EXAMEN.puntajeMinimo
    : porcentaje >= 70;

  // Guardar historial si es examen
  if (estadoApp.modoJuego === 'examen') {
    estadoApp.historialExamenes.push({
      fecha: new Date().toISOString(),
      correctas, incorrectas, total, porcentaje, aprobado
    });
    guardarEstadisticas();
  }

  // Renderizar resultado
  document.getElementById('resultado-icon').textContent = aprobado ? '🏆' : '📖';
  const tituloEl = document.getElementById('resultado-titulo');
  tituloEl.textContent = aprobado ? '¡Aprobado!' : 'Sigue practicando';
  tituloEl.className = 'resultado-titulo ' + (aprobado ? 'aprobado' : 'reprobado');

  let subtitulo = '';
  if (estadoApp.modoJuego === 'examen') {
    if (aprobado) subtitulo = `¡Excelente! Obtuviste ${correctas}/${total} (${porcentaje}%). Mínimo requerido: ${CONFIG_EXAMEN.puntajeMinimo}/${total}.`;
    else subtitulo = tiempoAgotado
      ? `Se agotó el tiempo. Obtuviste ${correctas}/${total}. Necesitas ${CONFIG_EXAMEN.puntajeMinimo} para aprobar.`
      : `Obtuviste ${correctas}/${total} (${porcentaje}%). Necesitas ${CONFIG_EXAMEN.puntajeMinimo} correctas para aprobar.`;
  } else {
    if (aprobado) subtitulo = `¡Muy bien! Respondiste ${correctas} de ${total} correctamente (${porcentaje}%).`;
    else subtitulo = `Respondiste ${correctas} de ${total} correctamente (${porcentaje}%). Sigue practicando para mejorar.`;
  }
  document.getElementById('resultado-subtitulo').textContent = subtitulo;
  document.getElementById('res-correctas').textContent = correctas;
  document.getElementById('res-incorrectas').textContent = incorrectas;
  document.getElementById('res-porcentaje').textContent = porcentaje + '%';

  const barraFill = document.getElementById('resultado-barra-fill');
  barraFill.style.width = '0%';
  barraFill.className = 'resultado-barra-fill ' + (aprobado ? 'aprobado' : 'reprobado');

  // Mostrar la pantalla de resultado antes de animar la barra
  mostrarPantalla('resultado');
  setTimeout(() => { barraFill.style.width = porcentaje + '%'; }, 300);

  actualizarStatsBar();
}

// --- Pantalla de categorías ---
function renderCategorias() {
  const grid = document.getElementById('category-grid');
  grid.innerHTML = '';
  Object.entries(CATEGORIAS).forEach(([key, cat]) => {
    const stats = estadoApp.estadisticasCat[key];
    const pct = stats && stats.respondidas > 0
      ? Math.round((stats.correctas / stats.respondidas) * 100)
      : null;
    const total = PREGUNTAS.filter(p => p.categoria === key).length;
    const card = document.createElement('div');
    card.className = 'category-card-item';
    card.style.borderColor = cat.color + '33';
    card.innerHTML = `
      <div class="cat-icon">${cat.emoji}</div>
      <div class="cat-info">
        <h3>${cat.nombre}</h3>
        <p>${total} preguntas</p>
        ${pct !== null ? `<p class="cat-score" style="color:${pct >= 70 ? 'var(--success)' : 'var(--danger)'}">Tu acierto: ${pct}%</p>` : '<p class="cat-score" style="color:var(--text3)">Sin datos aún</p>'}
      </div>`;
    card.addEventListener('click', () => iniciarPractica(key));
    grid.appendChild(card);
  });
}

// --- Pantalla de estadísticas ---
function renderStats() {
  const content = document.getElementById('stats-content');
  const totalR = Object.values(estadoApp.estadisticasCat).reduce((a,s) => a + s.respondidas, 0);
  const totalC = Object.values(estadoApp.estadisticasCat).reduce((a,s) => a + s.correctas, 0);

  if (totalR === 0) {
    content.innerHTML = '<div class="no-data">📊 Aún no tienes estadísticas.<br>¡Empieza a practicar!</div>';
    return;
  }

  let html = `<div class="stats-section">
    <h3>Resumen General</h3>
    <div class="resultado-stats" style="justify-content:center">
      <div class="res-stat"><span class="res-stat-val">${totalR}</span><span class="res-stat-lbl">Total respondidas</span></div>
      <div class="res-stat"><span class="res-stat-val">${totalC}</span><span class="res-stat-lbl">Correctas</span></div>
      <div class="res-stat"><span class="res-stat-val">${Math.round(totalC/totalR*100)}%</span><span class="res-stat-lbl">Acierto global</span></div>
    </div>
  </div>
  <div class="stats-section"><h3>Por Categoría</h3>`;

  Object.entries(CATEGORIAS).forEach(([key, cat]) => {
    const s = estadoApp.estadisticasCat[key];
    const pct = s && s.respondidas > 0 ? Math.round(s.correctas / s.respondidas * 100) : 0;
    const color = pct >= 80 ? 'var(--success)' : pct >= 60 ? 'var(--warning)' : 'var(--danger)';
    html += `<div class="cat-stat-row">
      <span class="cat-stat-label">${cat.emoji} ${cat.nombre}</span>
      <div class="cat-stat-bar-wrap"><div class="cat-stat-bar" style="width:${pct}%;background:${color}"></div></div>
      <span class="cat-stat-pct">${pct}%</span>
    </div>`;
  });
  html += '</div>';

  if (estadoApp.historialExamenes.length > 0) {
    html += `<div class="stats-section"><h3>Últimos Exámenes (${estadoApp.historialExamenes.length} total)</h3>`;
    [...estadoApp.historialExamenes].reverse().slice(0, 5).forEach(ex => {
      const fecha = new Date(ex.fecha).toLocaleDateString('es-CL', {day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit'});
      const color = ex.aprobado ? 'var(--success)' : 'var(--danger)';
      const emoji = ex.aprobado ? '✅' : '❌';
      html += `<div class="cat-stat-row" style="margin-bottom:8px">
        <span style="font-size:12px;color:var(--text3);min-width:120px">${fecha}</span>
        <span style="font-size:14px;font-weight:600;color:${color}">${emoji} ${ex.correctas}/${ex.total} (${ex.porcentaje}%)</span>
      </div>`;
    });
    html += '</div>';
  }

  content.innerHTML = html;
}

// --- Salir del quiz ---
function salirQuiz() {
  clearInterval(estadoApp.timerInterval);
  iniciarHome();
}

// --- Gestion de Temas ---
const TEMAS = ['azul', 'rosa', 'rojo'];

function aplicarTema(tema) {
  const body = document.body;
  TEMAS.forEach(t => body.classList.remove('theme-' + t));
  body.classList.add('theme-' + tema);
  // Actualizar boton activo
  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.theme === tema);
  });
  // Guardar preferencia
  try { localStorage.setItem('licenciaB_tema', tema); } catch(e) {}
}

function cargarTema() {
  try {
    const t = localStorage.getItem('licenciaB_tema');
    if (t && TEMAS.includes(t)) aplicarTema(t);
  } catch(e) {}
}

// --- Login / Sesion ---
function iniciarSesion() {
  const user = document.getElementById('login-user').value.trim().toLowerCase();
  const pass = document.getElementById('login-pass').value;
  const errorMsg = document.getElementById('login-error');
  
  if (USUARIOS[user] && USUARIOS[user] === pass) {
    estadoApp.usuarioActual = user;
    localStorage.setItem('licenciaB_sesion', user);
    document.getElementById('home-user-name').textContent = user.charAt(0).toUpperCase() + user.slice(1);
    errorMsg.style.display = 'none';
    cargarEstadisticas();
    actualizarStatsBar();
    iniciarHome();
  } else {
    errorMsg.style.display = 'block';
    // Trigger shake animation
    errorMsg.style.animation = 'none';
    setTimeout(() => errorMsg.style.animation = 'shake 0.4s ease', 10);
  }
}

function cerrarSesion() {
  estadoApp.usuarioActual = null;
  localStorage.removeItem('licenciaB_sesion');
  
  // Limpiar inputs
  document.getElementById('login-user').value = '';
  document.getElementById('login-pass').value = '';
  document.getElementById('login-error').style.display = 'none';
  
  // Limpiar memoria de estadisticas para que no se crucen
  estadoApp.historialExamenes = [];
  estadoApp.estadisticasCat = {};
  estadoApp.preguntasFalladas = {};
  
  mostrarPantalla('login');
}

// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
  cargarTema();
  
  // Verificar sesion activa
  const sesionGuardada = localStorage.getItem('licenciaB_sesion');
  if (sesionGuardada && USUARIOS[sesionGuardada]) {
    estadoApp.usuarioActual = sesionGuardada;
    document.getElementById('home-user-name').textContent = sesionGuardada.charAt(0).toUpperCase() + sesionGuardada.slice(1);
    cargarEstadisticas();
    actualizarStatsBar();
    iniciarHome();
  } else {
    mostrarPantalla('login');
  }

  // Eventos de login
  document.getElementById('btn-login').addEventListener('click', iniciarSesion);
  document.getElementById('login-pass').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') iniciarSesion();
  });
  document.getElementById('btn-logout').addEventListener('click', cerrarSesion);

  // Tema switcher
  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.addEventListener('click', () => aplicarTema(btn.dataset.theme));
  });

  // Home buttons
  document.getElementById('btn-inicio-examen').addEventListener('click', iniciarExamen);
  document.getElementById('btn-inicio-practica').addEventListener('click', () => iniciarPractica(null));
  document.getElementById('btn-categorias').addEventListener('click', () => {
    renderCategorias();
    mostrarPantalla('categorias');
  });
  document.getElementById('btn-repaso').addEventListener('click', iniciarRepaso);

  // Categorias
  document.getElementById('back-categorias').addEventListener('click', iniciarHome);

  // Quiz
  document.getElementById('back-quiz').addEventListener('click', () => {
    if (confirm('Seguro que quieres salir? Perderas el progreso de esta sesion.')) salirQuiz();
  });
  document.getElementById('btn-next-question').addEventListener('click', siguientePregunta);

  // Resultado
  document.getElementById('btn-volver-inicio').addEventListener('click', iniciarHome);
  document.getElementById('btn-repetir-examen').addEventListener('click', () => {
    if (estadoApp.modoJuego === 'examen') iniciarExamen();
    else if (estadoApp.modoJuego === 'categoria') iniciarPractica(estadoApp.categoriaFiltro);
    else iniciarPractica(null);
  });

  // Stats (click en logo lleva a stats)
  document.querySelector('.logo-area').addEventListener('click', () => {
    renderStats();
    mostrarPantalla('stats');
  });
  document.getElementById('back-stats').addEventListener('click', iniciarHome);
});
