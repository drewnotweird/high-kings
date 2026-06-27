import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Authenticate caller
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'Unauthorized' }, 401)

  const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
  if (authError || !user) return json({ error: 'Unauthorized' }, 401)

  const { rules, board_size, action } = await req.json()

  // Cancel — remove from lobby
  if (action === 'cancel') {
    await supabase.from('lobby').delete().eq('player_id', user.id)
    return json({ status: 'cancelled' })
  }

  if (!rules || !board_size) return json({ error: 'Missing rules or board_size' }, 400)

  // Remove stale lobby rows (> 5 minutes old)
  await supabase.from('lobby').delete().lt('queued_at', new Date(Date.now() - 5 * 60 * 1000).toISOString())

  // Look for a waiting opponent with the same settings
  const { data: opponent } = await supabase
    .from('lobby')
    .select('*')
    .eq('rules', rules)
    .eq('board_size', board_size)
    .neq('player_id', user.id)
    .order('queued_at', { ascending: true })
    .limit(1)
    .single()

  if (opponent) {
    // Match found — assign sides randomly, create game
    const [attackerId, defenderId] = Math.random() < 0.5
      ? [user.id, opponent.player_id]
      : [opponent.player_id, user.id]

    const { data: game, error: gameError } = await supabase
      .from('games')
      .insert({ attacker_id: attackerId, defender_id: defenderId, rules, board_size })
      .select('id')
      .single()

    if (gameError || !game) return json({ error: 'Failed to create game' }, 500)

    // Remove opponent from lobby
    await supabase.from('lobby').delete().eq('player_id', opponent.player_id)

    return json({
      status: 'matched',
      game_id: game.id,
      side: attackerId === user.id ? 'attacker' : 'defender',
    })
  }

  // No opponent — upsert self into lobby and tell client to wait
  await supabase.from('lobby').upsert({ player_id: user.id, rules, board_size, queued_at: new Date().toISOString() })

  return json({ status: 'waiting' })
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
