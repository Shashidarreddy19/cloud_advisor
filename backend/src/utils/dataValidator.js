const logger = require('./logger');

/**
 * Data Validator
 * Validates fetched cloud data against expected schema
 */

/**
 * Validate VM/Instance data
 * @param {Object} vm - VM data object
 * @param {String} cloud - Cloud provider (aws, azure, gcp)
 * @returns {Object} Validation result
 */
function validateVMData(vm, cloud) {
    const errors = [];
    const warnings = [];

    // Required fields
    if (!vm.instance_id) {
        errors.push('Missing instance_id');
    }
    if (!vm.instance_type) {
        errors.push('Missing instance_type');
    }
    if (!vm.region) {
        errors.push('Missing region');
    }
    if (!vm.state) {
        errors.push('Missing state');
    }

    // Validate state values
    const validStates = ['running', 'stopped', 'terminated', 'stopping', 'pending', 'RUNNING', 'STOPPED', 'TERMINATED'];
    if (vm.state && !validStates.includes(vm.state)) {
        warnings.push(`Invalid state: ${vm.state}`);
    }

    // Validate specs (should be numbers or null)
    if (vm.vcpu_count !== null && vm.vcpu_count !== undefined) {
        if (typeof vm.vcpu_count !== 'number' || vm.vcpu_count < 0) {
            errors.push(`Invalid vcpu_count: ${vm.vcpu_count}`);
        }
    }

    if (vm.ram_gb !== null && vm.ram_gb !== undefined) {
        if (typeof vm.ram_gb !== 'number' || vm.ram_gb < 0) {
            errors.push(`Invalid ram_gb: ${vm.ram_gb}`);
        }
    }

    // Validate metrics (should be numbers or null, and within valid ranges)
    if (vm.cpu_avg !== null && vm.cpu_avg !== undefined) {
        if (typeof vm.cpu_avg !== 'number' || vm.cpu_avg < 0 || vm.cpu_avg > 100) {
            warnings.push(`Invalid cpu_avg: ${vm.cpu_avg} (should be 0-100)`);
        }
    }

    if (vm.memory_avg !== null && vm.memory_avg !== undefined) {
        if (typeof vm.memory_avg !== 'number' || vm.memory_avg < 0 || vm.memory_avg > 100) {
            warnings.push(`Invalid memory_avg: ${vm.memory_avg} (should be 0-100)`);
        }
    }

    // Validate OS
    const validOSTypes = ['Linux', 'Windows', 'unknown'];
    if (vm.os && !validOSTypes.includes(vm.os)) {
        warnings.push(`Invalid os: ${vm.os}`);
    }

    // Cloud-specific validations
    if (cloud === 'aws') {
        // AWS instance IDs start with 'i-'
        if (vm.instance_id && !vm.instance_id.startsWith('i-')) {
            warnings.push(`AWS instance_id should start with 'i-': ${vm.instance_id}`);
        }
    }

    if (cloud === 'gcp') {
        // GCP should have numeric instance IDs
        if (vm.instance_id && isNaN(vm.instance_id)) {
            warnings.push(`GCP instance_id should be numeric: ${vm.instance_id}`);
        }
    }

    const isValid = errors.length === 0;

    return {
        valid: isValid,
        errors,
        warnings,
        vm_id: vm.instance_id || 'unknown'
    };
}

/**
 * Validate batch of VMs and log results
 * @param {Array} vms - Array of VM objects
 * @param {String} cloud - Cloud provider
 * @returns {Object} Validation summary
 */
function validateVMBatch(vms, cloud) {
    const results = {
        total: vms.length,
        valid: 0,
        invalid: 0,
        warnings: 0,
        errors: []
    };

    for (const vm of vms) {
        const validation = validateVMData(vm, cloud);

        if (validation.valid) {
            results.valid++;
        } else {
            results.invalid++;
            results.errors.push({
                vm_id: validation.vm_id,
                errors: validation.errors
            });

            // Log validation errors
            logger.error(`[Data Validation] ${cloud.toUpperCase()} VM ${validation.vm_id} failed validation:`, validation.errors);
        }

        if (validation.warnings.length > 0) {
            results.warnings++;
            logger.warn(`[Data Validation] ${cloud.toUpperCase()} VM ${validation.vm_id} has warnings:`, validation.warnings);
        }
    }

    // Log summary
    logger.info(`[Data Validation] ${cloud.toUpperCase()} Summary: ${results.valid}/${results.total} valid, ${results.invalid} invalid, ${results.warnings} with warnings`);

    return results;
}

/**
 * Mark VM with data error
 * @param {Object} vm - VM object
 * @param {Array} errors - Array of error messages
 * @returns {Object} VM with error marker
 */
function markVMWithError(vm, errors) {
    return {
        ...vm,
        data_error: true,
        data_error_messages: errors,
        optimizationStatus: 'INSUFFICIENT_DATA'
    };
}

module.exports = {
    validateVMData,
    validateVMBatch,
    markVMWithError
};
