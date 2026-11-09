/**
 * SENTINEL — Diccionario de Localización Integral en Español de España (es-ES)
 * Terminología rigurosa, profesional y adaptada a centros de inteligencia tecnológica.
 */

export const i18n = {
  common: {
    appTitle: 'SENTINEL',
    appSubtitle: 'CENTRO GLOBAL DE INTELIGENCIA',
    version: 'v2.5',
    verified: 'VERIFICADO',
    autonomousSync: 'SINCRONIZACIÓN ACTIVA',
    activeApis: '12 APIs Públicas Conectadas',
    syncAll: 'Sincronizar Todo',
    syncing: 'Sincronizando...',
    searchPlaceholder: 'Buscar artículos, CVEs, modelos IA, repositorios, deportes...',
    searchShortcut: '⌘K',
    openSearch: 'Abrir buscador',
    analystButton: 'Analista IA',
    notifications: 'Notificaciones y Alertas',
    save: 'Guardar',
    saved: 'Guardado',
    delete: 'Eliminar',
    cancel: 'Cancelar',
    close: 'Cerrar',
    refresh: 'Actualizar',
    loading: 'Cargando datos...',
    noData: 'No hay datos disponibles.',
    viewDetails: 'Ver detalles',
    openLink: 'Visitar enlace oficial',
    copyLink: 'Copiar enlace',
    copied: 'Enlace copiado al portapapeles',
    status: 'Estado',
    actions: 'Acciones',
    filterAll: 'Todos',
    active: 'Activo',
    disabled: 'Deshabilitado',
    success: 'Operación completada con éxito',
    error: 'Se ha producido un error'
  },
  nav: {
    groups: {
      command: 'MANDO Y CONTROL',
      domains: 'DOMINIOS DE INTELIGENCIA',
      operations: 'OPERACIONES DEL SISTEMA'
    },
    items: {
      dashboard: 'Panel de Control',
      analyst: 'Analista IA',
      briefing: 'Informe Diario',
      news: 'Inteligencia Informativa',
      ai: 'Inteligencia Artificial',
      cybersecurity: 'Ciberseguridad',
      dev: 'Centro de Desarrollo',
      research: 'Investigación Científica',
      sports: 'Centro Deportivo',
      economy: 'Mercados y Economía',
      radar: 'Radar Tecnológico',
      sources: 'Red de Fuentes',
      watchlists: 'Listas y Alertas',
      admin: 'Administración'
    }
  },
  headerTitles: {
    dashboard: {
      title: 'Panel de Control y Mando Global',
      subtitle: 'Síntesis multisectorial de inteligencia en tiempo real'
    },
    news: {
      title: 'Inteligencia Informativa Global',
      subtitle: 'Acontecimientos verificados, teletipos y agrupación de cobertura sin duplicidades'
    },
    ai: {
      title: 'Frontera de la Inteligencia Artificial',
      subtitle: 'Benchmarks MMLU, ventanas de contexto y especificaciones de modelos fundacionales'
    },
    dev: {
      title: 'Centro de Desarrollo y Código Abierto',
      subtitle: 'Telemetría de repositorios GitHub, velocidad de estrellas y marcos de trabajo'
    },
    cybersecurity: {
      title: 'Operaciones de Ciberseguridad',
      subtitle: 'Catálogo CISA KEV de explotación activa, CVEs del NIST y mitigaciones prioritarias'
    },
    research: {
      title: 'Investigación Científica y arXiv',
      subtitle: 'Preprints de arXiv y literatura científica de OpenAlex con resúmenes ejecutivos'
    },
    sports: {
      title: 'Centro de Información Deportiva',
      subtitle: 'LaLiga, Champions League, Premier League y actualidad deportiva contrastada'
    },
    economy: {
      title: 'Mercados y Economía Global',
      subtitle: 'Índices bursátiles, materias primas, rendimientos y variables macroeconómicas'
    },
    radar: {
      title: 'Radar de Tecnologías Emergentes',
      subtitle: 'Evaluación objetiva de adopción de arquitecturas, lenguajes y librerías'
    },
    sources: {
      title: 'Red de Conectores y Fuentes',
      subtitle: 'Monitorización de APIs públicas, latencias de red y registros de sincronización'
    },
    analyst: {
      title: 'Analista de Inteligencia IA',
      subtitle: 'Terminal RAG de consulta multidisciplinar fundamentada con citas contrastadas'
    },
    briefing: {
      title: 'Dossier Ejecutivo Diario',
      subtitle: 'Resúmenes sintéticos generados automáticamente a partir de datos contrastados'
    },
    watchlists: {
      title: 'Listas de Seguimiento y Alertas',
      subtitle: 'Monitorización de términos clave, entidades críticas y notificaciones personalizadas'
    },
    admin: {
      title: 'Administración y Salud del Sistema',
      subtitle: 'Métricas de base de datos SQLite, motor de sincronización y registros de diagnóstico'
    }
  },
  dashboard: {
    bannerTitle: 'TELEMETRÍA GLOBAL DE INTELIGENCIA OPERATIVA',
    bannerSubtitle: 'Conectores autónomos sincronizando 12 APIs oficiales y redes de información abierta',
    metrics: {
      articlesProcessed: 'Artículos Procesados',
      activeThreats: 'Amenazas en Catálogo KEV',
      frontierModels: 'Modelos IA Indexados',
      trackedRepos: 'Repositorios Activos'
    },
    sections: {
      criticalThreats: 'Alertas de Ciberseguridad Activas',
      viewAllThreats: 'Ver Operaciones de Ciberseguridad',
      marketIndices: 'Indicadores Económicos',
      viewAllMarkets: 'Ver Mercados',
      breakingNews: 'Acontecimientos Recientes Verificados',
      viewAllNews: 'Ver Todas las Noticias',
      frontierAi: 'Modelos IA Destacados',
      viewAllAi: 'Ver Comparativa de Modelos',
      sportsOverview: 'Competiciones Deportivas',
      viewAllSports: 'Ver Deportes',
      radarOverview: 'Radar Tecnológico',
      viewRadar: 'Ver Radar'
    }
  },
  cybersecurity: {
    title: 'Operaciones de Ciberseguridad y Explotación KEV',
    subtitle: 'Base de datos del CISA Known Exploited Vulnerabilities (KEV) y NVD / CVE oficiales.',
    filters: {
      all: 'Todas las Vulnerabilidades',
      kevOnly: 'Explotación Activa CISA (KEV)',
      critical: 'Críticas (CVSS ≥ 9.0)',
      high: 'Altas (CVSS 7.0 - 8.9)'
    },
    badges: {
      kevExploited: 'EXPLOTADA EN ACTIVO (CISA KEV)',
      kevCatalog: 'CATÁLOGO KEV',
      nvdAdvisory: 'AVISO OFICIAL NIST/NVD',
      notAssigned: 'CVSS NO ASIGNADO'
    },
    tableHeaders: {
      cve: 'Identificador CVE',
      severity: 'Severidad / CVSS',
      products: 'Productos Afectados',
      published: 'Publicación',
      status: 'Estado Operativo',
      actions: 'Mitigación'
    },
    remediationLabel: 'Plan de Mitigación Obligatorio:',
    remediationNone: 'Consulte el boletín de seguridad oficial del fabricante para obtener el parche.',
    empty: 'No se encontraron vulnerabilidades que coincidan con los criterios seleccionados.'
  },
  sports: {
    title: 'Centro Deportivo y Competiciones Oficiales',
    subtitle: 'Resultados contrastados, clasificaciones oficiales de LaLiga y actualidad del deporte en tiempo real.',
    apiNoticeTitle: 'Nota de Integridad de Datos en Tiempo Real',
    apiNoticeDescription: 'Las telemetrías minuto a minuto en directo requieren conexión a APIs de pago autorizadas (ej. Football-Data.org / TheSportsDB). SENTINEL muestra resultados oficiales verificados y actualiza la información deportiva en directo mediante el feed oficial contrastado de MARCA.',
    tabs: {
      all: 'Todos los Deportes',
      football: 'Fútbol',
      basketball: 'Baloncesto / NBA',
      motorsport: 'Fórmula 1 y Motor'
    },
    competitions: {
      all: 'Todas las Ligas',
      laliga: 'LaLiga EA Sports',
      champions: 'Champions League',
      premier: 'Premier League'
    },
    status: {
      finished: 'FINALIZADO',
      scheduled: 'PROGRAMADO',
      live: 'EN CURSO'
    },
    standings: {
      title: 'Clasificación Oficial de la Liga',
      season: 'Temporada 2025/2026',
      rank: '#',
      team: 'Equipo',
      played: 'PJ',
      goalDiff: 'DG',
      points: 'PTS'
    },
    newsSection: 'Titulares de Actualidad Deportiva (MARCA Oficial)'
  },
  aiAnalyst: {
    title: 'Analista de Inteligencia IA de SENTINEL',
    subtitle: 'Consola de investigación asistida con fundamentación factual en la base de datos de SENTINEL.',
    groundingNotice: 'Respuestas fundamentadas exclusivamente en registros verificados de la base de datos SQLite y fuentes públicas.',
    placeholder: 'Formula una consulta de inteligencia (ej: "¿Cuáles son las vulnerabilidades de explotación activa según CISA KEV?")...',
    send: 'Consultar',
    thinking: 'Analizando registros y sintetizando respuesta...',
    quickQuestionsLabel: 'Consultas Rápidas Recomendadas:',
    quickQuestions: [
      '¿Cuáles son las vulnerabilidades más críticas de CISA KEV indexadas?',
      '¿Qué modelos de IA tienen la mayor ventana de contexto y mejor rendimiento MMLU?',
      'Resumen de los principales repositorios de código abierto con mayor crecimiento',
      '¿Cuáles son las últimas noticias deportivas publicadas por MARCA?'
    ],
    sourcesUsed: 'Fuentes Contrastadas:',
    clearHistory: 'Limpiar Historial',
    historyCleared: 'Historial de conversación reiniciado.'
  },
  news: {
    title: 'Inteligencia Informativa Global',
    categories: {
      all: 'Todas las Categorías',
      tech: 'Tecnología',
      science: 'Ciencia',
      cyber: 'Ciberseguridad',
      economy: 'Economía y Mercados',
      sports: 'Deportes'
    },
    searchPlaceholder: 'Filtrar titulares por palabra clave...',
    viewSaved: 'Artículos Guardados',
    viewAll: 'Todos los Artículos',
    clusteringToggle: 'Agrupación Inteligente de Eventos',
    clustersFound: 'Grupos Temáticos Identificados',
    readingDrawer: {
      source: 'Fuente Editorial',
      author: 'Autor',
      date: 'Fecha de Publicación',
      tags: 'Etiquetas Temáticas',
      originalArticle: 'Leer en la Fuente Oficial',
      takeaway: 'Síntesis Ejecutiva IA'
    }
  },
  dailyBriefing: {
    title: 'Informe Diario de Inteligencia Estratégica',
    subtitle: 'Síntesis consolidada generada automáticamente a partir de datos recopilados en las últimas 24 horas.',
    generateNew: 'Regenerar Informe Actualizado',
    generating: 'Generando nuevo informe ejecutivo...',
    dateLabel: 'Fecha de Expedición:',
    summaryTitle: 'Resumen Ejecutivo Multidisciplinar',
    highlightsTitle: 'Aspectos Clave y Conclusiones',
    metricsTitle: 'Balance Cuantitativo de Inteligencia',
    printOrSave: 'Exportar Informe'
  },
  sourceCenter: {
    title: 'Centro de Red de Fuentes y Conectores',
    subtitle: 'Supervisión y control de endpoints públicos oficiales, cuotas y métricas de salud.',
    syncAllButton: 'Sincronizar Todas las Fuentes',
    statusHealthy: 'OPERATIVA',
    statusDegraded: 'DEGRADADA',
    statusError: 'ERROR',
    categoryHeaders: {
      tech: 'Tecnología y Noticias',
      cyber: 'Ciberseguridad y Vulnerabilidades',
      ai: 'Modelos de Inteligencia Artificial',
      dev: 'Repositorios y Código Abierto',
      science: 'Publicaciones Científicas',
      sports: 'Deportes y Competiciones',
      economy: 'Finanzas e Indicadores Económicos'
    },
    syncNow: 'Sincronizar Ahora',
    lastSync: 'Última sinc.',
    rateLimit: 'Límite de tasa',
    recordsFetched: 'Registros indexados',
    syncLogsTitle: 'Registro de Sincronizaciones Recientes'
  },
  watchlists: {
    title: 'Listas de Seguimiento y Alertas Activas',
    subtitle: 'Reglas de supervisión automatizada de palabras clave, entidades y vulnerabilidades.',
    createRule: 'Crear Nueva Alerta',
    ruleName: 'Nombre de la Regla',
    keyword: 'Término o Palabra Clave',
    category: 'Categoría',
    priority: 'Prioridad',
    saveRule: 'Guardar Alerta',
    noRules: 'No tienes listas de seguimiento configuradas. Crea una para recibir alertas de eventos clave.',
    recentTriggered: 'Alertas Disparadas Recientemente'
  },
  admin: {
    title: 'Consola de Administración y Diagnóstico',
    subtitle: 'Estado interno del motor SQLite, salud de hilos y mantenimiento del sistema.',
    databaseMetrics: 'Métricas de Base de Datos SQLite',
    walMode: 'Modo de Registro WAL (Write-Ahead Logging)',
    vacuum: 'Optimizar y Compactar Base de Datos (VACUUM)',
    vacuuming: 'Optimizando...',
    vacuumSuccess: 'Base de datos optimizada y compactada con éxito.',
    schedulerStatus: 'Motor de Sincronización en Segundo Plano',
    schedulerActive: 'ACTIVO Y MONITOREANDO',
    schedulerPaused: 'DETENIDO',
    systemLogs: 'Registros del Sistema'
  }
};
