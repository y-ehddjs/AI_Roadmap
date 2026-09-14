import type { SupabaseClient } from '@supabase/supabase-js';

export interface CommunityEntry {
  roadmapId: string;
  title: string;
  ownerName: string;
  highFiveCount: number;
}

// roadmaps와 profiles는 둘 다 auth.users를 참조할 뿐 서로 직접 FK로 안 묶여있어서
// PostgREST가 자동으로 조인(embedding)해주지 못한다 — user_id를 키 삼아 두 번
// 조회해서 직접 합친다(리더보드, Task 25와 같은 패턴).
async function countHighFivesForRoadmap(
  client: SupabaseClient,
  roadmapId: string,
  since?: string
): Promise<number> {
  const { data: milestoneRows, error: milestoneError } = await client
    .from('milestones')
    .select('id')
    .eq('roadmap_id', roadmapId);
  if (milestoneError) throw milestoneError;
  const milestoneIds = (milestoneRows ?? []).map((m: { id: string }) => m.id);
  if (milestoneIds.length === 0) return 0;

  let query = client
    .from('milestone_reactions')
    .select('id', { count: 'exact', head: true })
    .in('milestone_id', milestoneIds);
  if (since) {
    query = query.gte('created_at', since);
  }
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
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

  const entries = await Promise.all(
    roadmaps.map(async (r: { id: string; title: string; user_id: string }) => {
      const highFiveCount = await countHighFivesForRoadmap(
        client,
        r.id,
        sortBy === 'today' ? todayStart.toISOString() : undefined
      );
      return {
        roadmapId: r.id,
        title: r.title,
        ownerName: nameByUserId.get(r.user_id) ?? '알 수 없음',
        highFiveCount,
      };
    })
  );

  return entries.sort((a, b) => b.highFiveCount - a.highFiveCount);
}
