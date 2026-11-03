<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { isEditableSlotName } from '../model/saveModel'
import {
  projectNpcs, projectQuests, setNpcIdleType, setNpcVisible, addNpcEventTag, removeNpcEventTag,
  setQuestBranchType, setQuestCompletion, type PbzQuestCompletion, type PbzQuestBranchType
} from '../model/questNpc'
import { usePbzEditor } from './inject'
import { reconcileSlotSelection, requestSlotSelection } from './slotSelection'

const editor = usePbzEditor()
const slotName = ref(editor.save.model.selectedSlotName ?? '')
const tab = ref('quests')
const questFilter = ref('')
const npcFilter = ref('')
watch(() => editor.rev, () => { slotName.value = reconcileSlotSelection(editor.save.model, slotName.value) }, { flush: 'sync' })
const slots = computed(() => { void editor.rev; return editor.save.model.slots.filter(s => isEditableSlotName(s.name)) })
const slot = computed(() => { void editor.rev; return editor.save.model.slots.find(s => s.name === slotName.value) ?? null })
const quests = computed(() => {
  void editor.rev
  const q = questFilter.value.trim().toLowerCase()
  return slot.value ? projectQuests(slot.value).filter(x => !q || x.questId.toLowerCase().includes(q) || x.questClass.toLowerCase().includes(q)) : []
})
const npcs = computed(() => {
  void editor.rev
  const q = npcFilter.value.trim().toLowerCase()
  return slot.value ? projectNpcs(slot.value).filter(x => !q || x.actorId.toLowerCase().includes(q) || x.mapId.toLowerCase().includes(q) || x.eventTags.some(t => t.toLowerCase().includes(q))) : []
})
function changeSlot(name: string) {
  if (requestSlotSelection(editor.save.model, name, message => window.confirm(message), 'Discard unsaved changes and switch slots?')) slotName.value = name
}
function completion(id: string, value: string) {
  if (slot.value) editor.markDirty(() => setQuestCompletion(slot.value!, id, value as PbzQuestCompletion))
}
function branch(id: string, branchId: string, value: string) {
  if (slot.value) editor.markDirty(() => setQuestBranchType(slot.value!, id, branchId, value as PbzQuestBranchType))
}
function npcState(id: string, value: string) {
  if (slot.value) editor.markDirty(() => setNpcIdleType(slot.value!, id, value))
}
function visible(id: string, value: boolean) {
  if (slot.value) editor.markDirty(() => setNpcVisible(slot.value!, id, value))
}
function addTag(id: string) {
  const value = window.prompt('Enter the exact event tag to add')
  if (slot.value && value?.trim()) editor.markDirty(() => addNpcEventTag(slot.value!, id, value))
}
function removeTag(id: string, tag: string) {
  if (slot.value && window.confirm(`Remove event tag “${tag}”?`)) editor.markDirty(() => removeNpcEventTag(slot.value!, id, tag))
}
</script>

<template>
  <div class="pbz-story" :data-ss-rev="editor.rev">
    <el-alert type="warning" :closable="false" show-icon title="Experimental story editing. Quit the game and back up the entire save folder before changing anything." />
    <el-alert type="info" :closable="false" show-icon title="NPC data is per-instance spawn state. Changing pose, visibility or tags may not fully resurrect an NPC or repair quest dependencies." />
    <el-form label-width="140px">
      <el-form-item label="Internal save slot">
        <el-select :model-value="slotName" @update:model-value="changeSlot">
          <el-option v-for="s in slots" :key="s.name" :label="s.name" :value="s.name" />
        </el-select>
      </el-form-item>
    </el-form>
    <el-tabs v-model="tab">
      <el-tab-pane label="Quests" name="quests">
        <el-input v-model="questFilter" clearable placeholder="Filter quests by ID or class" class="pbz-filter" />
        <el-table v-if="slot" :data="quests" row-key="questClass" empty-text="No saved quests in this slot">
          <el-table-column type="expand">
            <template #default="{ row }">
              <el-table :data="row.branches" size="small" row-key="branchId">
                <el-table-column prop="branchId" label="Branch" width="110" />
                <el-table-column label="Branch status" min-width="210">
                  <template #default="{ row: b }">
                    <el-select :model-value="b.branchType" @update:model-value="v => branch(row.questClass, b.branchId, v)">
                      <el-option label="Not started" value="EBranchType::None" />
                      <el-option label="Active" value="EBranchType::BranchActivating" />
                      <el-option label="Completed" value="EBranchType::BranchCompleted" />
                    </el-select>
                  </template>
                </el-table-column>
                <el-table-column label="Task progress (read-only)" min-width="180">
                  <template #default="{ row: b }">{{ b.tasksProgress ? b.tasksProgress.join(', ') : '—' }}</template>
                </el-table-column>
              </el-table>
            </template>
          </el-table-column>
          <el-table-column prop="questId" label="Quest ID / class" min-width="300" show-overflow-tooltip />
          <el-table-column label="Quest status" min-width="180">
            <template #default="{ row }">
              <el-select :model-value="row.completion" @update:model-value="v => completion(row.questClass, v)">
                <el-option label="Started" value="EQuestCompletion::QC_Started" />
                <el-option label="Completed" value="EQuestCompletion::QC_Succeded" />
              </el-select>
            </template>
          </el-table-column>
          <el-table-column label="Branches" width="100">
            <template #default="{ row }">{{ row.branches.length }}</template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
      <el-tab-pane label="NPCs" name="npcs">
        <el-input v-model="npcFilter" clearable placeholder="Filter by map, actor ID or event tag" class="pbz-filter" />
        <el-table v-if="slot" :data="npcs" row-key="actorId" empty-text="No NPC spawner records in this slot">
          <el-table-column prop="mapId" label="Map" width="130" />
          <el-table-column prop="actorId" label="Actor ID" min-width="300" show-overflow-tooltip />
          <el-table-column label="NPC state" width="150">
            <template #default="{ row }">
              <el-select v-if="row.idleType !== null" :model-value="row.idleType" @update:model-value="v => npcState(row.actorId, v)">
                <el-option v-for="v in ['Stand','Crouch','Special1','Special2','Special3','Special4','Dead','Custom']" :key="v" :label="v" :value="v" />
              </el-select>
              <span v-else>—</span>
            </template>
          </el-table-column>
          <el-table-column label="Visible" width="100">
            <template #default="{ row }">
              <el-switch v-if="row.visible !== null" :model-value="row.visible" @update:model-value="v => visible(row.actorId, v)" />
              <span v-else>—</span>
            </template>
          </el-table-column>
          <el-table-column label="Story event tags" min-width="300">
            <template #default="{ row }">
              <div class="pbz-tags">
                <el-tag v-for="tag in row.eventTags" :key="tag" closable @close="removeTag(row.actorId, tag)">{{ tag }}</el-tag>
                <el-button size="small" text @click="addTag(row.actorId)">Add tag</el-button>
              </div>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<style scoped>
.pbz-story { display: grid; gap: 16px; }
.pbz-filter { max-width: 520px; margin-bottom: 12px; }
.pbz-tags { display: flex; flex-wrap: wrap; align-items: center; gap: 5px; }
</style>
