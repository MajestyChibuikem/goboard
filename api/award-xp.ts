export default async function handler(req: any, res: any) {
  return res.status(410).json({
    error: 'Endpoint retired. XP awards are now server-authoritative via /api/xp-event.'
  });
}
