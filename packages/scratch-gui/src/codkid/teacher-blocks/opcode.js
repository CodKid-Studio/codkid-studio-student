/**
 * CodKid teacher blocks: the opcode format, for the GUI.
 *
 * Must match scratch-vm/src/codkid/teacher-blocks/opcode.js (the GUI cannot import VM source
 * files directly): a teacher block's opcode is `codkidLesson_<id>_v<version>`, e.g.
 * `codkidLesson_walk_v1`. A unit test pins the format.
 */

const EXTENSION_ID = 'codkidLesson';
const OPCODE_PATTERN = /^codkidLesson_([A-Za-z][A-Za-z0-9]*)_v[1-9][0-9]*$/;

/**
 * @param {string} opcode - a block opcode (toolbox block type).
 * @returns {?string} the teacher block id without the version (e.g. "walk"), or null when the
 *   opcode is not a teacher block.
 */
const teacherBlockIdOf = opcode => {
    const match = OPCODE_PATTERN.exec(opcode);
    return match ? match[1] : null;
};

export {
    EXTENSION_ID,
    teacherBlockIdOf
};
