/** The same counts as `deriveStats`, for a build from before the table existed. */
export function statsSql(kind: string): string {
  switch (kind) {
    case 'decades':
      return 'SELECT CAST((year / 10) * 10 AS TEXT) AS key, COUNT(*) AS count FROM release WHERE year IS NOT NULL GROUP BY (year / 10) * 10 ORDER BY count DESC'
    case 'styles':
      return "SELECT name AS key, COUNT(*) AS count FROM release_style WHERE kind = 'style' GROUP BY name ORDER BY count DESC"
    case 'genres':
      return "SELECT name AS key, COUNT(*) AS count FROM release_style WHERE kind = 'genre' GROUP BY name ORDER BY count DESC"
    default:
      return "SELECT country AS key, COUNT(*) AS count FROM release WHERE country != '' GROUP BY country ORDER BY count DESC"
  }
}
