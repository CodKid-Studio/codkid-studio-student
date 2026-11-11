/**
 * CodKid teacher blocks: names and formats shared by the VM and the hook points in upstream files.
 *
 * This module must not require anything: engine/thread.js, engine/blocks.js and engine/runtime.js
 * require it (through hidden.js), so any dependency could create a require cycle.
 *
 * - Extension id (and toolbox category id): `codkidLesson`.
 * - Block opcode inside the extension: `<id>_v<version>`, e.g. `walk_v1`.
 * - Full opcode in projects: `codkidLesson_<id>_v<version>`, e.g. `codkidLesson_walk_v1`.
 *   A project keeps the version it was made with.
 * - Proccode of the hidden definition: `codkid <id> v<version>` plus one ` %s` per input.
 *
 * scratch-gui has a copy of the opcode format in src/codkid/teacher-blocks/opcode.js.
 */

const EXTENSION_ID = 'codkidLesson';
const OPCODE_PREFIX = `${EXTENSION_ID}_`;

/** Teacher block ids: a letter, then letters and digits. No `_`, so opcodes parse without doubt. */
const ID_PATTERN = /^[A-Za-z][A-Za-z0-9]*$/;
const BLOCK_OPCODE_PATTERN = /^([A-Za-z][A-Za-z0-9]*)_v([1-9][0-9]*)$/;

/**
 * @param {string} id - teacher block id, e.g. "walk".
 * @param {number} version - definition version, e.g. 1.
 * @returns {string} the opcode inside the extension, e.g. "walk_v1". Also the registry key.
 */
const blockOpcodeOf = (id, version) => `${id}_v${version}`;

/**
 * @param {string} id - teacher block id.
 * @param {number} version - definition version.
 * @returns {string} the full opcode, e.g. "codkidLesson_walk_v1".
 */
const opcodeOf = (id, version) => `${OPCODE_PREFIX}${blockOpcodeOf(id, version)}`;

/**
 * @param {string} id - teacher block id.
 * @param {number} version - definition version.
 * @param {number} inputCount - number of inputs.
 * @returns {string} the proccode of the hidden procedure definition.
 */
const proccodeOf = (id, version, inputCount) => {
    const parts = ['codkid', id, `v${version}`];
    for (let i = 0; i < inputCount; i++) parts.push('%s');
    return parts.join(' ');
};

/**
 * @param {*} opcode - any block opcode.
 * @returns {boolean} whether it is a teacher block call.
 */
const isTeacherOpcode = opcode => typeof opcode === 'string' && opcode.indexOf(OPCODE_PREFIX) === 0;

/**
 * @param {*} blockOpcode - an opcode inside the extension, e.g. "walk_v1".
 * @returns {?{id: string, version: number}} the parts, or null if it is not a teacher block opcode.
 */
const parseBlockOpcode = blockOpcode => {
    if (typeof blockOpcode !== 'string') return null;
    const match = BLOCK_OPCODE_PATTERN.exec(blockOpcode);
    return match ? {id: match[1], version: Number(match[2])} : null;
};

/**
 * @param {*} opcode - a full opcode, e.g. "codkidLesson_walk_v1".
 * @returns {?{id: string, version: number}} the parts, or null if it is not a teacher block opcode.
 */
const parseTeacherOpcode = opcode => (
    isTeacherOpcode(opcode) ? parseBlockOpcode(opcode.slice(OPCODE_PREFIX.length)) : null
);

module.exports = {
    EXTENSION_ID,
    ID_PATTERN,
    blockOpcodeOf,
    isTeacherOpcode,
    opcodeOf,
    parseBlockOpcode,
    parseTeacherOpcode,
    proccodeOf
};
