import type { SupabaseClient } from '@supabase/supabase-js';

export interface CommunityEntry {
  roadmapId: string;
  title: string;
  ownerName: string;
  heartCount: number;
}

// roadmaps와 profiles는 둘 다 auth.users를 참조할 뿐 서로 직접 FK로 안 묶여있어서
// PostgREST가 자동으로 조인(embedding)해주지 못한다 — user_id를 키 삼아 두 번
// 조회해서 직접 합친다(리더보드와 같은 패턴).
//
// 로드맵 개수만큼 반복 호출하는 대신(N+1), 한 번의 in() 조회로 모든 로드맵의
// roadmap_reactions 행을 가져와 클라이언트에서 roadmap_id별로 세는 방식 —
// lib/leaderboard.ts의 하트 합산 로직과 같은 패턴이다.
async function countHeartsByRoadmap(
  client: SupabaseClient,
  roadmapIds: string[],
  since?: string
): Promise<Map<string, number>> {
  if (roadmapIds.length === 0) return new Map();
  let query = client.from('roadmap_reactions').select('roadmap_id').in('roadmap_id', roadmapIds);
  if (since) {
    query = query.gte('created_at', since);
  }
  const { data, error } = await query;
  if (error) throw error;
  const counts = new Map<string, number>();
  for (const row of (data ?? []) as { roadmap_id: string }[]) {
    counts.set(row.roadmap_id, (counts.get(row.roadmap_id) ?? 0) + 1);
  }
  return counts;
}

export async function listCommunityRoadmaps(
  client: SupabaseClient,
  sortBy: 'today' | 'total',
  searchName?: string
): Promise<CommunityEntry[]> {
  // 검색어가 있으면 그 결과를 먼저 확인해서, 매칭되는 사람이 없으면
  // roadmaps 쿼리 자체를 아예 안 날린다(client.from('roadmaps')를
  // 먼저 호출해두고 나중에 버리면 매칭 안 됐을 때도 불필요한 호출이 남는다).
  let searchedUserIds: string[] | null = null;
  if (searchName) {
    const { data: matchingProfiles, error: searchError } = await client
      .from('profiles')
      .select('user_id')
      .ilike('display_name', `%${searchName}%`);
    if (searchError) throw searchError;
    searchedUserIds = (matchingProfiles ?? []).map((p: { user_id: string }) => p.user_id);
    if (searchedUserIds.length === 0) return [];
  }

  let roadmapQuery = client.from('roadmaps').select('id, title, user_id').eq('is_public', true);
  if (searchedUserIds) {
    roadmapQuery = roadmapQuery.in('user_id', searchedUserIds);
  }

  const { data: roadmaps, error } = await roadmapQuery;
  if (error) throw error;
  if (!roadmaps || roadmaps.length === 0) return [];

  const ownerIds = [...new Set(roadmaps.map((r: { user_id: string }) => r.user_id))];
  const { data: profiles, error: profilesError } = await client
    .from('profiles')
    .select('user_id, display_name')
    .in('user_id', ownerIds);
  if (profilesError) throw profilesError;
  const nameByUserId = new Map(
    (profiles ?? []).map((p: { user_id: string; display_name: string }) => [p.user_id, p.display_name])
  );

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const roadmapIds = roadmaps.map((r: { id: string }) => r.id);
  const heartCounts = await countHeartsByRoadmap(
    client,
    roadmapIds,
    sortBy === 'today' ? todayStart.toISOString() : undefined
  );

  const entries = roadmaps.map((r: { id: string; title: string; user_id: string }) => ({
    roadmapId: r.id,
    title: r.title,
    ownerName: nameByUserId.get(r.user_id) ?? '알 수 없음',
    heartCount: heartCounts.get(r.id) ?? 0,
  }));

  return entries.sort((a, b) => b.heartCount - a.heartCount);
}
