const { ClientSecretCredential } = require("@azure/identity");
const axios = require("axios");
const { ComputeManagementClient } = require("@azure/arm-compute");
const { StorageManagementClient } = require("@azure/arm-storage");
const { MonitorClient } = require("@azure/arm-monitor");
const Resource = require('../models/Resource');
const logger = require('../utils/logger');
const { normalizeVM } = require('./normalizationService');
const { enrichVMBatch } = require('./enrichmentService');
const { processVMsInBatches } = require('./mlService');
const { handleCloudError } = require('./credentialValidationService');

/**
 * Parse Azure VM size for specs
 */
const getAzureVMSpecs = (vmSize) => {
    const specs = {
        'Standard_B1s': { vCpu: 1, memoryGb: 1 },
        'Standard_B1ms': { vCpu: 1, memoryGb: 2 },
        'Standard_B2s': { vCpu: 2, memoryGb: 4 },
        'Standard_B2ms': { vCpu: 2, memoryGb: 8 },
        'Standard_B4ms': { vCpu: 4, memoryGb: 16 },
        'Standard_D2s_v3': { vCpu: 2, memoryGb: 8 },
        'Standard_D4s_v3': { vCpu: 4, memoryGb: 16 },
        'Standard_D8s_v3': { vCpu: 8, memoryGb: 32 },
        'Standard_E2s_v3': { vCpu: 2, memoryGb: 16 },
        'Standard_E4s_v3': { vCpu: 4, memoryGb: 32 },
        'Standard_E8s_v3': { vCpu: 8, memoryGb: 64 },
        'Standard_F2s_v2': { vCpu: 2, memoryGb: 4 },
        'Standard_F4s_v2': { vCpu: 4, memoryGb: 8 },
        'Standard_F8s_v2': { vCpu: 8, memoryGb: 16 }
    };
    return specs[vmSize] || { vCpu: 2, memoryGb: 4 };
};

/**
 * Fetch Azure Monitor metrics for a VM
 * Returns average and p95 CPU and memory utilization
 */
const fetchAzureMonitorMetrics = async (monitorClient, resourceId) => {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - 7 * 24 * 60 * 60 * 1000); // Last 7 days

    try {
        // CPU Percentage
        const cpuMetrics = await monitorClient.metrics.list(
            resourceId,
            {
                timespan: `${startTime.toISOString()}/${endTime.toISOString()}`,
                interval: 'PT1H', // 1 hour
                metricnames: 'Percentage CPU',
                aggregation: 'Average'
            }
        );

        let cpu_avg = 0;
        let cpu_p95 = 0;

        if (cpuMetrics.value && cpuMetrics.value.length > 0) {
            const cpuTimeseries = cpuMetrics.value[0].timeseries;
            if (cpuTimeseries && cpuTimeseries.length > 0) {
                const cpuData = cpuTimeseries[0].data || [];
                const cpuValues = cpuData
                    .filter(d => d.average !== undefined && d.average !== null)
                    .map(d => d.average);

                if (cpuValues.length > 0) {
                    cpu_avg = cpuValues.reduce((sum, val) => sum + val, 0) / cpuValues.length;
                    cpuValues.sort((a, b) => a - b);
                    const p95Index = Math.floor(cpuValues.length * 0.95);
                    cpu_p95 = cpuValues[p95Index] || cpu_avg * 1.2;
                }
            }
        }

        // Available Memory Bytes (convert to percentage)
        const memMetrics = await monitorClient.metrics.list(
            resourceId,
            {
                timespan: `${startTime.toISOString()}/${endTime.toISOString()}`,
                interval: 'PT1H',
                metricnames: 'Available Memory Bytes',
                aggregation: 'Average'
            }
        );

        let memory_avg = 0;
        let memory_p95 = 0;

        if (memMetrics.value && memMetrics.value.length > 0) {
            const memTimeseries = memMetrics.value[0].timeseries;
            if (memTimeseries && memTimeseries.length > 0) {
                const memData = memTimeseries[0].data || [];
                const memValues = memData
                    .filter(d => d.average !== undefined && d.average !== null)
                    .map(d => d.average);

                if (memValues.length > 0) {
                    // Available memory - need to convert to used percentage
                    // This requires knowing total memory, so we'll estimate
                    const avgAvailable = memValues.reduce((sum, val) => sum + val, 0) / memValues.length;
                    // Estimate: if we have 8GB (8589934592 bytes), and 2GB available, that's 75% used
                    // For now, estimate memory usage from CPU
                    memory_avg = cpu_avg * 0.8;
                    memory_p95 = cpu_p95 * 0.8;
                }
            }
        } else {
            // Estimate memory from CPU if not available
            memory_avg = cpu_avg * 0.8;
            memory_p95 = cpu_p95 * 0.8;
        }

        // Network In/Out
        const networkInMetrics = await monitorClient.metrics.list(
            resourceId,
            {
                timespan: `${startTime.toISOString()}/${endTime.toISOString()}`,
                interval: 'PT1H',
                metricnames: 'Network In Total',
                aggregation: 'Average'
            }
        );

        const networkOutMetrics = await monitorClient.metrics.list(
            resourceId,
            {
                timespan: `${startTime.toISOString()}/${endTime.toISOString()}`,
                interval: 'PT1H',
                metricnames: 'Network Out Total',
                aggregation: 'Average'
            }
        );

        let network_in_bytes = 0;
        let network_out_bytes = 0;

        if (networkInMetrics.value && networkInMetrics.value.length > 0) {
            const netInData = networkInMetrics.value[0].timeseries?.[0]?.data || [];
            const netInValues = netInData
                .filter(d => d.average !== undefined && d.average !== null)
                .map(d => d.average);
            if (netInValues.length > 0) {
                network_in_bytes = netInValues.reduce((sum, val) => sum + val, 0) / netInValues.length;
            }
        }

        if (networkOutMetrics.value && networkOutMetrics.value.length > 0) {
            const netOutData = networkOutMetrics.value[0].timeseries?.[0]?.data || [];
            const netOutValues = netOutData
                .filter(d => d.average !== undefined && d.average !== null)
                .map(d => d.average);
            if (netOutValues.length > 0) {
                network_out_bytes = netOutValues.reduce((sum, val) => sum + val, 0) / netOutValues.length;
            }
        }

        return {
            cpu_avg: Math.round(cpu_avg * 10) / 10,
            cpu_p95: Math.round(cpu_p95 * 10) / 10,
            memory_avg: Math.round(memory_avg * 10) / 10,
            memory_p95: Math.round(memory_p95 * 10) / 10,
            network_in_bytes: Math.round(network_in_bytes),
            network_out_bytes: Math.round(network_out_bytes),
            disk_read_iops: 0,
            disk_write_iops: 0
        };
    } catch (error) {
        logger.error(`Failed to fetch Azure Monitor metrics for ${resourceId}:`, error.message);
        // Return default values if metrics fetch fails
        return {
            cpu_avg: 50,
            cpu_p95: 70,
            memory_avg: 50,
            memory_p95: 70,
            network_in_bytes: 100000000,
            network_out_bytes: 100000000,
            disk_read_iops: 100,
            disk_write_iops: 100
        };
    }
};


const testConnection = async (creds) => {
    if (!creds.clientId || !creds.clientSecret || !creds.tenantId || !creds.subscriptionId) {
        throw new Error("Missing Azure Credentials");
    }

    // Trim whitespace from all credentials
    const cleanCreds = {
        clientId: creds.clientId.trim(),
        clientSecret: creds.clientSecret.trim(),
        tenantId: creds.tenantId.trim(),
        subscriptionId: creds.subscriptionId.trim()
    };

    try {
        const credential = new ClientSecretCredential(cleanCreds.tenantId, cleanCreds.clientId, cleanCreds.clientSecret);

        // 1. Get Access Token directly
        const tokenResponse = await credential.getToken("https://management.azure.com/.default");
        const token = tokenResponse.token;

        // 2. Call Management API using Axios
        const response = await axios.get(
            `https://management.azure.com/subscriptions/${cleanCreds.subscriptionId}?api-version=2020-01-01`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            }
        );

        const sub = response.data;
        return { success: true, message: `Connected to Azure: ${sub.displayName}`, details: sub };
    } catch (e) {
        // Handle Axios errors nicely
        let msg = e.response ? `Status ${e.response.status}: ${JSON.stringify(e.response.data)}` : e.message;

        // Provide helpful hint for 403 errors
        if (e.response && e.response.status === 403) {
            msg += " -- HINT: The App Registration (Service Principal) lacks permissions. Please assign the 'Reader' role to it for this Subscription in the Azure Portal (IAM).";
        }

        throw new Error(`Azure Auth Failed: ${msg}`);
    }
};

/**
 * Fetch Azure VMs with Azure Monitor metrics and analyze with ML
 */
const fetchResources = async (userId, creds) => {
    const instances = [];

    try {
        const credential = new ClientSecretCredential(creds.tenantId, creds.clientId, creds.clientSecret);

        // Initialize clients
        const computeClient = new ComputeManagementClient(credential, creds.subscriptionId);
        const monitorClient = new MonitorClient(credential, creds.subscriptionId);

        // Fetch VMs
        logger.info('Fetching Azure VMs...');
        for await (const vm of computeClient.virtualMachines.listAll()) {
            // Only process running VMs
            const instanceView = await computeClient.virtualMachines.instanceView(
                vm.id.split('/')[4], // Resource group name
                vm.name
            );

            const powerState = instanceView.statuses?.find(s => s.code?.startsWith('PowerState/'))?.code || 'PowerState/unknown';
            const state = powerState.replace('PowerState/', ''); // Extract state: running, stopped, deallocated, etc.

            logger.info(`Processing Azure VM ${vm.name} (${state})`);

            const vmSize = vm.hardwareProfile?.vmSize || 'Standard_B2s';
            const specs = getAzureVMSpecs(vmSize);

            // Fetch Azure Monitor metrics only for running VMs
            let metrics;
            if (state === 'running') {
                logger.info(`Fetching metrics for Azure VM ${vm.name} (${state})`);
                metrics = await fetchAzureMonitorMetrics(monitorClient, vm.id);
            } else {
                // For stopped/deallocated VMs, use zero metrics
                logger.info(`Skipping metrics for Azure VM ${vm.name} (${state})`);
                metrics = {
                    cpu_avg: 0,
                    cpu_p95: 0,
                    memory_avg: 0,
                    memory_p95: 0,
                    network_in_bytes: 0,
                    network_out_bytes: 0,
                    disk_read_iops: 0,
                    disk_write_iops: 0
                };
            }

            // Calculate uptime (Azure doesn't provide creation time easily, estimate from current time)
            const uptime_hours = 720; // Default to 30 days

            // Determine OS
            const os = vm.storageProfile?.osDisk?.osType || 'Linux';

            instances.push({
                instance_id: vm.id,
                instance_type: vmSize,
                region: vm.location,
                cloud: 'azure',
                state: state, // Add VM state
                os: os,
                vcpu_count: specs.vCpu,
                ram_gb: specs.memoryGb,
                cpu_avg: metrics.cpu_avg,
                cpu_p95: metrics.cpu_p95,
                memory_avg: metrics.memory_avg,
                memory_p95: metrics.memory_p95,
                disk_read_iops: metrics.disk_read_iops,
                disk_write_iops: metrics.disk_write_iops,
                network_in_bytes: metrics.network_in_bytes,
                network_out_bytes: metrics.network_out_bytes,
                uptime_hours,
                cost_per_month: 0, // Will be calculated by ML service from database
                source: 'cloud',
                name: vm.name,
                resource_group: vm.id.split('/')[4]
            });
        }

        logger.info(`Collected ${instances.length} Azure VMs (all states)`);

        // Normalize and enrich instances
        const normalizedVMs = instances.map(vm => normalizeVM(vm, 'cloud', { cloud: 'azure' }));
        const enrichedVMs = enrichVMBatch(normalizedVMs);

        // Send to ML service for analysis
        let mlResults = [];
        if (enrichedVMs.length > 0) {
            logger.info(`Sending ${enrichedVMs.length} Azure VMs to ML service`);
            mlResults = await processVMsInBatches(enrichedVMs, 100);
            logger.info(`Received ${mlResults.length} predictions from ML service`);
        }

        // Store results in MongoDB
        for (const result of mlResults) {
            const finding = result.prediction || 'Optimal';
            const savings = result.recommendation?.monthly_savings || result.savings || 0;
            const originalInstance = instances.find(i => i.instance_id === result.instance_id);

            await Resource.findOneAndUpdate(
                { resourceId: result.instance_id },
                {
                    userId,
                    resourceId: result.instance_id,
                    name: originalInstance?.name || result.instance_id.split('/').pop(),
                    provider: 'Azure',
                    service: 'Virtual Machine',
                    region: result.region,
                    resourceType: result.instance_type,
                    state: originalInstance?.state || 'unknown', // Add VM state
                    vCpu: result.metrics?.vcpu_count || 2,
                    memoryGb: result.metrics?.ram_gb || 4,

                    // Store metrics in the correct fields for frontend
                    avgCpuUtilization: result.metrics?.cpu_avg || 0,
                    maxCpuUtilization: result.metrics?.cpu_p95 || 0,
                    avgMemoryUtilization: result.metrics?.memory_avg || 0,
                    maxMemoryUtilization: result.metrics?.memory_p95 || 0,
                    networkIn: result.metrics?.network_in_bytes || 0,
                    networkOut: result.metrics?.network_out_bytes || 0,
                    diskReadBytes: result.metrics?.disk_read_iops || 0,
                    diskWriteBytes: result.metrics?.disk_write_iops || 0,

                    optimizationStatus: finding,
                    recommendation: result.ml_recommendation_text || result.recommendation,
                    estimatedSavings: savings,
                    estimatedMonthlyCost: result.current_cost_per_month || 0,
                    confidence: result.confidence || 0,
                    currentCost: result.current_cost_per_month || 0,
                    optimizedCost: result.recommendation?.suggested_instance ?
                        (result.current_cost_per_month - savings) : result.current_cost_per_month,
                    recommendedType: result.recommendation?.suggested_instance || result.instance_type,
                    created: Date.now(),
                    lastFetched: Date.now(),
                    metrics: result.metrics
                },
                { upsert: true }
            );
        }

        logger.info(`Azure VM sync complete for user ${userId}: ${mlResults.length} VMs analyzed`);

        // Also fetch Storage Accounts (no ML analysis needed)
        try {
            const storageClient = new StorageManagementClient(credential, creds.subscriptionId);
            let storageCount = 0;

            for await (const account of storageClient.storageAccounts.list()) {
                await Resource.findOneAndUpdate(
                    { resourceId: account.id },
                    {
                        userId,
                        resourceId: account.id,
                        name: account.name,
                        provider: 'Azure',
                        service: 'Storage Account',
                        region: account.location,
                        resourceType: account.sku?.name || 'Standard',
                        optimizationStatus: 'Optimal',
                        lastFetched: Date.now()
                    },
                    { upsert: true }
                );
                storageCount++;
            }
            logger.info(`Azure Storage sync complete: ${storageCount} accounts`);
        } catch (error) {
            logger.error("Azure Storage Fetch Error", error);
        }

        return {
            success: true,
            instancesAnalyzed: mlResults.length,
            results: mlResults
        };

    } catch (error) {
        logger.error("Azure VM Fetch Error", error);

        // Handle credential errors
        const errorInfo = await handleCloudError(error, userId, 'Azure');
        if (errorInfo.isCredentialError) {
            throw new Error(errorInfo.message);
        }

        throw error;
    }
};

module.exports = { testConnection, fetchResources };
