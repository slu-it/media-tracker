# 0033: Game search matches the title only, with a LIKE prefix fallback

Status: accepted, 2026-10 (supersedes the search scope, weighting and ranking of record 0015; its Testcontainers
part stays)

## Context

Since MT-003 the game search (`GET /api/games?search=`, MCP `search_games`) has matched the title and the
description through two FULLTEXT indexes. It ranked games with a title hit first, then by
`2 * MATCH(title) + 0.75 * MATCH(description)` (record 0015). In practice the description hits were mostly
noise. A common word in a description pulled in games nobody looked for, and with OR semantics across words
one such word was enough. The search field is used to find a game whose name you know, not to search game
texts.

A title-only fulltext search has a gap that the description used to hide. InnoDB indexes no word shorter than
`innodb_ft_min_token_size` (3) and no stopword, so "Go" could not be found at all, and "it" could not find
"It Takes Two". Developer search (record 0029) already closes the same gap with a `LIKE` prefix match.

## Decision

- **Only the title is searched.** `ExposedGameRepository.search` matches
  `MATCH(title) AGAINST(q IN BOOLEAN MODE) OR title LIKE 'term%'`. The boolean-mode text is the same as before
  (`FulltextQuery`: every word a prefix term, any word may match, operators stripped). The `LIKE` pattern is the
  whole trimmed term as a literal (`LikePattern.ofLiteral`, so `%` and `_` match themselves) followed by `%`.
  The description stays a plain game field. The agent-only `hasMissing` filter on it is unaffected.
- **Ranking for the default `title` sort:** a prefix hit first, then the fulltext relevance of the title
  (`MatchScore`, still clamped with `LEAST(..., RELEVANCE_CAP)` against the one-row infinity fault described in
  record 0015), then title, then id. The old "has a title hit" tier and the weights are gone, because every hit
  is now a title hit. A non-default `sort` still replaces the relevance order (record 0030). `totalItems` counts
  every row matching either half.
- **A term that leaves no words** after the operators are stripped still behaves like no term (record 0015).
  The prefix match only applies when there is a fulltext query too.
- **Indexes.** V011 drops `ft_games_description`, and no index is added. `ft_games_title (title)` serves the
  fulltext half. MariaDB cannot combine a fulltext access with a B-tree range in one `OR`, so the search scans
  `games` and checks the `LIKE` per row. The old `MATCH(title) OR MATCH(description)` scanned the same way, and a
  single owner's library is small. An index on `title` for the prefix alone would not change that plan.
  `idx_games_title (title, id)` (V004) stays for the plain title-ordered listing.
  `FulltextExpressions.kt` loses `WeightedFulltextScore` and its two weights. The games search and the developer
  search now rank through the same single-column `MatchScore`.

## Consequences

- Searching for a word that only occurs in descriptions finds nothing. That is the intent.
- Short titles and stopword titles are found by their beginning ("go", "it"). A short word in the middle of a
  title ("Ori and the Will", searching "the") is still not found, because the prefix match anchors at the start
  of the title.
- One FULLTEXT index less on `games` means less index maintenance on every write of the (up to 10000
  characters) description.
- A future media kind copies this pattern rather than record 0015's: one FULLTEXT index on its title, a
  `(title, id)` B-tree index for its listing, and the `LIKE` prefix match `OR`ed into the fulltext predicate.
