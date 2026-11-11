/**
 * CodKid teacher blocks: the "Lesson" extension (spec S-03).
 *
 * Each teacher block is a command block of this extension. Running it starts the hidden
 * procedure definition in the same target, exactly like `procedures_call` does
 * (blocks/scratch3_procedures.js). engine/thread.js treats it as a procedure call for
 * "stop this script".
 *
 * Registered as a built-in extension in extension-support/extension-manager.js. The blocks come
 * from the VM's TeacherBlockRegistry (index.js); the controller refreshes them when it changes.
 */
const formatMessage = require('format-message');
const ArgumentType = require('../../extension-support/argument-type');
const BlockType = require('../../extension-support/block-type');
const TargetType = require('../../extension-support/target-type');
const {EXTENSION_ID, parseBlockOpcode, proccodeOf} = require('./opcode');
const {getController} = require('./controller-map');

/** Lesson category colours: CodKid blue, then darker shades for inputs and borders. */
const COLORS = {
    color1: '#1E8CAE',
    color2: '#1A7B99',
    color3: '#18708B'
};

/**
 * @param {object} meta - teacher block metadata.
 * @returns {object} extension argument info, keyed by input name.
 */
const argumentsOf = meta => {
    const args = {};
    meta.inputs.forEach(input => {
        args[input.name] = {
            type: input.type === 'string' ? ArgumentType.STRING : ArgumentType.NUMBER,
            defaultValue: input.default
        };
    });
    return args;
};

class CodkidLessonBlocks {
    constructor (runtime) {
        this.runtime = runtime;
    }

    getInfo () {
        const controller = getController(this.runtime);
        const entries = controller ? controller.registry.blockEntries() : [];
        return Object.assign({
            id: EXTENSION_ID,
            name: formatMessage({
                id: 'codkid.lesson.categoryName',
                default: 'Lesson',
                description: 'Name of the CodKid category that holds the teacher blocks'
            }),
            blocks: entries.map(({key, meta, inPalette}) => {
                const blockInfo = {
                    opcode: key,
                    func: 'runTeacherBlock',
                    blockType: BlockType.COMMAND,
                    text: meta.text,
                    arguments: argumentsOf(meta),
                    hideFromPalette: !inPalette
                };
                if (meta.spriteOnly) blockInfo.filter = [TargetType.SPRITE];
                return blockInfo;
            })
        }, COLORS);
    }

    /**
     * Start the hidden definition. Same steps as Scratch3ProcedureBlocks.call.
     * @param {object} args - the block's arguments, keyed by input name.
     * @param {BlockUtility} util - the block utility.
     * @param {object} blockInfo - this block's info from getInfo.
     */
    runTeacherBlock (args, util, blockInfo) {
        if (util.stackFrame.executed) return;
        const parts = parseBlockOpcode(blockInfo && blockInfo.opcode);
        if (!parts) return;
        const argumentCount = Object.keys(blockInfo.arguments || {}).length;
        const proccode = proccodeOf(parts.id, parts.version, argumentCount);
        const paramNamesIdsAndDefaults = util.getProcedureParamNamesIdsAndDefaults(proccode);
        // No definition in this target: do nothing, like a My Block without its definition.
        if (paramNamesIdsAndDefaults === null) return;

        const [paramNames, paramIds, paramDefaults] = paramNamesIdsAndDefaults;
        util.initParams();
        for (let i = 0; i < paramIds.length; i++) {
            if (Object.prototype.hasOwnProperty.call(args, paramIds[i])) {
                util.pushParam(paramNames[i], args[paramIds[i]]);
            } else {
                util.pushParam(paramNames[i], paramDefaults[i]);
            }
        }
        util.stackFrame.executed = true;
        util.startProcedure(proccode);
    }
}

module.exports = CodkidLessonBlocks;
