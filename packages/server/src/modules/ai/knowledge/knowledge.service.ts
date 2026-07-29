/**
 * Knowledge Base Service — simple RAG for dental knowledge.
 *
 * Stores and retrieves dental articles, protocols, and guidelines.
 * Used by Clinical AI and Doctor AI to answer evidence-based questions.
 */

import prisma from '../../../lib/prisma.js';
import { simpleChat } from '../llm/client.js';

// ─── Types ───

export interface KnowledgeArticle {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  source?: string;
  embedding?: number[];
  createdAt: Date;
  updatedAt: Date;
}

export interface SearchResult {
  article: KnowledgeArticle;
  score: number;
  snippet: string;
}

export interface RAGResponse {
  answer: string;
  sources: Array<{ title: string; category: string; score: number }>;
}

// ─── Knowledge Base Service ───

export class KnowledgeBaseService {
  private readonly ARTICLES_PER_QUERY = 5;
  private readonly MIN_SCORE = 0.6;

  // ─── Article CRUD ───

  async addArticle(article: Omit<KnowledgeArticle, 'id' | 'createdAt' | 'updatedAt'>): Promise<KnowledgeArticle> {
    const id = crypto.randomUUID();
    const now = new Date();

    // Simple keyword-based embedding (in production, use OpenAI embeddings)
    const embedding = this.generateEmbedding(article.title + ' ' + article.content);

    const result = await prisma.$queryRaw<KnowledgeArticle[]>`
      INSERT INTO knowledge_articles (id, title, content, category, tags, source, embedding, created_at, updated_at)
      VALUES (${id}, ${article.title}, ${article.content}, ${article.category}, ${article.tags}, ${article.source || null}, ${JSON.stringify(embedding)}, ${now}, ${now})
      RETURNING *
    `;

    return result[0];
  }

  async getArticle(id: string): Promise<KnowledgeArticle | null> {
    const result = await prisma.$queryRaw<KnowledgeArticle[]>`
      SELECT * FROM knowledge_articles WHERE id = ${id} LIMIT 1
    `;
    return result[0] || null;
  }

  async searchArticles(query: string, limit = 10): Promise<SearchResult[]> {
    const queryEmbedding = this.generateEmbedding(query);

    const articles = await prisma.$queryRaw<KnowledgeArticle[]>`
      SELECT * FROM knowledge_articles
      ORDER BY created_at DESC
      LIMIT 100
    `;

    const results: SearchResult[] = [];

    for (const article of articles) {
      const embedding = typeof article.embedding === 'string'
        ? JSON.parse(article.embedding as string)
        : article.embedding;
      const score = this.cosineSimilarity(queryEmbedding, embedding as number[]);

      if (score >= this.MIN_SCORE) {
        const snippet = this.extractSnippet(article.content, query);
        results.push({ article, score, snippet });
      }
    }

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  // ─── RAG Query ───

  async ragQuery(query: string, category?: string): Promise<RAGResponse> {
    // 1. Retrieve relevant articles
    let results = await this.searchArticles(query, this.ARTICLES_PER_QUERY);

    if (category) {
      results = results.filter((r) => r.article.category === category);
    }

    if (results.length === 0) {
      return {
        answer: 'В базе знаний нет информации по данному запросу. Рекомендуется консультация специалиста.',
        sources: [],
      };
    }

    // 2. Build context from retrieved articles
    const context = results
      .map(
        (r, i) =>
          `[${i + 1}] ${r.article.title} (${r.article.category})\n${r.snippet}`
      )
      .join('\n\n');

    // 3. Generate answer using LLM
    const systemPrompt = [
      'Ты — AI-ассистент стоматологической клиники DentVision.',
      'Отвечай на основе предоставленного контекста из базы знаний.',
      'Если информации недостаточно, скажи об этом.',
      'Не ставь диагнозы — только информируй.',
      'Язык общения — русский.',
    ].join('\n');

    const userMessage = [
      `Вопрос: ${query}`,
      '',
      'Контекст из базы знаний:',
      context,
      '',
      'Дай краткий, точный ответ на основе контекста.',
    ].join('\n');

    let answer: string;
    try {
      answer = await simpleChat(systemPrompt, userMessage, { maxTokens: 800 });
    } catch {
      // Fallback to direct snippet
      answer = results[0].snippet;
    }

    // 4. Return answer with sources
    return {
      answer,
      sources: results.map((r) => ({
        title: r.article.title,
        category: r.article.category,
        score: Math.round(r.score * 100) / 100,
      })),
    };
  }

  // ─── Embedding (simple keyword-based) ───

  private generateEmbedding(text: string): number[] {
    // Simple bag-of-words embedding (in production, use OpenAI text-embedding-3-small)
    const words = text.toLowerCase().split(/\s+/);
    const vocab = new Set(words);
    const embedding = new Array(100).fill(0);

    for (const word of vocab) {
      const hash = this.hashWord(word);
      embedding[hash % 100] += 1;
    }

    // Normalize
    const norm = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
    if (norm > 0) {
      for (let i = 0; i < embedding.length; i++) {
        embedding[i] /= norm;
      }
    }

    return embedding;
  }

  private hashWord(word: string): number {
    let hash = 0;
    for (let i = 0; i < word.length; i++) {
      hash = ((hash << 5) - hash + word.charCodeAt(i)) | 0;
    }
    return Math.abs(hash);
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  private extractSnippet(content: string, query: string): string {
    const sentences = content.split(/[.!?]+/).filter((s) => s.trim().length > 10);
    const queryWords = query.toLowerCase().split(/\s+/);

    // Find sentences with most query word matches
    const scored = sentences.map((s) => {
      const lower = s.toLowerCase();
      const matches = queryWords.filter((w) => lower.includes(w)).length;
      return { sentence: s.trim(), matches };
    });

    scored.sort((a, b) => b.matches - a.matches);
    return scored
      .slice(0, 3)
      .map((s) => s.sentence)
      .join('. ')
      .trim() + '.';
  }

  // ─── Seed Data ───

  async seedDentalKnowledge(): Promise<number> {
    const articles = [
      {
        title: 'Острый пульпит — диагностика и лечение',
        content: 'Острый пульпит характеризуется интенсивной, пульсирующей болью, усиливающейся в ночное время. Диагноз подтверждается зондированием, термопробой и электроодонтодиагностикой. Лечение: экстирпация или ампутация пульпы. При необратимом пульпите показана полная экстирпация. Антибиотики назначаются при наличии воспаления за верхушкой корня.',
        category: 'терапия',
        tags: ['пульпит', 'боль', 'лечение', 'эндодонтия'],
        source: 'Клинические рекомендации МЗ РК',
      },
      {
        title: 'Периодонтит — классификация и протокол лечения',
        content: 'Периодонтит — воспаление периодонта. Классификация: острый, хронический, обострение. Лечение зависит от стадии: при остром — дренирование, при хроническом — эндодонтическое лечение. Обязательно: рентгенконтроль через 3 и 6 месяцев. При хроническом гранулирующем периодонтите прогноз осторожный.',
        category: 'терапия',
        tags: ['периодонтит', 'эндодонтия', 'корневые каналы'],
        source: 'Источник: ESE guidelines',
      },
      {
        title: 'Дентальные имплантаты — показания и противопоказания',
        content: 'Показания: отсутствие 1+ зубов, адекватный объём костной ткани, общее удовлетворительное состояние здоровья. Абсолютные противопоказания: некомпенсированный диабет, остеопороз, лучевая терапия области головы и шеи. Относительные: курение, бруксизм. Планирование: КЛКТ обязательно. Сроки: классический протокол 3-6 месяцев остеоинтеграции.',
        category: 'хирургия',
        tags: ['имплантация', 'хирургия', 'костная ткань'],
        source: 'ICOI Guidelines',
      },
      {
        title: 'Кариес — классификация и методы лечения',
        content: 'Классификация по ICDAS: 0 — здоровый, 1 — начальный кариес (пятно), 2 — поверхностный, 3 — средний, 4 — глубокий. Лечение: при начальном — реминерализующая терапия (фтор, кальций), при среднем и глубоком — пломбирование. При глубоком кариесе — непрямое покрытие пульпы. Материалы: композит светового отверждения для жевочной группы, стеклоиономер для временных.',
        category: 'терапия',
        tags: ['кариес', 'пломбирование', 'реминерализация'],
        source: 'Карта пациента',
      },
      {
        title: 'Гингивит и пародонтит — дифференциальная диагностика',
        content: 'Гингивит: воспаление дёсен без потери костной ткани. Лечение: профилактика, СГПД, местная антимикробная терапия. Пародонтит: потеря костной ткани, карманы >3мм. Стадии: I — лёгкая, II — средняя, III — тяжёлая. Лечение: СГПД, кюретаж, лоскутные операции. Обязательно: оценка уровня гигиены (ИГЭ/ИОГЭ).',
        category: 'терапия',
        tags: ['пародонт', 'гингивит', 'пародонтит', 'гигиена'],
        source: 'Клинические рекомендации',
      },
      {
        title: 'Анестезия в стоматологии — виды и дозировки',
        content: 'Виды: инфильтрационная (лидокаин 2%, артикаин 4%), проводниковая, внутрикостная. Максимальная доза: артикаин 7 мг/кг (без адреналина), с адреналином — до 14 мг/кг. У детей: расчёт по весу. Противопоказания: аллергия на компоненты, декомпенсированные заболевания ССС. Адреналин: 1:100000 или 1:200000.',
        category: 'хирургия',
        tags: ['анестезия', 'обезболивание', 'лидокаин', 'артикаин'],
        source: 'Фармакологический справочник',
      },
      {
        title: 'Отбеливание зубов — показания и ограничения',
        content: 'Показания: эстетическая的需求а пациента, возрастные изменения цвета. Противопоказания: кариес, трещины эмали, беременность, возраст до 16 лет. Методы: в кресле (карибский раствор 35% H2O2), домашнее (каппы 10-16% H2O2). Чувствительность — побочный эффект, купируется зубной пастой с нитратом калия. Результат держится 6-12 месяцев.',
        category: 'эстетика',
        tags: ['отбеливание', 'эстетика', 'цвет зубов'],
        source: 'Источник: ADA guidelines',
      },
    ];

    let count = 0;
    for (const article of articles) {
      try {
        await this.addArticle(article);
        count++;
      } catch (err) {
        console.warn('[KnowledgeBase] Seed article failed:', err);
      }
    }

    return count;
  }
}

// ─── Singleton ───

let instance: KnowledgeBaseService | null = null;

export function getKnowledgeBase(): KnowledgeBaseService {
  if (!instance) {
    instance = new KnowledgeBaseService();
  }
  return instance;
}
