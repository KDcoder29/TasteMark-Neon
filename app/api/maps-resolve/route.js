import handler from '../../../server/mapsResolve'
import { toRouteHandler } from '../../../server/nodeAdapter'

// Opens a short Google Maps link and returns where it leads. Logic: server/mapsResolve.js
export const GET = toRouteHandler(handler)
