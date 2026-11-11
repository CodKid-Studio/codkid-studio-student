/**
 * CodKid teacher blocks: send the definitions in the store to the VM.
 * containers/blocks.jsx calls this when it attaches to the VM.
 */
import log from '../../lib/log';
import {getTeacherBlockDefinitions, subscribeTeacherBlockDefinitions} from './definition-store';

/**
 * @param {VirtualMachine} vm - the VM. Teacher blocks are installed on it by its constructor
 *   (scratch-vm/src/codkid/teacher-blocks), which sets `vm.codkidTeacherBlocks`.
 * @returns {function} call it to disconnect.
 */
const connectTeacherBlocksToVM = vm => {
    const controller = vm && vm.codkidTeacherBlocks;
    if (!controller) return () => {};
    const send = json => {
        controller.setDefinitions(json).catch(error => {
            log.error('CodKid teacher blocks: could not apply definitions', error);
        });
    };
    // Definitions set before the GUI attached (e.g. by the dev URL loader) are sent now.
    if (getTeacherBlockDefinitions() !== null) send(getTeacherBlockDefinitions());
    return subscribeTeacherBlockDefinitions(send);
};

export {connectTeacherBlocksToVM};
