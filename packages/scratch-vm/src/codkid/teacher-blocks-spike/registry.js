/**
 * CodKid SPIKE (throwaway): which teacher blocks the extension knows.
 * - catalog: the lesson's current definitions (later: from the API). Shown in the palette.
 * - project: definitions embedded in the open project. Hidden from the palette unless also in the catalog.
 * Module-level singleton: good enough for a spike.
 */
const {opcodeOf} = require('./inject');

let catalog = [];
let project = [];

const setCatalog = defs => {
    catalog = defs.slice();
};

const setProjectDefinitions = defs => {
    project = defs.slice();
};

/**
 * @returns {Array<{opcode: string, def: object, inCatalog: boolean}>} every known teacher block.
 */
const list = () => {
    const entries = new Map();
    catalog.forEach(def => entries.set(opcodeOf(def), {opcode: opcodeOf(def), def, inCatalog: true}));
    project.forEach(def => {
        if (!entries.has(opcodeOf(def))) entries.set(opcodeOf(def), {opcode: opcodeOf(def), def, inCatalog: false});
    });
    return Array.from(entries.values());
};

const get = opcode => list().find(e => e.opcode === opcode);

module.exports = {setCatalog, setProjectDefinitions, list, get};
