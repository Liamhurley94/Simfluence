/** Contracts for the admin discovery-taxonomy screen. Mirrors the
 *  admin-manage-taxonomy edge fn's `list` response (backend Task 5, see
 *  simfluence-backend docs/superpowers/specs/2026-08-04-discovery-taxonomy-authoring-design.md).
 *
 *  `phrases` (discovery_queries.query) are sent to YouTube search to FIND
 *  creators; `keywords` (genre_submodes.keywords) are substring-matched
 *  against a creator's bio to JUDGE fit. The two lists are stored, edited
 *  and used independently — never merge them. */
export interface TaxonomySubMode {
  subMode: string;
  sortOrder: number;
  phrases: string[];
  keywords: string[];
}

export interface TaxonomyGenre {
  genre: string;
  subModes: TaxonomySubMode[];
}
