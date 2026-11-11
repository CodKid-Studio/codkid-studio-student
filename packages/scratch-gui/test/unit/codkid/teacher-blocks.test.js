import log from '../../../src/lib/log';
import {
    connectTeacherBlocksToVM,
    createSampleSource,
    getTeacherBlockDefinitions,
    loadTeacherBlocks,
    setTeacherBlockDefinitions,
    setTeacherBlockSource,
    teacherBlockIdOf,
    unloadTeacherBlocks
} from '../../../src/codkid/teacher-blocks';
import {loadTeacherBlocksFromUrl} from '../../../src/codkid/teacher-blocks/auto-load-from-url';
import sample from '../../../src/codkid/teacher-blocks/samples/lesson-sample.json';

// The VM side (vm.codkidTeacherBlocks) is tested in scratch-vm; here it is a stub.
const makeVm = () => {
    const calls = [];
    return {
        calls,
        codkidTeacherBlocks: {
            setDefinitions: json => {
                calls.push(json);
                return Promise.resolve();
            }
        }
    };
};

describe('CodKid teacher blocks: opcode', () => {
    test('teacher block id from an opcode (same format as scratch-vm)', () => {
        expect(teacherBlockIdOf('codkidLesson_walk_v1')).toBe('walk');
        expect(teacherBlockIdOf('codkidLesson_addScore_v12')).toBe('addScore');
        expect(teacherBlockIdOf('codkidLesson_walk')).toBeNull();
        expect(teacherBlockIdOf('motion_movesteps')).toBeNull();
    });
});

describe('CodKid teacher blocks: definition source → store → VM', () => {
    let warn;
    beforeEach(() => {
        warn = jest.spyOn(log, 'warn').mockImplementation(() => {});
    });
    afterEach(() => {
        warn.mockRestore();
        setTeacherBlockSource(null);
        setTeacherBlockDefinitions(null);
    });

    test('the sample file has the spec examples', () => {
        expect(sample.schemaVersion).toBe(1);
        expect(sample.definitions.map(d => `${d.id}_v${d.version}`))
            .toEqual(['crabbySays_v1', 'walk_v1', 'walk_v2', 'addScore_v1']);
    });

    test('a source\'s definitions reach the VM', async () => {
        const vm = makeVm();
        const disconnect = connectTeacherBlocksToVM(vm);
        setTeacherBlockSource(createSampleSource({lesson1: sample}));
        await expect(loadTeacherBlocks({lessonId: 'lesson1'})).resolves.toBe(true);
        expect(getTeacherBlockDefinitions()).toBe(sample);
        expect(vm.calls).toEqual([sample]);

        unloadTeacherBlocks();
        expect(vm.calls).toEqual([sample, null]);
        disconnect();
        setTeacherBlockDefinitions(sample);
        expect(vm.calls).toHaveLength(2);
    });

    test('definitions loaded before the VM connects are sent when it connects', () => {
        setTeacherBlockDefinitions(sample);
        const vm = makeVm();
        connectTeacherBlocksToVM(vm)();
        expect(vm.calls).toEqual([sample]);
    });

    test('a source can be swapped (e.g. for the lesson API)', async () => {
        const vm = makeVm();
        const disconnect = connectTeacherBlocksToVM(vm);
        const api = {fetchDefinitions: jest.fn(() => Promise.resolve({schemaVersion: 1, definitions: []}))};
        setTeacherBlockSource(api);
        await loadTeacherBlocks({lessonId: 'L-42'});
        expect(api.fetchDefinitions).toHaveBeenCalledWith({lessonId: 'L-42'});
        expect(vm.calls).toEqual([{schemaVersion: 1, definitions: []}]);
        disconnect();
    });

    test('a failing source means no teacher blocks, with a warning', async () => {
        setTeacherBlockDefinitions(sample);
        setTeacherBlockSource(createSampleSource({}));
        await expect(loadTeacherBlocks({lessonId: 'missing'})).resolves.toBe(false);
        expect(getTeacherBlockDefinitions()).toBeNull();
        expect(warn).toHaveBeenCalled();
    });

    test('no source: nothing is loaded', async () => {
        await expect(loadTeacherBlocks({lessonId: 'x'})).resolves.toBe(false);
        expect(warn).toHaveBeenCalled();
    });

    test('a VM without teacher blocks is ignored', () => {
        expect(() => connectTeacherBlocksToVM({})()).not.toThrow();
    });

    test('dev URL: ?codkidTeacherBlocksSample=<name>', async () => {
        expect(loadTeacherBlocksFromUrl('?other=1', {s: sample})).toBeNull();
        await loadTeacherBlocksFromUrl('?codkidTeacherBlocksSample=s', {s: sample});
        expect(getTeacherBlockDefinitions()).toBe(sample);
    });
});
