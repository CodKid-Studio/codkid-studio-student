/**
 * CodKid SPIKE (throwaway): the "Lesson" extension. Each teacher block is an extension block whose
 * primitive calls the hidden procedure definition, the same way procedures_call does.
 */
const ArgumentType = require('../../extension-support/argument-type');
const BlockType = require('../../extension-support/block-type');
const registry = require('./registry');
const {EXTENSION_ID, proccodeOf} = require('./inject');

class CodkidLessonSpike {
    constructor (runtime) {
        this.runtime = runtime;
    }

    getInfo () {
        return {
            id: EXTENSION_ID,
            name: 'Lesson',
            // Placeholder colour for the spike. The real CodKid colour is decided later.
            color1: '#E8506F',
            color2: '#D1405F',
            color3: '#B8334F',
            blocks: registry.list().map(entry => ({
                opcode: entry.opcode,
                func: 'runTeacherBlock',
                blockType: BlockType.COMMAND,
                text: entry.def.text,
                hideFromPalette: !entry.inCatalog,
                arguments: entry.def.inputs.reduce((acc, input) => {
                    acc[input.name] = {
                        type: input.type === 'string' ? ArgumentType.STRING : ArgumentType.NUMBER,
                        defaultValue: input.default
                    };
                    return acc;
                }, {})
            }))
        };
    }

    // Mirrors Scratch3ProcedureBlocks.call (blocks/scratch3_procedures.js).
    runTeacherBlock (args, util, blockInfo) {
        if (util.stackFrame.executed) return;
        const entry = registry.get(blockInfo.opcode);
        if (!entry) return;
        const def = entry.def;
        util.initParams();
        def.inputs.forEach(input => {
            util.pushParam(input.name,
                Object.prototype.hasOwnProperty.call(args, input.name) ? args[input.name] : input.default);
        });
        util.stackFrame.executed = true;
        util.startProcedure(proccodeOf(def));
    }
}

module.exports = CodkidLessonSpike;
