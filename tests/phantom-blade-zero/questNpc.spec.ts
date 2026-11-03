import { describe, expect, it } from 'vitest'
import type { PbzEditableSlot } from '../../src/games/phantom-blade-zero/model/saveModel'
import { projectQuests, projectNpcs, setQuestCompletion, setQuestBranchType, setNpcIdleType, setNpcVisible, addNpcEventTag, removeNpcEventTag } from '../../src/games/phantom-blade-zero/model/questNpc'

function fixture(): PbzEditableSlot {
  return { name: 'AutoSave0', dirty: false, document: {
    Narrative: { NarrativeSavedQuests: [{ QuestClass: '/Game/PBZstory/TestQuest.TestQuest_C', QuestCompletion: 'EQuestCompletion::QC_Started', CompletedBranches: ['1'], QuestBranches: [
      { BranchID: '1', BranchType: 'EBranchType::BranchCompleted', TasksProgress: [0] },
      { BranchID: '2', BranchType: 'EBranchType::BranchActivating', TasksProgress: [1] }
    ] }] },
    EventPipeline: {
      ComponentsOwnerActorInfo: { 'PBZ_Xigu_WP-BP_NPCSpawner_C_1': { IdleType: 'Dead', OwnerVisible: false } },
      ComponentInfoJson: { 'PBZ_Xigu_WP-BP_NPCSpawner_C_1': { EventTag: ['xg.npc.dead'] } }
    }
  } }
}
describe('PBZ quest and NPC editing', () => {
  it('projects quest state and synchronizes completed branch IDs', () => {
    const s = fixture(); const q = projectQuests(s)[0]!
    expect(q.questId).toBe('TestQuest.TestQuest_C')
    setQuestCompletion(s, q.questClass, 'EQuestCompletion::QC_Succeded')
    setQuestBranchType(s, q.questClass, '2', 'EBranchType::BranchCompleted')
    const saved = (s.document.Narrative as any).NarrativeSavedQuests[0]
    expect(saved.QuestCompletion).toBe('EQuestCompletion::QC_Succeded')
    expect(saved.CompletedBranches).toEqual(['1', '2'])
    expect(s.dirty).toBe(true)
  })
  it('projects and edits NPC state and tags', () => {
    const s = fixture(); const id = 'PBZ_Xigu_WP-BP_NPCSpawner_C_1'
    expect(projectNpcs(s)[0]).toMatchObject({ mapId: 'Xigu', idleType: 'Dead', visible: false, eventTags: ['xg.npc.dead'] })
    setNpcIdleType(s, id, 'Stand'); setNpcVisible(s, id, true)
    removeNpcEventTag(s, id, 'xg.npc.dead'); addNpcEventTag(s, id, 'xg.npc.alive')
    expect(projectNpcs(s)[0]).toMatchObject({ idleType: 'Stand', visible: true, eventTags: ['xg.npc.alive'] })
  })
  it('rejects unknown actors and invalid enum values', () => {
    const s = fixture()
    expect(() => setNpcIdleType(s, 'unknown', 'Stand')).toThrow()
    expect(() => setNpcIdleType(s, 'PBZ_Xigu_WP-BP_NPCSpawner_C_1', 'Flying')).toThrow()
  })
})
