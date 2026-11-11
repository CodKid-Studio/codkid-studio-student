/**
 * CodKid teacher blocks: which teacher blocks one VM knows about.
 *
 * - catalog: every definition received from the definition source (all versions, deleted ones
 *   too). These have a body, so they can be injected into any target.
 * - embedded: metadata of definitions found in the open project (or added to it later, e.g. by a
 *   sprite upload). Their body only exists as hidden blocks in the project's targets.
 *
 * Keys are block opcodes inside the extension, e.g. "walk_v1".
 */
const {blockOpcodeOf} = require('./opcode');

/**
 * The fields of a definition that describe the block itself (no body). Stored in the `codkiddef`
 * marker of every hidden definition.
 * @param {object} definition - a normalized definition, or metadata.
 * @returns {object} the metadata.
 */
const metaOf = definition => ({
    id: definition.id,
    version: definition.version,
    text: definition.text,
    inputs: definition.inputs.map(input => ({name: input.name, type: input.type, default: input.default})),
    variables: (definition.variables || []).map(variable => ({name: variable.name, type: variable.type})),
    warp: !!definition.warp,
    spriteOnly: !!definition.spriteOnly
});

class TeacherBlockRegistry {
    constructor () {
        /**
         * Key → normalized definition (with body).
         * @type {Map.<string, object>}
         */
        this.catalog = new Map();
        /**
         * Key → metadata found in the open project.
         * @type {Map.<string, object>}
         */
        this.embedded = new Map();
    }

    /**
     * @param {Array.<object>} definitions - normalized definitions. Replaces the whole catalog.
     */
    setCatalog (definitions) {
        this.catalog = new Map(definitions.map(definition => [
            blockOpcodeOf(definition.id, definition.version), definition
        ]));
    }

    /**
     * @param {Array.<object>} metas - metadata found in a project that replaces the open one.
     */
    setEmbedded (metas) {
        this.embedded = new Map();
        this.addEmbedded(metas);
    }

    /**
     * @param {Array.<object>} metas - metadata that the open project now also contains.
     * @returns {boolean} whether any key was new.
     */
    addEmbedded (metas) {
        let added = false;
        metas.forEach(meta => {
            const key = blockOpcodeOf(meta.id, meta.version);
            if (!this.embedded.has(key)) added = true;
            this.embedded.set(key, meta);
        });
        return added;
    }

    /**
     * @param {string} key - e.g. "walk_v1".
     * @returns {boolean} whether this VM can run (and render) this teacher block.
     */
    knows (key) {
        return this.catalog.has(key) || this.embedded.has(key);
    }

    /**
     * @param {string} key - e.g. "walk_v1".
     * @returns {?object} metadata for the key: from the catalog if it is there, else from the project.
     */
    getMeta (key) {
        if (this.catalog.has(key)) return metaOf(this.catalog.get(key));
        return this.embedded.has(key) ? this.embedded.get(key) : null;
    }

    /**
     * @param {string} key - e.g. "walk_v1".
     * @returns {?object} the catalog definition (with body), or null.
     */
    getDefinition (key) {
        return this.catalog.get(key) || null;
    }

    /**
     * The palette shows, for each id, the highest catalog version, unless that version is deleted.
     * @returns {Set.<string>} keys shown in the palette.
     */
    paletteKeys () {
        const latest = new Map();
        this.catalog.forEach(definition => {
            const current = latest.get(definition.id);
            if (!current || definition.version > current.version) latest.set(definition.id, definition);
        });
        const keys = new Set();
        latest.forEach(definition => {
            if (!definition.deleted) keys.add(blockOpcodeOf(definition.id, definition.version));
        });
        return keys;
    }

    /**
     * Every target of the open project must contain these definitions, so a teacher block works
     * wherever a child puts it: the palette versions and the versions the project already uses.
     * @returns {Array.<string>} keys.
     */
    requiredKeys () {
        const keys = this.paletteKeys();
        this.embedded.forEach((meta, key) => keys.add(key));
        return Array.from(keys);
    }

    /**
     * @returns {Array.<{key: string, meta: object, inPalette: boolean}>} every block the Lesson
     *   extension defines, in catalog order (the palette order), then the project's other versions.
     *   Blocks that are not in the palette still render and run.
     */
    blockEntries () {
        const palette = this.paletteKeys();
        const keys = new Set(Array.from(this.catalog.keys()).concat(Array.from(this.embedded.keys())));
        return Array.from(keys)
            .map(key => ({key, meta: this.getMeta(key), inPalette: palette.has(key)}));
    }

    /**
     * @returns {boolean} whether there is no teacher block at all.
     */
    isEmpty () {
        return this.catalog.size === 0 && this.embedded.size === 0;
    }
}

module.exports = {
    TeacherBlockRegistry,
    metaOf
};
