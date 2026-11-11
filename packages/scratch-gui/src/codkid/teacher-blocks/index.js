/**
 * CodKid: teacher blocks (spec S-03), GUI side. The VM side does the real work
 * (scratch-vm/src/codkid/teacher-blocks); the GUI only gets the definitions to it.
 *
 * The lesson loader (future API client) installs its source with setTeacherBlockSource, then
 * calls loadTeacherBlocks({lessonId}) when a lesson opens and unloadTeacherBlocks() when it
 * closes. Which teacher blocks the palette shows can be narrowed with the block visibility config
 * (`categories.lesson.onlyBlocks` / `hideBlocks`, by teacher block id).
 *
 * Hook points in upstream files (marked `// CodKid:`):
 * - containers/blocks.jsx: connects the definition store to the VM.
 * - playground/render-gui.jsx: dev-only URL loader.
 */
export {
    createSampleSource,
    getTeacherBlockSource,
    loadTeacherBlocks,
    setTeacherBlockSource,
    unloadTeacherBlocks
} from './definition-source';
export {
    getTeacherBlockDefinitions,
    setTeacherBlockDefinitions,
    subscribeTeacherBlockDefinitions
} from './definition-store';
export {connectTeacherBlocksToVM} from './connect-vm';
export {EXTENSION_ID, teacherBlockIdOf} from './opcode';
