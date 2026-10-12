/**
 * Deprecated import compatibility for older worker tests/builds. Runtime event
 * routing uses the generic module-record projector and contains no product-ID
 * branch. Remove after all pre-MP02 worker artifacts have aged out.
 */
export {projectModuleRecord as projectVaultNotesRecord} from './module-record-projector.js'
