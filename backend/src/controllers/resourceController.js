const Resource = require('../models/Resource');

const getResourceMetrics = async (req, res) => {
    try {
        const { resourceId } = req.params;
        const resource = await Resource.findOne({ resourceId });

        const mapMetric = (historyArr, offset = 0) => {
            if (!historyArr || historyArr.length === 0) return [];
            return historyArr.map(h => ({ timestamp: h.timestamp, value: h.value + offset }));
        };

        if (resource) {
            const h = resource.metricsHistory || {};
            const metrics = {
                cpu: { avg: mapMetric(h.cpu), p95: mapMetric(h.cpu, 5), max: mapMetric(h.cpu, 15) },
                memory: { avg: mapMetric(h.memory) },
                disk: { iops: mapMetric(h.disk) },
                network: { in: mapMetric(h.networkIn), out: mapMetric(h.networkOut) },
                db: {
                    connections: mapMetric(h.dbConnections),
                    latency: mapMetric(h.dbLatency),
                    memory_pressure: mapMetric(h.dbMemoryPressure),
                    iops_read: mapMetric(h.dbIopsRead),
                    iops_write: mapMetric(h.dbIopsWrite),
                    storage_used: mapMetric(h.dbStorageUsed),
                    storage_free: mapMetric(h.dbStorageFree)
                }
            };
            return res.json({
                details: {
                    id: resource.resourceId,
                    name: resource.name,
                    provider: resource.provider,
                    region: resource.region,
                    type: resource.resourceType,
                    status: resource.optimizationStatus,
                    cost: resource.estimatedMonthlyCost,
                    savings: resource.estimatedSavings,
                    recommendation: resource.recommendation,
                    recommendedType: resource.recommendation,
                    vCpu: resource.vCpu,
                    memoryGb: resource.memoryGb,
                    service: resource.service
                },
                metrics
            });
        }
        res.status(404).json({ error: "Resource not found" });
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch metrics" });
    }
};

module.exports = { getResourceMetrics };
