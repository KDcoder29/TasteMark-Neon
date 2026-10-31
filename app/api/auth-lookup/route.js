import handler from '../../../server/authLookup'
import { toRouteHandler } from '../../../server/nodeAdapter'

// Username → email and "is this username free?", before sign-in. Logic: server/authLookup.js
export const GET = toRouteHandler(handler)
