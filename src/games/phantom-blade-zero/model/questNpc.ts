import type { PbzEditableSlot } from './saveModel'

export type PbzQuestCompletion = 'EQuestCompletion::QC_Started' | 'EQuestCompletion::QC_Succeded'
export type PbzQuestBranchType = 'EBranchType::None' | 'EBranchType::BranchActivating' | 'EBranchType::BranchCompleted'

export interface PbzQuestBranchView {
  branchId: string
  branchType: string
  tasksProgress: number[] | null
}
export interface PbzQuestView {
  questClass: string
  questId: string
  completion: string
  branches: PbzQuestBranchView[]
}
export interface PbzNpcView {
  actorId: string
  mapId: string
  idleType: string | null
  visible: boolean | null
  eventTags: string[]
}

const completions = new Set<string>(['EQuestCompletion::QC_Started', 'EQuestCompletion::QC_Succeded'])
const branchTypes = new Set<string>(['EBranchType::None', 'EBranchType::BranchActivating', 'EBranchType::BranchCompleted'])
const rec = (v: unknown): Record<string, any> | null =>
  typeof v === 'object' && v !== null && !Array.isArray(v) ? v as Record<string, any> : null

export function projectQuests(slot: PbzEditableSlot): PbzQuestView[] {
  const saved = rec(slot.document.Narrative)?.NarrativeSavedQuests
  if (!Array.isArray(saved)) return []
  return saved.flatMap((v: unknown) => {
    const q = rec(v)
    if (!q || typeof q.QuestClass !== 'string') return []
    const branches = Array.isArray(q.QuestBranches) ? q.QuestBranches.flatMap((v: unknown) => {
      const b = rec(v)
      if (!b || typeof b.BranchID !== 'string') return []
      return [{ branchId: b.BranchID, branchType: typeof b.BranchType === 'string' ? b.BranchType : '',
        tasksProgress: Array.isArray(b.TasksProgress) && b.TasksProgress.every((n: unknown) => typeof n === 'number') ? b.TasksProgress : null }]
    }) : []
    return [{ questClass: q.QuestClass, questId: q.QuestClass.split('/').pop() ?? q.QuestClass,
      completion: typeof q.QuestCompletion === 'string' ? q.QuestCompletion : '', branches }]
  }).sort((a: PbzQuestView, b: PbzQuestView) => a.questId.localeCompare(b.questId))
}

export function setQuestCompletion(slot: PbzEditableSlot, questClass: string, value: PbzQuestCompletion): void {
  if (!completions.has(value)) throw new Error('Unsupported quest completion')
  const q = findQuest(slot, questClass)
  if (q.QuestCompletion !== value) { q.QuestCompletion = value; slot.dirty = true }
}
export function setQuestBranchType(slot: PbzEditableSlot, questClass: string, branchId: string, value: PbzQuestBranchType): void {
  if (!branchTypes.has(value)) throw new Error('Unsupported quest branch type')
  const q = findQuest(slot, questClass)
  const b = Array.isArray(q.QuestBranches) ? q.QuestBranches.map(rec).find((x: any) => x?.BranchID === branchId) : null
  if (!b) throw new Error('Quest branch not found')
  if (b.BranchType === value) return
  b.BranchType = value
  const completed = new Set<string>(Array.isArray(q.CompletedBranches) ? q.CompletedBranches.filter((x: unknown): x is string => typeof x === 'string') : [])
  if (value === 'EBranchType::BranchCompleted') completed.add(branchId); else completed.delete(branchId)
  q.CompletedBranches = [...completed]
  slot.dirty = true
}
export function projectNpcs(slot: PbzEditableSlot): PbzNpcView[] {
  const ep = rec(slot.document.EventPipeline)
  const owners = rec(ep?.ComponentsOwnerActorInfo)
  const components = rec(ep?.ComponentInfoJson)
  if (!owners) return []
  return Object.entries(owners).flatMap(([actorId, v]) => {
    if (!actorId.includes('NPCSpawner')) return []
    const owner = rec(v)
    if (!owner) return []
    const component = rec(components?.[actorId])
    return [{ actorId, mapId: actorId.match(/^PBZ_(.+?)_WP-/)?.[1] ?? 'Unknown',
      idleType: typeof owner.IdleType === 'string' ? owner.IdleType : null,
      visible: typeof owner.OwnerVisible === 'boolean' ? owner.OwnerVisible : null,
      eventTags: Array.isArray(component?.EventTag) ? component.EventTag.filter((x: unknown): x is string => typeof x === 'string') : [] }]
  }).sort((a: PbzNpcView, b: PbzNpcView) => a.mapId.localeCompare(b.mapId) || a.actorId.localeCompare(b.actorId))
}
export function setNpcIdleType(slot: PbzEditableSlot, actorId: string, value: string): void {
  const owner = findNpcOwner(slot, actorId)
  if (!['Stand','Crouch','Special1','Special2','Special3','Special4','Dead','Custom'].includes(value)) throw new Error('Unsupported NPC state')
  if (typeof owner.IdleType !== 'string') throw new Error('NPC state is not editable')
  if (owner.IdleType !== value) { owner.IdleType = value; slot.dirty = true }
}
export function setNpcVisible(slot: PbzEditableSlot, actorId: string, value: boolean): void {
  const owner = findNpcOwner(slot, actorId)
  if (typeof owner.OwnerVisible !== 'boolean') throw new Error('NPC visibility is not editable')
  if (owner.OwnerVisible !== value) { owner.OwnerVisible = value; slot.dirty = true }
}
export function addNpcEventTag(slot: PbzEditableSlot, actorId: string, tag: string): void {
  const c = findNpcComponent(slot, actorId); const value = tag.trim()
  if (!value || value.length > 256 || !Array.isArray(c.EventTag)) throw new Error('Invalid NPC event tag')
  if (!c.EventTag.includes(value)) { c.EventTag.push(value); slot.dirty = true }
}
export function removeNpcEventTag(slot: PbzEditableSlot, actorId: string, tag: string): void {
  const c = findNpcComponent(slot, actorId)
  if (!Array.isArray(c.EventTag)) throw new Error('NPC event tags are not editable')
  const next = c.EventTag.filter((x: unknown) => x !== tag)
  if (next.length !== c.EventTag.length) { c.EventTag = next; slot.dirty = true }
}
function findQuest(slot: PbzEditableSlot, id: string): Record<string, any> {
  const saved = rec(slot.document.Narrative)?.NarrativeSavedQuests
  if (!Array.isArray(saved)) throw new Error('Quest data is missing')
  const q = saved.map(rec).find((x: any) => x?.QuestClass === id)
  if (!q) throw new Error('Quest not found')
  return q
}
function findNpcOwner(slot: PbzEditableSlot, id: string): Record<string, any> {
  if (!id.includes('NPCSpawner')) throw new Error('Invalid NPC actor ID')
  const owner = rec(rec(slot.document.EventPipeline)?.ComponentsOwnerActorInfo)
  const found = rec(owner?.[id])
  if (!found) throw new Error('NPC actor not found')
  return found
}
function findNpcComponent(slot: PbzEditableSlot, id: string): Record<string, any> {
  if (!id.includes('NPCSpawner')) throw new Error('Invalid NPC actor ID')
  const components = rec(rec(slot.document.EventPipeline)?.ComponentInfoJson)
  const found = rec(components?.[id])
  if (!found) throw new Error('NPC component not found')
  return found
}
