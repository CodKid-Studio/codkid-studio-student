import log from '../../../src/lib/log';
import {
    getBlockVisibility,
    getBlockVisibilityRevision,
    setBlockVisibility,
    subscribeBlockVisibility
} from '../../../src/codkid/block-visibility/config-store';
import {loadBlockVisibilityFromUrl} from '../../../src/codkid/block-visibility/auto-load-from-url';

import sampleA from '../../../src/codkid/block-visibility/samples/lesson-a-motion-basics.json';

describe('CodKid block visibility: config store', () => {
    let warn;
    beforeEach(() => {
        warn = jest.spyOn(log, 'warn').mockImplementation(() => {});
    });
    afterEach(() => {
        setBlockVisibility(null);
        warn.mockRestore();
    });

    test('set stores the rules and bumps the revision before notifying', () => {
        const before = getBlockVisibilityRevision();
        const seen = [];
        const unsubscribe = subscribeBlockVisibility(rules => {
            seen.push({rules, current: getBlockVisibility(), revision: getBlockVisibilityRevision()});
        });
        expect(setBlockVisibility(sampleA)).toBe(true);
        expect(seen.length).toBe(1);
        expect(seen[0].rules).not.toBeNull();
        expect(seen[0].current).toBe(seen[0].rules);
        expect(seen[0].revision).toBe(before + 1);
        unsubscribe();
        setBlockVisibility(null);
        expect(seen.length).toBe(1);
    });

    test('an invalid config is stored as null and reported', () => {
        expect(setBlockVisibility({schemaVersion: 99})).toBe(false);
        expect(getBlockVisibility()).toBeNull();
        expect(setBlockVisibility(null)).toBe(true);
    });

    test('URL loader: inline JSON, sample name, bad JSON, unknown sample', () => {
        const samples = {'lesson-a-motion-basics': sampleA};
        const inline = `?codkidBlocks=${encodeURIComponent(JSON.stringify(sampleA))}`;
        expect(loadBlockVisibilityFromUrl(inline, samples)).toBe(true);
        expect(getBlockVisibility().defaultShow).toBe(false);

        setBlockVisibility(null);
        expect(loadBlockVisibilityFromUrl('?codkidBlocksSample=lesson-a-motion-basics', samples)).toBe(true);
        expect(getBlockVisibility()).not.toBeNull();

        setBlockVisibility(null);
        expect(loadBlockVisibilityFromUrl('?codkidBlocks=%7Bnot-json', samples)).toBe(false);
        expect(loadBlockVisibilityFromUrl('?codkidBlocksSample=nope', samples)).toBe(false);
        expect(loadBlockVisibilityFromUrl('?other=1', samples)).toBe(false);
        expect(getBlockVisibility()).toBeNull();
        expect(warn).toHaveBeenCalledTimes(2);
    });
});
