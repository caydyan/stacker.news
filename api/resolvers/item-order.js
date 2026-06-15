export const orderByClause = (by, me, models, type, sub, sort) => {
  switch (by) {
    case 'comments':
      return 'ORDER BY "Item".ncomments DESC'
    case 'sats':
      if (sort === 'user' && type === 'posts') {
        return 'ORDER BY "Item".msats DESC, "Item".id DESC'
      }
      return 'ORDER BY "Item".ranktop DESC, "Item".id DESC'
    case 'downsats':
      return 'ORDER BY "Item"."downMsats" DESC'
    default:
      return `ORDER BY ${type === 'bookmarks' ? '"bookmarkCreatedAt"' : '"Item".created_at'} DESC`
  }
}
