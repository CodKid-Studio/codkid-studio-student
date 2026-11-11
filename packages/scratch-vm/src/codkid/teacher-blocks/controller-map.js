/**
 * CodKid teacher blocks: find the controller of a runtime. The Lesson extension is built by the
 * extension manager with only the runtime, so it looks its controller up here.
 */
const controllers = new WeakMap();

/**
 * @param {Runtime} runtime - a runtime.
 * @param {TeacherBlocksController} controller - its controller.
 */
const setController = (runtime, controller) => {
    controllers.set(runtime, controller);
};

/**
 * @param {Runtime} runtime - a runtime.
 * @returns {?TeacherBlocksController} its controller, if teacher blocks are installed.
 */
const getController = runtime => controllers.get(runtime) || null;

module.exports = {getController, setController};
