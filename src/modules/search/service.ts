import { db } from "@/kernel/db";
import { generateId, now } from "@/shared/utils";
import type { SearchResult, RecentItem, CommandResult, ID } from "@/shared/types";

export interface IndexableEntity {
  entityType: string;
  entityId: ID;
  title: string;
  body: string;
  tags?: string[];
  projectId?: ID;
}

export const SearchService = {
  /** Index an entity into the FTS5 virtual table. Overwrites existing if present. */
  async indexEntity(entity: IndexableEntity): Promise<void> {
    // Delete existing to avoid duplicates
    await this.deindexEntity(entity.entityType, entity.entityId);
    
    await db.execute(
      `INSERT INTO search_index (entity_type, entity_id, title, body, tags, project_id, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        entity.entityType,
        entity.entityId,
        entity.title,
        entity.body,
        (entity.tags || []).join(" "),
        entity.projectId || null,
        now()
      ]
    );
  },

  /** Remove an entity from the search index */
  async deindexEntity(entityType: string, entityId: ID): Promise<void> {
    await db.execute(
      `DELETE FROM search_index WHERE entity_type = ? AND entity_id = ?`,
      [entityType, entityId]
    );
  },

  /** FTS5 Search */
  async search(query: string, filters?: { type?: string[], projectId?: ID }, limit = 20): Promise<SearchResult[]> {
    if (!query.trim()) return [];

    let matchString = query.trim() + "*";

    // Semantic query expansion (Phase 6)
    if (query.trim().length > 3) {
      try {
        const { AIService } = await import("@/modules/ai/service");
        const available = await AIService.isAvailable();
        if (available.ok) {
          const prompt = `Extract 3-5 core keywords and synonyms from this search intent for a full-text search. 
Query: "${query}"
Return ONLY a space-separated list of words (no quotes, no commas, no 'OR'). Example: "burnout overwhelm exhaustion stress"`;
          const expanded = await AIService.complete(prompt, { maxTokens: 20 });
          if (expanded && expanded.trim()) {
            const words = expanded.replace(/[^\w\s]/g, "").split(/\s+/).filter(Boolean);
            if (words.length > 0) {
              matchString = words.join(" OR ");
            }
          }
        }
      } catch (e) {
        // Fallback to literal search if AI fails
      }
    }

    let sql = `SELECT entity_type, entity_id, title, snippet(search_index, 3, '<b>', '</b>', '...', 32) as bodyExcerpt, tags, project_id, updated_at, bm25(search_index) as score 
               FROM search_index WHERE search_index MATCH ?`;
    const params: unknown[] = [matchString];

    if (filters?.type && filters.type.length > 0) {
      sql += ` AND entity_type IN (${filters.type.map(() => '?').join(',')})`;
      params.push(...filters.type);
    }
    
    if (filters?.projectId) {
      sql += ` AND project_id = ?`;
      params.push(filters.projectId);
    }

    // Rank by BM25 score (lower is better in SQLite FTS5) and then recency
    sql += ` ORDER BY score ASC, updated_at DESC LIMIT ?`;
    params.push(limit);

    const rows = await db.select<Record<string, unknown>>(sql, params);
    
    return rows.map(r => ({
      type: r.entity_type as any,
      id: r.entity_id as string,
      title: r.title as string,
      excerpt: r.bodyExcerpt as string,
      tags: r.tags ? (r.tags as string).split(" ").filter(Boolean) : [],
      projectId: r.project_id as string,
      updatedAt: r.updated_at as string,
      score: r.score as number
    }));
  },

  async getRecentItems(limit = 10): Promise<RecentItem[]> {
    // Auto-cleanup bad objects
    await db.execute(`DELETE FROM recent_items WHERE title = '[object Object]'`);
    await db.execute(`DELETE FROM search_index WHERE title = '[object Object]'`);

    const rows = await db.select<Record<string, unknown>>(
      `SELECT * FROM recent_items ORDER BY opened_at DESC LIMIT ?`,
      [limit]
    );
    return rows.map(r => ({
      entityType: r.entity_type as string,
      entityId: r.entity_id as string,
      openedAt: r.opened_at as string,
      title: r.title as string
    }));
  },

  async recordItemOpened(entityType: string, entityId: ID, title: string): Promise<void> {
    await db.execute(
      `INSERT INTO recent_items (entity_type, entity_id, opened_at, title)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(entity_type, entity_id) DO UPDATE SET
       opened_at = excluded.opened_at,
       title = excluded.title`,
      [entityType, entityId, now(), title]
    );
  },

  // Stub for now. Should hook into module registries.
  async getCommands(query: string): Promise<CommandResult[]> {
    return [];
  }
};
